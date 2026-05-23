/**
 * grupos/cpfl.js — Biblioteca Nacional de Concessionárias
 * Grupo CPFL Energia (controlador: State Grid Corporation of China)
 *
 * Distribuidoras: CPFL Paulista, CPFL Piratininga, RGE, CPFL Santa Cruz
 */

export const GRUPO_CPFL = Object.freeze({
  id:          'cpfl',
  nome_grupo:  'CPFL Energia',
  controlador: 'State Grid Corporation of China',

  distribuidoras: Object.freeze([

    // ── CPFL PAULISTA ──────────────────────────────────────────────────────────
    {
      id:              'CPFL_PAULISTA',
      nome_canonical:  'CPFL Paulista',
      nome_completo:   'Companhia Paulista de Força e Luz',
      grupo:           'cpfl',
      estado:          'SP',  // interior SP (Campinas, Ribeirão Preto, etc.)
      codigo_aneel:    '34',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'cpfl paulista',                                       nivel: 1, confianca: 0.75 },
        { termo: 'cpfl',                                                nivel: 1, confianca: 0.55 },  // genérico
        { termo: 'cpfl energia paulista',                               nivel: 2, confianca: 0.90 },
        { termo: 'companhia paulista de forca e luz',                   nivel: 3, confianca: 1.00 },
        { termo: 'companhia paulista de força e luz',                   nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-sp', 'cpfl-sp', 'parecer cpfl paulista'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da microgeracao', 'potencia instalada'],
        tensao_conexao:        ['tensao de atendimento', 'tensao de fornecimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral', 'capacidade do disjuntor', 'disj. geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['cpfl', 'paulista', 'sp', 'interior_sp', 'campinas', 'sudeste'],
    },

    // ── CPFL PIRATININGA ───────────────────────────────────────────────────────
    {
      id:              'CPFL_PIRATININGA',
      nome_canonical:  'CPFL Piratininga',
      nome_completo:   'Companhia Piratininga de Força e Luz',
      grupo:           'cpfl',
      estado:          'SP',  // litoral SP, baixada santista
      codigo_aneel:    '33',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'cpfl piratininga',                                    nivel: 1, confianca: 0.75 },
        { termo: 'piratininga',                                         nivel: 1, confianca: 0.65 },
        { termo: 'cpfl energia piratininga',                            nivel: 2, confianca: 0.90 },
        { termo: 'companhia piratininga de forca e luz',                nivel: 3, confianca: 1.00 },
        { termo: 'companhia piratininga de força e luz',                nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-pirat', 'cpfl-pirat', 'parecer cpfl piratininga'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral', 'disj. geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['cpfl', 'piratininga', 'sp', 'litoral_sp', 'santos', 'sudeste'],
    },

    // ── RGE (Rio Grande Energia) ───────────────────────────────────────────────
    {
      id:              'RGE',
      nome_canonical:  'RGE',
      nome_completo:   'Rio Grande Energia S.A.',
      grupo:           'cpfl',
      estado:          'RS',
      codigo_aneel:    '24',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'rge',                                                 nivel: 1, confianca: 0.70 },
        { termo: 'cpfl rge',                                            nivel: 1, confianca: 0.75 },
        { termo: 'rio grande energia',                                  nivel: 2, confianca: 0.85 },
        { termo: 'rge sul',                                             nivel: 2, confianca: 0.85 },
        { termo: 'rio grande energia s.a.',                             nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-rs', 'rge-', 'parecer rge'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['cpfl', 'rge', 'rs', 'rio_grande_do_sul', 'sul'],
    },

    // ── CPFL SANTA CRUZ ────────────────────────────────────────────────────────
    {
      id:              'CPFL_SANTA_CRUZ',
      nome_canonical:  'CPFL Santa Cruz',
      nome_completo:   'Companhia Luz e Força Santa Cruz',
      grupo:           'cpfl',
      estado:          'SP',   // oeste paulista
      codigo_aneel:    '36',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'cpfl santa cruz',                                     nivel: 1, confianca: 0.75 },
        { termo: 'santa cruz energia',                                  nivel: 2, confianca: 0.80 },
        { termo: 'luz e forca santa cruz',                              nivel: 2, confianca: 0.90 },
        { termo: 'companhia luz e forca santa cruz',                    nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-sc-cpfl', 'santa-cruz-', 'parecer cpfl santa cruz'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['cpfl', 'santa_cruz', 'sp', 'oeste_paulista', 'sudeste'],
    },

  ]),
})
