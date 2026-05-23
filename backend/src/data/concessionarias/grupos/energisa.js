/**
 * grupos/energisa.js — Biblioteca Nacional de Concessionárias
 * Grupo Energisa S.A. (controlador: Grupo Energisa)
 *
 * Distribuidoras: AC, ES, GO (parcial), MS, MT, PB, RO, RR, SC (parcial), SE, TO
 */

export const GRUPO_ENERGISA = Object.freeze({
  id:          'energisa',
  nome_grupo:  'Energisa',
  controlador: 'Energisa S.A.',

  distribuidoras: Object.freeze([

    { id: 'ENERGISA_AC', nome_canonical: 'Energisa Acre',
      nome_completo: 'Energisa Acre Distribuidora de Energia S.A.',
      grupo: 'energisa', estado: 'AC', codigo_aneel: '01',
      tensoes_padrao_bt_v: [127, 220, 380],
      aliases: [
        { termo: 'energisa acre',                                 nivel: 1, confianca: 0.70 },
        { termo: 'energisa ac',                                   nivel: 1, confianca: 0.65 },
        { termo: 'energisa acre distribuidora de energia s.a.',   nivel: 3, confianca: 1.00 },
      ],
      padroes_campos: { numero_parecer: ['pac-ac', 'energisa-ac'], potencia_aprovada_kw: ['potencia aprovada'], tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'] },
      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['energisa', 'acre', 'ac', 'norte'],
    },

    { id: 'ENERGISA_ES', nome_canonical: 'Energisa Espírito Santo',
      nome_completo: 'Energisa Espírito Santo Distribuidora de Energia S.A.',
      grupo: 'energisa', estado: 'ES', codigo_aneel: '07',
      tensoes_padrao_bt_v: [127, 220, 380],
      aliases: [
        { termo: 'energisa espirito santo',                       nivel: 1, confianca: 0.70 },
        { termo: 'energisa espírito santo',                       nivel: 1, confianca: 0.70 },
        { termo: 'energisa es',                                   nivel: 1, confianca: 0.65 },
        { termo: 'escelsa',                                       nivel: 1, confianca: 0.60 },
        { termo: 'energisa espirito santo distribuidora s.a.',    nivel: 3, confianca: 1.00 },
      ],
      padroes_campos: { numero_parecer: ['pac-es', 'energisa-es', 'escelsa-'], potencia_aprovada_kw: ['potencia aprovada'], tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'] },
      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['energisa', 'espirito_santo', 'es', 'escelsa', 'sudeste'],
    },

    { id: 'ENERGISA_MS', nome_canonical: 'Energisa Mato Grosso do Sul',
      nome_completo: 'Energisa Mato Grosso do Sul Distribuidora de Energia S.A.',
      grupo: 'energisa', estado: 'MS', codigo_aneel: '13',
      tensoes_padrao_bt_v: [127, 220, 380],
      aliases: [
        { termo: 'energisa mato grosso do sul',                   nivel: 1, confianca: 0.70 },
        { termo: 'energisa ms',                                   nivel: 1, confianca: 0.65 },
        { termo: 'enersul',                                       nivel: 1, confianca: 0.60 },
        { termo: 'energisa mato grosso do sul distribuidora s.a.',nivel: 3, confianca: 1.00 },
      ],
      padroes_campos: { numero_parecer: ['pac-ms', 'energisa-ms', 'enersul-'], potencia_aprovada_kw: ['potencia aprovada'], tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'] },
      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['energisa', 'mato_grosso_do_sul', 'ms', 'enersul', 'centro_oeste'],
    },

    { id: 'ENERGISA_MT', nome_canonical: 'Energisa Mato Grosso',
      nome_completo: 'Energisa Mato Grosso Distribuidora de Energia S.A.',
      grupo: 'energisa', estado: 'MT', codigo_aneel: '14',
      tensoes_padrao_bt_v: [127, 220, 380],
      aliases: [
        { termo: 'energisa mato grosso',                          nivel: 1, confianca: 0.70 },
        { termo: 'energisa mt',                                   nivel: 1, confianca: 0.65 },
        { termo: 'cemat',                                         nivel: 1, confianca: 0.60 },
        { termo: 'energisa mato grosso distribuidora s.a.',       nivel: 3, confianca: 1.00 },
      ],
      padroes_campos: { numero_parecer: ['pac-mt', 'energisa-mt', 'cemat-'], potencia_aprovada_kw: ['potencia aprovada'], tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'] },
      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['energisa', 'mato_grosso', 'mt', 'cemat', 'centro_oeste'],
    },

    { id: 'ENERGISA_PB', nome_canonical: 'Energisa Paraíba',
      nome_completo: 'Energisa Paraíba Distribuidora de Energia S.A.',
      grupo: 'energisa', estado: 'PB', codigo_aneel: '16',
      tensoes_padrao_bt_v: [127, 220, 380],
      aliases: [
        { termo: 'energisa paraiba',                              nivel: 1, confianca: 0.70 },
        { termo: 'energisa paraíba',                              nivel: 1, confianca: 0.70 },
        { termo: 'energisa pb',                                   nivel: 1, confianca: 0.65 },
        { termo: 'saelpa',                                        nivel: 1, confianca: 0.60 },
        { termo: 'energisa paraiba distribuidora s.a.',           nivel: 3, confianca: 1.00 },
      ],
      padroes_campos: { numero_parecer: ['pac-pb', 'energisa-pb', 'saelpa-'], potencia_aprovada_kw: ['potencia aprovada'], tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'] },
      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['energisa', 'paraiba', 'pb', 'saelpa', 'nordeste'],
    },

    { id: 'ENERGISA_RO', nome_canonical: 'Energisa Rondônia',
      nome_completo: 'Energisa Rondônia Distribuidora de Energia S.A.',
      grupo: 'energisa', estado: 'RO', codigo_aneel: '21',
      tensoes_padrao_bt_v: [127, 220, 380],
      aliases: [
        { termo: 'energisa rondonia',                             nivel: 1, confianca: 0.70 },
        { termo: 'energisa rondônia',                             nivel: 1, confianca: 0.70 },
        { termo: 'energisa ro',                                   nivel: 1, confianca: 0.65 },
        { termo: 'ceron',                                         nivel: 1, confianca: 0.60 },
        { termo: 'energisa rondonia distribuidora s.a.',          nivel: 3, confianca: 1.00 },
      ],
      padroes_campos: { numero_parecer: ['pac-ro', 'energisa-ro', 'ceron-'], potencia_aprovada_kw: ['potencia aprovada'], tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'] },
      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['energisa', 'rondonia', 'ro', 'ceron', 'norte'],
    },

    { id: 'ENERGISA_RR', nome_canonical: 'Energisa Roraima',
      nome_completo: 'Energisa Roraima Distribuidora de Energia S.A.',
      grupo: 'energisa', estado: 'RR', codigo_aneel: '23',
      tensoes_padrao_bt_v: [127, 220, 380],
      aliases: [
        { termo: 'energisa roraima',                              nivel: 1, confianca: 0.70 },
        { termo: 'energisa rr',                                   nivel: 1, confianca: 0.65 },
        { termo: 'cerr',                                          nivel: 1, confianca: 0.60 },
        { termo: 'energisa roraima distribuidora s.a.',           nivel: 3, confianca: 1.00 },
      ],
      padroes_campos: { numero_parecer: ['pac-rr', 'energisa-rr', 'cerr-'], potencia_aprovada_kw: ['potencia aprovada'], tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'] },
      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['energisa', 'roraima', 'rr', 'cerr', 'norte'],
    },

    { id: 'ENERGISA_SE', nome_canonical: 'Energisa Sergipe',
      nome_completo: 'Energisa Sergipe Distribuidora de Energia S.A.',
      grupo: 'energisa', estado: 'SE', codigo_aneel: '26',
      tensoes_padrao_bt_v: [127, 220, 380],
      aliases: [
        { termo: 'energisa sergipe',                              nivel: 1, confianca: 0.70 },
        { termo: 'energisa se',                                   nivel: 1, confianca: 0.65 },
        { termo: 'sase',                                          nivel: 1, confianca: 0.55 },
        { termo: 'energisa sergipe distribuidora s.a.',           nivel: 3, confianca: 1.00 },
      ],
      padroes_campos: { numero_parecer: ['pac-se', 'energisa-se'], potencia_aprovada_kw: ['potencia aprovada'], tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'] },
      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['energisa', 'sergipe', 'se', 'nordeste'],
    },

    { id: 'ENERGISA_TO', nome_canonical: 'Energisa Tocantins',
      nome_completo: 'Energisa Tocantins Distribuidora de Energia S.A.',
      grupo: 'energisa', estado: 'TO', codigo_aneel: '27',
      tensoes_padrao_bt_v: [127, 220, 380],
      aliases: [
        { termo: 'energisa tocantins',                            nivel: 1, confianca: 0.70 },
        { termo: 'energisa to',                                   nivel: 1, confianca: 0.65 },
        { termo: 'celtins',                                       nivel: 1, confianca: 0.60 },
        { termo: 'energisa tocantins distribuidora s.a.',         nivel: 3, confianca: 1.00 },
      ],
      padroes_campos: { numero_parecer: ['pac-to', 'energisa-to', 'celtins-'], potencia_aprovada_kw: ['potencia aprovada'], tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'] },
      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['energisa', 'tocantins', 'to', 'celtins', 'norte'],
    },

  ]),
})
