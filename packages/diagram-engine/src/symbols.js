/**
 * symbols.js — Ilustrações técnicas dos componentes (aparência apenas).
 *
 * Os DADOS (corrente, polos, bitola...) vêm SEMPRE do componente (cálculo/BOM).
 * Os símbolos são paramétricos: 1 disjuntor bipolar desenha 2 polos; 1 tripolar, 3;
 * 2 DPS monopolares desenham 2 caixas; nada é fixo na figura.
 */

import { TIPOS } from './model.js'
import { COMPONENTE } from './geometry.js'

const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
const { W, H } = COMPONENTE // caixa nominal de um componente (fonte única: geometry.js)

function caixa(x, y, titulo, linhas, cor = '#1f6fd6') {
  const txt = linhas.map((l, i) => `<text x="${x + W / 2}" y="${y + 52 + i * 14}" font-size="11" text-anchor="middle" fill="#334155">${esc(l)}</text>`).join('')
  return `<g>
    <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="8" fill="#ffffff" stroke="${cor}" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="${W}" height="22" rx="8" fill="${cor}"/>
    <text x="${x + W / 2}" y="${y + 15}" font-size="11" font-weight="bold" text-anchor="middle" fill="#ffffff">${esc(titulo)}</text>
    ${txt}
  </g>`
}

function polosSVG(x, y, n) {
  // desenha n chaves (polos) — bipolar=2, tripolar=3
  let s = ''
  for (let i = 0; i < n; i++) {
    const px = x + 22 + i * 28
    s += `<line x1="${px}" y1="${y + 34}" x2="${px + 14}" y2="${y + 22}" stroke="#334155" stroke-width="2"/>
          <circle cx="${px}" cy="${y + 34}" r="2.5" fill="#334155"/>`
  }
  return s
}

/** Retorna o markup SVG de um componente posicionado em (x,y). */
export function desenharComponente(c, pos) {
  const x = pos?.x ?? 0, y = pos?.y ?? 0
  const s = c.specs || {}
  switch (c.tipo) {
    case TIPOS.REDE:
      return caixa(x, y, 'QD EXISTENTE', [c.label || 'Rede', s.tensao_v ? `${s.tensao_v}V` : ''].filter(Boolean), '#475569')
    case TIPOS.QUADRO:
      return caixa(x, y, 'QUADRO EV', [c.label || 'Proteção EV'], '#0f766e')
    case TIPOS.DISJUNTOR: {
      const n = c.polos || 2
      return `<g>${caixa(x, y, `DISJUNTOR ${n}P`, [s.corrente_a ? `${s.corrente_a}A` : '', s.curva ? `Curva ${s.curva}` : ''].filter(Boolean), '#b45309')}${polosSVG(x, y, n)}</g>`
    }
    case TIPOS.DR:
      return caixa(x, y, `DR ${c.polos || 2}P`, [s.ma ? `${s.ma}mA` : '', s.classe ? `Tipo ${s.classe}` : 'Tipo A'].filter(Boolean), '#7c3aed')
    case TIPOS.DPS:
      return caixa(x, y, `DPS ${c.polos || 1}P`, [s.tensao_v ? `${s.tensao_v}V` : '', 'Classe II'], '#db2777')
    case TIPOS.BARRAMENTO:
      return `<g><rect x="${x}" y="${y + 40}" width="${W}" height="8" rx="3" fill="#a16207"/><text x="${x + W / 2}" y="${y + 30}" font-size="10" text-anchor="middle" fill="#334155">${esc(c.label || 'Barramento')}</text></g>`
    case TIPOS.CABO:
      return caixa(x, y, 'CABO', [s.bitola_mm2 ? `${s.bitola_mm2}mm²` : '', s.comprimento_m ? `${s.comprimento_m}m` : ''].filter(Boolean), '#15803d')
    case TIPOS.ELETRODUTO:
      return caixa(x, y, 'ELETRODUTO', [s.diametro || '', s.material || 'PVC'].filter(Boolean), '#64748b')
    case TIPOS.EQUIPAMENTO:
      return caixa(x, y, (c.subtipo === 'carregador_ev' ? 'CARREGADOR EV' : (c.label || 'EQUIPAMENTO')).toUpperCase().slice(0, 16), [s.potencia_kw ? `${s.potencia_kw}kW` : '', s.corrente_a ? `${s.corrente_a}A` : '', s.conector ? `Tipo ${s.conector}` : ''].filter(Boolean), '#0369a1')
    case TIPOS.CARGA:
      return caixa(x, y, 'VEÍCULO', [c.label || 'EV', s.conector ? `Tipo ${s.conector}` : ''].filter(Boolean), '#1e293b')
    default:
      return caixa(x, y, (c.label || c.tipo).toUpperCase(), [])
  }
}

export const DIM_COMPONENTE = Object.freeze({ W, H })
export { esc }
