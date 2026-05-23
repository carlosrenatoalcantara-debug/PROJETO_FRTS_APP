/**
 * grupos/enel.js — Biblioteca Nacional de Concessionárias
 * Grupo Enel (adquirido pela Equatorial em 2024)
 *
 * NOTA REGULATÓRIA: Em 2024, a Enel Brasil foi adquirida pela Equatorial Energia.
 * As distribuidoras estão em processo de rebranding. Aliases "Enel" são mantidos
 * pois documentos emitidos até 2024 referenciam as marcas anteriores.
 * Aliases "Equatorial" para CE, RJ e SP constam em equatorial.js (pós-aquisição).
 *
 * Distribuidoras: ENEL CEARÁ, ENEL RIO, ENEL SÃO PAULO
 */

export const GRUPO_ENEL = Object.freeze({
  id:          'enel',
  nome_grupo:  'Enel Brasil',
  controlador: 'Equatorial Energia (pós-2024)',

  nota_regulatoria: 'Adquirida pela Equatorial em 2024. Aliases Enel mantidos por retrocompatibilidade documental.',

  distribuidoras: Object.freeze([

    // ── ENEL CEARÁ ─────────────────────────────────────────────────────────────
    {
      id:              'ENEL_CEARA',
      nome_canonical:  'Enel Ceará',
      nome_completo:   'Enel Distribuição Ceará S.A.',
      grupo:           'enel',
      estado:          'CE',
      codigo_aneel:    '20',
      tensoes_padrao_bt_v: [127, 220, 380],
      status_rebranding: 'Equatorial Ceará (2024+)',

      aliases: [
        { termo: 'enel ceara',                                          nivel: 1, confianca: 0.70 },
        { termo: 'enel ceará',                                          nivel: 1, confianca: 0.70 },
        { termo: 'enel distribuicao ceara',                             nivel: 2, confianca: 0.90 },
        { termo: 'enel distribuição ceará',                             nivel: 2, confianca: 0.90 },
        { termo: 'enel distribuicao ceara s.a.',                        nivel: 3, confianca: 1.00 },
        // Aliases pré-rebranding (Coelce)
        { termo: 'coelce',                                              nivel: 1, confianca: 0.65 },
        { termo: 'companhia energetica do ceara',                       nivel: 3, confianca: 0.95 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-ce', 'enel-ce', 'parecer enel', 'coelce-'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da microgeracao', 'potencia de conexao'],
        tensao_conexao:        ['tensao de atendimento', 'tensao nominal', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral', 'protecao geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['enel', 'ceara', 'ce', 'coelce', 'nordeste'],
    },

    // ── ENEL RIO ───────────────────────────────────────────────────────────────
    {
      id:              'ENEL_RIO',
      nome_canonical:  'Enel Rio',
      nome_completo:   'Enel Distribuição Rio S.A.',
      grupo:           'enel',
      estado:          'RJ',
      codigo_aneel:    '25',
      tensoes_padrao_bt_v: [127, 220, 380],
      status_rebranding: 'Equatorial Rio (2024+)',

      aliases: [
        { termo: 'enel rio',                                            nivel: 1, confianca: 0.70 },
        { termo: 'enel distribuicao rio',                               nivel: 2, confianca: 0.90 },
        { termo: 'enel distribuição rio',                               nivel: 2, confianca: 0.90 },
        { termo: 'enel rj',                                             nivel: 2, confianca: 0.85 },
        { termo: 'enel distribuicao rio s.a.',                          nivel: 3, confianca: 1.00 },
        // Pré-rebranding (Light/Ampla)
        { termo: 'ampla',                                               nivel: 1, confianca: 0.60 },
        { termo: 'ampla energia',                                       nivel: 2, confianca: 0.75 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-rj', 'enel-rj', 'parecer enel rio'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia de geracao'],
        tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral', 'protecao geral'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['enel', 'rio', 'rj', 'ampla', 'sudeste'],
    },

    // ── ENEL SÃO PAULO ─────────────────────────────────────────────────────────
    {
      id:              'ENEL_SP',
      nome_canonical:  'Enel São Paulo',
      nome_completo:   'Enel Distribuição São Paulo S.A.',
      grupo:           'enel',
      estado:          'SP',   // Grande SP e litoral
      codigo_aneel:    '35',
      tensoes_padrao_bt_v: [127, 220, 380],
      status_rebranding: 'Equatorial São Paulo (2024+)',

      aliases: [
        { termo: 'enel sao paulo',                                      nivel: 1, confianca: 0.70 },
        { termo: 'enel são paulo',                                      nivel: 1, confianca: 0.70 },
        { termo: 'enel sp',                                             nivel: 1, confianca: 0.70 },
        { termo: 'enel distribuicao sao paulo',                         nivel: 2, confianca: 0.90 },
        { termo: 'enel distribuição são paulo',                         nivel: 2, confianca: 0.90 },
        { termo: 'enel distribuicao sao paulo s.a.',                    nivel: 3, confianca: 1.00 },
        // Pré-rebranding (Eletropaulo/AES)
        { termo: 'eletropaulo',                                         nivel: 1, confianca: 0.60 },
        { termo: 'aes eletropaulo',                                     nivel: 2, confianca: 0.70 },
        { termo: 'aes brasil',                                          nivel: 1, confianca: 0.55 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-sp', 'enel-sp', 'parecer enel sp', 'eletropaulo-'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'tensao de fornecimento'],
        disjuntor_geral_a:     ['disjuntor geral', 'capacidade nominal do disjuntor'],
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['enel', 'sao_paulo', 'sp', 'eletropaulo', 'sudeste', 'grande_sp'],
    },

  ]),
})
