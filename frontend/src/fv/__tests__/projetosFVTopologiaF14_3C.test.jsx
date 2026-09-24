/**
 * F14-3C — `projetosFVController` migrado para o adapter.
 *
 * `listarOpcoesFV` tinha a MESMA expressão de `EnvioPropostaService`, copiada:
 *
 *   const arranjo = (o.arranjos ?? [])[0] ?? null
 *   const topologia = arranjo?.configuracao_eletrica?.micros?.length ? 'micro'
 *     : (arranjo?.topologia ?? (o.engenharia_eletrica?.arranjo?.mppts?.length ? 'string' : null))
 *
 * Que ela existisse em dois lugares é o que fazia a regra divergir sozinha — o
 * mesmo defeito reescrito duas vezes, sem nada para mantê-las iguais. A F14-3B
 * migrou a primeira; esta migra a segunda. Depois disso, nenhum consumidor de
 * produção resolve topologia por conta própria.
 *
 * Agora: `arranjosCanonicos(o).topologiaProjeto.efetiva`.
 *
 * Metodologia idêntica à da F14-3B: `ANTES` é a implementação anterior copiada
 * VERBATIM, comparada com `DEPOIS` em cada cenário.
 */
import { describe, it, expect } from 'vitest'
import { arranjosCanonicos } from '../../../../backend/src/dominio/topologia/arranjosCanonicos.js'

/** A lógica ANTERIOR do controller, preservada para comparação. */
function ANTES(o) {
  const arranjo = (o.arranjos ?? [])[0] ?? null
  return arranjo?.configuracao_eletrica?.micros?.length ? 'micro'
    : (arranjo?.topologia ?? (o.engenharia_eletrica?.arranjo?.mppts?.length ? 'string' : null))
}

/** O que o controller faz AGORA. */
const DEPOIS = (o) => arranjosCanonicos(o).topologiaProjeto.efetiva

const pain = (q, w = 445) => ({ marca: 'T', modelo: 'TSM', potencia_w: w, quantidade: q })
const inv = (fab, modelo, kw = 60) => ({ fabricante: fab, marca: fab, modelo, potencia_kw: kw, quantidade: 1 })
const arr = (id, tipo, extra = {}) => ({
  id, tipo, paineis: [pain(10)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')], ...extra,
})

describe('F14-3C · equivalência ANTES × DEPOIS', () => {
  it('1 · single `string`', () => {
    const o = { arranjos: [arr('A', 'principal', { topologia: 'string' })] }
    expect(DEPOIS(o)).toBe('string')
    expect(DEPOIS(o)).toBe(ANTES(o))
  })

  it('2 · single `micro`', () => {
    const o = { arranjos: [arr('A', 'principal', { topologia: 'micro' })] }
    expect(DEPOIS(o)).toBe('micro')
    expect(DEPOIS(o)).toBe(ANTES(o))
  })

  it('3 · multi `string + string` → `string`', () => {
    const o = { arranjos: [
      arr('A', 'principal', { topologia: 'string' }),
      arr('B', 'secundario', { topologia: 'string' }),
    ] }
    expect(DEPOIS(o)).toBe('string')
    expect(DEPOIS(o)).toBe(ANTES(o))
  })

  it('4 · multi `micro + micro` → `micro`', () => {
    const o = { arranjos: [
      arr('A', 'principal', { topologia: 'micro' }),
      arr('B', 'secundario', { topologia: 'micro' }),
    ] }
    expect(DEPOIS(o)).toBe('micro')
    expect(DEPOIS(o)).toBe(ANTES(o))
  })

  it('5 · multi `micro + string` → `null` / divergente', () => {
    const o = { arranjos: [
      arr('A', 'principal', { topologia: 'micro' }),
      arr('B', 'secundario', { topologia: 'string' }),
    ] }
    expect(ANTES(o)).toBe('micro')        // a do primeiro
    expect(DEPOIS(o)).toBeNull()
    expect(arranjosCanonicos(o).topologiaProjeto.origem).toBe('divergente')
  })

  it('6 · LEGACY single → resultado anterior', () => {
    const o = {
      arranjos: [arr('A', 'principal')],
      engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, total_modulos: 10 }] } },
    }
    expect(ANTES(o)).toBe('string')
    expect(DEPOIS(o)).toBe('string')
  })

  it('7 · LEGACY multiarranjo não atribuível → `null` / ambíguo', () => {
    const o = {
      arranjos: [arr('A', 'principal'), arr('B', 'secundario')],
      engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, total_modulos: 10 }] } },
    }
    expect(ANTES(o)).toBe('string')       // atribuía ao primeiro
    expect(DEPOIS(o)).toBeNull()
    expect(arranjosCanonicos(o).topologiaProjeto.ambiguo).toBe(true)
  })

  it('8 · ausência → `null`', () => {
    const o = { arranjos: [arr('A', 'principal')] }
    expect(ANTES(o)).toBeNull()
    expect(DEPOIS(o)).toBeNull()
  })

  it('9 · inverter a ORDEM não altera o resultado — prova de que `[0]` não voltou', () => {
    const micro = arr('M', 'principal', { topologia: 'micro' })
    const string = arr('S', 'secundario', { topologia: 'string' })
    // ANTES: a ordem decidia o rótulo.
    expect(ANTES({ arranjos: [micro, string] })).toBe('micro')
    expect(ANTES({ arranjos: [string, micro] })).toBe('string')
    // DEPOIS: é o mesmo projeto, então é o mesmo resultado.
    expect(DEPOIS({ arranjos: [micro, string] })).toBe(DEPOIS({ arranjos: [string, micro] }))
    expect(DEPOIS({ arranjos: [micro, string] })).toBeNull()
    // E também no caso unânime, onde ANTES já acertava por sorte.
    const s2 = arr('S2', 'secundario', { topologia: 'string' })
    expect(DEPOIS({ arranjos: [string, s2] })).toBe(DEPOIS({ arranjos: [s2, string] }))
  })
})

