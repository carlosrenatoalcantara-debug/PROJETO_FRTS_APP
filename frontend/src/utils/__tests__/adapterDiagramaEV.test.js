import { describe, it, expect } from 'vitest'
import { adaptarProjetoEV, avaliarNormas, construirCanonicalEV, escolherTemplateEV } from '../adapterDiagramaEV'
import { build, computeLayout, toReactFlow, overridesDeReactFlow } from '@diagram-engine'

const bomMono = [
  { item: 'Disjuntor termomagnético', especificacao: '40A Curva C', quantidade: 1, unidade: 'un' },
  { item: 'DPS (Proteção contra Surtos)', especificacao: '275V Classe II', quantidade: 2, unidade: 'un' },
  { item: 'Cabo Fase (L)', especificacao: '10mm² Cu 0,6/1kV — Preto', quantidade: 25, unidade: 'm' },
]
const bomTri = [
  { item: 'Disjuntor termomagnético', especificacao: '32A Curva C', quantidade: 1, unidade: 'un' },
  { item: 'DPS (Proteção contra Surtos)', especificacao: '275V Classe II', quantidade: 2, unidade: 'un' },
  { item: 'Cabo Fase L1', especificacao: '6mm² Cu 0,6/1kV — Preto', quantidade: 30, unidade: 'm' },
]

function args(over = {}) {
  return {
    calculos: { disjuntor_a: 40, dr_ma: 30, dps_kv: 275, bitola_cabo_mm2: 10 },
    bom: bomMono,
    numero_fases: 1,
    carregador: { marca: 'EVOWATT', modelo: 'KS', potencia_kw: 7.4, tensao_entrada_v: 220, corrente_entrada_a: 32, tipo_conector: '2' },
    projeto: { nome: 'P', cliente_nome: 'C', endereco: 'Rua X, Natal/RN' },
    ...over,
  }
}

// ─── RT-05 (Requisito 5) ─────────────────────────────────────────────────────
describe('RT-05 CBM/RN — não aplicar só por estar em Natal/RN', () => {
  it('residencial em Natal/RN, sem subsolo → NÃO aplica RT-05', () => {
    const { normas } = avaliarNormas({ endereco: 'Rua X, Natal/RN' })
    expect(normas).not.toContain('RT-05 CBM/RN')
    expect(normas).toEqual(['NBR 5410', 'NBR 17019', 'IEC 61851', 'IEC 62196'])
  })

  it('RN + subsolo → aplica RT-05 com motivo', () => {
    const { normas, normas_motivo } = avaliarNormas({ estado: 'RN', subsolo: true })
    expect(normas).toContain('RT-05 CBM/RN')
    const rt = normas_motivo.find(n => n.norma === 'RT-05 CBM/RN')
    expect(rt.motivo).toMatch(/RN/)
    expect(rt.motivo).toMatch(/subsolo/)
  })

  it('RN + condomínio → aplica RT-05', () => {
    const { normas } = avaliarNormas({ estado: 'RN', tipo_instalacao: 'condomínio residencial' })
    expect(normas).toContain('RT-05 CBM/RN')
  })

  it('subsolo fora de RN → NÃO aplica RT-05', () => {
    const { normas } = avaliarNormas({ estado: 'SP', subsolo: true })
    expect(normas).not.toContain('RT-05 CBM/RN')
  })

  it('metadata do adapter registra normas_motivo', () => {
    const { metadata } = adaptarProjetoEV(args({ projeto: { nome: 'P', endereco: 'Natal/RN', subsolo: true } }))
    expect(metadata.normas).toContain('RT-05 CBM/RN')
    expect(Array.isArray(metadata.normas_motivo)).toBe(true)
  })
})

