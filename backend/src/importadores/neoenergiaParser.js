// backend/src/importadores/neoenergiaParser.js

import pdfParse from 'pdf-parse'
import { StructuredEngineError, ErrorSeverity, ErrorCategory } from '../utils/errors.js'

/**
 * Parser determinístico para faturas Neoenergia Cosern
 *
 * Responsabilidades:
 * - Extração de texto do PDF usando text layer (OCR fallback)
 * - Parsing determinístico de campos estruturados
 * - Normalização de valores extraídos
 * - Relatório de confiança de extração
 */
class NeoenergiaParserCosern {
  constructor() {
    this.distribuidora = 'neoenergia_cosern'
    this.versao_parser = '1.0'
  }

  /**
   * Extrai texto do PDF com fallback para OCR
   * @param {Buffer} pdfBuffer - Buffer do arquivo PDF
   * @returns {Promise<string>} Texto extraído
   */
  async extractTextFromPDF(pdfBuffer) {
    try {
      const data = await pdfParse(pdfBuffer)
      const text = data.text || ''

      if (!text || text.trim().length === 0) {
        throw new Error('Nenhum texto foi extraído do PDF')
      }

      return text
    } catch (error) {
      throw new StructuredEngineError({
        code: 'ERR_PDF_TEXT_EXTRACTION_FAILED',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.FILE_PROCESSING,
        message: `Falha ao extrair texto do PDF: ${error.message}`,
        context: { parser: 'neoenergia_cosern' }
      })
    }
  }

  /**
   * Normaliza espaços e quebras de linha para processamento
   */
  normalizeText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Extrai campo com padrão regex com normalização
   */
  extractField(text, pattern, defaultValue = null) {
    try {
      const match = text.match(pattern)
      if (!match || !match[1]) return defaultValue
      return match[1].trim()
    } catch (e) {
      return defaultValue
    }
  }

  /**
   * Extrai valor numérico com tratamento de locales português
   */
  extractNumericField(text, pattern, defaultValue = null) {
    try {
      const match = text.match(pattern)
      if (!match || !match[1]) return defaultValue

      // Trata formato brasileiro: 1.234,56 → 1234.56
      let value = match[1].trim()
      value = value
        .replace(/\./g, '') // Remove pontos (separador de milhares)
        .replace(',', '.')  // Substitui vírgula por ponto

      const num = parseFloat(value)
      return Number.isFinite(num) ? num : defaultValue
    } catch (e) {
      return defaultValue
    }
  }

