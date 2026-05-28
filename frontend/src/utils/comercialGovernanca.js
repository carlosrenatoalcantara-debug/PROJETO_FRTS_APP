/**
 * comercialGovernanca.js — Sprint 4.2
 *
 * Governança comercial: workflow, assinaturas (hash+timestamp), config de
 * badges e construtor do snapshot comercial congelável.
 *
 * ENGINEERING LOCK: o snapshot comercial referencia snapshot técnico/financeiro/
 * regulatório — não recalcula a partir do state vivo.
 */

import { hashTecnico, ENGINEERING_VERSION } from './engenhariaGovernanca'

// ─── SHA-256 (assinatura comercial auditável — S4.3) ─────────────────────────────
// Usa Web Crypto (assíncrono). Mantém djb2 (hashTecnico) para snapshots/legado.
export async function sha256Hex(str) {
  try {
    const data = new TextEncoder().encode(String(str ?? ''))
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // Fallback determinístico se Web Crypto indisponível (ex.: contexto inseguro)
    return 'djb2:' + hashTecnico(str)
  }
}

/**
 * Gera assinatura comercial auditável com SHA-256 (S4.3).
 * Inclui hash do documento e do snapshot técnico para trilha jurídica.
 */
export async function gerarAssinaturaSegura({ papel, nome, hashDocumento, hashSnapshot }) {
  const timestamp = new Date().toISOString()
  const payload = `${papel}|${nome}|${timestamp}|${hashDocumento || ''}|${hashSnapshot || ''}`
  const hash = await sha256Hex(payload)
  return {
    papel, nome, hash, algoritmo: 'sha256',
    hash_documento: hashDocumento || null,
    hash_snapshot: hashSnapshot || null,
    timestamp,
  }
}

// ─── Workflow comercial ──────────────────────────────────────────────────────────
export const WORKFLOW_COMERCIAL_CONFIG = {
  EM_ANALISE:         { label: 'EM ANÁLISE',         cor: 'cinza',   ordem: 1 },
  AGUARDANDO_CLIENTE: { label: 'AGUARDANDO CLIENTE', cor: 'azul',    ordem: 2 },
  NEGOCIACAO:         { label: 'NEGOCIAÇÃO',         cor: 'amarelo', ordem: 3 },
  APROVADO:           { label: 'APROVADO',           cor: 'verde',   ordem: 4 },
  REPROVADO:          { label: 'REPROVADO',          cor: 'vermelho',ordem: 4 },
  ASSINADO:           { label: 'ASSINADO',           cor: 'verde',   ordem: 5 },
}

export function getWorkflowConfig(status) {
  return WORKFLOW_COMERCIAL_CONFIG[status] || WORKFLOW_COMERCIAL_CONFIG.EM_ANALISE
}

export const PAPEIS_ASSINATURA = [
  { papel: 'cliente',  label: 'Cliente' },
  { papel: 'vendedor', label: 'Vendedor' },
  { papel: 'tecnico',  label: 'Resp. Técnico' },
]

/**
 * Gera uma assinatura digital simples: hash determinístico de
 * papel+nome+timestamp+contexto. Auditável e verificável.
 */
export function gerarAssinatura({ papel, nome, contextoHash }) {
  const timestamp = new Date().toISOString()
  const hash = hashTecnico(`${papel}|${nome}|${timestamp}|${contextoHash || ''}`)
  return { papel, nome, hash, timestamp }
}

// ─── Snapshot comercial ───────────────────────────────────────────────────────────

/**
 * Constrói o snapshot comercial congelável a partir dos cenários comparados,
 * desconto e referências aos snapshots técnico/financeiro.
 */
export function construirSnapshotComercial({ cenarios, comparacaoTecnologica, cenarioBESS, cenariosTarifarios, descontoPct, snapshotFinanceiro, observacoes }) {
  const snap = {
    criado_em: new Date().toISOString(),
    engineering_version: ENGINEERING_VERSION,
    cenarios: cenarios || null,
    comparacao_tecnologica: comparacaoTecnologica || null,
    cenario_bess: cenarioBESS || null,
    cenarios_tarifarios: cenariosTarifarios || null,
    desconto_pct: descontoPct ?? 0,
    proposta_final: snapshotFinanceiro?.proposta_final ?? null,
    cenario_exibicao: snapshotFinanceiro?.cenario_exibicao ?? 'realista',
    observacoes: observacoes || null,
  }
  snap.hash = hashTecnico(snap)
  return snap
}

// ─── Badges de aprovação ───────────────────────────────────────────────────────────
export const APROVACAO_CONFIG = {
  aprovacao_desconto: { label: 'Desconto', cor: 'amarelo' },
  aprovacao_margem:   { label: 'Margem',   cor: 'laranja' },
  aprovacao_excecao:  { label: 'Exceção',  cor: 'vermelho' },
}

export function getAprovacaoConfig(tipo) {
  return APROVACAO_CONFIG[tipo] || { label: tipo, cor: 'cinza' }
}
