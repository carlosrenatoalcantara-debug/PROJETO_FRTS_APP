/**
 * HOMOLOGACAO DTO
 *
 * Immutable frozen data transfer object for homologation packages.
 * Once frozen, engineering truth cannot be mutated at runtime.
 */

import { deepFreezeSafe } from '../utils/freeze.js'
import { StructuredEngineError, ErrorSeverity, ErrorCategory } from '../utils/errors.js'

/**
 * Validate homologacao data structure
 */
export function validateHomologacaoDTO(cliente, unidade, consumo, projeto) {
  if (!cliente || !unidade || !consumo || !projeto) {
    throw new StructuredEngineError({
      code: 'ERR_HOMOLOGACAO_DATA_INCOMPLETE',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: 'Homologação data incomplete: cliente, unidade, consumo, projeto required',
      context: { hasCliente: !!cliente, hasUnidade: !!unidade, hasConsumo: !!consumo, hasProjeto: !!projeto }
    })
  }

  // Validate critical fields
  const criticalClientFields = ['nome_cliente', 'cpf_cnpj_parcial', 'endereco', 'cidade', 'estado']
  for (const field of criticalClientFields) {
    if (!cliente[field]) {
      throw new StructuredEngineError({
        code: 'ERR_HOMOLOGACAO_CLIENTE_INCOMPLETE',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message: `Cliente field missing: ${field}`,
        context: { field, clienteData: cliente }
      })
    }
  }

  const criticalUnitFields = ['codigo_instalacao', 'classe_tarifaria', 'tipo_fornecimento', 'tensao']
  for (const field of criticalUnitFields) {
    if (!unidade[field]) {
      throw new StructuredEngineError({
        code: 'ERR_HOMOLOGACAO_UNIDADE_INCOMPLETE',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message: `Unidade field missing: ${field}`,
        context: { field, unidadeData: unidade }
      })
    }
  }

  return true
}

/**
 * Create frozen homologation DTO
 *
 * CRITICAL: This DTO becomes immutable after creation.
 * Engineering truth is locked at this point.
 */
export function createHomologacaoDTO(cliente, unidade, consumo, projeto, concessionariaProfile) {
  try {
    validateHomologacaoDTO(cliente, unidade, consumo, projeto)

    const homologacaoDTO = {
      // Identification
      projetoId: projeto._id,
      clienteId: cliente._id,
      distributorId: concessionariaProfile?.id || 'unknown',
      distributorNome: concessionariaProfile?.nome || 'Unknown Utility',

      // Client data (frozen)
      cliente: {
        nome_cliente: cliente.nome_cliente,
        cpf_cnpj_parcial: cliente.cpf_cnpj_parcial,
        endereco: cliente.endereco,
        bairro: cliente.bairro || null,
        cidade: cliente.cidade,
        estado: cliente.estado,
        cep: cliente.cep || null,
      },

      // Unit data (frozen)
      unidade: {
        codigo_cliente: unidade.codigo_cliente,
        codigo_instalacao: unidade.codigo_instalacao,
        classe_tarifaria: unidade.classe_tarifaria,
        tipo_fornecimento: unidade.tipo_fornecimento,
        tensao: unidade.tensao,
        modalidade: unidade.modalidade,
        referencia_fatura: unidade.referencia_fatura,
        leitura_atual: unidade.leitura_atual,
        leitura_anterior: unidade.leitura_anterior,
        numero_dias: unidade.numero_dias,
      },

      // Consumption profile (frozen)
      consumo: {
        consumo_medio: consumo.consumo_medio,
        consumo_12_meses: [...consumo.consumo_12_meses], // explicit copy for safety
        consumo_anual_kwh: (consumo.consumo_medio || 0) * 12,
        dados_estimados: consumo.dados_estimados,
        posicoes_array: 12,
        compensacao_energia: consumo.compensacao_energia || 0,
        tarifa: consumo.tarifa,
        perfil_consumo: consumo.perfil_consumo,
        sazonalidade: consumo.sazonalidade,
      },

      // Engineering (frozen)
      engenharia: {
        potencia_kwp: projeto.dimensionamentoV3?.potencia_kwp || 0,
        geracao_anual_kwh: projeto.dimensionamentoV3?.geracao_anual_kwh || 0,
        num_paineis: projeto.dimensionamentoV3?.num_paineis || 0,
        num_strings: projeto.dimensionamentoV3?.num_strings || 0,
        num_inversores: projeto.dimensionamentoV3?.num_inversores || 0,
        performance_ratio: projeto.dimensionamentoV3?.performance_ratio || 0,
        fator_capacidade: projeto.dimensionamentoV3?.fator_capacidade || 0,
        area_total_m2: projeto.dimensionamentoV3?.area_total_m2 || 0,
      },

      // Homologation metadata (frozen)
      homologacao: {
        status: 'rascunho', // Can be updated pre-approval
        data_geracao: new Date().toISOString(),
        versao_homologacao: '1.0',
        confianca_extracao: consumo.confianca_extracao || 100,
        campos_faltantes: [],
        avisos: [],
        erros_criticos: [],
      },

      // Immutability marker
      _frozen: true,
      _frozenAt: new Date().toISOString(),
      _frozenVersion: '3.1-homologacao-freeze',
    }

    // Deep freeze the entire DTO
    const frozenDTO = deepFreezeSafe(homologacaoDTO)

    console.log(`✓ Homologação DTO criada e congelada: ${homologacaoDTO.projetoId}`)
    return frozenDTO
  } catch (err) {
    throw new StructuredEngineError({
      code: 'ERR_HOMOLOGACAO_DTO_CREATION_FAILED',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: `Failed to create homologação DTO: ${err.message}`,
      context: { error: err.message }
    })
  }
}

