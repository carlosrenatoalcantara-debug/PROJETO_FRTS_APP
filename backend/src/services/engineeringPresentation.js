/**
 * engineeringPresentation.js — P1-ENGINEERING-INTEGRATION-01
 *
 * Camada de EXIBIÇÃO da engenharia conservadora. Produz um payload pronto para a UI
 * (status + badge + justificativa por campo) e o contrato de substituição manual.
 *
 * GARANTIAS:
 *  - Funções PURAS — não gravam no Atlas, não mutam o catálogo, não alteram SSOT/parser.
 *  - Apenas TORNA VISÍVEL a proveniência já produzida pelo EngineeringFallback (runtime).
 *  - A substituição manual aqui é só VALIDAÇÃO de contrato — NÃO grava.
 */

import {
  aplicarFallbackEngenharia, statusDoCampo, STATUS,
  podeSubstituir, ROLES_PODEM_SUBSTITUIR, ORIGEM_FALLBACK,
} from './engineeringFallback.js'

// ── FASE 3 — BADGES (camada de exibição; não altera dados persistidos) ───────
export const BADGES = {
  [STATUS.EXTRAIDO]:       { emoji: '🟢', label: 'Extraído',              cor: 'verde',    real: true,  descricao: 'Valor extraído do datasheet.' },
  [STATUS.VALIDADO]:       { emoji: '🔵', label: 'Validado',              cor: 'azul',     real: true,  descricao: 'Valor revisado/confirmado por humano.' },
  [STATUS.INFERIDO_FORTE]: { emoji: '🟡', label: 'Inferido',             cor: 'amarelo',  real: true,  descricao: 'Inferência de alta confiança (OCR/compartilhado).' },
  [STATUS.FALLBACK]:       { emoji: '🟠', label: 'Fallback Conservador', cor: 'laranja',  real: false, descricao: 'Valor conservador estimado em runtime — NÃO é dado real.' },
}
export const badgeDe = (status) => BADGES[status] || null

// Campos de engenharia exibidos (CC/CA relevantes a unifilar/parecer/dimensionamento).
export const CAMPOS_EXIBICAO = [
  'potencia_kw', 'tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max',
  'n_mppts', 'strings_por_mppt', 'corrente_max_por_mppt', 'corrente_isc_max', 'tensao_partida',
]

/**
 * FASE 2/3/4 — payload de exibição por campo (status + badge + justificativa do fallback).
 * @param {Object} equipReal equipamento real (visão SSOT)
 * @param {Object} ctx { statusExtracao: {campo:nivel}, validados: {campo:true} }
 */
export function montarPayloadEngenharia(equipReal = {}, ctx = {}) {
  const { statusExtracao = {}, validados = {} } = ctx
  const { operacional, fallback } = aplicarFallbackEngenharia(equipReal)
  const campos = {}
  for (const campo of CAMPOS_EXIBICAO) {
    const valor = operacional[campo]
    if (valor == null) continue                       // ausente e sem fallback → não exibe
    const status = statusDoCampo(campo, { real: equipReal, fallback, statusExtracao, validado: !!validados[campo] })
    const item = { valor, status, badge: badgeDe(status), real: badgeDe(status)?.real ?? true }
    // FASE 4 — painel de justificativa (apenas para valores de fallback)
    if (fallback[campo]) {
      item.justificativa = {
        origem: fallback[campo].origem,        // fallback_conservador
        confianca: fallback[campo].confianca,  // baixa
        motivo: fallback[campo].motivo,        // campo_ausente
        texto: `Origem: ${fallback[campo].origem} · Confiança: ${fallback[campo].confianca} · Motivo: ${fallback[campo].motivo === 'campo_ausente' ? 'campo ausente' : fallback[campo].motivo}`,
      }
      item.substituivel = true                 // pode ser corrigido manualmente (FASE 5)
    }
    campos[campo] = item
  }
  const inferidos = Object.keys(fallback)
  return { campos, fallback_aplicado: inferidos, tem_fallback: inferidos.length > 0 }
}

// ── FASE 5 — substituição manual futura: CONTRATO + PAYLOAD + AUTORIZAÇÃO +
//    VALIDAÇÕES (sem implementar a gravação) ───────────────────────────────────
export const PAYLOAD_SUBSTITUICAO = {
  equipamento_id: 'ObjectId (string)',
  campo: 'string (ex.: tensao_partida)',
  valor_real: 'number|string',
  por: `role ∈ ${JSON.stringify(ROLES_PODEM_SUBSTITUIR)}`,
  justificativa: 'string (opcional)',
}

/**
 * Valida (NÃO grava) uma futura substituição do valor estimado pelo valor REAL.
 * @returns {{ ok, erros, efeito }} — `efeito` descreve o que SERIA feito (sem fazer).
 */
export function validarSubstituicaoManual(payload = {}, role) {
  const erros = []
  if (!podeSubstituir(role)) erros.push('role_nao_autorizada')
  if (!payload.equipamento_id || typeof payload.equipamento_id !== 'string') erros.push('equipamento_id_invalido')
  if (!payload.campo || typeof payload.campo !== 'string') erros.push('campo_invalido')
  if (payload.valor_real == null || payload.valor_real === '') erros.push('valor_real_ausente')
  const ok = erros.length === 0
  return {
    ok, erros,
    // descreve o efeito futuro — NÃO executado nesta sprint
    efeito: ok ? {
      acao: 'gravar_valor_real_no_atlas',
      campo: payload.campo, valor_real: payload.valor_real,
      remove_fallback: ORIGEM_FALLBACK, autor: role, em: new Date().toISOString(),
    } : null,
  }
}
