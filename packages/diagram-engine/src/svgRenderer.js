/**
 * svgRenderer.js — Renderizador SVG ÚNICO (modelo executivo A4 paisagem).
 *
 * Lê o JSON canônico (mesma fonte do React Flow e do PDF) e produz a string SVG.
 * Backend (PDFKit) e frontend (preview/impressão) usam ESTE renderizador — sem
 * motores paralelos. Todos os valores são dinâmicos (vêm de components/metadata).
 */

import { CORES_CONDUTOR, PAPEL_CONEXAO } from './model.js'
import { desenharComponente, DIM_COMPONENTE, esc } from './symbols.js'

const A4 = Object.freeze({ W: 1123, H: 794 }) // A4 paisagem @ ~96dpi

function bandaCabecalho(meta) {
  return `
  <rect x="20" y="20" width="${A4.W - 40}" height="70" rx="6" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="40" y="50" font-size="20" font-weight="bold" fill="#0f766e">Forte Solar</text>
  <text x="${A4.W / 2}" y="46" font-size="16" font-weight="bold" text-anchor="middle" fill="#0f172a">DIAGRAMA UNIFILAR</text>
  <text x="${A4.W / 2}" y="66" font-size="11" text-anchor="middle" fill="#475569">${esc(meta.projeto || '')}</text>
  <text x="${A4.W - 40}" y="42" font-size="10" text-anchor="end" fill="#475569">${esc(meta.cidade || '')}</text>
  <text x="${A4.W - 40}" y="58" font-size="10" text-anchor="end" fill="#475569">${esc(meta.data || '')}</text>
  <text x="${A4.W - 40}" y="74" font-size="10" text-anchor="end" fill="#475569">RT: ${esc(meta.rt?.nome || '')} ${esc(meta.rt?.registro || '')}</text>`
}

function blocoDados(x, y, titulo, pares) {
  const linhas = pares.map((p, i) => `<text x="${x + 10}" y="${y + 40 + i * 16}" font-size="10" fill="#334155"><tspan font-weight="bold">${esc(p[0])}:</tspan> ${esc(p[1] ?? '')}</text>`).join('')
  const h = 32 + pares.length * 16
  return `<g>
    <rect x="${x}" y="${y}" width="320" height="${h}" rx="6" fill="#ffffff" stroke="#cbd5e1"/>
    <rect x="${x}" y="${y}" width="320" height="22" rx="6" fill="#0f766e"/>
    <text x="${x + 160}" y="${y + 15}" font-size="11" font-weight="bold" text-anchor="middle" fill="#fff">${esc(titulo)}</text>
    ${linhas}
  </g>`
}

function centro(pos) { return { cx: (pos?.x ?? 0) + DIM_COMPONENTE.W / 2, cy: (pos?.y ?? 0) + DIM_COMPONENTE.H / 2 } }

function desenharConexoes(connections, layout) {
  let s = ''
  for (const cx of connections) {
    const a = centro(layout[cx.from]); const b = centro(layout[cx.to])
    const condutores = cx.condutores?.length ? cx.condutores : [{ papel: 'fase' }]
    const tracejado = cx.papel === PAPEL_CONEXAO.DERIVACAO
    condutores.forEach((cond, i) => {
      const off = (i - (condutores.length - 1) / 2) * 4
      const cor = CORES_CONDUTOR[cond.papel] || '#555'
      const stroke = cor === '#ffffff' ? '#ffffff' : cor
      const contorno = cor === '#ffffff' ? ' stroke-opacity="1" filter="url(#br)"' : ''
      s += `<polyline points="${a.cx},${a.cy + off} ${b.cx},${b.cy + off}" fill="none" stroke="${stroke}" stroke-width="2"${tracejado ? ' stroke-dasharray="6 4"' : ''}${contorno}/>`
    })
  }
  return s
}

