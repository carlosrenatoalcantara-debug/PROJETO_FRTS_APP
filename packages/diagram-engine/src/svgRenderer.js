/**
 * svgRenderer.js — Renderizador SVG ÚNICO (modelo executivo A4 paisagem).
 *
 * Lê o JSON canônico (mesma fonte do React Flow e do PDF) e produz a string SVG.
 * Backend (PDFKit), frontend (preview/impressão) e o EDITOR usam ESTE renderizador.
 *
 * Toda a GEOMETRIA vem de geometry.js (fonte única). As posições do diagrama já
 * estão em coordenadas finais A4 — o renderer NÃO aplica deslocamento próprio, de
 * modo que o React Flow possa sobrepor os componentes no MESMO sistema de coords.
 *
 * opts.incluirDiagrama=false → desenha só o "chrome" (cabeçalho, blocos, BOM, notas,
 * moldura, QR), deixando a região do diagrama vazia para o Editor preencher com os
 * mesmos símbolos. É o que garante UM só layout para SVG, PDF e Editor.
 */

import { CORES_CONDUTOR, PAPEL_CONEXAO } from './model.js'
import { desenharComponente, larguraComponente } from './symbols.js'
import { A4, BLOCOS, COMPONENTE, COND_GAP, DIAGRAM_BOX } from './geometry.js'

const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))

function bandaCabecalho(meta) {
  const b = BLOCOS.HEADER
  return `
  <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="40" y="50" font-size="20" font-weight="bold" fill="#0f766e">Forte Solar</text>
  <text x="${A4.W / 2}" y="46" font-size="16" font-weight="bold" text-anchor="middle" fill="#0f172a">DIAGRAMA UNIFILAR</text>
  <text x="${A4.W / 2}" y="66" font-size="11" text-anchor="middle" fill="#475569">${esc(meta.projeto || '')}</text>
  <text x="${A4.W - 40}" y="42" font-size="10" text-anchor="end" fill="#475569">${esc(meta.cidade || '')}</text>
  <text x="${A4.W - 40}" y="58" font-size="10" text-anchor="end" fill="#475569">${esc(meta.data || '')}</text>
  <text x="${A4.W - 40}" y="74" font-size="10" text-anchor="end" fill="#475569">RT: ${esc(meta.rt?.nome || '')} ${esc(meta.rt?.registro || '')}</text>`
}

