/**
 * utilizavelProjeto.js — liberação de equipamento para ENGENHARIA — F-06.
 *
 * ── Quatro estados, não um booleano ─────────────────────────────────────────
 *   CATALOGADO   existe no SSOT
 *   SELECIONÁVEL aparece para consulta e escolha comercial
 *   UTILIZÁVEL   tem os dados que o motor precisa para avaliar
 *   COMPATÍVEL   foi avaliado pelo motor e não violou nada
 *
 * Este módulo decide o TERCEIRO. Ele não esconde equipamento do catálogo e não
 * declara compatibilidade: diz apenas se há dado suficiente para que a pergunta
 * seja respondida. Quem responde é o motor canônico.
 *
 * ── O defeito que ele fecha ─────────────────────────────────────────────────
 * A matriz mínima do inversor exigia `potencia_kw` e `numero_mppt` — nada do
 * envelope de tensão. A auditoria da F-06 mediu 6 inversores STRING (Growatt
 * MID15/20/25KTL3-X e Kehua SP13000/15000/16000-B2) sem `tensao_max_entrada` e
 * sem faixa MPPT, todos com `utilizavel_em_projeto: true` e
 * `bloqueio_engenharia: []`. Sem esses campos o motor não consegue verificar
 * sobretensão nem janela de MPPT — e ausência de dado não é compatibilidade.
 *
 * ── E o defeito de ter duas matrizes ────────────────────────────────────────
 * Havia uma cópia no frontend que exigia outros campos e procurava outros
 * aliases (`voc_max`, `voc_max_dc` — nunca `tensao_max_entrada`, que é o nome
 * que o SSOT realmente usa). As duas discordavam sobre o mesmo equipamento.
 * Agora a regra é uma só, aqui, e os dois lados a importam.
 *
 * ── O que NÃO entra na matriz ───────────────────────────────────────────────
 * `corrente_isc_max` e `oversizing_max` ficam de fora de propósito: a F1 e a F2
 * decidiram que a ausência deles produz `nao_avaliado` no critério
 * correspondente, e a análise segue. Exigi-los aqui trocaria um veredito
 * honesto por um bloqueio — e barraria metade do catálogo real.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */
import { CAMPOS_MODULO } from './modulos/index.js'
import { classificarTopologiaInversor, TOPOLOGIA } from './inversores/dicionarioInversor.js'

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const pick = (e, ks) => { for (const k of ks) { const v = num(e?.[k]); if (v !== null) return v } return null }

/** Campos que todo inversor precisa, seja qual for a topologia. */
const INVERSOR_COMUM = [
  ['potencia_kw', (e) => pick(e, ['potencia', 'potencia_kw', 'potencia_ca'])],
  ['numero_mppt', (e) => pick(e, ['mppts', 'n_mppts', 'numero_mppt'])],
]

/**
 * Envelope que o motor de STRING consome — e só ele.
 *
 * Microinversor tem motor próprio (`montarModeloMicro`), que trabalha por
 * entradas e módulos e não consulta a janela MPPT do inversor. Importar estas
 * exigências para o caminho micro barraria equipamento que o sistema sabe
 * avaliar: os aliases são os que o SSOT grava de fato.
 */
const INVERSOR_STRING = [
  ['tensao_max_entrada', (e) => pick(e, ['tensao_max_entrada', 'voc_max', 'voc_max_dc', 'tensao_max_dc'])],
  ['tensao_mppt_min',    (e) => pick(e, ['tensao_mppt_min', 'faixa_mppt_min', 'mppt_min'])],
  ['tensao_mppt_max',    (e) => pick(e, ['tensao_mppt_max', 'faixa_mppt_max', 'mppt_max'])],
  ['corrente_max_por_mppt', (e) => pick(e, ['corrente_max_por_mppt', 'corrente_max_mppt', 'ipv_max'])],
]

const REGRAS = {
  modulo: [
    ['potencia_wp', (e) => pick(e, CAMPOS_MODULO.potencia_w)],
    ['voc', (e) => pick(e, ['voc', 'voc_v'])],
    ['isc', (e) => pick(e, ['isc', 'isc_a'])],
  ],
  bateria: [
    ['capacidade_kwh', (e) => pick(e, ['capacidade_kwh', 'capacidade', 'capacidade_kWh'])],
  ],
  // Estrutura: fabricante + modelo (topo) bastam — sem especificações mínimas.
  estrutura: [],
  // carregador_ev fora do escopo FV; sem regras, não é gateado.
  carregador_ev: [],
}

/** Regras aplicáveis a um inversor, conforme a topologia que ele declara. */
function regrasDoInversor(especificacoes, contexto) {
  const topologia = classificarTopologiaInversor(especificacoes || {}, contexto || {})
  // MICRO tem motor próprio e matriz própria — a de string não se aplica.
  if (topologia === TOPOLOGIA.MICRO) return INVERSOR_COMUM
  return [...INVERSOR_COMUM, ...INVERSOR_STRING]
}

/**
 * O equipamento tem os dados mínimos para a engenharia avaliá-lo?
 *
 * @param {string} tipo            'modulo' | 'inversor' | 'bateria' | …
 * @param {object} especificacoes  `equipamento.especificacoes`
 * @param {object} [contexto]      `{ fabricante, modelo, subtipo }` — usado só
 *                                 para classificar a topologia do inversor.
 * @returns {{ utilizavel:boolean, faltando:string[], topologia:string|null }}
 */
export function avaliarUtilizavel(tipo, especificacoes, contexto = {}) {
  let regras
  let topologia = null
  if (tipo === 'inversor') {
    topologia = classificarTopologiaInversor(especificacoes || {}, contexto)
    regras = regrasDoInversor(especificacoes, contexto)
  } else {
    // Tipo desconhecido não cai nas regras de módulo — bloqueio falso é pior
    // que ausência de regra, e quem não tem matriz simplesmente não é gateado.
    regras = REGRAS[tipo] ?? []
  }
  const faltando = regras
    .filter(([, fn]) => fn(especificacoes || {}) === null)
    .map(([rotulo]) => rotulo)
  return { utilizavel: faltando.length === 0, faltando, topologia }
}

export default { avaliarUtilizavel }
