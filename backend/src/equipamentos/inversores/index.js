/**
 * equipamentos/inversores — P0-INV-SSOT-01
 *
 * Ponto de entrada único do domínio "inversor". Todos os consumidores
 * (qualidade backend/frontend, dimensionamento, ficha, importação assistida)
 * importam daqui — nunca traduzem nomes de campo localmente.
 */

import { CAMPOS_INVERSOR, PESO_IDENTIFICACAO, CAMPOS_COM_PESO, valorCampo, lerInversor, TOPOLOGIA, derivarTopologia, normalizarEntradasPorMppt } from './dicionarioInversor.js'

export { CAMPOS_INVERSOR, PESO_IDENTIFICACAO, CAMPOS_COM_PESO, valorCampo, lerInversor, TOPOLOGIA, derivarTopologia, normalizarEntradasPorMppt }

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Projeção para o DIMENSIONAMENTO (compatibilidadeFV / stringSizing).
 * Lê do MESMO objeto persistido via SSOT — sem aliases locais.
 * Mantém os nomes que o calculador elétrico espera (compatibilidade).
 * @returns {{potencia_kw,tensao_nominal_v,voc_max_dc,mppt_min_v,mppt_max_v,isc_max_mppt,n_mppts}}
 */
export function paraDimensionamento(especificacoes, equipamento = {}) {
  const c = lerInversor(especificacoes, equipamento)
  const entradas = c.entradas_por_mppt
  return {
    potencia_kw:      _num(c.potencia_kw) ?? _num(equipamento.potencia_kw) ?? 0,
    tensao_nominal_v: _num(c.tensao_ac) ?? (c.fases === 3 ? 380 : 220),
    voc_max_dc:       _num(c.tensao_max_entrada) ?? 600,
    mppt_min_v:       _num(c.tensao_mppt_min) ?? 100,
    mppt_max_v:       _num(c.tensao_mppt_max) ?? 550,
    isc_max_mppt:     _num(c.corrente_isc_max) ?? _num(c.corrente_max_por_mppt) ?? 13,
    n_mppts:          _num(c.n_mppts) ?? 2,
    // P1-INV-TOPOLOGY-01: limite FÍSICO do equipamento (consumido, não altera regras).
    tipo_topologia:   c.tipo_topologia,
    entradas_por_mppt: entradas,
    max_entradas_total: Array.isArray(entradas) ? entradas.reduce((a, b) => a + b, 0) : null,
  }
}
