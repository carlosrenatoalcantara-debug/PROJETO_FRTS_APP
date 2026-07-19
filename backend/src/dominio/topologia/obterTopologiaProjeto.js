/**
 * obterTopologiaProjeto.js — S3-FV-ENGINE-TOPOLOGY-CONSUMPTION-01
 *
 * CAMADA DE ACESSO OFICIAL à topologia consumida pela Engenharia (backend).
 * Ponto ÚNICO por onde o caminho de cálculo lê a topologia. É PROIBIDO ler
 * `projeto.arranjos` ou `instalacao.geradores` diretamente fora deste módulo.
 *
 * Ordem de resolução (regra 3): se existir Instalação válida → consome a NOVA
 * topologia; caso contrário → consome Arranjo (legado).
 * Nunca mistura os dois modelos (regra 4): um resultado é 100% Instalação OU
 * 100% Arranjo.
 *
 * Não altera algoritmos (regra 1): no caminho legado DELEGA às funções existentes
 * (`normalizarArranjos`/`calcularTotaisProjeto`) → saída byte-idêntica à de hoje.
 * No caminho novo, projeta/soma em leitura via `derivadosTopologia` (nada persistido).
 *
 * NOTA: o caminho de Instalação está DORMENTE em produção (nenhum projeto nasce
 * como Instalação ainda) — exercitado por testes de equivalência. Esta sprint
 * instala a costura de consumo.
 */

import { normalizarArranjos, calcularTotaisProjeto } from '../../services/arranjosService.js'
import { mapearGeradoresInstalacao, totaisTopologia } from './derivadosTopologia.js'

/** Instalação é "válida" para consumo quando tem ≥1 Gerador. */
export function instalacaoValida(instalacao) {
  return !!(instalacao && Array.isArray(instalacao.geradores) && instalacao.geradores.length > 0)
}

/**
 * Retorna a topologia canônica + totais, escolhendo a origem segundo a regra 3.
 * @param {object} projeto      ProjetoFV (para o caminho Arranjo).
 * @param {object} [opts]
 * @param {object} [opts.instalacao]  Instalação (para o caminho novo).
 * @param {object|function} [opts.catalogo]  resolvedor de specs (id→doc) p/ Instalação.
 * @returns {{origem:'instalacao'|'arranjo', arranjos_normalizados:Array, totais:object, geradores:Array}}
 */
export function obterTopologiaProjeto(projeto, { instalacao = null, catalogo = null } = {}) {
  if (instalacaoValida(instalacao)) {
    const geradores = mapearGeradoresInstalacao(instalacao, catalogo)
    return {
      origem: 'instalacao',
      arranjos_normalizados: geradores,   // forma canônica unificada
      totais: totaisTopologia(geradores),
      geradores,
    }
  }
  // Caminho legado — reuso integral do que já existe (resultado idêntico ao atual).
  const arranjos = normalizarArranjos(projeto)
  return {
    origem: 'arranjo',
    arranjos_normalizados: arranjos,
    totais: calcularTotaisProjeto(projeto),
    geradores: arranjos,
  }
}

export default obterTopologiaProjeto
