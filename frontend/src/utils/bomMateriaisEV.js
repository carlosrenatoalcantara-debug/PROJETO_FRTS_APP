/**
 * bomMateriaisEV.js
 *
 * MOTOR ÚNICO da lista de materiais (BOM) para instalação de carregador EV.
 * Pure helper — sem dependências externas, testável em isolamento.
 *
 * Sprint P2-EV-WORKFLOW-CONSOLIDATION-01:
 *   TODAS as regras de quantidade de material ficam centralizadas AQUI.
 *   Nenhum cálculo de material pode estar espalhado pela UI.
 *
 * ─────────────────────────────────────────────────────────────────
 * REGRA DE ENGENHARIA FORTE SOLAR — condutores por sistema elétrico
 * ─────────────────────────────────────────────────────────────────
 * Monofásico (numero_fases = 1):  L + N + PE              = 3 condutores
 * Trifásico  (numero_fases = 3):  L1 + L2 + L3 + N + PE  = 5 condutores
 *
 * O usuário informa apenas o comprimento do percurso (m).
 * O sistema multiplica automaticamente pelo número de condutores.
 * Não inferir neutro. Não criar algoritmo genérico. Não hardcode de fabricante.
 * ─────────────────────────────────────────────────────────────────
 *
 * REGRA DE CONEXÕES (centralizada):
 *  - Terminal tubular: bitola do terminal = bitola do cabo.
 *      quantidade = nº de condutores × 2 (uma ponta em cada extremidade)
 *      → Monofásico: 3 condutores → 6 terminais
 *      → Trifásico:  5 condutores → 10 terminais
 *  - Conector perfurante: nº de condutores + 1 reserva
 *      → Monofásico: 3 + 1 = 4 unidades
 *      → Trifásico:  5 + 1 = 6 unidades
 *
 * Demais regras NBR/campo:
 *  - DPS: mínimo 2 unidades (NBR 5410 6.3.5.2)
 *  - Eletroduto: ceil(distância / 3m) barras
 *  - Curvas: 2 (uma em cada extremidade do percurso)
 *  - Luvas (emendas): barras − 1 (mínimo 1)
 *  - Abraçadeiras: 3 por barra
 *  - Bucha + parafuso: 4 por barra
 *  - Prensa-cabo: 2 (entrada do quadro + entrada do carregador)
 *  - Box reto (caixa de passagem): 2
 */

const BARRA_ELETRODUTO_M = 3
const ABRACADEIRAS_POR_BARRA = 3
const FIXACAO_POR_BARRA = 4
const PRENSA_CABO_QTD = 2
const BOX_RETO_QTD = 2
const CURVAS_QTD = 2

// Categorias do BOM — usadas para agrupamento na UI e no unifilar
export const CATEGORIAS_BOM = ['Equipamentos', 'Proteções', 'Cabos', 'Infraestrutura', 'Conexões', 'Diversos']

// REGRA FORTE SOLAR — não alterar sem revisão de engenharia
const CONDUTORES_MONO = [
  { item: 'Cabo Fase (L)',   cor: 'Preto/Vermelho' },
  { item: 'Cabo Neutro (N)', cor: 'Azul'           },
  { item: 'Cabo Terra (PE)', cor: 'Verde/Amarelo'  },
]

const CONDUTORES_TRI = [
  { item: 'Cabo Fase L1',    cor: 'Preto'          },
  { item: 'Cabo Fase L2',    cor: 'Vermelho'       },
  { item: 'Cabo Fase L3',    cor: 'Cinza'          },
  { item: 'Cabo Neutro (N)', cor: 'Azul'           },
  { item: 'Cabo Terra (PE)', cor: 'Verde/Amarelo'  },
]

/**
 * Gera a lista de materiais a partir dos cálculos NBR já feitos.
 *
 * @param {object} args
 * @param {number} args.potencia_kw
 * @param {string} args.tipo_carregador   'AC Monofásico' | 'AC Trifásico' | ...
 * @param {number} args.numero_fases      1 = monofásico · 3 = trifásico
 * @param {number} args.bitola_mm2
 * @param {number} args.disjuntor_a
 * @param {number} args.dr_ma
 * @param {number} args.dps_kv
 * @param {number} args.comprimento_m     Comprimento do percurso em metros
 * @param {boolean} [args.incluir_mob_box=false]  Adiciona Mob Box aos equipamentos
 * @param {string} [args.tipo_conector]   Conector do carregador (informativo)
 * @returns {Array<{item, especificacao, quantidade, unidade, categoria}>}
 */
