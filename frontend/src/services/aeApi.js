/**
 * aeApi — camada ÚNICA de comunicação da tela com a integração AE.
 *
 * Nenhum componente React fala com a API diretamente: sempre via este módulo.
 *
 * A Auditoria Rápida é executada pelo BACKEND do Forte Solar, que por sua vez
 * consome o AE através da porta IAEProvider. O frontend não conhece a origem
 * física do conhecimento técnico (API, diretório, Git, S3) — apenas pede a
 * auditoria e recebe o relatório.
 *
 * O botão "Abrir AE" leva ao Workbench oficial do AE, em nova aba.
 */

// URL relativa: mesmo padrão dos demais serviços do projeto (proxy → backend).
const API = ''

// Base do Workbench do AE. Nunca fixa no código.
const AE_URL = (import.meta.env.VITE_AE_URL || '').replace(/\/+$/, '')

async function requisitar(url, opts) {
  let res
  try {
    res = await fetch(url, opts)
  } catch (err) {
    throw new Error(`Falha de rede: ${err.message}`)
  }
  const corpo = await res.json().catch(() => ({}))
  if (!res.ok || corpo.sucesso === false) {
    const erro = new Error(corpo.erro || `HTTP ${res.status}`)
    erro.codigo = corpo.codigo || null
    throw erro
  }
  return corpo
}

/** O Workbench do AE está configurado? Controla o botão "Abrir AE". */
export function workbenchConfigurado() {
  return AE_URL.length > 0
}

/**
 * Executa a Auditoria Rápida (somente leitura — nada é gravado).
 * @returns {Promise<{resumo: string, relatorio: object}>}
 */
export async function executarAuditoriaRapida() {
  const corpo = await requisitar(`${API}/api/admin/catalogo/auditoria-rapida`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  return { resumo: corpo.resumo, relatorio: corpo.relatorio }
}

/**
 * Aplica as atualizações do AE. ESCRITA.
 *
 * Envia apenas os ids selecionados: o plano é recalculado no servidor, que
 * nunca aceita um plano vindo do cliente.
 *
 * @param {object} opcoes
 * @param {string[]|null} [opcoes.selecionados]  ids; null = todos
 * @param {boolean} [opcoes.incluirNuncaAuditados]
 */
export async function aplicarAtualizacoes({ selecionados = null, incluirNuncaAuditados = false } = {}) {
  const corpo = await requisitar(`${API}/api/admin/catalogo/auditoria-rapida/aplicar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selecionados, incluirNuncaAuditados }),
  })
  return corpo.resultado
}

/**
 * URL do Workbench oficial do AE. Configurável via VITE_AE_WORKBENCH_URL
 * (template com {auditId}); default {VITE_AE_URL}/workbench.
 *
 * @param {string} [auditId]
 */
export function urlWorkbench(auditId) {
  const tpl = import.meta.env.VITE_AE_WORKBENCH_URL
  if (tpl) return tpl.replace('{auditId}', encodeURIComponent(auditId || ''))
  return auditId ? `${AE_URL}/workbench/${encodeURIComponent(auditId)}` : `${AE_URL}/workbench`
}

/** Rótulos das famílias mantidas pelo AE, na ordem do relatório. */
export const FAMILIAS_AE = [
  { chave: 'modulo', rotulo: 'Módulos' },
  { chave: 'inversor', rotulo: 'Inversores' },
  { chave: 'carregador_ev', rotulo: 'Carregadores' },
  { chave: 'bateria', rotulo: 'Baterias' },
]
