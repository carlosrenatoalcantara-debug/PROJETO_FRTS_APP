/**
 * Componentes SVG Realistas para Diagrama Unifilar
 * Desenhos dos componentes elétricos (Disjuntor, DR, DPS, etc)
 */

export const ComponentesDiagrama = {
  // REDE
  rede: (x, y, tamanho = 60) => `
    <g transform="translate(${x}, ${y})">
      <!-- Símbolo de REDE (círculo com tres fases) -->
      <circle cx="0" cy="0" r="${tamanho / 2}" fill="#f97316" stroke="#ea580c" stroke-width="2"/>
      <text x="0" y="0" text-anchor="middle" dy="0.3em" fill="white" font-size="12" font-weight="bold">~</text>
      <text x="0" y="18" text-anchor="middle" fill="#666" font-size="10" font-weight="bold">REDE</text>
    </g>
  `,

  // CABO
  cabo: (x, y, tamanho = 60, bitola = '10mm²') => `
    <g transform="translate(${x}, ${y})">
      <!-- Símbolo de CABO -->
      <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#10b981" stroke="#059669" stroke-width="2" rx="4"/>
      <text x="0" y="-6" text-anchor="middle" fill="white" font-size="11" font-weight="bold">CABO</text>
      <text x="0" y="8" text-anchor="middle" fill="white" font-size="10">${bitola}</text>
    </g>
  `,

  // DISJUNTOR BIPOLAR (realista)
  disjuntorBipolar: (x, y, tamanho = 65, corrente = '32A') => `
    <g transform="translate(${x}, ${y})">
      <!-- Base do disjuntor -->
      <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#e8f4f8" stroke="#3b82f6" stroke-width="2" rx="3"/>

      <!-- Duas alavancas (disjuntor bipolar) -->
      <rect x="${-18}" y="${-15}" width="12" height="20" fill="#333" stroke="#000" stroke-width="1" rx="2"/>
      <rect x="${6}" y="${-15}" width="12" height="20" fill="#333" stroke="#000" stroke-width="1" rx="2"/>

      <!-- Indicador ON -->
      <text x="0" y="2" text-anchor="middle" fill="#1f2937" font-size="9" font-weight="bold">ON</text>

      <!-- Label -->
      <text x="0" y="22" text-anchor="middle" fill="#1e40af" font-size="10" font-weight="bold">Disjuntor</text>
      <text x="0" y="33" text-anchor="middle" fill="#1e40af" font-size="9">${corrente}</text>
    </g>
  `,

  // DR (Dispositivo de Proteção Diferencial - RCD) - realista
  dr: (x, y, tamanho = 65, sensibilidade = '30mA') => `
    <g transform="translate(${x}, ${y})">
      <!-- Base do DR -->
      <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#f3e8ff" stroke="#a855f7" stroke-width="2" rx="3"/>

      <!-- Duas alavancas -->
      <rect x="${-18}" y="${-15}" width="12" height="20" fill="#333" stroke="#000" stroke-width="1" rx="2"/>
      <rect x="${6}" y="${-15}" width="12" height="20" fill="#333" stroke="#000" stroke-width="1" rx="2"/>

      <!-- Botão TEST (vermelho) -->
      <circle cx="0" cy="8" r="6" fill="#ef4444" stroke="#dc2626" stroke-width="1"/>
      <text x="0" y="9" text-anchor="middle" dy="0.3em" fill="white" font-size="7" font-weight="bold">T</text>

      <!-- Label -->
      <text x="0" y="26" text-anchor="middle" fill="#5b21b6" font-size="10" font-weight="bold">DR</text>
      <text x="0" y="36" text-anchor="middle" fill="#5b21b6" font-size="9">${sensibilidade}</text>
    </g>
  `,

  // DPS (Dispositivo de Proteção contra Surtos) - realista
  dps: (x, y, tamanho = 65, tensao = '275V') => `
    <g transform="translate(${x}, ${y})">
      <!-- Base do DPS -->
      <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#fed7aa" stroke="#fb923c" stroke-width="3" rx="3"/>

      <!-- Elemento de proteção (triângulo com fundo) -->
      <rect x="${-14}" y="${-12}" width="28" height="24" fill="#fff7ed" stroke="#f97316" stroke-width="1" rx="2"/>
      <polygon points="0,-5 8,5 -8,5" fill="#ff6b35"/>

      <!-- Indicador de funcionamento -->
      <circle cx="12" cy="8" r="3" fill="#dc2626"/>

      <!-- Label -->
      <text x="0" y="25" text-anchor="middle" fill="#92400e" font-size="10" font-weight="bold">DPS</text>
      <text x="0" y="35" text-anchor="middle" fill="#92400e" font-size="9">${tensao}</text>
    </g>
  `,

  // CARREGADOR EV
  carregador: (x, y, tamanho = 65, potencia = '7kW') => `
    <g transform="translate(${x}, ${y})">
      <!-- Caixa carregador -->
      <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#fbcfe8" stroke="#db2777" stroke-width="2" rx="4"/>

      <!-- Painel frontal -->
      <rect x="${-22}" y="${-18}" width="44" height="32" fill="#fce7f3" stroke="#db2777" stroke-width="1" rx="2"/>

      <!-- LED indicador -->
      <circle cx="0" cy="-8" r="3" fill="#10b981" stroke="#059669" stroke-width="1"/>

      <!-- Conector de plugue -->
      <rect x="${-8}" y="16" width="16" height="8" fill="#666" stroke="#333" stroke-width="1" rx="1"/>

      <!-- Label -->
      <text x="0" y="30" text-anchor="middle" fill="#831843" font-size="10" font-weight="bold">Carregador</text>
      <text x="0" y="40" text-anchor="middle" fill="#831843" font-size="9">${potencia}</text>
    </g>
  `,

  // ESPECIFICAÇÕES (Painel de Info)
  especificacoes: (x, y, tamanho = 70, titulo = 'SPECS') => `
    <g transform="translate(${x}, ${y})">
      <!-- Painel de info -->
      <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2" rx="4"/>

      <!-- Título -->
      <text x="0" y="${-12}" text-anchor="middle" fill="#1f2937" font-size="11" font-weight="bold">${titulo}</text>

      <!-- Linhas de info -->
      <line x1="${-25}" y1="0" x2="25" y2="0" stroke="#d1d5db" stroke-width="1"/>
      <circle cx="0" cy="15" r="2" fill="#1f2937"/>

      <!-- Label -->
      <text x="0" y="35" text-anchor="middle" fill="#1f2937" font-size="9" font-weight="bold">Especificações</text>
    </g>
  `,

  // LINHAS DE CONEXÃO (cabos)
  linhaConexao: (x1, y1, x2, y2, tipo = 'ca') => {
    const cor = tipo === 'cc' ? '#ef4444' : tipo === 'ca' ? '#3b82f6' : '#059669';
    return `
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cor}" stroke-width="3" stroke-linecap="round"/>
      <!-- Ponta de seta -->
      <polygon points="${x2},${y2} ${x2 - 8},${y2 - 5} ${x2 - 8},${y2 + 5}" fill="${cor}"/>
    `;
  }
};

