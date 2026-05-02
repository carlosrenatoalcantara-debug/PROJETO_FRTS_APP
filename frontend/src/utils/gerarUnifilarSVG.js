// Gerador de Diagrama Unifilar Fotovoltaico
// Conforme NBR 16274, NBR 5361/16800 e ABNT NBR IEC 60364

// ─── CÁLCULOS ELÉTRICOS (NBR) ─────────────────────────────────────────────────

function calcularStrings(numPaineis, numStrings) {
  const paineisPorString = Math.ceil(numPaineis / numStrings)
  const ultima = numPaineis - paineisPorString * (numStrings - 1)
  return Array.from({ length: numStrings }, (_, i) => ({
    id: i + 1,
    paineis: i < numStrings - 1 ? paineisPorString : ultima,
  }))
}

function calcularTensaoString(voc, paineisPorString, fatorTemp = 1.15) {
  // NBR 16274: Voc_max = Voc × coef. temperatura (1.15 para climas quentes)
  return +(voc * paineisPorString * fatorTemp).toFixed(1)
}

function calcularCorrenteDC(isc, fatorSeguranca = 1.25) {
  // NBR 16274: corrente máxima string = Isc × 1.25
  return +(isc * fatorSeguranca).toFixed(1)
}

function calcularCorrenteAC(potenciaKW, fasesAC, tensaoAC) {
  const potW = potenciaKW * 1000
  if (fasesAC === 1) return +(potW / (tensaoAC * 0.95)).toFixed(1)       // monofásico
  if (fasesAC === 2) return +(potW / (tensaoAC * 2 * 0.95)).toFixed(1)  // bifásico
  return +(potW / (tensaoAC * Math.sqrt(3) * 0.95)).toFixed(1)           // trifásico
}

// Tabela de bitolas NBR 5410 (temperatura ambiente 40°C, instalação B2)
const TABELA_BITOLAS = [
  { max: 16,  bitola: '2.5', disj: '16'  },
  { max: 21,  bitola: '4',   disj: '20'  },
  { max: 28,  bitola: '6',   disj: '25'  },
  { max: 36,  bitola: '10',  disj: '32'  },
  { max: 47,  bitola: '16',  disj: '40'  },
  { max: 63,  bitola: '25',  disj: '63'  },
  { max: 80,  bitola: '35',  disj: '80'  },
  { max: 101, bitola: '50',  disj: '100' },
  { max: 125, bitola: '70',  disj: '125' },
]

function selecionarBitola(corrente) {
  const correnteProjetada = corrente * 1.25 // fator de segurança
  for (const t of TABELA_BITOLAS) {
    if (correnteProjetada <= t.max) return t
  }
  return TABELA_BITOLAS[TABELA_BITOLAS.length - 1]
}

// DPS: Nível de proteção por Voc da string
function calcularDPS(vocString) {
  if (vocString <= 500)  return { modelo: 'DPS DC 600V In=20kA', nivel: 'Tipo II' }
  if (vocString <= 800)  return { modelo: 'DPS DC 1000V In=20kA', nivel: 'Tipo II' }
  return { modelo: 'DPS DC 1200V In=40kA', nivel: 'Tipo I+II' }
}

// ─── DESENHADORES SVG ─────────────────────────────────────────────────────────

const COR = {
  painel: '#f59e0b',
  stringDC: '#333',
  stringBox: '#6b21a8',
  inversor: '#1d4ed8',
  quadroAC: '#0f766e',
  rede: '#15803d',
  gnd: '#b91c1c',
  cabo: '#92400e',
  dps: '#dc2626',
  disjuntor: '#374151',
  texto: '#1e293b',
  textoCinza: '#64748b',
}

