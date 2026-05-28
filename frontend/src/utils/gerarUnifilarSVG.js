/**
 * gerarUnifilarSVG.js — Sprint 2.5
 *
 * Diagrama Unifilar Fotovoltaico
 * Normas: NBR 16690:2019 | NBR 5410:2004 | NBR 5419:2015 | NBR 16800:2020
 *
 * Novidades Sprint 2.5:
 *   - Topologia multi-MPPT real (um grupo de strings por MPPT)
 *   - Temperaturas Voc/Vmpp baseadas na UF do projeto
 *   - Cabo DC mínimo 4 mm² (NBR 16690 §6.1.1)
 *   - Fórmula bifásico corrigida: I = P / (V × fp)
 *   - String box / DJ-DC opcionais: apenas quando numStrings > 1 no MPPT
 *   - Referências normativas corretas (NBR 16690, não NBR 16274)
 *   - Memorial técnico completo por MPPT
 */

import {
  montarModeloEletrico,
  calcularCorrenteAC,
  selecionarCabo,
  selecionarDPS,
} from './engenhariaNormativa.js'

// ─── PALETA DE CORES ──────────────────────────────────────────────────────────

const COR = {
  painel:     '#f59e0b',
  stringDC:   '#374151',
  combiner:   '#6b21a8',
  inversor:   '#1d4ed8',
  quadroAC:   '#0f766e',
  rede:       '#15803d',
  gnd:        '#b91c1c',
  cabo:       '#92400e',
  dps:        '#dc2626',
  disjuntor:  '#374151',
  texto:      '#1e293b',
  cinza:      '#64748b',
  mpptLine:   ['#1d4ed8', '#0284c7', '#0891b2', '#0f766e', '#15803d', '#7c3aed'],
  mpptBg:     ['#eff6ff', '#f0f9ff', '#ecfeff', '#f0fdfa', '#f0fdf4', '#f5f3ff'],
  sepLine:    '#e2e8f0',
}

// ─── UTILITÁRIOS SVG ──────────────────────────────────────────────────────────

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function svgPainel(x, y, id, marca, pmpp) {
  return `
  <rect x="${x}" y="${y}" width="46" height="68" fill="#fffbeb" stroke="${COR.painel}" stroke-width="1.5" rx="2"/>
  <line x1="${x+11}" y1="${y}" x2="${x+11}" y2="${y+68}" stroke="${COR.painel}" stroke-width="0.4" opacity="0.5"/>
  <line x1="${x+23}" y1="${y}" x2="${x+23}" y2="${y+68}" stroke="${COR.painel}" stroke-width="0.4" opacity="0.5"/>
  <line x1="${x+35}" y1="${y}" x2="${x+35}" y2="${y+68}" stroke="${COR.painel}" stroke-width="0.4" opacity="0.5"/>
  <line x1="${x}" y1="${y+22}" x2="${x+46}" y2="${y+22}" stroke="${COR.painel}" stroke-width="0.4" opacity="0.5"/>
  <line x1="${x}" y1="${y+45}" x2="${x+46}" y2="${y+45}" stroke="${COR.painel}" stroke-width="0.4" opacity="0.5"/>
  <text x="${x+23}" y="${y+13}" text-anchor="middle" font-size="6.5" font-weight="bold" fill="${COR.painel}">${esc(marca.substring(0,7))}</text>
  <text x="${x+23}" y="${y+36}" text-anchor="middle" font-size="7" fill="${COR.texto}">${pmpp}W</text>
  <text x="${x+23}" y="${y+60}" text-anchor="middle" font-size="6" fill="${COR.cinza}">FV${id}</text>`
}

function svgCombiner(x, y, numStr, vocMax, idcMax, cor) {
  const H = 44 + numStr * 11
  return `
  <rect x="${x-38}" y="${y-H/2}" width="76" height="${H}" fill="#faf5ff" stroke="${cor}" stroke-width="1.5" rx="3"/>
  <text x="${x}" y="${y-H/2+12}" text-anchor="middle" font-size="8" font-weight="bold" fill="${cor}">COMB.</text>
  <text x="${x}" y="${y-H/2+24}" text-anchor="middle" font-size="7" fill="${COR.texto}">Vdc: ${vocMax}V</text>
  <text x="${x}" y="${y-H/2+36}" text-anchor="middle" font-size="7" fill="${COR.texto}">Idc: ${idcMax}A</text>
  <text x="${x}" y="${y-H/2+48}" text-anchor="middle" font-size="6.5" fill="${COR.cinza}">DPS Tipo II</text>`
}

