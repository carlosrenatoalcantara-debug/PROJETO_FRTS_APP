// backend/src/importadores/billParserDTO.js

import { deepFreezeSafe } from '../utils/freeze.js'
import { StructuredEngineError, ErrorSeverity, ErrorCategory } from '../utils/errors.js'

/**
 * Extração e validação de dados de cliente da fatura de energia.
 * Retorna objeto imutável com dados do titular/cliente.
 */
export function validateClientDTO(billData, context = {}) {
  if (!billData || typeof billData !== 'object') {
    throw new StructuredEngineError({
      code: 'ERR_BILL_CLIENT_INVALID',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: 'Dados de cliente ausentes ou inválidos',
      context
    })
  }

  const clientData = {
    nome_cliente: typeof billData.nome_cliente === 'string'
      ? billData.nome_cliente.trim()
      : null,
    cpf_cnpj_parcial: typeof billData.cpf_cnpj_parcial === 'string'
      ? billData.cpf_cnpj_parcial.trim()
      : null,
    endereco: typeof billData.endereco === 'string'
      ? billData.endereco.trim()
      : null,
    bairro: typeof billData.bairro === 'string'
      ? billData.bairro.trim()
      : null,
    cidade: typeof billData.cidade === 'string'
      ? billData.cidade.trim()
      : null,
    estado: typeof billData.estado === 'string'
      ? billData.estado.trim().toUpperCase()
      : null,
    cep: typeof billData.cep === 'string'
      ? billData.cep.trim().replace(/[^\d-]/g, '')
      : null,
    distribuidora: typeof billData.distribuidora === 'string'
      ? billData.distribuidora.trim().toLowerCase()
      : null
  }

  return deepFreezeSafe({
    valido: true,
    data: clientData,
    ...clientData
  })
}

/**
 * Extração e validação de dados de unidade consumidora.
 * Retorna objeto imutável com informações técnicas da UC.
 */
export function validateUnitDTO(billData, context = {}) {
  if (!billData || typeof billData !== 'object') {
    throw new StructuredEngineError({
      code: 'ERR_BILL_UNIT_INVALID',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: 'Dados de unidade consumidora ausentes ou inválidos',
      context
    })
  }

  const unitData = {
    codigo_cliente: typeof billData.codigo_cliente === 'string'
      ? billData.codigo_cliente.trim()
      : null,
    codigo_instalacao: typeof billData.codigo_instalacao === 'string'
      ? billData.codigo_instalacao.trim()
      : null,
    classe_tarifaria: typeof billData.classe_tarifaria === 'string'
      ? billData.classe_tarifaria.trim()
      : null,
    tipo_fornecimento: typeof billData.tipo_fornecimento === 'string'
      ? billData.tipo_fornecimento.trim()
      : null,
    tensao: Number.isFinite(billData.tensao)
      ? billData.tensao
      : null,
    historico_consumo: Array.isArray(billData.historico_consumo)
      ? billData.historico_consumo.map(h => ({
          mes: typeof h.mes === 'number' ? h.mes : null,
          ano: typeof h.ano === 'number' ? h.ano : null,
          consumo_kwh: Number.isFinite(h.consumo_kwh) ? h.consumo_kwh : null,
          dias_leitura: Number.isFinite(h.dias_leitura) ? h.dias_leitura : null
        }))
      : [],
    media_consumo: Number.isFinite(billData.media_consumo)
      ? billData.media_consumo
      : null,
    modalidade: typeof billData.modalidade === 'string'
      ? billData.modalidade.trim()
      : null,
    leitura_atual: Number.isFinite(billData.leitura_atual)
      ? billData.leitura_atual
      : null,
    leitura_anterior: Number.isFinite(billData.leitura_anterior)
      ? billData.leitura_anterior
      : null,
    numero_dias: Number.isFinite(billData.numero_dias)
      ? billData.numero_dias
      : null,
    referencia_fatura: typeof billData.referencia_fatura === 'string'
      ? billData.referencia_fatura.trim()
      : null
  }

  return deepFreezeSafe({
    valido: true,
    data: unitData,
    ...unitData
  })
}

/**
 * Extração e validação de perfil de consumo mensal.
 * Retorna objeto imutável com histórico e estatísticas de consumo.
 *
 * CRITICAL RULE:
 * - consumo_12_meses ALWAYS has exactly 12 elements
 * - Missing months MUST be imputed using available month average
 * - This prevents dynamic array sizing failures and regression instability
 * - dados_estimados flag tracks whether imputation was used
 */