function svgPainel(x, y, id, marca, pmpp) {
  return `
  <g>
    <rect x="${x}" y="${y}" width="48" height="72" fill="#fffbeb" stroke="${COR.painel}" stroke-width="2" rx="2"/>
    <line x1="${x+12}" y1="${y}" x2="${x+12}" y2="${y+72}" stroke="${COR.painel}" stroke-width="0.5" opacity="0.5"/>
    <line x1="${x+24}" y1="${y}" x2="${x+24}" y2="${y+72}" stroke="${COR.painel}" stroke-width="0.5" opacity="0.5"/>
    <line x1="${x+36}" y1="${y}" x2="${x+36}" y2="${y+72}" stroke="${COR.painel}" stroke-width="0.5" opacity="0.5"/>
    <line x1="${x}" y1="${y+24}" x2="${x+48}" y2="${y+24}" stroke="${COR.painel}" stroke-width="0.5" opacity="0.5"/>
    <line x1="${x}" y1="${y+48}" x2="${x+48}" y2="${y+48}" stroke="${COR.painel}" stroke-width="0.5" opacity="0.5"/>
    <text x="${x+24}" y="${y+14}" text-anchor="middle" font-size="7" font-weight="bold" fill="${COR.painel}">${marca}</text>
    <text x="${x+24}" y="${y+26}" text-anchor="middle" font-size="7" fill="${COR.texto}">${pmpp}W</text>
    <text x="${x+24}" y="${y+62}" text-anchor="middle" font-size="7" fill="${COR.textoCinza}">FV${id}</text>
  </g>`
}

function svgDisjuntorDC(x, y, label, corrente) {
  return `
  <g>
    <rect x="${x-18}" y="${y-22}" width="36" height="44" fill="#f0fdf4" stroke="${COR.disjuntor}" stroke-width="1.5" rx="3"/>
    <text x="${x}" y="${y-8}" text-anchor="middle" font-size="7" font-weight="bold" fill="${COR.disjuntor}">DJ-DC</text>
    <text x="${x}" y="${y+6}" text-anchor="middle" font-size="8" font-weight="bold" fill="${COR.disjuntor}">${corrente}A</text>
    <text x="${x}" y="${y+18}" text-anchor="middle" font-size="7" fill="${COR.textoCinza}">${label}</text>
  </g>`
}

function svgStringBox(x, y, numStrings, vocMax, idcMax) {
  const H = 50 + numStrings * 14
  return `
  <g>
    <rect x="${x-40}" y="${y-H/2}" width="80" height="${H}" fill="#faf5ff" stroke="${COR.stringBox}" stroke-width="2" rx="4"/>
    <text x="${x}" y="${y-H/2+14}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.stringBox}">STRING BOX</text>
    <text x="${x}" y="${y-H/2+27}" text-anchor="middle" font-size="8" fill="${COR.texto}">Vdc: ${vocMax}V</text>
    <text x="${x}" y="${y-H/2+40}" text-anchor="middle" font-size="8" fill="${COR.texto}">Idc: ${idcMax}A</text>
    <text x="${x}" y="${y-H/2+53}" text-anchor="middle" font-size="7" fill="${COR.textoCinza}">DPS Tipo II</text>
  </g>`
}

function svgInversor(x, y, marca, modelo, potKW, nMPPT, tensaoAC) {
  return `
  <g>
    <rect x="${x-55}" y="${y-50}" width="110" height="100" fill="#eff6ff" stroke="${COR.inversor}" stroke-width="2" rx="5"/>
    <text x="${x}" y="${y-33}" text-anchor="middle" font-size="10" font-weight="bold" fill="${COR.inversor}">${marca}</text>
    <text x="${x}" y="${y-18}" text-anchor="middle" font-size="8" fill="${COR.texto}">${modelo}</text>
    <text x="${x}" y="${y+0}" text-anchor="middle" font-size="16" font-weight="bold" fill="${COR.inversor}">${potKW}kW</text>
    <text x="${x}" y="${y+18}" text-anchor="middle" font-size="8" fill="${COR.texto}">${nMPPT} MPPT</text>
    <text x="${x}" y="${y+32}" text-anchor="middle" font-size="8" fill="${COR.texto}">Vac: ${tensaoAC}V</text>
    <text x="${x}" y="${y+46}" text-anchor="middle" font-size="7" fill="${COR.textoCinza}">INVERSOR</text>
  </g>`
}

