/**
 * F14-3 — CARACTERIZAÇÃO da precedência de topologia.
 *
 * Estes testes NÃO propõem regra nova. Eles PINAM o que o sistema faz hoje,
 * para que qualquer alteração do adapter tenha contra o que ser comparada.
 * Nenhum consumidor foi migrado; nenhum contrato foi alterado.
 *
 * ── Duas precedências convivem hoje ─────────────────────────────────────────
 *
 * A · `EnvioPropostaService` e `projetosFVController` — leem o DOCUMENTO CRU:
 *
 *     micros[] preenchido            → 'micro'      (FV-DOM-031C: micros é o fato)
 *     senão arranjo.topologia         → o valor declarado
 *     senão engenharia_eletrica.mppts → 'string'
 *     senão                           → null
 *
 * B · `composicaoDoProjeto` (arranjosService) — lê o NORMALIZADO:
 *
 *     arranjos.find(a => a.topologia)?.topologia ?? null
 *
 *     e `normalizarArranjos` já passou por `detectarTopologia`, que INFERE por
 *     heurística de nome quando `arranjo.topologia` é null.
 *
 * As duas divergem no mesmo projeto: para "Mercado Avelino" (dois arranjos,
 * `topologia` null em ambos, sem micros e sem `engenharia_eletrica`), A devolve
 * `null` e B devolve `'string'`. Isso é medido em `10 ·` abaixo.
 *
 * ── O acervo ────────────────────────────────────────────────────────────────
 * `arranjo.topologia` está persistido em 1 de 19 arranjos (valor `'micro'`).
 * Nos 12 arranjos dos 5 projetos multiarranjo é `null` em todos. Ou seja: hoje
 * o passo 2 da precedência A quase nunca dispara, e o rótulo vem da heurística
 * (em B) ou é `null` (em A).
 */
import { describe, it, expect } from 'vitest'
import {
  detectarTopologia, composicaoDoProjeto, normalizarArranjos,
} from '../../../../backend/src/services/arranjosService.js'
import {
  arranjosCanonicos, ESTADO_DADO, ORIGEM_TOPOLOGIA, ORIGEM_PROJETO,
} from '../../../../backend/src/dominio/topologia/arranjosCanonicos.js'

/**
 * A regra do `EnvioPropostaService`, copiada VERBATIM para caracterização.
 * Não é uma proposta — é o retrato do que roda hoje em produção.
 */
function precedenciaDoSnapshot(projeto) {
  const arranjo = (projeto.arranjos ?? [])[0] ?? null
  return arranjo?.configuracao_eletrica?.micros?.length ? 'micro'
    : (arranjo?.topologia ?? (projeto.engenharia_eletrica?.arranjo?.mppts?.length ? 'string' : null))
}

