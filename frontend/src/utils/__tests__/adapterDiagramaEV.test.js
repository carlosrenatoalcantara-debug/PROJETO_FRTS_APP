import { describe, it, expect } from 'vitest'
import { adaptarProjetoEV, avaliarNormas, construirCanonicalEV } from '../adapterDiagramaEV'
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

// ─── Fidelidade do adapter ───────────────────────────────────────────────────
describe('adapter: polos/condutores/DPS conforme projeto', () => {
  it('monofásico → disjuntor 2P, 3 condutores, 2 DPS monopolares', () => {
    const { components, connections } = adaptarProjetoEV(args())
    expect(components.find(c => c.id === 'disj').polos).toBe(2)
    expect(components.filter(c => c.tipo === 'dps').length).toBe(2)
    expect(components.find(c => c.id === 'dps0').polos).toBe(1)
    const cabo = connections.find(c => c.id === 'c-rede-disj')
    expect(cabo.condutores.length).toBe(3)
  })

  it('trifásico → disjuntor 4P, 5 condutores', () => {
    const { components, connections } = adaptarProjetoEV(args({ numero_fases: 3, bom: bomTri }))
    expect(components.find(c => c.id === 'disj').polos).toBe(4)
    expect(connections.find(c => c.id === 'c-rede-disj').condutores.length).toBe(5)
  })
})

// ─── Hidratação + overrides + poda (Requisitos 1, 3, 4) ──────────────────────
describe('hidratação e overrides', () => {
  it('override de posição sobrevive ao toReactFlow', () => {
    const canonical = construirCanonicalEV(args(), { overrides: { disj: { position: { x: 999, y: 111 } } } })
    const { nodes } = toReactFlow(canonical)
    const disj = nodes.find(n => n.id === 'disj')
    expect(disj.position).toEqual({ x: 999, y: 111 })
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
    // de 2 DPS (mono) para 1 DPS bipolar: dps1 deixa de existir
    const overrides = { dps1: { position: { x: 5, y: 5 } }, disj: { position: { x: 9, y: 9 } } }
    const a = adaptarProjetoEV(args({ bom: [...bomMono.slice(0, 1), { item: 'DPS (Proteção contra Surtos)', especificacao: '275V', quantidade: 1, unidade: 'un' }, bomMono[2]] }))
    const canonical = build({ components: a.components, connections: a.connections, overrides })
    expect(canonical.overrides).not.toHaveProperty('dps1')
    expect(canonical.overrides).toHaveProperty('disj')
  })
})