function svgDisjuntorAC(x, y, corrente, fases) {
  const label = fases === 1 ? '1P' : fases === 2 ? '2P' : '3P'
  return `
  <g>
    <rect x="${x-20}" y="${y-28}" width="40" height="56" fill="#ecfdf5" stroke="${COR.disjuntor}" stroke-width="1.5" rx="3"/>
    <text x="${x}" y="${y-14}" text-anchor="middle" font-size="8" font-weight="bold" fill="${COR.disjuntor}">DJ ${label}</text>
    <text x="${x}" y="${y+4}" text-anchor="middle" font-size="10" font-weight="bold" fill="${COR.disjuntor}">${corrente}A</text>
    <text x="${x}" y="${y+22}" text-anchor="middle" font-size="7" fill="${COR.textoCinza}">DIN NBR</text>
  </g>`
}

function svgQuadroAC(x, y, label, faseLabel) {
  return `
  <g>
    <rect x="${x-45}" y="${y-35}" width="90" height="70" fill="#f0fdfa" stroke="${COR.quadroAC}" stroke-width="2" rx="4"/>
    <text x="${x}" y="${y-18}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.quadroAC}">QUADRO AC</text>
    <text x="${x}" y="${y+0}" text-anchor="middle" font-size="9" fill="${COR.texto}">${label}</text>
    <text x="${x}" y="${y+18}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.quadroAC}">${faseLabel}</text>
  </g>`
}

function svgMedidor(x, y, faseLabel) {
  return `
  <g>
    <circle cx="${x}" cy="${y}" r="30" fill="white" stroke="${COR.rede}" stroke-width="2"/>
    <circle cx="${x}" cy="${y}" r="22" fill="none" stroke="${COR.rede}" stroke-width="1"/>
    <text x="${x}" y="${y-6}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.rede}">MEDIDOR</text>
    <text x="${x}" y="${y+8}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.rede}">${faseLabel}</text>
    <text x="${x}" y="${y+22}" text-anchor="middle" font-size="7" fill="${COR.textoCinza}">BIDIRECIONAL</text>
  </g>`
}

function svgRede(x, y, distribuidora, faseLabel) {
  const abrev = distribuidora?.length > 8 ? distribuidora.substring(0, 8) : distribuidora
  return `
  <g>
    <rect x="${x-50}" y="${y-36}" width="100" height="72" fill="#f0fdf4" stroke="${COR.rede}" stroke-width="2.5" rx="5"/>
    <text x="${x}" y="${y-18}" text-anchor="middle" font-size="8" fill="${COR.texto}">${abrev || 'CONCESSIONÁRIA'}</text>
    <text x="${x}" y="${y+2}" text-anchor="middle" font-size="10" font-weight="bold" fill="${COR.rede}">REDE</text>
    <text x="${x}" y="${y+20}" text-anchor="middle" font-size="9" fill="${COR.rede}">${faseLabel}</text>
  </g>`
}

function svgAterramento(x, y) {
  return `
  <g>
    <line x1="${x}" y1="${y}" x2="${x}" y2="${y+20}" stroke="${COR.gnd}" stroke-width="2"/>
    <line x1="${x-15}" y1="${y+20}" x2="${x+15}" y2="${y+20}" stroke="${COR.gnd}" stroke-width="2.5"/>
    <line x1="${x-10}" y1="${y+25}" x2="${x+10}" y2="${y+25}" stroke="${COR.gnd}" stroke-width="2"/>
    <line x1="${x-5}"  y1="${y+30}" x2="${x+5}"  y2="${y+30}" stroke="${COR.gnd}" stroke-width="1.5"/>
    <text x="${x}" y="${y+44}" text-anchor="middle" font-size="8" font-weight="bold" fill="${COR.gnd}">ATERRAMENTO</text>
    <text x="${x}" y="${y+55}" text-anchor="middle" font-size="7" fill="${COR.textoCinza}">NBR 5419</text>
  </g>`
}

