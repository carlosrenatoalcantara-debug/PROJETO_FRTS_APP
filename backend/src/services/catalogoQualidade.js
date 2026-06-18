/**
 * 🧪 Motor de Qualidade do Catálogo Técnico FV
 *
 * Funções puras e idempotentes. Recebem um Equipamento doc (POJO), retornam
 * os campos derivados que devem ser persistidos:
 *
 *   {
 *     specs_canonicas: {...} | null,   // shape estrito por tipo (derivado de especificacoes)
 *     qualidade: {...},                // scores + nivel + alertas
 *     status_operacional: {...},       // pode_ser_selecionado + aviso
 *     identificacao: {...},            // normalização canônica
 *   }
 *
 * NUNCA modifica especificacoes (original). NUNCA faz I/O.
 */

import crypto from 'crypto'
import { aplicarRegras } from './regrasPlausibilidade.js'
import { lerInversor } from '../equipamentos/inversores/index.js'

const MOTOR_VERSAO = 'qualidade-1.0.0'

// ─── Helpers ────────────────────────────────────────────────────────────────

function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function bool(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v
  const s = String(v).toLowerCase()
  if (['true','1','sim','yes'].includes(s)) return true
  if (['false','0','nao','não','no'].includes(s)) return false
  return null
}

function normalizarString(s) {
  if (!s) return null
  return String(s)
    .trim()
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove acentos
    .replace(/\s+/g, ' ')
}

function hashUnico(fabricanteNorm, modeloNorm, tipo) {
  const base = `${tipo || ''}|${fabricanteNorm || ''}|${modeloNorm || ''}`
  return crypto.createHash('sha1').update(base).digest('hex')
}

// Primeiro valor não-nulo entre múltiplas chaves
function pick(obj, keys) {
  if (!obj) return null
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return null
}

// ─── Normalização — converte especificacoes em specs_canonicas ──────────────

function normalizarSpecsModulo(equipamento) {
  const esp = equipamento.especificacoes || {}
  return {
    _versao: '1.0',
    potencia_w: num(pick(esp, ['potencia_w','potencia','potenciaW'])) ?? num(equipamento.potencia_w),
    voc_v:    num(pick(esp, ['voc','voc_v','vocV'])),
    vmpp_v:   num(pick(esp, ['vmpp','vmp','vmpp_v','vmp_v'])),
    isc_a:    num(pick(esp, ['isc','isc_a','iscA'])),
    impp_a:   num(pick(esp, ['impp','imp','impp_a','imp_a'])),
    eficiencia_pct: num(pick(esp, ['eficiencia','eficiencia_pct','eficienciaPct'])),
    coef_temp_voc_pct_c: num(pick(esp, ['coef_temp_voc','coef_temp_voc_pct_c','tempCoefVoc'])),
    coef_temp_isc_pct_c: num(pick(esp, ['coef_temp_isc','coef_temp_isc_pct_c','tempCoefIsc'])),
    coef_temp_pmax_pct_c: num(pick(esp, ['coef_temp_pmax','coef_temp_pmax_pct_c','tempCoefPmax'])),
    noct_c: num(pick(esp, ['noct','noct_c','NOCT'])),
    dimensoes_mm: (() => {
      const l = num(pick(esp, ['largura_mm','dimensoes_largura_mm']))
      const a = num(pick(esp, ['altura_mm','dimensoes_altura_mm','comprimento_mm']))
      const e = num(pick(esp, ['espessura_mm','dimensoes_espessura_mm']))
      if (l === null && a === null) return null
      return { largura: l, altura: a, espessura: e }
    })(),
    peso_kg: num(pick(esp, ['peso_kg','peso'])),
    numero_celulas: num(pick(esp, ['numero_celulas','num_celulas','celulas'])),
    tipo_celula: str(pick(esp, ['tipo_celula','tecnologia_celula'])),
    bifacial: bool(pick(esp, ['bifacial','bi_facial'])),
    ganho_bifacial_pct: num(pick(esp, ['ganho_bifacial_pct','ganho_bifacial'])),
    certificacoes: Array.isArray(esp.certificacoes) ? esp.certificacoes : null,
  }
}