function svgDjDC(x, y, amp, cor) {
  return `
  <rect x="${x-17}" y="${y-20}" width="34" height="40" fill="#f0fdf4" stroke="${COR.disjuntor}" stroke-width="1.2" rx="2.5"/>
  <text x="${x}" y="${y-6}" text-anchor="middle" font-size="6.5" font-weight="bold" fill="${COR.disjuntor}">DJ-DC</text>
  <text x="${x}" y="${y+8}" text-anchor="middle" font-size="8" font-weight="bold" fill="${COR.disjuntor}">${amp}A</text>`
}

function svgInversor(x, yTop, yBot, marca, modelo, potKW, nMPPT, mpptYs, tensaoAC, tipo) {
  const H    = Math.max(yBot - yTop, 80)
  const cy   = yTop + H / 2
  const W    = 140
  const xL   = x - W / 2
  const corI = tipo === 'hibrido' ? '#0891b2' : tipo === 'micro' ? '#d97706' : COR.inversor

  let s = `
  <rect x="${xL}" y="${yTop}" width="${W}" height="${H}" fill="#eff6ff" stroke="${corI}" stroke-width="2" rx="5"/>
  <text x="${x}" y="${cy - 25}" text-anchor="middle" font-size="10" font-weight="bold" fill="${corI}">${esc(marca)}</text>
  <text x="${x}" y="${cy - 10}" text-anchor="middle" font-size="8" fill="${COR.texto}">${esc(modelo)}</text>
  <text x="${x}" y="${cy + 10}" text-anchor="middle" font-size="15" font-weight="bold" fill="${corI}">${potKW}kW</text>
  <text x="${x}" y="${cy + 26}" text-anchor="middle" font-size="8" fill="${COR.texto}">${nMPPT} MPPT${nMPPT > 1 ? 's' : ''}</text>
  <text x="${x}" y="${cy + 40}" text-anchor="middle" font-size="8" fill="${COR.texto}">Vac: ${tensaoAC}V</text>
  <text x="${x}" y="${cy + 54}" text-anchor="middle" font-size="7" fill="${COR.cinza}">INVERSOR</text>`

  // Pontos de entrada MPPT (lado esquerdo do inversor)
  mpptYs.forEach((my, i) => {
    const cor = COR.mpptLine[i % COR.mpptLine.length]
    s += `
  <circle cx="${xL}" cy="${my}" r="5" fill="${cor}" stroke="white" stroke-width="1"/>
  <text x="${xL + 8}" y="${my + 3}" font-size="7" fill="${cor}" font-weight="bold">M${i+1}</text>`
  })

  // Ponto de saída AC (lado direito)
  s += `
  <circle cx="${x + W/2}" cy="${cy}" r="5" fill="${COR.quadroAC}" stroke="white" stroke-width="1"/>`

  return s
}

function svgDjAC(x, y, amp, fases) {
  const label = fases === 1 ? '1P' : fases === 2 ? '2P' : '3P'
  return `
  <rect x="${x-19}" y="${y-26}" width="38" height="52" fill="#ecfdf5" stroke="${COR.disjuntor}" stroke-width="1.5" rx="3"/>
  <text x="${x}" y="${y-12}" text-anchor="middle" font-size="8" font-weight="bold" fill="${COR.disjuntor}">DJ ${label}</text>
  <text x="${x}" y="${y+5}" text-anchor="middle" font-size="10" font-weight="bold" fill="${COR.disjuntor}">${amp}A</text>
  <text x="${x}" y="${y+20}" text-anchor="middle" font-size="6.5" fill="${COR.cinza}">NBR 5361</text>`
}

function svgQuadroAC(x, y, bitola, faseLabel) {
  return `
  <rect x="${x-43}" y="${y-34}" width="86" height="68" fill="#f0fdfa" stroke="${COR.quadroAC}" stroke-width="2" rx="4"/>
  <text x="${x}" y="${y-18}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.quadroAC}">QUADRO AC</text>
  <text x="${x}" y="${y+0}" text-anchor="middle" font-size="8" fill="${COR.texto}">Cabo ${bitola}mm²</text>
  <text x="${x}" y="${y+18}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.quadroAC}">${faseLabel}</text>`
}