function svgLinhaCabo(x1, y1, x2, y2, bitola, cor) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cor}" stroke-width="2.5"/>
  <rect x="${mx-28}" y="${my-10}" width="56" height="20" fill="white" stroke="${cor}" stroke-width="1" rx="2"/>
  <text x="${mx}" y="${my+5}" text-anchor="middle" font-size="8" font-weight="bold" fill="${cor}">${bitola}mm²</text>`
}

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────

export const gerarUnifilarSVG = (projeto) => {
  const {
    nome = 'Projeto FV',
    nomeCliente = 'Cliente',
    dimensionamento = {},
    tipo_ligacao = 'Monofásico',
    tensao: tensaoRede = '220',
    distribuidora = 'COSERN',
    painel = null,
    inversor = null,
  } = projeto

  // Dados do painel (do datasheet ou defaults)
  const painelVoc    = painel?.voc   || 49.5
  const painelVmpp   = painel?.vmpp  || 41.2
  const painelIsc    = painel?.isc   || 13.9
  const painelPmpp   = painel?.potenciaW || painel?.pmpp || 550
  const painelMarca  = painel?.marca || 'Painel'
  const painelModelo = painel?.modelo || `${painelPmpp}W`

  // Dados do inversor (do datasheet ou defaults)
  const invMarca    = inversor?.marca    || 'Inversor'
  const invModelo   = inversor?.modelo   || ''
  const invPotKW    = inversor?.potenciaKW || dimensionamento.potenciaArredondada || 5
  const invNMPPT    = inversor?.nMppts   || 2

  // Fase/tensão da rede
  const fasesAC = tipo_ligacao?.toLowerCase().includes('trifás') ? 3
                : tipo_ligacao?.toLowerCase().includes('bifás')  ? 2 : 1
  const tensaoV = parseInt(tensaoRede) || 220
  const faseLabel = fasesAC === 1 ? `1Ø ${tensaoV}V` : fasesAC === 2 ? `2Ø ${tensaoV}V` : `3Ø 380V`

  // Dimensionamento
  const { numPaineis = 6, numStrings = 1, potenciaArredondada = invPotKW } = dimensionamento
  const strings = calcularStrings(numPaineis, numStrings)
  const paineisPorString = strings[0].paineis

  // Cálculos elétricos
  const vocString  = calcularTensaoString(painelVoc, paineisPorString)
  const idcString  = calcularCorrenteDC(painelIsc)
  const idcTotal   = +(idcString * numStrings).toFixed(1)
  const iac        = calcularCorrenteAC(invPotKW, fasesAC, fasesAC === 1 ? tensaoV : 380)
  const bolaDC     = selecionarBitola(idcString)
  const bolaAC     = selecionarBitola(iac)
  const dps        = calcularDPS(vocString)

  // Tamanho do SVG
  const W = 1400
  const STRING_H = 130
  const HEADER_H = 180
  const FOOTER_H = 280
  const H = Math.max(950, HEADER_H + numStrings * STRING_H + FOOTER_H)
  const data = new Date().toLocaleDateString('pt-BR')

  // Posicionamentos X
  const xPaineis   = 60
  const xDJDC      = 560
  const xSBOX      = 670
  const xInversor  = 820
  const xDJAC      = 970
  const xQuadroAC  = 1065
  const xMedidor   = 1195
  const xRede      = 1325

  // Centro vertical das strings
  const yCentro = HEADER_H + (numStrings * STRING_H) / 2

  // ─── SVG ────────────────────────────────────────────────────────────────────
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial,sans-serif">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#333"/>
    </marker>
  </defs>

  <!-- Fundo -->
  <rect width="${W}" height="${H}" fill="#f8fafc"/>

  <!-- Cabeçalho -->
  <rect x="0" y="0" width="${W}" height="${HEADER_H - 20}" fill="#1e3a5f"/>
  <text x="${W/2}" y="38" text-anchor="middle" font-size="20" font-weight="bold" fill="white">DIAGRAMA UNIFILAR — SISTEMA FOTOVOLTAICO</text>
  <text x="${W/2}" y="60" text-anchor="middle" font-size="13" fill="#94a3b8">${nome} | Cliente: ${nomeCliente}</text>

  <!-- Dados do sistema -->
  <rect x="30" y="76" width="${W-60}" height="68" fill="white" stroke="#cbd5e1" stroke-width="1" rx="4"/>
  <text x="50"    y="96"  font-size="10" font-weight="bold" fill="${COR.texto}">MÓDULO:</text>
  <text x="120"   y="96"  font-size="10" fill="${COR.texto}">${painelMarca} ${painelModelo}</text>
  <text x="50"    y="114" font-size="10" fill="${COR.textoCinza}">Pmpp: ${painelPmpp}W | Voc: ${painelVoc}V | Vmpp: ${painelVmpp}V | Isc: ${painelIsc}A</text>

  <text x="420"   y="96"  font-size="10" font-weight="bold" fill="${COR.texto}">INVERSOR:</text>
  <text x="490"   y="96"  font-size="10" fill="${COR.texto}">${invMarca} ${invModelo}</text>
  <text x="420"   y="114" font-size="10" fill="${COR.textoCinza}">${invPotKW}kW | ${invNMPPT} MPPT | Saída: ${faseLabel}</text>

  <text x="840"   y="96"  font-size="10" font-weight="bold" fill="${COR.texto}">SISTEMA:</text>
  <text x="905"   y="96"  font-size="10" fill="${COR.texto}">${potenciaArredondada} kWp | ${numPaineis} módulos | ${numStrings} string${numStrings > 1 ? 's' : ''}</text>
  <text x="840"   y="114" font-size="10" fill="${COR.textoCinza}">Voc/string: ${vocString}V | Icc/string: ${idcString}A | Icc total: ${idcTotal}A</text>

  <text x="1150"  y="96"  font-size="10" font-weight="bold" fill="${COR.texto}">REDE:</text>
  <text x="1190"  y="96"  font-size="10" fill="${COR.texto}">${distribuidora} | ${faseLabel}</text>
  <text x="1150"  y="114" font-size="10" fill="${COR.textoCinza}">Iac: ${iac}A | Data: ${data}</text>

  <!-- Rótulos de zona -->
  <text x="${xPaineis+80}"  y="${HEADER_H-4}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.textoCinza}">GERAÇÃO DC</text>
  <text x="${xSBOX}"        y="${HEADER_H-4}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.textoCinza}">PROTEÇÃO DC</text>
  <text x="${xInversor}"    y="${HEADER_H-4}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.inversor}">CONVERSÃO</text>
  <text x="${xMedidor}"     y="${HEADER_H-4}" text-anchor="middle" font-size="9" font-weight="bold" fill="${COR.rede}">MEDIÇÃO / REDE</text>
  <line x1="${xDJDC-20}" y1="${HEADER_H-14}" x2="${xDJDC-20}" y2="${H-FOOTER_H+20}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="${xInversor-10}" y1="${HEADER_H-14}" x2="${xInversor-10}" y2="${H-FOOTER_H+20}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="${xQuadroAC-20}" y1="${HEADER_H-14}" x2="${xQuadroAC-20}" y2="${H-FOOTER_H+20}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4,4"/>
`

  // ─── STRINGS ──────────────────────────────────────────────────────────────────
  const yStrings = []
  strings.forEach((str, si) => {
    const y0 = HEADER_H + si * STRING_H + 30
    yStrings.push(y0 + 36)

    // Painéis da string
    const maxPorLinha = Math.min(str.paineis, 6)
    for (let p = 0; p < maxPorLinha; p++) {
      svg += svgPainel(xPaineis + p * 75, y0, (si * maxPorLinha) + p + 1, painelMarca, painelPmpp)
    }
    if (str.paineis > 6) {
      svg += `<text x="${xPaineis + 6*75 + 10}" y="${y0+38}" font-size="11" font-weight="bold" fill="${COR.textoCinza}">+${str.paineis - 6}</text>`
    }

    // Linha DC da string até disjuntor
    const xFimPaineis = xPaineis + Math.min(str.paineis, 6) * 75
    svg += `<line x1="${xFimPaineis}" y1="${y0+36}" x2="${xDJDC-18}" y2="${y0+36}" stroke="${COR.stringDC}" stroke-width="2"/>`

    // Anotação da string
    svg += `<text x="${xPaineis}" y="${y0+84}" font-size="9" fill="${COR.textoCinza}">String ${str.id}: ${str.paineis}mod × ${painelVoc}V = ${+(painelVoc*str.paineis).toFixed(0)}V / Isc=${painelIsc}A</text>`

    // Disjuntor DC por string
    svg += svgDisjuntorDC(xDJDC, y0 + 36, `S${str.id}`, bolaDC.disj)

    // Linha do disjuntor à string box
    svg += `<line x1="${xDJDC+18}" y1="${y0+36}" x2="${xSBOX-40}" y2="${y0+36}" stroke="${COR.stringDC}" stroke-width="2"/>`
  })

  // ─── STRING BOX ───────────────────────────────────────────────────────────────
  svg += svgStringBox(xSBOX, yCentro, numStrings, vocString, idcTotal)

  // Coletor DC: linha vertical unindo todas as strings à string box
  if (numStrings > 1) {
    const yTop = yStrings[0]
    const yBot = yStrings[yStrings.length - 1]
    svg += `<line x1="${xSBOX-40}" y1="${yTop}" x2="${xSBOX-40}" y2="${yBot}" stroke="${COR.stringDC}" stroke-width="2"/>`
    yStrings.forEach(y => {
      svg += `<line x1="${xSBOX-40}" y1="${y}" x2="${xSBOX-40}" y2="${y}" stroke="${COR.stringDC}" stroke-width="2"/>`
    })
  }

  // ─── STRING BOX → INVERSOR ────────────────────────────────────────────────────
  svg += svgLinhaCabo(xSBOX + 40, yCentro, xInversor - 55, yCentro, bolaDC.bitola, COR.cabo)
  svg += `<text x="${(xSBOX+xInversor)/2}" y="${yCentro+32}" text-anchor="middle" font-size="8" fill="${COR.textoCinza}">Cabo DC ${bolaDC.bitola}mm² — ${vocString}V / ${idcTotal}A</text>`

  // ─── INVERSOR ────────────────────────────────────────────────────────────────
  svg += svgInversor(xInversor, yCentro, invMarca, invModelo, invPotKW, invNMPPT, fasesAC === 1 ? tensaoV : 380)

  // ─── INVERSOR → DISJUNTOR AC ──────────────────────────────────────────────────
  svg += svgLinhaCabo(xInversor + 55, yCentro, xDJAC - 20, yCentro, bolaAC.bitola, COR.quadroAC)
  svg += svgDisjuntorAC(xDJAC, yCentro, bolaAC.disj, fasesAC)

  // ─── DISJUNTOR → QUADRO AC ────────────────────────────────────────────────────
  svg += `<line x1="${xDJAC+20}" y1="${yCentro}" x2="${xQuadroAC-45}" y2="${yCentro}" stroke="${COR.quadroAC}" stroke-width="2.5"/>`
  svg += svgQuadroAC(xQuadroAC, yCentro, `Cabo ${bolaAC.bitola}mm²`, faseLabel)

  // ─── QUADRO → MEDIDOR ─────────────────────────────────────────────────────────
  svg += `<line x1="${xQuadroAC+45}" y1="${yCentro}" x2="${xMedidor-30}" y2="${yCentro}" stroke="${COR.rede}" stroke-width="2.5"/>`
  svg += svgMedidor(xMedidor, yCentro, faseLabel)

  // ─── MEDIDOR → REDE ───────────────────────────────────────────────────────────
  svg += `<line x1="${xMedidor+30}" y1="${yCentro}" x2="${xRede-50}" y2="${yCentro}" stroke="${COR.rede}" stroke-width="2.5"/>`
  svg += svgRede(xRede, yCentro, distribuidora, faseLabel)

  // ─── ATERRAMENTO ──────────────────────────────────────────────────────────────
  const yGnd = yCentro + 90
  svg += `<line x1="${xMedidor}" y1="${yCentro+30}" x2="${xMedidor}" y2="${yGnd}" stroke="${COR.gnd}" stroke-width="2" stroke-dasharray="5,3"/>`
  svg += svgAterramento(xMedidor, yGnd)

  // ─── TABELA TÉCNICA (rodapé) ──────────────────────────────────────────────────
  const yTab = H - FOOTER_H + 30
  svg += `
  <rect x="30" y="${yTab}" width="${W-60}" height="${FOOTER_H-40}" fill="white" stroke="#e2e8f0" stroke-width="1" rx="4"/>
  <rect x="30" y="${yTab}" width="${W-60}" height="26" fill="#1e3a5f" rx="4"/>
  <text x="${W/2}" y="${yTab+17}" text-anchor="middle" font-size="11" font-weight="bold" fill="white">MEMORIAL TÉCNICO RESUMIDO — NBR 16274 / NBR 5410 / NBR 5419</text>

  <!-- Col 1: Módulos -->
  <text x="60"  y="${yTab+42}" font-size="10" font-weight="bold" fill="${COR.texto}">MÓDULOS FOTOVOLTAICOS</text>
  <text x="60"  y="${yTab+58}" font-size="9" fill="${COR.textoCinza}">Modelo: ${painelMarca} ${painelModelo}</text>
  <text x="60"  y="${yTab+72}" font-size="9" fill="${COR.textoCinza}">Pmpp: ${painelPmpp} W | Qtd: ${numPaineis} un</text>
  <text x="60"  y="${yTab+86}" font-size="9" fill="${COR.textoCinza}">Voc: ${painelVoc} V | Vmpp: ${painelVmpp} V</text>
  <text x="60"  y="${yTab+100}" font-size="9" fill="${COR.textoCinza}">Isc: ${painelIsc} A | Config: ${numStrings}×${paineisPorString}</text>
  <text x="60"  y="${yTab+114}" font-size="9" fill="${COR.textoCinza}">Garantia produto: ${painel?.garantiaProduto || 12} anos | Performance: ${painel?.garantiaPerformance || 25} anos</text>

  <!-- Col 2: Inversor -->
  <text x="330" y="${yTab+42}" font-size="10" font-weight="bold" fill="${COR.texto}">INVERSOR</text>
  <text x="330" y="${yTab+58}" font-size="9" fill="${COR.textoCinza}">Modelo: ${invMarca} ${invModelo}</text>
  <text x="330" y="${yTab+72}" font-size="9" fill="${COR.textoCinza}">Potência nominal: ${invPotKW} kW</text>
  <text x="330" y="${yTab+86}" font-size="9" fill="${COR.textoCinza}">Entradas MPPT: ${invNMPPT} | Saída: ${faseLabel}</text>
  <text x="330" y="${yTab+100}" font-size="9" fill="${COR.textoCinza}">Corrente saída: ${iac} A</text>
  <text x="330" y="${yTab+114}" font-size="9" fill="${COR.textoCinza}">Garantia: ${inversor?.garantia || 10} anos</text>

  <!-- Col 3: Proteções DC -->
  <text x="600" y="${yTab+42}" font-size="10" font-weight="bold" fill="${COR.texto}">PROTEÇÃO DC (por string)</text>
  <text x="600" y="${yTab+58}" font-size="9" fill="${COR.textoCinza}">Disjuntor DC: ${bolaDC.disj}A / string</text>
  <text x="600" y="${yTab+72}" font-size="9" fill="${COR.textoCinza}">Cabo DC: ${bolaDC.bitola} mm² (PV/Fotovoltaico)</text>
  <text x="600" y="${yTab+86}" font-size="9" fill="${COR.textoCinza}">Tensão máx. string: ${vocString} V</text>
  <text x="600" y="${yTab+100}" font-size="9" fill="${COR.textoCinza}">${dps.modelo}</text>
  <text x="600" y="${yTab+114}" font-size="9" fill="${COR.textoCinza}">Proteção: ${dps.nivel} | NBR 16800</text>

  <!-- Col 4: Proteções AC -->
  <text x="880" y="${yTab+42}" font-size="10" font-weight="bold" fill="${COR.texto}">PROTEÇÃO AC</text>
  <text x="880" y="${yTab+58}" font-size="9" fill="${COR.textoCinza}">Disjuntor AC: ${bolaAC.disj}A — ${fasesAC === 1 ? '1P' : fasesAC === 2 ? '2P' : '3P'}</text>
  <text x="880" y="${yTab+72}" font-size="9" fill="${COR.textoCinza}">Cabo AC: ${bolaAC.bitola} mm² — ${faseLabel}</text>
  <text x="880" y="${yTab+86}" font-size="9" fill="${COR.textoCinza}">Corrente de projeto: ${iac} A</text>
  <text x="880" y="${yTab+100}" font-size="9" fill="${COR.textoCinza}">Aterramento: NBR 5419 — cabo verde/amarelo</text>
  <text x="880" y="${yTab+114}" font-size="9" fill="${COR.textoCinza}">Medidor bidirecional (ANEEL 482/2012)</text>

  <!-- Col 5: Rede/Concessionária -->
  <text x="1160" y="${yTab+42}" font-size="10" font-weight="bold" fill="${COR.texto}">CONEXÃO À REDE</text>
  <text x="1160" y="${yTab+58}" font-size="9" fill="${COR.textoCinza}">Concessionária: ${distribuidora}</text>
  <text x="1160" y="${yTab+72}" font-size="9" fill="${COR.textoCinza}">Tipo de ligação: ${tipo_ligacao}</text>
  <text x="1160" y="${yTab+86}" font-size="9" fill="${COR.textoCinza}">Tensão nominal: ${faseLabel}</text>
  <text x="1160" y="${yTab+100}" font-size="9" fill="${COR.textoCinza}">Sistema: On-Grid (Conectado)</text>
  <text x="1160" y="${yTab+114}" font-size="9" fill="${COR.textoCinza}">Resolução ANEEL 482/2012</text>

  <!-- Rodapé -->
  <text x="${W/2}" y="${H-12}" text-anchor="middle" font-size="9" fill="${COR.textoCinza}">Diagrama gerado em ${data} | Sistema ${potenciaArredondada}kWp | Forte Solar | Todos os valores conforme NBR 16274 / NBR 5410 / NBR 5419</text>
</svg>`

  return svg
}

export const baixarUnifilarSVG = (svg, projeto = 'unifilar') => {
  const nome = `unifilar_${projeto}_${new Date().toISOString().split('T')[0]}.svg`
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = nome
  link.click()
  URL.revokeObjectURL(link.href)
}

export const converterSVGparaPNG = async (svgString) => {
  return new Promise((resolve) => {
    const img = new Image()
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width || 1400
      canvas.height = img.height || 950
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(resolve, 'image/png')
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}
