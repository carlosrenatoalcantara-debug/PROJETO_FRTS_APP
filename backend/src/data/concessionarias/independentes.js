/**
 * independentes.js — Biblioteca Nacional de Concessionárias
 * Concessionárias estaduais, cooperativas e distribuidoras sem vínculo com
 * os grandes grupos privados (Neoenergia/Iberdrola, Equatorial, Energisa, CPFL/State Grid)
 *
 * Inclui:
 *   CEMIG  (MG) — Companhia Energética de Minas Gerais
 *   COPEL  (PR) — Companhia Paranaense de Energia
 *   CELESC (SC) — Centrais Elétricas de Santa Catarina
 *   Light  (RJ) — Light Serviços de Eletricidade (área distinta da Equatorial Rio)
 *   CEEE   (RS) — Equatorial CEEE / Grande Porto Alegre (área distinta da RGE/CPFL)
 *   Amazonas Energia (AM) — Equatorial Amazonas (rebranding pós-2023)
 *   CEA    (AP) — Companhia de Eletricidade do Amapá
 *   DMED   (MG) — Distribuidora de Energia de Minas Gerais (Juiz de Fora, subsidiária CEMIG)
 *   COCEL  (PR) — Cooperativa de Eletrificação Rural Cornélio Procópio
 *   CFLO   (PR) — Cooperativa de Energia e Desenvolvimento Rural do Médio Chopim
 *   ELETROCAR (RS) — Cooperativa de Distribuição de Energia Elétrica Taquari-Jacuí
 *   COOPERALIANÇA (SC) — Cooperativa Alto Uruguai Catarinense
 *   HIDROPAN (RS) — Cooperativa de Distribuição de Energia Elétrica
 *   IENERGIA (SC) — Iguaçu Distribuidora de Energia Elétrica
 *   SULGIPE (SE) — Cooperativa Sul-Sergipana de Eletrificação (minor)
 */

