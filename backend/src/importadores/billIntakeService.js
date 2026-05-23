// backend/src/importadores/billIntakeService.js

import fs from 'fs'
import path from 'path'
import { parseBillPDFUniversal } from './universalBillParser.js'
import {
  validateClientDTO,
  validateUnitDTO,
  validateConsumptionProfileDTO,
  validateBillExtractedData
} from './billParserDTO.js'
import { StructuredEngineError, ErrorSeverity, ErrorCategory } from '../utils/errors.js'

/**
 * Serviço de ingestão de faturas
 *
 * Fluxo:
 * 1. Upload do PDF
 * 2. Parse determinístico da fatura
 * 3. Validação de dados extraídos
 * 4. Criação de DTOs imutáveis
 * 5. Retorno de dados prontos para projeto FV
 */
class BillIntakeService {
  constructor() {
    this.maxFileSize = 10 * 1024 * 1024 // 10MB
    this.supportedMimeTypes = ['application/pdf']
  }

  /**
   * Valida arquivo PDF antes do processamento
   */
  async validateBillFile(filePath, fileName) {
    try {
      // Verifica existência
      if (!fs.existsSync(filePath)) {
        throw new StructuredEngineError({
          code: 'ERR_BILL_FILE_NOT_FOUND',
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.FILE_PROCESSING,
          message: 'Arquivo de fatura não encontrado',
          context: { fileName }
        })
      }

      // Verifica tamanho
      const stats = fs.statSync(filePath)
      if (stats.size > this.maxFileSize) {
        throw new StructuredEngineError({
          code: 'ERR_BILL_FILE_TOO_LARGE',
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.FILE_PROCESSING,
          message: `Arquivo muito grande. Máximo: 10MB, Recebido: ${Math.round(stats.size / 1024 / 1024)}MB`,
          context: { fileName, size: stats.size }
        })
      }

      // Verifica extensão
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        throw new StructuredEngineError({
          code: 'ERR_BILL_INVALID_FORMAT',
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.FILE_PROCESSING,
          message: 'Apenas arquivos PDF são suportados',
          context: { fileName, type: path.extname(fileName) }
        })
      }

      return true
    } catch (error) {
      if (error instanceof StructuredEngineError) throw error

      throw new StructuredEngineError({
        code: 'ERR_BILL_VALIDATION_FAILED',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.FILE_PROCESSING,
        message: `Validação do arquivo falhou: ${error.message}`,
        context: { fileName }
      })
    }
  }

  /**
   * Lê arquivo de fatura do disco
   */
  async readBillFile(filePath) {
    try {
      return fs.readFileSync(filePath)
    } catch (error) {
      throw new StructuredEngineError({
        code: 'ERR_BILL_READ_FAILED',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.FILE_PROCESSING,
        message: `Falha ao ler arquivo: ${error.message}`,
        context: { filePath }
      })
    }
  }

  /**
   * Processa fatura completa com parser universal
   * Suporta todas as concessionárias via profiles
   * Retorna dados estruturados prontos para criação de projeto
   */
  async processBill(filePath, fileName, options = {}) {
    try {
      // 1. Validação inicial do arquivo
      await this.validateBillFile(filePath, fileName)

      // 2. Leitura do arquivo
      const pdfBuffer = await this.readBillFile(filePath)

      // 3. Parse da fatura com parser universal
      const parseResult = await parseBillPDFUniversal(
        pdfBuffer,
        options.distribuidora || 'neoenergia_cosern'
      )

      // 4. Validação de dados extraídos
      const billData = validateBillExtractedData(
        {
          cliente: parseResult.cliente,
          unidade: parseResult.unidade,
          consumo: parseResult.consumo
        },
        {
          fileName,
          distribuidora: parseResult.distributorId,
          confianca: parseResult.consumo.confianca_extracao,
          dadosEstimados: parseResult.consumo.dados_estimados
        }
      )

      // 5. Preparação de resposta completa
      const resultado = {
        sucesso: true,
        arquivo: fileName,
        distribuidora: parseResult.distributorId,
        distribuidora_nome: parseResult.distributorNome,
        extraido: {
          ...billData.data,
          historico: {
            mes_dados: parseResult.historicoExtracao.mesDados,
            ano_dados: parseResult.historicoExtracao.anoDados,
            posicoes_array: parseResult.historicoExtracao.posicoes12,
            dados_estimados: parseResult.historicoExtracao.temEstimados
          }
        },
        confianca_extracao: parseResult.consumo.confianca_extracao,
        timestamp_processamento: new Date().toISOString(),
        versao_parser: parseResult.versionParser
      }

      return resultado
    } catch (error) {
      if (error instanceof StructuredEngineError) throw error

      throw new StructuredEngineError({
        code: 'ERR_BILL_PROCESSING_FAILED',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.FILE_PROCESSING,
        message: `Processamento de fatura falhou: ${error.message}`,
        context: { fileName }
      })
    }
  }

  /**
   * Processa múltiplas faturas em lote
   */
  async processBillBatch(billFiles, options = {}) {
    const resultados = {
      processados: 0,
      sucesso: 0,
      falhas: 0,
      erros: [],
      dados: []
    }

    for (const file of billFiles) {
      try {
        const resultado = await this.processBill(file.path, file.name, options)
        resultados.processados++
        resultados.sucesso++
        resultados.dados.push(resultado)
      } catch (error) {
        resultados.processados++
        resultados.falhas++
        resultados.erros.push({
          arquivo: file.name,
          erro: error.code || 'UNKNOWN_ERROR',
          mensagem: error.message
        })
      }
    }

    return resultados
  }

  /**
   * Detecta distribuidora baseado em conteúdo do PDF
   */
  async detectDistribuidora(filePath) {
    try {
      const pdfBuffer = await this.readBillFile(filePath)
      const parseResult = await parseBillPDFUniversal(pdfBuffer)
      return parseResult.distributorId
    } catch (error) {
      // Fallback para Neoenergia como padrão
      return 'neoenergia_cosern'
    }
  }
}

/**
 * Factory para criar instância do serviço
 */
export function createBillIntakeService() {
  return new BillIntakeService()
}

/**
 * Wrapper para uso simplificado em controllers
 */
export const billIntakeService = createBillIntakeService()
