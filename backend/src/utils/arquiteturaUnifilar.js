// Diagrama unifilar da arquitetura PROJETO_FRTS_APP
// Mesmo estilo que o diagrama de energia fotovoltaica
// Símbolos técnicos personalizados para arquitetura de sistema

export const DIMENSOES = {
  largura: 1400,
  altura: 900,
  margemX: 50,
  margemY: 50,
}

export function criarSVGArquitetura(conteudo, titulo = 'Arquitetura PROJETO_FRTS_APP') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${DIMENSOES.largura}" height="${DIMENSOES.altura}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DIMENSOES.largura} ${DIMENSOES.altura}">
  <defs>
    <style>
      .titulo { font-size: 20px; font-weight: bold; font-family: Arial; }
      .label { font-size: 12px; font-family: Arial; text-anchor: middle; }
      .pequeno { font-size: 10px; font-family: Arial; text-anchor: middle; }
      .linha { stroke: #000; stroke-width: 2; fill: none; }
      .linha-fina { stroke: #666; stroke-width: 1; fill: none; }
      .linha-tracejada { stroke: #999; stroke-width: 2; stroke-dasharray: 5,5; fill: none; }
      .circulo { fill: #fff; stroke: #000; stroke-width: 2; }
      .bloco-principal { fill: #e3f2fd; stroke: #1976d2; stroke-width: 2; }
      .bloco-externa { fill: #fff3e0; stroke: #f57c00; stroke-width: 2; }
      .bloco-database { fill: #f3e5f5; stroke: #7b1fa2; stroke-width: 2; }
    </style>
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <polygon points="0 0, 10 3, 0 6" fill="#000"/>
      </marker>
      <marker id="arrowhead-laranja" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <polygon points="0 0, 10 3, 0 6" fill="#f57c00"/>
      </marker>
    </defs>
  </defs>

  <!-- Fundo -->
  <rect width="${DIMENSOES.largura}" height="${DIMENSOES.altura}" fill="#fafafa"/>

  <!-- Título -->
  <text x="${DIMENSOES.largura / 2}" y="35" class="titulo" text-anchor="middle">${titulo}</text>
  <text x="${DIMENSOES.largura / 2}" y="55" class="pequeno" text-anchor="middle">Sistema de Carregadores EV + Inversores Solar</text>

  <!-- Conteúdo -->
  ${conteudo}
</svg>`
}

// ========== COMPONENTES PRINCIPAIS ==========

export function usuariosWeb(x, y) {
  return `
    <!-- Usuários Web -->
    <g id="usuarios-${x}-${y}">
      <!-- Ícone de usuários -->
      <circle cx="${x}" cy="${y - 20}" r="8" class="circulo"/>
      <circle cx="${x - 15}" cy="${y + 5}" r="8" class="circulo"/>
      <circle cx="${x + 15}" cy="${y + 5}" r="8" class="circulo"/>
      <path d="M ${x} ${y + 10} Q ${x - 20} ${y + 20} ${x - 30} ${y + 30}" class="linha"/>
      <path d="M ${x} ${y + 10} Q ${x + 20} ${y + 20} ${x + 30} ${y + 30}" class="linha"/>

      <!-- Linha de saída -->
      <line x1="${x}" y1="${y + 40}" x2="${x}" y2="${y + 60}" class="linha" marker-end="url(#arrowhead)"/>

      <!-- Rótulo -->
      <text x="${x}" y="${y + 85}" class="label">Usuários Web</text>
      <text x="${x}" y="${y + 100}" class="pequeno">https://projeto-frts-app.vercel.app</text>
    </g>
  `
}

export function frontendVercel(x, y) {
  const altura = 80
  const largura = 120

  return `
    <!-- Frontend Vercel -->
    <g id="frontend-${x}-${y}">
      <!-- Bloco principal -->
      <rect x="${x}" y="${y}" width="${largura}" height="${altura}" class="bloco-principal" rx="5"/>

      <!-- Entrada (de usuários) -->
      <line x1="${x + largura / 2}" y1="${y - 20}" x2="${x + largura / 2}" y2="${y}" class="linha" marker-end="url(#arrowhead)"/>

      <!-- Saída (para API) -->
      <line x1="${x + largura}" y1="${y + altura / 2}" x2="${x + largura + 20}" y2="${y + altura / 2}" class="linha" marker-end="url(#arrowhead)"/>

      <!-- Símbolo: React -->
      <circle cx="${x + largura / 2}" cy="${y + 20}" r="5" class="linha"/>
      <text x="${x + largura / 2}" y="${y + 45}" class="label">React</text>
      <text x="${x + largura / 2}" y="${y + 60}" class="pequeno">Vite</text>

      <!-- Rótulo -->
      <text x="${x + largura / 2}" y="${y + altura + 25}" class="label">Frontend</text>
      <text x="${x + largura / 2}" y="${y + altura + 40}" class="pequeno">Vercel (Production)</text>
    </g>
  `
}

export function apiBackend(x, y) {
  const altura = 80
  const largura = 120

  return `
    <!-- API Backend Railway -->
    <g id="backend-${x}-${y}">
      <!-- Bloco principal -->
      <rect x="${x}" y="${y}" width="${largura}" height="${altura}" class="bloco-principal" rx="5"/>

      <!-- Entrada (do frontend) -->
      <line x1="${x - 20}" y1="${y + altura / 2}" x2="${x}" y2="${y + altura / 2}" class="linha" marker-end="url(#arrowhead)"/>

      <!-- Saída para BD -->
      <line x1="${x + largura / 2}" y1="${y + altura}" x2="${x + largura / 2}" y2="${y + altura + 20}" class="linha" marker-end="url(#arrowhead)"/>

      <!-- Saída para APIs externas -->
      <line x1="${x + largura}" y1="${y + altura / 2}" x2="${x + largura + 20}" y2="${y + altura / 2}" class="linha" marker-end="url(#arrowhead-laranja)"/>

      <!-- Símbolo: Node.js -->
      <polygon points="${x + largura / 2 - 10},${y + 25} ${x + largura / 2 + 10},${y + 25} ${x + largura / 2 + 5},${y + 40} ${x + largura / 2 - 5},${y + 40}" class="linha"/>
      <text x="${x + largura / 2}" y="${y + 60}" class="label">Node.js</text>
      <text x="${x + largura / 2}" y="${y + 75}" class="pequeno">Express</text>

      <!-- Rótulo -->
      <text x="${x + largura / 2}" y="${y + altura + 45}" class="label">Backend API</text>
      <text x="${x + largura / 2}" y="${y + altura + 60}" class="pequeno">Railway (Production)</text>
    </g>
  `
}

export function mongodbAtlas(x, y) {
  const altura = 80
  const largura = 120

  return `
    <!-- MongoDB Atlas -->
    <g id="mongodb-${x}-${y}">
      <!-- Bloco principal -->
      <rect x="${x}" y="${y}" width="${largura}" height="${altura}" class="bloco-database" rx="5"/>

      <!-- Entrada (do backend) -->
      <line x1="${x + largura / 2}" y1="${y - 20}" x2="${x + largura / 2}" y2="${y}" class="linha" marker-end="url(#arrowhead)"/>

      <!-- Saída (back ao backend) -->
      <line x1="${x + largura / 2}" y1="${y + altura}" x2="${x + largura / 2}" y2="${y + altura + 20}" class="linha" marker-end="url(#arrowhead)"/>
      <text x="${x + largura / 2 + 40}" y="${y + altura + 15}" class="pequeno">Queries</text>

      <!-- Símbolo: Cilindro BD -->
      <ellipse cx="${x + largura / 2}" cy="${y + 20}" rx="15" ry="8" class="linha"/>
      <line x1="${x + largura / 2 - 15}" y1="${y + 20}" x2="${x + largura / 2 - 15}" y2="${y + 50}" class="linha"/>
      <line x1="${x + largura / 2 + 15}" y1="${y + 20}" x2="${x + largura / 2 + 15}" y2="${y + 50}" class="linha"/>
      <ellipse cx="${x + largura / 2}" cy="${y + 50}" rx="15" ry="8" class="linha"/>

      <!-- Rótulo -->
      <text x="${x + largura / 2}" y="${y + altura + 45}" class="label">MongoDB</text>
      <text x="${x + largura / 2}" y="${y + altura + 60}" class="pequeno">Atlas Cloud</text>
    </g>
  `
}

export function apiExterna(x, y, nome = 'API Externa', cor = '#f57c00') {
  const altura = 60
  const largura = 100

  return `
    <!-- API Externa -->
    <g id="api-ext-${x}-${y}">
      <!-- Bloco -->
      <rect x="${x}" y="${y}" width="${largura}" height="${altura}" class="bloco-externa" rx="3"/>

      <!-- Entrada -->
      <line x1="${x - 20}" y1="${y + altura / 2}" x2="${x}" y2="${y + altura / 2}" class="linha-tracejada"/>

      <!-- Símbolo: ∞ (integração) -->
      <path d="M ${x + 25} ${y + 20} Q ${x + 35} ${y + 10} ${x + 45} ${y + 20} Q ${x + 55} ${y + 30} ${x + 45} ${y + 40} Q ${x + 35} ${y + 50} ${x + 25} ${y + 40}" class="linha"/>

      <!-- Rótulo -->
      <text x="${x + largura / 2}" y="${y + altura + 20}" class="label">${nome}</text>
    </g>
  `
}

export function legendaArquitetura() {
  return `
    <!-- Legenda -->
    <g id="legenda">
      <rect x="50" y="750" width="1300" height="120" class="linha-fina" fill="#f5f5f5"/>

      <text x="70" y="775" class="label" text-anchor="start" font-weight="bold">LEGENDA:</text>

      <!-- Setas -->
      <line x1="70" y1="800" x2="100" y2="800" class="linha" marker-end="url(#arrowhead)"/>
      <text x="115" y="805" class="pequeno" text-anchor="start">Fluxo de dados principal</text>

      <line x1="370" y1="800" x2="400" y2="800" class="linha-tracejada" marker-end="url(#arrowhead-laranja)"/>
      <text x="415" y="805" class="pequeno" text-anchor="start">Integração com APIs externas</text>

      <!-- Blocos -->
      <rect x="70" y="820" width="15" height="15" class="bloco-principal"/>
      <text x="95" y="832" class="pequeno" text-anchor="start">Serviços Internos (Production)</text>

      <rect x="370" y="820" width="15" height="15" class="bloco-externa"/>
      <text x="395" y="832" class="pequeno" text-anchor="start">APIs Externas</text>

      <rect x="700" y="820" width="15" height="15" class="bloco-database"/>
      <text x="725" y="832" class="pequeno" text-anchor="start">Banco de Dados</text>

      <!-- Status -->
      <circle cx="1070" cy="827" r="6" class="circulo" fill="#4caf50"/>
      <text x="1090" y="832" class="pequeno" text-anchor="start">Online ✓</text>
    </g>
  `
}

// ========== FLUXO COMPLETO ==========

export function gerarArquiteturaCompleta() {
  let conteudo = ''

  // 1. Usuários (esquerda)
  conteudo += usuariosWeb(150, 120)

  // 2. Frontend (primeiro bloco principal)
  conteudo += frontendVercel(100, 200)

  // 3. API Backend (segundo bloco principal)
  conteudo += apiBackend(350, 200)

  // 4. Banco de Dados (abaixo do backend)
  conteudo += mongodbAtlas(380, 380)

  // 5. APIs Externas (direita)
  conteudo += apiExterna(650, 200, 'Google Gemini\n(Vision/IA)', '#f57c00')
  conteudo += apiExterna(650, 310, 'SolarMarket API\n(Preços)', '#f57c00')
  conteudo += apiExterna(650, 420, 'APIs Futuras\n(Expandir)', '#f57c00')

  // 6. Conexões entre componentes
  conteudo += `
    <!-- Conexão Frontend → Backend -->
    <path d="M 220 240 L 350 240" class="linha" marker-end="url(#arrowhead)" stroke-width="2"/>
    <text x="275" y="230" class="pequeno">REST API</text>

    <!-- Conexão Backend → Google Gemini -->
    <path d="M 470 230 L 650 230" class="linha-tracejada" marker-end="url(#arrowhead-laranja)" stroke-width="2"/>
    <text x="550" y="220" class="pequeno">Vision Analysis</text>

    <!-- Conexão Backend → SolarMarket -->
    <path d="M 470 240 L 650 340" class="linha-tracejada" marker-end="url(#arrowhead-laranja)" stroke-width="2"/>

    <!-- Conexão Backend → APIs Futuras -->
    <path d="M 470 250 L 650 450" class="linha-tracejada" marker-end="url(#arrowhead-laranja)" stroke-width="2"/>

    <!-- Retorno de dados -->
    <path d="M 620 230 L 470 250" class="linha-tracejada" stroke-width="1" stroke-dasharray="3,3"/>
    <path d="M 620 340 L 470 270" class="linha-tracejada" stroke-width="1" stroke-dasharray="3,3"/>
  `

  // 7. Seção de informações
  conteudo += `
    <!-- Informações do Sistema -->
    <g id="info-sistema">
      <text x="50" y="650" class="label" text-anchor="start" font-weight="bold">STATUS DO SISTEMA:</text>

      <rect x="50" y="670" width="300" height="70" class="linha-fina" fill="#fff9c4" rx="3"/>
      <text x="70" y="695" class="pequeno" text-anchor="start">✓ Frontend: ONLINE (Vercel)</text>
      <text x="70" y="715" class="pequeno" text-anchor="start">✓ Backend API: ONLINE (Railway)</text>
      <text x="70" y="735" class="pequeno" text-anchor="start">✓ MongoDB: Conectando (Fallback ativo)</text>

      <rect x="400" y="670" width="350" height="70" class="linha-fina" fill="#e8f5e9" rx="3"/>
      <text x="420" y="695" class="pequeno" text-anchor="start">✓ 27 Carregadores EV (Limpos)</text>
      <text x="420" y="715" class="pequeno" text-anchor="start">✓ Google Gemini Vision: ATIVO (FREE)</text>
      <text x="420" y="735" class="pequeno" text-anchor="start">✓ Extração de Datasheets: FUNCIONANDO</text>

      <rect x="800" y="670" width="550" height="70" class="linha-fina" fill="#f3e5f5" rx="3"/>
      <text x="820" y="690" class="pequeno" text-anchor="start" font-weight="bold">COMPONENTES PRINCIPAIS:</text>
      <text x="820" y="710" class="pequeno" text-anchor="start">• Carregadores EV • Inversores • Baterias • Propostas EV</text>
      <text x="820" y="730" class="pequeno" text-anchor="start">• Dashboard CRM • Extração PDFs • Analytics</text>
    </g>
  `

  // 8. Legenda
  conteudo += legendaArquitetura()

  return conteudo
}
