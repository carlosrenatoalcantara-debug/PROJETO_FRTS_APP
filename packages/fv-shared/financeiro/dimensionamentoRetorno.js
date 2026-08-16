/**
 * dimensionamentoRetorno.js — retorno financeiro do dimensionamento — FV-DOM-011.
 *
 * ── Origem ───────────────────────────────────────────────────────────────────
 * Extraído VERBATIM de `backend/src/services/dimensionamentoFV.js`. Fórmulas,
 * constantes, defaults e arredondamentos vieram intactos — a equivalência é
 * verificada em `financeiroRestante.check.js` contra o `git HEAD`.
 *
 * ── Por que fica separado dos motores já consolidados ────────────────────────
 * Este caminho tem premissas e fórmulas PRÓPRIAS, medidas na FV-DOM-010:
 *
 *   • inflação 6 % a.a. (os outros usam 0 %, 8 % ou 5 %×2 %)
 *   • taxa de desconto 10 % (o `fluxoCaixa` usa 6 %)
 *   • payback por ECONOMIA MÉDIA — `custo / (economia25 / 25)` — e não por
 *     acumulação até cobrir o investimento. Subestima em até 4 anos (R12).
 *   • TIR busca em [0,0001 ; 1,5] com tolerância |VPL| < 1 e devolve `null`
 *     acima de 150 % — outro intervalo, outra tolerância, outro tipo de falha
 *     que a TIR de `fluxoCaixa`.
 *
 * **Não é cópia de nada.** Unificá-lo mudaria números; a escolha é D1/D2/D3, e
 * elas continuam PENDENTES.
 *
 * ── Constantes compartilhadas com o dimensionamento técnico ──────────────────
 * `ANOS_PROJETO` e `DEGRADACAO_ANUAL_PCT` também alimentam `calcularGeracao25Anos`
 * (cálculo técnico, não financeiro). Ficam exportadas daqui e importadas de volta
 * pelo service, para não existirem duas definições capazes de divergir.
 *
 * Puro: sem I/O, sem Express, sem Mongoose.
 */

export const ANOS_PROJETO = 25
export const DEGRADACAO_ANUAL_PCT = 0.5      // 0.5%/ano (NBR + datasheet típico)

/**
 * Defaults FINANCEIROS deste caminho. Os defaults técnicos (perdas, margem,
 * fator de simultaneidade) seguem no service — não são financeiros.
 *
 * Os valores e os comentários originais foram preservados: são exatamente as
 * premissas implícitas que o contrato V1 pretende tornar explícitas (D2/D3).
 */
export const DEFAULTS_FINANCEIROS = {
  tarifa_kwh: 0.95,              // tarifa média BR (R$) — fallback se não vier da fatura
  inflacao_energia_aa: 0.06,     // 6% a.a. inflação histórica COSERN
  custo_kwp_instalado_r: 4500,   // R$/kWp instalado (turn-key, ref. mercado nacional 2025-2026)
  taxa_desconto_aa: 0.10,        // 10% a.a. — custo de oportunidade (CDI ref)
}

function round(n, casas = 2) {
  return Number(n.toFixed(casas))
}

/**
 * Economia anual estimada (R$).
 *  - GD II/B: economia = geração × tarifa (compensação 1:1, descontando custo disponibilidade)
 *  - simplificado: ignora taxa fio B progressiva (Lei 14.300) nesta fase
 */
export function calcularEconomiaAnual({ geracao_anual_kwh, tarifa_kwh }) {
  const tarifa = tarifa_kwh || DEFAULTS_FINANCEIROS.tarifa_kwh
  return round(geracao_anual_kwh * tarifa)
}

/**
 * Custo total estimado do sistema (R$).
 */
export function calcularCustoSistema(potencia_kwp, custo_kwp = DEFAULTS_FINANCEIROS.custo_kwp_instalado_r) {
  return round(potencia_kwp * custo_kwp)
}

/**
 * Economia acumulada em 25 anos considerando degradação e inflação tarifária.
 */
export function calcularEconomia25Anos({
  geracao_anual_y1,
  tarifa_kwh = DEFAULTS_FINANCEIROS.tarifa_kwh,
  inflacao_aa = DEFAULTS_FINANCEIROS.inflacao_energia_aa,
}) {
  let total = 0
  for (let ano = 0; ano < ANOS_PROJETO; ano++) {
    const geracao_ano = geracao_anual_y1 * Math.pow(1 - DEGRADACAO_ANUAL_PCT / 100, ano)
    const tarifa_ano = tarifa_kwh * Math.pow(1 + inflacao_aa, ano)
    total += geracao_ano * tarifa_ano
  }
  return round(total)
}