function tabelaBOM(x, y, bom = []) {
  const linhas = bom.slice(0, 14).map((m, i) => {
    const desc = m.item || m.descricao || ''
    const espec = m.especificacao ? ` (${m.especificacao})` : ''
    return `<text x="${x + 8}" y="${y + 40 + i * 15}" font-size="9" fill="#334155">${esc(`${String(i + 1).padStart(2, '0')}. ${desc}${espec}`).slice(0, 70)}</text>
            <text x="${x + 300}" y="${y + 40 + i * 15}" font-size="9" text-anchor="end" fill="#334155">${esc(`${m.quantidade ?? ''} ${m.unidade ?? ''}`)}</text>`
  }).join('')
  const h = 32 + Math.min(bom.length, 14) * 15
  return `<g>
    <rect x="${x}" y="${y}" width="320" height="${h}" rx="6" fill="#ffffff" stroke="#cbd5e1"/>
    <rect x="${x}" y="${y}" width="320" height="22" rx="6" fill="#0f766e"/>
    <text x="${x + 160}" y="${y + 15}" font-size="11" font-weight="bold" text-anchor="middle" fill="#fff">LISTA DE MATERIAIS</text>
    ${linhas}
  </g>`
}

function blocoNotas(x, y, normas = []) {
  const linhas = normas.slice(0, 8).map((n, i) => `<text x="${x + 8}" y="${y + 38 + i * 14}" font-size="9" fill="#334155">• ${esc(n)}</text>`).join('')
  return `<g>
    <rect x="${x}" y="${y}" width="${A4.W - 40 - x}" height="${28 + Math.min(normas.length, 8) * 14}" rx="6" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="${x + 8}" y="${y + 18}" font-size="10" font-weight="bold" fill="#0f766e">NOTAS TÉCNICAS E NORMATIVAS</text>
    ${linhas}
  </g>`
}

/**
 * renderSVG — canonical → string SVG executiva (A4 paisagem).
 * @param {object} canonical  saída de build()
 * @param {object} [opts]
 */
export function renderSVG(canonical, opts = {}) {
  const { components = [], connections = [], layout = {}, metadata = {} } = canonical || {}
  const m = metadata
  const eq = m.equipamento || {}

  // Faixa do diagrama deslocada para baixo dos blocos de dados.
  const OFFSET_Y = 250
  const layoutDeslocado = {}
  for (const [id, p] of Object.entries(layout)) layoutDeslocado[id] = { x: p.x, y: (p.y ?? 0) - 120 + OFFSET_Y }

  const diagrama = `<g>
    ${desenharConexoes(connections, layoutDeslocado)}
    ${components.map(c => desenharComponente(c, layoutDeslocado[c.id])).join('')}
  </g>`

  const normas = m.normas || ['NBR 5410', 'NBR 17019', 'IEC 61851', 'IEC 62196']
  const bomY = 470

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${A4.W} ${A4.H}" width="${opts.width || A4.W}" height="${opts.height || A4.H}">
  <defs><filter id="br"><feFlood flood-color="#94a3b8"/><feComposite in2="SourceGraphic" operator="out"/></filter></defs>
  <rect x="0" y="0" width="${A4.W}" height="${A4.H}" fill="#f1f5f9"/>
  ${bandaCabecalho(m)}
  ${blocoDados(20, 100, 'DADOS DO CLIENTE', [
    ['Nome', m.cliente], ['CPF/CNPJ', m.cpf], ['Endereço', m.endereco],
    ['UC', m.uc], ['Concessionária', m.concessionaria], ['Carga instalada', m.carga_instalada],
  ])}
  ${blocoDados(360, 100, 'CARREGADOR / EQUIPAMENTO', [
    ['Modelo', eq.modelo], ['Fabricante', eq.fabricante], ['Potência', eq.potencia],
    ['Corrente', eq.corrente], ['Tensão', eq.tensao], ['Conector', eq.conector],
  ])}
  ${diagrama}
  ${tabelaBOM(20, bomY, m.bom)}
  ${blocoNotas(360, bomY, normas)}
  <rect x="${A4.W - 180}" y="${A4.H - 130}" width="120" height="120" rx="6" fill="#fff" stroke="#cbd5e1"/>
  <text x="${A4.W - 120}" y="${A4.H - 66}" font-size="9" text-anchor="middle" fill="#94a3b8">QR DO PROJETO</text>
</svg>`
}

export { A4 }
