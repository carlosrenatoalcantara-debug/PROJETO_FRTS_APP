/**
 * Monta as consultas de geocodificação a partir do cadastro (rua + número +
 * cidade + UF + CEP). Puro, sem I/O. Antes só a rua/número ia para a busca e
 * ela falhava mesmo com CEP e cidade no cadastro.
 */
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const limpo = (s) => String(s ?? '').trim()

export function formatarCep(cep) {
  const d = String(cep ?? '').replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : ''
}

/** Acrescenta só o que o texto ainda não contém (evita "Natal, Natal, RN"). */
function juntar(base, partes) {
  let texto = limpo(base)
  for (const p of partes.map(limpo).filter(Boolean)) {
    const ja = p.length <= 2
      ? new RegExp(`(^|[^a-z])${norm(p)}([^a-z]|$)`).test(norm(texto))
      : norm(texto).includes(norm(p))
    if (!ja) texto = texto ? `${texto}, ${p}` : p
  }
  return texto
}

/**
 * Lista de consultas, da mais específica para a mais ampla, sem repetição.
 * @param {{endereco?:string, cidade?:string, uf?:string, cep?:string}} d
 * @returns {string[]}  vazia quando não há nada para buscar
 */
export function montarConsultasEndereco({ endereco, cidade, uf, cep } = {}) {
  const cepFmt = formatarCep(cep)
  const lista = [
    juntar(endereco, [cidade, uf, cepFmt]),
    juntar('', [cepFmt, cidade, uf]),
    juntar('', [cidade, uf]),
  ].filter((q) => q.length >= 3)
  return [...new Set(lista)]
}
