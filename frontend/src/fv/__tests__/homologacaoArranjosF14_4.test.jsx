/**
 * F14-4 — Homologação não declara usina parcial.
 *
 * ── Correção à premissa da F14 ──────────────────────────────────────────────
 * A F14 registrou que `homologacaoController` "descarta até 354 de 565 módulos".
 * A medição estava certa sobre a FORMA da seleção e errada sobre o alvo: os
 * documentos não leem contagem de módulos de `arranjos[]`. O memorial recebe um
 * modelo PLANO pelo corpo da requisição — `projeto.inversor`, `projeto.painel`,
 * `projeto.potencia_kwp` — que nunca teve arranjos. `arranjos[]` entrava ali por
 * um caminho só: `_microsDoProjeto`.
 *
 * O risco documental é real, mas é outro, e é maior: o modelo plano descreve UM
 * inversor. Mercado Avelino é Huawei 60K **e** Solplanet 50K. O documento
 * enviado à distribuidora descrevia metade da usina, e nada avisava.
 *
 * ── O que esta sprint fez ───────────────────────────────────────────────────
 *   1. `_microsDoProjeto` deixou de escolher um arranjo — atravessa todos.
 *   2. A emissão é RECUSADA, com motivo nomeado, quando o modelo plano não
 *      representa o projeto. Não se inventa documento novo nem se emite parcial.
 *
 * A regra de recusa é estreita de propósito: não bloqueia por ser multiarranjo,
 * bloqueia por ser IRREPRESENTÁVEL.
 */
import { describe, it, expect } from 'vitest'
import { arranjosCanonicos } from '../../../../backend/src/dominio/topologia/arranjosCanonicos.js'

const pain = (q, w = 445) => ({ marca: 'T', modelo: 'TSM', potencia_w: w, quantidade: q })
const inv = (fab, modelo, kw = 60, q = 1) => ({ fabricante: fab, marca: fab, modelo, potencia_kw: kw, quantidade: q })

/** A regra ANTERIOR de `_microsDoProjeto`, para comparação. */
function MICROS_ANTES(proj) {
  const arranjos = Array.isArray(proj?.arranjos) ? proj.arranjos : []
  const a = arranjos.find((x) => x?.tipo === 'principal') ?? arranjos[0] ?? null
  const lista = a?.configuracao_eletrica?.micros
  return Array.isArray(lista) && lista.length > 0 ? lista : null
}

/** A regra NOVA — a mesma de `homologacaoController._microsDoProjeto`. */
function MICROS_DEPOIS(proj) {
  const lista = arranjosCanonicos(proj).arranjos.flatMap((a) => a.topologia.micros)
  return lista.length > 0 ? lista : null
}

/** A mesma de `homologacaoController._avaliarSuporteDocumental`. */
function SUPORTE(proj) {
  const canonico = arranjosCanonicos(proj)
  if (!canonico.multiarranjo) return { suportado: true }
  const modelos = [...new Set(canonico.arranjos
    .flatMap((a) => a.inversor.itens.map((i) => i.modelo)).filter(Boolean))]
  if (modelos.length > 1) return { suportado: false, motivo: 'MULTIARRANJO_INVERSORES_DIFERENTES', modelos }
  const comMicros = canonico.arranjos.filter((a) => a.topologia.micros.length > 0)
  if (comMicros.length > 1) return { suportado: false, motivo: 'MULTIARRANJO_MICROS_EM_VARIOS_ARRANJOS' }
  return { suportado: true }
}