/**
 * TEST: Immutability attack patterns
 *
 * Attempt to mutate frozen homologacao DTO and verify it's protected.
 * This MUST fail in strict mode.
 */
export function testHomologacaoImmutability(frozenDTO) {
  const attacks = []
  const results = {
    testsRun: 0,
    testsBlocked: 0,
    testsFailed: 0,
    attacks: [],
  }

  // Attack 1: Direct property mutation
  try {
    results.testsRun++
    frozenDTO.engenharia.potencia_kwp = 9999
    results.testsFailed++
    results.attacks.push({
      name: 'Direct property mutation (engenharia.potencia_kwp)',
      status: 'FAILED - Mutation allowed!',
      severity: 'CRITICAL',
    })
  } catch (e) {
    results.testsBlocked++
    results.attacks.push({
      name: 'Direct property mutation (engenharia.potencia_kwp)',
      status: 'BLOCKED',
      error: e.message,
    })
  }

  // Attack 2: UC code alteration
  try {
    results.testsRun++
    frozenDTO.unidade.codigo_instalacao = 'ALTERADO'
    results.testsFailed++
    results.attacks.push({
      name: 'UC code alteration',
      status: 'FAILED - Mutation allowed!',
      severity: 'CRITICAL',
    })
  } catch (e) {
    results.testsBlocked++
    results.attacks.push({
      name: 'UC code alteration',
      status: 'BLOCKED',
      error: e.message,
    })
  }

  // Attack 3: Consumption array manipulation
  try {
    results.testsRun++
    frozenDTO.consumo.consumo_12_meses[0] = 0
    results.testsFailed++
    results.attacks.push({
      name: 'Consumption array manipulation',
      status: 'FAILED - Mutation allowed!',
      severity: 'CRITICAL',
    })
  } catch (e) {
    results.testsBlocked++
    results.attacks.push({
      name: 'Consumption array manipulation',
      status: 'BLOCKED',
      error: e.message,
    })
  }

  // Attack 4: Status bypass
  try {
    results.testsRun++
    frozenDTO.homologacao.status = 'approved'
    results.testsFailed++
    results.attacks.push({
      name: 'Status bypass mutation',
      status: 'FAILED - Mutation allowed!',
      severity: 'CRITICAL',
    })
  } catch (e) {
    results.testsBlocked++
    results.attacks.push({
      name: 'Status bypass mutation',
      status: 'BLOCKED',
      error: e.message,
    })
  }

  // Attack 5: Object.assign bypass
  try {
    results.testsRun++
    Object.assign(frozenDTO.cliente, { nome_cliente: 'HACKED' })
    if (frozenDTO.cliente.nome_cliente === 'HACKED') {
      results.testsFailed++
      results.attacks.push({
        name: 'Object.assign bypass',
        status: 'FAILED - Mutation allowed!',
        severity: 'CRITICAL',
      })
    } else {
      results.testsBlocked++
      results.attacks.push({
        name: 'Object.assign bypass',
        status: 'BLOCKED',
      })
    }
  } catch (e) {
    results.testsBlocked++
    results.attacks.push({
      name: 'Object.assign bypass',
      status: 'BLOCKED',
      error: e.message,
    })
  }

  // Attack 6: Add new property attempt
  try {
    results.testsRun++
    frozenDTO.novosCampos = { hack: 'data' }
    if (frozenDTO.novosCampos !== undefined) {
      results.testsFailed++
      results.attacks.push({
        name: 'Add new property',
        status: 'FAILED - New property added!',
        severity: 'CRITICAL',
      })
    } else {
      results.testsBlocked++
      results.attacks.push({
        name: 'Add new property',
        status: 'BLOCKED',
      })
    }
  } catch (e) {
    results.testsBlocked++
    results.attacks.push({
      name: 'Add new property',
      status: 'BLOCKED',
      error: e.message,
    })
  }

  // Verification: Data integrity check
  results.dataIntegrityCheck = {
    potencia_kwp_correct: frozenDTO.engenharia.potencia_kwp === 1.08,
    uc_code_intact: frozenDTO.unidade.codigo_instalacao === '987654321099',
    consumption_array_intact: frozenDTO.consumo.consumo_12_meses.length === 12 && frozenDTO.consumo.consumo_12_meses[0] === 120,
  }

  return results
}
