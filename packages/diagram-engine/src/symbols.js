/**
 * symbols.js — Ilustrações técnicas dos componentes (aparência apenas).
 *
 * Os DADOS (corrente, polos, bitola...) vêm SEMPRE do componente (cálculo/BOM).
 * Os símbolos são paramétricos: 1 disjuntor bipolar desenha 2 polos; 1 tripolar, 3;
 * 2 DPS monopolares desenham 2 caixas; nada é fixo na figura.
 *
 * FEATURE-005 (Unifilar profissional simplificado) + ajuste fino homologado:
 * ilustrações realistas (não fotográficas) do Medidor, Disjuntor, IDR, DPS e
 * Carregador, em proporções mais próximas de um dispositivo real (módulos
 * estreitos/altos). Setas indicam o sentido/condutor de origem em cada polo:
 * Disjuntor aponta para cima; IDR tem barra em T no topo + seta para baixo, e
 * seta simples para baixo na base; DPS tem seta para baixo no topo. Continua
 * sendo APENAS aparência: nenhuma mudança no modelo canônico, no layout ou no
 * roteador.
 */

import { TIPOS } from './model.js'
import { COMPONENTE } from './geometry.js'

const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
const { W, H } = COMPONENTE // caixa nominal de um componente (fonte única: geometry.js)

// Cores usadas SÓ nas setas indicadoras de polo/condutor (Disjuntor/IDR/DPS).
// Iguais às cores normativas dos condutores, exceto L3: branco não aparece bem
// numa seta pequena preenchida, então usa-se marrom (só nesta indicação visual).
const CORES_SETA = Object.freeze({
  fase: '#d61f1f', neutro: '#1f6fd6',
  fase_l1: '#1a1a1a', fase_l2: '#d61f1f', fase_l3: '#92400e',
})
const ORDEM_POLOS = Object.freeze({ 2: ['fase', 'neutro'], 4: ['fase_l1', 'fase_l2', 'fase_l3', 'neutro'] })

function caixa(x, y, titulo, linhas, cor = '#1f6fd6') {
  const txt = linhas.map((l, i) => `<text x="${x + W / 2}" y="${y + 52 + i * 14}" font-size="11" text-anchor="middle" fill="#334155">${esc(l)}</text>`).join('')
  return `<g>
    <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="8" fill="#ffffff" stroke="${cor}" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="${W}" height="22" rx="8" fill="${cor}"/>
    <text x="${x + W / 2}" y="${y + 15}" font-size="11" font-weight="bold" text-anchor="middle" fill="#ffffff">${esc(titulo)}</text>
    ${txt}
  </g>`
}

// Seta simples apontando para BAIXO (usada no topo do DPS e na base do IDR).
function setaBaixo(cx, yTopo, cor) {
  return `<line x1="${cx}" y1="${yTopo}" x2="${cx}" y2="${yTopo + 13}" stroke="${cor}" stroke-width="2.4"/>
    <path d="M${cx - 6},${yTopo + 13} L${cx + 6},${yTopo + 13} L${cx},${yTopo + 21} Z" fill="${cor}"/>`
}

// Seta simples apontando para CIMA (usada no topo/base do Disjuntor — invertida).
function setaCima(cx, yBase, cor) {
  return `<path d="M${cx - 6},${yBase} L${cx + 6},${yBase} L${cx},${yBase - 8} Z" fill="${cor}"/>
    <line x1="${cx}" y1="${yBase}" x2="${cx}" y2="${yBase + 13}" stroke="${cor}" stroke-width="2.4"/>`
}

// "T" (barra horizontal + haste) com seta para baixo — usado no TOPO do IDR.
function setaTBaixo(cx, yTopo, cor) {
  return `<line x1="${cx - 7}" y1="${yTopo}" x2="${cx + 7}" y2="${yTopo}" stroke="${cor}" stroke-width="2.2"/>
    <line x1="${cx}" y1="${yTopo}" x2="${cx}" y2="${yTopo + 9}" stroke="${cor}" stroke-width="2.2"/>
    <path d="M${cx - 6},${yTopo + 9} L${cx + 6},${yTopo + 9} L${cx},${yTopo + 15} Z" fill="${cor}"/>`
}

