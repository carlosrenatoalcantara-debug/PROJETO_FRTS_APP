/**
 * composicaoUnifilar.js — view-model do Unifilar POR ARRANJO — F14-6B.
 *
 * O unifilar nasceu singular: um painel, um inversor, uma topologia por projeto
 * (`adaptarProjeto.js` impõe isso em quatro pontos). Este módulo não reescreve o
 * unifilar nem troca a fonte canônica — ele DERIVA, dos mesmos dados, a
 * composição que o desenho multiarranjo precisa: uma entrada elétrica por
 * arranjo, mais o que é do projeto (ligação, tensão, UF, cliente).
 *
 * ── De onde vem cada coisa ──────────────────────────────────────────────────
 *   projeto  → `adaptarProjetoParaUnifilar` (o adapter legado, sem alteração)
 *   arranjos → `arranjosCanonicos` (F14-IMP/F14-3A), a resolução única de
 *              topologia e equipamento por arranjo
 *
 * Nenhum campo é lido duas vezes por caminhos diferentes: não há segunda fonte
 * de verdade aqui. O que este arquivo acrescenta é a COMPOSIÇÃO.
 *
 * ── Modo ────────────────────────────────────────────────────────────────────
 *   single            1 arranjo (ou nenhum, no modelo singular legado) — a
 *                     entrada é IDÊNTICA à do caminho legado
 *   multi             N arranjos, todos da mesma topologia
 *   nao_representavel o desenho não pode representar o projeto; `motivo` diz
 *                     por quê. Não se escolhe um arranjo, não se classifica o
 *                     projeto inteiro pela maioria.
 *
 * INV-58: nada aqui é persistido — é derivação pura de `projeto`.
 */
import { montarModeloEletrico } from '@fortesolar/fv-shared/engenharia/normativa'
import { arranjosCanonicos } from '../topologia/arranjosCanonicos.js'
import { obterTopologiaProjeto } from '../topologia/obterTopologiaProjeto.js'
import {
  adaptarProjetoParaUnifilar,
  adaptarMppts,
  adaptarPainelDe,
  microsDoArranjo,
  ehMicroPorEquipamento,
} from './adaptarProjeto.js'

export const MODO = Object.freeze({
  SINGLE: 'single',
  MULTI: 'multi',
  NAO_REPRESENTAVEL: 'nao_representavel',
})

export const MOTIVO_COMPOSICAO = Object.freeze({
  /** Decisão F14-6B: topologia mista não é suportada — e não se escolhe uma. */
  TOPOLOGIA_MISTA_NAO_SUPORTADA: 'TOPOLOGIA_MISTA_NAO_SUPORTADA',
})

const _n = (v) => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

/**
 * Inversor do arranjo, no formato que o motor espera.
 *
 * `nMppts` vem da topologia que o próprio arranjo tem — nunca de
 * `engenharia_eletrica.arranjo`, que é UMA por projeto e num multiarranjo não
 * tem dono (FONTE.LEGACY_TOPOLOGIA / ESTADO_DADO.AMBIGUO no adapter canônico).
 */
function inversorDoArranjo(bruto, canonico) {
  const i = bruto ?? null
  const vazio = !i || (!i.marca && !i.fabricante && !i.modelo && !i.potencia_kw)
  if (vazio) return null
  const nMppts = canonico?.topologia?.mppts?.length || null
  return {
    marca: i.marca ?? i.fabricante ?? null,
    modelo: i.modelo ?? null,
    potenciaKW: _n(i.potencia_kw),
    tipo: i.tipo ?? null,
    nMppts,
  }
}

/**
 * Topologia de DESENHO do arranjo: `micro` ou `string`.
 *
 * Ordem: o fato estrutural resolvido pelo adapter canônico; depois a
 * classificação do EQUIPAMENTO do arranjo pelo dicionário canônico (FV-UX-038);
 * senão `string`, que é o default do caminho legado e não muda aqui.
 *
 * Topologias que o schema aceita mas que nenhum dos dois motores desenha
 * (`hibrido`, `otimizador`, `bess`, `off-grid`) continuam caindo em `string`,
 * exatamente como hoje. Tratá-las é outra sprint; inaugurar uma recusa nova
 * aqui mudaria o comportamento de projetos que hoje desenham.
 */
function topologiaDeDesenho(canonico, brutoInversor) {
  if (canonico?.topologia?.efetiva === 'micro') return 'micro'
  if (ehMicroPorEquipamento(brutoInversor ?? {})) return 'micro'
  return 'string'
}

/**
 * Composição do unifilar a partir do projeto.
 *
 * @param {object} projeto ProjetoFV (lean ou hidratado)
 * @param {object} [opts] `nomeCliente`, `moduloCatalogo`, `instalacao`, `catalogo`
 * @returns {{
 *   projeto: object, proveniencia: object, canonico: object,
 *   arranjos: Array<{id, ordem, rotulo, topologia, painel, inversor, micros,
 *                    arranjoMPPTs, dimensionamento, modeloEletrico}>,
 *   modo: string, motivo: string|null
 * }}
 */
