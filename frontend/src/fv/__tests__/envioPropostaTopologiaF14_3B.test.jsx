/**
 * F14-3B — `EnvioPropostaService` migrado para o adapter.
 *
 * O serviço tinha isto:
 *
 *   const arranjo = (o.arranjos ?? [])[0] ?? null
 *   const topologia = arranjo?.configuracao_eletrica?.micros?.length ? 'micro'
 *     : (arranjo?.topologia ?? (o.engenharia_eletrica?.arranjo?.mppts?.length ? 'string' : null))
 *
 * Três problemas num lugar só: pegava o PRIMEIRO arranjo e chamava a topologia
 * dele de "a do projeto"; reimplementava uma precedência que
 * `projetosFVController` também tinha, copiada; e num projeto de `micro +
 * string` devolvia a do primeiro sem dizer que havia outro.
 *
 * Agora usa `arranjosCanonicos(o).topologiaProjeto.efetiva`.
 *
 * ── O que estes testes provam ───────────────────────────────────────────────
 * `ANTES` é a implementação anterior, copiada VERBATIM. Cada cenário compara
 * `ANTES` com `DEPOIS`, de modo que a migração seja demonstrada equivalente —
 * e, onde NÃO é equivalente, que a diferença seja a remoção de uma escolha por
 * posição, nunca uma mudança de negócio.
 */
import { describe, it, expect } from 'vitest'
import { arranjosCanonicos } from '../../../../backend/src/dominio/topologia/arranjosCanonicos.js'

/** A lógica ANTERIOR do serviço, preservada para comparação. */
function ANTES(o) {
  const arranjo = (o.arranjos ?? [])[0] ?? null
  return arranjo?.configuracao_eletrica?.micros?.length ? 'micro'
    : (arranjo?.topologia ?? (o.engenharia_eletrica?.arranjo?.mppts?.length ? 'string' : null))
}

/** O que o serviço faz AGORA — a mesma expressão de `EnvioPropostaService`. */
const DEPOIS = (o) => arranjosCanonicos(o).topologiaProjeto.efetiva

const pain = (q, w = 445) => ({ marca: 'T', modelo: 'TSM', potencia_w: w, quantidade: q })
const inv = (fab, modelo, kw = 60) => ({ fabricante: fab, marca: fab, modelo, potencia_kw: kw, quantidade: 1 })
const arr = (id, tipo, extra = {}) => ({
  id, tipo, paineis: [pain(10)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')], ...extra,
})

describe('F14-3B · equivalência ANTES × DEPOIS', () => {
  it('Caso 1 · single-arranjo `string`', () => {
    const o = { arranjos: [arr('A', 'principal', { topologia: 'string' })] }
    expect(DEPOIS(o)).toBe('string')
    expect(DEPOIS(o)).toBe(ANTES(o))
  })

  it('Caso 2 · single-arranjo `micro`', () => {
    const o = { arranjos: [arr('A', 'principal', { topologia: 'micro' })] }
    expect(DEPOIS(o)).toBe('micro')
    expect(DEPOIS(o)).toBe(ANTES(o))
  })

  it('Caso 3 · multiarranjo `string + string` → `string`', () => {
    const o = { arranjos: [
      arr('A', 'principal', { topologia: 'string' }),
      arr('B', 'secundario', { topologia: 'string' }),
    ] }
    expect(DEPOIS(o)).toBe('string')
    expect(DEPOIS(o)).toBe(ANTES(o))
  })

  it('Caso 4 · multiarranjo `micro + micro` → `micro`', () => {
    const o = { arranjos: [
      arr('A', 'principal', { topologia: 'micro' }),
      arr('B', 'secundario', { topologia: 'micro' }),
    ] }
    expect(DEPOIS(o)).toBe('micro')
    expect(DEPOIS(o)).toBe(ANTES(o))
  })

  it('Caso 5 · multiarranjo `micro + string` → `null`, e é AQUI que muda', () => {
    const o = { arranjos: [
      arr('A', 'principal', { topologia: 'micro' }),
      arr('B', 'secundario', { topologia: 'string' }),
    ] }
    // ANTES devolvia 'micro' — a do primeiro, sem dizer que havia outro.
    expect(ANTES(o)).toBe('micro')
    // DEPOIS: duas classificações conhecidas e diferentes → não se escolhe uma.
    expect(DEPOIS(o)).toBeNull()
    expect(arranjosCanonicos(o).topologiaProjeto.origem).toBe('divergente')
    expect(arranjosCanonicos(o).topologiaProjeto.valores.sort()).toEqual(['micro', 'string'])
    // A única divergência do sprint, e ela é a REMOÇÃO da escolha posicional.
  })

  it('Caso 6 · arranjo vazio não herda topologia nem inversor da raiz', () => {
    const o = {
      arranjos: [
        arr('exist_1', 'existente', { topologia: 'string' }),
        { id: 'ampl_2', tipo: 'ampliacao', paineis: [], inversores: [] },
      ],
      equipamentos: { inversor: { marca: 'Huawei', modelo: 'SUN2000-60KTL-M0', potencia_kw: 60 } },
    }
    const c = arranjosCanonicos(o)
    expect(c.arranjos).toHaveLength(2)
    expect(c.arranjos[1].topologia.efetiva).toBeNull()
    expect(c.arranjos[1].inversor.estado).toBe('ambiguo')   // não recebe o da raiz
    expect(c.arranjos[1].inversor.itens).toEqual([])
    // `null` do vazio não é discordância: o conhecido é unânime.
    expect(DEPOIS(o)).toBe('string')
    expect(DEPOIS(o)).toBe(ANTES(o))
  })

  it('Caso 7 · LEGACY single-arranjo preserva o resultado anterior', () => {
    const o = {
      arranjos: [arr('A', 'principal')],
      engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, total_modulos: 10 }] } },
    }
    expect(ANTES(o)).toBe('string')
    expect(DEPOIS(o)).toBe('string')
  })

  it('Caso 8 · LEGACY multiarranjo não atribuível → não seleciona `[0]`', () => {
    const o = {
      arranjos: [arr('A', 'principal'), arr('B', 'secundario')],
      engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, total_modulos: 10 }] } },
    }
    // ANTES: caía no passo 3 e atribuía 'string' — ao primeiro, por posição.
    expect(ANTES(o)).toBe('string')
    // DEPOIS: a topologia do projeto não tem dono; nenhum arranjo a recebe.
    expect(DEPOIS(o)).toBeNull()
    const c = arranjosCanonicos(o)
    expect(c.arranjos.every((a) => a.topologia.estado === 'ambiguo')).toBe(true)
    expect(c.topologiaProjeto.ambiguo).toBe(true)
  })

  it('Caso 9 · ausência de topologia preserva `null`', () => {
    const o = { arranjos: [arr('A', 'principal')] }
    expect(ANTES(o)).toBeNull()
    expect(DEPOIS(o)).toBeNull()
  })
})

