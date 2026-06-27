/**
 * bomMateriaisEV.js
 *
 * Lista de materiais (BOM) para instalação de carregador EV.
 * Pure helper — sem dependências externas, testável em isolamento.
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
 * Demais regras NBR/campo:
 *  - DPS: mínimo 2 unidades (NBR 5410 6.3.5.2)
 *  - Eletroduto: ceil(distância / 3m) barras
 *  - Abraçadeiras: 3 por barra
 *  - Bucha + parafuso: 4 por barra
 */

const BARRA_ELETRODUTO_M = 3
const ABRACADEIRAS_POR_BARRA = 3
const FIXACAO_POR_BARRA = 4

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
 * @returns {Array<{item, especificacao, quantidade, unidade}>}
 */
export function gerarBOM({ potencia_kw, tipo_carregador, numero_fases, bitola_mm2, disjuntor_a, dr_ma, dps_kv, comprimento_m }) {
  const distancia = Math.max(0, Number(comprimento_m) || 0)
  const barrasEletroduto = Math.max(1, Math.ceil(distancia / BARRA_ELETRODUTO_M))
  const abracadeiras = barrasEletroduto * ABRACADEIRAS_POR_BARRA
  const fixacoes = barrasEletroduto * FIXACAO_POR_BARRA

  // REGRA FORTE SOLAR: monofásico = 3 condutores; trifásico = 5 condutores
  const ehTrifasico = Number(numero_fases || 1) >= 3
  const condutores = ehTrifasico ? CONDUTORES_TRI : CONDUTORES_MONO

  const itensCabos = condutores.map(({ item, cor }) => ({
    item,
    especificacao: `${bitola_mm2 || 0}mm² Cu 0,6/1kV — ${cor}`,
    quantidade: distancia,
    unidade: 'm',
  }))

  return [
    {
      item: 'Carregador EV',
      especificacao: `${tipo_carregador || '—'} ${potencia_kw || 0}kW`,
      quantidade: 1,
      unidade: 'un',
    },
    ...itensCabos,
    {
      item: 'Disjuntor termomagnético',
      especificacao: `${disjuntor_a || 0}A Curva C`,
      quantidade: 1,
      unidade: 'un',
    },
    {
      item: 'Dispositivo DR',
      especificacao: `${dr_ma || 0}mA Tipo A`,
      quantidade: 1,
      unidade: 'un',
    },
    {
      // NBR 5410 6.3.5.2: mínimo 2 unidades (fase + neutro)
      item: 'DPS (Proteção contra Surtos)',
      especificacao: `${dps_kv || 0}V Classe II`,
      quantidade: 2,
      unidade: 'un',
    },
    {
      item: 'Eletroduto rígido',
      especificacao: `Proteção mecânica · barras de ${BARRA_ELETRODUTO_M}m`,
      quantidade: barrasEletroduto,
      unidade: 'barra',
    },
    {
      item: 'Abraçadeira',
      especificacao: `Fixação do eletroduto (${ABRACADEIRAS_POR_BARRA}/barra)`,
      quantidade: abracadeiras,
      unidade: 'un',
    },
    {
      item: 'Bucha + parafuso',
      especificacao: `Fixação em alvenaria (${FIXACAO_POR_BARRA}/barra)`,
      quantidade: fixacoes,
      unidade: 'jogo',
    },
    {
      item: 'Fita isolante',
      especificacao: 'Vedação de conexões',
      quantidade: 5,
      unidade: 'rolo',
    },
    {
      item: 'Haste de aterramento',
      especificacao: '2,4m cobre 16mm Ø',
      quantidade: 1,
      unidade: 'un',
    },
    {
      item: 'Tomadas/conectores',
      especificacao: 'Conforme carregador',
      quantidade: 2,
      unidade: 'un',
    },
  ]
}

export const REGRAS_BOM = {
  BARRA_ELETRODUTO_M,
  ABRACADEIRAS_POR_BARRA,
  FIXACAO_POR_BARRA,
  DPS_MINIMO: 2,
  CONDUTORES_MONO: CONDUTORES_MONO.length,  // 3
  CONDUTORES_TRI: CONDUTORES_TRI.length,    // 5
}
