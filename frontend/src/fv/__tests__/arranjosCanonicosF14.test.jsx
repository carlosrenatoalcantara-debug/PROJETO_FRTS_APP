/**
 * F14-IMP — Adapter canônico por arranjo.
 *
 * O adapter existe para que a regra de compatibilidade legada viva em UM lugar.
 * Hoje ela vive espalhada, e a forma mais curta de escrevê-la é `arranjos[0]` —
 * foi assim que `homologacaoController` passou a descartar até 354 de 565
 * módulos (63%) do documento da distribuidora, e que `unifilar/adaptarProjeto`
 * passou a produzir `inversor: AUSENTE` em 5 de 5 projetos multiarranjo.
 *
 * Nenhum consumidor foi ligado a ele neste sprint. Estes testes provam que ele
 * PODE representar os casos reais antes de qualquer migração.
 *
 * Fixtures espelham os projetos reais medidos na F14.
 */
import { describe, it, expect } from 'vitest'
import {
  arranjosCanonicos, arranjoPorId, arranjoPrincipalUnico,
  ESTADO_PROJETO, ESTADO_DADO, FONTE,
} from '../../../../backend/src/dominio/topologia/arranjosCanonicos.js'
import { compararModelos } from '../../../../backend/src/dominio/topologia/preservacaoArranjos.js'

const painel = (q, w = 445) => ({ marca: 'Talesun', modelo: 'TP6L72M(H)-445W', potencia_w: w, quantidade: q })
const inv = (fab, modelo, kw, q = 1) => ({ fabricante: fab, marca: fab, modelo, potencia_kw: kw, quantidade: q })
const arr = (id, paineis, inversores, extra = {}) => ({
  id, rotulo: id, tipo: 'secundario', paineis, inversores, ...extra,
})

describe('F14-IMP · Cenário A — projeto com 1 arranjo', () => {
  const projeto = { arranjos: [arr('arr_A', [painel(14, 585)], [inv('Huawei', 'SUN2000-5KTL', 5)], { tipo: 'principal' })] }

  it('1 · devolve exatamente um arranjo, com o equipamento certo', () => {
    const c = arranjosCanonicos(projeto)
    expect(c.estado).toBe(ESTADO_PROJETO.ARRANJO_UNICO)
    expect(c.multiarranjo).toBe(false)
    expect(c.arranjos).toHaveLength(1)
    expect(c.arranjos[0].inversor.itens[0].modelo).toBe('SUN2000-5KTL')
    expect(c.arranjos[0].modulos.total).toBe(14)
  })

  it('2 · os totais continuam vindo da camada oficial — sem segunda fonte', () => {
    const c = arranjosCanonicos(projeto)
    expect(c.totais.n_modulos_total).toBe(14)
    expect(c.totais.potencia_total_kwp).toBe(8.19)   // 14 × 585 W
    expect(c.origem).toBe('arranjo')
  })
})

describe('F14-IMP · Cenário B — Mercado Avelino (2 arranjos)', () => {
  const projeto = {
    arranjos: [
      arr('arr_primario', [painel(225)], [inv('Huawei', 'SUN2000-60KTL-M0', 60)], { tipo: 'principal' }),
      arr('arr_local_mqlbbhff_2', [painel(174)], [inv('Solplanet', 'ASW50K-LT-G2', 50)]),
    ],
  }

  it('3 · preserva OS DOIS arranjos — nenhum descartado', () => {
    const c = arranjosCanonicos(projeto)
    expect(c.arranjos).toHaveLength(2)
    expect(c.estado).toBe(ESTADO_PROJETO.MULTIARRANJO)
  })

  it('4 · cada arranjo mantém os próprios módulos e o próprio inversor', () => {
    const c = arranjosCanonicos(projeto)
    const [a, b] = c.arranjos
    expect(a.modulos.total).toBe(225)
    expect(a.inversor.itens[0].modelo).toBe('SUN2000-60KTL-M0')
    expect(b.modulos.total).toBe(174)
    expect(b.inversor.itens[0].modelo).toBe('ASW50K-LT-G2')
    // 399 no total — o número que `homologacaoController` reduz a 225.
    expect(c.totais.n_modulos_total).toBe(399)
  })
})

