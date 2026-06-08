/**
 * engenhariaPayload.js — P1-ENGINEERING-CONSUME-01 (frontend)
 *
 * Ponte de CONSUMO entre a UI e os contratos puros de engenharia do backend
 * (engineeringPresentation/Fallback). Não grava nada; apenas calcula, em runtime,
 * o status/badge/justificativa por campo a partir do equipamento do catálogo.
 *
 * Mapeia os DIALETOS do `especificacoes` (voc_max, faixa_mppt_min, mppts…) para os
 * nomes CANÔNICOS que o contrato espera — sem alterar dados nem o SSOT.
 */
import {
  montarPayloadEngenharia, badgeDe, BADGES, CAMPOS_EXIBICAO,
} from '../../../../backend/src/services/engineeringPresentation.js'
import { STATUS, podeSubstituir } from '../../../../backend/src/services/engineeringFallback.js'

export { badgeDe, BADGES, STATUS, podeSubstituir, CAMPOS_EXIBICAO }

// dialeto (chave de exibição em especificacoes) → campo canônico do contrato
export const DIALETO_CANONICO = {
  tensao_partida: 'tensao_partida',
  faixa_mppt_min: 'tensao_mppt_min', mppt_min: 'tensao_mppt_min', tensao_mppt_min: 'tensao_mppt_min',
  faixa_mppt_max: 'tensao_mppt_max', mppt_max: 'tensao_mppt_max', tensao_mppt_max: 'tensao_mppt_max',
  mppts: 'n_mppts', n_mppts: 'n_mppts', numero_mppt: 'n_mppts',
  voc_max: 'tensao_max_entrada', voc_max_dc: 'tensao_max_entrada', tensao_max_dc: 'tensao_max_entrada', vpv_max: 'tensao_max_entrada', tensao_max_entrada: 'tensao_max_entrada',
  ipv_max: 'corrente_max_por_mppt', corrente_max_mppt: 'corrente_max_por_mppt', corrente_max_por_mppt: 'corrente_max_por_mppt',
  isc_max: 'corrente_isc_max', isc_max_mppt: 'corrente_isc_max', corrente_isc_max: 'corrente_isc_max',
  strings_por_mppt: 'strings_por_mppt', entradas_por_mppt: 'strings_por_mppt',
  potencia_kw: 'potencia_kw', potencia: 'potencia_kw', potencia_ca: 'potencia_kw',
}

const num = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return typeof n === 'number' && Number.isFinite(n) ? n : v }

/** Constrói a visão canônica a partir do equipamento do catálogo (dialetos). */
export function visaoCanonica(equip = {}) {
  const esp = equip.especificacoes || equip || {}
  const canon = {}
  for (const [k, v] of Object.entries(esp)) {
    const c = DIALETO_CANONICO[k]
    if (c && (canon[c] == null) && v != null && v !== '') canon[c] = num(v)
  }
  return canon
}

/** Status de extração (origem real) a partir do fonte_dados do documento. */
function statusExtracaoDe(equip = {}) {
  const fd = equip.fonte_dados || {}
  const out = {}
  for (const [k, meta] of Object.entries(fd)) {
    const c = DIALETO_CANONICO[k]
    if (c && meta && typeof meta.confianca === 'number' && meta.confianca >= 0.8) out[c] = 'inferido_alta'
  }
  return out
}

/** Payload de engenharia (badges/justificativa) para um equipamento do catálogo. */
export function payloadEngenharia(equip = {}) {
  return montarPayloadEngenharia(visaoCanonica(equip), { statusExtracao: statusExtracaoDe(equip) })
}

/** Item de exibição (valor/status/badge/justificativa) para uma CHAVE de dialeto. */
export function itemPorChave(payload, chaveDialeto) {
  const c = DIALETO_CANONICO[chaveDialeto]
  return c && payload && payload.campos ? payload.campos[c] || null : null
}
