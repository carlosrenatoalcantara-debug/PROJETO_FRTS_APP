/**
 * grupos/equatorial.js — Biblioteca Nacional de Concessionárias
 * Grupo Equatorial Energia
 *
 * Distribuidoras: EQUATORIAL PARÁ, EQUATORIAL MARANHÃO, EQUATORIAL ALAGOAS,
 *                 EQUATORIAL GOIÁS, EQUATORIAL PIAUÍ,
 *                 EQUATORIAL CEARÁ, EQUATORIAL RIO, EQUATORIAL SÃO PAULO
 *                 (três últimas: pós-aquisição Enel Brasil 2024)
 *
 * Nota: EQUATORIAL CEEE (RS) e EQUATORIAL AMAZONAS (AM) constam em independentes.js
 *       pois foram adquiridas em anos distintos (2022/2023) e ainda em rebranding.
 */

export const GRUPO_EQUATORIAL = Object.freeze({
  id:          'equatorial',
  nome_grupo:  'Equatorial Energia',
  controlador: 'Equatorial Energia S.A.',

  distribuidoras: Object.freeze([

    // ── EQUATORIAL PARÁ ────────────────────────────────────────────────────────
    {
      id:              'EQUATORIAL_PARA',
      nome_canonical:  'Equatorial Pará',
      nome_completo:   'Equatorial Pará Distribuidora de Energia S.A.',
      grupo:           'equatorial',
      estado:          'PA',
      codigo_aneel:    '17',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'equatorial para',                                     nivel: 1, confianca: 0.70 },
        { termo: 'equatorial pará',                                     nivel: 1, confianca: 0.70 },
        { termo: 'equatorial pa',                                       nivel: 1, confianca: 0.65 },
        { termo: 'equatorial energia para',                             nivel: 2, confianca: 0.90 },
        { termo: 'equatorial para distribuidora',                       nivel: 2, confianca: 0.90 },
        { termo: 'equatorial para distribuidora de energia s.a.',       nivel: 3, confianca: 1.00 },
        // Pré-rebranding (CELPA)
        { termo: 'celpa',                                               nivel: 1, confianca: 0.65 },
        { termo: 'centrais eletricas do para',                          nivel: 3, confianca: 0.90 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-pa', 'equatorial-pa', 'celpa-'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia de conexao'],
        tensao_conexao:        ['tensao de atendimento', 'tensao nominal'],
        disjuntor_geral_a:     ['disjuntor geral', 'protecao geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['equatorial', 'para', 'pa', 'celpa', 'norte'],
    },

    // ── EQUATORIAL MARANHÃO ────────────────────────────────────────────────────
    {
      id:              'EQUATORIAL_MARANHAO',
      nome_canonical:  'Equatorial Maranhão',
      nome_completo:   'Equatorial Maranhão Distribuidora de Energia S.A.',
      grupo:           'equatorial',
      estado:          'MA',
      codigo_aneel:    '22',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'equatorial maranhao',                                 nivel: 1, confianca: 0.70 },
        { termo: 'equatorial maranhão',                                 nivel: 1, confianca: 0.70 },
        { termo: 'equatorial ma',                                       nivel: 1, confianca: 0.65 },
        { termo: 'energia do maranhao',                                 nivel: 1, confianca: 0.65 },
        { termo: 'equatorial energia maranhao',                         nivel: 2, confianca: 0.90 },
        { termo: 'equatorial maranhao distribuidora de energia s.a.',   nivel: 3, confianca: 1.00 },
        // Pré-rebranding (CEMAR)
        { termo: 'cemar',                                               nivel: 1, confianca: 0.65 },
        { termo: 'companhia energetica do maranhao',                    nivel: 3, confianca: 0.90 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-ma', 'equatorial-ma', 'cemar-'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['equatorial', 'maranhao', 'ma', 'cemar', 'nordeste'],
    },

    // ── EQUATORIAL ALAGOAS ─────────────────────────────────────────────────────
    {
      id:              'EQUATORIAL_ALAGOAS',
      nome_canonical:  'Equatorial Alagoas',
      nome_completo:   'Equatorial Alagoas Distribuidora de Energia S.A.',
      grupo:           'equatorial',
      estado:          'AL',
      codigo_aneel:    '02',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'equatorial alagoas',                                  nivel: 1, confianca: 0.70 },
        { termo: 'equatorial al',                                       nivel: 1, confianca: 0.65 },
        { termo: 'equatorial energia alagoas',                          nivel: 2, confianca: 0.90 },
        { termo: 'equatorial alagoas distribuidora de energia s.a.',    nivel: 3, confianca: 1.00 },
        // Pré-rebranding (CEAL)
        { termo: 'ceal',                                                nivel: 1, confianca: 0.65 },
        { termo: 'companhia energetica de alagoas',                     nivel: 3, confianca: 0.90 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-al', 'equatorial-al', 'ceal-'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['equatorial', 'alagoas', 'al', 'ceal', 'nordeste'],
    },

    // ── EQUATORIAL GOIÁS ───────────────────────────────────────────────────────
    {
      id:              'EQUATORIAL_GOIAS',
      nome_canonical:  'Equatorial Goiás',
      nome_completo:   'Equatorial Goiás Distribuidora de Energia S.A.',
      grupo:           'equatorial',
      estado:          'GO',
      codigo_aneel:    '08',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'equatorial goias',                                    nivel: 1, confianca: 0.70 },
        { termo: 'equatorial goiás',                                    nivel: 1, confianca: 0.70 },
        { termo: 'equatorial go',                                       nivel: 1, confianca: 0.65 },
        { termo: 'enel goias',                                          nivel: 1, confianca: 0.65 },
        { termo: 'equatorial energia goias',                            nivel: 2, confianca: 0.90 },
        { termo: 'equatorial goias distribuidora de energia s.a.',      nivel: 3, confianca: 1.00 },
        // Pré-rebranding (Celg/Enel Goiás)
        { termo: 'celg',                                                nivel: 1, confianca: 0.60 },
        { termo: 'celg distribuicao',                                   nivel: 2, confianca: 0.75 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-go', 'equatorial-go', 'celg-'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia de conexao'],
        tensao_conexao:        ['tensao de atendimento', 'tensao nominal'],
        disjuntor_geral_a:     ['disjuntor geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['equatorial', 'goias', 'go', 'celg', 'centro_oeste'],
    },

    // ── EQUATORIAL PIAUÍ ───────────────────────────────────────────────────────
    {
      id:              'EQUATORIAL_PIAUI',
      nome_canonical:  'Equatorial Piauí',
      nome_completo:   'Equatorial Piauí Distribuidora de Energia S.A.',
      grupo:           'equatorial',
      estado:          'PI',
      codigo_aneel:    '18',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'equatorial piaui',                                    nivel: 1, confianca: 0.70 },
        { termo: 'equatorial piauí',                                    nivel: 1, confianca: 0.70 },
        { termo: 'equatorial pi',                                       nivel: 1, confianca: 0.65 },
        { termo: 'equatorial energia piaui',                            nivel: 2, confianca: 0.90 },
        { termo: 'equatorial piaui distribuidora de energia s.a.',      nivel: 3, confianca: 1.00 },
        // Pré-rebranding (CEPISA)
        { termo: 'cepisa',                                              nivel: 1, confianca: 0.65 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-pi', 'equatorial-pi', 'cepisa-'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['equatorial', 'piaui', 'pi', 'cepisa', 'nordeste'],
    },

    // ── EQUATORIAL CEARÁ (pós-aquisição Enel 2024) ────────────────────────────
    {
      id:              'EQUATORIAL_CEARA',
      nome_canonical:  'Equatorial Ceará',
      nome_completo:   'Equatorial Ceará Distribuidora de Energia S.A.',
      grupo:           'equatorial',
      estado:          'CE',
      codigo_aneel:    '20',
      tensoes_padrao_bt_v: [127, 220, 380],
      nota: 'Rebranding de Enel Ceará (2024). Documentos anteriores: ver enel.js',

      aliases: [
        { termo: 'equatorial ceara',                                    nivel: 1, confianca: 0.75 },
        { termo: 'equatorial ceará',                                    nivel: 1, confianca: 0.75 },
        { termo: 'equatorial ce',                                       nivel: 1, confianca: 0.65 },
        { termo: 'equatorial energia ceara',                            nivel: 2, confianca: 0.90 },
        { termo: 'equatorial ceara distribuidora de energia s.a.',      nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-ce', 'equatorial-ce'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia de conexao'],
        tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['equatorial', 'ceara', 'ce', 'nordeste'],
    },

    // ── EQUATORIAL RIO (pós-aquisição Enel 2024) ──────────────────────────────
    {
      id:              'EQUATORIAL_RIO',
      nome_canonical:  'Equatorial Rio',
      nome_completo:   'Equatorial Rio Distribuidora de Energia S.A.',
      grupo:           'equatorial',
      estado:          'RJ',
      codigo_aneel:    '25',
      tensoes_padrao_bt_v: [127, 220, 380],
      nota: 'Rebranding de Enel Rio (2024). Documentos anteriores: ver enel.js. Área distinta da Light (RJ).',

      aliases: [
        { termo: 'equatorial rio',                                      nivel: 1, confianca: 0.75 },
        { termo: 'equatorial rj',                                       nivel: 1, confianca: 0.65 },
        { termo: 'equatorial energia rio',                              nivel: 2, confianca: 0.90 },
        { termo: 'equatorial rio distribuidora de energia s.a.',        nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-rj', 'equatorial-rj'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia de conexao'],
        tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['equatorial', 'rio', 'rj', 'sudeste'],
    },

    // ── EQUATORIAL SÃO PAULO (pós-aquisição Enel 2024) ────────────────────────
    {
      id:              'EQUATORIAL_SP',
      nome_canonical:  'Equatorial São Paulo',
      nome_completo:   'Equatorial São Paulo Distribuidora de Energia S.A.',
      grupo:           'equatorial',
      estado:          'SP',   // Grande SP e litoral — área distinta da CPFL e Elektro
      codigo_aneel:    '35',
      tensoes_padrao_bt_v: [127, 220, 380],
      nota: 'Rebranding de Enel São Paulo (2024). Documentos anteriores: ver enel.js.',

      aliases: [
        { termo: 'equatorial sao paulo',                                nivel: 1, confianca: 0.75 },
        { termo: 'equatorial são paulo',                                nivel: 1, confianca: 0.75 },
        { termo: 'equatorial sp',                                       nivel: 1, confianca: 0.65 },
        { termo: 'equatorial energia sao paulo',                        nivel: 2, confianca: 0.90 },
        { termo: 'equatorial sao paulo distribuidora de energia s.a.',  nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-sp-eq', 'equatorial-sp'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'tensao de fornecimento'],
        disjuntor_geral_a:     ['disjuntor geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['equatorial', 'sao_paulo', 'sp', 'grande_sp', 'sudeste'],
    },

  ]),
})