describe('F14-IMP · Cenário C — Sistema FV novo kWp (3 arranjos)', () => {
  const projeto = {
    arranjos: [
      arr('arr_primario', [painel(211)], [inv('Huawei', 'SUN2000-60KTL-M0', 60)], { tipo: 'principal' }),
      arr('arr_mtytx702_1', [painel(180)], [inv('Huawei', 'SUN2000-60KTL-M0', 60)]),
      arr('arr_1782072327297_0', [painel(174)], [inv('Huawei', 'SUN2000-50KTL-M0', 50)]),
    ],
  }

  it('5 · preserva OS TRÊS arranjos e os 565 módulos', () => {
    const c = arranjosCanonicos(projeto)
    expect(c.arranjos).toHaveLength(3)
    expect(c.arranjos.map((a) => a.modulos.total)).toEqual([211, 180, 174])
    expect(c.totais.n_modulos_total).toBe(565)
    // É o caso em que a seleção posicional descarta 354 de 565 (63%).
    expect(c.arranjos.reduce((s, a) => s + a.modulos.total, 0)).toBe(565)
  })

  it('6 · identidade, não posição — busca por id acha o do meio', () => {
    const c = arranjosCanonicos(projeto)
    const meio = arranjoPorId(c, 'arr_mtytx702_1')
    expect(meio.modulos.total).toBe(180)
    expect(arranjoPorId(c, 'inexistente')).toBeNull()   // não devolve "o primeiro"
  })
})

describe('F14-IMP · Cenário D — dois inversores diferentes', () => {
  const projeto = {
    arranjos: [
      arr('A', [painel(225)], [inv('Huawei', 'SUN2000-60KTL-M0', 60)], { tipo: 'principal' }),
      arr('B', [painel(160)], [inv('Huawei', 'SUN2000-50KTL-M0', 50)]),
    ],
  }

  it('7 · representa os dois, sem escolher o primeiro', () => {
    const c = arranjosCanonicos(projeto)
    const modelos = c.arranjos.map((a) => a.inversor.itens[0].modelo)
    expect(modelos).toEqual(['SUN2000-60KTL-M0', 'SUN2000-50KTL-M0'])
    expect(c.arranjos.every((a) => a.inversor.fonte === FONTE.ARRANJO)).toBe(true)
    expect(c.totais.potencia_inversor_total_kw).toBe(110)
  })

  it('8 · `arranjoPrincipalUnico` devolve o principal quando há exatamente um', () => {
    const c = arranjosCanonicos(projeto)
    expect(arranjoPrincipalUnico(c).id).toBe('A')
  })

  it('9 · e devolve null quando há dois principais — em vez de escolher', () => {
    const dois = { arranjos: [
      arr('A', [painel(10)], [inv('X', 'M1', 5)], { tipo: 'principal' }),
      arr('B', [painel(10)], [inv('X', 'M2', 5)], { tipo: 'principal' }),
    ] }
    const c = arranjosCanonicos(dois)
    expect(arranjoPrincipalUnico(c)).toBeNull()
    expect(c.avisos).toContain('MAIS_DE_UM_PRINCIPAL')
  })
})

describe('F14-IMP · Cenário E — legado com topologia só no projeto', () => {
  const mppts = [{ mppt: 1, strings_paralelo: 2, modulos_por_string: 7, total_modulos: 14 }]

  it('10 · arranjo único usa o fallback LEGADO, explicitamente marcado', () => {
    const c = arranjosCanonicos({
      arranjos: [arr('A', [painel(14, 585)], [inv('Huawei', 'SUN2000-5KTL', 5)], { tipo: 'principal' })],
      engenharia_eletrica: { arranjo: { mppts } },
    })
    const t = c.arranjos[0].topologia
    expect(t.estado).toBe(ESTADO_DADO.DISPONIVEL)
    expect(t.fonte).toBe(FONTE.LEGACY_TOPOLOGIA)     // rastreável, não silencioso
    expect(t.mppts).toHaveLength(1)
    expect(c.fontes.topologia).toContain(FONTE.LEGACY_TOPOLOGIA)
  })

  it('11 · com DOIS arranjos a topologia do projeto não tem dono → ambíguo', () => {
    // É aqui que a arquitetura atual deixa de representar o segundo arranjo.
    // Atribuí-la a um deles seria o `[0]` implícito que este módulo remove.
    const c = arranjosCanonicos({
      arranjos: [
        arr('A', [painel(211)], [inv('Huawei', 'M1', 60)], { tipo: 'principal' }),
        arr('B', [painel(180)], [inv('Huawei', 'M2', 60)]),
      ],
      engenharia_eletrica: { arranjo: { mppts } },
    })
    expect(c.arranjos.every((a) => a.topologia.estado === ESTADO_DADO.AMBIGUO)).toBe(true)
    expect(c.arranjos.every((a) => a.topologia.mppts)).toBeTruthy()
    expect(c.arranjos[0].topologia.mppts).toHaveLength(0)   // não copia para ninguém
    expect(c.avisos).toContain('TOPOLOGIA_DE_PROJETO_NAO_ATRIBUIVEL')
  })

  it('12 · topologia do PRÓPRIO arranjo vence o legado', () => {
    const c = arranjosCanonicos({
      arranjos: [arr('A', [painel(14, 585)], [inv('H', 'M', 5)], {
        tipo: 'principal',
        configuracao_eletrica: { mppts: [{ mppt: 1, total_modulos: 14 }] },
      })],
      engenharia_eletrica: { arranjo: { mppts } },
    })
    expect(c.arranjos[0].topologia.fonte).toBe(FONTE.ARRANJO)
  })

  it('13 · micro do arranjo é reconhecido como canônico (FV-DOM-031)', () => {
    const c = arranjosCanonicos({
      arranjos: [arr('A', [painel(12, 585)], [inv('Hoymiles', 'HMS-2250DW-4T', 2.25, 3)], {
        tipo: 'principal',
        configuracao_eletrica: { micros: [{ equipamento_id: 'x', quantidade: 3, entradas_por_micro: 4 }] },
      })],
    })
    expect(c.arranjos[0].topologia.tipo).toBe('micro')
    expect(c.arranjos[0].topologia.fonte).toBe(FONTE.ARRANJO)
  })
})

