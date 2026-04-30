/**
 * Base de Dados de Equipamentos Solares
 * Compilado de datasheets públicos de fabricantes
 * Organização: Módulos → Marca → Potência → Modelo
 *             Inversores → Marca → Potência → Modelo
 *             Carregadores → Marca → Tipo (AC/DC) → Potência
 */

export const modulos = {
  /**
   * MÓDULOS SOLARES - Principais fabricantes
   * Organizado por: Marca → Potência (Wp) → Modelo
   */

  'JA Solar': {
    // https://www.jasolar.com/index.php?m=content&c=index&a=lists&catid=67
    '375-395': {
      modelo: 'JAM72S09',
      potencia_wp: 385,
      voc: 40.2,
      isc: 10.15,
      vmp: 32.2,
      imp: 11.96,
      eficiencia_pct: 19.0,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
    '435-455': {
      modelo: 'JAM78S10',
      potencia_wp: 445,
      voc: 44.8,
      isc: 11.28,
      vmp: 36.1,
      imp: 12.33,
      eficiencia_pct: 20.5,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
    '530-555': {
      modelo: 'JAM72S30',
      potencia_wp: 540,
      voc: 49.0,
      isc: 13.73,
      vmp: 39.5,
      imp: 13.65,
      eficiencia_pct: 20.8,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
    '580-605': {
      modelo: 'JAM78S30',
      potencia_wp: 590,
      voc: 51.5,
      isc: 14.92,
      vmp: 41.6,
      imp: 14.16,
      eficiencia_pct: 21.2,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
    '600-625': {
      modelo: 'JAM78D40',
      potencia_wp: 615,
      voc: 52.0,
      isc: 15.2,
      vmp: 42.1,
      imp: 14.6,
      eficiencia_pct: 21.5,
      garantia_anos: 12,
      tipo: 'bifacial monocristalino',
    },
  },

  'Trina Solar': {
    // https://www.trinasolar.com
    '390-415': {
      modelo: 'TSM-DE15M(II)',
      potencia_wp: 400,
      voc: 43.1,
      isc: 10.65,
      vmp: 34.9,
      imp: 11.45,
      eficiencia_pct: 20.4,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
    '585-605': {
      modelo: 'TSM-DE20-505',
      potencia_wp: 595,
      voc: 50.5,
      isc: 14.8,
      vmp: 40.8,
      imp: 14.58,
      eficiencia_pct: 20.8,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
    '695-720': {
      modelo: 'TSM-NEG21C.20',
      potencia_wp: 710,
      voc: 54.8,
      isc: 16.2,
      vmp: 44.3,
      imp: 16.0,
      eficiencia_pct: 22.0,
      garantia_anos: 12,
      tipo: 'n-type monocristalino',
    },
  },

  'Canadian Solar': {
    // https://www.canadiansolar.com
    '380-410': {
      modelo: 'CS3U-390NW',
      potencia_wp: 390,
      voc: 42.5,
      isc: 10.3,
      vmp: 34.5,
      imp: 11.3,
      eficiencia_pct: 19.5,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
    '460-490': {
      modelo: 'CS3U-465NW',
      potencia_wp: 465,
      voc: 45.8,
      isc: 11.5,
      vmp: 37.0,
      imp: 12.55,
      eficiencia_pct: 20.2,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
  },

  'Deye': {
    // Fabricante chinês de padrão internacional
    '400-420': {
      modelo: 'Deye DE400M',
      potencia_wp: 410,
      voc: 43.0,
      isc: 10.4,
      vmp: 34.8,
      imp: 11.78,
      eficiencia_pct: 20.0,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
    '540-560': {
      modelo: 'Deye DE550M',
      potencia_wp: 550,
      voc: 49.2,
      isc: 13.8,
      vmp: 39.8,
      imp: 13.8,
      eficiencia_pct: 21.0,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
  },

  'Risen Energy': {
    // https://www.riseninc.com
    '420-440': {
      modelo: 'RSM440-8-108',
      potencia_wp: 430,
      voc: 44.2,
      isc: 10.8,
      vmp: 35.9,
      imp: 11.98,
      eficiencia_pct: 20.0,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
    '600-620': {
      modelo: 'RSM605-8',
      potencia_wp: 610,
      voc: 51.8,
      isc: 14.9,
      vmp: 42.0,
      imp: 14.52,
      eficiencia_pct: 21.2,
      garantia_anos: 12,
      tipo: 'monocristalino',
    },
  },
}

export const inversores = {
  /**
   * INVERSORES - Organizados por: Marca → Potência (kW) → Modelo
   * Oferecido conforme tensão da rede local (monofásico/trifásico)
   */

  'Huawei': {
    // https://solar.huawei.com
    monofasico: {
      '2-6kW': {
        '3': { modelo: 'SUN2000-3KTL-L1', potencia_kw: 3, fases: 1, mppts: 2, tensao_min_v: 200, tensao_max_v: 600 },
        '4': { modelo: 'SUN2000-4.6KTL-L1', potencia_kw: 4.6, fases: 1, mppts: 2, tensao_min_v: 200, tensao_max_v: 600 },
        '5': { modelo: 'SUN2000-5KTL-L1', potencia_kw: 5, fases: 1, mppts: 2, tensao_min_v: 200, tensao_max_v: 600 },
        '6': { modelo: 'SUN2000-6KTL-L1', potencia_kw: 6, fases: 1, mppts: 2, tensao_min_v: 200, tensao_max_v: 600 },
      }
    },
    trifasico: {
      '3-10kW': {
        '3': { modelo: 'SUN2000-3KTL-M1', potencia_kw: 3, fases: 3, mppts: 2, tensao_min_v: 200, tensao_max_v: 600 },
        '5': { modelo: 'SUN2000-5KTL-M1', potencia_kw: 5, fases: 3, mppts: 2, tensao_min_v: 200, tensao_max_v: 600 },
        '8': { modelo: 'SUN2000-8KTL-M1', potencia_kw: 8, fases: 3, mppts: 2, tensao_min_v: 200, tensao_max_v: 600 },
        '10': { modelo: 'SUN2000-10KTL-M1', potencia_kw: 10, fases: 3, mppts: 2, tensao_min_v: 200, tensao_max_v: 600 },
      },
      '8-20kW': {
        '8': { modelo: 'SUN2000-8KTL-M2', potencia_kw: 8, fases: 3, mppts: 3, tensao_min_v: 200, tensao_max_v: 600 },
        '10': { modelo: 'SUN2000-10KTL-M2', potencia_kw: 10, fases: 3, mppts: 3, tensao_min_v: 200, tensao_max_v: 600 },
        '12': { modelo: 'SUN2000-12KTL-M2', potencia_kw: 12, fases: 3, mppts: 3, tensao_min_v: 200, tensao_max_v: 600 },
        '15': { modelo: 'SUN2000-15KTL-M2', potencia_kw: 15, fases: 3, mppts: 3, tensao_min_v: 200, tensao_max_v: 600 },
        '20': { modelo: 'SUN2000-20KTL-M2', potencia_kw: 20, fases: 3, mppts: 3, tensao_min_v: 200, tensao_max_v: 600 },
      }
    }
  },

  'Growatt': {
    // https://www.growatt.com
    monofasico: {
      '3-6kW': {
        '3': { modelo: 'MIN 3000TL-X', potencia_kw: 3, fases: 1, mppts: 1, tensao_min_v: 200, tensao_max_v: 550 },
        '3.8': { modelo: 'MIN 3800TL-XH-US', potencia_kw: 3.8, fases: 1, mppts: 1, tensao_min_v: 200, tensao_max_v: 550 },
        '5': { modelo: 'MIN 5000TL-X', potencia_kw: 5, fases: 1, mppts: 1, tensao_min_v: 200, tensao_max_v: 550 },
        '6': { modelo: 'SPF 6000TL-X', potencia_kw: 6, fases: 1, mppts: 1, tensao_min_v: 200, tensao_max_v: 550 },
      }
    },
    trifasico: {
      '5-12kW': {
        '5': { modelo: 'MIN 5000TL-X-48', potencia_kw: 5, fases: 3, mppts: 2, tensao_min_v: 200, tensao_max_v: 550 },
        '6': { modelo: 'MIN 6000TL-X-48', potencia_kw: 6, fases: 3, mppts: 2, tensao_min_v: 200, tensao_max_v: 550 },
        '8': { modelo: 'MIN 8000TL-X-48', potencia_kw: 8, fases: 3, mppts: 2, tensao_min_v: 200, tensao_max_v: 550 },
        '10': { modelo: 'MIN 10000TL-X-48', potencia_kw: 10, fases: 3, mppts: 2, tensao_min_v: 200, tensao_max_v: 550 },
      }
    }
  },

  'Deye': {
    // https://www.deyeinverter.com
    monofasico: {
      '5-10kW': {
        '5': { modelo: 'SUN-5K-SG01LP1-US', potencia_kw: 5, fases: 1, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
        '6': { modelo: 'SUN-6K-SG01LP1-US', potencia_kw: 6, fases: 1, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
        '8': { modelo: 'SUN-8K-SG01LP1-US', potencia_kw: 8, fases: 1, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
        '10': { modelo: 'SUN-10K-SG02LP1-EU', potencia_kw: 10, fases: 1, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
      }
    },
    trifasico: {
      '5-12kW': {
        '5': { modelo: 'SUN-5K-SG04LP3-EU', potencia_kw: 5, fases: 3, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
        '6': { modelo: 'SUN-6K-SG04LP3-EU', potencia_kw: 6, fases: 3, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
        '8': { modelo: 'SUN-8K-SG04LP3-EU', potencia_kw: 8, fases: 3, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
        '10': { modelo: 'SUN-10K-SG04LP3-EU', potencia_kw: 10, fases: 3, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
        '12': { modelo: 'SUN-12K-SG04LP3-EU', potencia_kw: 12, fases: 3, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
      },
      '15-25kW': {
        '15': { modelo: 'SUN-15K-SG01HP3-EU', potencia_kw: 15, fases: 3, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
        '20': { modelo: 'SUN-20K-SG01HP3-EU', potencia_kw: 20, fases: 3, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
        '25': { modelo: 'SUN-25K-SG01HP3-EU', potencia_kw: 25, fases: 3, mppts: 2, tensao_min_v: 160, tensao_max_v: 700 },
      }
    }
  },

  'Fronius': {
    // Premium europeu
    monofasico: {
      '3-8kW': {
        '3': { modelo: 'Fronius Symo 3.0', potencia_kw: 3, fases: 1, mppts: 2, tensao_min_v: 150, tensao_max_v: 900 },
        '4': { modelo: 'Fronius Symo 4.0', potencia_kw: 4, fases: 1, mppts: 2, tensao_min_v: 150, tensao_max_v: 900 },
        '5': { modelo: 'Fronius Symo 5.0', potencia_kw: 5, fases: 1, mppts: 2, tensao_min_v: 150, tensao_max_v: 900 },
        '6': { modelo: 'Fronius Symo 6.0', potencia_kw: 6, fases: 1, mppts: 2, tensao_min_v: 150, tensao_max_v: 900 },
        '8': { modelo: 'Fronius Symo 8.0', potencia_kw: 8, fases: 1, mppts: 2, tensao_min_v: 150, tensao_max_v: 900 },
      }
    },
    trifasico: {
      '3-27kW': {
        '3': { modelo: 'Fronius Symo 3.0-3', potencia_kw: 3, fases: 3, mppts: 2, tensao_min_v: 150, tensao_max_v: 900 },
        '5': { modelo: 'Fronius Symo 5.0-3', potencia_kw: 5, fases: 3, mppts: 2, tensao_min_v: 150, tensao_max_v: 900 },
        '8': { modelo: 'Fronius Symo 8.0-3', potencia_kw: 8, fases: 3, mppts: 3, tensao_min_v: 150, tensao_max_v: 900 },
        '10': { modelo: 'Fronius Symo 10.0-3', potencia_kw: 10, fases: 3, mppts: 3, tensao_min_v: 150, tensao_max_v: 900 },
      }
    }
  },
}

export const carregadores = {
  /**
   * CARREGADORES SOLARES - Marca → Tipo (AC/DC) → Potência
   */

  'Victron Energy': {
    // https://www.victronenergy.com/solar-charge-controllers
    DC: {
      'MPPT 100/20': {
        tipo: 'DC',
        entrada_v_max: 100,
        saida_a: 20,
        compativel_bateria: ['12V', '24V', '48V'],
        eficiencia_pct: 98,
      },
      'MPPT 100/30': {
        tipo: 'DC',
        entrada_v_max: 100,
        saida_a: 30,
        compativel_bateria: ['12V', '24V', '48V'],
        eficiencia_pct: 98,
      },
      'MPPT 100/50': {
        tipo: 'DC',
        entrada_v_max: 100,
        saida_a: 50,
        compativel_bateria: ['48V'],
        eficiencia_pct: 98,
      },
      'MPPT 150/100': {
        tipo: 'DC',
        entrada_v_max: 150,
        saida_a: 100,
        compativel_bateria: ['48V'],
        eficiencia_pct: 98,
      },
    }
  },

  'EPEVER': {
    // Fabricante chinês popular
    DC: {
      'TriRonNG 60A': {
        tipo: 'DC',
        entrada_v_max: 150,
        saida_a: 60,
        compativel_bateria: ['12V', '24V', '36V', '48V'],
        eficiencia_pct: 97,
      },
      'TriRonNG 80A': {
        tipo: 'DC',
        entrada_v_max: 150,
        saida_a: 80,
        compativel_bateria: ['24V', '48V'],
        eficiencia_pct: 97,
      },
      'TriRonNG 100A': {
        tipo: 'DC',
        entrada_v_max: 150,
        saida_a: 100,
        compativel_bateria: ['48V'],
        eficiencia_pct: 97,
      },
    }
  },

  'SRNE': {
    // Controlador solar
    DC: {
      'ML2420': {
        tipo: 'DC',
        entrada_v_max: 100,
        saida_a: 20,
        compativel_bateria: ['12V', '24V'],
        eficiencia_pct: 96,
      },
      'ML4860': {
        tipo: 'DC',
        entrada_v_max: 150,
        saida_a: 60,
        compativel_bateria: ['24V', '48V'],
        eficiencia_pct: 96,
      },
    }
  },

  'MPP Solar': {
    // Carregador híbrido
    AC: {
      'PIP5048LS': {
        tipo: 'AC',
        entrada_potencia_w: 5000,
        saida_ac_potencia_w: 5000,
        entrada_dc_v: '48V nominal',
        compativel_bateria: ['Lithium', 'LiFePO4'],
      },
      'PIP8048LS': {
        tipo: 'AC',
        entrada_potencia_w: 8000,
        saida_ac_potencia_w: 8000,
        entrada_dc_v: '48V nominal',
        compativel_bateria: ['Lithium', 'LiFePO4'],
      },
    }
  },
}

export const getCargadores = (tensaoRede) => {
  /**
   * Retorna carregadores compatíveis conforme tensão da rede local
   * @param {number} tensaoRede - Tensão nominal: 12, 24 ou 48 (V)
   */
  const carregadoresCompatíveis = {}

  Object.entries(carregadores).forEach(([marca, tipos]) => {
    Object.entries(tipos).forEach(([tipoCarregador, modelos]) => {
      Object.entries(modelos).forEach(([nomeModelo, specs]) => {
        if (specs.compativel_bateria &&
            specs.compativel_bateria.includes(`${tensaoRede}V`)) {
          if (!carregadoresCompatíveis[marca]) {
            carregadoresCompatíveis[marca] = {}
          }
          carregadoresCompatíveis[marca][nomeModelo] = specs
        }
      })
    })
  })

  return carregadoresCompatíveis
}

export const getInversores = (fases) => {
  /**
   * Retorna inversores conforme número de fases da rede
   * @param {number} fases - Número de fases: 1 (monofásico) ou 3 (trifásico)
   */
  const tipoRede = fases === 1 ? 'monofasico' : 'trifasico'
  const inversoresRede = {}

  Object.entries(inversores).forEach(([marca, config]) => {
    if (config[tipoRede]) {
      inversoresRede[marca] = config[tipoRede]
    }
  })

  return inversoresRede
}