function normalizarSpecsInversor(equipamento) {
  const esp = equipamento.especificacoes || {}
  // P0-INV-SSOT-01: leitura ÚNICA via dicionário canônico (sem pick locais).
  // As CHAVES de saída são preservadas (compat: regrasPlausibilidade, PESOS_INVERSOR,
  // specs_canonicas consumido pela UI) — muda apenas a FONTE dos valores: o SSOT.
  const c = lerInversor(esp)
  return {
    _versao: '1.0',
    potencia_kw_ca: num(c.potencia_kw),
    potencia_kw_cc_max: num(c.potencia_max_entrada_cc),
    fases_saida: num(c.fases),
    tensao_saida_v: num(c.tensao_ac),
    frequencia_hz: num(c.frequencia_hz),
    voc_max_dc_v: num(c.tensao_max_entrada),
    tensao_inicializacao_dc_v: num(c.tensao_partida),
    mppt_min_v: num(c.tensao_mppt_min),
    mppt_max_v: num(c.tensao_mppt_max),
    isc_max_por_mppt_a: num(c.corrente_isc_max ?? c.corrente_max_por_mppt),
    n_mppts: num(c.n_mppts),
    strings_max_por_mppt: num(c.strings_por_mppt),
    eficiencia_max_pct: num(c.eficiencia_maxima),
    eficiencia_european_pct: num(c.eficiencia_europeia),
    protecoes_integradas: {
      anti_ilhamento: bool(pick(esp, ['anti_ilhamento','antiIlhamento','protecao_antiilhamento'])),
      rcd_integrado: bool(pick(esp, ['rcd_integrado','rcd'])),
      dps_dc_integrado: bool(pick(esp, ['dps_dc_integrado','dps_dc','protecao_sobretensao_dc'])),
      dps_ca_integrado: bool(pick(esp, ['dps_ca_integrado','dps_ca','protecao_sobretensao_ac'])),
    },
    tipo_inversor: str(pick(esp, ['tipo_inversor','tipo','subtipo'])),
    certificacoes: Array.isArray(esp.certificacoes) ? esp.certificacoes : null,
  }
}

function normalizarSpecsCarregador(equipamento) {
  const esp = equipamento.especificacoes || {}
  return {
    _versao: '1.0',
    potencia_kw: num(pick(esp, ['potencia_kw','potencia'])),
    tipo: str(pick(esp, ['tipo','tipo_carregador'])),
    tensao_entrada_v: num(pick(esp, ['tensao_entrada_v','tensao_entrada'])),
    corrente_entrada_a: num(pick(esp, ['corrente_entrada_a','corrente_entrada'])),
    fases: num(pick(esp, ['fases','fases_entrada'])),
  }
}

function normalizar(equipamento) {
  if (!equipamento) return { specs_canonicas: null, plano: {} }
  let specs_canonicas = null
  if (equipamento.tipo === 'modulo') specs_canonicas = normalizarSpecsModulo(equipamento)
  else if (equipamento.tipo === 'inversor') specs_canonicas = normalizarSpecsInversor(equipamento)
  else if (equipamento.tipo === 'carregador_ev') specs_canonicas = normalizarSpecsCarregador(equipamento)

  // Plano de validação — formato esperado pelas regras
  const plano = {
    tipo: equipamento.tipo,
    fabricante: equipamento.fabricante,
    modelo: equipamento.modelo,
    _tem_especificacoes_originais: Boolean(equipamento.especificacoes && Object.keys(equipamento.especificacoes || {}).length > 0),
    ...(specs_canonicas || {}),
  }
  return { specs_canonicas, plano }
}

// ─── Identificação canônica ─────────────────────────────────────────────────