function svgMedidor(x, y, faseLabel) {
  return `
  <circle cx="${x}" cy="${y}" r="30" fill="white" stroke="${COR.rede}" stroke-width="2"/>
  <circle cx="${x}" cy="${y}" r="22" fill="none" stroke="${COR.rede}" stroke-width="1"/>
  <text x="${x}" y="${y-7}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${COR.rede}">MEDIDOR</text>
  <text x="${x}" y="${y+8}" text-anchor="middle" font-size="8" font-weight="bold" fill="${COR.rede}">${faseLabel}</text>
  <text x="${x}" y="${y+22}" text-anchor="middle" font-size="6.5" fill="${COR.cinza}">BIDIRECIONAL</text>`
}

function svgRede(x, y, distribuidora, faseLabel) {
  const abrev = esc((distribuidora || 'CONCESSIONÁRIA').substring(0, 10))
  return `
  <rect x="${x-48}" y="${y-34}" width="96" height="68" fill="#f0fdf4" stroke="${COR.rede}" stroke-width="2.5" rx="5"/>
  <text x="${x}" y="${y-18}" text-anchor="middle" font-size="8" fill="${COR.texto}">${abrev}</text>
  <text x="${x}" y="${y+2}" text-anchor="middle" font-size="10" font-weight="bold" fill="${COR.rede}">REDE</text>
  <text x="${x}" y="${y+20}" text-anchor="middle" font-size="9" fill="${COR.rede}">${faseLabel}</text>`
}

function svgAterramento(x, y) {
  return `
  <line x1="${x}" y1="${y}" x2="${x}" y2="${y+18}" stroke="${COR.gnd}" stroke-width="2"/>
  <line x1="${x-14}" y1="${y+18}" x2="${x+14}" y2="${y+18}" stroke="${COR.gnd}" stroke-width="2.5"/>
  <line x1="${x-9}"  y1="${y+23}" x2="${x+9}"  y2="${y+23}" stroke="${COR.gnd}" stroke-width="2"/>
  <line x1="${x-5}"  y1="${y+28}" x2="${x+5}"  y2="${y+28}" stroke="${COR.gnd}" stroke-width="1.5"/>
  <text x="${x}" y="${y+41}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="${COR.gnd}">ATERRAMENTO</text>
  <text x="${x}" y="${y+52}" text-anchor="middle" font-size="6.5" fill="${COR.cinza}">NBR 5419</text>`
}

function svgLinhaCabo(x1, y1, x2, y2, bitola, cor) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cor}" stroke-width="2.5"/>
  <rect x="${mx-26}" y="${my-9}" width="52" height="18" fill="white" stroke="${cor}" stroke-width="1" rx="2"/>
  <text x="${mx}" y="${my+5}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="${cor}">${bitola}mm²</text>`
}

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────

/**
 * Gera o SVG do diagrama unifilar fotovoltaico.
 *
 * @param {object} projeto
 * @param {string}  projeto.nome           - nome do projeto
 * @param {string}  projeto.nomeCliente    - nome do cliente
 * @param {object}  projeto.dimensionamento
 * @param {string}  projeto.tipo_ligacao   - 'monofasico' | 'bifasico' | 'trifasico'
 * @param {string}  projeto.tensao         - '127' | '220' | '380'
 * @param {string}  projeto.distribuidora  - nome da concessionária
 * @param {object}  projeto.painel         - objeto painel selecionado
 * @param {object}  projeto.inversor       - objeto inversor selecionado
 * @param {Array}   [projeto.arranjoMPPTs] - [{numStrings, modulosPorString}] (Sprint 2.5)
 * @param {string}  [projeto.uf]           - sigla da UF para temp. de projeto
 * @returns {string} SVG como string
 */