describe('F14-IMP · Cenário F — projeto sem topologia', () => {
  it('14 · declara ausência, não inventa estrutura', () => {
    const c = arranjosCanonicos({
      arranjos: [arr('A', [painel(14, 585)], [inv('H', 'M', 5)], { tipo: 'principal' })],
    })
    const t = c.arranjos[0].topologia
    expect(t.estado).toBe(ESTADO_DADO.AUSENTE)
    expect(t.fonte).toBeNull()
    expect(t.tipo).toBeNull()
    expect(t.mppts).toEqual([])
    expect(t.micros).toEqual([])
  })

  it('15 · projeto sem arranjo nenhum tem estado próprio', () => {
    const c = arranjosCanonicos({ arranjos: [] })
    expect(c.estado).toBe(ESTADO_PROJETO.SEM_ARRANJOS)
    expect(c.arranjos).toEqual([])
  })
})

describe('F14-IMP · Cenário G — arranjo sem inversor', () => {
  it('16 · equipamento ausente é dito, não suprido', () => {
    const c = arranjosCanonicos({
      arranjos: [arr('A', [painel(14, 585)], [], { tipo: 'principal' })],
    })
    const i = c.arranjos[0].inversor
    expect(i.estado).toBe(ESTADO_DADO.AUSENTE)
    expect(i.itens).toEqual([])
    expect(i.fonte).toBeNull()
  })

  it('17 · arranjo único SEM inversor cai no legado da raiz, marcado', () => {
    const c = arranjosCanonicos({
      arranjos: [arr('A', [painel(14, 585)], [], { tipo: 'principal' })],
      equipamentos: { inversor: { marca: 'Huawei', modelo: 'SUN2000-5KTL', potencia_kw: 5 } },
    })
    expect(c.arranjos[0].inversor.estado).toBe(ESTADO_DADO.DISPONIVEL)
    expect(c.arranjos[0].inversor.fonte).toBe(FONTE.LEGACY_EQUIPAMENTO)
  })

  it('18 · em MULTIARRANJO o inversor da raiz não é atribuído a ninguém', () => {
    // Dar o inversor da raiz a um dos dois seria inventar a atribuição.
    const c = arranjosCanonicos({
      arranjos: [
        arr('A', [painel(211)], [], { tipo: 'principal' }),
        arr('B', [painel(180)], []),
      ],
      equipamentos: { inversor: { marca: 'Huawei', modelo: 'SUN2000-60KTL-M0', potencia_kw: 60 } },
    })
    expect(c.arranjos.every((a) => a.inversor.estado === ESTADO_DADO.AMBIGUO)).toBe(true)
    expect(c.arranjos.every((a) => a.inversor.itens.length === 0)).toBe(true)
  })

  it('19 · arranjo de ampliação ainda vazio: identidade existe, composição não', () => {
    const c = arranjosCanonicos({
      arranjos: [
        arr('exist_1', [{ marca: 'Jinko', modelo: 'JKM530M', potencia_w: 530, quantidade: 8 }],
          [inv('Solis', '1P7K-5G', 7)], { tipo: 'existente' }),
        arr('ampl_2', [], [], { tipo: 'ampliacao' }),
      ],
    })
    expect(c.arranjos[1].id).toBe('ampl_2')
    expect(c.arranjos[1].modulos.estado).toBe(ESTADO_DADO.AUSENTE)
    expect(c.arranjos[1].potencia.cc_kwp).toBeNull()
    // O arranjo vazio não contamina o total do que está completo (F12).
    expect(c.totais.n_modulos_total).toBe(8)
  })
})

