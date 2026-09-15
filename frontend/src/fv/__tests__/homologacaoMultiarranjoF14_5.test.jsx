/**
 * F14-5 — Homologação documental multiarranjo.
 *
 * ── O que a inspeção encontrou, e mudou o sprint ────────────────────────────
 * O achatamento não estava nos templates. `projeto.inversor` e `projeto.painel`
 * NÃO EXISTEM no `ProjetoFV` — o schema tem `potencia_kwp` e `strings[]`, mais
 * nada. O memorial lia esses campos inexistentes e caía em `deps.equipamentos`,
 * que vinha vazio por causa do bug do `req` em `_carregarDepsDocumento`.
 *
 * Resultado medido contra Mercado Avelino, ANTES desta sprint:
 *
 *   4. COMPONENTES - MÓDULOS FOTOVOLTAICOS
 *   Marca: N/A   Modelo: N/A   Potência Nominal: N/A W   Número de Módulos: N/A
 *   6. COMPONENTES - INVERSOR
 *   Tipo: String   Potência Máxima (CA): N/A kW
 *
 * O documento não representava equipamento NENHUM — nem para multiarranjo, nem
 * para arranjo único. Adaptar o template sem resolver isso entregaria N seções
 * vazias em vez de uma.
 *
 * Por isso a ordem foi: corrigir o `req`, ligar o equipamento a `arranjos[]`, e
 * só então descrever N arranjos.
 */
import { describe, it, expect } from 'vitest'
import { arranjosCanonicos } from '../../../../backend/src/dominio/topologia/arranjosCanonicos.js'
import {
  gerarMemorialDescritivo, gerarCartaConcessionaria, gerarDadosART,
} from '../../../../backend/src/services/memorialDescritivoService.js'

const pain = (q, w = 445) => ({ marca: 'Talesun', fabricante: 'Talesun', modelo: 'TP6L72M', potencia_w: w, quantidade: q })
const inv = (fab, modelo, kw = 60, q = 1) => ({ fabricante: fab, marca: fab, modelo, potencia_kw: kw, quantidade: q })

/** Réplica de `homologacaoController._arranjosDocumentais`. */
function projecaoDocumental(proj, equipamentos = []) {
  const c = arranjosCanonicos(proj)
  const porModelo = new Map()
  for (const a of c.arranjos) {
    const i = a.inversor.itens[0] ?? null
    const chave = i ? `${i.fabricante ?? ''}|${i.modelo ?? ''}` : `__sem__${a.id}`
    const at = porModelo.get(chave)
    const nInv = a.inversor.itens.reduce((s, x) => s + (Number(x.quantidade) || 1), 0)
    if (at) {
      at.arranjos_ids.push(a.id); at.rotulos.push(a.rotulo ?? a.id)
      at.n_modulos += a.modulos.total; at.n_inversores += nInv
      if (!at.modulo && a.modulos.itens[0]) at.modulo = a.modulos.itens[0]
      continue
    }
    porModelo.set(chave, {
      arranjos_ids: [a.id], rotulos: [a.rotulo ?? a.id], inversor: i,
      modulo: a.modulos.itens[0] ?? null, n_modulos: a.modulos.total,
      n_inversores: nInv, topologia: a.topologia.efetiva, micros: a.topologia.micros,
    })
  }
  const porId = new Map((equipamentos || []).map((e) => [String(e._id), e]))
  const grupos = [...porModelo.values()].map((g) => ({
    ...g,
    inversor_catalogo: g.inversor?.equipamento_id ? porId.get(String(g.inversor.equipamento_id)) ?? null : null,
    modulo_catalogo: g.modulo?.equipamento_id ? porId.get(String(g.modulo.equipamento_id)) ?? null : null,
  }))
  return {
    grupos, multiarranjo: c.multiarranjo, consolidado: c.arranjos.length > grupos.length,
    n_arranjos: c.arranjos.length, n_modulos_total: c.totais.n_modulos_total,
    potencia_cc_kwp: c.totais.potencia_total_kwp, potencia_ca_kw: c.totais.potencia_inversor_total_kw,
  }
}