export function validateConsumptionProfileDTO(billData, context = {}) {
  if (!billData || typeof billData !== 'object') {
    throw new StructuredEngineError({
      code: 'ERR_BILL_CONSUMPTION_INVALID',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: 'Dados de consumo ausentes ou inválidos',
      context
    })
  }

  // CRITICAL: Ensure exactly 12 positions
  let consumo12Meses = Array.isArray(billData.consumo_12_meses)
    ? billData.consumo_12_meses
    : []

  // Validate we have exactly 12 elements
  if (consumo12Meses.length !== 12) {
    throw new StructuredEngineError({
      code: 'ERR_CONSUMPTION_ARRAY_SIZE_INVALID',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: `Consumption array must have exactly 12 elements, got ${consumo12Meses.length}`,
      context: { ...context, arrayLength: consumo12Meses.length }
    })
  }

  // Ensure all elements are valid numbers
  consumo12Meses = consumo12Meses.map(c =>
    Number.isFinite(c) ? c : 0
  )

  const consumoMedio = consumo12Meses.reduce((a, b) => a + b, 0) / 12

  const consumptionData = {
    consumo_medio: Math.round(consumoMedio * 100) / 100,
    consumo_12_meses: consumo12Meses, // ALWAYS 12 elements
    compensacao_energia: Number.isFinite(billData.compensacao_energia)
      ? billData.compensacao_energia
      : 0,
    tarifa: Number.isFinite(billData.tarifa)
      ? billData.tarifa
      : null,
    perfil_consumo: classifyConsumptionProfile(consumoMedio),
    sazonalidade: calculateSeasonality(consumo12Meses),
    confianca_extracao: Number.isFinite(billData.confianca_extracao)
      ? Math.min(100, Math.max(0, billData.confianca_extracao))
      : 100,
    dados_estimados: billData.dados_estimados === true, // Flag indicating imputation
    posicoes_array: 12 // Document the 12-position requirement
  }

  return deepFreezeSafe({
    valido: true,
    data: consumptionData,
    ...consumptionData
  })
}

/**
 * Classifica o perfil de consumo baseado na média mensal
 */
function classifyConsumptionProfile(consumoMedio) {
  if (consumoMedio < 100) return 'RESIDENCIAL_BAIXO'
  if (consumoMedio < 300) return 'RESIDENCIAL_MEDIO'
  if (consumoMedio < 1000) return 'RESIDENCIAL_ALTO'
  if (consumoMedio < 3000) return 'COMERCIAL_PEQUENO'
  if (consumoMedio < 10000) return 'COMERCIAL_MEDIO'
  return 'COMERCIAL_GRANDE'
}

/**
 * Calcula sazonalidade do consumo
 */
function calculateSeasonality(consumo12Meses) {
  if (consumo12Meses.length < 3) {
    return { desvio_padrao: 0, coeficiente_variacao: 0, sazonalidade: 'BAIXA' }
  }

  const media = consumo12Meses.reduce((a, b) => a + b, 0) / consumo12Meses.length
  const desvios = consumo12Meses.map(c => Math.pow(c - media, 2))
  const variancia = desvios.reduce((a, b) => a + b, 0) / consumo12Meses.length
  const desvio_padrao = Math.sqrt(variancia)
  const coeficiente_variacao = media > 0 ? desvio_padrao / media : 0

  let sazonalidade = 'BAIXA'
  if (coeficiente_variacao > 0.3) sazonalidade = 'ALTA'
  else if (coeficiente_variacao > 0.15) sazonalidade = 'MEDIA'

  return {
    desvio_padrao: Math.round(desvio_padrao * 100) / 100,
    coeficiente_variacao: Math.round(coeficiente_variacao * 100) / 100,
    sazonalidade
  }
}

/**
 * Validação e normalização completa de dados extraídos de fatura
 * Retorna objeto congelado com três seções: cliente, unidade, consumo
 */
export function validateBillExtractedData(extractedData, context = {}) {
  if (!extractedData || typeof extractedData !== 'object') {
    throw new StructuredEngineError({
      code: 'ERR_BILL_EXTRACTION_INVALID',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: 'Dados extraídos de fatura ausentes ou inválidos',
      context
    })
  }

  // Valida cada seção
  const cliente = validateClientDTO(extractedData.cliente || {}, context)
  const unidade = validateUnitDTO(extractedData.unidade || {}, context)
  const consumo = validateConsumptionProfileDTO(extractedData.consumo || {}, context)

  // Verificações de coerência
  if (!cliente.codigo_cliente && !unidade.codigo_cliente) {
    throw new StructuredEngineError({
      code: 'ERR_BILL_CLIENT_CODE_MISSING',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: 'Código do cliente não encontrado na fatura',
      context
    })
  }

  if (!unidade.codigo_instalacao) {
    throw new StructuredEngineError({
      code: 'ERR_BILL_UC_CODE_MISSING',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: 'Código de instalação (UC) não encontrado na fatura',
      context
    })
  }

  const billData = {
    cliente: cliente.data,
    unidade: unidade.data,
    consumo: consumo.data,
    extracao_completa: !!(
      cliente.data.nome_cliente &&
      unidade.data.codigo_instalacao &&
      consumo.data.consumo_medio > 0
    ),
    data_extracao: new Date().toISOString(),
    versao_extracao: '1.0'
  }

  return deepFreezeSafe({
    valido: true,
    data: billData,
    ...billData
  })
}
