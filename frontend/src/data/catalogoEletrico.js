/**
 * catalogoEletrico.js — re-export do pacote compartilhado — FV-DOM-007B.
 *
 * O catálogo elétrico (Voc/Vmpp/Isc/coef. térmico dos módulos e inversores)
 * alimenta a engenharia normativa, que passou a viver no domínio. Ficar com uma
 * cópia no frontend criaria dois catálogos capazes de divergir.
 *
 * Fonte real: `packages/fv-shared/engenharia/catalogoEletrico.js`.
 */
export {
  DADOS_ELETRICOS_PAINEIS,
  DADOS_ELETRICOS_INVERSORES,
  dadosEletricosPainel,
  dadosEletricosInversor,
  CLIMA_PADRAO_UF,
} from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'