export function composicaoUnifilarDoProjeto(projeto, opts = {}) {
  const { nomeCliente = null, moduloCatalogo = null, instalacao = null, catalogo = null } = opts
  const { entrada, proveniencia } = adaptarProjetoParaUnifilar(projeto, { nomeCliente, moduloCatalogo })

  const canonico = arranjosCanonicos(projeto, { instalacao, catalogo })
  // Mesma lista, mesma ordem: `arranjosCanonicos` mapeia 1:1 sobre
  // `arranjos_normalizados`. O bruto é lido só para os campos que o contrato
  // canônico não carrega (`paineis[].id`, a chave do catálogo elétrico).
  const brutos = obterTopologiaProjeto(projeto, { instalacao, catalogo }).arranjos_normalizados ?? []

  // O que é do PROJETO, não do arranjo. `painelMicro` e `estrutura` seguem
  // aqui porque hoje são de projeto; virarem por arranjo é migração futura.
  const projetoVM = {
    nome: entrada.nome,
    nomeCliente: entrada.nomeCliente,
    tipo_ligacao: entrada.tipo_ligacao,
    tensao: entrada.tensao,
    distribuidora: entrada.distribuidora,
    uf: entrada.uf,
    estrutura: entrada.estrutura,
    painelMicro: entrada.painelMicro,
    dimensionamento: entrada.dimensionamento,
  }

  /**
   * Projeto SEM `arranjos[]` — o modelo singular legado.
   *
   * Recusar aqui seria uma regressão silenciosa: o projeto que guarda tudo em
   * `equipamentos` + `engenharia_eletrica.arranjo` desenha hoje, e continua
   * desenhando. Ele vira UM arranjo sem identidade, com a entrada do adapter
   * legado intacta; quem decide se há topologia suficiente continua sendo o
   * portão de integridade, que devolve `TOPOLOGIA_AUSENTE` como sempre.
   */
  const lista = canonico.arranjos
  if (lista.length === 0) {
    const unico = {
      id: null, ordem: 0, rotulo: null,
      topologia: entrada.topologia,
      painel: entrada.painel,
      inversor: entrada.inversor,
      micros: entrada.micros,
      arranjoMPPTs: entrada.arranjoMPPTs,
      dimensionamento: entrada.dimensionamento,
      modeloEletrico: null,
    }
    return { projeto: projetoVM, proveniencia, canonico, arranjos: [unico], modo: MODO.SINGLE, motivo: null }
  }
  const single = lista.length === 1

  const arranjos = lista.map((a, i) => {
    const bruto = brutos[i] ?? null
    const brutoInversor = bruto?.inversores?.[0] ?? (single ? projeto?.equipamentos?.inversor : null) ?? null
    const brutoPainel = bruto?.paineis?.[0] ?? (single ? projeto?.equipamentos?.paineis?.[0] : null) ?? null

    // Arranjo único: a entrada é a do caminho legado, campo a campo. O desenho
    // de todo projeto que hoje funciona continua byte a byte o mesmo — a
    // composição só muda o que hoje não é representado.
    const painel = single ? entrada.painel : adaptarPainelDe(brutoPainel)
    const inversor = single ? entrada.inversor : inversorDoArranjo(brutoInversor, a)
    const micros = single ? entrada.micros : microsDoArranjo(bruto)
    const arranjoMPPTs = single ? entrada.arranjoMPPTs : adaptarMppts({ mppts: a.topologia.mppts })

    // No multiarranjo, o dimensionamento do PROJETO somaria N vezes o mesmo
    // total. Cada arranjo declara o seu, derivado (F12: incompleto é `null`).
    const dimensionamento = single ? entrada.dimensionamento : {
      numPaineis: a.modulos.total || null,
      numStrings: arranjoMPPTs ? arranjoMPPTs.reduce((s, m) => s + m.numStrings, 0) : null,
      numInversores: a.inversor.itens.reduce((s, x) => s + (x.quantidade ?? 1), 0) || null,
      potenciaArredondada: a.potencia.cc_kwp,
    }

    // Arranjo único: a classificação é a do caminho legado, literalmente — a
    // ordem de precedência entre `equipamentos.inversor` e `arranjos[].inversores[0]`
    // difere, e num projeto que declara os dois com classificações diferentes
    // isso mudaria o motor que desenha. Compatibilidade antes de simetria.
    const topologia = single ? entrada.topologia : topologiaDeDesenho(a, brutoInversor)

    // Micro tem modelo PRÓPRIO (`montarModeloMicro`); `montarModeloEletrico` é
    // do caminho string e não é montado para quem não o usa.
    const modeloEletrico = topologia === 'string'
      ? montarModeloEletrico({
        painel,
        inversor,
        arranjoMPPTs,
        dimensionamento,
        dadosConsumo: { tipoLigacao: projetoVM.tipo_ligacao, tensao: projetoVM.tensao },
        uf: projetoVM.uf,
      })
      : null

    return {
      id: a.id,
      ordem: a.ordem,
      rotulo: a.rotulo,
      topologia,
      painel,
      inversor,
      micros,
      arranjoMPPTs,
      dimensionamento,
      modeloEletrico,
    }
  })

  const topologias = [...new Set(arranjos.map((a) => a.topologia))]
  if (topologias.length > 1) {
    return { projeto: projetoVM, proveniencia, canonico, arranjos, modo: MODO.NAO_REPRESENTAVEL, motivo: MOTIVO_COMPOSICAO.TOPOLOGIA_MISTA_NAO_SUPORTADA }
  }

  return { projeto: projetoVM, proveniencia, canonico, arranjos, modo: single ? MODO.SINGLE : MODO.MULTI, motivo: null }
}

/**
 * A entrada dos motores para UM arranjo: o que é do projeto + o que é do arranjo.
 *
 * Vive aqui, e não em quem desenha, porque `dominio/potencia` precisa da MESMA
 * entrada para que a potência informada seja a que o unifilar desenha. Duas
 * montagens equivalentes seriam duas fórmulas esperando divergir.
 */
export function entradaDoArranjo(composicao, a) {
  return {
    ...composicao.projeto,
    topologia: a.topologia,
    painel: a.painel,
    inversor: a.inversor,
    micros: a.micros,
    arranjoMPPTs: a.arranjoMPPTs,
    dimensionamento: a.dimensionamento,
  }
}

export default composicaoUnifilarDoProjeto