describe('F14-2 · os 5 projetos reais, todos preservados', () => {
  // Os dois que os cenários B e C não cobrem, mais a Ampliação (cenário G/19).
  const CASOS = [
    ['Mercado Avelino', [
      arr('arr_primario', [painel(225)], [inv('Huawei', 'SUN2000-60KTL-M0', 60)], { tipo: 'principal' }),
      arr('arr_local_2', [painel(174)], [inv('Solplanet', 'ASW50K-LT-G2', 50)]),
    ], 399, ['SUN2000-60KTL-M0', 'ASW50K-LT-G2']],
    ['Sistema FV 131.29 kWp', [
      arr('arr_primario', [painel(225)], [inv('Huawei', 'SUN2000-60KTL-M0', 60)], { tipo: 'principal' }),
      arr('arr_1782152893176_0', [painel(160)], [inv('Huawei', 'SUN2000-50KTL-M0', 50)]),
    ], 385, ['SUN2000-60KTL-M0', 'SUN2000-50KTL-M0']],
    ['Sistema FV novo kWp', [
      arr('arr_primario', [painel(211)], [inv('Huawei', 'SUN2000-60KTL-M0', 60)], { tipo: 'principal' }),
      arr('arr_mtytx702_1', [painel(180)], [inv('Huawei', 'SUN2000-60KTL-M0', 60)]),
      arr('arr_1782072327297_0', [painel(174)], [inv('Huawei', 'SUN2000-50KTL-M0', 50)]),
    ], 565, ['SUN2000-60KTL-M0', 'SUN2000-60KTL-M0', 'SUN2000-50KTL-M0']],
    ['Wagner Hoymiles + tcl', [
      arr('arr_primario', [{ marca: 'TCL', modelo: 'HSM-ND66-GR615', potencia_w: 615, quantidade: 4 }],
        [inv('Hoymiles', 'HMS-2250DW-4T', 2.25)], { tipo: 'principal' }),
      arr('arr_1784311937843_0', [{ marca: 'TCL', modelo: 'HSM-ND66-GR615', potencia_w: 615, quantidade: 12 }],
        [{ ...inv('Hoymiles', 'HMS-2250DW-4T', 2.25), quantidade: 3 }]),
    ], 16, ['HMS-2250DW-4T', 'HMS-2250DW-4T']],
  ]

  it.each(CASOS)('%s — nenhum arranjo descartado, nenhum inversor perdido', (nome, arranjos, modulos, invs) => {
    const c = arranjosCanonicos({ arranjos })
    expect(c.arranjos).toHaveLength(arranjos.length)
    expect(c.totais.n_modulos_total).toBe(modulos)
    // Inversor POR ARRANJO, na ordem dos arranjos — nenhum colapsado no primeiro.
    expect(c.arranjos.map((a) => a.inversor.itens[0]?.modelo)).toEqual(invs)
    // Identidade preservada uma a uma.
    expect(c.arranjos.map((a) => a.id)).toEqual(arranjos.map((a) => a.id))
    // A soma por arranjo bate com o agregado — agregado é derivação.
    expect(c.arranjos.reduce((s, a) => s + a.modulos.total, 0)).toBe(modulos)
  })

  it('23 · Ampliação — o arranjo vazio não recebe o inversor da raiz', () => {
    const c = arranjosCanonicos({
      arranjos: [
        arr('exist_1', [{ marca: 'Jinko', modelo: 'JKM530M', potencia_w: 530, quantidade: 8 }],
          [inv('Solis', '1P7K-5G', 7)], { tipo: 'existente' }),
        arr('ampl_2', [], [], { tipo: 'ampliacao' }),
      ],
      equipamentos: { inversor: { marca: 'Huawei', modelo: 'SUN2000-60KTL-M0', potencia_kw: 60 } },
    })
    expect(c.arranjos).toHaveLength(2)
    expect(c.arranjos[1].inversor.estado).toBe(ESTADO_DADO.AMBIGUO)
    expect(c.arranjos[1].inversor.itens).toEqual([])
    expect(c.totais.n_modulos_total).toBe(8)
  })
})

