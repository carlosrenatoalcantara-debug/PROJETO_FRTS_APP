/**
 * dominio/local — S1.5-FV-LOCAL-CONSUMERS-MIGRATION-01
 *
 * Ponto de entrada único do adapter de leitura do Local do projeto.
 * Consumidores (backend e frontend) importam daqui.
 */

import { obterLocalProjeto, localPopulado } from './obterLocalProjeto.js'

export { obterLocalProjeto, localPopulado }
export default { obterLocalProjeto, localPopulado }
