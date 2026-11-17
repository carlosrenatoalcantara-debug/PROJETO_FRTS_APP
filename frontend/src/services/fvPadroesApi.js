/**
 * fvPadroesApi.js — padrões do módulo FV da EMPRESA (singleton EmpresaConfig).
 * Mesmo padrão de politicaComercialApi.js. URL relativa (proxy Vercel→Railway).
 */
async function _f(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.mensagem || e.erro || `HTTP ${res.status}`)
  }
  return res.json()
}

/** `{ eficiencia_padrao: number|null }`. Falha de rede propaga — quem usa decide o fallback. */
export async function buscarFvPadroes() {
  const d = await _f('/api/empresa')
  const v = d?.config?.fv_padroes?.eficiencia_padrao
  return { eficiencia_padrao: typeof v === 'number' ? v : null }
}

/** `eficiencia_padrao: null` limpa e volta ao padrão do sistema. */
export function salvarFvPadroes(fv_padroes) {
  return _f('/api/empresa', { method: 'PUT', body: JSON.stringify({ fv_padroes }) })
}

/** Leitura tolerante para telas de projeto: sem configuração/rede devolve `null`. */
export async function eficienciaPadraoConfigurada() {
  try {
    return (await buscarFvPadroes()).eficiencia_padrao
  } catch {
    return null
  }
}
