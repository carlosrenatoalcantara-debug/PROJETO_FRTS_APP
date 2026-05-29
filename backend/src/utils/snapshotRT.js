/**
 * snapshotRT.js — Sprint 8.3.2
 * Helper PURO: monta o snapshot imutável do Responsável Técnico no congelamento.
 * Documentos futuros usam o snapshot, não o cadastro vivo (que pode mudar).
 */

/**
 * @param {object} tecnico  documento Tecnico (ou plain object) selecionado no projeto.
 * @param {Date}   data     data do snapshot (default: agora).
 * @returns {object|null}   snapshot congelado, ou null se sem técnico.
 */
export function montarSnapshotRT(tecnico, data = new Date()) {
  if (!tecnico) return null
  const t = typeof tecnico.toObject === 'function' ? tecnico.toObject() : tecnico
  return {
    nome:            t.nome ?? null,
    tipo_registro:   t.tipo_registro ?? null,
    numero_registro: t.registro ?? null,
    uf:              t.uf ?? null,
    formacao:        t.formacao ?? null,
    modalidade:      t.modalidade ?? null,
    art_trt:         t.numero_art_padrao ?? null,
    data_snapshot:   data instanceof Date ? data.toISOString() : data,
  }
}