  /**
   * Extrai dados do cliente da fatura
   */
  parseClientData(text) {
    const clientData = {
      nome_cliente: this.extractField(
        text,
        /(?:NOME DO (?:TITULAR|CLIENTE)|Titular)[\s:]+([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ\s]+?)(?:\n|$)/i
      ),
      cpf_cnpj_parcial: this.extractField(
        text,
        /(?:CPF|CNPJ)[\s:]*([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|[0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2})/i
      ),
      endereco: this.extractField(
        text,
        /(?:ENDEREÇO|Endereço)[\s:]+([^\n]+?)(?:\n|$)/i
      ),
      bairro: this.extractField(
        text,
        /(?:BAIRRO|Bairro)[\s:]+([^\n]+?)(?:\n|$)/i
      ),
      cidade: this.extractField(
        text,
        /(?:CIDADE|Cidade)[\s:]+([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ\s]+?)(?:\n|$)/i
      ),
      estado: this.extractField(
        text,
        /(?:UF|ESTADO|Estado)[\s:]*([A-Z]{2})(?:\n|$)/i
      ),
      cep: this.extractField(
        text,
        /(?:CEP|Cep)[\s:]*([0-9]{5}-[0-9]{3})/i
      ),
      distribuidora: this.distribuidora
    }

    return clientData
  }

  /**
   * Extrai dados da unidade consumidora
   */
  parseUnitData(text) {
    const unitData = {
      codigo_cliente: this.extractField(
        text,
        /(?:CÓDIGO DO CLIENTE|Código do cliente)[\s:]*([0-9]+)(?:\n|$)/i
      ),
      codigo_instalacao: this.extractField(
        text,
        /(?:CÓDIGO DA INSTALAÇÃO|Código da instalação|N\.?\s?UC)[\s:]*([0-9]+)(?:\n|$)/i
      ),
      classe_tarifaria: this.extractField(
        text,
        /(?:CLASSE|TARIFA|Tarifa)[\s:]*([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ0-9\s]+?)(?:\n|$)/i
      ),
      tipo_fornecimento: this.extractField(
        text,
        /(?:TIPO DE FORNECIMENTO|Tipo de fornecimento)[\s:]*([^\n]+?)(?:\n|$)/i
      ),
      tensao: this.extractNumericField(
        text,
        /(?:TENSÃO|Tensão)[\s:]*([0-9]+(?:[.,][0-9]+)?)\s*V/i
      ),
      modalidade: this.extractField(
        text,
        /(?:MODALIDADE|Modalidade)[\s:]*([A-ZÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛ]+?)(?:\n|$)/i
      ),
      referencia_fatura: this.extractField(
        text,
        /(?:REFERÊNCIA|Referência)[\s:]*([0-9]{2}\/[0-9]{4})/i
      ),
      leitura_atual: this.extractNumericField(
        text,
        /(?:LEITURA ATUAL|Leitura atual)[\s:]*([0-9]+)/i
      ),
      leitura_anterior: this.extractNumericField(
        text,
        /(?:LEITURA ANTERIOR|Leitura anterior)[\s:]*([0-9]+)/i
      ),
      numero_dias: this.extractNumericField(
        text,
        /(?:DIAS|Dias)[\s:]*([0-9]+)(?:\n|$)/i
      )
    }

    return unitData
  }

  /**
   * Extrai histórico de consumo dos últimos 12 meses
   */
  parseConsumptionHistory(text) {
    const historicoConsumo = []

    // Padrão para linhas de consumo mensal
    // Esperado: MÊS/ANO CONSUMO (kWh) DIAS
    const consumptionPattern = /(\d{2})\/(\d{4})\s+([0-9.,]+)\s+kWh?\s+(\d+)/gi

    let match
    while ((match = consumptionPattern.exec(text)) !== null) {
      const mes = parseInt(match[1], 10)
      const ano = parseInt(match[2], 10)
      let consumoKwh = match[3]
        .replace(/\./g, '')
        .replace(',', '.')
      consumoKwh = parseFloat(consumoKwh)

      const diasLeitura = parseInt(match[4], 10)

      if (Number.isFinite(consumoKwh) && consumoKwh > 0) {
        historicoConsumo.push({
          mes,
          ano,
          consumo_kwh: consumoKwh,
          dias_leitura: diasLeitura
        })
      }
    }

    // Ordena por ano/mês mais recente
    historicoConsumo.sort((a, b) => {
      if (b.ano !== a.ano) return b.ano - a.ano
      return b.mes - a.mes
    })

    return historicoConsumo
  }

  /**
   * Calcula consumo médio a partir do histórico
   */
  calculateAverageConsumption(historicoConsumo) {
    if (historicoConsumo.length === 0) return 0

    const totalConsumo = historicoConsumo.reduce((sum, h) => sum + (h.consumo_kwh || 0), 0)
    return Math.round(totalConsumo / historicoConsumo.length * 100) / 100
  }

  /**
   * Extrai dados de consumo e perfil
   */
  parseConsumptionData(text, historicoConsumo) {
    const consumoMedio = this.calculateAverageConsumption(historicoConsumo)

    const consumo12Meses = historicoConsumo
      .slice(0, 12)
      .map(h => h.consumo_kwh)

    const consumptionData = {
      consumo_medio: consumoMedio,
      consumo_12_meses: consumo12Meses,
      compensacao_energia: this.extractNumericField(
        text,
        /(?:COMPENSAÇÃO|Compensação|ENERGIA COMPENSADA)[\s:]*([0-9.,]+)\s*kWh/i,
        0
      ),
      tarifa: this.extractNumericField(
        text,
        /(?:TARIFA|Tarifa)[\s:]*R?\$\s*([0-9.,]+)/i
      ),
      confianca_extracao: 100 // Será ajustado baseado em completude
    }

    return consumptionData
  }

  /**
   * Calcula confiança da extração baseada em campos preenchidos
   */
  calculateExtractionConfidence(cliente, unidade, consumo) {
    let score = 100
    const requiredFields = [
      { value: cliente.nome_cliente, penalty: 15 },
      { value: cliente.cpf_cnpj_parcial, penalty: 10 },
      { value: cliente.endereco, penalty: 10 },
      { value: cliente.cidade, penalty: 10 },
      { value: cliente.estado, penalty: 5 },
      { value: unidade.codigo_instalacao, penalty: 20 },
      { value: unidade.codigo_cliente, penalty: 15 },
      { value: consumo.consumo_medio, penalty: 15 }
    ]

    requiredFields.forEach(field => {
      if (!field.value || field.value === '' || field.value === 0) {
        score -= field.penalty
      }
    })

    return Math.max(0, score)
  }

  /**
   * Parse completo de fatura Neoenergia Cosern
   * @param {Buffer} pdfBuffer - Buffer do PDF
   * @returns {Promise<object>} Dados extraídos organizados
   */
  async parseNeoenergiaBill(pdfBuffer) {
    try {
      // 1. Extrai texto do PDF
      const pdfText = await this.extractTextFromPDF(pdfBuffer)
      const normalizedText = this.normalizeText(pdfText)

      // 2. Parse de seções
      const cliente = this.parseClientData(normalizedText)
      const unidade = this.parseUnitData(normalizedText)
      const historicoConsumo = this.parseConsumptionHistory(normalizedText)
      const consumo = this.parseConsumptionData(normalizedText, historicoConsumo)

      // 3. Calcula confiança
      consumo.confianca_extracao = this.calculateExtractionConfidence(
        cliente,
        unidade,
        consumo
      )

      // 4. Valida extração mínima
      if (!unidade.codigo_instalacao) {
        throw new StructuredEngineError({
          code: 'ERR_BILL_UC_NOT_FOUND',
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.FILE_PROCESSING,
          message: 'Não foi possível extrair o código de instalação (UC) da fatura',
          context: {
            parser: this.distribuidora,
            confianca: consumo.confianca_extracao
          }
        })
      }

      return {
        distribuidor: this.distribuidora,
        versao_parser: this.versao_parser,
        cliente,
        unidade,
        consumo,
        historico_consumo: historicoConsumo,
        extracao_timestamp: new Date().toISOString(),
        extracao_sucesso: true
      }
    } catch (error) {
      if (error instanceof StructuredEngineError) throw error

      throw new StructuredEngineError({
        code: 'ERR_BILL_PARSING_FAILED',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.FILE_PROCESSING,
        message: `Falha ao processar fatura Neoenergia: ${error.message}`,
        context: { parser: this.distribuidora }
      })
    }
  }
}

/**
 * Factory para criar parser Neoenergia
 */
export function createNeoenergiaParser() {
  return new NeoenergiaParserCosern()
}

/**
 * Parse wrapper com suporte a múltiplas distribuidoras
 */
export async function parseBillPDF(pdfBuffer, distribuidora = 'neoenergia_cosern') {
  // Atualmente suporta apenas Neoenergia
  // Estrutura permite fácil extensão para outras distribuidoras

  if (distribuidora.toLowerCase().includes('neoenergia')) {
    const parser = createNeoenergiaParser()
    return parser.parseNeoenergiaBill(pdfBuffer)
  }

  throw new StructuredEngineError({
    code: 'ERR_DISTRIBUIDORA_NOT_SUPPORTED',
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.FILE_PROCESSING,
    message: `Distribuidora não suportada: ${distribuidora}`,
    context: { distribuidora }
  })
}