export function gerarBOM({
  potencia_kw,
  tipo_carregador,
  numero_fases,
  bitola_mm2,
  disjuntor_a,
  dr_ma,
  dps_kv,
  comprimento_m,
  incluir_mob_box = false,
  tipo_conector,
}) {
  const distancia = Math.max(0, Number(comprimento_m) || 0)
  const barrasEletroduto = Math.max(1, Math.ceil(distancia / BARRA_ELETRODUTO_M))
  const abracadeiras = barrasEletroduto * ABRACADEIRAS_POR_BARRA
  const fixacoes = barrasEletroduto * FIXACAO_POR_BARRA
  const luvas = Math.max(1, barrasEletroduto - 1)
  const bitola = Number(bitola_mm2) || 0

  // REGRA FORTE SOLAR: monofásico = 3 condutores; trifásico = 5 condutores
  const ehTrifasico = Number(numero_fases || 1) >= 3
  const condutores = ehTrifasico ? CONDUTORES_TRI : CONDUTORES_MONO
  const nCondutores = condutores.length            // 3 (mono) ou 5 (tri)

  // REGRA DE CONEXÕES (centralizada)
  const terminaisTubular = nCondutores * 2          // 6 (mono) ou 10 (tri)
  const conectoresPerfurantes = nCondutores + 1     // 4 (mono) ou 6 (tri)

  const itensCabos = condutores.map(({ item, cor }) => ({
    item,
    especificacao: `${bitola}mm² Cu 0,6/1kV — ${cor}`,
    quantidade: distancia,
    unidade: 'm',
    categoria: 'Cabos',
  }))

  const bom = []

  // ── EQUIPAMENTOS ─────────────────────────────────────────────────────────
  bom.push({
    item: 'Carregador EV',
    especificacao: `${tipo_carregador || '—'} ${potencia_kw || 0}kW${tipo_conector ? ` · ${tipo_conector}` : ''}`,
    quantidade: 1,
    unidade: 'un',
    categoria: 'Equipamentos',
  })
  if (incluir_mob_box) {
    bom.push({
      item: 'Mob Box',
      especificacao: 'Caixa de proteção/gerenciamento do carregador',
      quantidade: 1,
      unidade: 'un',
      categoria: 'Equipamentos',
    })
  }

  // ── PROTEÇÕES ────────────────────────────────────────────────────────────
  bom.push(
    {
      item: 'Quadro de proteção EV',
      especificacao: 'Quadro de distribuição dedicado ao circuito EV',
      quantidade: 1,
      unidade: 'un',
      categoria: 'Proteções',
    },
    {
      item: 'Trilho DIN',
      especificacao: 'Fixação de disjuntor/DR/DPS no quadro',
      quantidade: 1,
      unidade: 'un',
      categoria: 'Proteções',
    },
    {
      item: 'Barramento de cobre',
      especificacao: 'Distribuição neutro + terra no quadro',
      quantidade: 2,
      unidade: 'un',
      categoria: 'Proteções',
    },
    {
      item: 'Disjuntor termomagnético',
      especificacao: `${disjuntor_a || 0}A Curva C`,
      quantidade: 1,
      unidade: 'un',
      categoria: 'Proteções',
    },
    {
      item: 'Dispositivo DR',
      especificacao: `${dr_ma || 0}mA Tipo A`,
      quantidade: 1,
      unidade: 'un',
      categoria: 'Proteções',
    },
    {
      // BUG-021.1: 1 DPS por condutor VIVO (fase(s) + neutro) — NBR 5410 6.3.5.
      // Monofásico = 2 (L1+N); Trifásico (3F+N) = 4 (L1+L2+L3+N). Determinístico
      // por fases: BOM, Memorial e Unifilar seguem a MESMA regra e nunca divergem.
      item: 'DPS (Proteção contra Surtos)',
      especificacao: `${dps_kv || 0}V Classe II`,
      quantidade: ehTrifasico ? 4 : 2,
      unidade: 'un',
      categoria: 'Proteções',
    },
  )

  // ── CABOS ────────────────────────────────────────────────────────────────
  bom.push(...itensCabos)

  // ── INFRAESTRUTURA ───────────────────────────────────────────────────────
  bom.push(
    {
      item: 'Eletroduto rígido',
      especificacao: `Proteção mecânica · barras de ${BARRA_ELETRODUTO_M}m`,
      quantidade: barrasEletroduto,
      unidade: 'barra',
      categoria: 'Infraestrutura',
    },
    {
      item: 'Curva',
      especificacao: 'Curva para eletroduto (extremidades do percurso)',
      quantidade: CURVAS_QTD,
      unidade: 'un',
      categoria: 'Infraestrutura',
    },
    {
      item: 'Luva',
      especificacao: 'Emenda de eletroduto (barras − 1)',
      quantidade: luvas,
      unidade: 'un',
      categoria: 'Infraestrutura',
    },
    {
      item: 'Abraçadeira',
      especificacao: `Fixação do eletroduto (${ABRACADEIRAS_POR_BARRA}/barra)`,
      quantidade: abracadeiras,
      unidade: 'un',
      categoria: 'Infraestrutura',
    },
    {
      item: 'Bucha + parafuso',
      especificacao: `Fixação em alvenaria (${FIXACAO_POR_BARRA}/barra)`,
      quantidade: fixacoes,
      unidade: 'jogo',
      categoria: 'Infraestrutura',
    },
    {
      item: 'Prensa-cabo',
      especificacao: 'Vedação na entrada do quadro e do carregador',
      quantidade: PRENSA_CABO_QTD,
      unidade: 'un',
      categoria: 'Infraestrutura',
    },
    {
      item: 'Box reto',
      especificacao: 'Conexão eletroduto → caixa/quadro',
      quantidade: BOX_RETO_QTD,
      unidade: 'un',
      categoria: 'Infraestrutura',
    },
  )

  // ── CONEXÕES ─────────────────────────────────────────────────────────────
  bom.push(
    {
      item: 'Terminal tubular',
      // REGRA: bitola do terminal = bitola do cabo
      especificacao: `${bitola}mm² (= bitola do cabo) · ${nCondutores} condutores × 2`,
      quantidade: terminaisTubular,
      unidade: 'un',
      categoria: 'Conexões',
    },
    {
      item: 'Conector perfurante',
      especificacao: `${nCondutores} condutores + 1 reserva`,
      quantidade: conectoresPerfurantes,
      unidade: 'un',
      categoria: 'Conexões',
    },
  )

  // ── DIVERSOS ─────────────────────────────────────────────────────────────
  bom.push(
    {
      item: 'Fita isolante',
      especificacao: 'Vedação de conexões',
      quantidade: 5,
      unidade: 'rolo',
      categoria: 'Diversos',
    },
    {
      item: 'Haste de aterramento',
      especificacao: '2,4m cobre 16mm Ø',
      quantidade: 1,
      unidade: 'un',
      categoria: 'Infraestrutura',
    },
  )

  return bom
}

export const REGRAS_BOM = {
  BARRA_ELETRODUTO_M,
  ABRACADEIRAS_POR_BARRA,
  FIXACAO_POR_BARRA,
  PRENSA_CABO_QTD,
  BOX_RETO_QTD,
  CURVAS_QTD,
  DPS_MINIMO: 2,
  CONDUTORES_MONO: CONDUTORES_MONO.length,  // 3
  CONDUTORES_TRI: CONDUTORES_TRI.length,    // 5
  TERMINAIS_MONO: CONDUTORES_MONO.length * 2,        // 6
  TERMINAIS_TRI: CONDUTORES_TRI.length * 2,          // 10
  CONECTORES_PERFURANTES_MONO: CONDUTORES_MONO.length + 1, // 4
  CONECTORES_PERFURANTES_TRI: CONDUTORES_TRI.length + 1,   // 6
}
