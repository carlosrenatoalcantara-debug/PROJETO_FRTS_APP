/**
 * conhecimentoCatalogo.js — CAT-KB-01
 *
 * Base de Conhecimento Forte Solar (camada de runtime). Responsabilidades:
 *   1. Construir o SEED a partir do conhecimento hoje hardcoded (puro, testável).
 *   2. Popular Mongo (DicionarioCanonico + AliasCampo) de forma IDEMPOTENTE.
 *   3. Carregar o conhecimento em cache de memória e INJETAR no parser e no
 *      fallback de fabricante.
 *
 * FALLBACK OBRIGATÓRIO: se Mongo estiver indisponível ou a carga falhar, o cache
 * fica vazio, os setters recebem getters inertes ([]) e o sistema opera com o
 * conhecimento hardcoded (parser atual) — ZERO regressão. Sem IA, sem score de
 * confiança, sem aprendizado automático.
 */

import mongoose from 'mongoose'
import { ROTULOS_BASE, setRotulosExtra } from './parserTecnicoInversor.js'
import { ALIASES_FABRICANTE, setAliasFabricanteExtra } from '../utils/catalogo/fabricanteModeloFallback.js'
import { DicionarioCanonico } from '../models/DicionarioCanonico.js'
import { AliasCampo } from '../models/AliasCampo.js'

// ── Vocabulário canônico definitivo (FASE 2 do CAT-LEARN-00) ─────────────────
// `chave_especificacoes` = a chave REALMENTE gravada em Equipamento.especificacoes
// (compatibilidade total: não muda o schema nem a saída do parser).
export const DICIONARIO = [
  { campo: 'potencia_nominal_kw',  chave_especificacoes: 'potencia_kw',           tipo: 'number', unidade: 'kW',   grupo: 'AC',    rotulo_ui: 'Potência nominal (kW)' },
  { campo: 'potencia_maxima_kw',   chave_especificacoes: 'potencia_maxima_kw',    tipo: 'number', unidade: 'kW',   grupo: 'AC',    rotulo_ui: 'Potência máxima (kW)' },
  { campo: 'potencia_aparente_kva',chave_especificacoes: 'potencia_aparente_kva', tipo: 'number', unidade: 'kVA',  grupo: 'AC',    rotulo_ui: 'Potência aparente (kVA)' },
  { campo: 'tensao_ac_nominal',    chave_especificacoes: 'tensao_ac',             tipo: 'number', unidade: 'V',    grupo: 'AC',    rotulo_ui: 'Tensão AC nominal (V)' },
  { campo: 'corrente_ac_saida',    chave_especificacoes: 'corrente_ac_saida',     tipo: 'number', unidade: 'A',    grupo: 'AC',    rotulo_ui: 'Corrente AC de saída (A)' },
  { campo: 'fases',                chave_especificacoes: 'fases',                 tipo: 'enum',   unidade: null,   grupo: 'AC',    rotulo_ui: 'Fases' },
  { campo: 'frequencia_hz',        chave_especificacoes: 'frequencia_hz',         tipo: 'number', unidade: 'Hz',   grupo: 'AC',    rotulo_ui: 'Frequência (Hz)' },
  { campo: 'n_mppts',              chave_especificacoes: 'n_mppts',               tipo: 'int',    unidade: null,   grupo: 'DC',    rotulo_ui: 'Nº de MPPTs' },
  { campo: 'strings_por_mppt',     chave_especificacoes: 'strings_por_mppt',      tipo: 'int',    unidade: null,   grupo: 'DC',    rotulo_ui: 'Strings por MPPT' },
  { campo: 'tensao_max_entrada',   chave_especificacoes: 'tensao_max_entrada',    tipo: 'number', unidade: 'V',    grupo: 'DC',    rotulo_ui: 'Tensão máxima de entrada (V)' },
  { campo: 'tensao_mppt_min',      chave_especificacoes: 'tensao_mppt_min',       tipo: 'number', unidade: 'V',    grupo: 'DC',    rotulo_ui: 'Tensão MPPT mínima (V)' },
  { campo: 'tensao_mppt_max',      chave_especificacoes: 'tensao_mppt_max',       tipo: 'number', unidade: 'V',    grupo: 'DC',    rotulo_ui: 'Tensão MPPT máxima (V)' },
  { campo: 'tensao_partida',       chave_especificacoes: 'tensao_partida',        tipo: 'number', unidade: 'V',    grupo: 'DC',    rotulo_ui: 'Tensão de partida (V)' },
  { campo: 'corrente_max_por_mppt',chave_especificacoes: 'corrente_max_por_mppt', tipo: 'number', unidade: 'A',    grupo: 'DC',    rotulo_ui: 'Corrente máx. por MPPT (A)' },
  { campo: 'corrente_isc_max',     chave_especificacoes: 'corrente_isc_max',      tipo: 'number', unidade: 'A',    grupo: 'DC',    rotulo_ui: 'Corrente Isc máxima (A)' },
  { campo: 'eficiencia_maxima',    chave_especificacoes: 'eficiencia_maxima',     tipo: 'number', unidade: '%',    grupo: 'EFIC',  rotulo_ui: 'Eficiência máxima (%)' },
  { campo: 'eficiencia_europeia',  chave_especificacoes: 'eficiencia_europeia',   tipo: 'number', unidade: '%',    grupo: 'EFIC',  rotulo_ui: 'Eficiência europeia (%)' },
  { campo: 'grau_protecao_ip',     chave_especificacoes: 'grau_protecao_ip',      tipo: 'string', unidade: 'IP',   grupo: 'PROT',  rotulo_ui: 'Grau de proteção (IP)' },
  { campo: 'temperatura_operacao', chave_especificacoes: 'temperatura_operacao',  tipo: 'string', unidade: '°C',   grupo: 'FIS',   rotulo_ui: 'Temperatura de operação' },
  { campo: 'peso_kg',              chave_especificacoes: 'peso_kg',               tipo: 'number', unidade: 'kg',   grupo: 'FIS',   rotulo_ui: 'Peso (kg)' },
  { campo: 'dimensoes',            chave_especificacoes: 'dimensoes',             tipo: 'string', unidade: 'mm',   grupo: 'FIS',   rotulo_ui: 'Dimensões (mm)' },
  { campo: 'garantia_anos',        chave_especificacoes: 'garantia_anos',         tipo: 'int',    unidade: 'anos', grupo: 'GERAL', rotulo_ui: 'Garantia (anos)' },
  { campo: 'certificacoes',        chave_especificacoes: 'certificacoes',         tipo: 'array',  unidade: null,   grupo: 'GERAL', rotulo_ui: 'Certificações' },
]