describe('F14-3C · os 5 projetos reais', () => {
  const CASOS = [
    ['Mercado Avelino', [
      { id: 'arr_primario', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'arr_local_2', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Solplanet', 'ASW50K-LT-G2', 50)] },
    ], 399, 2],
    ['Sistema FV 131.29 kWp', [
      { id: 'arr_primario', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'arr_178', tipo: 'secundario', paineis: [pain(160)], inversores: [inv('Huawei', 'SUN2000-50KTL-M0', 50)] },
    ], 385, 2],
    ['Sistema FV novo kWp', [
      { id: 'arr_primario', tipo: 'principal', paineis: [pain(211)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'arr_mty', tipo: 'secundario', paineis: [pain(180)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'arr_178', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Huawei', 'SUN2000-50KTL-M0', 50)] },
    ], 565, 3],
    ['Ampliação', [
      { id: 'exist_1', tipo: 'existente', paineis: [{ marca: 'Jinko', modelo: 'JKM530M', potencia_w: 530, quantidade: 8 }], inversores: [inv('Solis', '1P7K-5G', 7)] },
      { id: 'ampl_2', tipo: 'ampliacao', paineis: [], inversores: [] },
    ], 8, 2],
    ['Wagner Hoymiles + tcl', [
      { id: 'arr_primario', tipo: 'principal', paineis: [{ marca: 'TCL', modelo: 'HSM-ND66', potencia_w: 615, quantidade: 4 }], inversores: [inv('Hoymiles', 'HMS-2250DW-4T', 2.25)] },
      { id: 'arr_1784', tipo: 'secundario', paineis: [{ marca: 'TCL', modelo: 'HSM-ND66', potencia_w: 615, quantidade: 12 }], inversores: [{ ...inv('Hoymiles', 'HMS-2250DW-4T', 2.25), quantidade: 3 }] },
    ], 16, 2],
  ]

  it.each(CASOS)('%s — rótulo idêntico ao anterior', (_nome, arranjos) => {
    expect(DEPOIS({ arranjos })).toBe(ANTES({ arranjos }))
  })

  it.each(CASOS)('%s — nenhum arranjo descartado, sem atribuição cruzada', (_nome, arranjos, modulos, n) => {
    const c = arranjosCanonicos({ arranjos })
    expect(c.arranjos).toHaveLength(n)
    expect(c.totais.n_modulos_total).toBe(modulos)
    expect(c.arranjos.map((a) => a.id)).toEqual(arranjos.map((a) => a.id))
    // Cada arranjo fica com o PRÓPRIO inversor — nada migra de um para outro.
    c.arranjos.forEach((a, i) => {
      const doDoc = (arranjos[i].inversores ?? []).map((x) => x.modelo)
      expect(a.inversor.itens.map((x) => x.modelo)).toEqual(doDoc)
    })
  })
})

describe('F14-3C · a regra deixou de existir em duplicata', () => {
  it('10 · os dois consumidores migrados dão o MESMO resultado', () => {
    // `EnvioPropostaService` (F14-3B) e `projetosFVController` (F14-3C) chamam
    // a mesma função. Enquanto cada um tinha a sua cópia, nada garantia isso.
    const casos = [
      { arranjos: [arr('A', 'principal', { topologia: 'string' })] },
      { arranjos: [arr('A', 'principal', { topologia: 'micro' }), arr('B', 'secundario', { topologia: 'string' })] },
      { arranjos: [arr('A', 'principal')], engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1 }] } } },
      { arranjos: [] },
    ]
    for (const o of casos) {
      const viaAdapter = arranjosCanonicos(o).topologiaProjeto.efetiva
      expect(DEPOIS(o)).toBe(viaAdapter)
    }
  })
})
