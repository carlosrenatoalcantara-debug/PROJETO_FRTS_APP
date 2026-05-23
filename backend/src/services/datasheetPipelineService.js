/**
 * datasheetPipelineService.js — S2.15-B.3A
 *
 * Validação estrita de parâmetros de placa após o EquipamentoMatcherService.
 * Rota pelo status do match e verifica completude dos campos elétricos críticos
 * usando os nomes de campo reais do catálogo (não aliases genéricos).
 *
 * Versão: 2.15.3-A
 *
 * Correções aplicadas sobre o rascunho original:
 *   [FIX-3] Paths de import() resolvidos via import.meta.url (não CWD).
 *   [FIX-4] Guard para eqReal === undefined — evita TypeError ao acessar .voc/.isc.
 *   [FIX-5] camposCriticos e proxyCampos unificados eram incompatíveis com o catálogo:
 *           • Painéis: usam voc/isc/vmpp/impp/tempCoefVoc/tempCoefPmpp (não mppt_min/temp_noct)
 *           • Inversores: usam vocMax/mpptMin/mpptMax/imaxMppt/nMppts (não voc/isc)
 *           Separados por tipo e mapeados para os nomes reais do catálogo.
 *   [FIX-6] Eliminado segundo carregamento do catálogo: usa dados_catalogados do matchResult
 *           (injetado pelo EquipamentoMatcherService v2.15.3-A).
 */

// ─── Campos críticos por tipo de equipamento ──────────────────────────────────
//
// Mapeamento canônico → campo real no catálogo.
// "canônico" é o nome usado no output deste serviço (campos_faltantes[]).
// "real" é o nome do campo no objeto do catálogo.

const CAMPOS_CRITICOS_PAINEL = Object.freeze([
  // Parâmetros elétricos STC obrigatórios para cálculo de arranjo e compatibilidade
  { canonico: 'voc',          real: 'voc',          descricao: 'Tensão de circuito aberto (V)'                 },
  { canonico: 'isc',          real: 'isc',          descricao: 'Corrente de curto-circuito (A)'                },
  { canonico: 'vmpp',         real: 'vmpp',         descricao: 'Tensão no ponto de máxima potência (V)'        },
  { canonico: 'impp',         real: 'impp',         descricao: 'Corrente no ponto de máxima potência (A)'      },
  { canonico: 'tempCoefVoc',  real: 'tempCoefVoc',  descricao: 'Coeficiente de temperatura de Voc (%/°C)'      },
  { canonico: 'tempCoefPmpp', real: 'tempCoefPmpp', descricao: 'Coeficiente de temperatura de Pmpp (%/°C)'     },
  { canonico: 'pmpp',         real: 'pmpp',         descricao: 'Potência máxima STC (Wp)'                      },
])

const CAMPOS_CRITICOS_INVERSOR = Object.freeze([
  // Parâmetros elétricos obrigatórios para checagem de compatibilidade DC/AC
  { canonico: 'vocMax',   real: 'vocMax',   descricao: 'Tensão máxima de entrada DC (V)'             },
  { canonico: 'mpptMin',  real: 'mpptMin',  descricao: 'Tensão mínima da janela MPPT (V)'            },
  { canonico: 'mpptMax',  real: 'mpptMax',  descricao: 'Tensão máxima da janela MPPT (V)'            },
  { canonico: 'imaxMppt', real: 'imaxMppt', descricao: 'Corrente máxima de entrada por MPPT (A)'     },
  { canonico: 'nMppts',   real: 'nMppts',   descricao: 'Número de rastreadores MPPT'                 },
  { canonico: 'potenciaKW', real: 'potenciaKW', descricao: 'Potência nominal AC (kW)'                },
  { canonico: 'faseAC',   real: 'faseAC',   descricao: 'Número de fases AC (1 ou 3)'                 },
])

// ─── Mensagens de segurança elétrica ─────────────────────────────────────────

const SEGURANCA = Object.freeze({
  OK:              'CHECK_OK',
  FALTA_EQ:        'FALHA_CONECTOR_FALTA_EQUIPAMENTO',
  RETIDO:          'RETIDO_REVISAO_HUMANA_OBRIGATORIA',
  FALTA_DADOS:     'REJEITADO_FALTA_DADOS_CRITICOS',
  EQ_NAO_MAPEADO:  'EQUIPAMENTO_ID_NAO_MAPEADO_NO_CATALOGO',
})

// ─── Classe principal ─────────────────────────────────────────────────────────

export class DatasheetPipelineService {

