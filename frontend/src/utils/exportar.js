/**
 * exportar.js — Sprint 7.3
 * Exportações leves client-side (CSV / Excel-compatível). PDF de telas via print.
 */

function baixar(conteudo, nome, mime) {
  const blob = new Blob([conteudo], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const escapar = (v) => {
  if (v == null) return ''
  const s = String(typeof v === 'object' ? JSON.stringify(v) : v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Exporta um array de objetos como CSV (abre direto no Excel).
 * @param {Array<object>} linhas
 * @param {string} nomeArquivo  (sem extensão)
 * @param {Array<{chave,rotulo}>} [colunas]  — se omitido, usa as chaves do 1º item
 */
export function exportarCSV(linhas, nomeArquivo = 'export', colunas = null) {
  if (!Array.isArray(linhas) || linhas.length === 0) { baixar('', `${nomeArquivo}.csv`, 'text/csv'); return }
  const cols = colunas || Object.keys(linhas[0]).map((k) => ({ chave: k, rotulo: k }))
  const cabec = cols.map((c) => escapar(c.rotulo)).join(';')
  const corpo = linhas.map((l) => cols.map((c) => escapar(l[c.chave])).join(';')).join('\n')
  // BOM p/ acentuação correta no Excel
  baixar('﻿' + cabec + '\n' + corpo, `${nomeArquivo}.csv`, 'text/csv;charset=utf-8')
}

/** Exporta como .xls (HTML table — abre no Excel). */
export function exportarExcel(linhas, nomeArquivo = 'export', colunas = null) {
  if (!Array.isArray(linhas) || linhas.length === 0) return
  const cols = colunas || Object.keys(linhas[0]).map((k) => ({ chave: k, rotulo: k }))
  const th = cols.map((c) => `<th>${c.rotulo}</th>`).join('')
  const trs = linhas.map((l) => `<tr>${cols.map((c) => `<td>${l[c.chave] ?? ''}</td>`).join('')}</tr>`).join('')
  const html = `<html><head><meta charset="utf-8"></head><body><table border="1">${`<tr>${th}</tr>`}${trs}</table></body></html>`
  baixar('﻿' + html, `${nomeArquivo}.xls`, 'application/vnd.ms-excel')
}

/** Exporta a tela atual em PDF via diálogo de impressão do navegador. */
export function exportarPDFImpressao() {
  window.print()
}
