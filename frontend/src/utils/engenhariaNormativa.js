/**
 * engenhariaNormativa.js — re-export do pacote compartilhado — FV-DOM-007B.
 *
 * As 341 linhas de cálculo normativo (NBR 16690 / 5410 / 5419 / 16800) foram
 * movidas para `packages/fv-shared/engenharia/engenhariaNormativa.js`, de onde o
 * domínio as consome. Este shim mantém o wizard legado funcionando enquanto ele
 * existir — e garante que ele use exatamente o mesmo código que o servidor, não
 * uma cópia.
 *
 * Quando a nova UX passar a consumir o unifilar pela API, este arquivo morre.
 */
export {
  TEMPERATURAS_UF,
  calcularTemperaturas,
  calcularVocMaxString,
  calcularVmppMinString,
  calcularIscMax,
  calcularCorrenteAC,
  selecionarCabo,
  selecionarDPS,
  montarModeloEletrico,
} from '@fortesolar/fv-shared/engenharia/normativa'
