/**
 * symbols.js — Ilustrações técnicas dos componentes (aparência apenas).
 *
 * Os DADOS (corrente, polos, bitola...) vêm SEMPRE do componente (cálculo/BOM).
 * Os símbolos são paramétricos: 1 disjuntor bipolar desenha 2 polos; 1 tripolar, 3;
 * 2 DPS monopolares desenham 2 caixas; nada é fixo na figura.
 *
 * FEATURE-005 (Unifilar profissional simplificado): os blocos simples ganharam
 * glifos mais realistas (medidor, disjuntor com chaves, IDR com botão de teste,
 * DPS com descarga, wallbox com plugue, aterramento normativo) e TERMINAIS de
 * ENTRADA (esquerda) e SAÍDA (direita) explícitos. Continua sendo APENAS aparência:
 * nenhuma mudança no modelo canônico, no layout ou no roteador.
 */

import { TIPOS } from './model.js'
import { COMPONENTE } from './geometry.js'

const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
const { W, H } = COMPONENTE // caixa nominal de um componente (fonte única: geometry.js)

// Terminais de porta: ENTRADA à esquerda (meio) e SAÍDA à direita (meio).
// Deixam claro, em cada componente, por onde a energia entra e por onde sai.
function portas(x, y, { entrada = true, saida = true } = {}) {
  const cy = y + H / 2
  const nub = (px, tipo) => `<circle cx="${px}" cy="${cy}" r="3.2" fill="#ffffff" stroke="#334155" stroke-width="1.5"/>
    <text x="${px + (tipo === 'E' ? -6 : 6)}" y="${cy - 7}" font-size="7" text-anchor="middle" fill="#94a3b8">${tipo}</text>`
  return `${entrada ? nub(x, 'E') : ''}${saida ? nub(x + W, 'S') : ''}`
}

function caixa(x, y, titulo, linhas, cor = '#1f6fd6', opts = {}) {
  const txt = linhas.map((l, i) => `<text x="${x + W / 2}" y="${y + 58 + i * 14}" font-size="11" text-anchor="middle" fill="#334155">${esc(l)}</text>`).join('')
  return `<g>
    <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="8" fill="#ffffff" stroke="${cor}" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="${W}" height="22" rx="8" fill="${cor}"/>
    <text x="${x + W / 2}" y="${y + 15}" font-size="11" font-weight="bold" text-anchor="middle" fill="#ffffff">${esc(titulo)}</text>
    ${opts.glifo || ''}
    ${txt}
    ${portas(x, y, opts.portas || {})}
  </g>`
}

// Chaves (polos) de um disjuntor/seccionador — bipolar=2, tripolar=3, tetrapolar=4.
function polosSVG(x, y, n) {
  const largura = n * 20
  const x0 = x + (W - largura) / 2 + 10
  let s = ''
  for (let i = 0; i < n; i++) {
    const px = x0 + i * 20
    s += `<circle cx="${px}" cy="${y + 46}" r="2.6" fill="#334155"/>
          <line x1="${px}" y1="${y + 46}" x2="${px + 11}" y2="${y + 33}" stroke="#334155" stroke-width="2"/>
          <circle cx="${px + 11}" cy="${y + 33}" r="2" fill="none" stroke="#334155" stroke-width="1.5"/>`
  }
  return s
}

// Medidor de energia (kWh) — disco/círculo com rótulo, estilo padrão de planta.
function glifoMedidor(x, y) {
  const cx = x + W / 2
  return `<circle cx="${cx}" cy="${y + 40}" r="12" fill="#ffffff" stroke="#475569" stroke-width="1.5"/>
    <text x="${cx}" y="${y + 43}" font-size="8" font-weight="bold" text-anchor="middle" fill="#475569">kWh</text>`
}

