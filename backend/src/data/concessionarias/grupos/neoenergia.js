/**
 * grupos/neoenergia.js — Biblioteca Nacional de Concessionárias
 * Grupo Neoenergia (controlador: Iberdrola Brasil)
 *
 * Distribuidoras: COSERN, COELBA, ELEKTRO, NEOENERGIA BRASÍLIA, NEOENERGIA PERNAMBUCO
 *
 * Campos por distribuidora:
 *   aliases[]             — termos de matching com nivel/confiança
 *   padroes_campos{}      — labels que precedem cada campo ("Tensão de Atendimento" → tensao_conexao)
 *   nomenclaturas_regionais{} — como a concessionária nomeia seus campos nos documentos impressos
 *   padroes_documentais{} — regex de extração de valores (regex_parecer, formato_contrato)
 *   readiness{}           — flags de funcionalidade habilitada
 *   tokens_semanticos[]   — tokens para embeddings futuros
 */

export const GRUPO_NEOENERGIA = Object.freeze({
  id:          'neoenergia',
  nome_grupo:  'Neoenergia',
  controlador: 'Iberdrola Brasil',

  distribuidoras: Object.freeze([

    // ── COSERN ─────────────────────────────────────────────────────────────────
    {
      id:              'COSERN',
      nome_canonical:  'COSERN',
      nome_completo:   'Companhia Energética do Rio Grande do Norte',
      grupo:           'neoenergia',
      estado:          'RN',
      codigo_aneel:    '50',
      tensoes_padrao_bt_v: [127, 220, 380],

      // ── Aliases de matching (nivel define especificidade → confiança)
      // nivel 1: abreviação canônica         → confianca 0.70
      // nivel 2: grupo + distribuidora       → confianca 0.90
      // nivel 3: nome completo/formal        → confianca 1.00
      aliases: [
        { termo: 'cosern',                                              nivel: 1, confianca: 0.70 },
        { termo: 'c.o.s.e.r.n.',                                        nivel: 1, confianca: 0.70 },  // OCR pontilhado
        { termo: 'neoenergia cosern',                                   nivel: 2, confianca: 0.90 },
        { termo: 'neoenergia-cosern',                                   nivel: 2, confianca: 0.90 },
        { termo: 'companhia energetica do rio grande do norte',         nivel: 3, confianca: 1.00 },
        { termo: 'companhia energética do rio grande do norte',         nivel: 3, confianca: 1.00 },
      ],

      // ── Padrões de campos: labels que precedem cada valor no documento
      padroes_campos: {
        numero_parecer:        ['cnc-', 'cosern-', 'parecer cosern', 'pac/rn', 'número do parecer'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao', 'potencia de conexao'],
        tensao_conexao:        ['tensao de atendimento', 'tensao de conexao', 'tensao nominal'],
        disjuntor_geral_a:     ['disjuntor geral', 'protecao geral', 'disj. geral'],
      },

      // ── Como a COSERN nomeia seus campos nos documentos impressos/digitais
      nomenclaturas_regionais: {
        codigo_cliente:  'Conta Contrato',
        numero_parecer:  'Número do Parecer',
      },

      // ── Regex de extração de valores (usados pelo parecerNormalizerService)
      padroes_documentais: {
        // Formato da UC/conta contrato: 10 dígitos numéricos
        formato_contrato: /^\d{10}$/,
        // Extrai o número do parecer: "Parecer Nº 2024.0012.000123" ou "PR 2024.0012.123"
        regex_parecer:    /(?:Parecer|Documento|PR)\s*N?[º°]?\s*(\d{4}\.\d{4}\.\d{3,6})/i,
      },

      // ── Readiness por funcionalidade
      readiness: {
        unifilar:   true,
        memorial:   true,
        art:        false,
        ocr:        true,
        embeddings: true,
      },

      // ── Tokens semânticos para embeddings futuros
      tokens_semanticos: ['cosern', 'neoenergia', 'rn', 'nordeste', 'distribuicao'],
    },

    // ── COELBA ─────────────────────────────────────────────────────────────────
    {
      id:              'COELBA',
      nome_canonical:  'COELBA',
      nome_completo:   'Companhia de Eletricidade do Estado da Bahia',
      grupo:           'neoenergia',
      estado:          'BA',
      codigo_aneel:    '12',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'coelba',                                              nivel: 1, confianca: 0.70 },
        { termo: 'neoenergia coelba',                                   nivel: 2, confianca: 0.90 },
        { termo: 'neoenergia-coelba',                                   nivel: 2, confianca: 0.90 },
        { termo: 'neoenergia bahia',                                    nivel: 2, confianca: 0.85 },
        { termo: 'companhia de eletricidade do estado da bahia',        nivel: 3, confianca: 1.00 },
        { termo: 'companhia de eletricidade da bahia',                  nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['cnc-', 'coelba-', 'pac/ba', 'parecer coelba', 'número da solicitação'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'tensao de conexao'],
        disjuntor_geral_a:     ['disjuntor geral', 'protecao geral'],
      },

      nomenclaturas_regionais: {
        codigo_cliente: 'Conta Contrato',
        numero_parecer: 'Número da Solicitação',
      },

      padroes_documentais: {
        formato_contrato: /^\d{10}$/,
        // Extrai número da solicitação: "Nº Solicitação 1234567890"
        regex_parecer:    /(?:Parecer|N[oº°]\s*Solicita[cç][aã]o)\s*(\d{10})/i,
      },

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['coelba', 'neoenergia', 'ba', 'bahia', 'nordeste'],
    },

    // ── ELEKTRO ────────────────────────────────────────────────────────────────
    {
      id:              'ELEKTRO',
      nome_canonical:  'ELEKTRO',
      nome_completo:   'Elektro Redes S.A.',
      grupo:           'neoenergia',
      estado:          'SP',   // + MS (interior SP e MS)
      codigo_aneel:    '40',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'elektro',                                             nivel: 1, confianca: 0.70 },
        { termo: 'neoenergia elektro',                                  nivel: 2, confianca: 0.90 },
        { termo: 'elektro redes',                                       nivel: 2, confianca: 0.85 },
        { termo: 'elektro eletricidade',                                nivel: 2, confianca: 0.85 },
        { termo: 'elektro redes s.a.',                                  nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-', 'elektro-', 'parecer elektro'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia instalada'],
        tensao_conexao:        ['tensao de atendimento', 'nivel de tensao'],
        disjuntor_geral_a:     ['disjuntor geral', 'disjuntor de protecao'],
      },

      nomenclaturas_regionais: null,   // TODO: mapear nomenclaturas da Elektro
      padroes_documentais:     null,   // TODO: levantar regex_parecer da Elektro

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['elektro', 'neoenergia', 'sp', 'ms', 'interior_sp'],
    },

    // ── NEOENERGIA BRASÍLIA ────────────────────────────────────────────────────
    {
      id:              'NEOENERGIA_BRASILIA',
      nome_canonical:  'Neoenergia Brasília',
      nome_completo:   'Neoenergia Brasília S.A.',
      grupo:           'neoenergia',
      estado:          'DF',
      codigo_aneel:    '60',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'neoenergia brasilia',                                 nivel: 1, confianca: 0.75 },
        { termo: 'neoenergia brasília',                                 nivel: 1, confianca: 0.75 },
        { termo: 'ceb',                                                 nivel: 1, confianca: 0.65 },
        { termo: 'ceb distribuicao',                                    nivel: 2, confianca: 0.85 },
        { termo: 'neoenergia brasilia s.a.',                            nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-df', 'neo-df', 'parecer neoenergia'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'tensao de conexao'],
        disjuntor_geral_a:     ['disjuntor geral'],
      },

      nomenclaturas_regionais: null,   // TODO: mapear nomenclaturas da Neoenergia Brasília
      padroes_documentais:     null,

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['neoenergia', 'brasilia', 'df', 'ceb', 'centro_oeste'],
    },

    // ── NEOENERGIA PERNAMBUCO ─────────────────────────────────────────────────
    {
      id:              'NEOENERGIA_PERNAMBUCO',
      nome_canonical:  'Neoenergia Pernambuco',
      nome_completo:   'Neoenergia Pernambuco S.A.',
      grupo:           'neoenergia',
      estado:          'PE',
      codigo_aneel:    '30',
      tensoes_padrao_bt_v: [127, 220, 380],

      aliases: [
        { termo: 'neoenergia pernambuco',                               nivel: 1, confianca: 0.75 },
        { termo: 'celpe',                                               nivel: 1, confianca: 0.70 },
        { termo: 'neoenergia-pe',                                       nivel: 2, confianca: 0.85 },
        { termo: 'companhia energetica de pernambuco',                  nivel: 3, confianca: 1.00 },
      ],

      padroes_campos: {
        numero_parecer:        ['pac-pe', 'celpe-', 'parecer neoenergia pe'],
        potencia_aprovada_kw:  ['potencia aprovada', 'potencia da geracao'],
        tensao_conexao:        ['tensao de atendimento', 'tensao nominal'],
        disjuntor_geral_a:     ['disjuntor geral', 'protecao geral'],
      },

      nomenclaturas_regionais: null,   // TODO: mapear nomenclaturas da Neoenergia Pernambuco
      padroes_documentais:     null,

      readiness: { unifilar: true, memorial: true, art: false, ocr: true, embeddings: true },
      tokens_semanticos: ['neoenergia', 'pernambuco', 'pe', 'celpe', 'nordeste'],
    },

  ]),
})
