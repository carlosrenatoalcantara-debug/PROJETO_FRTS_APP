/**
 * financeiroEngine.js — re-export do pacote compartilhado — FV-DOM-009.
 *
 * O motor vive em `packages/fv-shared/financeiro/financeiroEngine.js`. Este shim
 * mantém os consumidores atuais (CentroFinanceiroFV, GovernancaPainel,
 * comercialEngine, engenhariaGovernanca) funcionando sem alteração — e garante
 * que executem o MESMO código que o backend, não uma cópia.
 *
 * Nenhuma fórmula mudou. Quando a aba Financeiro migrar para a nova UX e passar
 * a consumir a API canônica, este arquivo morre.
 */
export {
  CAMPOS_CUSTO,
  composicaoCustos,
  calcularModoKitFechado,
  calcularModoComposicao,
  calcularMargem,
  calcularFinanciamento,
  calcularParcelamento,
  calcularRetorno,
  calcularTIR,
  calcularFinanceiroCompleto,
  compararRevisoesFinanceiras,
} from '@fortesolar/fv-shared/financeiro/engine'
