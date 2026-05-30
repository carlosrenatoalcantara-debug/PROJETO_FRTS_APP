/**
 * bomMateriaisEV.js — EV-BUGFIX-02
 *
 * Lista de materiais (BOM) para instalação de carregador EV.
 * Pure helper — sem dependências externas, testável em isolamento.
 *
 * Regras NBR/práticas de campo:
 *  - DPS: mínimo 2 unidades (fase + neutro, conforme NBR 5410 6.3.5.2)
 *  - Eletroduto: quantidade = ceil(distancia / 3m)  (barra padrão de 3m)
 *  - Abraçadeiras: 3 por barra de eletroduto
 *  - Bucha + parafuso: 4 por barra de eletroduto (fixação a cada ~75cm)
 */

const BARRA_ELETRODUTO_M = 3
const ABRACADEIRAS_POR_BARRA = 3
const FIXACAO_POR_BARRA = 4

/**
 * Gera a lista de materiais a partir dos cálculos NBR já feitos.
 *
 * @param {object} args
 * @param {number} args.potencia_kw          Potência total do carregador (kW)
 * @param {string} args.tipo_carregador      'AC Trifásico' | 'AC Monofásico' | 'DC' | ...
 * @param {number} args.bitola_mm2           Bitola do cabo (mm²)
 * @param {number} args.disjuntor_a          Disjuntor (A)
 * @param {number} args.dr_ma                DR (mA)
 * @param {number} args.dps_kv               Tensão DPS (kV)
 * @param {number} args.comprimento_m        Comprimento do cabo (m)
 * @returns {Array<{item, especificacao, quantidade, unidade?}>}
 */
export function gerarBOM({ potencia_kw, tipo_carregador, bitola_mm2, disjuntor_a, dr_ma, dps_kv, comprimento_m }) {
  const distancia = Math.max(0, Number(comprimento_m) || 0)
  const barrasEletroduto = Math.max(1, Math.ceil(distancia / BARRA_ELETRODUTO_M))
  const abracadeiras = barrasEletroduto * ABRACADEIRAS_POR_BARRA
  const fixacoes = barrasEletroduto * FIXACAO_POR_BARRA

  return [
    {
      item: 'Carregador EV',
      especificacao: `${tipo_carregador || '—'} ${potencia_kw || 0}kW`,
      quantidade: 1,
      unidade: 'un',
    },
    {
      item: 'Cabo de alimentação',
      especificacao: `${bitola_mm2 || 0} mm² (Cu, 0,6/1kV)`,
      quantidade: distancia,
      unidade: 'm',
    },
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
      // EV-BUGFIX-02: DPS mínimo 2 unidades (fase + neutro, NBR 5410 6.3.5.2).
      // Para trifásico, considerar 4 (3 fases + neutro) — a UI mantém 2 como
      // baseline universal; ajustar manualmente no orçamento se necessário.
      item: 'DPS (Proteção contra Surtos)',
      especificacao: `${dps_kv || 0}V Classe II`,
      quantidade: 2,
      unidade: 'un',
    },
    {
      // EV-BUGFIX-02: eletroduto em barras de 3m
      item: 'Eletroduto rígido',
      especificacao: `Proteção mecânica · barras de ${BARRA_ELETRODUTO_M}m`,
      quantidade: barrasEletroduto,
      unidade: 'barra',
    },
    {
      // EV-BUGFIX-02: 3 abraçadeiras por barra
      item: 'Abraçadeira',
      especificacao: `Fixação do eletroduto (${ABRACADEIRAS_POR_BARRA}/barra)`,
      quantidade: abracadeiras,
      unidade: 'un',
    },
    {
      // EV-BUGFIX-02: 4 fixações (bucha + parafuso) por barra
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

// Constantes exportadas para validação em testes / orçamento
export const REGRAS_BOM = {
  BARRA_ELETRODUTO_M,
  ABRACADEIRAS_POR_BARRA,
  FIXACAO_POR_BARRA,
  DPS_MINIMO: 2,
}