// IDR (interruptor diferencial residual) — chaves + botão de teste "T".
function glifoIDR(x, y, n) {
  return `${polosSVG(x, y, n)}<rect x="${x + W - 26}" y="${y + 28}" width="14" height="14" rx="2" fill="#ede9fe" stroke="#7c3aed" stroke-width="1.3"/>
    <text x="${x + W - 19}" y="${y + 38}" font-size="9" font-weight="bold" text-anchor="middle" fill="#7c3aed">T</text>`
}

// DPS — supressor com seta de descarga apontando para o terra.
function glifoDPS(x, y) {
  const cx = x + W / 2
  return `<rect x="${cx - 8}" y="${y + 30}" width="16" height="12" rx="2" fill="#fce7f3" stroke="#db2777" stroke-width="1.3"/>
    <line x1="${cx}" y1="${y + 42}" x2="${cx}" y2="${y + 52}" stroke="#db2777" stroke-width="1.6"/>
    <path d="M${cx - 3},${y + 49} L${cx},${y + 54} L${cx + 3},${y + 49} Z" fill="#db2777"/>`
}

// Carregador / Wallbox — caixa de parede com plugue de recarga.
function glifoWallbox(x, y) {
  const cx = x + W / 2
  return `<rect x="${cx - 12}" y="${y + 28}" width="24" height="16" rx="3" fill="#e0f2fe" stroke="#0369a1" stroke-width="1.4"/>
    <circle cx="${cx}" cy="${y + 36}" r="4.5" fill="none" stroke="#0369a1" stroke-width="1.4"/>
    <line x1="${cx - 2}" y1="${y + 34.5}" x2="${cx - 2}" y2="${y + 37.5}" stroke="#0369a1" stroke-width="1.2"/>
    <line x1="${cx + 2}" y1="${y + 34.5}" x2="${cx + 2}" y2="${y + 37.5}" stroke="#0369a1" stroke-width="1.2"/>`
}

// Aterramento normativo — haste vertical + três traços decrescentes.
function glifoAterramento(x, y, label) {
  const cx = x + W / 2, top = y + 26
  return `<g>
    <line x1="${cx}" y1="${top - 8}" x2="${cx}" y2="${top + 10}" stroke="#2e9e3f" stroke-width="2.4"/>
    <line x1="${cx - 16}" y1="${top + 10}" x2="${cx + 16}" y2="${top + 10}" stroke="#2e9e3f" stroke-width="2.4"/>
    <line x1="${cx - 10}" y1="${top + 16}" x2="${cx + 10}" y2="${top + 16}" stroke="#2e9e3f" stroke-width="2.4"/>
    <line x1="${cx - 5}"  y1="${top + 22}" x2="${cx + 5}"  y2="${top + 22}" stroke="#2e9e3f" stroke-width="2.4"/>
    <text x="${cx}" y="${top + 40}" font-size="10" font-weight="bold" text-anchor="middle" fill="#2e9e3f">${esc(label || 'Aterramento')}</text>
    <circle cx="${cx}" cy="${top - 8}" r="3.2" fill="#ffffff" stroke="#2e9e3f" stroke-width="1.5"/>
  </g>`
}

// Junção de neutro — nó de conexão (sem barra de barramento). Não é um "barramento".
function glifoNeutroJuncao(x, y, label) {
  const cx = x + W / 2, cyy = y + 34
  return `<g>
    <circle cx="${cx}" cy="${cyy}" r="5" fill="#1f6fd6"/>
    <text x="${cx}" y="${cyy + 22}" font-size="10" font-weight="bold" text-anchor="middle" fill="#1f6fd6">${esc(label || 'Neutro')}</text>
    <circle cx="${cx}" cy="${cyy}" r="8.5" fill="none" stroke="#1f6fd6" stroke-width="1.2"/>
  </g>`
}