// ── Nomenclatura IA → chave canônica (migrada de normalizarMulti.mapearEspecificacoes) ──
// (Apenas MIGRADA para a KB; a wiring ativa continua no hardcoded — fallback.)
const NOMENCLATURA = {
  potencia_kw:            ['potencia_nominal_kw', 'potenciaKW'],
  tensao_ac:             ['tensao_ac_nominal', 'tensao_ac_nominal_v'],
  fases:                 ['faseAC', 'fases_ac'],
  corrente_ac_saida:     ['correnteACSaida', 'corrente_ac_saida_a'],
  thdi:                  ['thdi_pct'],
  n_mppts:               ['nMppts'],
  potencia_max_entrada_cc:['potencia_max_entrada_dc_w', 'potencia_max_entrada_dc_kwp'],
  tensao_max_entrada:    ['tensao_max_entrada_dc_v'],
  tensao_partida:        ['tensao_partida_v'],
  tensao_nominal_cc:     ['tensao_nominal_dc_v'],
  tensao_mppt_min:       ['tensaoMpptMin', 'tensao_mppt_min_v'],
  tensao_mppt_max:       ['tensaoMpptMax', 'tensao_mppt_max_v'],
  corrente_max_entrada:  ['corrente_max_entrada_dc_a'],
  corrente_max_por_mppt: ['corrente_max_por_mppt_a'],
  corrente_isc_max:      ['corrente_isc_max_a'],
  eficiencia_maxima:     ['eficiencia', 'eficiencia_maxima_pct'],
  eficiencia_europeia:   ['eficiencia_europeia_pct'],
  eficiencia_cec:        ['eficiencia_cec_pct'],
  eficiencia_mppt:       ['eficiencia_mppt_pct'],
  temperatura_operacao:  ['temperatura_operacao_c'],
  dimensoes:             ['dimensoes_mm'],
}

// ── util ─────────────────────────────────────────────────────────────────────
function _norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
function _idioma(rotulo) {
  return /[êéãáíóúçà]|Pot[êe]|Tens|Corrente|Peso|Garantia|Faixa|Temperatura|N[ºo]|Quantidade|Entradas?/i.test(rotulo) ? 'pt' : 'en'
}

/**
 * Constrói os documentos do SEED a partir do conhecimento hardcoded. PURO.
 * @returns {{ dicionario: Object[], aliases: Object[] }}
 */
export function construirDocumentosSeed() {
  const aliases = []

  // 1) Rótulos do parser (tipo 'rotulo', global)
  for (const [campo, lista] of Object.entries(ROTULOS_BASE)) {
    for (const rot of lista) {
      aliases.push({
        tipo: 'rotulo', campo_canonico: campo, fabricante: null,
        alias_original: rot, alias_normalizado: _norm(rot), idioma: _idioma(rot), origem: 'seed',
      })
    }
  }

  // 2) Nomenclatura IA → chave canônica (tipo 'nomenclatura', global)
  for (const [campo, nomes] of Object.entries(NOMENCLATURA)) {
    for (const nome of nomes) {
      aliases.push({
        tipo: 'nomenclatura', campo_canonico: campo, fabricante: null,
        alias_original: nome, alias_normalizado: _norm(nome), idioma: null, origem: 'seed',
      })
    }
  }

  // 3) Aliases de fabricante (tipo 'fabricante')
  for (const { fabricante, aliases: lista } of ALIASES_FABRICANTE) {
    for (const a of lista) {
      aliases.push({
        tipo: 'fabricante', campo_canonico: '_fabricante', fabricante,
        alias_original: a, alias_normalizado: _norm(a), idioma: null, origem: 'seed',
      })
    }
  }

  return { dicionario: DICIONARIO, aliases }
}