describe('F14-3B · os 5 projetos reais', () => {
  // Fixtures espelhando o banco: `topologia` null em todos, sem micros, sem
  // mppts, sem `engenharia_eletrica` — exatamente como medido na F14.
  const CASOS = [
    ['Mercado Avelino', [
      { id: 'arr_primario', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'arr_local_2', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Solplanet', 'ASW50K-LT-G2', 50)] },
    ], 399],
    ['Sistema FV 131.29 kWp', [
      { id: 'arr_primario', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'arr_178', tipo: 'secundario', paineis: [pain(160)], inversores: [inv('Huawei', 'SUN2000-50KTL-M0', 50)] },
    ], 385],
    ['Sistema FV novo kWp', [
      { id: 'arr_primario', tipo: 'principal', paineis: [pain(211)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'arr_mty', tipo: 'secundario', paineis: [pain(180)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'arr_178', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Huawei', 'SUN2000-50KTL-M0', 50)] },
    ], 565],
    ['Ampliação', [
      { id: 'exist_1', tipo: 'existente', paineis: [{ marca: 'Jinko', modelo: 'JKM530M', potencia_w: 530, quantidade: 8 }], inversores: [inv('Solis', '1P7K-5G', 7)] },
      { id: 'ampl_2', tipo: 'ampliacao', paineis: [], inversores: [] },
    ], 8],
    ['Wagner Hoymiles + tcl', [
      { id: 'arr_primario', tipo: 'principal', paineis: [{ marca: 'TCL', modelo: 'HSM-ND66', potencia_w: 615, quantidade: 4 }], inversores: [inv('Hoymiles', 'HMS-2250DW-4T', 2.25)] },
      { id: 'arr_1784', tipo: 'secundario', paineis: [{ marca: 'TCL', modelo: 'HSM-ND66', potencia_w: 615, quantidade: 12 }], inversores: [{ ...inv('Hoymiles', 'HMS-2250DW-4T', 2.25), quantidade: 3 }] },
    ], 16],
  ]

  it.each(CASOS)('%s — rótulo idêntico ao anterior', (_nome, arranjos) => {
    const o = { arranjos }
    expect(DEPOIS(o)).toBe(ANTES(o))
  })

  it.each(CASOS)('%s — nenhum arranjo deixa de ser considerado', (_nome, arranjos, modulos) => {
    const c = arranjosCanonicos({ arranjos })
    expect(c.arranjos).toHaveLength(arranjos.length)
    expect(c.totais.n_modulos_total).toBe(modulos)
    // Identidade preservada uma a uma — o adapter não colapsa no primeiro.
    expect(c.arranjos.map((a) => a.id)).toEqual(arranjos.map((a) => a.id))
  })
})

describe('F14-3B · a seleção posicional saiu do serviço', () => {
  it('o rótulo não depende da ORDEM dos arranjos', () => {
    // É a prova direta de que `[0]` não manda mais: inverter a lista não muda
    // nada. Com a lógica anterior, inverter `micro + string` mudava o rótulo.
    const a = { id: 'A', tipo: 'principal', topologia: 'string', paineis: [pain(10)], inversores: [inv('Huawei', 'M')] }
    const b = { id: 'B', tipo: 'secundario', topologia: 'string', paineis: [pain(10)], inversores: [inv('Huawei', 'M2')] }
    expect(DEPOIS({ arranjos: [a, b] })).toBe(DEPOIS({ arranjos: [b, a] }))

    const micro = { ...a, id: 'M', topologia: 'micro' }
    // ANTES: a ordem decidia o rótulo.
    expect(ANTES({ arranjos: [micro, b] })).toBe('micro')
    expect(ANTES({ arranjos: [b, micro] })).toBe('string')
    // DEPOIS: a ordem é irrelevante — os dois casos são o mesmo projeto.
    expect(DEPOIS({ arranjos: [micro, b] })).toBe(DEPOIS({ arranjos: [b, micro] }))
  })
})
