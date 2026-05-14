// Catálogo expandido de painéis fotovoltaicos 450W+
// Fabricantes: Canadian, OSDA, Ronma, ZNshine, Helius, Era Solar, Leapton, Pulling, Jinko, JA, Trina, Hanesun, Longi, Renesola, Tongwei
// Valores em STC (25°C, 1000 W/m², AM1.5)

export const PAINEIS_EXPANDIDO = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CANADIAN SOLAR (4 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'cs450', marca: 'Canadian Solar', modelo: 'CS3W-450MS',
    pmpp: 450, voc: 44.5, isc: 13.8, vmpp: 37.1, impp: 12.12,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.0, eficiencia: 20.9,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80.7,
    precoUnitario: 760,
  },
  {
    id: 'cs530', marca: 'Canadian Solar', modelo: 'CS6W-530MS',
    pmpp: 530, voc: 48.2, isc: 13.62, vmpp: 40.0, impp: 13.25,
    tempCoefVoc: -0.28, tempCoefPmpp: -0.35, tempCoefIsc: 0.048,
    area: 2.23, eficiencia: 21.2,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 850,
  },
  {
    id: 'cs550c', marca: 'Canadian Solar', modelo: 'CS6W-550MS',
    pmpp: 550, voc: 49.5, isc: 13.90, vmpp: 41.2, impp: 13.35,
    tempCoefVoc: -0.28, tempCoefPmpp: -0.35, tempCoefIsc: 0.048,
    area: 2.26, eficiencia: 21.4,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 890,
  },
  {
    id: 'cs600', marca: 'Canadian Solar', modelo: 'CS6W-600MS',
    pmpp: 600, voc: 51.8, isc: 14.50, vmpp: 42.8, impp: 14.02,
    tempCoefVoc: -0.28, tempCoefPmpp: -0.35, tempCoefIsc: 0.048,
    area: 2.30, eficiencia: 22.1,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 85,
    precoUnitario: 950,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JINKO SOLAR (4 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'jk460', marca: 'Jinko Solar', modelo: 'JKM460M-60HL4-V',
    pmpp: 460, voc: 44.8, isc: 13.95, vmpp: 37.3, impp: 12.33,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.05, eficiencia: 21.2,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80.4,
    precoUnitario: 780,
  },
  {
    id: 'jk540', marca: 'Jinko Solar', modelo: 'JKM540S-72HL4-V',
    pmpp: 540, voc: 50.6, isc: 14.20, vmpp: 42.0, impp: 12.86,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.38, eficiencia: 21.1,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 850,
  },
  {
    id: 'jk580', marca: 'Jinko Solar', modelo: 'JKM580M-72HL4-460-GG',
    pmpp: 580, voc: 52.2, isc: 14.80, vmpp: 43.2, impp: 13.42,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.38, eficiencia: 21.6,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 84,
    precoUnitario: 920,
  },
  {
    id: 'jk620', marca: 'Jinko Solar', modelo: 'JKM620M-78HL4-535',
    pmpp: 620, voc: 53.8, isc: 15.40, vmpp: 44.5, impp: 13.93,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.44, eficiencia: 22.2,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 84.5,
    precoUnitario: 1020,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JA SOLAR (4 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'ja460', marca: 'JA Solar', modelo: 'JAM72S30-460MR',
    pmpp: 460, voc: 44.8, isc: 13.95, vmpp: 37.3, impp: 12.33,
    tempCoefVoc: -0.28, tempCoefPmpp: -0.35, tempCoefIsc: 0.048,
    area: 2.08, eficiencia: 20.9,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 770,
  },
  {
    id: 'ja550j', marca: 'JA Solar', modelo: 'JAM72S30-550MR',
    pmpp: 550, voc: 49.2, isc: 13.87, vmpp: 41.10, impp: 13.38,
    tempCoefVoc: -0.28, tempCoefPmpp: -0.35, tempCoefIsc: 0.048,
    area: 2.27, eficiencia: 21.0,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 800,
  },
  {
    id: 'ja585', marca: 'JA Solar', modelo: 'JAM78S20-585MR',
    pmpp: 585, voc: 51.3, isc: 14.58, vmpp: 42.6, impp: 13.72,
    tempCoefVoc: -0.28, tempCoefPmpp: -0.35, tempCoefIsc: 0.048,
    area: 2.38, eficiencia: 21.4,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 82,
    precoUnitario: 920,
  },
  {
    id: 'ja620', marca: 'JA Solar', modelo: 'JAM78D40-620MR',
    pmpp: 620, voc: 52.0, isc: 15.2, vmpp: 42.1, impp: 14.6,
    tempCoefVoc: -0.28, tempCoefPmpp: -0.35, tempCoefIsc: 0.048,
    area: 2.30, eficiencia: 21.9,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 84,
    precoUnitario: 1000,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRINA SOLAR (4 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'tr450', marca: 'Trina Solar', modelo: 'TSM-450DE15H',
    pmpp: 450, voc: 43.7, isc: 13.84, vmpp: 36.2, impp: 12.44,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.04, eficiencia: 20.6,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 750,
  },
  {
    id: 'tr530', marca: 'Trina Solar', modelo: 'TSM-530DE18H',
    pmpp: 530, voc: 47.5, isc: 14.89, vmpp: 39.1, impp: 13.56,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.25, eficiencia: 20.8,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 850,
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
    id: 'tr670', marca: 'Trina Solar', modelo: 'TSM-670DE22.08',
    pmpp: 670, voc: 54.5, isc: 15.70, vmpp: 44.8, impp: 14.95,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.76, eficiencia: 22.5,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 85,
    precoUnitario: 1080,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LONGI SOLAR (4 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'lon450', marca: 'LONGi', modelo: 'LR5-72HPH-450M',
    pmpp: 450, voc: 44.5, isc: 13.80, vmpp: 37.10, impp: 12.12,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.00, eficiencia: 20.9,
    garantiaProduto: 15, garantiaPerformance: 25, percentualPerformance: 80.7,
    precoUnitario: 760,
  },
  {
    id: 'lon545', marca: 'LONGi', modelo: 'LR5-72HPH-545M',
    pmpp: 545, voc: 49.5, isc: 14.25, vmpp: 41.0, impp: 13.28,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.23, eficiencia: 21.3,
    garantiaProduto: 15, garantiaPerformance: 25, percentualPerformance: 83,
    precoUnitario: 870,
  },
  {
    id: 'lon600', marca: 'LONGi', modelo: 'LR5-72HPH-600M',
    pmpp: 600, voc: 52.5, isc: 14.96, vmpp: 43.5, impp: 13.80,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.40, eficiencia: 21.8,
    garantiaProduto: 15, garantiaPerformance: 25, percentualPerformance: 84,
    precoUnitario: 960,
  },
  {
    id: 'lon665', marca: 'LONGi', modelo: 'LR5-72HPH-665M',
    pmpp: 665, voc: 54.7, isc: 15.60, vmpp: 45.0, impp: 14.78,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.52, eficiencia: 22.5,
    garantiaProduto: 15, garantiaPerformance: 25, percentualPerformance: 85,
    precoUnitario: 1100,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RENESOLA (3 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'rn455', marca: 'Renesola', modelo: 'Virtus 2-M 455',
    pmpp: 455, voc: 44.9, isc: 13.72, vmpp: 37.5, impp: 12.14,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.08, eficiencia: 20.8,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 770,
  },
  {
    id: 'rn550', marca: 'Renesola', modelo: 'Virtus 2-L 550',
    pmpp: 550, voc: 49.8, isc: 14.05, vmpp: 41.5, impp: 13.25,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.28, eficiencia: 21.1,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 82,
    precoUnitario: 880,
  },
  {
    id: 'rn600', marca: 'Renesola', modelo: 'Virtus 2-G 600',
    pmpp: 600, voc: 52.2, isc: 14.85, vmpp: 43.3, impp: 13.86,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.45, eficiencia: 21.7,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 84,
    precoUnitario: 950,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ZNSHINE (3 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'zn460', marca: 'ZNshine', modelo: 'ZXM7-460M',
    pmpp: 460, voc: 44.6, isc: 13.98, vmpp: 37.2, impp: 12.37,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.10, eficiencia: 20.9,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 780,
  },
  {
    id: 'zn540', marca: 'ZNshine', modelo: 'ZXM7-540M',
    pmpp: 540, voc: 50.0, isc: 14.50, vmpp: 41.5, impp: 12.98,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.30, eficiencia: 21.1,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 82,
    precoUnitario: 870,
  },
  {
    id: 'zn610', marca: 'ZNshine', modelo: 'ZXM8-610M',
    pmpp: 610, voc: 52.8, isc: 15.30, vmpp: 43.8, impp: 13.92,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.52, eficiencia: 21.8,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 84,
    precoUnitario: 980,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEAPTON (2 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'lep465', marca: 'Leapton', modelo: 'LP182x91-465M',
    pmpp: 465, voc: 45.0, isc: 14.10, vmpp: 37.5, impp: 12.40,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.12, eficiencia: 21.0,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80.5,
    precoUnitario: 790,
  },
  {
    id: 'lep550', marca: 'Leapton', modelo: 'LP182x91-550M',
    pmpp: 550, voc: 50.2, isc: 14.88, vmpp: 41.8, impp: 13.15,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.30, eficiencia: 21.2,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 82,
    precoUnitario: 880,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RISEN (3 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'rs450', marca: 'Risen', modelo: 'RSM144-6-410M',
    pmpp: 410, voc: 42.0, isc: 13.25, vmpp: 34.5, impp: 11.90,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 1.95, eficiencia: 20.2,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 720,
  },
  {
    id: 'rs550r', marca: 'Risen', modelo: 'RSM144-7-550M',
    pmpp: 550, voc: 49.8, isc: 13.85, vmpp: 41.65, impp: 13.20,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.26, eficiencia: 21.0,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 820,
  },
  {
    id: 'rs660', marca: 'Risen', modelo: 'RSM156-8-660W',
    pmpp: 660, voc: 52.5, isc: 15.88, vmpp: 43.5, impp: 15.18,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.52, eficiencia: 22.1,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 84,
    precoUnitario: 1050,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TONGWEI (2 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'tw470', marca: 'Tongwei', modelo: 'TW-M470',
    pmpp: 470, voc: 45.5, isc: 14.08, vmpp: 37.8, impp: 12.44,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.14, eficiencia: 21.0,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 800,
  },
  {
    id: 'tw550t', marca: 'Tongwei', modelo: 'TW-M550',
    pmpp: 550, voc: 50.8, isc: 14.75, vmpp: 42.2, impp: 13.02,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.35, eficiencia: 21.2,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 82,
    precoUnitario: 900,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTROS FABRICANTES (3 modelos 450W+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'era500', marca: 'Era Solar', modelo: 'ES-M450-72',
    pmpp: 450, voc: 44.2, isc: 13.68, vmpp: 36.8, impp: 12.23,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.00, eficiencia: 20.8,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 80,
    precoUnitario: 750,
  },
  {
    id: 'hel540', marca: 'Helius', modelo: 'HLS-540-72',
    pmpp: 540, voc: 49.8, isc: 14.35, vmpp: 41.2, impp: 13.10,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.25, eficiencia: 21.2,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 81,
    precoUnitario: 870,
  },
  {
    id: 'han595', marca: 'Hanesun', modelo: 'HSG-595-72',
    pmpp: 595, voc: 52.0, isc: 15.05, vmpp: 43.0, impp: 13.84,
    tempCoefVoc: -0.27, tempCoefPmpp: -0.34, tempCoefIsc: 0.045,
    area: 2.38, eficiencia: 21.6,
    garantiaProduto: 12, garantiaPerformance: 25, percentualPerformance: 82,
    precoUnitario: 940,
  },
]

export function getPainelById(id) {
  return PAINEIS_EXPANDIDO.find(p => p.id === id) ?? null
}

export function getPaineisPorMarca(marca) {
  return PAINEIS_EXPANDIDO.filter(p => p.marca.toLowerCase() === marca.toLowerCase())
}

export function getPaineisAcima450W() {
  return PAINEIS_EXPANDIDO.filter(p => p.pmpp >= 450)
}

export function getPaineisAcima550W() {
  return PAINEIS_EXPANDIDO.filter(p => p.pmpp >= 550)
}
