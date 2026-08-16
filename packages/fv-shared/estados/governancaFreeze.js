/**
 * governancaFreeze.js — FONTE ÚNICA do vocabulário e das transições de
 * `governanca.freeze_status` do Projeto FV.
 *
 * FV-UX-006 (F3.1). Antes existiam DUAS definições:
 *   1. backend/src/models/ProjetoFV.js        (FREEZE_STATUS, FREEZE_STATUS_TRAVADOS)
 *      + tabela de transições inline no projetosFVController.js
 *   2. frontend/src/utils/engenhariaGovernanca.js (FREEZE_STATUS_CONFIG,
 *      TRANSICOES_FREEZE — comentadas como "espelha o backend")
 *
 * Os valores coincidiam; o risco era de divergirem na próxima alteração.
 *
 * Nota histórica (FV-UX-005 / F3.3): `cenarios_governanca` é Mixed e chegou a
 * gravar o vocabulário paralelo `EDITAVEL | CONGELADO`. `EDITAVEL` nunca
 * pertenceu a este vocabulário — ver `normalizarFreezeLegado`.
 *
 * Puro e determinístico. Sem I/O, sem framework.
 */

/** Estados de congelamento, com metadados de apresentação. */
export const ESTADOS_FREEZE = Object.freeze({
  RASCUNHO:   { label: 'RASCUNHO',   cor: 'cinza',   corHex: '#64748b', descricao: 'Em edição — pode ser recalculado livremente.' },
  EM_REVISAO: { label: 'EM REVISÃO', cor: 'azul',    corHex: '#3b82f6', descricao: 'Revisão aberta para ajustes de engenharia.' },
  APROVADO:   { label: 'APROVADO',   cor: 'azul',    corHex: '#2563eb', descricao: 'Aprovado comercialmente — pronto para congelar a engenharia.' },
  CONGELADO:  { label: 'CONGELADO',  cor: 'laranja', corHex: '#f97316', descricao: 'Snapshots travados — não recalcula automaticamente.' },
  HOMOLOGADO: { label: 'HOMOLOGADO', cor: 'verde',   corHex: '#10b981', descricao: 'Aprovado e estável — documento técnico definitivo.' },
})

/** Vocabulário canônico. Alimenta o enum do schema e os guards do controller. */
export const FREEZE_STATUS = Object.freeze(Object.keys(ESTADOS_FREEZE))

/** Estados em que a baseline está travada para recálculo. */
export const FREEZE_STATUS_TRAVADOS = Object.freeze(['CONGELADO', 'HOMOLOGADO'])

/**
 * Transições válidas. CONGELADO/HOMOLOGADO são produzidos pelo endpoint de
 * congelamento (que captura snapshot), mas constam aqui para a UI.
 */
export const TRANSICOES_FREEZE = Object.freeze({
  RASCUNHO:   ['APROVADO', 'EM_REVISAO'],
  EM_REVISAO: ['APROVADO', 'RASCUNHO'],
  APROVADO:   ['CONGELADO', 'RASCUNHO', 'EM_REVISAO'],
  CONGELADO:  ['HOMOLOGADO', 'EM_REVISAO'],
  HOMOLOGADO: ['EM_REVISAO'],
})

/** O valor pertence ao vocabulário canônico? (`null` é ausência, não valor.) */
export function ehFreezeStatusValido(valor) {
  return FREEZE_STATUS.includes(valor)
}

export function getFreezeStatusConfig(status) {
  return ESTADOS_FREEZE[status] || ESTADOS_FREEZE.RASCUNHO
}

export function transicoesFreezeValidas(status) {
  return TRANSICOES_FREEZE[status] || []
}

export function estaTravado(status) {
  return FREEZE_STATUS_TRAVADOS.includes(status)
}

/**
 * Converte um valor legado para o vocabulário canônico.
 * `EDITAVEL` (vocabulário paralelo dos cenários, ver FV-UX-005) → `RASCUNHO`.
 * Qualquer outro valor desconhecido também cai em `RASCUNHO`: leitura tolerante.
 * A escrita continua estrita — use `ehFreezeStatusValido` antes de gravar.
 */
export function normalizarFreezeLegado(valor) {
  if (valor === 'EDITAVEL') return 'RASCUNHO'
  return ehFreezeStatusValido(valor) ? valor : 'RASCUNHO'
}