function blocoDados(rect, titulo, pares) {
  const { x, y, w } = rect
  const linhas = pares.map((p, i) => `<text x="${x + 10}" y="${y + 40 + i * 16}" font-size="10" fill="#334155"><tspan font-weight="bold">${esc(p[0])}:</tspan> ${esc(p[1] ?? '')}</text>`).join('')
  const h = 32 + pares.length * 16
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#ffffff" stroke="#cbd5e1"/>
    <rect x="${x}" y="${y}" width="${w}" height="22" rx="6" fill="#0f766e"/>
    <text x="${x + w / 2}" y="${y + 15}" font-size="11" font-weight="bold" text-anchor="middle" fill="#fff">${esc(titulo)}</text>
    ${linhas}
  </g>`
}

// BUG-021: o ponto de conexão fica no centro da LARGURA REAL do símbolo (não da caixa
// nominal 120). Assim o fio do Terra sai do centro do símbolo de aterramento compacto —
// e não de um ponto 24px à direita (onde ficava o centro da caixa 120 antiga).
function centro(pos, comp) {
  const w = comp ? larguraComponente(comp) : COMPONENTE.W
  return { cx: (pos?.x ?? 0) + w / 2, cy: (pos?.y ?? 0) + COMPONENTE.H / 2 }
}

// FEATURE-005: seta colorida no meio do condutor indicando o SENTIDO da energia
// (from → to). A cor acompanha o papel do condutor (fase/neutro/terra).
function setaSentido(ax, ay, bx, by, cor) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2
  const ang = Math.atan2(by - ay, bx - ax)
  const t = 6, base = 2.4
  const tipx = mx + t * Math.cos(ang), tipy = my + t * Math.sin(ang)
  const b1x = mx - t * Math.cos(ang) + base * Math.cos(ang + Math.PI / 2)
  const b1y = my - t * Math.sin(ang) + base * Math.sin(ang + Math.PI / 2)
  const b2x = mx - t * Math.cos(ang) - base * Math.cos(ang + Math.PI / 2)
  const b2y = my - t * Math.sin(ang) - base * Math.sin(ang + Math.PI / 2)
  const stroke = cor === '#ffffff' ? ' stroke="#94a3b8" stroke-width="0.6"' : ''
  return `<path d="M${tipx.toFixed(1)},${tipy.toFixed(1)} L${b1x.toFixed(1)},${b1y.toFixed(1)} L${b2x.toFixed(1)},${b2y.toFixed(1)} Z" fill="${cor}"${stroke}/>`
}

function desenharConexoes(connections, layout, byId = new Map()) {
  let s = ''
  for (const cx of connections) {
    // Ajuste homologado: quando o componente derivado (ex.: DPS) já tem sua própria
    // seta indicando o condutor de origem, a linha reta centro-a-centro sobreporia o
    // tronco principal (ambos passam pela mesma fileira). `ocultarLinha` suprime só o
    // traço/seta desta ligação — a ligação em si continua no modelo (topologia/BOM).
    if (cx.specs?.ocultarLinha) continue
    const a = centro(layout[cx.from], byId.get(cx.from)); const b = centro(layout[cx.to], byId.get(cx.to))
    const condutores = cx.condutores?.length ? cx.condutores : [{ papel: 'fase' }]
    const tracejado = cx.papel === PAPEL_CONEXAO.DERIVACAO
    condutores.forEach((cond, i) => {
      const off = (i - (condutores.length - 1) / 2) * COND_GAP
      const cor = CORES_CONDUTOR[cond.papel] || '#555'
      const stroke = cor === '#ffffff' ? '#ffffff' : cor
      const contorno = cor === '#ffffff' ? ' stroke-opacity="1" filter="url(#br)"' : ''
      s += `<polyline points="${a.cx},${a.cy + off} ${b.cx},${b.cy + off}" fill="none" stroke="${stroke}" stroke-width="2"${tracejado ? ' stroke-dasharray="6 4"' : ''}${contorno}/>`
      s += setaSentido(a.cx, a.cy + off, b.cx, b.cy + off, stroke)
    })
  }
  return s
}

// FEATURE-005: legenda didática das cores de condutor (Fase / Neutro / Terra).
function legendaCondutores() {
  const itens = [['Fase', CORES_CONDUTOR.fase], ['Neutro', CORES_CONDUTOR.neutro], ['Terra', CORES_CONDUTOR.terra]]
  const x = DIAGRAM_BOX.x + 6, y = DIAGRAM_BOX.y + DIAGRAM_BOX.h - 20
  const linhas = itens.map(([nome, cor], i) => {
    const lx = x + 8 + i * 92
    return `<line x1="${lx}" y1="${y + 8}" x2="${lx + 18}" y2="${y + 8}" stroke="${cor}" stroke-width="3"/>
      <path d="M${lx + 20},${y + 8} l-5,-2.4 v4.8 z" fill="${cor}"/>
      <text x="${lx + 26}" y="${y + 11}" font-size="9" fill="#334155">${nome}</text>`
  }).join('')
  return `<g><rect x="${x}" y="${y - 4}" width="286" height="24" rx="5" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="${x + 8}" y="${y + 11}" font-size="8" font-weight="bold" fill="#94a3b8" opacity="0"> </text>${linhas}</g>`
}

function tabelaBOM(rect, bom = []) {
  const { x, y, w } = rect
  const linhas = bom.slice(0, 14).map((m, i) => {
    const desc = m.item || m.descricao || ''
    const espec = m.especificacao ? ` (${m.especificacao})` : ''
    return `<text x="${x + 8}" y="${y + 40 + i * 15}" font-size="9" fill="#334155">${esc(`${String(i + 1).padStart(2, '0')}. ${desc}${espec}`).slice(0, 70)}</text>
            <text x="${x + w - 20}" y="${y + 40 + i * 15}" font-size="9" text-anchor="end" fill="#334155">${esc(`${m.quantidade ?? ''} ${m.unidade ?? ''}`)}</text>`
  }).join('')
  const h = 32 + Math.min(bom.length, 14) * 15
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#ffffff" stroke="#cbd5e1"/>
    <rect x="${x}" y="${y}" width="${w}" height="22" rx="6" fill="#0f766e"/>
    <text x="${x + w / 2}" y="${y + 15}" font-size="11" font-weight="bold" text-anchor="middle" fill="#fff">LISTA DE MATERIAIS</text>
    ${linhas}
  </g>`
}