describe('F14-2 · o comparador REPROVA perda — não só aprova acerto', () => {
  // Um guard que só foi rodado contra a implementação correta nunca foi provado
  // falhar. Aqui o adapter é injetado defeituoso de propósito.
  const AVELINO = { arranjos: [
    arr('A', [painel(225)], [inv('Huawei', 'SUN2000-60KTL-M0', 60)], { tipo: 'principal' }),
    arr('B', [painel(174)], [inv('Solplanet', 'ASW50K-LT-G2', 50)]),
  ] }
  const quebrado = (mutar) => (p) => {
    const c = arranjosCanonicos(p)
    return { ...c, arranjos: mutar(c.arranjos.map((a) => ({ ...a }))) }
  }

  it.each([
    ['segundo arranjo descartado', quebrado((as) => as.slice(0, 1))],
    ['inversor secundário perdido', quebrado((as) => as.map((a) => a.id === 'B' ? { ...a, inversor: { ...a.inversor, itens: [] } } : a))],
    ['inversor trocado por outro modelo', quebrado((as) => as.map((a) => a.id === 'B'
      ? { ...a, inversor: { ...a.inversor, itens: [{ fabricante: 'Huawei', modelo: 'SUN2000-60KTL-M0', potencia_kw: 60, quantidade: 1 }] } } : a))],
    ['identidade trocada', quebrado((as) => as.map((a) => a.id === 'B' ? { ...a, id: 'C' } : a))],
    ['módulos trocados entre arranjos (soma intacta)', quebrado((as) => as.map((a) => a.id === 'A'
      ? { ...a, modulos: { ...a.modulos, total: 174 } } : { ...a, modulos: { ...a.modulos, total: 225 } }))],
  ])('24 · %s → acusa perda', (_nome, adapter) => {
    expect(compararModelos(AVELINO, { adapter }).perdas.length).toBeGreaterThan(0)
  })

  it('25 · e o adapter real passa, com ganho sobre o legado', () => {
    const r = compararModelos(AVELINO)
    expect(r.perdas).toEqual([])
    expect(r.ganhos.length).toBeGreaterThan(0)
    expect(r.ganhos.some((g) => g.startsWith('174 '))).toBe(true)
  })

  it('26 · multiarranjo SEM ganho é reprovado — é o adapter descartando igual', () => {
    // Um "adapter" que devolvesse só o primeiro empataria com o legado. Empate,
    // aqui, é o defeito — não a aprovação.
    const r = compararModelos(AVELINO, { adapter: quebrado((as) => as.slice(0, 1)) })
    expect(r.ganhos).toEqual([])
    expect(r.perdas.some((p) => p.includes('descarta como o legado'))).toBe(true)
  })
})

describe('F14-IMP · invariantes', () => {
  it('20 · `ordem` é informativa — identidade é `id`', () => {
    const projeto = { arranjos: [
      arr('A', [painel(10)], [inv('X', 'M1', 5)], { tipo: 'principal' }),
      arr('B', [painel(20)], [inv('X', 'M2', 5)]),
    ] }
    const c = arranjosCanonicos(projeto)
    const invertido = arranjosCanonicos({ arranjos: [projeto.arranjos[1], projeto.arranjos[0]] })
    // A ordem muda; a identidade e o conteúdo de cada arranjo, não.
    expect(c.arranjos[0].ordem).toBe(0)
    expect(invertido.arranjos[0].id).toBe('B')
    expect(arranjoPorId(invertido, 'A').modulos.total).toBe(10)
    expect(arranjoPorId(c, 'A').modulos.total).toBe(10)
  })

  it('21 · ausência de potência continua null (F12), nunca zero', () => {
    const c = arranjosCanonicos({
      arranjos: [arr('A', [painel(225, null)], [inv('H', 'M', 60)], { tipo: 'principal' })],
    })
    expect(c.arranjos[0].potencia.cc_kwp).toBeNull()
    expect(c.totais.potencia_total_kwp).toBeNull()
    expect(c.arranjos[0].modulos.total).toBe(225)   // contagem intacta (F-01)
  })

  it('22 · agregado é derivação — a soma dos arranjos bate com os totais', () => {
    const c = arranjosCanonicos({ arranjos: [
      arr('A', [painel(211)], [inv('H', 'M1', 60)], { tipo: 'principal' }),
      arr('B', [painel(180)], [inv('H', 'M2', 60)]),
      arr('C', [painel(174)], [inv('H', 'M3', 50)]),
    ] })
    const soma = c.arranjos.reduce((s, a) => s + a.modulos.total, 0)
    expect(soma).toBe(c.totais.n_modulos_total)
    expect(soma).toBe(565)
  })
})