function montarIdentificacao(equipamento, identificacaoExistente) {
  const fabricanteNorm = normalizarString(equipamento.fabricante)
  const modeloNorm = normalizarString(equipamento.modelo)
  return {
    fabricante_normalizado: fabricanteNorm,
    modelo_normalizado: modeloNorm,
    hash_unico: hashUnico(fabricanteNorm, modeloNorm, equipamento.tipo),
    aliases: Array.isArray(identificacaoExistente?.aliases) ? identificacaoExistente.aliases : [],
  }
}

// ─── Score de completude ────────────────────────────────────────────────────

const PESOS_MODULO = {
  identificacao: 15,           // fabricante + modelo
  potencia_w: 15,
  voc_v: 10,
  isc_a: 10,
  vmpp_v: 10,
  impp_a: 10,
  eficiencia_pct: 10,
  dimensoes_mm: 10,
  coef_temp_voc_pct_c: 5,
  numero_celulas: 5,
}

const PESOS_INVERSOR = {
  identificacao: 15,
  potencia_kw_ca: 10,
  voc_max_dc_v: 15,
  mppt_min_v: 10,
  mppt_max_v: 10,
  isc_max_por_mppt_a: 10,
  n_mppts: 10,
  fases_saida: 10,
  eficiencia_max_pct: 5,
  tensao_saida_v: 5,
}

const PESOS_CARREGADOR = {
  identificacao: 30,
  potencia_kw: 30,
  tipo: 20,
  tensao_entrada_v: 10,
  corrente_entrada_a: 10,
}

function temIdentificacaoValida(equipamento) {
  const fab = (equipamento.fabricante || '').trim()
  const mod = (equipamento.modelo || '').trim()
  if (fab.length < 2 || mod.length < 2) return false
  const padrao = /^\s*(desconhecid[ao]|n\/?a|sem\s*nome|null|undefined|--)\s*$/i
  if (padrao.test(fab) || padrao.test(mod)) return false
  return true
}

function valorPresente(specs, campo) {
  const v = specs?.[campo]
  if (v === null || v === undefined) return false
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'object') return Object.values(v).some(x => x !== null && x !== undefined)
  return String(v).trim().length > 0
}

function calcularCompletude(equipamento, specs_canonicas) {
  let pesos
  if (equipamento.tipo === 'modulo') pesos = PESOS_MODULO
  else if (equipamento.tipo === 'inversor') pesos = PESOS_INVERSOR
  else if (equipamento.tipo === 'carregador_ev') pesos = PESOS_CARREGADOR
  else return { score: 0, campos_faltantes: ['tipo_desconhecido'] }

  let total = 0
  let preenchido = 0
  const faltantes = []

  for (const [campo, peso] of Object.entries(pesos)) {
    total += peso
    let presente = false
    if (campo === 'identificacao') {
      presente = temIdentificacaoValida(equipamento)
    } else {
      presente = valorPresente(specs_canonicas, campo)
    }
    if (presente) preenchido += peso
    else faltantes.push(campo)
  }

  return {
    score: total > 0 ? Math.round((preenchido / total) * 100) : 0,
    campos_faltantes: faltantes,
  }
}

// ─── Score de confiança ─────────────────────────────────────────────────────

// P0-FV-CATALOG-QUALITY-RECAL-01: a tabela omitia `import_solarmarket` (origem.tipo
// VÁLIDA no schema Equipamento) → caía em `desconhecido` (20), travando o score em
// ~52 mesmo com completude 95 (nunca atingia 'utilizável'=75). SolarMarket é um
// marketplace curado com identidade confiável; quando as specs estão completas, o item
// deve ser utilizável. `derivado_modelo` cobre specs inferidas do nome (confiança menor
// que datasheet, maior que desconhecido).
const BASE_POR_ORIGEM = {
  manual: 100,
  datasheet_gemini: 90,
  datasheet_pdfparse: 75,
  import_solarmarket: 65,   // P0-FV-CATALOG-QUALITY-RECAL-01 (era omisso → 20)
  import_planilha: 60,
  derivado_modelo: 45,      // P0-FV-CATALOG-QUALITY-RECAL-01 (specs inferidas do modelo)
  import_legado: 40,
  desconhecido: 20,
}