// ── Cache de runtime ─────────────────────────────────────────────────────────
const _cache = { rotulos: new Map(), fabricantes: [], carregado: false, origem: 'fallback', total: 0 }

/** Rótulos extra (KB) de um campo — consumido pelo parser. */
export function rotulosExtra(campo) { return _cache.rotulos.get(campo) || [] }
/** Aliases de fabricante extra (KB) — consumido pelo fallback de fabricante. */
export function aliasFabricanteExtra() { return _cache.fabricantes }
/** Estado atual da KB (diagnóstico). */
export function estadoConhecimento() {
  return { carregado: _cache.carregado, origem: _cache.origem, campos_com_rotulo: _cache.rotulos.size, fabricantes: _cache.fabricantes.length, total_aliases: _cache.total }
}

function _ativarFallback(origem) {
  _cache.rotulos = new Map(); _cache.fabricantes = []; _cache.carregado = false; _cache.origem = origem; _cache.total = 0
  setRotulosExtra(() => [])
  setAliasFabricanteExtra(() => [])
}

/**
 * Carrega o conhecimento do Mongo para o cache e injeta no parser/fallback.
 * Em qualquer falha → ativa fallback hardcoded (não lança).
 * @returns {Promise<Object>} estado da KB
 */
export async function carregarConhecimento() {
  try {
    if (mongoose.connection?.readyState !== 1) { _ativarFallback('mongo_desconectado'); return estadoConhecimento() }
    const docs = await AliasCampo.find({}).lean()
    if (!docs.length) { _ativarFallback('kb_vazia'); return estadoConhecimento() }

    const rotulos = new Map()
    const fabricantes = []
    for (const d of docs) {
      if (d.tipo === 'fabricante') { fabricantes.push({ alias: d.alias_original, fabricante: d.fabricante }); continue }
      if (d.tipo === 'rotulo') {
        const arr = rotulos.get(d.campo_canonico) || []
        arr.push(d.alias_original)
        rotulos.set(d.campo_canonico, arr)
      }
      // 'nomenclatura' fica persistida, mas a wiring ativa segue no hardcoded.
    }

    _cache.rotulos = rotulos
    _cache.fabricantes = fabricantes
    _cache.carregado = true
    _cache.origem = 'mongo'
    _cache.total = docs.length
    setRotulosExtra(rotulosExtra)
    setAliasFabricanteExtra(aliasFabricanteExtra)
    return estadoConhecimento()
  } catch (e) {
    _ativarFallback(`erro:${e?.message || e}`)
    return estadoConhecimento()
  }
}

/**
 * Popula Mongo (idempotente) com o seed. Requer conexão ativa.
 * @returns {Promise<{ok:boolean, dicionario:number, aliases:number, motivo?:string}>}
 */
export async function semearConhecimento() {
  if (mongoose.connection?.readyState !== 1) {
    return { ok: false, dicionario: 0, aliases: 0, motivo: 'mongo_desconectado' }
  }
  const { dicionario, aliases } = construirDocumentosSeed()

  // DicionarioCanonico — upsert por `campo`
  const dicOps = dicionario.map(d => ({
    updateOne: { filter: { campo: d.campo }, update: { $set: d }, upsert: true },
  }))
  if (dicOps.length) await DicionarioCanonico.bulkWrite(dicOps, { ordered: false })

  // AliasCampo — upsert idempotente (não duplica)
  const aliOps = aliases.map(a => ({
    updateOne: {
      filter: { tipo: a.tipo, campo_canonico: a.campo_canonico, alias_normalizado: a.alias_normalizado, fabricante: a.fabricante },
      update: { $set: a },
      upsert: true,
    },
  }))
  if (aliOps.length) await AliasCampo.bulkWrite(aliOps, { ordered: false })

  return { ok: true, dicionario: dicionario.length, aliases: aliases.length }
}

/**
 * Conveniência de boot: semeia (se vazio) e carrega para cache. Nunca lança.
 */
export async function inicializarConhecimento() {
  try {
    if (mongoose.connection?.readyState !== 1) { _ativarFallback('mongo_desconectado'); return estadoConhecimento() }
    const existem = await AliasCampo.estimatedDocumentCount()
    if (!existem) await semearConhecimento()
    return await carregarConhecimento()
  } catch (e) {
    _ativarFallback(`erro:${e?.message || e}`)
    return estadoConhecimento()
  }
}
