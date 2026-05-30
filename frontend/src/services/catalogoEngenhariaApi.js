const API = ''

export async function buscarEquipamentosEngenharia(tipo, incluirBloqueados = false) {
  const qs = new URLSearchParams({ tipo, ...(incluirBloqueados ? { incluir_bloqueados: 'true' } : {}) }).toString()
  const res = await fetch(`${API}/api/equipamentos/engenharia?${qs}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const d = await res.json()
  return d.equipamentos || []
}

export function registrarFallback(tipo, erro) {
  try {
    fetch(`${API}/api/painel/evento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'AUDITORIA_FALLBACK',
        modulo: 'catalogo',
        detalhe: `${tipo}: ${erro || 'fallback_acionado'}`,
      }),
    }).catch(() => {})
  } catch {
    // silencioso
  }
}
