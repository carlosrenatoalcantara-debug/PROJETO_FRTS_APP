/**
 * Calcula a bitola do cabo AC baseado na corrente máxima do inversor
 * @param {number} correnteMaximaA - Corrente máxima de saída do inversor em Amperes
 * @param {string} tipo - 'monofasico' ou 'trifasico'
 * @returns {object} { bitola, corrente, disjuntor, descricao }
 */
export function calcularBitolaCabo(correnteMaximaA, tipo = 'monofasico') {
  // Margem de segurança de 1.25x (padrão NEC/IEC)
  const correnteAjustada = correnteMaximaA * 1.25

  // Tabela de bitolas (NBR 5036/4757 - padrão brasileiro)
  // { min, max, bitola, disjuntorMax, descricao }
  const tabelaBitolas = [
    { min: 0, max: 10, bitola: '1.5', disjuntorMax: '16', metros: '5' },
    { min: 10, max: 16, bitola: '2.5', disjuntorMax: '20', metros: '10' },
    { min: 16, max: 25, bitola: '4', disjuntorMax: '32', metros: '15' },
    { min: 25, max: 32, bitola: '6', disjuntorMax: '40', metros: '20' },
    { min: 32, max: 40, bitola: '10', disjuntorMax: '50', metros: '30' },
    { min: 40, max: 50, bitola: '16', disjuntorMax: '63', metros: '40' },
    { min: 50, max: 63, bitola: '25', disjuntorMax: '80', metros: '50' },
    { min: 63, max: 80, bitola: '35', disjuntorMax: '100', metros: '60' },
    { min: 80, max: 100, bitola: '50', disjuntorMax: '125', metros: '70' },
    { min: 100, max: 125, bitola: '70', disjuntorMax: '160', metros: '90' },
  ]

  // Encontrar a bitola apropriada baseada na corrente ajustada
  let bitolaSelecionada = tabelaBitolas[tabelaBitolas.length - 1]
  for (const opcao of tabelaBitolas) {
    if (correnteAjustada <= opcao.max) {
      bitolaSelecionada = opcao
      break
    }
  }

  return {
    bitola: bitolaSelecionada.bitola,
    disjuntorMax: bitolaSelecionada.disjuntorMax,
    correnteOriginal: Math.ceil(correnteMaximaA),
    correnteAjustada: Math.ceil(correnteAjustada),
    tipo: tipo,
    descricao: `Cabo ${bitolaSelecionada.bitola}mm² de cobre - Disjuntor máx ${bitolaSelecionada.disjuntorMax}A`,
    distanciaMaxima: bitolaSelecionada.metros,
  }
}

/**
 * Obter informações formatadas para o diagrama
 */
export function obterInfoCabo(correnteMaximaA, tipo = 'monofasico') {
  const info = calcularBitolaCabo(correnteMaximaA, tipo)
  return {
    texto: `${info.bitola}mm² Cobre`,
    disjuntor: `${info.disjuntorMax}A`,
    completo: `Cabo ${info.bitola}mm² | Disjuntor ${info.disjuntorMax}A`,
  }
}