// ─── Fidelidade do adapter: templates fixos (BUG-016) ─────────────────────────
describe('adapter: template determinístico + polos + DPS', () => {
  it('monofásico → EV_MONO_MONO, disjuntor 2P, IDR 2P, 2 DPS monopolares', () => {
    const { components, metadata } = adaptarProjetoEV(args({ projeto: { fases: 1 } }))
    expect(metadata.template).toBe('EV_MONO_MONO')
    expect(components.find(c => c.id === 'disj').polos).toBe(2)
    expect(components.find(c => c.id === 'dr').polos).toBe(2)
    expect(components.filter(c => c.tipo === 'dps').length).toBe(2)
    expect(components.find(c => c.id === 'dps0').polos).toBe(1)
  })

  it('trifásico → EV_TRI_TRI, disjuntor 4P, IDR 4P', () => {
    const { components, metadata } = adaptarProjetoEV(args({
      numero_fases: 3, bom: bomTri,
      carregador: { tipo: 'AC_Tri', potencia_kw: 22, tensao_entrada_v: 380 }, projeto: { fases: 3 },
    }))
    expect(metadata.template).toBe('EV_TRI_TRI')
    expect(components.find(c => c.id === 'disj').polos).toBe(4)
    expect(components.find(c => c.id === 'dr').polos).toBe(4)
  })

  it('alimentação tri + carregador mono → EV_TRI_MONO', () => {
    const { metadata } = adaptarProjetoEV(args({
      carregador: { tipo: 'AC_Mono', potencia_kw: 7, tensao_entrada_v: 220 }, projeto: { fases: 3 },
    }))
    expect(metadata.template).toBe('EV_TRI_MONO')
  })
})

// ─── BUG-011 (preservado sob os templates fixos) — cabo é edge ────────────────
describe('BUG-011 — cabo é a ligação (edge), não componente', () => {
  it('NÃO existe componente CABO; ligação DR→Carregador carrega bitola/comprimento/observações', () => {
    const { components, connections } = adaptarProjetoEV(args())
    expect(components.find(c => c.tipo === 'cabo')).toBeUndefined()
    const drCarr = connections.find(c => c.id === 'c-dr-carr')
    expect(drCarr).toBeTruthy()
    expect(drCarr.from).toBe('dr')
    expect(drCarr.to).toBe('carr')
    expect(drCarr.specs.bitola_mm2).toBe(10)
    expect(drCarr.specs).toHaveProperty('comprimento_m')
    expect(drCarr.specs).toHaveProperty('observacoes')
  })

  it('toReactFlow: edge da ligação expõe bitola/comprimento na data', () => {
    const canonical = construirCanonicalEV(args())
    const e = toReactFlow(canonical).edges.find(x => x.id === 'c-dr-carr')
    expect(e).toBeTruthy()
    expect(e.data.bitola_mm2).toBe(10)
    expect(e.data).toHaveProperty('comprimento_m')
  })
})

// ─── BUG-016 — templates elétricos fixos + regras de roteamento ───────────────
describe('BUG-016 — templates fixos e regras obrigatórias', () => {
  const tp = (components, id) => components.find(c => c.id === id)?.tipo
  const casos = [
    { nome: 'EV_MONO_MONO', a: args({ carregador: { tipo: 'AC_Mono', potencia_kw: 7, tensao_entrada_v: 220 }, projeto: { fases: 1 } }) },
    { nome: 'EV_TRI_MONO', a: args({ carregador: { tipo: 'AC_Mono', potencia_kw: 7, tensao_entrada_v: 220 }, projeto: { fases: 3 } }) },
    { nome: 'EV_TRI_TRI', a: args({ numero_fases: 3, bom: bomTri, carregador: { tipo: 'AC_Tri', potencia_kw: 22, tensao_entrada_v: 380 }, projeto: { fases: 3 } }) },
  ]
  for (const { nome, a } of casos) {
    it(`${nome}: terra nunca pelo disjuntor/IDR; DPS do IDR→Barr.Terra; tem Medidor+Barr.Terra`, () => {
      const { components, connections } = adaptarProjetoEV(a)
      for (const cx of connections) {
        const terra = (cx.condutores || []).some(c => /terra/.test(c.papel))
        if (terra) {
          expect(tp(components, cx.from)).not.toBe('disjuntor')
          expect(tp(components, cx.to)).not.toBe('disjuntor')
          expect(tp(components, cx.from)).not.toBe('dr')
          expect(tp(components, cx.to)).not.toBe('dr')
        }
      }
      for (const d of components.filter(c => c.tipo === 'dps')) {
        const viz = connections.filter(x => x.from === d.id || x.to === d.id)
          .map(x => (x.from === d.id ? x.to : x.from)).map(id => tp(components, id))
        expect(viz).toContain('dr')          // origina do IDR
        expect(viz).toContain('barramento')  // descarrega no Barramento Terra
      }
      expect(components.some(c => c.id === 'medidor')).toBe(true)
      expect(components.some(c => c.id === 'barr_terra')).toBe(true)
    })
  }

  it('escolha do template é determinística por (alimentação, carregador)', () => {
    expect(escolherTemplateEV(1, 1)).toBe('EV_MONO_MONO')
    expect(escolherTemplateEV(3, 1)).toBe('EV_TRI_MONO')
    expect(escolherTemplateEV(3, 3)).toBe('EV_TRI_TRI')
    expect(escolherTemplateEV(1, 3)).toBe('EV_TRI_TRI') // carregador tri exige alim. tri
  })

  it('posições FIXAS: mesmos args → mesmo layout (roteamento não é calculado)', () => {
    const a = args({ projeto: { fases: 1 } })
    expect(construirCanonicalEV(a).layout).toEqual(construirCanonicalEV(a).layout)
    // FEATURE-007: fileira do quadro compacto desceu para y=256 (tag MOB BOX abaixo dos blocos).
    expect(construirCanonicalEV(a).layout.medidor).toEqual({ x: 48, y: 256 })
  })
})

