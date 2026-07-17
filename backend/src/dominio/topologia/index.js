/**
 * dominio/topologia — S2-FV-TOPOLOGY-FOUNDATION-01
 *
 * Ponto de entrada da fábrica pura da topologia (Gerador/MPPT/String).
 * Consumidores (Engenharia, na sprint seguinte) importam daqui.
 */

import { contarMpptsInversor, montarGerador, montarString, stringHomogenea } from './montarGerador.js'

export { contarMpptsInversor, montarGerador, montarString, stringHomogenea }
export default { contarMpptsInversor, montarGerador, montarString, stringHomogenea }