export const CONCESSIONARIAS_INDEPENDENTES = Object.freeze([

  // ══════════════════════════════════════════════════════════════════════════
  // TIER-1 — Alta relevância comercial / grandes concessionárias estaduais
  // ══════════════════════════════════════════════════════════════════════════

  // ── CEMIG ──────────────────────────────────────────────────────────────────
  {
    id:              'CEMIG',
    nome_canonical:  'CEMIG',
    nome_completo:   'Companhia Energética de Minas Gerais',
    grupo:           null,
    controlador:     'Governo de Minas Gerais',
    estado:          'MG',
    codigo_aneel:    '05',
    tensoes_padrao_bt_v: [127, 220, 380],

    aliases: [
      { termo: 'cemig',                                                nivel: 1, confianca: 0.70 },
      { termo: 'cemig distribuicao',                                   nivel: 2, confianca: 0.85 },
      { termo: 'cemig distribuição',                                   nivel: 2, confianca: 0.85 },
      { termo: 'cemig d',                                              nivel: 2, confianca: 0.80 },
      { termo: 'companhia energetica de minas gerais',                 nivel: 3, confianca: 1.00 },
      { termo: 'companhia energética de minas gerais',                 nivel: 3, confianca: 1.00 },
    ],

    padroes_campos: {
      numero_parecer:        ['pac-mg', 'cemig-', 'parecer cemig', 'cnec-'],
      potencia_aprovada_kw:  ['potencia aprovada', 'potencia da microgeracao', 'potencia de conexao'],
      tensao_conexao:        ['tensao de atendimento', 'tensao de fornecimento', 'nivel de tensao'],
      disjuntor_geral_a:     ['disjuntor geral', 'disjuntor de entrada', 'disj. geral'],
    },

    readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
    tokens_semanticos: ['cemig', 'mg', 'minas_gerais', 'sudeste', 'estatal'],
  },

  // ── COPEL ──────────────────────────────────────────────────────────────────
  {
    id:              'COPEL',
    nome_canonical:  'COPEL',
    nome_completo:   'Companhia Paranaense de Energia',
    grupo:           null,
    controlador:     'Governo do Paraná',
    estado:          'PR',
    codigo_aneel:    '19',
    tensoes_padrao_bt_v: [127, 220, 380],

    aliases: [
      { termo: 'copel',                                                nivel: 1, confianca: 0.70 },
      { termo: 'copel distribuicao',                                   nivel: 2, confianca: 0.85 },
      { termo: 'copel distribuição',                                   nivel: 2, confianca: 0.85 },
      { termo: 'copel dis',                                            nivel: 2, confianca: 0.80 },
      { termo: 'companhia paranaense de energia',                      nivel: 3, confianca: 1.00 },
    ],

    padroes_campos: {
      numero_parecer:        ['pac-pr', 'copel-', 'parecer copel', 'cnec-pr'],
      potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao', 'potencia de conexao'],
      tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
      disjuntor_geral_a:     ['disjuntor geral', 'disj. geral'],
    },

    readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
    tokens_semanticos: ['copel', 'pr', 'parana', 'sul', 'estatal'],
  },

  // ── CELESC ─────────────────────────────────────────────────────────────────
  {
    id:              'CELESC',
    nome_canonical:  'CELESC',
    nome_completo:   'Centrais Elétricas de Santa Catarina S.A.',
    grupo:           null,
    controlador:     'Governo de Santa Catarina',
    estado:          'SC',
    codigo_aneel:    '32',
    tensoes_padrao_bt_v: [127, 220, 380],

    aliases: [
      { termo: 'celesc',                                               nivel: 1, confianca: 0.70 },
      { termo: 'celesc distribuicao',                                  nivel: 2, confianca: 0.85 },
      { termo: 'celesc distribuição',                                  nivel: 2, confianca: 0.85 },
      { termo: 'celesc d',                                             nivel: 2, confianca: 0.80 },
      { termo: 'centrais eletricas de santa catarina',                 nivel: 3, confianca: 1.00 },
      { termo: 'centrais elétricas de santa catarina s.a.',            nivel: 3, confianca: 1.00 },
    ],

    padroes_campos: {
      numero_parecer:        ['pac-sc', 'celesc-', 'parecer celesc'],
      potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
      tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
      disjuntor_geral_a:     ['disjuntor geral'],
    },

    readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
    tokens_semanticos: ['celesc', 'sc', 'santa_catarina', 'sul', 'estatal'],
  },

  // ── LIGHT ──────────────────────────────────────────────────────────────────
  {
    id:              'LIGHT',
    nome_canonical:  'Light',
    nome_completo:   'Light Serviços de Eletricidade S.A.',
    grupo:           null,
    controlador:     'Light S.A.',
    estado:          'RJ',   // Grande Rio — área distinta da Equatorial Rio (ex-Enel Rio)
    codigo_aneel:    '11',
    tensoes_padrao_bt_v: [127, 220, 380],
    nota: 'Atende municípios do Grande Rio distintos da área da Equatorial Rio. Inclui capital e municípios da baixada.',

    aliases: [
      { termo: 'light',                                                nivel: 1, confianca: 0.65 },
      { termo: 'light rj',                                             nivel: 2, confianca: 0.80 },
      { termo: 'light servicos',                                       nivel: 2, confianca: 0.85 },
      { termo: 'light servicos de eletricidade',                       nivel: 3, confianca: 1.00 },
      { termo: 'light serviços de eletricidade s.a.',                  nivel: 3, confianca: 1.00 },
    ],

    padroes_campos: {
      numero_parecer:        ['pac-rj-light', 'light-', 'parecer light'],
      potencia_aprovada_kw:  ['potencia aprovada', 'potencia de conexao'],
      tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
      disjuntor_geral_a:     ['disjuntor geral'],
    },

    readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
    tokens_semanticos: ['light', 'rj', 'rio_de_janeiro', 'grande_rio', 'sudeste'],
  },

  // ── CEEE-D / EQUATORIAL CEEE ───────────────────────────────────────────────
  {
    id:              'CEEE',
    nome_canonical:  'CEEE Equatorial',
    nome_completo:   'Companhia Estadual de Distribuição de Energia Elétrica',
    grupo:           null,
    controlador:     'Equatorial Energia (pós-2022)',
    estado:          'RS',   // Grande Porto Alegre e litoral gaúcho
    codigo_aneel:    '06',
    tensoes_padrao_bt_v: [127, 220, 380],
    nota: 'Adquirida pela Equatorial Energia em 2022. Área: Grande Porto Alegre, litoral gaúcho e sul do RS. Interior gaúcho coberto pela RGE (grupo CPFL).',

    aliases: [
      { termo: 'ceee',                                                 nivel: 1, confianca: 0.65 },
      { termo: 'ceee equatorial',                                      nivel: 1, confianca: 0.70 },
      { termo: 'ceee-d',                                               nivel: 2, confianca: 0.80 },
      { termo: 'ceee distribuicao',                                    nivel: 2, confianca: 0.85 },
      { termo: 'equatorial rs',                                        nivel: 2, confianca: 0.75 },
      { termo: 'companhia estadual de distribuicao de energia eletrica', nivel: 3, confianca: 1.00 },
      { termo: 'companhia estadual de distribuição de energia elétrica', nivel: 3, confianca: 1.00 },
    ],

    padroes_campos: {
      numero_parecer:        ['pac-rs-ceee', 'ceee-', 'equatorial-rs'],
      potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
      tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
      disjuntor_geral_a:     ['disjuntor geral'],
    },

    readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
    tokens_semanticos: ['ceee', 'rs', 'rio_grande_do_sul', 'porto_alegre', 'sul', 'equatorial'],
  },

  // ── AMAZONAS ENERGIA / EQUATORIAL AMAZONAS ─────────────────────────────────
  {
    id:              'AMAZONAS_ENERGIA',
    nome_canonical:  'Amazonas Energia',
    nome_completo:   'Amazonas Distribuidora de Energia S.A.',
    grupo:           null,
    controlador:     'Equatorial Energia (pós-2023)',
    estado:          'AM',
    codigo_aneel:    '03',
    tensoes_padrao_bt_v: [127, 220, 380],
    nota: 'Adquirida pela Equatorial em 2023. Rebranding para Equatorial Amazonas em andamento.',

    aliases: [
      { termo: 'amazonas energia',                                     nivel: 1, confianca: 0.70 },
      { termo: 'equatorial amazonas',                                  nivel: 1, confianca: 0.70 },
      { termo: 'amazonas distribuidora',                               nivel: 2, confianca: 0.85 },
      { termo: 'amazonas distribuidora de energia s.a.',               nivel: 3, confianca: 1.00 },
      // Histórico
      { termo: 'manaus energia',                                       nivel: 1, confianca: 0.60 },
      { termo: 'eletrobras amazonas',                                   nivel: 1, confianca: 0.55 },
    ],

    padroes_campos: {
      numero_parecer:        ['pac-am', 'amazonas-', 'equatorial-am'],
      potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
      tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
      disjuntor_geral_a:     ['disjuntor geral'],
    },

    readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
    tokens_semanticos: ['amazonas_energia', 'am', 'amazonas', 'manaus', 'norte', 'equatorial'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER-2 — Relevância média / distribuidoras menores e cooperativas
  // ══════════════════════════════════════════════════════════════════════════

  // ── CEA (Amapá) ────────────────────────────────────────────────────────────
  {
    id:              'CEA',
    nome_canonical:  'CEA',
    nome_completo:   'Companhia de Eletricidade do Amapá',
    grupo:           null,
    controlador:     'Governo do Amapá',
    estado:          'AP',
    codigo_aneel:    '04',
    tensoes_padrao_bt_v: [127, 220, 380],

    aliases: [
      { termo: 'cea',                                                  nivel: 1, confianca: 0.60 },
      { termo: 'cea amapa',                                            nivel: 2, confianca: 0.80 },
      { termo: 'cia de eletricidade do amapa',                         nivel: 3, confianca: 1.00 },
      { termo: 'companhia de eletricidade do amapa',                   nivel: 3, confianca: 1.00 },
    ],

    padroes_campos: {
      numero_parecer:        ['pac-ap', 'cea-'],
      potencia_aprovada_kw:  ['potencia aprovada'],
      tensao_conexao:        ['tensao de atendimento'],
      disjuntor_geral_a:     ['disjuntor geral'],
    },

    readiness: { unifilar: false, memorial: true, art: false, ocr: true, embeddings: false },
    tokens_semanticos: ['cea', 'ap', 'amapa', 'norte'],
  },

  // ── DMED (MG — subsidiária CEMIG) ──────────────────────────────────────────
  {
    id:              'DMED',
    nome_canonical:  'DMED',
    nome_completo:   'Distribuidora de Energia de Minas Gerais S.A.',
    grupo:           null,
    controlador:     'CEMIG (subsidiária)',
    estado:          'MG',   // Juiz de Fora e entorno — Zona da Mata
    codigo_aneel:    '09',
    tensoes_padrao_bt_v: [127, 220, 380],

    aliases: [
      { termo: 'dmed',                                                 nivel: 1, confianca: 0.65 },
      { termo: 'distribuidora de energia de minas gerais',             nivel: 3, confianca: 1.00 },
    ],

    padroes_campos: {
      numero_parecer:        ['pac-mg-dmed', 'dmed-'],
      potencia_aprovada_kw:  ['potencia aprovada'],
      tensao_conexao:        ['tensao de atendimento'],
      disjuntor_geral_a:     ['disjuntor geral'],
    },

    readiness: { unifilar: false, memorial: true, art: false, ocr: true, embeddings: false },
    tokens_semanticos: ['dmed', 'mg', 'juiz_de_fora', 'zona_da_mata', 'sudeste'],
  },

  // ── IENERGIA (SC) ──────────────────────────────────────────────────────────
  {
    id:              'IENERGIA',
    nome_canonical:  'IENERGIA',
    nome_completo:   'Iguaçu Distribuidora de Energia Elétrica Ltda.',
    grupo:           null,
    controlador:     'Privado',
    estado:          'SC',
    codigo_aneel:    '38',
    tensoes_padrao_bt_v: [127, 220, 380],

    aliases: [
      { termo: 'ienergia',                                             nivel: 1, confianca: 0.65 },
      { termo: 'iguacu distribuidora',                                 nivel: 2, confianca: 0.80 },
      { termo: 'iguaçu distribuidora',                                 nivel: 2, confianca: 0.80 },
      { termo: 'iguacu distribuidora de energia eletrica',             nivel: 3, confianca: 1.00 },
    ],

    padroes_campos: {
      numero_parecer:        ['pac-sc-iguacu', 'ienergia-'],
      potencia_aprovada_kw:  ['potencia aprovada'],
      tensao_conexao:        ['tensao de atendimento'],
      disjuntor_geral_a:     ['disjuntor geral'],
    },

    readiness: { unifilar: false, memorial: true, art: false, ocr: true, embeddings: false },
    tokens_semanticos: ['ienergia', 'sc', 'santa_catarina', 'oeste_catarinense', 'sul'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER-3 — Cooperativas (menor volume de projetos FV)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id:              'COCEL',
    nome_canonical:  'COCEL',
    nome_completo:   'Cooperativa de Eletrificação Rural Cornélio Procópio',
    grupo:           null,
    controlador:     'Cooperativa de consumidores',
    estado:          'PR',
    codigo_aneel:    '43',
    tensoes_padrao_bt_v: [127, 220, 380],
    aliases: [
      { termo: 'cocel',                                                nivel: 1, confianca: 0.65 },
      { termo: 'cooperativa cornelio procopio',                        nivel: 2, confianca: 0.80 },
    ],
    padroes_campos: {
      numero_parecer: ['pac-pr-cocel', 'cocel-'], potencia_aprovada_kw: ['potencia aprovada'],
      tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'],
    },
    readiness: { unifilar: false, memorial: true, art: false, ocr: true, embeddings: false },
    tokens_semanticos: ['cocel', 'pr', 'parana', 'cooperativa', 'norte_do_parana', 'sul'],
  },

  {
    id:              'CFLO',
    nome_canonical:  'CFLO',
    nome_completo:   'Cooperativa de Energia e Desenvolvimento Rural do Médio Chopim',
    grupo:           null,
    controlador:     'Cooperativa de consumidores',
    estado:          'PR',
    codigo_aneel:    '41',
    tensoes_padrao_bt_v: [127, 220, 380],
    aliases: [
      { termo: 'cflo',                                                 nivel: 1, confianca: 0.65 },
      { termo: 'cooperativa medio chopim',                             nivel: 2, confianca: 0.80 },
    ],
    padroes_campos: {
      numero_parecer: ['pac-pr-cflo', 'cflo-'], potencia_aprovada_kw: ['potencia aprovada'],
      tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'],
    },
    readiness: { unifilar: false, memorial: true, art: false, ocr: true, embeddings: false },
    tokens_semanticos: ['cflo', 'pr', 'parana', 'cooperativa', 'sudoeste_parana', 'sul'],
  },

  {
    id:              'COOPERALIANCA',
    nome_canonical:  'CooperAliança',
    nome_completo:   'Cooperativa de Distribuição de Energia Elétrica Alto Uruguai Catarinense',
    grupo:           null,
    controlador:     'Cooperativa de consumidores',
    estado:          'SC',
    codigo_aneel:    '31',
    tensoes_padrao_bt_v: [127, 220, 380],
    aliases: [
      { termo: 'cooperalianca',                                        nivel: 1, confianca: 0.65 },
      { termo: 'cooperaliança',                                        nivel: 1, confianca: 0.65 },
    ],
    padroes_campos: {
      numero_parecer: ['pac-sc-coop', 'cooperalianca-'], potencia_aprovada_kw: ['potencia aprovada'],
      tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'],
    },
    readiness: { unifilar: false, memorial: true, art: false, ocr: true, embeddings: false },
    tokens_semanticos: ['cooperalianca', 'sc', 'santa_catarina', 'cooperativa', 'alto_uruguai', 'sul'],
  },

  {
    id:              'ELETROCAR',
    nome_canonical:  'Eletrocar',
    nome_completo:   'Cooperativa de Distribuição de Energia Elétrica Taquari-Jacuí',
    grupo:           null,
    controlador:     'Cooperativa de consumidores',
    estado:          'RS',
    codigo_aneel:    '42',
    tensoes_padrao_bt_v: [127, 220, 380],
    aliases: [
      { termo: 'eletrocar',                                            nivel: 1, confianca: 0.65 },
      { termo: 'cooperativa taquari jacui',                            nivel: 2, confianca: 0.80 },
    ],
    padroes_campos: {
      numero_parecer: ['pac-rs-eletrocar', 'eletrocar-'], potencia_aprovada_kw: ['potencia aprovada'],
      tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'],
    },
    readiness: { unifilar: false, memorial: true, art: false, ocr: true, embeddings: false },
    tokens_semanticos: ['eletrocar', 'rs', 'rio_grande_do_sul', 'cooperativa', 'taquari', 'sul'],
  },

  {
    id:              'HIDROPAN',
    nome_canonical:  'Hidropan',
    nome_completo:   'Cooperativa de Distribuição de Energia Elétrica Noroeste do Rio Grande do Sul',
    grupo:           null,
    controlador:     'Cooperativa de consumidores',
    estado:          'RS',
    codigo_aneel:    '37',
    tensoes_padrao_bt_v: [127, 220, 380],
    aliases: [
      { termo: 'hidropan',                                             nivel: 1, confianca: 0.65 },
      { termo: 'cooperativa noroeste rs',                              nivel: 2, confianca: 0.80 },
    ],
    padroes_campos: {
      numero_parecer: ['pac-rs-hidropan', 'hidropan-'], potencia_aprovada_kw: ['potencia aprovada'],
      tensao_conexao: ['tensao de atendimento'], disjuntor_geral_a: ['disjuntor geral'],
    },
    readiness: { unifilar: false, memorial: true, art: false, ocr: true, embeddings: false },
    tokens_semanticos: ['hidropan', 'rs', 'rio_grande_do_sul', 'cooperativa', 'noroeste_rs', 'sul'],
  },

])
