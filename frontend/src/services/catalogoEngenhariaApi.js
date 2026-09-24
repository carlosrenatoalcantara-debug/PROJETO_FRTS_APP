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

/**
 * F-03 — reidratação do equipamento pela referência ao SSOT.
 *
 * O projeto persiste referência (`equipamento_id`) mais uma cópia mínima —
 * marca, modelo, potência. O ENVELOPE elétrico (Voc, Vmpp, Isc, coeficiente
 * térmico, janela MPPT) não é copiado de propósito: ele pertence ao catálogo e
 * pode ser corrigido lá. Ao reabrir o projeto, quem precisa do envelope o busca
 * de volta aqui, pela referência, e passa pelo MESMO adapter da seleção — de
 * modo que o objeto reidratado é indistinguível de um recém-selecionado, e o
 * motor recebe exatamente a mesma entrada antes e depois do reload.
 *
 * Sem referência, ou com o equipamento removido do catálogo, devolve `null`: a
 * tela mostra a lacuna em vez de inventar um envelope.
 */
export async function reidratarEquipamento(referencia) {
  if (!referencia) return null
  const id = String(referencia)
  if (!/^[0-9a-f]{24}$/i.test(id)) return null   // id do catálogo local, não do SSOT
  try {
    const res = await fetch(`${API}/api/equipamentos/${id}`)
    if (!res.ok) return null
    const d = await res.json()
    return d?.equipamento ?? d?.dados ?? d ?? null
  } catch {
    return null
  }
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
