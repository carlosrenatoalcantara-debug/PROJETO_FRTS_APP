// Biblioteca de símbolos SVG para diagramas unifilares
// Símbolos técnicos padronizados IEC

export const DIMENSOES = {
  largura: 1200,
  altura: 800,
  margemX: 50,
  margemY: 50,
}

export function criarSVG(conteudo, titulo = 'Diagrama Unifilar') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${DIMENSOES.largura}" height="${DIMENSOES.altura}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DIMENSOES.largura} ${DIMENSOES.altura}">
  <defs>
    <style>
      .titulo { font-size: 18px; font-weight: bold; font-family: Arial; }
      .label { font-size: 12px; font-family: Arial; text-anchor: middle; }
      .pequeno { font-size: 10px; font-family: Arial; text-anchor: middle; }
      .linha { stroke: #000; stroke-width: 2; fill: none; }
      .linha-fina { stroke: #666; stroke-width: 1; fill: none; }
      .circulo { fill: #fff; stroke: #000; stroke-width: 2; }
    </style>
  </defs>

  <!-- Fundo -->
  <rect width="${DIMENSOES.largura}" height="${DIMENSOES.altura}" fill="#fafafa"/>

  <!-- Título -->
  <text x="${DIMENSOES.largura / 2}" y="30" class="titulo" text-anchor="middle">${titulo}</text>

  <!-- Conteúdo -->
  ${conteudo}
</svg>`
}

export function painel(x, y, quantidade = 1, rotulo = 'Painéis') {
  const altura = 40
  const largura = 50

  return `
    <!-- Painel FV: ${quantidade}x -->
    <g id="painel-${x}-${y}">
      <!-- Símbolo: Quadrado com diagonal -->
      <rect x="${x}" y="${y}" width="${largura}" height="${altura}" class="linha"/>
      <line x1="${x}" y1="${y}" x2="${x + largura}" y2="${y + altura}" class="linha"/>
      <line x1="${x + largura}" y1="${y}" x2="${x}" y2="${y + altura}" class="linha"/>

      <!-- Setas de entrada (lado solar) -->
      <path d="M ${x + largura / 2} ${y - 15} L ${x + largura / 2} ${y}" class="linha" marker-end="url(#arrowhead)"/>

      <!-- Descrição -->
      <text x="${x + largura / 2}" y="${y + altura + 25}" class="label">${rotulo}</text>
      <text x="${x + largura / 2}" y="${y + altura + 40}" class="pequeno">${quantidade}x ${quantidade > 1 ? 'painéis' : 'painel'}</text>
    </g>
  `
}

export function stringBox(x, y, numeroStrings = 2, voltagem = '48V') {
  const altura = 60
  const largura = 80

  return `
    <!-- String Box / Combinador DC -->
    <g id="string-box-${x}-${y}">
      <rect x="${x}" y="${y}" width="${largura}" height="${altura}" class="linha" rx="5"/>

      <!-- Entradas para strings -->
      ${Array.from({ length: numeroStrings }, (_, i) => `
        <line x1="${x + (i + 1) * largura / (numeroStrings + 1)}" y1="${y - 15}"
              x2="${x + (i + 1) * largura / (numeroStrings + 1)}" y2="${y}" class="linha"/>
        <text x="${x + (i + 1) * largura / (numeroStrings + 1)}" y="${y - 20}" class="pequeno">S${i + 1}</text>
      `).join('')}

      <!-- Saída -->
      <line x1="${x + largura / 2}" y1="${y + altura}" x2="${x + largura / 2}" y2="${y + altura + 15}" class="linha"/>

      <!-- Rótulo -->
      <text x="${x + largura / 2}" y="${y + altura / 2}" class="label">String Box</text>
      <text x="${x + largura / 2}" y="${y + altura / 2 + 20}" class="pequeno">${numeroStrings}x ${voltagem}</text>
    </g>
  `
}

export function inversor(x, y, potenciaKW = 5, modelo = 'Inversor') {
  const altura = 70
  const largura = 100

  return `
    <!-- Inversor -->
    <g id="inversor-${x}-${y}">
      <rect x="${x}" y="${y}" width="${largura}" height="${altura}" class="linha" rx="3"/>

      <!-- Entrada DC (superior) -->
      <line x1="${x + largura / 2}" y1="${y - 15}" x2="${x + largura / 2}" y2="${y}" class="linha"/>
      <text x="${x + largura / 2}" y="${y - 20}" class="pequeno">DC</text>

      <!-- Saída AC (inferior) -->
      <line x1="${x + largura / 2}" y1="${y + altura}" x2="${x + largura / 2}" y2="${y + altura + 15}" class="linha"/>
      <text x="${x + largura / 2}" y="${y + altura + 35}" class="pequeno">AC</text>

      <!-- Símbolo: ondas -->
      <path d="M ${x + 20} ${y + 30} Q ${x + 30} ${y + 20} ${x + 40} ${y + 30}" class="linha"/>
      <path d="M ${x + 40} ${y + 30} Q ${x + 50} ${y + 20} ${x + 60} ${y + 30}" class="linha"/>
      <path d="M ${x + 60} ${y + 30} Q ${x + 70} ${y + 20} ${x + 80} ${y + 30}" class="linha"/>

      <!-- Rótulo -->
      <text x="${x + largura / 2}" y="${y + altura + 50}" class="label">${modelo}</text>
      <text x="${x + largura / 2}" y="${y + altura + 65}" class="pequeno">${potenciaKW} kW</text>
    </g>
  `
}

export function disjuntor(x, y, corrente = '63A', tipo = 'C') {
  const tamanho = 30

  return `
    <!-- Disjuntor -->
    <g id="disjuntor-${x}-${y}">
      <!-- Entrada -->
      <line x1="${x}" y1="${y}" x2="${x + 10}" y2="${y}" class="linha"/>

      <!-- Símbolo: linha com arco -->
      <line x1="${x + 10}" y1="${y}" x2="${x + 10}" y2="${y + tamanho}" class="linha"/>
      <arc x="${x + 10}" y="${y + 10}" r="8" class="linha"/>

      <!-- Saída -->
      <line x1="${x + 10}" y1="${y + tamanho}" x2="${x + 10}" y2="${y + tamanho + 10}" class="linha"/>

      <!-- Rótulo -->
      <text x="${x + 25}" y="${y + tamanho / 2}" class="label">${tipo}${corrente}</text>
    </g>
  `
}

export function medidorBidirecional(x, y) {
  const tamanho = 40

  return `
    <!-- Medidor Bidirecional -->
    <g id="medidor-${x}-${y}">
      <!-- Entrada -->
      <line x1="${x}" y1="${y}" x2="${x + 15}" y2="${y}" class="linha"/>

      <!-- Círculo do medidor -->
      <circle cx="${x + 25}" cy="${y}" r="${tamanho / 2}" class="circulo"/>

      <!-- Símbolo: M (medidor) -->
      <text x="${x + 25}" y="${y + 5}" class="label">M</text>

      <!-- Saída -->
      <line x1="${x + 35}" y1="${y}" x2="${x + 50}" y2="${y}" class="linha"/>

      <!-- Rótulo -->
      <text x="${x + 25}" y="${y + 40}" class="label">Medidor</text>
      <text x="${x + 25}" y="${y + 55}" class="pequeno">Bidirecional</text>
    </g>
  `
}

export function bateria(x, y, capacidade = 10, voltagem = '48V') {
  const altura = 60
  const largura = 50

  return `
    <!-- Bateria / BESS -->
    <g id="bateria-${x}-${y}">
      <!-- Símbolo de bateria -->
      <rect x="${x}" y="${y}" width="${largura}" height="${altura}" class="linha" rx="3"/>
      <rect x="${x + 5}" y="${y + 5}" width="${largura - 10}" height="${altura - 10}" class="linha-fina"/>

      <!-- Pólo positivo (superior) -->
      <line x1="${x + largura / 2}" y1="${y - 15}" x2="${x + largura / 2}" y2="${y}" class="linha"/>

      <!-- Pólo negativo (inferior) -->
      <line x1="${x + largura / 2}" y1="${y + altura}" x2="${x + largura / 2}" y2="${y + altura + 15}" class="linha"/>

      <!-- Rótulo -->
      <text x="${x + largura / 2}" y="${y + altura + 35}" class="label">BESS</text>
      <text x="${x + largura / 2}" y="${y + altura + 50}" class="pequeno">${capacidade} kWh • ${voltagem}</text>
    </g>
  `
}

export function carregadorEV(x, y, potencia = 7, voltagem = '220V') {
  const altura = 60
  const largura = 80

  return `
    <!-- Carregador EV -->
    <g id="carregador-${x}-${y}">
      <rect x="${x}" y="${y}" width="${largura}" height="${altura}" class="linha" rx="5"/>

      <!-- Entrada -->
      <line x1="${x + largura / 2}" y1="${y - 15}" x2="${x + largura / 2}" y2="${y}" class="linha"/>
      <text x="${x + largura / 2}" y="${y - 20}" class="pequeno">AC ${voltagem}</text>

      <!-- Saída -->
      <line x1="${x + largura / 2}" y1="${y + altura}" x2="${x + largura / 2}" y2="${y + altura + 15}" class="linha"/>

      <!-- Símbolo: plug -->
      <circle cx="${x + largura / 2}" cy="${y + altura / 2}" r="8" class="circulo"/>

      <!-- Rótulo -->
      <text x="${x + largura / 2}" y="${y + altura + 35}" class="label">Carregador EV</text>
      <text x="${x + largura / 2}" y="${y + altura + 50}" class="pequeno">${potencia} kW</text>
    </g>
  `
}

export function rede(x, y, fases = 3, tensao = '220/380V') {
  const tamanho = 50

  return `
    <!-- Rede Elétrica -->
    <g id="rede-${x}-${y}">
      <!-- Símbolo: 3 ondas (trifásico) ou 1 onda (monofásico) -->
      ${Array.from({ length: fases }, (_, i) => `
        <path d="M ${x + 10 + i * 15} ${y + 10} Q ${x + 15 + i * 15} ${y} ${x + 20 + i * 15} ${y + 10}"
              class="linha" stroke-width="2"/>
      `).join('')}

      <!-- Rótulo -->
      <text x="${x + tamanho / 2}" y="${y + 50}" class="label">Rede</text>
      <text x="${x + tamanho / 2}" y="${y + 65}" class="pequeno">${fases}F • ${tensao}</text>
    </g>
  `
}

export function seta(x1, y1, x2, y2, rotulo = '') {
  return `
    <!-- Seta de fluxo -->
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="linha" marker-end="url(#arrowhead)"/>
    ${rotulo ? `<text x="${(x1 + x2) / 2 + 10}" y="${(y1 + y2) / 2 - 5}" class="pequeno">${rotulo}</text>` : ''}
  `
}

export function legendaFV() {
  return `
    <!-- Legenda -->
    <g id="legenda">
      <rect x="10" y="650" width="300" height="130" fill="#f5f5f5" stroke="#999" stroke-width="1"/>
      <text x="20" y="670" class="label" text-anchor="start">LEGENDA - FV</text>
      <text x="20" y="690" class="pequeno" text-anchor="start">DC: Corrente contínua</text>
      <text x="20" y="705" class="pequeno" text-anchor="start">AC: Corrente alternada</text>
      <text x="20" y="720" class="pequeno" text-anchor="start">String: Série de painéis</text>
      <text x="20" y="735" class="pequeno" text-anchor="start">MPPT: Máxima potência</text>
      <text x="20" y="750" class="pequeno" text-anchor="start">BESS: Bateria armazenamento</text>
      <text x="20" y="765" class="pequeno" text-anchor="start">DR: Diferencial residual 30mA</text>
    </g>
  `
}

export function legendaEV() {
  return `
    <!-- Legenda -->
    <g id="legenda">
      <rect x="10" y="650" width="300" height="130" fill="#f5f5f5" stroke="#999" stroke-width="1"/>
      <text x="20" y="670" class="label" text-anchor="start">LEGENDA - EV</text>
      <text x="20" y="690" class="pequeno" text-anchor="start">AC: Corrente alternada</text>
      <text x="20" y="705" class="pequeno" text-anchor="start">DR: Diferencial residual 30mA</text>
      <text x="20" y="720" class="pequeno" text-anchor="start">Carregador: Wall Box ou Pedestal</text>
      <text x="20" y="735" class="pequeno" text-anchor="start">Cabo: Espessura e comprimento</text>
      <text x="20" y="750" class="pequeno" text-anchor="start">Tensão padrão Brasil: 220V/380V</text>
      <text x="20" y="765" class="pequeno" text-anchor="start">Padrão técnico: NBR IEC 61936</text>
    </g>
  `
}

export function marcadores() {
  return `
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <polygon points="0 0, 10 3, 0 6" fill="#000"/>
      </marker>
    </defs>
  `
}