const memorialDe = (proj) => gerarMemorialDescritivo(proj, { nome: 'C' },
  { equipamentos: [], micros: null, arranjosDoc: projecaoDocumental(proj) })

const AVELINO = { nome: 'Mercado Avelino', potencia_kwp: 131.29, arranjos: [
  { id: 'arr_primario', rotulo: 'Arranjo A', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
  { id: 'arr_local_2', rotulo: 'Arranjo D', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Solplanet', 'ASW50K-LT-G2', 50)] },
] }
const NOVO = { nome: 'Sistema FV novo kWp', potencia_kwp: 123.09, arranjos: [
  { id: 'a1', rotulo: 'Arranjo A', tipo: 'principal', paineis: [pain(211)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
  { id: 'a2', rotulo: 'Arranjo A2', tipo: 'secundario', paineis: [pain(180)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
  { id: 'a3', rotulo: 'Arranjo B', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Huawei', 'SUN2000-50KTL-M0', 50)] },
] }

describe('F14-5 · o DOCUMENTO representa todos os arranjos', () => {
  it('1 · Mercado Avelino — os DOIS inversores aparecem no memorial', () => {
    const m = memorialDe(AVELINO)
    expect(m).toContain('SUN2000-60KTL-M0')
    expect(m).toContain('ASW50K-LT-G2')       // era este que sumia
    expect(m).toContain('Número de Módulos: 225')
    expect(m).toContain('Número de Módulos: 174')
    expect(m).toContain('Total de Módulos: 399')
  })

  it('2 · e a potência CA é a SOMA, não a do primeiro', () => {
    const m = memorialDe(AVELINO)
    expect(m).toContain('Potência Máxima (CA): 110 kW')   // 60 + 50
    expect(m).not.toContain('Potência Máxima (CA): 60 kW')
  })

  it('3 · Sistema FV novo kWp — 3 arranjos, 2 grupos, 565 módulos', () => {
    const doc = projecaoDocumental(NOVO)
    expect(doc.n_arranjos).toBe(3)
    expect(doc.grupos).toHaveLength(2)
    expect(doc.consolidado).toBe(true)
    const m = memorialDe(NOVO)
    expect(m).toContain('Total de Módulos: 565')
    expect(m).toContain('Número de Módulos: 391')   // 211 + 180 consolidados
    expect(m).toContain('Número de Módulos: 174')   // o 50K preservado
    expect(m).toContain('SUN2000-50KTL-M0')
  })

  it('4 · a consolidação NOMEIA os arranjos de origem — associação preservada', () => {
    const doc = projecaoDocumental(NOVO)
    const g60 = doc.grupos.find((g) => g.inversor.modelo === 'SUN2000-60KTL-M0')
    expect(g60.arranjos_ids).toEqual(['a1', 'a2'])
    expect(g60.n_inversores).toBe(2)
    expect(memorialDe(NOVO)).toContain('Arranjo(s): a1, a2')
  })

  it('5 · arranjo único não regride — sem seções por arranjo', () => {
    const unico = { potencia_kwp: 8.19, arranjos: [
      { id: 'A', rotulo: 'Arranjo A', tipo: 'principal', paineis: [pain(14, 585)], inversores: [inv('Huawei', 'SUN2000-5KTL', 5)] },
    ] }
    const m = memorialDe(unico)
    expect(m).toContain('4. COMPONENTES - MÓDULOS FOTOVOLTAICOS')  // título de sempre
    expect(m).not.toContain('4. COMPONENTES POR ARRANJO')
    expect(m).not.toContain('Arranjos: 1')                         // sem linha de resumo
    expect(m).toContain('SUN2000-5KTL')
  })
})

describe('F14-5 · consolidação só quando é seguro', () => {
  it('6 · modelos DIFERENTES nunca são fundidos', () => {
    const doc = projecaoDocumental(AVELINO)
    expect(doc.grupos).toHaveLength(2)
    expect(doc.consolidado).toBe(false)
    expect(doc.grupos.map((g) => g.inversor.modelo).sort())
      .toEqual(['ASW50K-LT-G2', 'SUN2000-60KTL-M0'])
  })

  it('7 · mesmo modelo consolida e SOMA quantidade', () => {
    const wagner = { arranjos: [
      { id: 'A', rotulo: 'A', tipo: 'principal', paineis: [pain(4, 615)], inversores: [inv('Hoymiles', 'HMS-2250DW-4T', 2.25)] },
      { id: 'B', rotulo: 'B', tipo: 'secundario', paineis: [pain(12, 615)], inversores: [inv('Hoymiles', 'HMS-2250DW-4T', 2.25, 3)] },
    ] }
    const doc = projecaoDocumental(wagner)
    expect(doc.grupos).toHaveLength(1)
    expect(doc.grupos[0].n_modulos).toBe(16)
    expect(doc.grupos[0].n_inversores).toBe(4)          // 1 + 3
    expect(doc.grupos[0].arranjos_ids).toEqual(['A', 'B'])
  })

  it('8 · NÃO consolida só porque o total de módulos bate', () => {
    // Mesmos 399 módulos, inversores diferentes → dois grupos, sempre.
    const doc = projecaoDocumental(AVELINO)
    expect(doc.n_modulos_total).toBe(399)
    expect(doc.grupos).toHaveLength(2)
  })
})

describe('F14-5 · provas de NÃO-PERDA', () => {
  it('9 · o segundo inversor não pode desaparecer', () => {
    const m = memorialDe(AVELINO)
    expect(m).toContain('ASW50K-LT-G2')
  })

  it('10 · o terceiro arranjo não pode desaparecer', () => {
    const doc = projecaoDocumental(NOVO)
    expect(doc.grupos.flatMap((g) => g.arranjos_ids).sort()).toEqual(['a1', 'a2', 'a3'])
  })

  it('11 · módulos de um arranjo não podem ser omitidos', () => {
    const doc = projecaoDocumental(AVELINO)
    expect(doc.grupos.reduce((s, g) => s + g.n_modulos, 0)).toBe(399)
  })

  it('12 · soma igual com distribuição trocada É DETECTADA', () => {
    // 225/174 → 174/225 mantém 399. Por grupo, não mantém.
    const trocado = { ...AVELINO, arranjos: [
      { ...AVELINO.arranjos[0], paineis: [pain(174)] },
      { ...AVELINO.arranjos[1], paineis: [pain(225)] },
    ] }
    const a = projecaoDocumental(AVELINO)
    const b = projecaoDocumental(trocado)
    expect(b.n_modulos_total).toBe(a.n_modulos_total)      // soma igual
    const porModelo = (d) => Object.fromEntries(d.grupos.map((g) => [g.inversor.modelo, g.n_modulos]))
    expect(porModelo(b)).not.toEqual(porModelo(a))         // distribuição, não
    expect(porModelo(a)['SUN2000-60KTL-M0']).toBe(225)
    expect(porModelo(b)['SUN2000-60KTL-M0']).toBe(174)
  })

  it('13 · identidade trocada é detectada', () => {
    const outro = { ...AVELINO, arranjos: [
      { ...AVELINO.arranjos[0], id: 'OUTRO' }, AVELINO.arranjos[1],
    ] }
    expect(projecaoDocumental(outro).grupos.flatMap((g) => g.arranjos_ids))
      .not.toEqual(projecaoDocumental(AVELINO).grupos.flatMap((g) => g.arranjos_ids))
  })
})

describe('F14-5 · carta e ART', () => {
  it('14 · a carta usa a potência CA TOTAL e lista os modelos', () => {
    const carta = gerarCartaConcessionaria(AVELINO, { nome: 'C' }, { arranjosDoc: projecaoDocumental(AVELINO) })
    expect(carta).toContain('Potência CA: 110 kW')
    expect(carta).toContain('Inversores:')
    expect(carta).toContain('SUN2000-60KTL-M0')
    expect(carta).toContain('ASW50K-LT-G2')
  })

  it('15 · a carta de arranjo único não ganha a linha de inversores', () => {
    const unico = { potencia_kwp: 8.19, arranjos: [
      { id: 'A', tipo: 'principal', paineis: [pain(14, 585)], inversores: [inv('Huawei', 'SUN2000-5KTL', 5)] },
    ] }
    const carta = gerarCartaConcessionaria(unico, { nome: 'C' }, { arranjosDoc: projecaoDocumental(unico) })
    expect(carta).not.toContain('Inversores:')
  })

  it('16 · a ART lista os inversores em vez de citar um', () => {
    const art = gerarDadosART(AVELINO, {}, { arranjosDoc: projecaoDocumental(AVELINO) })
    expect(art.potencia_ac).toBe('110 kW')
    expect(art.inversores).toHaveLength(2)
    expect(art.inversores.map((i) => i.modelo).sort()).toEqual(['ASW50K-LT-G2', 'SUN2000-60KTL-M0'])
    expect(art.inversores.find((i) => i.modelo === 'ASW50K-LT-G2').arranjos).toEqual(['arr_local_2'])
  })
})

describe('F14-5 · o que ainda é recusado', () => {
  /** Réplica de `_avaliarSuporteDocumental`. */
  const suporte = (proj) => {
    const doc = projecaoDocumental(proj)
    const orfaos = doc.grupos.filter((g) => g.n_modulos > 0 && !g.inversor)
    return orfaos.length === 0
      ? { suportado: true }
      : { suportado: false, motivo: 'ARRANJO_COM_MODULOS_SEM_INVERSOR' }
  }

  it('17 · os 3 projetos antes bloqueados agora EMITEM', () => {
    const c131 = { arranjos: [
      { id: 'A', rotulo: 'A', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'B', rotulo: 'B', tipo: 'secundario', paineis: [pain(160)], inversores: [inv('Huawei', 'SUN2000-50KTL-M0', 50)] },
    ] }
    for (const p of [AVELINO, c131, NOVO]) expect(suporte(p).suportado).toBe(true)
  })

  it('18 · arranjo COM módulos e SEM inversor continua recusado', () => {
    const orfao = { arranjos: [
      { id: 'A', rotulo: 'A', tipo: 'principal', paineis: [pain(10)], inversores: [inv('Huawei', 'M')] },
      { id: 'B', rotulo: 'B', tipo: 'secundario', paineis: [pain(20)], inversores: [] },
    ] }
    const s = suporte(orfao)
    expect(s.suportado).toBe(false)
    expect(s.motivo).toBe('ARRANJO_COM_MODULOS_SEM_INVERSOR')
  })

  it('19 · arranjo VAZIO (Ampliação) não recusa e não herda da raiz', () => {
    const ampliacao = { arranjos: [
      { id: 'exist_1', rotulo: 'Existente 1', tipo: 'existente', paineis: [pain(8, 530)], inversores: [inv('Solis', '1P7K-5G', 7)] },
      { id: 'ampl_2', rotulo: 'Ampliação', tipo: 'ampliacao', paineis: [], inversores: [] },
    ], equipamentos: { inversor: { marca: 'Huawei', modelo: 'SUN2000-60KTL-M0', potencia_kw: 60 } } }
    expect(suporte(ampliacao).suportado).toBe(true)
    const c = arranjosCanonicos(ampliacao)
    expect(c.arranjos[1].inversor.itens).toEqual([])
    expect(memorialDe(ampliacao)).not.toContain('SUN2000-60KTL-M0')   // raiz não vaza
  })
})
