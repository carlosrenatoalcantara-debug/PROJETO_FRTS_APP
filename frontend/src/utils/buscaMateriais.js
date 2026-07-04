/**
 * buscaMateriais.js — FEATURE-002 ITEM 4: busca inteligente do Catálogo de Materiais.
 *
 * Considera: nome/descrição, categoria, sinônimos, especificações (bitola/tipo) e
 * equivalência polegadas ↔ milímetros (ex.: 3/4" ↔ 25 mm e vice-versa).
 * Pure (sem I/O) para ser testável.
 */

// Equivalência polegada ↔ mm (eletrodutos/condutos — padrão Forte Solar).
const POL_MM = [
  ['1/2', '20'], ['3/4', '25'], ['1', '32'], ['1.1/4', '40'], ['1 1/4', '40'],
  ['1.1/2', '50'], ['1 1/2', '50'], ['2', '60'], ['2.1/2', '75'], ['3', '85'],
]

export function normalizar(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove acentos
    .replace(/["”]/g, '')                          // aspas de polegada
    .replace(/\s+/g, ' ')
    .trim()
}

/** Texto pesquisável de um material (descrição + categoria + sinônimos + especificações). */
export function textoMaterial(m = {}) {
  const especs = Array.isArray(m.especificacoes)
    ? m.especificacoes.map((e) => `${e?.chave ?? ''} ${e?.valor ?? ''}`).join(' ')
    : ''
  const sin = Array.isArray(m.sinonimos) ? m.sinonimos.join(' ') : (m.sinonimos || '')
  return normalizar([m.descricao, m.categoria, m.classe, m.unidade, sin, especs].filter(Boolean).join(' '))
}

/** Expande um termo com equivalências polegada↔mm (bidirecional). */
export function expandirTermo(termo) {
  const t = normalizar(termo)
  const out = new Set([t])
  for (const [pol, mm] of POL_MM) {
    const p = normalizar(pol)
    // polegada exata → mm  (e o inverso)
    if (t === p) out.add(mm)
    if (t === mm || t === `${mm}mm` || t === `${mm} mm`) { out.add(p); out.add(`${mm}mm`) }
    // termo composto (ex.: "eletroduto 3/4" ou "eletroduto 25mm")
    if (p.includes('/') && t.includes(p)) out.add(t.replace(p, mm))
    if (t.includes(mm) && /\d/.test(mm)) out.add(t.replace(mm, p))
  }
  return [...out].filter(Boolean)
}

/**
 * Filtra e ordena materiais por relevância à query. Vazio → lista original (limitada).
 * @param {Array} materiais catálogo (itens do Cadastro de Materiais)
 * @param {string} query    texto digitado pelo usuário
 * @param {number} limite   máx. de resultados
 */
export function filtrarMateriais(materiais = [], query = '', limite = 20) {
  const q = normalizar(query)
  if (!q) return materiais.slice(0, limite)
  const termos = q.split(' ').filter(Boolean)
  // cada termo expandido em suas equivalências (qualquer uma satisfaz o termo)
  const termosExpandidos = termos.map((t) => expandirTermo(t))

  const ranqueados = []
  for (const m of materiais) {
    const texto = textoMaterial(m)
    let ok = true
    let score = 0
    for (const alternativas of termosExpandidos) {
      const casou = alternativas.some((a) => a && texto.includes(a))
      if (!casou) { ok = false; break }
      // pontua início de palavra mais alto
      if (alternativas.some((a) => texto.startsWith(a))) score += 3
      else score += 1
    }
    if (ok) ranqueados.push({ m, score })
  }
  ranqueados.sort((a, b) => b.score - a.score || String(a.m.descricao).localeCompare(String(b.m.descricao)))
  return ranqueados.slice(0, limite).map((x) => x.m)
}

export default { filtrarMateriais, normalizar, textoMaterial, expandirTermo }