/** Retorna o markup SVG de um componente posicionado em (x,y). */
export function desenharComponente(c, pos) {
  const x = pos?.x ?? 0, y = pos?.y ?? 0
  const s = c.specs || {}
  const sub = String(c.subtipo || '').toLowerCase()
  switch (c.tipo) {
    case TIPOS.REDE: {
      const ehMedidor = /medidor/i.test(c.label || '')
      return caixa(x, y, ehMedidor ? 'MEDIDOR' : 'QD EXISTENTE',
        [c.label && !ehMedidor ? c.label : '', s.tensao_v ? `${s.tensao_v}V` : ''].filter(Boolean),
        '#475569', { glifo: ehMedidor ? glifoMedidor(x, y) : '', portas: { entrada: false } })
    }
    case TIPOS.QUADRO:
      return caixa(x, y, 'QUADRO EV', [c.label || 'Proteção EV'], '#0f766e')
    case TIPOS.DISJUNTOR: {
      const n = c.polos || 2
      const titulo = n === 1 ? 'DISJUNTOR GERAL' : `DISJUNTOR ${n}P`
      return caixa(x, y, titulo, [s.corrente_a ? `${s.corrente_a}A` : '', s.curva ? `Curva ${s.curva}` : ''].filter(Boolean),
        '#b45309', { glifo: polosSVG(x, y, n) })
    }
    case TIPOS.DR: {
      const n = c.polos || 2
      return caixa(x, y, `DR ${n}P`, [s.ma ? `${s.ma}mA` : '', s.classe ? `Tipo ${s.classe}` : 'Tipo A'].filter(Boolean),
        '#7c3aed', { glifo: glifoIDR(x, y, n) })
    }
    case TIPOS.DPS:
      return caixa(x, y, `DPS ${c.polos || 1}P`, [s.tensao_v ? `${s.tensao_v}V` : '', 'Classe II'].filter(Boolean),
        '#db2777', { glifo: glifoDPS(x, y), portas: { saida: false } })
    case TIPOS.BARRAMENTO:
      // FEATURE-005: não desenhar barra de barramento. Neutro = junção; Terra = aterramento.
      if (sub === 'aterramento' || /terra|aterr/i.test(c.label || ''))
        return glifoAterramento(x, y, c.label || 'Aterramento')
      if (sub === 'neutro' || /neutro/i.test(c.label || ''))
        return glifoNeutroJuncao(x, y, 'Neutro')
      // compat (outros domínios): barra simples.
      return `<g><rect x="${x}" y="${y + 40}" width="${W}" height="8" rx="3" fill="#a16207"/><text x="${x + W / 2}" y="${y + 30}" font-size="10" text-anchor="middle" fill="#334155">${esc(c.label || 'Barramento')}</text></g>`
    case TIPOS.CABO:
      return caixa(x, y, 'CABO', [s.bitola_mm2 ? `${s.bitola_mm2}mm²` : '', s.comprimento_m ? `${s.comprimento_m}m` : ''].filter(Boolean), '#15803d')
    case TIPOS.ELETRODUTO:
      return caixa(x, y, 'ELETRODUTO', [s.diametro || '', s.material || 'PVC'].filter(Boolean), '#64748b')
    case TIPOS.EQUIPAMENTO:
      return caixa(x, y, (c.subtipo === 'carregador_ev' ? 'CARREGADOR EV' : (c.label || 'EQUIPAMENTO')).toUpperCase().slice(0, 16),
        [s.potencia_kw ? `${s.potencia_kw}kW` : '', s.corrente_a ? `${s.corrente_a}A` : '', s.conector ? `Tipo ${s.conector}` : ''].filter(Boolean),
        '#0369a1', { glifo: c.subtipo === 'carregador_ev' ? glifoWallbox(x, y) : '', portas: { saida: false } })
    case TIPOS.CARGA:
      return caixa(x, y, 'VEÍCULO', [c.label || 'EV', s.conector ? `Tipo ${s.conector}` : ''].filter(Boolean), '#1e293b')
    default:
      return caixa(x, y, (c.label || c.tipo).toUpperCase(), [])
  }
}

export const DIM_COMPONENTE = Object.freeze({ W, H })
export { esc }
