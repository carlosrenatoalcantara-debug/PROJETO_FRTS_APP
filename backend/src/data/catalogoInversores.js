// ┌──────────────────────────────────────────────────────────────────────────┐
// │ DATASET COMERCIAL — NÃO É O SSOT DE ENGENHARIA                           │
// └──────────────────────────────────────────────────────────────────────────┘
//
// F9: cruzado contra os 52 inversores do SSOT Mongo — 0 de 41 registros têm
// correspondência. 10 dos 14 fabricantes coincidem, NENHUM modelo. Esta tabela
// descreve equipamento residencial de demonstração (Fronius Primo, Sungrow
// SG5.0RS); o SSOT descreve o estoque real (Kehua SPI, SolaX X3-ULT, SAJ DE).
//
// Uso PERMITIDO: candidatura e ranking comercial.
// Uso PROIBIDO:  qualquer decisão de engenharia, qualquer valor apresentado ao
//                usuário como especificação validada.
//
// Compatibilidade elétrica tem um caminho só:
//     SSOT (`especificacoes`) → adapter → contrato canônico → motor
//
// Ver `procedenciaComercial.js` e o guard `catalogoComercialF9.check.js`.
//
// Catálogo Unificado de Inversores - Versão Completa
// Data de atualização: 2026-05-14

