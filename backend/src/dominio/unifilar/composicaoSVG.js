/**
 * composicaoSVG.js — empilhamento dos blocos de unifilar — F14-6B.
 *
 * Um arranjo, um diagrama. Este módulo NÃO desenha: recebe os SVGs que os
 * motores já produziram e os compõe num documento só, cada um sob a sua faixa
 * de identificação.
 *
 * ── Por que empilhar em vez de redesenhar ───────────────────────────────────
 * A decisão da sprint é explícita: não reescrever o unifilar. Os motores
 * (`gerarUnifilarSVG`, `gerarUnifilarMicroSVG`) continuam sendo a única fonte
 * do traço, byte a byte. O que faltava era o documento aceitar mais de um.
 *
 * ── Ids ─────────────────────────────────────────────────────────────────────
 * Cada bloco declara `id="arr"` (o marker de seta) no seu próprio `<defs>`.
 * Num documento só, ids repetidos fazem toda referência resolver para o
 * primeiro. Aqui cada bloco recebe sufixo próprio, e as referências junto.
 */

const FAIXA_H = 44
const GAP = 28

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

/** Separa um SVG completo em dimensões + corpo, sem reinterpretar o desenho. */
function desmontar(svg) {
  const texto = String(svg ?? '').replace(/<\?xml[^>]*\?>\s*/i, '')
  const abertura = texto.match(/<svg\b[^>]*>/i)
  if (!abertura) return null
  const vb = abertura[0].match(/viewBox="\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*"/i)
  const w = vb ? Number(vb[1]) : Number((abertura[0].match(/width="([\d.]+)"/i) ?? [])[1])
  const h = vb ? Number(vb[2]) : Number((abertura[0].match(/height="([\d.]+)"/i) ?? [])[1])
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null
  const fim = texto.lastIndexOf('</svg>')
  if (fim < 0) return null
  return { w, h, corpo: texto.slice(abertura.index + abertura[0].length, fim) }
}

/** Sufixa todo id declarado no bloco e as referências a ele. */
function isolarIds(corpo, sufixo) {
  const ids = [...new Set([...corpo.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]
  let saida = corpo
  for (const id of ids) {
    const e = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    saida = saida
      .replace(new RegExp(`(\\sid=")${e}(")`, 'g'), `$1${id}${sufixo}$2`)
      .replace(new RegExp(`url\\(#${e}\\)`, 'g'), `url(#${id}${sufixo})`)
      .replace(new RegExp(`(href=")#${e}(")`, 'g'), `$1#${id}${sufixo}$2`)
  }
  return saida
}

/**
 * Compõe os blocos num documento único, empilhados verticalmente.
 *
 * @param {Array<{titulo: string, subtitulo?: string, svg: string}>} blocos
 * @returns {string|null} SVG composto; `null` se nenhum bloco for legível.
 */
export function comporUnifilarMultiarranjo(blocos = []) {
  const partes = []
  let y = 0
  let W = 0

  for (const [i, b] of blocos.entries()) {
    const d = desmontar(b?.svg)
    if (!d) continue
    W = Math.max(W, d.w)
    const corpo = isolarIds(d.corpo, `__a${i}`)
    partes.push(`  <g transform="translate(0,${y})">
    <rect x="0" y="0" width="${d.w}" height="${FAIXA_H}" fill="#0f172a"/>
    <text x="20" y="28" fill="#ffffff" font-size="17" font-weight="bold">${esc(b?.titulo)}</text>${
  b?.subtitulo ? `\n    <text x="${d.w - 20}" y="28" fill="#cbd5e1" font-size="13" text-anchor="end">${esc(b.subtitulo)}</text>` : ''}
    <g transform="translate(0,${FAIXA_H})">${corpo}</g>
  </g>`)
    y += FAIXA_H + d.h + GAP
  }

  if (partes.length === 0) return null
  const H = Math.max(0, y - GAP)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial,Helvetica,sans-serif">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
${partes.join('\n')}
</svg>`
}

export default comporUnifilarMultiarranjo
