/**
 * normalizarMulti.js — P0-INV-01A
 *
 * CAUSA RAIZ (confirmada em INV-CAT-02): o `normalizar()` legado colapsa as
 * variantes de um datasheet em UM único `dados.modelo` + `primeira` variante,
 * e o modal só faz 1 POST. Resultado: 1 PDF de série (MID15/20/25KTL3-X) vira
 * 1 equipamento.
 *
 * `normalizarMulti()` transforma o resultado bruto do provider (que JÁ traz
 * `variantes[]` com `modelo_variante` + campos técnicos) em N itens no schema
 * interno — UM por modelo distinto — preservando os dados técnicos de cada um.
 *
 * PURO: sem I/O, sem dependências externas. Importável por backend e testes.
 */

import { criarSchemaInterno } from './schema.js'

/**
 * Mapeia os campos técnicos de uma variante (vocabulário do prompt/IA) para o
 * vocabulário de `especificacoes` usado pelo catálogo (o mesmo que Inversores.jsx
 * renderiza). Só inclui chaves com valor presente.
 */
export function mapearEspecificacoes(v = {}) {
  const esp = {}
  const set = (k, val) => { if (val !== null && val !== undefined && val !== '') esp[k] = val }

  // AC
  set('potencia_kw',           v.potencia_nominal_kw ?? v.potenciaKW ?? v.potencia_kw)
  set('potencia_maxima_kw',    v.potencia_maxima_kw)
  set('potencia_aparente_kva', v.potencia_aparente_kva)
  set('tensao_ac',             v.tensao_ac_nominal ?? v.tensao_ac)
  set('faixa_tensao_rede',     v.faixa_tensao_rede)
  set('fases',                 v.fases ?? v.faseAC)
  set('tipo_conexao_rede',     v.tipo_conexao_rede)
  set('frequencia_hz',         v.frequencia_hz)
  set('faixa_frequencia_hz',   v.faixa_frequencia_hz)
  set('corrente_ac_saida',     v.corrente_ac_saida ?? v.correnteACSaida)
  set('fator_potencia',        v.fator_potencia)
  set('thdi',                  v.thdi)
  // DC / MPPT
  set('n_mppts',               v.n_mppts ?? v.nMppts)
  set('strings_por_mppt',      v.strings_por_mppt)
  set('potencia_max_entrada_cc', v.potencia_max_entrada_cc)
  set('tensao_max_entrada',    v.tensao_max_entrada)
  set('tensao_partida',        v.tensao_partida)
  set('tensao_nominal_cc',     v.tensao_nominal_cc)
  set('tensao_mppt_min',       v.tensao_mppt_min ?? v.tensaoMpptMin)
  set('tensao_mppt_max',       v.tensao_mppt_max ?? v.tensaoMpptMax)
  set('faixa_operacao_cc',     v.faixa_operacao_cc)
  set('corrente_max_entrada',  v.corrente_max_entrada)
  set('corrente_max_por_mppt', v.corrente_max_por_mppt)
  set('corrente_isc_max',      v.corrente_isc_max)
  // Eficiência
  set('eficiencia_maxima',     v.eficiencia_maxima ?? v.eficiencia)
  set('eficiencia_europeia',   v.eficiencia_europeia)
  set('eficiencia_cec',        v.eficiencia_cec)
  set('eficiencia_mppt',       v.eficiencia_mppt)
  // Proteções
  set('grau_protecao_ip',        v.grau_protecao_ip)
  set('protecao_antiilhamento',  v.protecao_antiilhamento)
  set('protecao_sobretensao_dc', v.protecao_sobretensao_dc)
  set('protecao_sobretensao_ac', v.protecao_sobretensao_ac)
  // Físico / geral
  set('temperatura_operacao',  v.temperatura_operacao)
  set('tipo_refrigeracao',     v.tipo_refrigeracao)
  set('comunicacao',           v.comunicacao)
  set('max_por_cabo_tronco',   v.max_por_cabo_tronco)
  set('peso_kg',               v.peso_kg)
  set('dimensoes',             v.dimensoes)
  set('garantia_anos',         v.garantia_anos)
  set('subtipo',               v.subtipo)
  return esp
}

function _limpar(s) {
  if (s == null) return null
  const t = String(s).trim()
  return t === '' ? null : t
}

/**
 * Converte o resultado bruto em N itens do schema interno (1 por modelo distinto).
 *
 * @param {Object} raw { fabricante, modelo, tipo, subtipo, variantes:[...] }
 * @returns {Array<{fabricante,modelo,tipo,especificacoes,_meta}>}
 */
export function normalizarMulti(raw = {}) {
  const fabricante = _limpar(raw.fabricante)
  const tipo = _limpar(raw.tipo) || 'inversor'
  const variantes = Array.isArray(raw.variantes) ? raw.variantes : []

  // Não-inversor (ex.: módulo): 1 equipamento (variantes = potências, não modelos).
  if (tipo !== 'inversor') {
    return [criarSchemaInterno({
      fabricante, modelo: _limpar(raw.modelo), tipo,
      especificacoes: variantes[0] ? mapearEspecificacoes(variantes[0]) : {},
      _meta: { multi: false },
    })]
  }

  // Inversor: 1 item por modelo distinto (dedup intra-PDF por fabricante+modelo).
  const itens = []
  const vistos = new Set()
  for (const v of variantes) {
    const modelo = _limpar(v.modelo_variante) || _limpar(v.modelo) || _limpar(raw.modelo)
    if (!modelo) continue
    const chave = `${(fabricante || '').toLowerCase()}::${modelo.toLowerCase()}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    itens.push(criarSchemaInterno({
      fabricante,
      modelo,
      tipo,
      especificacoes: mapearEspecificacoes({ subtipo: raw.subtipo, ...v }),
      _meta: { multi: true, modelo_variante: !!v.modelo_variante },
    }))
  }

  // Fallback: nenhuma variante com modelo → usa o modelo de topo (1 item).
  if (itens.length === 0 && _limpar(raw.modelo)) {
    itens.push(criarSchemaInterno({
      fabricante, modelo: _limpar(raw.modelo), tipo,
      especificacoes: variantes[0] ? mapearEspecificacoes(variantes[0]) : {},
      _meta: { multi: false },
    }))
  }

  return itens
}