// ── Os 5 projetos reais, como estão no banco ────────────────────────────────
const REAIS = {
  'Mercado Avelino': { arranjos: [
    { id: 'arr_primario', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
    { id: 'arr_local_2', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Solplanet', 'ASW50K-LT-G2', 50)] },
  ] },
  'Sistema FV 131.29 kWp': { arranjos: [
    { id: 'arr_primario', tipo: 'principal', paineis: [pain(225)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
    { id: 'arr_178', tipo: 'secundario', paineis: [pain(160)], inversores: [inv('Huawei', 'SUN2000-50KTL-M0', 50)] },
  ] },
  'Sistema FV novo kWp': { arranjos: [
    { id: 'arr_primario', tipo: 'principal', paineis: [pain(211)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
    { id: 'arr_mty', tipo: 'secundario', paineis: [pain(180)], inversores: [inv('Huawei', 'SUN2000-60KTL-M0')] },
    { id: 'arr_178', tipo: 'secundario', paineis: [pain(174)], inversores: [inv('Huawei', 'SUN2000-50KTL-M0', 50)] },
  ] },
  'Ampliação': { arranjos: [
    { id: 'exist_1', tipo: 'existente', paineis: [{ marca: 'Jinko', modelo: 'JKM530M', potencia_w: 530, quantidade: 8 }], inversores: [inv('Solis', '1P7K-5G', 7)] },
    { id: 'ampl_2', tipo: 'ampliacao', paineis: [], inversores: [] },
  ], equipamentos: { inversor: { marca: 'Huawei', modelo: 'SUN2000-60KTL-M0', potencia_kw: 60 } } },
  'Wagner Hoymiles + tcl': { arranjos: [
    { id: 'arr_primario', tipo: 'principal', paineis: [{ marca: 'TCL', modelo: 'HSM-ND66', potencia_w: 615, quantidade: 4 }], inversores: [inv('Hoymiles', 'HMS-2250DW-4T', 2.25)] },
    { id: 'arr_1784', tipo: 'secundario', paineis: [{ marca: 'TCL', modelo: 'HSM-ND66', potencia_w: 615, quantidade: 12 }], inversores: [inv('Hoymiles', 'HMS-2250DW-4T', 2.25, 3)] },
  ] },
}
const TOTAIS = { 'Mercado Avelino': 399, 'Sistema FV 131.29 kWp': 385, 'Sistema FV novo kWp': 565, 'Ampliação': 8, 'Wagner Hoymiles + tcl': 16 }

describe('F14-4 · os 5 projetos reais — nenhum arranjo descartado', () => {
  it.each(Object.keys(REAIS))('%s — todos os arranjos chegam ao modelo', (nome) => {
    const c = arranjosCanonicos(REAIS[nome])
    expect(c.arranjos).toHaveLength(REAIS[nome].arranjos.length)
    expect(c.totais.n_modulos_total).toBe(TOTAIS[nome])
    expect(c.arranjos.map((a) => a.id)).toEqual(REAIS[nome].arranjos.map((a) => a.id))
  })

  it.each(Object.keys(REAIS))('%s — cada arranjo mantém o PRÓPRIO inversor', (nome) => {
    const c = arranjosCanonicos(REAIS[nome])
    c.arranjos.forEach((a, i) => {
      const doDoc = (REAIS[nome].arranjos[i].inversores ?? []).map((x) => x.modelo)
      expect(a.inversor.itens.map((x) => x.modelo)).toEqual(doDoc)
    })
  })
})

describe('F14-4 · a emissão é recusada quando o documento não representa o projeto', () => {
  it('Mercado Avelino — Huawei 60K + Solplanet 50K → RECUSA', () => {
    // Era exatamente isto: o documento diria "Huawei 60K" e omitiria a Solplanet.
    const s = SUPORTE(REAIS['Mercado Avelino'])
    expect(s.suportado).toBe(false)
    expect(s.motivo).toBe('MULTIARRANJO_INVERSORES_DIFERENTES')
    expect(s.modelos.sort()).toEqual(['ASW50K-LT-G2', 'SUN2000-60KTL-M0'])
  })

  it('Sistema FV 131.29 kWp — 60K + 50K → RECUSA', () => {
    expect(SUPORTE(REAIS['Sistema FV 131.29 kWp']).suportado).toBe(false)
  })

  it('Sistema FV novo kWp — 60K, 60K, 50K → RECUSA', () => {
    const s = SUPORTE(REAIS['Sistema FV novo kWp'])
    expect(s.suportado).toBe(false)
    expect(s.modelos).toHaveLength(2)
  })

  it('Ampliação — um modelo só → NÃO recusa', () => {
    // O arranjo vazio não inventa um segundo modelo, e o inversor da raiz não é
    // atribuído a ele. Então o documento continua representável.
    const s = SUPORTE(REAIS['Ampliação'])
    expect(s.suportado).toBe(true)
    const c = arranjosCanonicos(REAIS['Ampliação'])
    expect(c.arranjos[1].inversor.estado).toBe('ambiguo')
    expect(c.arranjos[1].inversor.itens).toEqual([])
  })

  it('Wagner Hoymiles — mesmo modelo, quantidades 1 e 3 → NÃO recusa', () => {
    // Dois arranjos do MESMO inversor somam quantidade e continuam
    // representáveis. Bloquear aqui seria bloquear por ser multiarranjo, que
    // não é a regra.
    expect(SUPORTE(REAIS['Wagner Hoymiles + tcl']).suportado).toBe(true)
  })

  it('single-arranjo NUNCA é recusado — comportamento preservado', () => {
    for (const arranjos of Object.values(REAIS).map((p) => [p.arranjos[0]])) {
      expect(SUPORTE({ arranjos }).suportado).toBe(true)
    }
  })

  it('a recusa é por IRREPRESENTÁVEL, não por multiarranjo', () => {
    // Dois arranjos, mesmo inversor, sem micros → passa.
    const representavel = { arranjos: [
      { id: 'A', tipo: 'principal', paineis: [pain(10)], inversores: [inv('Huawei', 'M1')] },
      { id: 'B', tipo: 'secundario', paineis: [pain(10)], inversores: [inv('Huawei', 'M1')] },
    ] }
    expect(arranjosCanonicos(representavel).multiarranjo).toBe(true)
    expect(SUPORTE(representavel).suportado).toBe(true)
  })

  it('micros em mais de um arranjo → RECUSA', () => {
    const doisMicros = { arranjos: [
      { id: 'A', tipo: 'principal', paineis: [pain(10)], inversores: [inv('Hoymiles', 'HMS', 2.25)],
        configuracao_eletrica: { micros: [{ equipamento_id: 'x', quantidade: 2 }] } },
      { id: 'B', tipo: 'secundario', paineis: [pain(10)], inversores: [inv('Hoymiles', 'HMS', 2.25)],
        configuracao_eletrica: { micros: [{ equipamento_id: 'y', quantidade: 3 }] } },
    ] }
    const s = SUPORTE(doisMicros)
    expect(s.suportado).toBe(false)
    expect(s.motivo).toBe('MULTIARRANJO_MICROS_EM_VARIOS_ARRANJOS')
  })
})

describe('F14-4 · `_microsDoProjeto` deixou de escolher um arranjo', () => {
  const doisMicros = { arranjos: [
    { id: 'A', tipo: 'principal', paineis: [pain(10)], inversores: [inv('Hoymiles', 'HMS', 2.25)],
      configuracao_eletrica: { micros: [{ equipamento_id: 'x', quantidade: 2 }] } },
    { id: 'B', tipo: 'secundario', paineis: [pain(10)], inversores: [inv('Hoymiles', 'HMS', 2.25)],
      configuracao_eletrica: { micros: [{ equipamento_id: 'y', quantidade: 3 }] } },
  ] }

  it('ANTES via só os micros do primeiro; DEPOIS vê os dois', () => {
    expect(MICROS_ANTES(doisMicros)).toHaveLength(1)
    expect(MICROS_DEPOIS(doisMicros)).toHaveLength(2)
    expect(MICROS_DEPOIS(doisMicros).map((m) => m.equipamento_id)).toEqual(['x', 'y'])
  })

  it('a ORDEM decidia quando nenhum arranjo era `principal` — agora não decide nada', () => {
    // Precisão sobre o defeito antigo: com um `principal` presente, quem
    // escolhia era o `find`, não a posição. O `[0]` só entrava como desempate
    // quando nenhum arranjo era principal — e aí a ordem definia o documento.
    const semPrincipal = { arranjos: doisMicros.arranjos.map((a) => ({ ...a, tipo: 'secundario' })) }
    const invertido = { arranjos: [semPrincipal.arranjos[1], semPrincipal.arranjos[0]] }
    expect(MICROS_ANTES(semPrincipal)[0].equipamento_id).toBe('x')
    expect(MICROS_ANTES(invertido)[0].equipamento_id).toBe('y')   // a ordem decidia
    // DEPOIS: mesmo conteúdo nos dois — a ordem não decide mais nada.
    expect(MICROS_DEPOIS(semPrincipal).map((m) => m.equipamento_id).sort())
      .toEqual(MICROS_DEPOIS(invertido).map((m) => m.equipamento_id).sort())
    expect(MICROS_DEPOIS(semPrincipal)).toHaveLength(2)
  })

  it('e com `principal` presente era o `find` que descartava os demais', () => {
    // Os dois caminhos levavam ao mesmo lugar: um arranjo escolhido, o resto
    // fora do documento.
    expect(MICROS_ANTES(doisMicros)).toHaveLength(1)
    expect(MICROS_ANTES(doisMicros)[0].equipamento_id).toBe('x')
    expect(MICROS_DEPOIS(doisMicros)).toHaveLength(2)
  })

  it('single-arranjo com micros: ANTES == DEPOIS', () => {
    const um = { arranjos: [doisMicros.arranjos[0]] }
    expect(MICROS_DEPOIS(um)).toEqual(MICROS_ANTES(um))
  })

  it('sem micros continua `null` — o memorial de string fica intacto', () => {
    for (const nome of Object.keys(REAIS)) {
      expect(MICROS_DEPOIS(REAIS[nome])).toBeNull()
      expect(MICROS_ANTES(REAIS[nome])).toBeNull()
    }
  })
})

describe('F14-4 · prova de não-perda por IDENTIDADE', () => {
  it('A + B + C não pode virar só A', () => {
    const abc = REAIS['Sistema FV novo kWp']
    const c = arranjosCanonicos(abc)
    // Identidade, não soma: uma soma correta esconderia troca entre arranjos.
    expect(c.arranjos.map((a) => a.id)).toEqual(['arr_primario', 'arr_mty', 'arr_178'])
    expect(c.arranjos.map((a) => a.modulos.total)).toEqual([211, 180, 174])
    expect(c.arranjos.map((a) => a.inversor.itens[0].modelo))
      .toEqual(['SUN2000-60KTL-M0', 'SUN2000-60KTL-M0', 'SUN2000-50KTL-M0'])
    expect(c.arranjos.map((a) => a.topologia.efetiva)).toEqual([null, null, null])
    // E o documento que não consegue representar isso é RECUSADO.
    expect(SUPORTE(abc).suportado).toBe(false)
  })

  it('troca de módulos entre arranjos seria detectada — soma igual não basta', () => {
    const trocado = { arranjos: [
      { ...REAIS['Sistema FV novo kWp'].arranjos[0], paineis: [pain(180)] },
      { ...REAIS['Sistema FV novo kWp'].arranjos[1], paineis: [pain(211)] },
      REAIS['Sistema FV novo kWp'].arranjos[2],
    ] }
    const original = arranjosCanonicos(REAIS['Sistema FV novo kWp'])
    const alterado = arranjosCanonicos(trocado)
    expect(alterado.totais.n_modulos_total).toBe(original.totais.n_modulos_total)   // soma igual
    expect(alterado.arranjos.map((a) => a.modulos.total))
      .not.toEqual(original.arranjos.map((a) => a.modulos.total))                   // por arranjo, não
  })
})
