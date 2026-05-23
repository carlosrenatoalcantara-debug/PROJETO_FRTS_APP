/**
 * index.js — S2.9 ETL SolarMarket
 *
 * Barrel de exports do módulo de integração SolarMarket.
 * Permite import centralizado de qualquer componente.
 *
 * Uso:
 *   import { executarImport, imprimirRelatorio } from '../integracoes/solarmarket/index.js'
 *   import { obterToken, extrairEquipamentos }   from '../integracoes/solarmarket/index.js'
 *
 * ATENÇÃO ARQUITETURAL:
 *   SolarMarket é uma referência comercial AUXILIAR.
 *   Forte Solar é a fonte de verdade do catálogo.
 *   Este módulo NÃO sincroniza: clientes, projetos, propostas, CRM, webhooks.
 *   O que importamos: fabricantes, modelos, kits, nomenclaturas, preços de referência.
 */

// Extração (leitura da API SM)
export { obterToken, limparCacheToken, buscarPropostas, buscarPropostaDetalhe,
         buscarProdutos, extrairEquipamentos }
  from './extractor.js'

// Normalização (SM shape → Equipamento shape)
export { normalizarTexto, gerarHash, inferirTipo, normalizar, normalizarLote }
  from './normalizer.js'

// S2.9.3: Camada semântica — variáveis da proposta SM → contrato canônico ProjetoFV v3
export { normalizarVariables, resolverAlias, estatisticasAliasIndex }
  from './variablesNormalizer.js'

// S2.9.3: Mapa de aliases (para inspeção / extensão)
export { SEMANTIC_ALIASES }
  from './semantic_aliases.js'

// Validação (filtragem de ruído)
export { validarItemBruto, validarNormalizado, filtrarLote }
  from './validator.js'

// Matching (busca no banco)
export { encontrarMatch, encontrarMatchesEmLote }
  from './matcher.js'

// Deduplicação e persistência
export { decidirAcao, executarAcao }
  from './deduplicator.js'

// Orquestrador principal
export { executarImport, imprimirRelatorio }
  from './importer.js'