/**
 * Payback simples (anos): custo / economia_anual_média_real
 * Usa economia média considerando inflação da tarifa no horizonte de 25 anos.
 *
 * ⚠️ FV-DOM-010 (R12): a média dos 25 anos inclui anos futuros já inflacionados,
 * então este payback é sistematicamente MENOR que o acumulado dos demais motores
 * (até 4 anos). Preservado como está — corrigir é decisão D1.
 */
export function calcularPayback({ custo_total, geracao_anual_y1, tarifa_kwh, inflacao_aa }) {
  if (!custo_total || custo_total <= 0) return 0
  const economia25 = calcularEconomia25Anos({ geracao_anual_y1, tarifa_kwh, inflacao_aa })
  const economia_media = economia25 / ANOS_PROJETO
  if (economia_media <= 0) return 0
  return round(custo_total / economia_media, 1)
}

/**
 * Valor Presente Líquido (VPL/NPV) — fluxo descontado.
 */
export function calcularVPL({
  custo_total,
  geracao_anual_y1,
  tarifa_kwh = DEFAULTS_FINANCEIROS.tarifa_kwh,
  inflacao_aa = DEFAULTS_FINANCEIROS.inflacao_energia_aa,
  taxa_desconto_aa = DEFAULTS_FINANCEIROS.taxa_desconto_aa,
}) {
  let vpl = -custo_total
  for (let ano = 1; ano <= ANOS_PROJETO; ano++) {
    const geracao = geracao_anual_y1 * Math.pow(1 - DEGRADACAO_ANUAL_PCT / 100, ano - 1)
    const tarifa = tarifa_kwh * Math.pow(1 + inflacao_aa, ano - 1)
    const fluxo = geracao * tarifa
    vpl += fluxo / Math.pow(1 + taxa_desconto_aa, ano)
  }
  return round(vpl)
}

/**
 * TIR (Taxa Interna de Retorno) — aproximação por bisseção.
 * Retorna fração (0.15 = 15% a.a.) ou null se não convergir.
 */
export function calcularTIRDetalhado({
  custo_total,
  geracao_anual_y1,
  tarifa_kwh = DEFAULTS_FINANCEIROS.tarifa_kwh,
  inflacao_aa = DEFAULTS_FINANCEIROS.inflacao_energia_aa,
}) {
  const intervalo_busca = [0.0001, 1.5]
  if (!custo_total || custo_total <= 0) {
    return { valor: null, convergiu: false, motivo: 'custo_invalido', intervalo_busca }
  }

  const vplPara = (taxa) => {
    let v = -custo_total
    for (let ano = 1; ano <= ANOS_PROJETO; ano++) {
      const g = geracao_anual_y1 * Math.pow(1 - DEGRADACAO_ANUAL_PCT / 100, ano - 1)
      const t = tarifa_kwh * Math.pow(1 + inflacao_aa, ano - 1)
      v += (g * t) / Math.pow(1 + taxa, ano)
    }
    return v
  }

  let lo = 0.0001, hi = 1.5
  // Duas saídas que antes eram o mesmo `null` — agora distinguíveis.
  if (vplPara(lo) < 0) {
    return { valor: null, convergiu: false, motivo: 'fluxo_nunca_positivo', intervalo_busca }
  }
  if (vplPara(hi) > 0) {
    return { valor: null, convergiu: false, motivo: 'acima_do_intervalo', intervalo_busca }
  }

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const v = vplPara(mid)
    if (Math.abs(v) < 1) {
      return { valor: round(mid, 4), convergiu: true, motivo: 'ok', intervalo_busca }
    }
    if (v > 0) lo = mid; else hi = mid
  }
  return {
    valor: round((lo + hi) / 2, 4),
    convergiu: false,
    motivo: 'iteracoes_esgotadas',
    intervalo_busca,
  }
}

/**
 * Superfície preservada: fração ou `null`, exatamente como antes.
 * `dimensionarFV` e seus dois consumidores não mudam.
 */
export function calcularTIR(args) {
  return calcularTIRDetalhado(args).valor
}