export const INVERSORES = [
  // ═══════════════════════════════════════════════════════════════════════════
  // FRONIUS - String Inverters (2 modelos originais + mantidos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'fr5', marca: 'Fronius', modelo: 'Primo 5.0-1',
    potenciaKW: 5, vocMax: 1000, mpptMin: 200, mpptMax: 800,
    imaxMppt: 13.5, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 4200,
  },
  {
    id: 'fr20', marca: 'Fronius', modelo: 'Symo 20.0-3-M',
    potenciaKW: 20, vocMax: 1000, mpptMin: 200, mpptMax: 800,
    imaxMppt: 27.0, nMppts: 3, nStringsTotal: 6,
    tipoInversor: 'string', faseAC: 3,
    garantia: 10, precoUnitario: 18000,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEYE - String Inverters (5 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'dy3', marca: 'Deye', modelo: 'SUN-3.6K-SG01LP1',
    potenciaKW: 3.6, vocMax: 1000, mpptMin: 80, mpptMax: 900,
    imaxMppt: 13.3, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 2200,
  },
  {
    id: 'dy5', marca: 'Deye', modelo: 'SUN-5K-SG01LP1',
    potenciaKW: 5, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 15.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 3400,
  },
  {
    id: 'dy8', marca: 'Deye', modelo: 'SUN-8K-SG04LP1',
    potenciaKW: 8, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 25.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 4800,
  },
  {
    id: 'dy10e', marca: 'Deye', modelo: 'SUN-10K-SG04LP1',
    potenciaKW: 10, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 30.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 5800,
  },
  {
    id: 'dy15e', marca: 'Deye', modelo: 'SUN-15K-SG04LP1',
    potenciaKW: 15, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 45.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 8200,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROWATT - String Inverters (5 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gw3n', marca: 'Growatt', modelo: 'MIN 3000TL-X',
    potenciaKW: 3, vocMax: 600, mpptMin: 50, mpptMax: 580,
    imaxMppt: 16.5, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 1600,
  },
  {
    id: 'gw5', marca: 'Growatt', modelo: 'MOD 5000TL3-LV',
    potenciaKW: 5, vocMax: 1000, mpptMin: 70, mpptMax: 850,
    imaxMppt: 16.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 2800,
  },
  {
    id: 'gw10n', marca: 'Growatt', modelo: 'MOD 10000TL-LV',
    potenciaKW: 10, vocMax: 1000, mpptMin: 150, mpptMax: 900,
    imaxMppt: 32.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 5200,
  },
  {
    id: 'gw15n', marca: 'Growatt', modelo: 'MOD 15000TL-LV',
    potenciaKW: 15, vocMax: 1000, mpptMin: 150, mpptMax: 900,
    imaxMppt: 48.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 7500,
  },
  {
    id: 'gw20n', marca: 'Growatt', modelo: 'MOD 20000TL-LV',
    potenciaKW: 20, vocMax: 1000, mpptMin: 150, mpptMax: 900,
    imaxMppt: 65.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 9800,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUNGROW - String Inverters (5 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'sg3s', marca: 'Sungrow', modelo: 'SG3.0RS',
    potenciaKW: 3, vocMax: 1000, mpptMin: 80, mpptMax: 900,
    imaxMppt: 9.0, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 1900,
  },
  {
    id: 'sg5', marca: 'Sungrow', modelo: 'SG5.0RS',
    potenciaKW: 5, vocMax: 1000, mpptMin: 80, mpptMax: 950,
    imaxMppt: 12.5, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 3100,
  },
  {
    id: 'sg8s', marca: 'Sungrow', modelo: 'SG8.0RS',
    potenciaKW: 8, vocMax: 1000, mpptMin: 80, mpptMax: 950,
    imaxMppt: 12.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 4200,
  },
  {
    id: 'sg10', marca: 'Sungrow', modelo: 'SG10RS',
    potenciaKW: 10, vocMax: 1000, mpptMin: 80, mpptMax: 950,
    imaxMppt: 15.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 7800,
  },
  {
    id: 'sg15', marca: 'Sungrow', modelo: 'SG15RT',
    potenciaKW: 15, vocMax: 1000, mpptMin: 200, mpptMax: 950,
    imaxMppt: 22.0, nMppts: 3, nStringsTotal: 6,
    tipoInversor: 'string', faseAC: 3,
    garantia: 10, precoUnitario: 11500,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOODWE - String Inverters (3 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gd3', marca: 'Goodwe', modelo: 'GW3500-NS',
    potenciaKW: 3.5, vocMax: 900, mpptMin: 100, mpptMax: 850,
    imaxMppt: 14.0, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 1800,
  },
  {
    id: 'gd6', marca: 'Goodwe', modelo: 'GW6500-NS',
    potenciaKW: 6.5, vocMax: 900, mpptMin: 100, mpptMax: 850,
    imaxMppt: 26.0, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 3200,
  },
  {
    id: 'gd10', marca: 'Goodwe', modelo: 'GW10K-DT',
    potenciaKW: 10, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 32.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 4800,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KEHUA - String Inverters (3 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'kh3', marca: 'Kehua', modelo: 'KH50-3K',
    potenciaKW: 3, vocMax: 900, mpptMin: 60, mpptMax: 850,
    imaxMppt: 16.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 1500,
  },
  {
    id: 'kh8', marca: 'Kehua', modelo: 'KH50-8K',
    potenciaKW: 8, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 26.0, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 3800,
  },
  {
    id: 'kh10', marca: 'Kehua', modelo: 'KH50-10K',
    potenciaKW: 10, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 33.0, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 5000,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOLAX - String Inverters (3 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'sx3', marca: 'Solax', modelo: 'X1-3.0-S-D',
    potenciaKW: 3, vocMax: 600, mpptMin: 80, mpptMax: 550,
    imaxMppt: 13.6, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 1700,
  },
  {
    id: 'sx5', marca: 'Solax', modelo: 'X1-5.0-S-D',
    potenciaKW: 5, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 13.6, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 2400,
  },
  {
    id: 'sx10', marca: 'Solax', modelo: 'X3-10.0-D',
    potenciaKW: 10, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 32.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 10, precoUnitario: 5200,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOLPLANET - String Inverters (3 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'sp3', marca: 'Solplanet', modelo: 'TLB3000',
    potenciaKW: 3, vocMax: 850, mpptMin: 60, mpptMax: 800,
    imaxMppt: 14.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 1400,
  },
  {
    id: 'sp5', marca: 'Solplanet', modelo: 'TLB5000',
    potenciaKW: 5, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 13.5, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 2100,
  },
  {
    id: 'sp10', marca: 'Solplanet', modelo: 'TLB10000',
    potenciaKW: 10, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 28.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 4500,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HOYMILES - Microinversores (2 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'hoy350', marca: 'Hoymiles', modelo: 'MI-350',
    potenciaKW: 0.35, vocMax: 60, mpptMin: 25, mpptMax: 60,
    imaxMppt: 11.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'micro', faseAC: 1,
    garantia: 12, precoUnitario: 550,
  },
  {
    id: 'hoy500', marca: 'Hoymiles', modelo: 'MI-500',
    potenciaKW: 0.5, vocMax: 60, mpptMin: 25, mpptMax: 60,
    imaxMppt: 13.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'micro', faseAC: 1,
    garantia: 12, precoUnitario: 650,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // APSYSTEMS - Microinversores (2 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'aps400', marca: 'APsystems', modelo: 'EZ1-M 400W',
    potenciaKW: 0.4, vocMax: 60, mpptMin: 16, mpptMax: 55,
    imaxMppt: 10.5, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'micro', faseAC: 1,
    garantia: 10, precoUnitario: 850,
  },
  {
    id: 'aps600', marca: 'APsystems', modelo: 'QS1-LV-D',
    potenciaKW: 0.6, vocMax: 60, mpptMin: 15, mpptMax: 50,
    imaxMppt: 12.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'micro', faseAC: 1,
    garantia: 12, precoUnitario: 900,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HUAWEI - String Inverters (3 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'hw3', marca: 'Huawei', modelo: 'SUN2000-3KTL',
    potenciaKW: 3, vocMax: 600, mpptMin: 60, mpptMax: 580,
    imaxMppt: 13.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 2000,
  },
  {
    id: 'hw5', marca: 'Huawei', modelo: 'SUN2000-5KTL-M0',
    potenciaKW: 5, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 13.6, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 2800,
  },
  {
    id: 'hw10', marca: 'Huawei', modelo: 'SUN2000-10KTL-M0',
    potenciaKW: 10, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 32.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 10, precoUnitario: 5800,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TSUNESS - String Inverters (2 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'ts3', marca: 'Tsuness', modelo: 'TN3000',
    potenciaKW: 3, vocMax: 900, mpptMin: 70, mpptMax: 850,
    imaxMppt: 15.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 1450,
  },
  {
    id: 'ts5', marca: 'Tsuness', modelo: 'TN5000',
    potenciaKW: 5, vocMax: 1000, mpptMin: 100, mpptMax: 900,
    imaxMppt: 13.5, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 2200,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEP - Microinversores (2 modelos)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'nep250', marca: 'Nep', modelo: 'MLPE-250W',
    potenciaKW: 0.25, vocMax: 60, mpptMin: 20, mpptMax: 50,
    imaxMppt: 8.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'micro', faseAC: 1,
    garantia: 12, precoUnitario: 450,
  },
  {
    id: 'nep400', marca: 'Nep', modelo: 'MLPE-400W',
    potenciaKW: 0.4, vocMax: 60, mpptMin: 20, mpptMax: 50,
    imaxMppt: 13.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'micro', faseAC: 1,
    garantia: 12, precoUnitario: 650,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENPHASE - Microinversores (1 modelo original + mantido)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'enph', marca: 'Enphase', modelo: 'IQ8M',
    potenciaKW: 0.366, vocMax: 60, mpptMin: 16, mpptMax: 55,
    imaxMppt: 14.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'micro', faseAC: 1,
    garantia: 25, precoUnitario: 1100,
  },
]

export function getInversorById(id) {
  return INVERSORES.find(i => i.id === id) ?? null
}

export function getInversoresPorMarca(marca) {
  return INVERSORES.filter(i => i.marca.toLowerCase() === marca.toLowerCase())
}

export function getInversoresString() {
  return INVERSORES.filter(i => i.tipoInversor === 'string')
}

export function getInversoresMicro() {
  return INVERSORES.filter(i => i.tipoInversor === 'micro')
}
