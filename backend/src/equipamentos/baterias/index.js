/**
 * equipamentos/baterias — S1-FV-DOMAIN-MIGRATION-01
 *
 * Ponto de entrada único do domínio "bateria". Mesmo contrato de
 * equipamentos/inversores: consumidores importam daqui, nunca traduzem
 * nomes de campo localmente. Somente LEITURA (modelo de dados).
 */

import { CAMPOS_BATERIA, valorCampoBateria, lerBateria } from './dicionarioBateria.js'

export { CAMPOS_BATERIA, valorCampoBateria, lerBateria }
export default { CAMPOS_BATERIA, valorCampoBateria, lerBateria }