// Medidor de energia — corpo com tela digital (kWh) e terminais L/N/PE.
function ilustradoMedidor(x, y) {
  const w = 80, h = 100
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#f8fafc" stroke="#475569" stroke-width="2"/>
    <rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="26" rx="3" fill="#eef2f7" stroke="#94a3b8"/>
    <text x="${x + w / 2}" y="${y + 25}" font-size="10" font-weight="bold" text-anchor="middle" fill="#1e293b" font-family="monospace">01234,5</text>
    <text x="${x + w / 2}" y="${y + 43}" font-size="6.5" text-anchor="middle" fill="#334155">kWh · CLASSE B</text>
    <rect x="${x + 8}" y="${y + h - 26}" width="${w - 16}" height="18" rx="3" fill="#334155"/>
    <circle cx="${x + 22}" cy="${y + h - 17}" r="3.5" fill="#fff"/><text x="${x + 22}" y="${y + h - 5}" font-size="5.5" text-anchor="middle" fill="#334155">L</text>
    <circle cx="${x + w / 2}" cy="${y + h - 17}" r="3.5" fill="#fff"/><text x="${x + w / 2}" y="${y + h - 5}" font-size="5.5" text-anchor="middle" fill="#334155">N</text>
    <circle cx="${x + w - 22}" cy="${y + h - 17}" r="3.5" fill="#fff"/><text x="${x + w - 22}" y="${y + h - 5}" font-size="5.5" text-anchor="middle" fill="#334155">PE</text>
  </g>`
}

// Disjuntor ilustrado — corpo com alavanca vermelha por polo e parafusos.
function ilustradoDisjuntor(x, y, n, corrente) {
  const w = n >= 4 ? 96 : 54, h = 100
  const passo = n >= 4 ? 18 : 20
  const inicio = x + (w - (n - 1) * passo) / 2
  let polos = ''
  for (let i = 0; i < n; i++) {
    const cx = inicio + i * passo
    polos += `<circle cx="${cx}" cy="${y + 20}" r="3.6" fill="#fff" stroke="#64748b" stroke-width="1"/>
      <rect x="${cx - 6}" y="${y + 32}" width="12" height="46" rx="2.5" fill="#dc2626"/>
      <rect x="${cx - 6}" y="${y + 32}" width="12" height="8" rx="2.5" fill="#ef4444"/>
      <circle cx="${cx}" cy="${y + h - 14}" r="3.6" fill="#fff" stroke="#64748b" stroke-width="1"/>`
  }
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <rect x="${x}" y="${y}" width="${w}" height="13" rx="5" fill="#dc2626"/>
    <text x="${x + w / 2}" y="${y + 9.5}" font-size="7" font-weight="bold" text-anchor="middle" fill="#fff">${esc(corrente)}</text>
    ${polos}
  </g>`
}

