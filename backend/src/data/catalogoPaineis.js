// Catálogo de painéis fotovoltaicos com especificações elétricas completas
// Valores em STC (25°C, 1000 W/m², AM1.5)
export const PAINEIS = [
  {
    id: 'cs550', marca: 'Canadian Solar', modelo: 'CS6W-550MS',
    pmpp: 550, voc: 49.5, isc: 13.90, vmpp: 41.2, impp: 13.35,
    tempCoefVoc: -0.28, tempCoefPmpp: -0.35, tempCoefIsc: 0.048,
    area: 2.26, eficiencia: 21.4,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 890,
  },
  {
    id: 'rs550', marca: 'Risen', modelo: 'RSM144-7-550M',
    pmpp: 550, voc: 49.8, isc: 13.85, vmpp: 41.65, impp: 13.20,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.26, eficiencia: 21.0,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 820,
  },
  {
    id: 'ja550', marca: 'JA Solar', modelo: 'JAM72S30-550MR',
    pmpp: 550, voc: 49.2, isc: 13.87, vmpp: 41.10, impp: 13.38,
    tempCoefVoc: -0.28, tempCoefPmpp: -0.35, tempCoefIsc: 0.048,
    area: 2.27, eficiencia: 21.0,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 800,
  },
  {
    id: 'tr610', marca: 'Trina Solar', modelo: 'TSM-610DE21',
    pmpp: 610, voc: 53.2, isc: 14.60, vmpp: 44.20, impp: 13.80,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.58, eficiencia: 22.1,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 980,
  },
  {
    id: 'byd415', marca: 'BYD', modelo: 'BYD415H5-54E',
    pmpp: 415, voc: 40.2, isc: 13.20, vmpp: 33.50, impp: 12.38,
    tempCoefVoc: -0.29, tempCoefPmpp: -0.35, tempCoefIsc: 0.050,
    area: 1.72, eficiencia: 19.8,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 660,
  },
  {
    id: 'lon450', marca: 'LONGi', modelo: 'LR5-72HPH-450M',
    pmpp: 450, voc: 44.5, isc: 13.80, vmpp: 37.10, impp: 12.12,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.00, eficiencia: 20.9,
    garantiaProduto: 15, garantiaPerformance: 25, percentualPerformance: 80.7,
    precoUnitario: 760,
  },
  {
    id: 'cs400', marca: 'Canadian Solar', modelo: 'CS6L-400MS',
    pmpp: 400, voc: 41.4, isc: 12.28, vmpp: 34.20, impp: 11.69,
    tempCoefVoc: -0.28, tempCoefPmpp: -0.35, tempCoefIsc: 0.048,
    area: 1.75, eficiencia: 19.6,
    garantiaProduto: 10, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 680,
  },
]

export function getPainelById(id) {
  return PAINEIS.find(p => p.id === id) ?? null
}
