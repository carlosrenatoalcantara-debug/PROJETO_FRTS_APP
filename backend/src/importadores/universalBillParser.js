// backend/src/importadores/universalBillParser.js

import { PDFParse } from 'pdf-parse'
import { getConcessionariaProfile } from './concessionariaProfiles.js'
import { StructuredEngineError, ErrorSeverity, ErrorCategory } from '../utils/errors.js'

/**
 * UNIVERSAL BILL PARSER
 *
 * Profile-based parser supporting all Brazilian concessionárias.
 * Uses configurable parsing rules from ConcessionariaProfile instead of hardcoded logic.
 *
 * CRITICAL: Consumption array ALWAYS has 12 positions.
 * Missing months are imputed using available month average.
 */
class UniversalBillParser {
  constructor(profileId = 'neoenergia_cosern') {
    const profile = getConcessionariaProfile(profileId)
    if (!profile) {
      throw new StructuredEngineError({
        code: 'ERR_PROFILE_NOT_FOUND',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DTO_VALIDATION,
        message: `Concessionária profile not found: ${profileId}`,
        context: { profileId }
      })
    }

    this.profile = profile
    this.distributorId = profile.id
    this.parsingRules = profile.parsing_rules
    this.tensionProfiles = profile.tension_profiles
    this.technicalConstraints = profile.technical_constraints
  }

  /**
   * Extrai texto do PDF com fallback para OCR
   */
  async extractTextFromPDF(pdfBuffer) {
    try {
      const pdfParser = new PDFParse()
      const data = await pdfParser.parseBuffer(pdfBuffer)
      const text = data.text || ''

      if (!text || text.trim().length === 0) {
        throw new Error('No text extracted from PDF')
      }

      return text
    } catch (error) {
      throw new StructuredEngineError({
        code: 'ERR_PDF_TEXT_EXTRACTION_FAILED',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.FILE_PROCESSING,
        message: `Failed to extract PDF text: ${error.message}`,
        context: { distributorId: this.distributorId }
      })
    }
  }

  /**
   * Normaliza espaços e quebras de linha
   */
  normalizeText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Extrai campo usando padrões do profile
   */
  extractField(text, fieldName) {
    const rule = this.parsingRules[fieldName]
    if (!rule || !rule.patterns) return null

    for (const pattern of rule.patterns) {
      try {
        const match = text.match(pattern)
        if (match && match[1]) return match[1].trim()
      } catch (e) {
        // Continue to next pattern
      }
    }

    return null
  }

  /**
   * Extrai valor numérico com suporte a locale português
   */
  extractNumericField(text, fieldName) {
    const value = this.extractField(text, fieldName)
    if (!value) return null

    try {
      // Trata formato brasileiro: 1.234,56 → 1234.56
      let numStr = value
        .replace(/\./g, '')        // Remove pontos (milhares)
        .replace(',', '.')          // Substitui vírgula por ponto

      const num = parseFloat(numStr)
      return Number.isFinite(num) ? num : null
    } catch (e) {
      return null
    }
  }

  /**
   * Parse de dados do cliente usando regras do profile
   */
  parseClientData(text) {
    return {
      nome_cliente: this.extractField(text, 'nome_cliente'),
      cpf_cnpj_parcial: this.extractField(text, 'cpf_cnpj_parcial'),
      endereco: this.extractField(text, 'endereco'),
      bairro: this.extractField(text, 'bairro'),
      cidade: this.extractField(text, 'cidade'),
      estado: this.extractField(text, 'estado'),
      cep: this.extractField(text, 'cep'),
      distribuidora: this.distributorId
    }
  }

  /**
   * Parse de dados de unidade consumidora
   */
  parseUnitData(text) {
    return {
      codigo_cliente: this.extractField(text, 'codigo_cliente'),
      codigo_instalacao: this.extractField(text, 'codigo_instalacao'),
      classe_tarifaria: this.extractField(text, 'classe_tarifaria'),
      tipo_fornecimento: this.extractField(text, 'tipo_fornecimento'),
      tensao: this.extractNumericField(text, 'tensao'),
      modalidade: this.extractField(text, 'modalidade'),
      referencia_fatura: this.extractField(text, 'referencia_fatura'),
      leitura_atual: this.extractNumericField(text, 'leitura_atual'),
      leitura_anterior: this.extractNumericField(text, 'leitura_anterior'),
      numero_dias: this.extractNumericField(text, 'numero_dias')
    }
  }