// IDR ilustrado — igual ao disjuntor + botão de teste "T".
function ilustradoIDR(x, y, n, rotulo) {
  const w = n >= 4 ? 96 : 54, h = 100
  const passo = n >= 4 ? 18 : 20
  const inicio = x + (w - (n - 1) * passo) / 2
  let polos = ''
  for (let i = 0; i < n; i++) {
    const cx = inicio + i * passo
    polos += `<circle cx="${cx}" cy="${y + 20}" r="3.6" fill="#fff" stroke="#64748b" stroke-width="1"/>
      <rect x="${cx - 6}" y="${y + 32}" width="12" height="34" rx="2.5" fill="#dc2626"/>
      <rect x="${cx - 6}" y="${y + 32}" width="12" height="8" rx="2.5" fill="#ef4444"/>
      <circle cx="${cx}" cy="${y + h - 14}" r="3.6" fill="#fff" stroke="#64748b" stroke-width="1"/>`
  }
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <rect x="${x}" y="${y}" width="${w}" height="13" rx="5" fill="#dc2626"/>
    <text x="${x + w / 2}" y="${y + 9.5}" font-size="6.3" font-weight="bold" text-anchor="middle" fill="#fff">${esc(rotulo)}</text>
    ${polos}
    <rect x="${x + w / 2 - 9}" y="${y + h - 32}" width="18" height="12" rx="2" fill="#1e293b"/>
    <text x="${x + w / 2}" y="${y + h - 23}" font-size="7" font-weight="bold" text-anchor="middle" fill="#fff">T</text>
  </g>`
}

// DPS ilustrado — módulo vermelho com rótulo branco (tensão/corrente) e status.
function ilustradoDPS(x, y, tensao, polos) {
  const w = 42, h = 100
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.2"/>
    <circle cx="${x + w / 2}" cy="${y + 8}" r="4.5" fill="#9ca3af" stroke="#4b5563" stroke-width="1"/>
    <rect x="${x + 4}" y="${y + 16}" width="${w - 8}" height="54" fill="#f1f5f9"/>
    <text x="${x + w / 2}" y="${y + 26}" font-size="5.4" text-anchor="middle" fill="#334155">DPS ${polos || 1}P</text>
    <text x="${x + w / 2}" y="${y + 34}" font-size="5.4" text-anchor="middle" fill="#334155">${esc(tensao)}</text>
    <text x="${x + w / 2}" y="${y + 42}" font-size="5" text-anchor="middle" fill="#334155">Imax:45kA</text>
    <rect x="${x + 7}" y="${y + 46}" width="${w - 14}" height="8" rx="2" fill="#fff" stroke="#ef4444"/>
    <text x="${x + w / 2}" y="${y + 52.5}" font-size="5" text-anchor="middle" fill="#334155">STATUS</text>
    <rect x="${x + 5}" y="${y + 58}" width="${w - 10}" height="6" fill="#22c55e"/>
    <circle cx="${x + w / 2}" cy="${y + h - 8}" r="4.5" fill="#9ca3af" stroke="#4b5563" stroke-width="1"/>
  </g>`
}

