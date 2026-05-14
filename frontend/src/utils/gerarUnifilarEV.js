// Geração de unifilar A4 paisagem para EV com fotos e assinatura técnico

export function gerarUnifilarEVSVG(dados) {
  const {
    projeto_nome,
    endereco,
    cliente_nome,
    cliente_telefone,
    carregador_tipo,
    carregador_potencia_kw,
    carregador_marca,
    carregador_modelo,
    calculos,
    fotos = [],
    tecnico_nome,
    tecnico_crea,
  } = dados

  const width = 1200
  const height = 842 // A4 paisagem em pixels (297mm × 210mm)
  const margin = 30
  const contentWidth = width - 2 * margin

  // Dividir o espaço em 2 colunas: esquerda (diagrama) e direita (fotos + specs)
  const diagramaWidth = contentWidth * 0.55
  const fotosWidth = contentWidth * 0.45
  const gap = 20

  let yPos = margin + 20

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background:white">
    <defs>
      <style>
        .titulo { font-size: 16px; font-weight: bold; fill: #1f2937; }
        .subtitulo { font-size: 12px; font-weight: bold; fill: #374151; }
        .texto { font-size: 10px; fill: #4b5563; }
        .pequeno { font-size: 9px; fill: #6b7280; }
        .linha { stroke: #374151; stroke-width: 2; }
        .linha-fina { stroke: #d1d5db; stroke-width: 1; }
        .linha-divisao { stroke: #9ca3af; stroke-width: 1; stroke-dasharray: 3,3; }
        .box { stroke: #374151; stroke-width: 1.5; fill: #f3f4f6; }
        .box-esp { stroke: #2563eb; stroke-width: 1.5; fill: #dbeafe; }
      </style>
    </defs>

    <!-- CABEÇALHO -->
    <rect x="${margin}" y="15" width="${contentWidth}" height="35" class="box"/>
    <text x="${margin + 10}" y="35" class="titulo">UNIFILAR - SISTEMA DE CARREGAMENTO ELÉTRICO VEICULAR</text>
    <text x="${margin + 10}" y="50" class="pequeno">Projeto: ${projeto_nome} | Data: ${new Date().toLocaleDateString('pt-BR')}</text>

    <!-- BLOCO ESQUERDO: DIAGRAMA -->
    ${gerarDiagramaCircuito(margin + 10, 70, diagramaWidth - 20, 600, carregador_tipo, calculos)}

    <!-- BLOCO DIREITO: FOTOS E ESPECIFICAÇÕES -->
    ${gerarFotosEspecs(margin + diagramaWidth + gap, 70, fotosWidth - 20, fotos, cliente_nome, endereco, carregador_marca, carregador_modelo, carregador_potencia_kw, calculos)}

    <!-- MATERIAIS E ESPECIFICAÇÕES TÉCNICAS (RODAPÉ) -->
    ${gerarMateriais(margin, 680, contentWidth, calculos.materiais)}

    <!-- RODAPÉ: ASSINATURA E DADOS EMPRESA -->
    ${gerarRodape(margin, 760, contentWidth, tecnico_nome, tecnico_crea)}
  </svg>`

  return svg
}

function gerarDiagramaCircuito(x, y, width, height, tipo_carregador, calculos) {
  const centerX = x + width / 2
  const boxHeight = 50
  const boxWidth = 120
  const step = 80

  return `
    <!-- TÍTULO DIAGRAMA -->
    <text x="${x}" y="${y - 10}" class="subtitulo">DIAGRAMA UNIFILAR</text>

    <!-- FONTE (Rede) -->
    <rect x="${centerX - boxWidth/2}" y="${y}" width="${boxWidth}" height="${boxHeight}" class="box"/>
    <text x="${centerX - 30}" y="${y + 20}" class="texto">REDE</text>
    <text x="${centerX - 45}" y="${y + 35}" class="pequeno">${calculos.corrente_projeto_a.toFixed(1)}A</text>
    <line x1="${centerX}" y1="${y + boxHeight}" x2="${centerX}" y2="${y + boxHeight + 15}" class="linha"/>

    <!-- DISJUNTOR -->
    <rect x="${centerX - boxWidth/2}" y="${y + step * 1.2}" width="${boxWidth}" height="${boxHeight}" class="box-esp"/>
    <text x="${centerX - 30}" y="${y + step * 1.2 + 20}" class="texto">Disjuntor</text>
    <text x="${centerX - 35}" y="${y + step * 1.2 + 35}" class="pequeno">${calculos.disjuntor_a}A</text>
    <line x1="${centerX}" y1="${y + step * 1.2 - 15}" x2="${centerX}" y2="${y + step * 1.2}" class="linha"/>
    <line x1="${centerX}" y1="${y + step * 1.2 + boxHeight}" x2="${centerX}" y2="${y + step * 1.2 + boxHeight + 15}" class="linha"/>

    <!-- DPS (PROTEÇÃO CONTRA SURTOS) - OBRIGATÓRIO -->
    <rect x="${centerX - boxWidth/2}" y="${y + step * 2}" width="${boxWidth}" height="${boxHeight}" class="box-esp" stroke="#ff6b35" stroke-width="2"/>
    <text x="${centerX - 20}" y="${y + step * 2 + 20}" class="texto">DPS</text>
    <text x="${centerX - 40}" y="${y + step * 2 + 35}" class="pequeno">${calculos.dps_kv}V</text>
    <line x1="${centerX}" y1="${y + step * 2 - 15}" x2="${centerX}" y2="${y + step * 2}" class="linha"/>
    <line x1="${centerX}" y1="${y + step * 2 + boxHeight}" x2="${centerX}" y2="${y + step * 2 + boxHeight + 15}" class="linha"/>

    <!-- DR -->
    <rect x="${centerX - boxWidth/2}" y="${y + step * 2.8}" width="${boxWidth}" height="${boxHeight}" class="box-esp"/>
    <text x="${centerX - 15}" y="${y + step * 2.8 + 20}" class="texto">DR</text>
    <text x="${centerX - 35}" y="${y + step * 2.8 + 35}" class="pequeno">${calculos.dr_ma}mA</text>
    <line x1="${centerX}" y1="${y + step * 2.8 - 15}" x2="${centerX}" y2="${y + step * 2.8}" class="linha"/>
    <line x1="${centerX}" y1="${y + step * 2.8 + boxHeight}" x2="${centerX}" y2="${y + step * 2.8 + boxHeight + 15}" class="linha"/>

    <!-- CABO -->
    <rect x="${centerX - boxWidth/2}" y="${y + step * 3.6}" width="${boxWidth}" height="${boxHeight}" class="box"/>
    <text x="${centerX - 50}" y="${y + step * 3.6 + 20}" class="texto">Cabo</text>
    <text x="${centerX - 55}" y="${y + step * 3.6 + 35}" class="pequeno">${calculos.bitola_cabo_mm2}mm²</text>
    <line x1="${centerX}" y1="${y + step * 3.6 - 15}" x2="${centerX}" y2="${y + step * 3.6}" class="linha"/>
    <line x1="${centerX}" y1="${y + step * 3.6 + boxHeight}" x2="${centerX}" y2="${y + step * 3.6 + boxHeight + 15}" class="linha"/>

    <!-- CARREGADOR -->
    <rect x="${centerX - boxWidth/2}" y="${y + step * 4.4}" width="${boxWidth}" height="${boxHeight}" class="box-esp"/>
    <text x="${centerX - 40}" y="${y + step * 4.4 + 20}" class="texto">Carregador</text>
    <text x="${centerX - 40}" y="${y + step * 4.4 + 35}" class="pequeno">${tipo_carregador}</text>
    <line x1="${centerX}" y1="${y + step * 4.4 - 15}" x2="${centerX}" y2="${y + step * 4.4}" class="linha"/>
  `
}

function gerarFotosEspecs(x, y, width, fotos, cliente_nome, endereco, marca, modelo, potencia, calculos) {
  const fotoHeight = 120
  const gapFotos = 10

  let html = `
    <text x="${x}" y="${y - 10}" class="subtitulo">FOTOS DA INSTALAÇÃO</text>
  `

  // Renderizar até 2 fotos
  const fotosRender = fotos.slice(0, 2)
  fotosRender.forEach((foto, idx) => {
    const fotoY = y + idx * (fotoHeight + gapFotos)
    html += `
      <rect x="${x}" y="${fotoY}" width="${width}" height="${fotoHeight}" class="linha-fina" fill="#f9fafb"/>
      <text x="${x + 5}" y="${fotoY + 50}" class="pequeno" text-anchor="start">[Foto ${idx + 1}: ${foto.descricao || 'Instalação'}]</text>
    `
  })

  const especsY = y + 260
  html += `
    <text x="${x}" y="${especsY - 10}" class="subtitulo">ESPECIFICAÇÕES</text>

    <rect x="${x}" y="${especsY}" width="${width}" height="150" class="box"/>

    <text x="${x + 5}" y="${especsY + 18}" class="texto" font-weight="bold">Cliente:</text>
    <text x="${x + 150}" y="${especsY + 18}" class="texto">${cliente_nome}</text>

    <text x="${x + 5}" y="${especsY + 33}" class="texto" font-weight="bold">Endereço:</text>
    <text x="${x + 150}" y="${especsY + 33}" class="pequeno">${endereco.substring(0, 35)}</text>

    <text x="${x + 5}" y="${especsY + 51}" class="texto" font-weight="bold">Carregador:</text>
    <text x="${x + 150}" y="${especsY + 51}" class="pequeno">${marca} ${modelo}</text>

    <text x="${x + 5}" y="${especsY + 69}" class="texto" font-weight="bold">Potência:</text>
    <text x="${x + 150}" y="${especsY + 69}" class="pequeno">${potencia}kW</text>

    <text x="${x + 5}" y="${especsY + 87}" class="texto" font-weight="bold">Queda tensão:</text>
    <text x="${x + 150}" y="${especsY + 87}" class="pequeno">${calculos.queda_tensao_pct.toFixed(2)}%</text>

    <text x="${x + 5}" y="${especsY + 105}" class="texto" font-weight="bold">Corrente máx:</text>
    <text x="${x + 150}" y="${especsY + 105}" class="pequeno">${calculos.corrente_maxima_a.toFixed(1)}A</text>

    <text x="${x + 5}" y="${especsY + 123}" class="texto" font-weight="bold">Seccionamento:</text>
    <text x="${x + 150}" y="${especsY + 123}" class="pequeno">${calculos.tempo_seccionamento_s}s</text>
  `

  return html
}

function gerarMateriais(x, y, width, materiais) {
  const colWidth = (width - 20) / 3
  let html = `
    <text x="${x}" y="${y - 5}" class="subtitulo">MATERIAIS E EQUIPAMENTOS</text>
    <rect x="${x}" y="${y}" width="${width}" height="60" class="box"/>

    <line x1="${x + colWidth}" y1="${y}" x2="${x + colWidth}" y2="${y + 60}" class="linha-fina"/>
    <line x1="${x + colWidth * 2}" y1="${y}" x2="${x + colWidth * 2}" y2="${y + 60}" class="linha-fina"/>

    <line x1="${x}" y1="${y + 15}" x2="${x + width}" y2="${y + 15}" class="linha-fina"/>
  `

  // Cabeçalho
  html += `
    <text x="${x + 5}" y="${y + 12}" class="pequeno" font-weight="bold">Item</text>
    <text x="${x + colWidth + 5}" y="${y + 12}" class="pequeno" font-weight="bold">Especificação</text>
    <text x="${x + colWidth * 2 + 5}" y="${y + 12}" class="pequeno" font-weight="bold">Qtd</text>
  `

  // Dados
  const materiaisMostrados = materiais.slice(0, 2) // Mostrar apenas 2 primeiros por espaço
  materiaisMostrados.forEach((mat, idx) => {
    const yItem = y + 30 + idx * 15
    html += `
      <text x="${x + 5}" y="${yItem}" class="pequeno">${mat.item.substring(0, 15)}</text>
      <text x="${x + colWidth + 5}" y="${yItem}" class="pequeno">${mat.especificacao.substring(0, 20)}</text>
      <text x="${x + colWidth * 2 + 5}" y="${yItem}" class="pequeno">${mat.quantidade}</text>
    `
  })

  return html
}

function gerarRodape(x, y, width, tecnico_nome, tecnico_crea) {
  return `
    <line x1="${x}" y1="${y - 10}" x2="${x + width}" y2="${y - 10}" class="linha-fina"/>

    <text x="${x}" y="${y + 15}" class="texto" font-weight="bold">Responsável Técnico:</text>
    <text x="${x}" y="${y + 30}" class="texto">${tecnico_nome || 'Não informado'}</text>
    <text x="${x}" y="${y + 42}" class="pequeno">CREA: ${tecnico_crea || 'N/A'}</text>

    <line x1="${x + 200}" y1="${y + 5}" x2="${x + 200}" y2="${y + 50}" class="linha-fina"/>
    <text x="${x + 210}" y="${y + 20}" class="pequeno" font-weight="bold">Assinatura do Técnico:</text>
    <line x1="${x + 210}" y1="${y + 50}" x2="${x + 450}" y2="${y + 50}" class="linha"/>

    <line x1="${x + 500}" y1="${y + 5}" x2="${x + 500}" y2="${y + 50}" class="linha-fina"/>
    <text x="${x + 510}" y="${y + 20}" class="pequeno" font-weight="bold">Aprovação do Cliente:</text>
    <line x1="${x + 510}" y1="${y + 50}" x2="${x + 750}" y2="${y + 50}" class="linha"/>

    <!-- DADOS EMPRESA (RODAPÉ) -->
    <text x="${x + width - 350}" y="${y + 15}" class="pequeno" font-weight="bold">FORTE SOLAR</text>
    <text x="${x + width - 350}" y="${y + 28}" class="pequeno">Rua Landy Almeida Costa, 135 - CS3</text>
    <text x="${x + width - 350}" y="${y + 41}" class="pequeno">São Gonçalo do Amarante/RN | CEP: 59290-021</text>
    <text x="${x + width - 350}" y="${y + 54}" class="pequeno">Tel: (84) 99404-7722</text>
  `
}

export function gerarUnifilarEVPDF(dados) {
  const svg = gerarUnifilarEVSVG(dados)
  // Este arquivo será integrado com html2pdf ou jsPDF no componente
  return svg
}