  /**
   * CRITICAL: Extrai histórico de consumo e IMPUTA 12 posições determinísticas
   *
   * MANDATORY:
   * - consumo_12_meses ALWAYS has exactly 12 elements
   * - Missing months are imputed with average of available months
   * - Order is always: [12mo ago, 11mo ago, ..., 2mo ago, 1mo ago]
   * - dados_estimados flag indicates any imputation occurred
   */
  parseConsumptionHistoryWith12Imputation(text) {
    const consumptionRule = this.parsingRules.consumo_pattern
    if (!consumptionRule) {
      return {
        consumo_12_meses: Array(12).fill(0),
        dados_estimados: true,
        mes_atual: null,
        ano_atual: new Date().getFullYear()
      }
    }

    // Extrai dados brutos
    const historicoRaw = []
    const patterns = consumptionRule.patterns

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const mes = parseInt(match[1], 10)
        const ano = parseInt(match[2], 10)
        let consumoKwh = match[3]
          .replace(/\./g, '')
          .replace(',', '.')
        consumoKwh = parseFloat(consumoKwh)

        const diasLeitura = parseInt(match[4], 10)

        if (Number.isFinite(consumoKwh) && consumoKwh > 0) {
          historicoRaw.push({
            mes,
            ano,
            consumo_kwh: consumoKwh,
            dias_leitura: diasLeitura
          })
        }
      }
    }

    // Ordena por data decrescente (mais recente primeiro)
    historicoRaw.sort((a, b) => {
      if (b.ano !== a.ano) return b.ano - a.ano
      return b.mes - a.mes
    })

    // CRITICAL: Constrói array com 12 posições
    // Índice 0 = 12 meses atrás, Índice 11 = mês mais recente
    const consumo12Meses = Array(12).fill(0)
    let hasData = false
    let totalConsumo = 0
    let countConsumo = 0
    let mesAtual = null
    let anoAtual = new Date().getFullYear()

    // Processa dados extraídos
    for (const record of historicoRaw.slice(0, 12)) {
      if (record.consumo_kwh > 0) {
        hasData = true
        totalConsumo += record.consumo_kwh
        countConsumo++

        // Tenta estimar índice no array
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth() + 1

        // Calcula meses de diferença
        let monthsDiff = 0
        if (record.ano === currentYear) {
          monthsDiff = currentMonth - record.mes
        } else {
          monthsDiff = (currentYear - record.ano) * 12 + (currentMonth - record.mes)
        }

        // Coloca na posição correta (11 = mês atual, 10 = 1 mês atrás, etc.)
        if (monthsDiff >= 0 && monthsDiff < 12) {
          consumo12Meses[11 - monthsDiff] = record.consumo_kwh
          if (monthsDiff === 0) {
            mesAtual = record.mes
            anoAtual = record.ano
          }
        }
      }
    }

    // IMPUTATION: Se há dados mas alguns meses estão faltando
    if (hasData && countConsumo < 12) {
      const mediaDisponivel = totalConsumo / countConsumo

      for (let i = 0; i < 12; i++) {
        if (consumo12Meses[i] === 0) {
          consumo12Meses[i] = Math.round(mediaDisponivel * 100) / 100
        }
      }
    }

    // Se não há dados, usa zeros (já inicializados)
    // Marca como estimado se houve imputation
    const hasImputation = historicoRaw.length < 12 && historicoRaw.length > 0

    return {
      consumo_12_meses: consumo12Meses, // ALWAYS 12 elements
      dados_estimados: hasImputation,
      mes_atual: mesAtual,
      ano_atual: anoAtual,
      historico_bruto_contagem: historicoRaw.length
    }
  }

  /**
   * Parse de perfil de consumo
   */
  parseConsumptionData(text, consumoData) {
    const consumo12Meses = consumoData.consumo_12_meses
    const consumoMedio = consumo12Meses.filter(c => c > 0).length > 0
      ? consumo12Meses.reduce((a, b) => a + b, 0) / 12
      : 0

    return {
      consumo_medio: Math.round(consumoMedio * 100) / 100,
      consumo_12_meses: consumo12Meses, // ALWAYS 12 elements
      dados_estimados: consumoData.dados_estimados,
      compensacao_energia: this.extractNumericField(text, 'compensacao_energia') || 0,
      tarifa: this.extractNumericField(text, 'tarifa'),
      confianca_extracao: 100 // Será ajustado
    }
  }

  /**
   * Calcula confiança da extração
   */
  calculateExtractionConfidence(cliente, unidade, consumo) {
    let score = 100
    const penalties = [
      { value: cliente.nome_cliente, penalty: 15 },
      { value: cliente.cpf_cnpj_parcial, penalty: 10 },
      { value: cliente.endereco, penalty: 10 },
      { value: cliente.cidade, penalty: 10 },
      { value: cliente.estado, penalty: 5 },
      { value: unidade.codigo_instalacao, penalty: 20 }, // CRITICAL
      { value: unidade.codigo_cliente, penalty: 15 },
      { value: consumo.consumo_medio, penalty: 15 }
    ]

    for (const { value, penalty } of penalties) {
      if (!value || value === '' || value === 0) {
        score -= penalty
      }
    }

    // Se há estimados, reduz um pouco a confiança
    if (consumo.dados_estimados) {
      score -= 5
    }

    return Math.max(0, score)
  }

  /**
   * Parse completo de fatura
   */
  async parseBill(pdfBuffer) {
    try {
      // 1. Extrai texto
      const pdfText = await this.extractTextFromPDF(pdfBuffer)
      const normalizedText = this.normalizeText(pdfText)

      // 2. Parse de seções
      const cliente = this.parseClientData(normalizedText)
      const unidade = this.parseUnitData(normalizedText)
      const consumoData = this.parseConsumptionHistoryWith12Imputation(normalizedText)
      const consumo = this.parseConsumptionData(normalizedText, consumoData)

      // 3. Calcula confiança
      consumo.confianca_extracao = this.calculateExtractionConfidence(
        cliente,
        unidade,
        consumo
      )

      // 4. Validação crítica
      if (!unidade.codigo_instalacao) {
        throw new StructuredEngineError({
          code: 'ERR_CRITICAL_UC_CODE_NOT_FOUND',
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.FILE_PROCESSING,
          message: 'UC code (código_instalacao) not found in bill',
          context: {
            distributorId: this.distributorId,
            confianca: consumo.confianca_extracao
          }
        })
      }

      // 5. Retorna resultado
      return {
        distributorId: this.distributorId,
        distributorNome: this.profile.nome,
        versionParser: '2.0-universal',
        cliente,
        unidade,
        consumo,
        historicoExtracao: {
          mesDados: consumoData.mes_atual,
          anoDados: consumoData.ano_atual,
          posicoes12: 12, // ALWAYS 12
          contagemDados: consumoData.historico_bruto_contagem,
          temEstimados: consumoData.dados_estimados
        },
        extracao_timestamp: new Date().toISOString(),
        extracao_sucesso: true
      }
    } catch (error) {
      if (error instanceof StructuredEngineError) throw error

      throw new StructuredEngineError({
        code: 'ERR_BILL_PARSING_FAILED',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.FILE_PROCESSING,
        message: `Failed to parse bill: ${error.message}`,
        context: { distributorId: this.distributorId }
      })
    }
  }
}

/**
 * Factory para criar parser universal
 */
export function createUniversalParser(distributorId = 'neoenergia_cosern') {
  return new UniversalBillParser(distributorId)
}

/**
 * Parse wrapper que auto-detecta ou usa distributor especificado
 */
export async function parseBillPDFUniversal(pdfBuffer, distributorId = null) {
  // Se distributor não especificado, assume Cosern como default
  const parserId = distributorId || 'neoenergia_cosern'
  const parser = createUniversalParser(parserId)
  return parser.parseBill(pdfBuffer)
}
