/**
 * lme/index.js — Legacy Migration Engine · ADR-022
 *
 * Barrel do motor de migração de legado. Ponto de entrada único.
 *
 *   import { executarMigracao, planoCatalogoSolarMarket } from '../lme/index.js'
 *   const rel = await executarMigracao(planoCatalogoSolarMarket, { dryRun: true })
 *
 * FRONTEIRA (ADR-021, regra 3): o Core (`dominio/`) NUNCA importa deste módulo.
 * A dependência é unidirecional — LME → Core.
 */

// Contrato do pipeline
export { ETAPAS, ACOES, validarPlano, prepararContexto, temValidacao, ErroPlanoInvalido }
  from './contrato.js'

// Registro de execução
export { criarLedger } from './ledger.js'

// Orquestrador
export { executarMigracao } from './execucao.js'

// Fontes registradas
export { planoCatalogoSolarMarket } from './fontes/solarmarket/index.js'