// ─── Hidratação + overrides + poda (Requisitos 1, 3, 4) ──────────────────────
describe('hidratação e overrides', () => {
  it('override de posição (válido, dentro do box) sobrevive ao toReactFlow', () => {
    // BUG-014: posição dentro do DIAGRAM_BOX e sem sobreposição é preservada.
    const canonical = construirCanonicalEV(args(), { overrides: { disj: { position: { x: 800, y: 356 } } } })
    const { nodes } = toReactFlow(canonical)
    const disj = nodes.find(n => n.id === 'disj')
    expect(disj.position).toEqual({ x: 800, y: 356 })
  })

  it('override órfão é podado pelo build; válido permanece', () => {
    const canonical = construirCanonicalEV(args(), {
      overrides: { disj: { position: { x: 1, y: 2 } }, fantasma: { position: { x: 0, y: 0 } } },
    })
    expect(canonical.overrides).toHaveProperty('disj')
    expect(canonical.overrides).not.toHaveProperty('fantasma')
  })

  it('mudança elétrica (40A→63A) recalcula base; override válido preservado, posições recomputadas', () => {
    // salva override em 'disj'
    const a = adaptarProjetoEV(args())
    const base = computeLayout(a.components, a.connections)
    const movido = toReactFlow(build({ ...a })).nodes.map(n => n.id === 'disj' ? { ...n, position: { x: base.disj.x + 40, y: base.disj.y } } : n)
    const overrides = overridesDeReactFlow(movido, base)
    expect(overrides).toHaveProperty('disj')

    // novo projeto elétrico (63A) — mesmo conjunto de componentes, override 'disj' segue válido
    const a2 = adaptarProjetoEV(args({ calculos: { disjuntor_a: 63, dr_ma: 30, dps_kv: 275, bitola_cabo_mm2: 16 } }))
    const canonical2 = build({ components: a2.components, connections: a2.connections, overrides })
    expect(canonical2.overrides).toHaveProperty('disj')
    expect(canonical2.components.find(c => c.id === 'disj').specs.corrente_a).toBe(63)
  })

  it('mudança que remove componente → override correspondente é podado', () => {
    // BUG-021.1: nº de DPS é por fases (mono=2, tri=4). Num projeto MONO só existem
    // dps0/dps1 — o override de dps3 (que só existiria no tri) é órfão e deve ser podado.
    const overrides = { dps3: { position: { x: 5, y: 5 } }, disj: { position: { x: 9, y: 9 } } }
    const a = adaptarProjetoEV(args({ projeto: { fases: 1 }, numero_fases: 1, carregador: { numero_fases: 1, tensao_entrada_v: 220, corrente_entrada_a: 32 } }))
    expect(a.components.filter(c => c.tipo === 'dps').length).toBe(2)
    const canonical = build({ components: a.components, connections: a.connections, overrides })
    expect(canonical.overrides).not.toHaveProperty('dps3')
    expect(canonical.overrides).toHaveProperty('disj')
  })
})
