/**
 * catalogoEngenhariaApi.js — Sprint 8.1
 * Acesso ao catálogo Mongo como fonte de engenharia, com auditoria de fallback.
 */
const API = ''

export async function buscarEquipamentosEngenharia(tipo, incluirBloqueados = false) {
  const qs = new URLSearchParams({ tipo, ...(incluirBloqueados ? { incluir_bloqueados: 'true' } : {}) }).toString()
  const res = await fetch(`${API}/api/equipamentos/engenharia?${qs}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const d = await res.json()
  return d.equipamentos || []
}

/** Registra o acionamento do fallback (base local) na trilha de auditoria. */
export function registrarFallback(tipo, erro) {
  try {
    fetch(`${API}/api/painel/evento`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'FALLBACK_CATALOGO_ACIONADO', modulo: 'catalogo', detalhe: `${tipo}: ${erro || 'catálogo indisponível'}` }),
    }).catch(() => {})
  } catch { /* silencioso */ }
}
