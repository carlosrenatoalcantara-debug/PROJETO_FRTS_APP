/**
 * estados/ — máquina de estados do Projeto FV (fonte única, FV-UX-006 / F3.1).
 *
 *   cicloVida        → `status` na raiz do documento
 *   workflowComercial→ `governanca.comercial.workflow_status` (+ status jurídico)
 *   governancaFreeze → `governanca.freeze_status`
 *   orcamento        → estado do Orçamento (FV-DOM-001)
 *
 * A consolidação destas três em UMA máquina canônica é a F3.6 — não é este módulo.
 * Aqui elas apenas deixam de existir em cópias espalhadas.
 */
export * from './cicloVida.js'
export * from './workflowComercial.js'
export * from './governancaFreeze.js'
export * from './orcamento.js'
export * from './congelamento.js'