// Carregador (wallbox) ilustrado — tela, leitor RFID, conector "EV" e cabo.
function ilustradoCarregador(x, y, rotulo, especs) {
  const w = 90, h = 105
  const linhas = especs.filter(Boolean).map((l, i) => `<text x="${x + w / 2}" y="${y + h + 13 + i * 12}" font-size="9" text-anchor="middle" fill="#334155">${esc(l)}</text>`).join('')
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#f8fafc" stroke="#0369a1" stroke-width="2"/>
    <rect x="${x + 14}" y="${y + 9}" width="${w - 28}" height="26" rx="4" fill="#1e293b"/>
    <rect x="${x + 20}" y="${y + 20}" width="22" height="3" rx="1.5" fill="#22c55e"/>
    <circle cx="${x + w - 20}" cy="${y + 21}" r="6" fill="none" stroke="#64748b" stroke-width="1.2"/>
    <path d="M${x + w - 23},${y + 19} h6 M${x + w - 23},${y + 21} h6 M${x + w - 23},${y + 23} h6" stroke="#64748b" stroke-width="0.9"/>
    <circle cx="${x + w / 2 - 8}" cy="${y + 70}" r="19" fill="#0f172a"/>
    <circle cx="${x + w / 2 - 8}" cy="${y + 70}" r="15" fill="none" stroke="#334155" stroke-width="1.6"/>
    <text x="${x + w / 2 - 8}" y="${y + 74}" font-size="9" font-weight="bold" text-anchor="middle" fill="#22c55e">EV</text>
    <path d="M${x + w / 2 + 10},${y + 70} q16,4 22,-9" fill="none" stroke="#1e293b" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="${x + w - 2}" cy="${y + 57}" r="6" fill="#334155"/>
    <text x="${x + w / 2}" y="${y - 6}" font-size="9" font-weight="bold" text-anchor="middle" fill="#334155">${esc(rotulo).slice(0, 20)}</text>
    ${linhas}
  </g>`
}

/** Retorna o markup SVG de um componente posicionado em (x,y). */
export function desenharComponente(c, pos) {
  const x = pos?.x ?? 0, y = pos?.y ?? 0
  const s = c.specs || {}
  switch (c.tipo) {
    case TIPOS.REDE: {
      if (/medidor/i.test(c.label || '')) return ilustradoMedidor(x, y)
      return caixa(x, y, 'QD EXISTENTE', [c.label || 'Rede', s.tensao_v ? `${s.tensao_v}V` : ''].filter(Boolean), '#475569')
    }
    case TIPOS.QUADRO:
      return caixa(x, y, 'QUADRO EV', [c.label || 'Proteção EV'], '#0f766e')
    case TIPOS.DISJUNTOR: {
      const n = c.polos || 2
      const corpo = ilustradoDisjuntor(x, y, n, s.corrente_a ? `${s.corrente_a}A` : '')
      const ordem = ORDEM_POLOS[n] || ORDEM_POLOS[2]
      const passo = n >= 4 ? 18 : 20
      const w = n >= 4 ? 96 : 54
      const centroInicio = x + (w - (n - 1) * passo) / 2
      let setas = ''
      for (let i = 0; i < n; i++) {
        const cx = centroInicio + i * passo
        const cor = CORES_SETA[ordem[i]] || '#334155'
        setas += setaCima(cx, y - 3, cor) + setaCima(cx, y + 100 + 16, cor)
      }
      return `<g>${corpo}${setas}</g>`
    }
    case TIPOS.DR: {
      const n = c.polos || 2
      const rotuloDR = [s.ma ? `${s.ma}mA` : '', s.classe ? `Tipo ${s.classe}` : 'Tipo A'].filter(Boolean).join(' · ')
      const corpo = ilustradoIDR(x, y, n, rotuloDR)
      const ordem = ORDEM_POLOS[n] || ORDEM_POLOS[2]
      const passo = n >= 4 ? 18 : 20
      const w = n >= 4 ? 96 : 54
      const centroInicio = x + (w - (n - 1) * passo) / 2
      let setas = ''
      for (let i = 0; i < n; i++) {
        const cx = centroInicio + i * passo
        const cor = CORES_SETA[ordem[i]] || '#334155'
        setas += setaTBaixo(cx, y - 16, cor) + setaBaixo(cx, y + 100 + 3, cor)
      }
      return `<g>${corpo}${setas}</g>`
    }
    case TIPOS.DPS: {
      const corpo = ilustradoDPS(x, y, s.tensao_v ? `${s.tensao_v}V` : '', c.polos || 1)
      const cor = CORES_SETA[s.condutor] || '#334155'
      // Topo: seta de entrada (cor do condutor que o DPS deriva). Base: seta de saída
      // verde (descarga para o aterramento) — mesmo padrão do Disjuntor/IDR (setas no
      // topo e na base), substituindo a antiga linha tracejada DPS→Aterramento.
      const setaTopo = setaBaixo(x + 21, y - 16, cor)
      const setaBase = setaBaixo(x + 21, y + 100 + 3, '#2e9e3f')
      return `<g>${corpo}${setaTopo}${setaBase}</g>`
    }
    case TIPOS.BARRAMENTO: {
      const sub = String(c.subtipo || '').toLowerCase()
      if (sub === 'aterramento' || /terra|aterr/i.test(c.label || '')) return glifoAterramento(x, y, c.label || 'Aterramento')
      if (sub === 'neutro' || /neutro/i.test(c.label || '')) return glifoNeutroJuncao(x, y, 'Neutro')
      return `<g><rect x="${x}" y="${y + 40}" width="${W}" height="8" rx="3" fill="#a16207"/><text x="${x + W / 2}" y="${y + 30}" font-size="10" text-anchor="middle" fill="#334155">${esc(c.label || 'Barramento')}</text></g>`
    }
    case TIPOS.CABO:
      return caixa(x, y, 'CABO', [s.bitola_mm2 ? `${s.bitola_mm2}mm²` : '', s.comprimento_m ? `${s.comprimento_m}m` : ''].filter(Boolean), '#15803d')
    case TIPOS.ELETRODUTO:
      return caixa(x, y, 'ELETRODUTO', [s.diametro || '', s.material || 'PVC'].filter(Boolean), '#64748b')
    case TIPOS.EQUIPAMENTO: {
      if (c.subtipo === 'carregador_ev') {
        const especs = [s.potencia_kw ? `${s.potencia_kw}kW` : '', s.corrente_a ? `${s.corrente_a}A` : '', s.conector ? `Tipo ${s.conector}` : '']
        return ilustradoCarregador(x, y, c.label || 'Carregador EV', especs)
      }
      return caixa(x, y, (c.label || 'EQUIPAMENTO').toUpperCase().slice(0, 16), [s.potencia_kw ? `${s.potencia_kw}kW` : '', s.corrente_a ? `${s.corrente_a}A` : ''].filter(Boolean), '#0369a1')
    }
    case TIPOS.CARGA:
      return caixa(x, y, 'VEÍCULO', [c.label || 'EV', s.conector ? `Tipo ${s.conector}` : ''].filter(Boolean), '#1e293b')
    default:
      return caixa(x, y, (c.label || c.tipo).toUpperCase(), [])
  }
}

// BUG-021: dimensões REAIS (menores) do símbolo de aterramento — a caixa do editor e
// o clamp usam estes valores (símbolo compacto, não a caixa nominal 120x90).
const LARG_ATERRAMENTO = 72
const ALT_ATERRAMENTO = 52
function ehAterramento(c) {
  const sub = String(c?.subtipo || '').toLowerCase()
  return c?.tipo === TIPOS.BARRAMENTO && (sub === 'aterramento' || /terra|aterr/i.test(c?.label || ''))
}

// Aterramento normativo — haste vertical + três traços decrescentes. Compacto,
// centralizado na sua largura REAL (LARG_ATERRAMENTO) para caber na caixa menor.
function glifoAterramento(x, y, label) {
  const cx = x + LARG_ATERRAMENTO / 2, top = y + 8
  return `<g>
    <line x1="${cx}" y1="${top}" x2="${cx}" y2="${top + 14}" stroke="#2e9e3f" stroke-width="2.2"/>
    <line x1="${cx - 11}" y1="${top + 14}" x2="${cx + 11}" y2="${top + 14}" stroke="#2e9e3f" stroke-width="2.2"/>
    <line x1="${cx - 7}"  y1="${top + 19}" x2="${cx + 7}"  y2="${top + 19}" stroke="#2e9e3f" stroke-width="2.2"/>
    <line x1="${cx - 3}"  y1="${top + 24}" x2="${cx + 3}"  y2="${top + 24}" stroke="#2e9e3f" stroke-width="2.2"/>
    <text x="${cx}" y="${top + 38}" font-size="8.5" font-weight="bold" text-anchor="middle" fill="#2e9e3f">${esc(label || 'Aterramento')}</text>
    <circle cx="${cx}" cy="${top}" r="2.8" fill="#ffffff" stroke="#2e9e3f" stroke-width="1.4"/>
  </g>`
}

// Junção de neutro — nó de conexão (sem barra de barramento).
function glifoNeutroJuncao(x, y, label) {
  const cx = x + W / 2, cyy = y + 34
  return `<g>
    <circle cx="${cx}" cy="${cyy}" r="5" fill="#1f6fd6"/>
    <text x="${cx}" y="${cyy + 22}" font-size="10" font-weight="bold" text-anchor="middle" fill="#1f6fd6">${esc(label || 'Neutro')}</text>
    <circle cx="${cx}" cy="${cyy}" r="8.5" fill="none" stroke="#1f6fd6" stroke-width="1.2"/>
  </g>`
}

// Largura REAL do desenho de um componente (todas menores que a caixa nominal W=120
// do editor). Usada só para CENTRALIZAR o desenho dentro da caixa fixa do editor —
// não afeta as posições fixas do SVG executivo (adapters/ev.js), que já usam a
// largura real diretamente.
export function larguraComponente(c) {
  if (ehAterramento(c)) return LARG_ATERRAMENTO
  switch (c?.tipo) {
    case TIPOS.REDE: return /medidor/i.test(c.label || '') ? 80 : W
    case TIPOS.DISJUNTOR:
    case TIPOS.DR: return (c.polos || 2) >= 4 ? 96 : 54
    case TIPOS.DPS: return 42
    case TIPOS.EQUIPAMENTO: return c.subtipo === 'carregador_ev' ? 90 : W
    default: return W
  }
}

// Altura REAL do desenho — só o aterramento é bem mais baixo que a caixa nominal (H);
// usada pelo clamp (BUG-021) para o aterramento poder descer mais dentro do DIAGRAM_BOX.
export function alturaComponente(c) {
  return ehAterramento(c) ? ALT_ATERRAMENTO : H
}

export const DIM_COMPONENTE = Object.freeze({ W, H })
export { esc }