export const gerarUnifilarSVG = (projeto) => {
  const {
    nome           = 'Projeto FV',
    nomeCliente    = 'Cliente',
    dimensionamento = {},
    tipo_ligacao   = 'monofasico',
    tensao         = '220',
    distribuidora  = 'COSERN',
    painel         = null,
    inversor       = null,
    arranjoMPPTs   = null,
    uf             = null,
  } = projeto

  // ── Monta modelo elétrico normalizado ──────────────────────────────────────
  const modelo = montarModeloEletrico({
    painel,
    inversor,
    arranjoMPPTs,
    dimensionamento,
    dadosConsumo: { tipoLigacao: tipo_ligacao, tensao },
    uf,
  })

  const { temperatura, sistema, modulos, mppts: mpptCalc, resumo, cabos, protecoes, fasesLabel, disjLabel, iac } = modelo

  // ── Dados do painel e inversor para exibição ────────────────────────────────
  const painelMarca  = esc(painel?.marca  || 'Módulo')
  const painelModelo = esc(painel?.modelo || `${modulos.pmpp}W`)
  const invMarca     = esc(inversor?.marca  || 'Inversor')
  const invModelo    = esc(inversor?.modelo || '')
  const invPotKW     = sistema.potenciaCA
  const invNMPPT     = modelo.inversor.nMppts
  const invTipo      = modelo.inversor.tipo

  const tensaoACDisp = sistema.tensaoAC
  const potSistema   = +(resumo.numPaineis * modulos.pmpp / 1000).toFixed(2)

  // ── Layout SVG ──────────────────────────────────────────────────────────────
  const W         = 1460
  const HEADER_H  = 175
  const STRING_H  = 100    // altura por string dentro de um grupo MPPT
  const MPPT_GAP  = 32     // espaço vertical entre grupos MPPT
  const FOOTER_H  = 320
  const MAX_PAN   = 5      // max painéis a mostrar por string antes de "+N"
  const PAN_W     = 70     // largura painel + gap

  // Altura de cada grupo MPPT
  const mpptHeights = mpptCalc.map(m => Math.max(m.numStrings * STRING_H + 20, 130))
  const dcSectionH  = mpptHeights.reduce((a, b) => a + b, 0) +
                      MPPT_GAP * Math.max(mpptCalc.length - 1, 0)
  const H = Math.max(900, HEADER_H + dcSectionH + FOOTER_H)

  // Y inicial de cada grupo MPPT
  const yGroupStart = []
  let acc = HEADER_H + 15
  mpptCalc.forEach((_, i) => {
    yGroupStart.push(acc)
    acc += mpptHeights[i] + MPPT_GAP
  })

  // Centro vertical de cada grupo MPPT (onde conecta ao inversor)
  const mpptYs = mpptCalc.map((_, i) => Math.round(yGroupStart[i] + mpptHeights[i] / 2))

  // Centro vertical AC
  const yInvTop = HEADER_H + 15
  const yInvBot = yInvTop + dcSectionH
  const yAC     = Math.round((yInvTop + yInvBot) / 2)

  // Posicionamento X
  const xPaineis  = 30
  const xDCBus    = 490    // barramento DC / combiner center
  const xInvCX    = 640    // inversor center
  const xInvLeft  = xInvCX - 70
  const xInvRight = xInvCX + 70
  const xDJAC     = 845
  const xQuadro   = 950
  const xMedidor  = 1090
  const xRede     = 1260

  const data = new Date().toLocaleDateString('pt-BR')

  // ── Início do SVG ───────────────────────────────────────────────────────────
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial,Helvetica,sans-serif">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="#374151"/>
    </marker>
  </defs>

  <!-- Fundo -->
  <rect width="${W}" height="${H}" fill="#f8fafc"/>

  <!-- Cabeçalho azul -->
  <rect x="0" y="0" width="${W}" height="${HEADER_H - 20}" fill="#1e3a5f"/>
  <text x="${W/2}" y="36" text-anchor="middle" font-size="19" font-weight="bold" fill="white">DIAGRAMA UNIFILAR — SISTEMA FOTOVOLTAICO</text>
  <text x="${W/2}" y="57" text-anchor="middle" font-size="12" fill="#94a3b8">${esc(nome)} · Cliente: ${esc(nomeCliente)}</text>

  <!-- Tabela de dados técnicos do cabeçalho -->
  <rect x="20" y="70" width="${W-40}" height="68" fill="white" stroke="#cbd5e1" stroke-width="1" rx="4"/>

  <text x="40"    y="89"  font-size="9.5" font-weight="bold" fill="${COR.texto}">MÓDULO:</text>
  <text x="105"   y="89"  font-size="9.5" fill="${COR.texto}">${painelMarca} ${painelModelo}</text>
  <text x="40"    y="106" font-size="8.5" fill="${COR.cinza}">Pmpp: ${modulos.pmpp}W · Voc: ${modulos.voc}V · Vmpp: ${modulos.vmpp}V · Isc: ${modulos.isc}A</text>
  <text x="40"    y="122" font-size="8.5" fill="${COR.cinza}">Temp. projeto: Tmin=${temperatura.tmin}°C / Tmax=${temperatura.tmax}°C (${temperatura.uf})</text>

  <text x="410"   y="89"  font-size="9.5" font-weight="bold" fill="${COR.texto}">INVERSOR:</text>
  <text x="480"   y="89"  font-size="9.5" fill="${COR.texto}">${invMarca} ${invModelo}</text>
  <text x="410"   y="106" font-size="8.5" fill="${COR.cinza}">${invPotKW}kW · ${invNMPPT} MPPT${invNMPPT>1?'s':''} · Saída: ${fasesLabel}</text>
  <text x="410"   y="122" font-size="8.5" fill="${COR.cinza}">Iac: ${iac}A · Tipo: ${invTipo}</text>

  <text x="790"   y="89"  font-size="9.5" font-weight="bold" fill="${COR.texto}">SISTEMA:</text>
  <text x="848"   y="89"  font-size="9.5" fill="${COR.texto}">${potSistema} kWp · ${resumo.numPaineis} módulos · ${resumo.numStrings} string${resumo.numStrings>1?'s':''}</text>
  <text x="790"   y="106" font-size="8.5" fill="${COR.cinza}">Voc_max: ${resumo.vocMaxGlobal}V · Icc_total: ${resumo.iscTotalDC}A</text>
  <text x="790"   y="122" font-size="8.5" fill="${COR.cinza}">Cabo DC: ${cabos.dc.secao}mm² · Cabo AC: ${cabos.ac.secao}mm² · ${fasesLabel}</text>

  <text x="1145"  y="89"  font-size="9.5" font-weight="bold" fill="${COR.texto}">REDE:</text>
  <text x="1185"  y="89"  font-size="9.5" fill="${COR.texto}">${esc(distribuidora)}</text>
  <text x="1145"  y="106" font-size="8.5" fill="${COR.cinza}">${fasesLabel} · ${protecoes.dps.nivel}</text>
  <text x="1145"  y="122" font-size="8.5" fill="${COR.cinza}">Data: ${data}</text>

  <!-- Rótulos de zona -->
  <text x="230"        y="${HEADER_H - 4}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${COR.cinza}">GERAÇÃO DC</text>
  <text x="${xDCBus}"  y="${HEADER_H - 4}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${COR.combiner}">PROTEÇÃO DC</text>
  <text x="${xInvCX}"  y="${HEADER_H - 4}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${COR.inversor}">CONVERSÃO</text>
  <text x="${xMedidor}" y="${HEADER_H - 4}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${COR.rede}">MEDIÇÃO / REDE</text>

  <!-- Linhas divisórias de zona -->
  <line x1="${xDCBus - 55}" y1="${HEADER_H - 12}" x2="${xDCBus - 55}" y2="${H - FOOTER_H + 15}" stroke="${COR.sepLine}" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="${xInvLeft - 8}" y1="${HEADER_H - 12}" x2="${xInvLeft - 8}" y2="${H - FOOTER_H + 15}" stroke="${COR.sepLine}" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="${xInvRight + 8}" y1="${HEADER_H - 12}" x2="${xInvRight + 8}" y2="${H - FOOTER_H + 15}" stroke="${COR.sepLine}" stroke-width="1" stroke-dasharray="4,4"/>
`

  // ── Grupos de strings por MPPT ─────────────────────────────────────────────
  mpptCalc.forEach((mppt, gi) => {
    const yCentro  = mpptYs[gi]
    const yStart   = yGroupStart[gi]
    const cor      = COR.mpptLine[gi % COR.mpptLine.length]
    const bg       = COR.mpptBg[gi % COR.mpptBg.length]
    const numStr   = mppt.numStrings
    const nMod     = mppt.modPorString
    const usaCombi = numStr > 1

    // Faixa de fundo do grupo MPPT
    svg += `
  <rect x="16" y="${yStart - 4}" width="${xInvLeft - 24}" height="${mpptHeights[gi]}"
    fill="${bg}" stroke="${cor}" stroke-width="0.8" stroke-opacity="0.4" rx="4"/>
  <text x="22" y="${yStart + 10}" font-size="9" font-weight="bold" fill="${cor}">MPPT ${mppt.mppt}</text>
  <text x="22" y="${yStart + 22}" font-size="7.5" fill="${COR.cinza}">${nMod} mód/str · Voc_max: ${mppt.vocMax}V · Vmpp_min: ${mppt.vmppMin}V</text>`

    // Linhas de cada string
    const yStrings = []
    for (let si = 0; si < numStr; si++) {
      const yStr = yStart + 35 + si * STRING_H
      yStrings.push(yStr + 34)  // centro vertical do painel

      // Painéis da string
      const panToShow = Math.min(nMod, MAX_PAN)
      for (let pi = 0; pi < panToShow; pi++) {
        svg += svgPainel(xPaineis + pi * PAN_W, yStr, gi * numStr + si + 1, painel?.marca || 'FV', modulos.pmpp)
      }
      if (nMod > MAX_PAN) {
        svg += `<text x="${xPaineis + MAX_PAN * PAN_W + 5}" y="${yStr + 36}" font-size="11" font-weight="bold" fill="${COR.cinza}">+${nMod - MAX_PAN}</text>`
      }

      // Anotação da string
      svg += `<text x="${xPaineis}" y="${yStr + 80}" font-size="7.5" fill="${COR.cinza}">Str ${si+1}·M${gi+1}: ${nMod} mód × ${modulos.voc}V = ${+(modulos.voc*nMod).toFixed(0)}V / Isc=${modulos.isc}A</text>`

      // Linha da string para o ponto de junção (bus ou direto)
      const xPanFim = xPaineis + panToShow * PAN_W + (nMod > MAX_PAN ? 30 : 0)
      const xTarget = usaCombi ? xDCBus - 38 : xDCBus + 30  // a. combiner ou b. direto
      svg += `<line x1="${xPanFim}" y1="${yStr + 34}" x2="${xTarget}" y2="${yStr + 34}" stroke="${COR.stringDC}" stroke-width="2"/>`
    }

    // Coletora vertical (barra de strings ao DC bus)
    if (usaCombi && yStrings.length > 1) {
      const yTop = yStrings[0]
      const yBot = yStrings[yStrings.length - 1]
      svg += `<line x1="${xDCBus - 38}" y1="${yTop}" x2="${xDCBus - 38}" y2="${yBot}" stroke="${COR.stringDC}" stroke-width="2"/>`
    }

    // Combiner / string box (apenas quando numStr > 1)
    if (usaCombi) {
      svg += svgCombiner(xDCBus, yCentro, numStr, mppt.vocMax, mppt.iscTotalMPPT, cor)
      // Combiner → MPPT input
      svg += svgLinhaCabo(xDCBus + 38, yCentro, xInvLeft, yCentro, cabos.dc.secao, COR.cabo)
    } else {
      // String única: linha direta para MPPT input com anotação de cabo
      svg += svgLinhaCabo(xDCBus + 30, yCentro, xInvLeft, yCentro, cabos.dc.secao, COR.cabo)
    }

    // Linha horizontal de conexão ao MPPT do inversor (tracejado leve se multi-MPPT)
    if (mpptCalc.length > 1) {
      svg += `<text x="${(xDCBus + xInvLeft) / 2}" y="${yCentro - 8}" text-anchor="middle" font-size="7" fill="${COR.cinza}">Voc: ${mppt.vocMax}V / I: ${mppt.iscTotalMPPT}A</text>`
    }
  })

  // ── Inversor ───────────────────────────────────────────────────────────────
  svg += svgInversor(xInvCX, yInvTop, yInvBot, painel ? invMarca : 'Inversor', invModelo, invPotKW, invNMPPT, mpptYs, tensaoACDisp, invTipo)

  // ── Inversor → Disjuntor AC ────────────────────────────────────────────────
  svg += svgLinhaCabo(xInvRight, yAC, xDJAC - 19, yAC, cabos.ac.secao, COR.quadroAC)
  svg += `<text x="${xInvRight + 20}" y="${yAC - 8}" font-size="7.5" fill="${COR.cinza}">Cabo AC ${cabos.ac.secao}mm² — ${iac}A</text>`
  svg += svgDjAC(xDJAC, yAC, protecoes.djACamp, sistema.fasesAC)

  // ── Disjuntor → Quadro AC ─────────────────────────────────────────────────
  svg += `<line x1="${xDJAC + 19}" y1="${yAC}" x2="${xQuadro - 43}" y2="${yAC}" stroke="${COR.quadroAC}" stroke-width="2.5"/>`
  svg += svgQuadroAC(xQuadro, yAC, cabos.ac.secao, fasesLabel)

  // ── Quadro → Medidor ──────────────────────────────────────────────────────
  svg += `<line x1="${xQuadro + 43}" y1="${yAC}" x2="${xMedidor - 30}" y2="${yAC}" stroke="${COR.rede}" stroke-width="2.5"/>`
  svg += svgMedidor(xMedidor, yAC, fasesLabel)

  // ── Medidor → Rede ────────────────────────────────────────────────────────
  svg += `<line x1="${xMedidor + 30}" y1="${yAC}" x2="${xRede - 48}" y2="${yAC}" stroke="${COR.rede}" stroke-width="2.5"/>`
  svg += svgRede(xRede, yAC, distribuidora, fasesLabel)

  // ── Aterramento ───────────────────────────────────────────────────────────
  const yGnd = yAC + 90
  svg += `<line x1="${xMedidor}" y1="${yAC + 30}" x2="${xMedidor}" y2="${yGnd}" stroke="${COR.gnd}" stroke-width="2" stroke-dasharray="5,3"/>`
  svg += svgAterramento(xMedidor, yGnd)

  // ── Memorial Técnico (rodapé) ─────────────────────────────────────────────
  const yTab = H - FOOTER_H + 20
  svg += `
  <rect x="20" y="${yTab}" width="${W-40}" height="${FOOTER_H - 28}" fill="white" stroke="#e2e8f0" stroke-width="1" rx="4"/>
  <rect x="20" y="${yTab}" width="${W-40}" height="26" fill="#1e3a5f" rx="4"/>
  <text x="${W/2}" y="${yTab + 17}" text-anchor="middle" font-size="10.5" font-weight="bold" fill="white">MEMORIAL TÉCNICO RESUMIDO — NBR 16690:2019 / NBR 5410:2004 / NBR 5419:2015</text>

  <!-- Col 1: Módulos -->
  <text x="48"  y="${yTab+43}" font-size="9.5" font-weight="bold" fill="${COR.texto}">MÓDULOS FOTOVOLTAICOS</text>
  <text x="48"  y="${yTab+58}" font-size="8.5" fill="${COR.cinza}">Modelo: ${painelMarca} ${painelModelo}</text>
  <text x="48"  y="${yTab+72}" font-size="8.5" fill="${COR.cinza}">Pmpp: ${modulos.pmpp}W · Qtd: ${resumo.numPaineis} un</text>
  <text x="48"  y="${yTab+86}" font-size="8.5" fill="${COR.cinza}">Voc: ${modulos.voc}V · Vmpp: ${modulos.vmpp}V · Isc: ${modulos.isc}A</text>
  <text x="48"  y="${yTab+100}" font-size="8.5" fill="${COR.cinza}">Config: ${resumo.numStrings} strings · ${mpptCalc.length} MPPT${mpptCalc.length>1?'s':''}</text>
  <text x="48"  y="${yTab+114}" font-size="8.5" fill="${COR.cinza}">Coef. temp. Voc: ${(modulos.coefAbs*100).toFixed(2)}%/°C · NOCT: ${modulos.noct}°C</text>
  <text x="48"  y="${yTab+128}" font-size="8.5" fill="${COR.cinza}">Garantia produto: ${painel?.garantiaProduto || 12}a · Performance: ${painel?.garantiaPerformance || 25}a</text>

  <!-- Col 2: Inversor -->
  <text x="318" y="${yTab+43}" font-size="9.5" font-weight="bold" fill="${COR.texto}">INVERSOR</text>
  <text x="318" y="${yTab+58}" font-size="8.5" fill="${COR.cinza}">Modelo: ${invMarca} ${invModelo}</text>
  <text x="318" y="${yTab+72}" font-size="8.5" fill="${COR.cinza}">Pot. nominal: ${invPotKW}kW · Tipo: ${invTipo}</text>
  <text x="318" y="${yTab+86}" font-size="8.5" fill="${COR.cinza}">Entradas MPPT: ${invNMPPT} · Saída: ${fasesLabel}</text>
  <text x="318" y="${yTab+100}" font-size="8.5" fill="${COR.cinza}">Corrente saída AC: ${iac}A · ${disjLabel}</text>
  <text x="318" y="${yTab+114}" font-size="8.5" fill="${COR.cinza}">Garantia: ${inversor?.garantia || 10}a</text>
  <text x="318" y="${yTab+128}" font-size="8.5" fill="${COR.cinza}">Pot. CC total: ${potSistema}kWp</text>

  <!-- Col 3: Proteção DC -->
  <text x="590" y="${yTab+43}" font-size="9.5" font-weight="bold" fill="${COR.texto}">PROTEÇÃO DC (NBR 16690)</text>
  <text x="590" y="${yTab+58}" font-size="8.5" fill="${COR.cinza}">Cabo DC: ${cabos.dc.secao}mm² tipo fotovoltaico (mín. 4mm²)</text>
  <text x="590" y="${yTab+72}" font-size="8.5" fill="${COR.cinza}">Voc_max string: ${resumo.vocMaxGlobal}V · Icc_max: ${resumo.iscTotalDC}A</text>
  <text x="590" y="${yTab+86}" font-size="8.5" fill="${COR.cinza}">Tmin projeto: ${temperatura.tmin}°C (${temperatura.uf}) · Fator: ${(1 + modulos.coefAbs * (temperatura.tmin - 25)).toFixed(3)}</text>
  <text x="590" y="${yTab+100}" font-size="8.5" fill="${COR.cinza}">DPS DC: ${protecoes.dps.modelo}</text>
  <text x="590" y="${yTab+114}" font-size="8.5" fill="${COR.cinza}">Nível DPS: ${protecoes.dps.nivel} · Uc_mín: ${protecoes.dps.ucMin}V</text>
  <text x="590" y="${yTab+128}" font-size="8.5" fill="${COR.cinza}">Corrente por string: ${mpptCalc[0]?.iscMaxStr || '—'}A (Isc × 1.25)</text>

  <!-- Col 4: Proteção AC -->
  <text x="870" y="${yTab+43}" font-size="9.5" font-weight="bold" fill="${COR.texto}">PROTEÇÃO AC (NBR 5410)</text>
  <text x="870" y="${yTab+58}" font-size="8.5" fill="${COR.cinza}">Disjuntor AC: ${protecoes.djACamp}A — ${disjLabel}</text>
  <text x="870" y="${yTab+72}" font-size="8.5" fill="${COR.cinza}">Cabo AC: ${cabos.ac.secao}mm² — ${fasesLabel}</text>
  <text x="870" y="${yTab+86}" font-size="8.5" fill="${COR.cinza}">Corrente de projeto: ${iac}A</text>
  <text x="870" y="${yTab+100}" font-size="8.5" fill="${COR.cinza}">Aterramento: NBR 5419 — cabo 6mm² verde/amarelo</text>
  <text x="870" y="${yTab+114}" font-size="8.5" fill="${COR.cinza}">Medidor bidirecional (ANEEL Res. 482/2012)</text>
  <text x="870" y="${yTab+128}" font-size="8.5" fill="${COR.cinza}">SPDA conforme NBR 5419 — avaliar nível de proteção</text>

  <!-- Col 5: Rede / Concessionária -->
  <text x="1150" y="${yTab+43}" font-size="9.5" font-weight="bold" fill="${COR.texto}">CONEXÃO À REDE</text>
  <text x="1150" y="${yTab+58}" font-size="8.5" fill="${COR.cinza}">Concessionária: ${esc(distribuidora)}</text>
  <text x="1150" y="${yTab+72}" font-size="8.5" fill="${COR.cinza}">Tipo de ligação: ${tipo_ligacao}</text>
  <text x="1150" y="${yTab+86}" font-size="8.5" fill="${COR.cinza}">Tensão nominal: ${fasesLabel}</text>
  <text x="1150" y="${yTab+100}" font-size="8.5" fill="${COR.cinza}">Sistema: On-Grid (microgeração)</text>
  <text x="1150" y="${yTab+114}" font-size="8.5" fill="${COR.cinza}">Resolução ANEEL 482/2012</text>
  <text x="1150" y="${yTab+128}" font-size="8.5" fill="${COR.cinza}">NBR 16690:2019 atendida</text>

  <!-- Rodapé final -->
  <text x="${W/2}" y="${H - 8}" text-anchor="middle" font-size="8" fill="${COR.cinza}">
    Diagrama gerado em ${data} · Sistema ${potSistema}kWp · Forte Solar · Conforme NBR 16690:2019 / NBR 5410:2004 / NBR 5419:2015
  </text>
</svg>`

  return svg
}

// ─── EXPORTAÇÕES DE UTILIDADE ─────────────────────────────────────────────────

export const baixarUnifilarSVG = (svg, projeto = 'unifilar') => {
  const nome = `unifilar_${projeto}_${new Date().toISOString().split('T')[0]}.svg`
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const link = document.createElement('a')
  link.href   = URL.createObjectURL(blob)
  link.download = nome
  link.click()
  URL.revokeObjectURL(link.href)
}

export const converterSVGparaPNG = async (svgString) => {
  return new Promise((resolve) => {
    const img  = new Image()
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.width  || 1460
      canvas.height = img.height || 950
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(resolve, 'image/png')
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}