function blocoNotas(rect, normas = []) {
  const { x, y, w } = rect
  const linhas = normas.slice(0, 8).map((n, i) => `<text x="${x + 8}" y="${y + 38 + i * 14}" font-size="9" fill="#334155">• ${esc(n)}</text>`).join('')
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${28 + Math.min(normas.length, 8) * 14}" rx="6" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="${x + 8}" y="${y + 18}" font-size="10" font-weight="bold" fill="#0f766e">NOTAS TÉCNICAS E NORMATIVAS</text>
    ${linhas}
  </g>`
}

/** Grupo do diagrama (componentes + conexões). Mesmas coords do Editor. */
export function grupoDiagrama(canonical) {
  const { components = [], connections = [], layout = {} } = canonical || {}
  const byId = new Map(components.map(c => [c.id, c]))
  return `<g class="diagrama">
    ${desenharConexoes(connections, layout, byId)}
    ${components.map(c => desenharComponente(c, layout[c.id])).join('')}
    ${legendaCondutores()}
  </g>`
}

/**
 * renderSVG — canonical → string SVG executiva (A4 paisagem).
 * @param {object} canonical
 * @param {object} [opts]
 * @param {boolean} [opts.incluirDiagrama=true]  false = só o chrome (fundo do Editor)
 */
export function renderSVG(canonical, opts = {}) {
  const { metadata = {} } = canonical || {}
  const m = metadata
  const eq = m.equipamento || {}
  const incluirDiagrama = opts.incluirDiagrama !== false
  const normas = m.normas || ['NBR 5410', 'NBR 17019', 'IEC 61851', 'IEC 62196']

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${A4.W} ${A4.H}" width="${opts.width || A4.W}" height="${opts.height || A4.H}">
  <defs><filter id="br"><feFlood flood-color="#94a3b8"/><feComposite in2="SourceGraphic" operator="out"/></filter></defs>
  <rect x="0" y="0" width="${A4.W}" height="${A4.H}" fill="#ffffff"/>
  ${bandaCabecalho(m)}
  ${blocoDados(BLOCOS.CLIENTE, 'DADOS DO CLIENTE', [
    ['Nome', m.cliente], ['CPF/CNPJ', m.cpf], ['Endereço', m.endereco],
    ['UC', m.uc], ['Concessionária', m.concessionaria], ['Carga instalada', m.carga_instalada],
  ])}
  ${blocoDados(BLOCOS.EQUIP, 'CARREGADOR / EQUIPAMENTO', [
    ['Modelo', eq.modelo], ['Fabricante', eq.fabricante], ['Potência', eq.potencia],
    ['Corrente', eq.corrente], ['Tensão', eq.tensao], ['Conector', eq.conector],
  ])}
  ${incluirDiagrama ? grupoDiagrama(canonical) : ''}
  ${tabelaBOM(BLOCOS.BOM, m.bom)}
  ${blocoNotas(BLOCOS.NOTAS, normas)}
  <rect x="${BLOCOS.QR.x}" y="${BLOCOS.QR.y}" width="${BLOCOS.QR.w}" height="${BLOCOS.QR.h}" rx="6" fill="#fff" stroke="#cbd5e1"/>
  <text x="${BLOCOS.QR.x + BLOCOS.QR.w / 2}" y="${BLOCOS.QR.y + BLOCOS.QR.h / 2 + 4}" font-size="9" text-anchor="middle" fill="#94a3b8">QR DO PROJETO</text>
</svg>`
}

export { A4 }