const inv = (fab, modelo, kw = 60) => ({ fabricante: fab, marca: fab, modelo, potencia_kw: kw, quantidade: 1 })
const pain = (q) => ({ marca: 'T', modelo: 'TSM', potencia_w: 445, quantidade: q })
const arr = (id, extra = {}) => ({
  id, tipo: 'principal', paineis: [pain(10)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')], ...extra,
})

describe('F14-3 · A — `arranjo.topologia` E `configuracao_eletrica` presentes', () => {
  it('1 · `micros[]` VENCE a topologia declarada — FV-DOM-031C', () => {
    const projeto = { arranjos: [arr('A', {
      topologia: 'string',
      configuracao_eletrica: { micros: [{ equipamento_id: 'x', quantidade: 3 }] },
    })] }
    expect(precedenciaDoSnapshot(projeto)).toBe('micro')
  })

  it('2 · `mppts[]` do arranjo NÃO participa da precedência do snapshot', () => {
    // O consumidor nunca consulta `configuracao_eletrica.mppts`. O adapter SIM.
    // É a segunda divergência entre os dois contratos.
    const projeto = { arranjos: [arr('A', {
      topologia: 'hibrido',
      configuracao_eletrica: { mppts: [{ mppt: 1, total_modulos: 10 }] },
    })] }
    expect(precedenciaDoSnapshot(projeto)).toBe('hibrido')
    expect(arranjosCanonicos(projeto).arranjos[0].topologia.tipo).toBe('string')
  })
})

describe('F14-3 · B — somente `arranjo.topologia`', () => {
  it('3 · o valor declarado é devolvido tal como está', () => {
    for (const v of ['string', 'micro', 'hibrido', 'off-grid', 'otimizador', 'bess']) {
      expect(precedenciaDoSnapshot({ arranjos: [arr('A', { topologia: v })] })).toBe(v)
    }
  })

  it('4 · o adapter agora expõe a declarada — era a lacuna que impedia a migração', () => {
    // F14-3A: antes o adapter não tinha esse campo e por isso não conseguia
    // reproduzir o passo 2 da precedência. Agora reproduz.
    const projeto = { arranjos: [arr('A', { topologia: 'hibrido' })] }
    const t = arranjosCanonicos(projeto).arranjos[0].topologia
    expect(t.declarada).toBe('hibrido')
    expect(t.efetiva).toBe('hibrido')
    expect(t.origem).toBe(ORIGEM_TOPOLOGIA.DECLARADA)
    expect(t.estado).toBe(ESTADO_DADO.DISPONIVEL)
  })
})

describe('F14-3 · C — somente `configuracao_eletrica`', () => {
  it('5 · `micros[]` sozinho → `micro` nos DOIS contratos', () => {
    const projeto = { arranjos: [arr('A', {
      configuracao_eletrica: { micros: [{ equipamento_id: 'x', quantidade: 3 }] },
    })] }
    expect(precedenciaDoSnapshot(projeto)).toBe('micro')
    expect(arranjosCanonicos(projeto).arranjos[0].topologia.tipo).toBe('micro')
  })

  it('6 · `mppts[]` sozinho → `null` no snapshot, `string` no adapter', () => {
    const projeto = { arranjos: [arr('A', {
      configuracao_eletrica: { mppts: [{ mppt: 1, total_modulos: 10 }] },
    })] }
    expect(precedenciaDoSnapshot(projeto)).toBeNull()
    expect(arranjosCanonicos(projeto).arranjos[0].topologia.tipo).toBe('string')
  })
})

describe('F14-3 · D — ambos presentes e CONFLITANTES', () => {
  it('7 · o conflito é resolvido por precedência declarada, não por acaso', () => {
    // `micros[]` preenchido com `topologia: 'string'` é contraditório. A regra
    // atual não marca conflito: `micros` vence, por decisão registrada
    // (FV-DOM-031C — "micros[] preenchido é o fato"). Fica pinado aqui para que
    // a escolha seja visível, e não descoberta por alguém no futuro.
    const conflito = { arranjos: [arr('A', {
      topologia: 'string',
      configuracao_eletrica: { micros: [{ equipamento_id: 'x', quantidade: 3 }] },
    })] }
    expect(precedenciaDoSnapshot(conflito)).toBe('micro')
  })

  it('8 · e o conflito é DETECTÁVEL — declarada ≠ estrutura', () => {
    const conflito = { arranjos: [arr('A', {
      topologia: 'string',
      configuracao_eletrica: { micros: [{ equipamento_id: 'x', quantidade: 3 }] },
    })] }
    const declarada = conflito.arranjos[0].topologia
    const estrutural = arranjosCanonicos(conflito).arranjos[0].topologia.tipo
    expect(declarada).toBe('string')
    expect(estrutural).toBe('micro')
    expect(declarada).not.toBe(estrutural)   // há como acusar, hoje ninguém acusa
  })
})

describe('F14-3 · E — nenhum dos dois', () => {
  it('9 · ausência é ausência nos dois contratos', () => {
    const projeto = { arranjos: [arr('A')] }
    expect(precedenciaDoSnapshot(projeto)).toBeNull()
    const t = arranjosCanonicos(projeto).arranjos[0].topologia
    expect(t.estado).toBe(ESTADO_DADO.AUSENTE)
    expect(t.tipo).toBeNull()
    expect(t.fonte).toBeNull()
  })
})

describe('F14-3 · F — multiarranjo', () => {
  // Fixture de "Mercado Avelino" como está no banco: topologia null nos dois
  // arranjos, sem micros, sem mppts, sem `engenharia_eletrica`.
  const avelino = { arranjos: [
    { id: 'A', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0', 60)] },
    { id: 'B', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Solplanet', 'ASW50K-LT-G2', 50)] },
  ] }

  it('10 · as DUAS precedências divergem no mesmo projeto', () => {
    // Snapshot lê o documento cru → null.
    expect(precedenciaDoSnapshot(avelino)).toBeNull()
    // `composicaoDoProjeto` lê o normalizado, que passou por `detectarTopologia`
    // e INFERIU 'string' pela presença de inversor.
    expect(composicaoDoProjeto(avelino).topologia).toBe('string')
  })

  it('11 · a inferência vem de `detectarTopologia`, não do documento', () => {
    expect(avelino.arranjos[0].topologia).toBeUndefined()
    expect(detectarTopologia(avelino.arranjos[0])).toBe('string')
    expect(normalizarArranjos(avelino)[0].topologia).toBe('string')
  })

  it('12 · e ambas reduzem N arranjos a UM rótulo, sem dizer que reduziram', () => {
    // Snapshot: `arranjos[0]`. Composição: `find(a => a.topologia)` — o primeiro
    // que tiver. Nenhuma das duas informa que havia outros arranjos.
    const misto = { arranjos: [
      { id: 'A', tipo: 'principal', paineis: [pain(10)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')], topologia: 'string' },
      { id: 'B', tipo: 'secundario', paineis: [pain(10)], inversores: [inv('Hoymiles', 'HMS-2250DW-4T', 2.25)], topologia: 'micro' },
    ] }
    expect(precedenciaDoSnapshot(misto)).toBe('string')        // perdeu o 'micro' de B
    expect(composicaoDoProjeto(misto).topologia).toBe('string') // idem
    // O adapter preserva os dois arranjos — mas hoje não expõe a declarada.
    expect(arranjosCanonicos(misto).arranjos).toHaveLength(2)
  })

  it('13 · o adapter marca AMBIGUO quando a topologia do projeto não tem dono', () => {
    const comLegado = { ...avelino, engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, total_modulos: 14 }] } } }
    // Snapshot: cai no passo 3 e devolve 'string' — atribuindo ao primeiro.
    expect(precedenciaDoSnapshot(comLegado)).toBe('string')
    // Adapter: recusa atribuir.
    const c = arranjosCanonicos(comLegado)
    expect(c.arranjos.every((a) => a.topologia.estado === ESTADO_DADO.AMBIGUO)).toBe(true)
    expect(c.avisos).toContain('TOPOLOGIA_DE_PROJETO_NAO_ATRIBUIVEL')
  })
})

describe('F14-3A · o adapter REPRODUZ a precedência do consumidor', () => {
  // A prova que faltava para poder migrar: para cada cenário, o rótulo do
  // adapter tem de ser o MESMO que o consumidor produz hoje.
  const CENARIOS = [
    ['micros vence declarada', { arranjos: [arr('A', {
      topologia: 'string', configuracao_eletrica: { micros: [{ quantidade: 3 }] } })] }],
    ['só declarada', { arranjos: [arr('A', { topologia: 'hibrido' })] }],
    ['só micros', { arranjos: [arr('A', { configuracao_eletrica: { micros: [{ quantidade: 3 }] } })] }],
    ['legado, 1 arranjo', { arranjos: [arr('A')], engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1 }] } } }],
    ['nada', { arranjos: [arr('A')] }],
    ['mppts sozinho', { arranjos: [arr('A', { configuracao_eletrica: { mppts: [{ mppt: 1 }] } })] }],
    ['Mercado Avelino', { arranjos: [
      { id: 'A', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'B', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Solplanet', 'ASW50K-LT-G2', 50)] },
    ] }],
  ]

  it.each(CENARIOS)('15 · %s → mesmo rótulo do consumidor', (_nome, projeto) => {
    expect(arranjosCanonicos(projeto).topologiaProjeto.efetiva).toBe(precedenciaDoSnapshot(projeto))
  })

  it('16 · a heurística é exposta mas NÃO entra em `efetiva` (Regra 4)', () => {
    // É o que separa o adapter de `composicaoDoProjeto`: ele mostra o que a
    // heurística diria, e mesmo assim não infere.
    const avelino = { arranjos: [
      { id: 'A', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
      { id: 'B', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Solplanet', 'ASW50K-LT-G2', 50)] },
    ] }
    const t = arranjosCanonicos(avelino).arranjos[0].topologia
    expect(t.heuristica).toBe('string')                 // o que `detectarTopologia` diria
    expect(t.efetiva).toBeNull()                        // e que NÃO é usado
    expect(composicaoDoProjeto(avelino).topologia).toBe('string')  // quem usa é este
  })

  it('17 · `mppts[]` NÃO promove a classificação, mas o dado é preservado', () => {
    const projeto = { arranjos: [arr('A', { configuracao_eletrica: { mppts: [{ mppt: 1, total_modulos: 10 }] } })] }
    const t = arranjosCanonicos(projeto).arranjos[0].topologia
    expect(t.efetiva).toBeNull()          // classificação: não promove
    expect(t.estrutural).toBeNull()
    expect(t.mppts).toHaveLength(1)       // dado elétrico: preservado
  })

  it('18 · conflito declarada × estrutural é marcado, não silenciado', () => {
    const t = arranjosCanonicos({ arranjos: [arr('A', {
      topologia: 'string', configuracao_eletrica: { micros: [{ quantidade: 3 }] } })] }).arranjos[0].topologia
    expect(t.declarada).toBe('string')
    expect(t.estrutural).toBe('micro')
    expect(t.efetiva).toBe('micro')
    expect(t.conflito).toBe(true)
    expect(t.origem).toBe(ORIGEM_TOPOLOGIA.ESTRUTURAL_MICROS)
  })

  it('19 · multiarranjo divergente → não escolhe uma', () => {
    const misto = { arranjos: [
      { id: 'A', tipo: 'principal', topologia: 'string', paineis: [pain(10)], inversores: [inv('Huawei', 'M')] },
      { id: 'B', tipo: 'secundario', topologia: 'micro', paineis: [pain(10)], inversores: [inv('Hoymiles', 'HMS', 2.25)] },
    ] }
    const tp = arranjosCanonicos(misto).topologiaProjeto
    expect(tp.efetiva).toBeNull()
    expect(tp.origem).toBe(ORIGEM_PROJETO.DIVERGENTE)
    expect(tp.valores.sort()).toEqual(['micro', 'string'])
    // Os consumidores de hoje devolveriam 'string' — o primeiro.
    expect(precedenciaDoSnapshot(misto)).toBe('string')
  })

  it('20 · legado em multiarranjo → ambiguo, sem `[0]`', () => {
    const projeto = { arranjos: [
      { id: 'A', tipo: 'principal', paineis: [pain(10)], inversores: [inv('Huawei', 'M1')] },
      { id: 'B', tipo: 'secundario', paineis: [pain(10)], inversores: [inv('Huawei', 'M2')] },
    ], engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1 }] } } }
    const c = arranjosCanonicos(projeto)
    expect(c.arranjos.every((a) => a.topologia.estado === ESTADO_DADO.AMBIGUO)).toBe(true)
    expect(c.arranjos.every((a) => a.topologia.efetiva === null)).toBe(true)
    expect(c.topologiaProjeto.ambiguo).toBe(true)
  })

  it('21 · `null` não conta como divergência — desconhecido ≠ discordância', () => {
    const projeto = { arranjos: [
      { id: 'A', tipo: 'principal', topologia: 'string', paineis: [pain(10)], inversores: [inv('Huawei', 'M')] },
      { id: 'B', tipo: 'ampliacao', paineis: [], inversores: [] },
    ] }
    const tp = arranjosCanonicos(projeto).topologiaProjeto
    expect(tp.efetiva).toBe('string')
    expect(tp.origem).toBe(ORIGEM_PROJETO.UNANIME)
  })
})

describe('F14-3 · o acervo real', () => {
  it('14 · `arranjo.topologia` quase nunca está persistido', () => {
    // Medido: 1 de 19 arranjos tem o campo (valor 'micro'); os 12 arranjos dos
    // 5 projetos multiarranjo têm `null`. O passo 2 da precedência do snapshot
    // praticamente não dispara hoje — o rótulo vem da heurística ou é null.
    const semTopologia = { arranjos: [arr('A')] }
    expect(semTopologia.arranjos[0].topologia).toBeUndefined()
    expect(precedenciaDoSnapshot(semTopologia)).toBeNull()
  })
})
