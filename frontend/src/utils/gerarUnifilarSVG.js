export const gerarUnifilarSVG = (projeto) => {
  const {
    nome = 'Projeto FV',
    nomeCliente = 'Cliente',
    dimensionamento = {},
    tipo_ligacao = 'Trifásico',
    distribuidora = 'Distribuidora',
    kitSelecionado = null,
  } = projeto

  // Detectar automaticamente o tipo de fase
  const detectarFase = () => {
    const texto = (tipo_ligacao || '').toUpperCase()

    if (texto.includes('MONOFÁSICO') || texto.includes('MONOFASICO') || texto.includes('1Ø')) {
      return { fases: 1, tensao: '127V', label: '1Ø 127V' }
    } else if (texto.includes('BIFÁSICO') || texto.includes('BIFASICO') || texto.includes('2Ø')) {
      return { fases: 2, tensao: '220V', label: '2Ø 220V' }
    } else {
      return { fases: 3, tensao: '380V', label: '3Ø 380V' }
    }
  }

  const faseInfo = detectarFase()
  const { numPaineis = 68, numInversores = 1, numStrings = 4, potenciaArredondada = 15 } = dimensionamento

  // Extrair dados do kit selecionado
  const modeloPainel = kitSelecionado?.paineis?.modelo || 'Painel FV'
  const fabricantePainel = kitSelecionado?.paineis?.modelo?.split(' ')[0] || 'FV'
  const modeloInversor = kitSelecionado?.inversor?.modelo || 'Inversor'
  const fabricanteInversor = modeloInversor.split(' ')[0]
  const potenciaKW = kitSelecionado?.inversor?.potenciaKW || potenciaArredondada

  // Calcular corrente AC baseado na potência do inversor
  const tipoFase = tipo_ligacao.includes('monofásico') ? 'monofasico' : 'trifasico'
  const calcularCorrenteAC = (potenciaKW, tipo) => {
    const potenciaW = potenciaKW * 1000
    const tensao = tipo === 'monofasico' ? 127 : (tipo === 'bifasico' ? 220 : 220)
    const fator = tipo === 'monofasico' ? 1 : Math.sqrt(3)
    const fatorPotencia = 0.95
    return potenciaW / (tensao * fator * fatorPotencia)
  }

  const correnteAC = calcularCorrenteAC(potenciaKW, tipoFase)

  // Tabela de bitolas NBR 5036/4757
  const tabelaBitolas = [
    { min: 0, max: 10, bitola: '1.5', disjuntorMax: '16' },
    { min: 10, max: 16, bitola: '2.5', disjuntorMax: '20' },
    { min: 16, max: 25, bitola: '4', disjuntorMax: '32' },
    { min: 25, max: 32, bitola: '6', disjuntorMax: '40' },
    { min: 32, max: 40, bitola: '10', disjuntorMax: '50' },
    { min: 40, max: 50, bitola: '16', disjuntorMax: '63' },
    { min: 50, max: 63, bitola: '25', disjuntorMax: '80' },
    { min: 63, max: 80, bitola: '35', disjuntorMax: '100' },
    { min: 80, max: 100, bitola: '50', disjuntorMax: '125' },
    { min: 100, max: 125, bitola: '70', disjuntorMax: '160' },
  ]

  // Aplicar margem de segurança de 1.25x
  const correnteAjustada = correnteAC * 1.25

  // Encontrar bitola apropriada
  let bitolaSelecionada = tabelaBitolas[tabelaBitolas.length - 1]
  for (const opcao of tabelaBitolas) {
    if (correnteAjustada <= opcao.max) {
      bitolaSelecionada = opcao
      break
    }
  }

  const bitolaCabo = bitolaSelecionada.bitola
  const disjuntorMaximo = bitolaSelecionada.disjuntorMax

  // Canvas responsivo baseado no número de strings
  const SVG_WIDTH = 1400
  const HEADER_HEIGHT = 150
  const STRING_HEIGHT = 120
  const FOOTER_HEIGHT = 200
  const dynamicHeight = HEADER_HEIGHT + (numStrings * STRING_HEIGHT) + FOOTER_HEIGHT
  const SVG_HEIGHT = Math.max(900, dynamicHeight)
  const dataCurrent = new Date().toLocaleDateString('pt-BR')

  // Layout com margens e zonas
  const layout = {
    marginLeft: 50,
    marginRight: 50,
    marginTop: HEADER_HEIGHT,
    marginBottom: 100,
    dcZoneWidth: 600,
    acZoneX: 700,
    painelSpacing: 120,
    stringSpacing: STRING_HEIGHT,
  }

  const desenharPainel = (x, y, id) => `
    <rect x="${x}" y="${y}" width="50" height="75" fill="none" stroke="#FFD700" stroke-width="2"/>
    <text x="${x + 25}" y="${y + 25}" text-anchor="middle" font-size="9" font-weight="bold" fill="#333">${fabricantePainel}</text>
    <text x="${x + 25}" y="${y + 45}" text-anchor="middle" font-size="8" fill="#555">${modeloPainel.split(' ').slice(1).join(' ')}</text>
    <text x="${x + 25}" y="${y + 65}" text-anchor="middle" font-size="8" fill="#333">PV${id}</text>
  `

  const desenharInversor = (x, y) => `
    <rect x="${x}" y="${y}" width="110" height="85" fill="none" stroke="#0066CC" stroke-width="2"/>
    <text x="${x + 55}" y="${y + 20}" text-anchor="middle" font-size="10" font-weight="bold" fill="#0066CC">${fabricanteInversor}</text>
    <text x="${x + 55}" y="${y + 35}" text-anchor="middle" font-size="9" fill="#333">${modeloInversor}</text>
    <text x="${x + 55}" y="${y + 55}" text-anchor="middle" font-size="11" font-weight="bold" fill="#333">${potenciaKW}kW</text>
    <text x="${x + 55}" y="${y + 72}" text-anchor="middle" font-size="7" fill="#666">I: ${Math.ceil(correnteAC)}A</text>
  `

  const desenharDisjuntor = (x, y, corrente = '63A') => `
    <circle cx="${x}" cy="${y}" r="10" fill="none" stroke="#333" stroke-width="2"/>
    <line x1="${x - 10}" y1="${y}" x2="${x + 10}" y2="${y}" stroke="#333" stroke-width="2"/>
    <text x="${x}" y="${y + 20}" text-anchor="middle" font-size="8" fill="#333">${corrente}</text>
  `

  const desenharCaboComInfo = (x1, y1, x2, y2) => {
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2
    const boxWidth = 130
    const boxHeight = 42

    // Bounds checking - garantir que a caixa fica dentro do canvas
    let boxX = midX - (boxWidth / 2)
    if (boxX < layout.marginLeft) boxX = layout.marginLeft
    if (boxX + boxWidth > SVG_WIDTH - layout.marginRight) {
      boxX = SVG_WIDTH - boxWidth - layout.marginRight
    }

    return `
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="2"/>
      <rect x="${boxX}" y="${midY - 21}" width="${boxWidth}" height="${boxHeight}" fill="#fff3cd" stroke="#ff8c00" stroke-width="2" rx="3"/>
      <text x="${boxX + boxWidth/2}" y="${midY - 6}" text-anchor="middle" font-size="9" font-weight="bold" fill="#000">Cabo AC: ${bitolaCabo}mm²</text>
      <text x="${boxX + boxWidth/2}" y="${midY + 13}" text-anchor="middle" font-size="8" fill="#333">Disjuntor: ${disjuntorMaximo}A</text>
    `
  }

  const desenharMedidor = (x, y, fases) => {
    let simbolo = ''

    if (fases === 1) {
      simbolo = `
        <circle cx="${x}" cy="${y}" r="28" fill="none" stroke="#006699" stroke-width="2"/>
        <text x="${x}" y="${y - 5}" text-anchor="middle" font-size="12" font-weight="bold" fill="#006699">1Ø</text>
        <text x="${x}" y="${y + 15}" text-anchor="middle" font-size="10" fill="#333">127V</text>
      `
    } else if (fases === 2) {
      simbolo = `
        <circle cx="${x}" cy="${y}" r="28" fill="none" stroke="#006699" stroke-width="2"/>
        <line x1="${x - 20}" y1="${y}" x2="${x - 5}" y2="${y}" stroke="#006699" stroke-width="2"/>
        <line x1="${x + 5}" y1="${y}" x2="${x + 20}" y2="${y}" stroke="#006699" stroke-width="2"/>
        <text x="${x}" y="${y - 5}" text-anchor="middle" font-size="12" font-weight="bold" fill="#006699">2Ø</text>
        <text x="${x}" y="${y + 15}" text-anchor="middle" font-size="10" fill="#333">220V</text>
      `
    } else {
      simbolo = `
        <circle cx="${x}" cy="${y}" r="28" fill="none" stroke="#006699" stroke-width="2"/>
        <line x1="${x - 22}" y1="${y - 15}" x2="${x - 10}" y2="${y - 8}" stroke="#006699" stroke-width="2"/>
        <line x1="${x}" y1="${y - 22}" x2="${x}" y2="${y - 10}" stroke="#006699" stroke-width="2"/>
        <line x1="${x + 22}" y1="${y - 15}" x2="${x + 10}" y2="${y - 8}" stroke="#006699" stroke-width="2"/>
        <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="12" font-weight="bold" fill="#006699">3Ø</text>
        <text x="${x}" y="${y + 20}" text-anchor="middle" font-size="10" fill="#333">380V</text>
      `
    }

    return simbolo
  }

  const desenharRede = (x, y, fases) => {
    let simbolo = ''

    if (fases === 1) {
      simbolo = `
        <circle cx="${x}" cy="${y}" r="22" fill="none" stroke="#009900" stroke-width="3"/>
        <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="10" font-weight="bold" fill="#009900">Rede</text>
      `
    } else if (fases === 2) {
      simbolo = `
        <circle cx="${x}" cy="${y}" r="22" fill="none" stroke="#009900" stroke-width="3"/>
        <line x1="${x - 18}" y1="${y}" x2="${x - 5}" y2="${y}" stroke="#009900" stroke-width="2"/>
        <line x1="${x + 5}" y1="${y}" x2="${x + 18}" y2="${y}" stroke="#009900" stroke-width="2"/>
        <text x="${x}" y="${y + 8}" text-anchor="middle" font-size="9" font-weight="bold" fill="#009900">Rede</text>
      `
    } else {
      simbolo = `
        <circle cx="${x}" cy="${y}" r="22" fill="none" stroke="#009900" stroke-width="3"/>
        <line x1="${x - 20}" y1="${y - 12}" x2="${x - 8}" y2="${y - 5}" stroke="#009900" stroke-width="2"/>
        <line x1="${x}" y1="${y - 20}" x2="${x}" y2="${y - 8}" stroke="#009900" stroke-width="2"/>
        <line x1="${x + 20}" y1="${y - 12}" x2="${x + 8}" y2="${y - 5}" stroke="#009900" stroke-width="2"/>
        <text x="${x}" y="${y + 8}" text-anchor="middle" font-size="9" font-weight="bold" fill="#009900">Rede</text>
      `
    }

    return simbolo
  }

  const desenharGND = (x, y) => `
    <circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#333" stroke-width="1"/>
    <line x1="${x}" y1="${y + 5}" x2="${x}" y2="${y + 15}" stroke="#333" stroke-width="2"/>
    <line x1="${x - 8}" y1="${y + 15}" x2="${x + 8}" y2="${y + 15}" stroke="#333" stroke-width="2"/>
    <line x1="${x - 6}" y1="${y + 18}" x2="${x + 6}" y2="${y + 18}" stroke="#333" stroke-width="2"/>
    <line x1="${x - 4}" y1="${y + 21}" x2="${x + 4}" y2="${y + 21}" stroke="#333" stroke-width="2"/>
  `

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <defs>
    <style>
      .titulo { font-size: 22px; font-weight: bold; fill: #333; }
      .subtitulo { font-size: 14px; font-weight: bold; fill: #666; }
      .info { font-size: 11px; fill: #666; }
      .label { font-size: 10px; font-weight: bold; fill: #333; }
      .legenda-titulo { font-size: 12px; font-weight: bold; fill: #333; }
      .legenda-item { font-size: 10px; fill: #555; }
    </style>
  </defs>

  <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#f9f9f9" stroke="#ddd" stroke-width="1"/>

  <text x="700" y="35" text-anchor="middle" class="titulo">DIAGRAMA UNIFILAR - SISTEMA FOTOVOLTAICO</text>
  <text x="700" y="55" text-anchor="middle" class="info">${nome} | ${nomeCliente}</text>

  <rect x="50" y="70" width="1300" height="60" fill="#f0f7ff" stroke="#0066CC" stroke-width="1" rx="3"/>
  <text x="70" y="90" class="subtitulo">Dados do Sistema:</text>
  <text x="70" y="108" class="info">Potência: ${potenciaArredondada} kWp | Painéis: ${numPaineis} | Inversores: ${numInversores} | Strings: ${numStrings}</text>
  <text x="750" y="90" class="subtitulo">Tipo de Ligação:</text>
  <text x="750" y="108" class="info">${faseInfo.label} | Concessionária: ${distribuidora} | Data: ${dataCurrent}</text>

  <text x="100" y="180" class="label">PAINEL SOLAR</text>
`

  let yPainel = layout.marginTop + 50
  let painelPorString = Math.ceil(numPaineis / numStrings)
  let xPainel = layout.marginLeft
  let idPainel = 1

  for (let s = 0; s < numStrings; s++) {
    let numPainelNesta = Math.ceil((numPaineis - s * painelPorString) / (numStrings - s))
    let xPainelAtual = xPainel

    for (let p = 0; p < numPainelNesta; p++) {
      // Verificar se ultrapassa limite horizontal
      if (xPainelAtual + 50 > layout.acZoneX - layout.marginRight) break

      svg += desenharPainel(xPainelAtual, yPainel, idPainel)
      xPainelAtual += layout.painelSpacing

      if (p < numPainelNesta - 1) {
        svg += `<line x1="${xPainelAtual - 75}" y1="${yPainel + 35}" x2="${xPainelAtual}" y2="${yPainel + 35}" stroke="#333" stroke-width="2"/>\n`
      }

      idPainel++
    }

    svg += `<line x1="${xPainelAtual - 75}" y1="${yPainel + 35}" x2="${xPainelAtual + 30}" y2="${yPainel + 35}" stroke="#333" stroke-width="2"/>\n`
    svg += desenharDisjuntor(xPainelAtual + 45, yPainel + 35, `DC${s + 1}`)
    svg += `<text x="${xPainelAtual + 45}" y="${yPainel + 80}" text-anchor="middle" class="label">Desconexão ${s + 1}</text>\n`

    yPainel += layout.stringSpacing
  }

  let yJuncao = yPainel - 110 + 35
  svg += `<line x1="50" y1="235" x2="50" y2="${yJuncao}" stroke="#333" stroke-width="3"/>\n`

  let inversorY = yJuncao + 80
  svg += `<line x1="50" y1="${yJuncao}" x2="50" y2="${inversorY}" stroke="#333" stroke-width="3"/>\n`

  // Divisor visual DC/AC
  svg += `<line x1="700" y1="140" x2="700" y2="${yGND + 40}" stroke="#999" stroke-width="1" stroke-dasharray="3,3"/>\n`
  svg += `<text x="700" y="155" text-anchor="middle" font-size="10" fill="#999" font-weight="bold">AC</text>\n`
  svg += `<text x="380" y="155" text-anchor="middle" font-size="10" fill="#999" font-weight="bold">DC</text>\n`

  svg += desenharInversor(250, inversorY)

  svg += desenharCaboComInfo(340, inversorY + 35, 480, inversorY + 35)
  svg += `\n`
  svg += desenharDisjuntor(520, inversorY + 35, `${disjuntorMaximo}A`)
  svg += `<text x="520" y="${inversorY + 75}" text-anchor="middle" class="label">Desconexão AC</text>\n`

  svg += `<line x1="540" y1="${inversorY + 35}" x2="700" y2="${inversorY + 35}" stroke="#333" stroke-width="2"/>\n`
  svg += `<rect x="700" y="${inversorY}" width="100" height="70" fill="none" stroke="#333" stroke-width="2" rx="3"/>\n`
  svg += `<text x="750" y="${inversorY + 30}" text-anchor="middle" class="label">Quadro AC</text>\n`
  svg += `<text x="750" y="${inversorY + 50}" text-anchor="middle" class="info">${faseInfo.label}</text>\n`

  svg += `<line x1="800" y1="${inversorY + 35}" x2="950" y2="${inversorY + 35}" stroke="#333" stroke-width="2"/>\n`
  svg += desenharMedidor(1050, inversorY + 35, faseInfo.fases)

  svg += `<line x1="1078" y1="${inversorY + 35}" x2="1180" y2="${inversorY + 35}" stroke="#333" stroke-width="3"/>\n`
  svg += desenharRede(1280, inversorY + 35, faseInfo.fases)

  let yGND = inversorY + 150
  svg += `<line x1="1050" y1="${inversorY + 35}" x2="1050" y2="${yGND}" stroke="#FF0000" stroke-width="2" stroke-dasharray="5,5"/>\n`
  svg += desenharGND(1050, yGND)
  svg += `<text x="1090" y="${yGND + 5}" class="label">Aterramento</text>\n`

  // Garantir que a legend não overflow
  const legendY = Math.min(yGND + 40, SVG_HEIGHT - 160)

  svg += `
  <rect x="50" y="${legendY}" width="600" height="140" fill="#fafafa" stroke="#ccc" stroke-width="1" rx="3"/>
  <text x="70" y="${legendY + 20}" class="legenda-titulo">ESPECIFICAÇÕES TÉCNICAS</text>

  <text x="70" y="${legendY + 45}" class="legenda-item">• Potência: ${potenciaArredondada} kWp</text>
  <text x="70" y="${legendY + 65}" class="legenda-item">• Painéis: ${numPaineis} | Strings: ${numStrings}</text>
  <text x="70" y="${legendY + 85}" class="legenda-item">• Cabo AC: ${bitolaCabo}mm² | Disjuntor: ${disjuntorMaximo}A</text>
  <text x="70" y="${legendY + 105}" class="legenda-item">• Tensão AC: ${faseInfo.tensao} | ${faseInfo.label}</text>

  <text x="700" y="${Math.min(SVG_HEIGHT - 20, legendY + 130)}" text-anchor="middle" class="info">
    Diagrama Unifilar gerado em ${dataCurrent} | Projeto: ${nome}
  </text>

</svg>
`

  return svg
}

export const baixarUnifilarSVG = (svg, projeto = 'unifilar') => {
  const nomeArquivo = `unifilar_${projeto}_${new Date().toISOString().split('T')[0]}.svg`

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = nomeArquivo
  link.click()

  URL.revokeObjectURL(link.href)
}

export const converterSVGparaPNG = async (svg, nomeArquivo = 'unifilar.png') => {
  console.log('Função de conversão para PNG disponível')
  console.log('Para usar, instale: npm install html2canvas')
}
