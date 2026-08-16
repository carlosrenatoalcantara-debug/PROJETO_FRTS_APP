/**
 * financeiroRegulatorioBR.js — re-export do pacote compartilhado — FV-DOM-009.
 *
 * O motor da Lei 14.300 vive em `packages/fv-shared/financeiro/regulatorioBR.js`,
 * de onde o domínio poderá consumi-lo. Este shim mantém os consumidores atuais
 * (CentroFinanceiroFV, comercialEngine) intactos.
 *
 * Nenhuma regra regulatória mudou.
 */
export {
  CUSTO_DISPONIBILIDADE_KWH,
  custoDisponibilidadeKwh,
  CRONOGRAMA_FIO_B,
  ANO_DIREITO_ADQUIRIDO_FIM,
  ANO_CORTE_GRANDFATHER,
  percentualFioB,
  GD_MODALIDADES,
  getModalidadeGD,
  construirPremissasRegulatorias,
  calcularRetornoRegulatorio,
  compararCenarios,
} from '@fortesolar/fv-shared/financeiro/regulatorio-br'
