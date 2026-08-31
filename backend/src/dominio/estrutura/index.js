/**
 * estrutura/ — regra da estrutura de fixação — FV-DOM-039.
 *
 * ── Este módulo não define regra nenhuma ────────────────────────────────────
 * Ele reexporta o SSOT em `@fortesolar/fv-shared/estrutura`, que é onde a regra
 * passou a viver.
 *
 * Histórico curto, porque explica por que o arquivo continua existindo:
 *   • FV-UX-030 — a regra nasceu no frontend;
 *   • FV-UX-037 — medido que a API aceitava `{tipo:'Outro', descricao:''}` com
 *     HTTP 200: a regra valia só para quem passasse pela tela;
 *   • FV-UX-038 — o buraco foi fechado com uma SEGUNDA cópia aqui, espelhada
 *     palavra por palavra, e a duplicação ficou registrada como dívida;
 *   • FV-DOM-039 (esta) — uma definição só, no pacote compartilhado.
 *
 * O arquivo permanece como o ponto de entrada do DOMÍNIO do backend: os
 * controllers importam de `dominio/`, como fazem com `gate/`, `proposta/` e
 * `orcamento/`. Trocar isso por import direto do pacote em cada chamador
 * espalharia a dependência sem ganho.
 */
export {
  TIPOS_ESTRUTURA,
  TIPO_OUTRO,
  estruturaVazia,
  daEquipamentos,
  tipoForaDaLista,
  rotuloDaEstrutura,
  exigeDescricao,
  validarEstrutura,
  paraEquipamentos,
} from '@fortesolar/fv-shared/estrutura'