/**
 * Renderizar SVG completo do diagrama com componentes realistas
 */
export function renderizarDiagramaRealista(nodes, width = 1200, height = 700) {
  const margemX = 80;
  const espacoY = 100;
  let yPos = 80;

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: #fafbfc; border: 1px solid #e5e7eb;">`;

  // Renderizar cada nó
  nodes.forEach((node, index) => {
    const xPos = width / 2;

    if (node.data.tipo === 'rede') {
      svg += ComponentesDiagrama.rede(xPos, yPos, 60);
    } else if (node.data.tipo === 'disjuntor') {
      yPos += espacoY;
      svg += ComponentesDiagrama.disjuntorBipolar(xPos, yPos, 65, `${node.data.corrente_a}A`);
    } else if (node.data.tipo === 'dps') {
      yPos += espacoY;
      svg += ComponentesDiagrama.dps(xPos, yPos, 65, `${node.data.tensao_kv}V`);
    } else if (node.data.tipo === 'dr') {
      yPos += espacoY;
      svg += ComponentesDiagrama.dr(xPos, yPos, 65, `${node.data.ma}mA`);
    } else if (node.data.tipo === 'cabo') {
      yPos += espacoY;
      svg += ComponentesDiagrama.cabo(xPos, yPos, 60, `${node.data.bitola_mm2}mm²`);
    } else if (node.data.tipo === 'carregador') {
      yPos += espacoY;
      svg += ComponentesDiagrama.carregador(xPos, yPos, 65, `${node.data.potencia_kw}kW`);
    }

    // Desenhar linhas de conexão
    if (index < nodes.length - 1) {
      const yProxima = yPos + espacoY;
      svg += ComponentesDiagrama.linhaConexao(xPos, yPos + 35, xPos, yProxima - 35, 'ca');
    }
  });

  svg += '</svg>';
  return svg;
}