  /**
   * Processa o resultado do EquipamentoMatcherService e valida completude dos dados.
   *
   * @param {object} matchResult — resultado de EquipamentoMatcherService.matchEquipamento()
   * @returns {object} — resultado do pipeline com campos_faltantes[] e auditoria
   */
  async processarPipeline(matchResult) {
    const {
      status,
      tipo_equipamento,
      equipamento_id,
      fabricante_normalizado,
      modelo_normalizado,
      score_match,
      nivel_confianca,
      metodo_match,
      camadas_avaliadas,
      versao_matcher,
      auditado_em,
      ambiguidades   = [],
      dados_catalogados,   // injetado pelo EquipamentoMatcherService v2.15.3-A
    } = matchResult

    const pacoteAuditoria = {
      versao_matcher,
      auditado_em,
      metodo_match,
      nivel_confianca,
      camadas_avaliadas,
      seguranca_eletrica: SEGURANCA.OK,
    }

    // ── Rota 1: não encontrado → solicitar datasheet ──────────────────────────
    if (status === 'datasheet_necessario') {
      pacoteAuditoria.seguranca_eletrica = SEGURANCA.FALTA_EQ
      return _resposta({
        status,
        equipamento_detectado: null,
        requer_upload_datasheet: true,
        motivo: 'Equipamento não mapeado na base Forte Solar. Envie o datasheet para cadastro.',
        campos_faltantes: [],
        sugestoes_match: [],
        auditoria: pacoteAuditoria,
      })
    }

    // ── Rota 2: ambíguo → bloqueio com sugestões ──────────────────────────────
    if (status === 'equipamento_ambiguo') {
      pacoteAuditoria.seguranca_eletrica = SEGURANCA.RETIDO
      return _resposta({
        status,
        equipamento_detectado: null,
        requer_upload_datasheet: true,
        motivo: 'Bloqueio por ambiguidade técnica de catálogo. Revisão humana obrigatória.',
        campos_faltantes: [],
        sugestoes_match: ambiguidades,
        auditoria: pacoteAuditoria,
      })
    }

    // ── Rota 3: encontrado → verificar completude dos campos críticos ─────────

    // [FIX-4] Guard: dados_catalogados pode ser null se o matcher tiver bug ou
    // equipamento_id for inválido. Evita TypeError nas linhas seguintes.
    const eqReal = dados_catalogados ?? null

    if (!eqReal) {
      pacoteAuditoria.seguranca_eletrica = SEGURANCA.EQ_NAO_MAPEADO
      return _resposta({
        status: 'datasheet_necessario',
        equipamento_detectado: { id: equipamento_id, fabricante: fabricante_normalizado, modelo: modelo_normalizado, score_match },
        requer_upload_datasheet: true,
        motivo: `Equipamento ID "${equipamento_id}" não encontrado nos dados_catalogados. Verifique a versão do matcher.`,
        campos_faltantes: [],
        sugestoes_match: [],
        auditoria: pacoteAuditoria,
      })
    }

    // [FIX-5] Seleciona os campos críticos pelo tipo de equipamento
    const listaCriticos = _camposCriticosPorTipo(tipo_equipamento)
    const camposFaltantes = _verificarCampos(eqReal, listaCriticos)

    if (camposFaltantes.length > 0) {
      pacoteAuditoria.seguranca_eletrica = SEGURANCA.FALTA_DADOS
      return _resposta({
        status,
        equipamento_detectado: _resumoEquipamento(matchResult),
        requer_upload_datasheet: true,
        motivo: `Equipamento localizado, mas possui ${camposFaltantes.length} campo(s) elétrico(s) ausente(s) no catálogo.`,
        campos_faltantes: camposFaltantes,
        sugestoes_match: [],
        auditoria: pacoteAuditoria,
      })
    }

    // ── Aprovado ──────────────────────────────────────────────────────────────
    return _resposta({
      status,
      equipamento_detectado: _resumoEquipamento(matchResult),
      requer_upload_datasheet: false,
      motivo: 'Equipamento validado. Todos os campos elétricos críticos confirmados.',
      campos_faltantes: [],
      sugestoes_match: [],
      auditoria: pacoteAuditoria,
    })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Retorna a lista de campos críticos para o tipo de equipamento.
 * [FIX-5] Painéis e inversores têm parâmetros elétricos distintos.
 */
function _camposCriticosPorTipo(tipo) {
  if (tipo === 'painel')   return CAMPOS_CRITICOS_PAINEL
  if (tipo === 'inversor') return CAMPOS_CRITICOS_INVERSOR
  // Tipo desconhecido: retorna união (mais restritivo — força revisão)
  return [...CAMPOS_CRITICOS_PAINEL, ...CAMPOS_CRITICOS_INVERSOR]
}

/**
 * Verifica quais campos críticos estão ausentes no objeto do catálogo.
 * Retorna array de { canonico, descricao } para os campos faltantes.
 */
function _verificarCampos(eqReal, listaCriticos) {
  return listaCriticos
    .filter(({ real }) => eqReal[real] === undefined || eqReal[real] === null)
    .map(({ canonico, descricao }) => ({ campo: canonico, descricao }))
}

/**
 * Monta o objeto `equipamento_detectado` padronizado.
 */
function _resumoEquipamento(matchResult) {
  return {
    id:               matchResult.equipamento_id,
    fabricante:       matchResult.fabricante_normalizado,
    modelo:           matchResult.modelo_normalizado,
    tipo_equipamento: matchResult.tipo_equipamento,
    potencia_w:       matchResult.potencia_w,
    score_match:      matchResult.score_match,
  }
}

/**
 * Estrutura final da resposta do pipeline.
 */
function _resposta({ status, equipamento_detectado, requer_upload_datasheet, motivo, campos_faltantes, sugestoes_match, auditoria }) {
  return {
    status,
    equipamento_detectado,
    requer_upload_datasheet,
    motivo,
    campos_faltantes,   // [{ campo: string, descricao: string }]
    sugestoes_match,    // [] ou ambiguidades[] do matcher
    auditoria,
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export default new DatasheetPipelineService()
