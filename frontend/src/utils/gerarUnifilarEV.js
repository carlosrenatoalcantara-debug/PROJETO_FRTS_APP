/**
 * gerarUnifilarEV.js — Layout Engine v2
 *
 * Motor de posicionamento determinístico para diagrama unifilar EV.
 * Nenhuma coordenada manual. Nenhum posicionamento aleatório.
 *
 * HIERARQUIA DO CANVAS (A4 Paisagem — 1200 × 842 px):
 *
 *   Região       │ y início │ altura │ conteúdo
 *   ─────────────┼──────────┼────────┼─────────────────────────────────
 *   Cabeçalho    │    0     │  118   │ logo + título + dados cliente + carregador
 *   Diagrama     │  125     │  265   │ fluxo horizontal QD→CABO→BOX EV→CARREGADOR→VEÍCULO
 *   Materiais    │  400     │  235   │ lista em 2 colunas (itens, qtd, un)
 *   Notas        │  643     │  100   │ notas técnicas e normativas (2 colunas)
 *   Rodapé       │  750     │   92   │ empresa + técnico + assinatura
 *
 * FLUXO DO DIAGRAMA (esquerda → direita):
 *   [QD EXISTENTE] ──cabo F+N+T──► [BOX EV: Disj+DR+DPS] ──cabo──► [CARREGADOR] ──Tipo X──► [VEÍCULO]
 *
 * Princípios:
 *  - Coordenadas calculadas deterministicamente a partir de constantes.
 *  - Linhas ortogonais. Sem cruzamentos (fluxo linear sem ramificações).
 *  - Espaçamento uniforme entre componentes.
 *  - Adaptação automática da fonte da lista de materiais (≤10: 10px; >10: 9px).
 *  - Impressão A4 paisagem sem reposicionamento manual.
 */

// ─── CONSTANTES DO CANVAS ─────────────────────────────────────────────────────

const W  = 1200   // largura total
const H  = 842    // altura total (A4 paisagem)
const M  = 40     // margem lateral

// Cores da paleta Forte Solar
const COR_VERDE_FS   = '#16a34a'
const COR_VERDE_DARK = '#15803d'
const COR_AZUL       = '#1d4ed8'
const COR_AZUL_BG    = '#dbeafe'
const COR_CINZA_BG   = '#f3f4f6'
const COR_CINZA_BRD  = '#d1d5db'
const COR_TEXT_DARK  = '#111827'
const COR_TEXT_MED   = '#374151'
const COR_TEXT_LIGHT = '#6b7280'
const COR_LARANJA    = '#ea580c'
const COR_ROXO       = '#7c3aed'

// ─── REGIÕES ─────────────────────────────────────────────────────────────────

const REG = {
  HEAD:  { y: 0,   h: 118 },
  DIAG:  { y: 125, h: 265 },
  MATL:  { y: 400, h: 235 },
  NOTE:  { y: 643, h: 100 },
  FOOT:  { y: 750, h: 92  },
}

// ─── POSIÇÕES DO DIAGRAMA ─────────────────────────────────────────────────────
// Wire Y: linha central horizontal do diagrama
const WIRE_Y = REG.DIAG.y + REG.DIAG.h / 2   // 257

// Componentes do diagrama (x, y, w, h)
const BLK = {
  QD:  { x: M,    y: REG.DIAG.y + 30, w: 155, h: 200 },
  BOX: { x: 335,  y: REG.DIAG.y + 5,  w: 330, h: 254 },
  CAR: { x: 745,  y: REG.DIAG.y + 35, w: 210, h: 195 },
  VEI: { x: 1015, y: REG.DIAG.y + 45, w: 145, h: 175 },
}

// Segmentos de fio
const WIRE = {
  // QD → BOX: cabo elétrico (rotulado)
  SEG1: { x1: BLK.QD.x + BLK.QD.w, x2: BLK.BOX.x, y: WIRE_Y },
  // BOX → CARREGADOR
  SEG2: { x1: BLK.BOX.x + BLK.BOX.w, x2: BLK.CAR.x, y: WIRE_Y },
  // CARREGADOR → VEÍCULO (conector)
  SEG3: { x1: BLK.CAR.x + BLK.CAR.w, x2: BLK.VEI.x, y: WIRE_Y },
}

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────