const MULTIPLICADOR_ALERTA = {
  critico: 0,    // zera
  alto: 0.5,
  medio: 0.85,
  baixo: 0.95,
  info: 1.0,
}

function calcularConfianca(origem, alertas, validacaoExistente) {
  const tipoOrigem = origem?.tipo || 'desconhecido'
  let score = BASE_POR_ORIGEM[tipoOrigem] ?? BASE_POR_ORIGEM.desconhecido

  for (const a of alertas) {
    const mult = MULTIPLICADOR_ALERTA[a.severidade] ?? 1
    score *= mult
  }

  // Ajustes por revisão humana
  const ultima = validacaoExistente?.ultima_revisao_humana
  if (ultima) {
    const dias = (Date.now() - new Date(ultima).getTime()) / 86400000
    if (dias <= 90) score += 20
    else if (dias > 365) score -= 10
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ─── Determinação de nível ──────────────────────────────────────────────────

function determinarNivel(scoreGlobal, alertas, equipamento) {
  // Casos especiais que forçam baixa
  const temCritico = alertas.some(a => a.severidade === 'critico')
  if (temCritico) return 'invalido'

  if (!temIdentificacaoValida(equipamento)) {
    return 'aguardando_revisao'
  }

  if (scoreGlobal >= 90) return 'validado'
  if (scoreGlobal >= 75) return 'utilizavel'
  if (scoreGlobal >= 50) return 'incompleto'
  if (scoreGlobal >= 30) return 'suspeito'
  return 'invalido'
}

// ─── Status operacional ─────────────────────────────────────────────────────

function determinarStatusOperacional(nivel) {
  switch (nivel) {
    case 'validado':
      return { pode_ser_selecionado: true, aviso_ao_selecionar: null }
    case 'utilizavel':
      return { pode_ser_selecionado: true, aviso_ao_selecionar: null }
    case 'incompleto':
      return { pode_ser_selecionado: true, aviso_ao_selecionar: 'Specs parciais — verifique antes do projeto final.' }
    case 'suspeito':
      return { pode_ser_selecionado: true, aviso_ao_selecionar: 'Specs com alertas técnicos — recomenda-se revisão.' }
    case 'invalido':
      // Mesmo inválido, MVP NÃO bloqueia seleção (flag global BLOQUEAR_INVALIDOS_S3 = false).
      // Apenas avisa muito.
      return {
        pode_ser_selecionado: true,
        aviso_ao_selecionar: '⚠️ Specs inválidas (lei física violada). NÃO use em projetos reais até correção.',
      }
    case 'aguardando_revisao':
      return { pode_ser_selecionado: true, aviso_ao_selecionar: 'Identificação incompleta — aguardando revisão humana.' }
    default:
      return { pode_ser_selecionado: true, aviso_ao_selecionar: null }
  }
}

// ─── Comparação para histórico ──────────────────────────────────────────────

function houveMudancaRelevante(antes, depois) {
  if (!antes || !depois) return true
  if (antes.nivel !== depois.nivel) return true
  if (Math.abs((antes.score_global || 0) - (depois.score_global || 0)) >= 5) return true
  if ((antes.alertas?.length || 0) !== (depois.alertas?.length || 0)) return true
  return false
}

// ─── Função principal — processa um equipamento ─────────────────────────────

/**
 * Processa um equipamento. Função pura.
 *
 * @param {Object} equipamento - documento Mongoose ou POJO
 * @returns {Object} novos campos derivados — NÃO inclui `especificacoes`
 *   {
 *     specs_canonicas, identificacao, qualidade, status_operacional,
 *     evento_historico (opcional, se houve mudança relevante)
 *   }
 */
export function processarEquipamento(equipamento, options = {}) {
  const { specs_canonicas, plano } = normalizar(equipamento)
  const alertas = aplicarRegras(plano)
  const identificacao = montarIdentificacao(equipamento, equipamento.identificacao)

  const { score: completude_score, campos_faltantes } = calcularCompletude(equipamento, specs_canonicas)
  const confianca_score = calcularConfianca(equipamento.origem, alertas, equipamento.validacao)
  const score_global = Math.round(completude_score * 0.4 + confianca_score * 0.6)

  const nivel = determinarNivel(score_global, alertas, equipamento)
  const status_operacional = determinarStatusOperacional(nivel)

  const qualidade = {
    completude_score,
    confianca_score,
    score_global,
    nivel,
    campos_faltantes,
    alertas,
    calculado_em: new Date(),
    motor_versao: MOTOR_VERSAO,
  }

  // Evento de histórico (somente se houve mudança relevante)
  const qualidadeAnterior = equipamento.qualidade
  const mudou = houveMudancaRelevante(
    qualidadeAnterior ? { nivel: qualidadeAnterior.nivel, score_global: qualidadeAnterior.score_global, alertas: qualidadeAnterior.alertas } : null,
    { nivel, score_global, alertas }
  )

  let evento_historico = null
  if (mudou) {
    evento_historico = {
      em: new Date(),
      tipo: options.tipoEvento || 'validacao_automatica',
      por: options.por || 'sistema',
      antes: qualidadeAnterior ? {
        score_global: qualidadeAnterior.score_global || null,
        nivel: qualidadeAnterior.nivel || null,
      } : null,
      depois: { score_global, nivel },
      campos_alterados: campos_faltantes,
      observacao: options.observacao || null,
    }
  }

  return {
    specs_canonicas,
    identificacao,
    qualidade,
    status_operacional,
    evento_historico,
  }
}

// ─── Aplicar resultado ao doc (mutação controlada) ──────────────────────────

const MAX_HISTORICO = 50

/**
 * Mutação controlada: aplica o resultado de processarEquipamento ao doc.
 * Limita histórico aos últimos MAX_HISTORICO eventos.
 *
 * Nota: NÃO chama save. Apenas seta campos.
 */
export function aplicarResultadoNoDoc(doc, resultado) {
  if (!doc || !resultado) return doc

  doc.specs_canonicas    = resultado.specs_canonicas
  doc.identificacao      = resultado.identificacao
  doc.qualidade          = resultado.qualidade
  doc.status_operacional = resultado.status_operacional

  // Garantir origem (se ausente, marcar como desconhecido)
  if (!doc.origem || !doc.origem.tipo) {
    doc.origem = doc.origem || {}
    if (!doc.origem.tipo) doc.origem.tipo = 'desconhecido'
    if (!doc.origem.em) doc.origem.em = new Date()
  }

  // Histórico
  if (resultado.evento_historico) {
    doc.validacao = doc.validacao || { historico: [] }
    if (!Array.isArray(doc.validacao.historico)) doc.validacao.historico = []
    doc.validacao.historico.push(resultado.evento_historico)

    // Cap em MAX_HISTORICO (mantém últimos)
    if (doc.validacao.historico.length > MAX_HISTORICO) {
      doc.validacao.historico = doc.validacao.historico.slice(-MAX_HISTORICO)
    }
  } else {
    doc.validacao = doc.validacao || { historico: [] }
    if (!Array.isArray(doc.validacao.historico)) doc.validacao.historico = []
  }

  return doc
}

export const _internals = {
  num, str, bool, normalizarString, hashUnico, pick,
  normalizar, normalizarSpecsModulo, normalizarSpecsInversor, normalizarSpecsCarregador,
  calcularCompletude, calcularConfianca, determinarNivel, determinarStatusOperacional,
  houveMudancaRelevante,
  MOTOR_VERSAO, MAX_HISTORICO,
  PESOS_MODULO, PESOS_INVERSOR, PESOS_CARREGADOR,
}