export function gerarUnifilarEVSVG(dados) {
  const {
    projeto_nome   = '',
    endereco       = '',
    cliente_nome   = '',
    cliente_uc     = '',
    carga_instalada_w = 0,
    carregador_tipo,
    carregador_potencia_kw,
    carregador_marca,
    carregador_modelo,
    carregador_conector,
    calculos,
    tecnico_nome,
    tecnico_crea,
    tecnico_cft,
    tecnico_tipo   = 'crea',
    data_projeto   = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  } = dados

  const W_UTIL = W - 2 * M   // 1120px

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="background:white;font-family:Arial,sans-serif">
  <defs>
    <style>
      text { font-family: Arial, Helvetica, sans-serif; }
    </style>
  </defs>

  ${secaoHeader(W, M, W_UTIL, projeto_nome, cliente_nome, endereco, cliente_uc, carga_instalada_w,
      carregador_marca, carregador_modelo, carregador_potencia_kw, carregador_tipo, carregador_conector,
      calculos, data_projeto)}

  ${secaoDiagrama(M, W_UTIL, carregador_marca, carregador_modelo, carregador_potencia_kw,
      carregador_tipo, carregador_conector, calculos)}

  ${secaoMateriais(M, W_UTIL, calculos?.materiais || [])}

  ${secaoNotas(M, W_UTIL, carregador_potencia_kw, calculos)}

  ${secaoRodape(M, W_UTIL, tecnico_nome, tecnico_crea, tecnico_cft, tecnico_tipo, data_projeto)}
</svg>`
}

// ─── CABEÇALHO ───────────────────────────────────────────────────────────────

function secaoHeader(W, M, W_UTIL, projeto_nome, cliente_nome, endereco, cliente_uc,
    carga_w, marca, modelo, potencia_kw, tipo, conector, calculos, data_projeto) {

  const metade = W_UTIL / 2 - 10

  return `
  <!-- ── CABEÇALHO ── -->
  <!-- Barra de título -->
  <rect x="${M}" y="5" width="${W_UTIL}" height="42" fill="${COR_VERDE_FS}" rx="3"/>
  <text x="${M + W_UTIL/2}" y="22" text-anchor="middle" font-size="15" font-weight="bold" fill="white">DIAGRAMA UNIFILAR</text>
  <text x="${M + W_UTIL/2}" y="38" text-anchor="middle" font-size="10" fill="#dcfce7">INSTALAÇÃO DE CARREGADOR VEICULAR EV</text>

  <!-- Logo/empresa à direita -->
  <text x="${M + W_UTIL - 5}" y="17" text-anchor="end" font-size="9" fill="white" font-weight="bold">Forte Solar</text>
  <text x="${M + W_UTIL - 5}" y="28" text-anchor="end" font-size="8" fill="#dcfce7">Natal/RN</text>
  <text x="${M + W_UTIL - 5}" y="38" text-anchor="end" font-size="8" fill="#dcfce7">${data_projeto}</text>

  <!-- Painel esquerdo: Dados do Cliente -->
  <rect x="${M}" y="52" width="${metade}" height="62" fill="${COR_CINZA_BG}" stroke="${COR_CINZA_BRD}" stroke-width="1" rx="2"/>
  <rect x="${M}" y="52" width="${metade}" height="14" fill="${COR_VERDE_DARK}" rx="2"/>
  <text x="${M + metade/2}" y="62" text-anchor="middle" font-size="8" font-weight="bold" fill="white">DADOS DO CLIENTE</text>

  <text x="${M + 6}" y="77" font-size="8" fill="${COR_TEXT_MED}" font-weight="bold">Nome:</text>
  <text x="${M + 45}" y="77" font-size="8" fill="${COR_TEXT_DARK}">${truncar(cliente_nome, 42)}</text>

  <text x="${M + 6}" y="89" font-size="8" fill="${COR_TEXT_MED}" font-weight="bold">Endereço:</text>
  <text x="${M + 45}" y="89" font-size="7.5" fill="${COR_TEXT_DARK}">${truncar(endereco, 44)}</text>

  <text x="${M + 6}" y="101" font-size="8" fill="${COR_TEXT_MED}" font-weight="bold">UC:</text>
  <text x="${M + 45}" y="101" font-size="8" fill="${COR_TEXT_DARK}">${cliente_uc || 'Não informado'}</text>

  <text x="${M + 6}" y="113" font-size="8" fill="${COR_TEXT_MED}" font-weight="bold">Carga atual:</text>
  <text x="${M + 65}" y="113" font-size="8" fill="${COR_TEXT_DARK}">${carga_w ? (carga_w/1000).toFixed(1)+' kW' : 'Não informado'}</text>

  <!-- Painel direito: Carregador EV -->
  <rect x="${M + metade + 20}" y="52" width="${metade}" height="62" fill="${COR_CINZA_BG}" stroke="${COR_CINZA_BRD}" stroke-width="1" rx="2"/>
  <rect x="${M + metade + 20}" y="52" width="${metade}" height="14" fill="${COR_AZUL}" rx="2"/>
  <text x="${M + metade + 20 + metade/2}" y="62" text-anchor="middle" font-size="8" font-weight="bold" fill="white">CARREGADOR VEICULAR EV</text>

  <text x="${M + metade + 26}" y="77" font-size="8" fill="${COR_TEXT_MED}" font-weight="bold">Modelo:</text>
  <text x="${M + metade + 26 + 46}" y="77" font-size="7.5" fill="${COR_TEXT_DARK}">${truncar(`${marca || ''} ${modelo || ''}`.trim(), 36)}</text>

  <text x="${M + metade + 26}" y="89" font-size="8" fill="${COR_TEXT_MED}" font-weight="bold">Potência:</text>
  <text x="${M + metade + 26 + 46}" y="89" font-size="8" fill="${COR_TEXT_DARK}">${potencia_kw ? potencia_kw + ' kW' : '—'}</text>

  <text x="${M + metade + 26}" y="101" font-size="8" fill="${COR_TEXT_MED}" font-weight="bold">Corrente:</text>
  <text x="${M + metade + 26 + 46}" y="101" font-size="8" fill="${COR_TEXT_DARK}">${calculos?.Ib_disjuntor ? calculos.Ib_disjuntor.toFixed(0) + ' A' : '—'}</text>

  <text x="${M + metade + 26}" y="113" font-size="8" fill="${COR_TEXT_MED}" font-weight="bold">Conector:</text>
  <text x="${M + metade + 26 + 46}" y="113" font-size="8" fill="${COR_TEXT_DARK}">${conector || tipo || '—'}</text>
  `
}

// ─── DIAGRAMA ────────────────────────────────────────────────────────────────

function secaoDiagrama(M, W_UTIL, marca, modelo, potencia_kw, tipo, conector, calculos) {
  if (!calculos) return `<text x="${M}" y="${REG.DIAG.y + 40}" font-size="10" fill="${COR_TEXT_LIGHT}">Sem dados de cálculo.</text>`

  const { bitola_cabo_mm2, disjuntor_a, dr_ma, dps_kv, corrente_projeto_a, queda_tensao_pct, Ib_disjuntor } = calculos

  // Sub-blocos dentro do BOX EV
  const BOX = BLK.BOX
  const subH = 72
  const subPad = 8
  const SUB = {
    DJ: { x: BOX.x + subPad, y: BOX.y + 22, w: BOX.w - 2*subPad, h: subH },
    DR: { x: BOX.x + subPad, y: BOX.y + 22 + subH + 6, w: BOX.w - 2*subPad, h: subH },
    DS: { x: BOX.x + subPad, y: BOX.y + 22 + (subH + 6)*2, w: BOX.w - 2*subPad, h: subH },
  }

  // Comprimento aparente do trecho (metros do percurso)
  // Derivado do BOM: pega o primeiro cabo que tem unidade 'm'
  const caboBOM = (calculos.materiais || []).find(m => m.unidade === 'm')
  const percurso_m = caboBOM?.quantidade || 0

  return `
  <!-- ── DIAGRAMA UNIFILAR ── -->
  <!-- Título da seção -->
  <text x="${M + W_UTIL/2}" y="${REG.DIAG.y + 15}" text-anchor="middle" font-size="10" font-weight="bold" fill="${COR_TEXT_MED}">DIAGRAMA UNIFILAR DO CIRCUITO</text>

  <!-- Linha de fio horizontal completa -->
  <line x1="${BLK.QD.x + BLK.QD.w}" x2="${BLK.VEI.x}" y1="${WIRE_Y}" y2="${WIRE_Y}" stroke="${COR_TEXT_MED}" stroke-width="2.5"/>

  <!-- ── QD EXISTENTE ── -->
  <rect x="${BLK.QD.x}" y="${BLK.QD.y}" width="${BLK.QD.w}" height="${BLK.QD.h}" fill="${COR_CINZA_BG}" stroke="${COR_TEXT_MED}" stroke-width="1.5" rx="2"/>
  <rect x="${BLK.QD.x}" y="${BLK.QD.y}" width="${BLK.QD.w}" height="18" fill="${COR_TEXT_MED}" rx="2"/>
  <text x="${BLK.QD.x + BLK.QD.w/2}" y="${BLK.QD.y + 12}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="white">QD EXISTENTE</text>
  <text x="${BLK.QD.x + BLK.QD.w/2}" y="${BLK.QD.y + 50}" text-anchor="middle" font-size="8" fill="${COR_TEXT_MED}">Disjuntor</text>
  <text x="${BLK.QD.x + BLK.QD.w/2}" y="${BLK.QD.y + 62}" text-anchor="middle" font-size="8" fill="${COR_TEXT_MED}">Geral</text>

  <!-- Símbolo disjuntor no QD -->
  ${simboloDisjuntor(BLK.QD.x + BLK.QD.w/2 - 12, BLK.QD.y + 75, 24, 40, COR_TEXT_DARK)}

  <!-- Stubs verticais do QD para o fio -->
  <line x1="${BLK.QD.x + BLK.QD.w/2}" y1="${BLK.QD.y + BLK.QD.h}" x2="${BLK.QD.x + BLK.QD.w/2}" y2="${WIRE_Y}" stroke="${COR_TEXT_MED}" stroke-width="1.5"/>

  <!-- ── RÓTULO DO CABO (SEG1) ── -->
  <text x="${(WIRE.SEG1.x1 + WIRE.SEG1.x2)/2}" y="${WIRE_Y - 22}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="${COR_TEXT_MED}">CABO</text>
  <text x="${(WIRE.SEG1.x1 + WIRE.SEG1.x2)/2}" y="${WIRE_Y - 12}" text-anchor="middle" font-size="7" fill="${COR_TEXT_LIGHT}">F+N+T · ${bitola_cabo_mm2}mm²</text>
  <text x="${(WIRE.SEG1.x1 + WIRE.SEG1.x2)/2}" y="${WIRE_Y - 2}" text-anchor="middle" font-size="7" fill="${COR_TEXT_LIGHT}">${percurso_m > 0 ? percurso_m + 'm' : ''}</text>

  <!-- ── BOX EV (PROTEÇÃO) ── -->
  <rect x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="${BOX.h}" fill="${COR_AZUL_BG}" stroke="${COR_AZUL}" stroke-width="2" rx="3"/>
  <rect x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="18" fill="${COR_AZUL}" rx="3"/>
  <text x="${BOX.x + BOX.w/2}" y="${BOX.y + 13}" text-anchor="middle" font-size="8" font-weight="bold" fill="white">PROTEÇÃO — BOX EV</text>

  <!-- Entrada do fio no BOX -->
  <line x1="${BOX.x}" y1="${WIRE_Y}" x2="${BOX.x + 12}" y2="${WIRE_Y}" stroke="${COR_AZUL}" stroke-width="2"/>
  <line x1="${BOX.x + BOX.w - 12}" y1="${WIRE_Y}" x2="${BOX.x + BOX.w}" y2="${WIRE_Y}" stroke="${COR_AZUL}" stroke-width="2"/>

  <!-- Sub-bloco: DISJUNTOR -->
  <rect x="${SUB.DJ.x}" y="${SUB.DJ.y}" width="${SUB.DJ.w}" height="${SUB.DJ.h}" fill="white" stroke="${COR_AZUL}" stroke-width="1" rx="2"/>
  ${simboloDisjuntor(SUB.DJ.x + 8, SUB.DJ.y + 10, 20, 35, COR_AZUL)}
  <text x="${SUB.DJ.x + 36}" y="${SUB.DJ.y + 16}" font-size="8" font-weight="bold" fill="${COR_AZUL}">Disjuntor</text>
  <text x="${SUB.DJ.x + 36}" y="${SUB.DJ.y + 27}" font-size="7.5" fill="${COR_TEXT_MED}">${disjuntor_a}A · 2P · Curva C</text>
  <text x="${SUB.DJ.x + 36}" y="${SUB.DJ.y + 38}" font-size="7" fill="${COR_TEXT_LIGHT}">Ib ≤ In ≤ Iz</text>
  <text x="${SUB.DJ.x + 36}" y="${SUB.DJ.y + 48}" font-size="7" fill="${COR_TEXT_LIGHT}">Ib=${Ib_disjuntor?.toFixed(0)}A · Iz=${calculos.capacidade_cabo_a}A</text>
  <!-- Linha de conexão vertical dentro do BOX -->
  <line x1="${BOX.x + BOX.w/2}" y1="${SUB.DJ.y + SUB.DJ.h}" x2="${BOX.x + BOX.w/2}" y2="${SUB.DR.y}" stroke="${COR_AZUL}" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Sub-bloco: DR -->
  <rect x="${SUB.DR.x}" y="${SUB.DR.y}" width="${SUB.DR.w}" height="${SUB.DR.h}" fill="white" stroke="${COR_VERDE_FS}" stroke-width="1" rx="2"/>
  ${simboloDR(SUB.DR.x + 8, SUB.DR.y + 10, 20, 35, COR_VERDE_FS)}
  <text x="${SUB.DR.x + 36}" y="${SUB.DR.y + 16}" font-size="8" font-weight="bold" fill="${COR_VERDE_FS}">DR</text>
  <text x="${SUB.DR.x + 36}" y="${SUB.DR.y + 27}" font-size="7.5" fill="${COR_TEXT_MED}">${dr_ma}mA · Tipo A</text>
  <text x="${SUB.DR.x + 36}" y="${SUB.DR.y + 38}" font-size="7" fill="${COR_TEXT_LIGHT}">NBR 5410 — Obrigatório EV</text>
  <text x="${SUB.DR.x + 36}" y="${SUB.DR.y + 48}" font-size="7" fill="${COR_TEXT_LIGHT}">${disjuntor_a}A · ${dr_ma}mA</text>
  <line x1="${BOX.x + BOX.w/2}" y1="${SUB.DR.y + SUB.DR.h}" x2="${BOX.x + BOX.w/2}" y2="${SUB.DS.y}" stroke="${COR_LARANJA}" stroke-width="1" stroke-dasharray="3,2"/>

  <!-- Sub-bloco: DPS -->
  <rect x="${SUB.DS.x}" y="${SUB.DS.y}" width="${SUB.DS.w}" height="${SUB.DS.h}" fill="white" stroke="${COR_LARANJA}" stroke-width="1" rx="2"/>
  ${simboloDPS(SUB.DS.x + 8, SUB.DS.y + 10, 20, 35, COR_LARANJA)}
  <text x="${SUB.DS.x + 36}" y="${SUB.DS.y + 16}" font-size="8" font-weight="bold" fill="${COR_LARANJA}">DPS Tipo 2</text>
  <text x="${SUB.DS.x + 36}" y="${SUB.DS.y + 27}" font-size="7.5" fill="${COR_TEXT_MED}">${dps_kv}V · Classe II</text>
  <text x="${SUB.DS.x + 36}" y="${SUB.DS.y + 38}" font-size="7" fill="${COR_TEXT_LIGHT}">20kA · NBR 5410</text>
  <text x="${SUB.DS.x + 36}" y="${SUB.DS.y + 48}" font-size="7" fill="${COR_TEXT_LIGHT}">String Box c/ DPS</text>

  <!-- ── RÓTULO SEG2 ── -->
  <text x="${(WIRE.SEG2.x1 + WIRE.SEG2.x2)/2}" y="${WIRE_Y - 8}" text-anchor="middle" font-size="7" fill="${COR_TEXT_LIGHT}">+N</text>

  <!-- ── CARREGADOR EV ── -->
  <rect x="${BLK.CAR.x}" y="${BLK.CAR.y}" width="${BLK.CAR.w}" height="${BLK.CAR.h}" fill="${COR_AZUL_BG}" stroke="${COR_AZUL}" stroke-width="2" rx="3"/>
  <rect x="${BLK.CAR.x}" y="${BLK.CAR.y}" width="${BLK.CAR.w}" height="18" fill="${COR_AZUL}" rx="3"/>
  <text x="${BLK.CAR.x + BLK.CAR.w/2}" y="${BLK.CAR.y + 13}" text-anchor="middle" font-size="8" font-weight="bold" fill="white">CARREGADOR EV</text>
  ${simboloCarregador(BLK.CAR.x + 10, BLK.CAR.y + 24, 38, 60)}
  <text x="${BLK.CAR.x + 56}" y="${BLK.CAR.y + 38}" font-size="8" font-weight="bold" fill="${COR_TEXT_DARK}">${truncar(`${marca || ''} ${modelo || ''}`.trim(), 16)}</text>
  <text x="${BLK.CAR.x + 56}" y="${BLK.CAR.y + 50}" font-size="8" fill="${COR_TEXT_MED}">${potencia_kw ? potencia_kw + ' kW' : '—'}</text>
  <text x="${BLK.CAR.x + 56}" y="${BLK.CAR.y + 62}" font-size="7.5" fill="${COR_TEXT_MED}">${Ib_disjuntor ? Ib_disjuntor.toFixed(0) + 'A' : '—'}</text>
  <text x="${BLK.CAR.x + 10}" y="${BLK.CAR.y + 105}" font-size="7.5" fill="${COR_TEXT_MED}">Conector:</text>
  <text x="${BLK.CAR.x + 10}" y="${BLK.CAR.y + 116}" font-size="8" font-weight="bold" fill="${COR_AZUL}">${conector || tipo || '—'}</text>
  <text x="${BLK.CAR.x + 10}" y="${BLK.CAR.y + 130}" font-size="7" fill="${COR_TEXT_LIGHT}">ΔU = ${queda_tensao_pct?.toFixed(2) || '—'}%</text>

  <!-- Linha vertical do carregador ao fio -->
  <line x1="${BLK.CAR.x + BLK.CAR.w/2}" y1="${BLK.CAR.y + BLK.CAR.h}" x2="${BLK.CAR.x + BLK.CAR.w/2}" y2="${WIRE_Y}" stroke="${COR_AZUL}" stroke-width="1.5"/>

  <!-- ── RÓTULO SEG3 (conector) ── -->
  <text x="${(WIRE.SEG3.x1 + WIRE.SEG3.x2)/2}" y="${WIRE_Y - 10}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="${COR_ROXO}">${conector || 'Tipo 2'}</text>
  <text x="${(WIRE.SEG3.x1 + WIRE.SEG3.x2)/2}" y="${WIRE_Y - 2}" text-anchor="middle" font-size="7" fill="${COR_TEXT_LIGHT}">cabo do carregador</text>

  <!-- ── VEÍCULO ELÉTRICO ── -->
  <rect x="${BLK.VEI.x}" y="${BLK.VEI.y}" width="${BLK.VEI.w}" height="${BLK.VEI.h}" fill="${COR_CINZA_BG}" stroke="${COR_TEXT_MED}" stroke-width="1.5" rx="3"/>
  <rect x="${BLK.VEI.x}" y="${BLK.VEI.y}" width="${BLK.VEI.w}" height="18" fill="${COR_TEXT_MED}" rx="3"/>
  <text x="${BLK.VEI.x + BLK.VEI.w/2}" y="${BLK.VEI.y + 13}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="white">VEÍCULO ELÉTRICO</text>
  ${simboloVeiculo(BLK.VEI.x + BLK.VEI.w/2 - 25, BLK.VEI.y + 28, 50, 80)}
  `
}

// ─── LISTA DE MATERIAIS ───────────────────────────────────────────────────────

function secaoMateriais(M, W_UTIL, materiais) {
  const Y = REG.MATL.y
  const H_SEC = REG.MATL.h

  // Cabeçalho
  let out = `
  <!-- ── LISTA DE MATERIAIS ── -->
  <rect x="${M}" y="${Y}" width="${W_UTIL}" height="${H_SEC}" fill="${COR_CINZA_BG}" stroke="${COR_CINZA_BRD}" stroke-width="1" rx="2"/>
  <rect x="${M}" y="${Y}" width="${W_UTIL}" height="16" fill="${COR_TEXT_MED}" rx="2"/>
  <text x="${M + W_UTIL/2}" y="${Y + 11}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="white">LISTA DE MATERIAIS</text>

  <!-- Cabeçalho colunas -->
  <line x1="${M}" y1="${Y + 16}" x2="${M + W_UTIL}" y2="${Y + 16}" stroke="${COR_CINZA_BRD}" stroke-width="1"/>
  <text x="${M + 12}" y="${Y + 27}" font-size="7.5" font-weight="bold" fill="${COR_TEXT_MED}">ITEM</text>
  <text x="${M + 55}" y="${Y + 27}" font-size="7.5" font-weight="bold" fill="${COR_TEXT_MED}">DESCRIÇÃO</text>
  <text x="${M + W_UTIL/2 + 5}" y="${Y + 27}" font-size="7.5" font-weight="bold" fill="${COR_TEXT_MED}">DESCRIÇÃO</text>
  <line x1="${M}" y1="${Y + 30}" x2="${M + W_UTIL}" y2="${Y + 30}" stroke="${COR_CINZA_BRD}" stroke-width="0.5"/>
  `

  // Determinação da fonte e espaçamento por quantidade de itens
  const fontSize = materiais.length > 14 ? 8 : 9
  const lineH    = materiais.length > 14 ? 13 : 15

  // Dividir em 2 colunas
  const metade     = Math.ceil(materiais.length / 2)
  const colW       = W_UTIL / 2 - 15
  const COL_QTD_W  = 40
  const COL_UN_W   = 35

  for (let i = 0; i < materiais.length; i++) {
    const mat    = materiais[i]
    const colIdx = i < metade ? 0 : 1
    const rowIdx = i < metade ? i : i - metade
    const xBase  = M + 10 + colIdx * (W_UTIL / 2)
    const yItem  = Y + 38 + rowIdx * lineH

    out += `
  <text x="${xBase}" y="${yItem}" font-size="${fontSize}" fill="${COR_TEXT_MED}">${String(i + 1).padStart(2, '0')}</text>
  <text x="${xBase + 20}" y="${yItem}" font-size="${fontSize}" fill="${COR_TEXT_DARK}">${truncar(mat.item, 28)}</text>
  <text x="${xBase + 200}" y="${yItem}" font-size="${fontSize - 0.5}" fill="${COR_TEXT_LIGHT}">${truncar(mat.especificacao || '', 18)}</text>
  <text x="${xBase + colW - COL_QTD_W - COL_UN_W}" y="${yItem}" text-anchor="end" font-size="${fontSize}" font-weight="bold" fill="${COR_TEXT_DARK}">${mat.quantidade}</text>
  <text x="${xBase + colW - COL_UN_W + 5}" y="${yItem}" font-size="${fontSize}" fill="${COR_TEXT_LIGHT}">${mat.unidade || ''}</text>
    `

    // Linha separadora entre colunas
    if (colIdx === 0) {
      out += `<line x1="${M + W_UTIL/2}" y1="${Y + 16}" x2="${M + W_UTIL/2}" y2="${Y + H_SEC}" stroke="${COR_CINZA_BRD}" stroke-width="0.5"/>`
    }
  }

  return out
}

// ─── NOTAS TÉCNICAS ──────────────────────────────────────────────────────────

function secaoNotas(M, W_UTIL, potencia_kw, calculos) {
  const Y = REG.NOTE.y

  const notas = [
    'Instalação conforme NBR 5410:2004, NBR 13570 e IEC 61851-1.',
    `Disjuntor ${calculos?.disjuntor_a || '—'}A Curva C, capacidade mínima 6kA.`,
    `DR ${calculos?.dr_ma || '—'}mA Tipo A, obrigatório NBR 5410.`,
    `Cabo ${calculos?.bitola_cabo_mm2 || '—'}mm² Cu 0,6/1kV (F+N+T por condutor).`,
    `Queda de tensão: ${calculos?.queda_tensao_pct?.toFixed(2) || '—'}% (limite NBR 5410: 3%).`,
    'String Box com DPS Tipo 2 (Classe II) obrigatório.',
    'Aterramento TN-S, resistência ≤ 10 Ω.',
    `Demanda adicional: +${potencia_kw || '—'} kW — verificar disjuntor geral.`,
    'Imagens ilustrativas. Instalação por profissional habilitado.',
    'Documento técnico para homologação concessionária.',
  ]

  const metade = Math.ceil(notas.length / 2)
  let out = `
  <!-- ── NOTAS TÉCNICAS ── -->
  <rect x="${M}" y="${Y}" width="${W_UTIL}" height="${REG.NOTE.h}" fill="#fffbeb" stroke="#fde68a" stroke-width="1" rx="2"/>
  <rect x="${M}" y="${Y}" width="${W_UTIL}" height="16" fill="#d97706" rx="2"/>
  <text x="${M + W_UTIL/2}" y="${Y + 11}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="white">NOTAS TÉCNICAS E NORMATIVAS</text>
  <line x1="${M + W_UTIL/2}" y1="${Y + 16}" x2="${M + W_UTIL/2}" y2="${Y + REG.NOTE.h}" stroke="#fde68a" stroke-width="0.5"/>
  `

  notas.forEach((nota, i) => {
    const col  = i < metade ? 0 : 1
    const row  = i < metade ? i : i - metade
    const x    = M + 10 + col * (W_UTIL / 2)
    const y    = Y + 28 + row * 12
    out += `<text x="${x}" y="${y}" font-size="7.5" fill="#78350f">${i + 1}. ${nota}</text>`
  })

  return out
}

// ─── RODAPÉ ──────────────────────────────────────────────────────────────────

function secaoRodape(M, W_UTIL, tecnico_nome, tecnico_crea, tecnico_cft, tecnico_tipo, data_projeto) {
  const Y   = REG.FOOT.y
  const reg = tecnico_tipo === 'cft'
    ? `CFT: ${tecnico_cft || 'N/A'}`
    : `CREA: ${tecnico_crea || 'N/A'}`

  return `
  <!-- ── RODAPÉ ── -->
  <line x1="${M}" y1="${Y}" x2="${M + W_UTIL}" y2="${Y}" stroke="${COR_CINZA_BRD}" stroke-width="1"/>

  <!-- Técnico responsável -->
  <text x="${M}" y="${Y + 16}" font-size="8" font-weight="bold" fill="${COR_TEXT_MED}">Responsável Técnico:</text>
  <text x="${M}" y="${Y + 28}" font-size="9" font-weight="bold" fill="${COR_TEXT_DARK}">${tecnico_nome || 'Não informado'}</text>
  <text x="${M}" y="${Y + 40}" font-size="7.5" fill="${COR_TEXT_LIGHT}">${reg}</text>

  <!-- Linha assinatura técnico -->
  <text x="${M + 220}" y="${Y + 16}" font-size="7.5" fill="${COR_TEXT_LIGHT}">Assinatura do Responsável Técnico:</text>
  <line x1="${M + 220}" y1="${Y + 52}" x2="${M + 480}" y2="${Y + 52}" stroke="${COR_TEXT_MED}" stroke-width="1"/>

  <!-- Linha aprovação cliente -->
  <text x="${M + 520}" y="${Y + 16}" font-size="7.5" fill="${COR_TEXT_LIGHT}">Aprovação do Cliente:</text>
  <line x1="${M + 520}" y1="${Y + 52}" x2="${M + 760}" y2="${Y + 52}" stroke="${COR_TEXT_MED}" stroke-width="1"/>

  <!-- Dados empresa -->
  <text x="${M + W_UTIL}" y="${Y + 16}" text-anchor="end" font-size="9" font-weight="bold" fill="${COR_VERDE_FS}">FORTE SOLAR — Energia Renovável</text>
  <text x="${M + W_UTIL}" y="${Y + 28}" text-anchor="end" font-size="7.5" fill="${COR_TEXT_LIGHT}">Rua Landy Almeida Costa, 135 - CS3 · São Gonçalo do Amarante/RN · CEP 59290-021</text>
  <text x="${M + W_UTIL}" y="${Y + 40}" text-anchor="end" font-size="7.5" fill="${COR_TEXT_LIGHT}">Tel: (84) 99404-7722</text>
  <text x="${M + W_UTIL}" y="${Y + 55}" text-anchor="end" font-size="7" fill="${COR_TEXT_LIGHT}">Documento técnico para homologação concessionária — ${data_projeto}</text>
  `
}

// ─── SÍMBOLOS ELÉTRICOS ───────────────────────────────────────────────────────

function simboloDisjuntor(x, y, w, h, cor) {
  const cx = x + w / 2
  return `
  <!-- Símbolo disjuntor -->
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white" stroke="${cor}" stroke-width="1" rx="1"/>
  <line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + h * 0.3}" stroke="${cor}" stroke-width="1.5"/>
  <line x1="${cx}" y1="${y + h * 0.7}" x2="${cx}" y2="${y + h}" stroke="${cor}" stroke-width="1.5"/>
  <circle cx="${cx}" cy="${y + h * 0.5}" r="${Math.min(w, h) * 0.15}" fill="none" stroke="${cor}" stroke-width="1.2"/>
  <line x1="${x + w * 0.2}" y1="${y + h * 0.35}" x2="${cx + w * 0.15}" y2="${y + h * 0.5}" stroke="${cor}" stroke-width="1.2"/>
  `
}

function simboloDR(x, y, w, h, cor) {
  const cx = x + w / 2
  return `
  <!-- Símbolo DR -->
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white" stroke="${cor}" stroke-width="1" rx="1"/>
  <line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + h}" stroke="${cor}" stroke-width="1.5"/>
  <rect x="${x + 3}" y="${y + h * 0.3}" width="${w - 6}" height="${h * 0.4}" fill="none" stroke="${cor}" stroke-width="1"/>
  <text x="${cx}" y="${y + h * 0.57}" text-anchor="middle" font-size="5.5" fill="${cor}">DR</text>
  `
}

function simboloDPS(x, y, w, h, cor) {
  const cx = x + w / 2
  const cy = y + h / 2
  return `
  <!-- Símbolo DPS (triângulo + raio) -->
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white" stroke="${cor}" stroke-width="1" rx="1"/>
  <polygon points="${cx},${y + 6} ${x + 4},${y + h - 6} ${x + w - 4},${y + h - 6}" fill="none" stroke="${cor}" stroke-width="1.2"/>
  <line x1="${cx + 3}" y1="${y + 10}" x2="${cx - 2}" y2="${cy}" stroke="${cor}" stroke-width="1.5"/>
  <line x1="${cx - 2}" y1="${cy}" x2="${cx + 4}" y2="${cy}" stroke="${cor}" stroke-width="1.5"/>
  <line x1="${cx + 4}" y1="${cy}" x2="${cx - 1}" y2="${y + h - 10}" stroke="${cor}" stroke-width="1.5"/>
  `
}

function simboloCarregador(x, y, w, h) {
  return `
  <!-- Símbolo carregador EV (tomada + raio) -->
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${COR_AZUL_BG}" stroke="${COR_AZUL}" stroke-width="1" rx="3"/>
  <text x="${x + w/2}" y="${y + h/2 - 5}" text-anchor="middle" font-size="18" fill="${COR_AZUL}">⚡</text>
  `
}

function simboloVeiculo(x, y, w, h) {
  return `
  <!-- Símbolo veículo elétrico (simplificado) -->
  <rect x="${x}" y="${y + h*0.3}" width="${w}" height="${h*0.45}" fill="${COR_CINZA_BG}" stroke="${COR_TEXT_MED}" stroke-width="1" rx="4"/>
  <ellipse cx="${x + w*0.2}" cy="${y + h*0.75 + 2}" rx="${w*0.12}" ry="${w*0.12}" fill="${COR_TEXT_MED}"/>
  <ellipse cx="${x + w*0.8}" cy="${y + h*0.75 + 2}" rx="${w*0.12}" ry="${w*0.12}" fill="${COR_TEXT_MED}"/>
  <rect x="${x + w*0.15}" y="${y + h*0.1}" width="${w*0.7}" height="${h*0.25}" fill="${COR_CINZA_BG}" stroke="${COR_TEXT_MED}" stroke-width="1" rx="4"/>
  `
}

// ─── UTILITÁRIO ──────────────────────────────────────────────────────────────

function truncar(str, max) {
  if (!str) return ''
  const s = String(str)
  return s.length > max ? s.substring(0, max - 1) + '…' : s
}

// Mantém compatibilidade com chamada legada
export function gerarUnifilarEVPDF(dados) {
  return gerarUnifilarEVSVG(dados)
}
