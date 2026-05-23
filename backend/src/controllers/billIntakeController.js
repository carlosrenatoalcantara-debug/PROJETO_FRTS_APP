// backend/src/controllers/billIntakeController.js

import { billIntakeService } from '../importadores/billIntakeService.js'
import { validateBillExtractedData } from '../importadores/billParserDTO.js'
import { StructuredEngineError, ErrorSeverity, ErrorCategory } from '../utils/errors.js'

/**
 * Controller para operações de ingestão de faturas
 * HTTP endpoints para upload, processamento e criação de projetos
 */

/**
 * POST /api/bills/upload
 * Upload e processamento de fatura PDF
 *
 * Response: {
 *   sucesso: boolean,
 *   mensagem: string,
 *   dados?: {
 *     arquivo: string,
 *     distribuidora: string,
 *     extraido: {...},
 *     confianca_extracao: number,
 *     timestamp_processamento: string
 *   },
 *   erro?: {...}
 * }
 */
export async function uploadBill(req, res) {
  try {
    // Validação de arquivo
    if (!req.file) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Nenhum arquivo foi enviado',
        codigo: 'ERR_NO_FILE_PROVIDED'
      })
    }

    const { filename, path: filePath } = req.file

    // Processa fatura
    const resultado = await billIntakeService.processBill(
      filePath,
      filename,
      { distribuidora: req.body.distribuidora }
    )

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Fatura processada com sucesso',
      dados: resultado
    })
  } catch (error) {
    return res.status(400).json({
      sucesso: false,
      mensagem: error.message || 'Erro ao processar fatura',
      codigo: error.code || 'ERR_UNKNOWN',
      details: error.context || {}
    })
  }
}

/**
 * POST /api/bills/batch
 * Upload e processamento em lote de múltiplas faturas
 */
export async function uploadBillBatch(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Nenhum arquivo foi enviado',
        codigo: 'ERR_NO_FILES_PROVIDED'
      })
    }

    const billFiles = req.files.map(f => ({
      path: f.path,
      name: f.filename
    }))

    const resultado = await billIntakeService.processBillBatch(
      billFiles,
      { distribuidora: req.body.distribuidora }
    )

    return res.status(200).json({
      sucesso: resultado.falhas === 0,
      mensagem: `Processadas ${resultado.sucesso}/${resultado.processados} faturas`,
      dados: resultado
    })
  } catch (error) {
    return res.status(400).json({
      sucesso: false,
      mensagem: error.message || 'Erro ao processar lote',
      codigo: error.code || 'ERR_UNKNOWN'
    })
  }
}

/**
 * POST /api/bills/detect-distributor
 * Detecta a distribuidora de uma fatura enviada
 */
export async function detectDistributor(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Nenhum arquivo foi enviado'
      })
    }

    const distribuidora = await billIntakeService.detectDistribuidora(req.file.path)

    return res.status(200).json({
      sucesso: true,
      distribuidora,
      mensagem: `Distribuidora detectada: ${distribuidora}`
    })
  } catch (error) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Erro ao detectar distribuidora',
      distribuidora: 'neoenergia_cosern' // fallback
    })
  }
}

/**
 * POST /api/bills/validate
 * Valida dados extraídos sem criar projeto
 *
 * Request body: {
 *   cliente: {...},
 *   unidade: {...},
 *   consumo: {...}
 * }
 */
export async function validateExtractedBillData(req, res) {
  try {
    const billData = req.body

    // Validação estrutural
    const validado = validateBillExtractedData(billData, {
      validacao: 'manual',
      timestamp: new Date().toISOString()
    })

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Dados de fatura validados com sucesso',
      dados: validado.data
    })
  } catch (error) {
    return res.status(400).json({
      sucesso: false,
      mensagem: error.message || 'Validação falhou',
      codigo: error.code || 'ERR_VALIDATION_FAILED'
    })
  }
}

/**
 * GET /api/bills/supported-distributors
 * Lista distribuidoras suportadas
 */
export async function getSupportedDistributors(req, res) {
  const distribuidoras = [
    {
      id: 'neoenergia_cosern',
      nome: 'Neoenergia Cosern',
      estado: 'RN',
      suportada: true
    },
    {
      id: 'eletrobras_rge',
      nome: 'Eletrobras (RGE)',
      estado: 'RS',
      suportada: false
    },
    {
      id: 'edp_brasil',
      nome: 'EDP Brasil',
      estado: 'SP/MG',
      suportada: false
    },
    {
      id: 'cemig',
      nome: 'Cemig',
      estado: 'MG',
      suportada: false
    },
    {
      id: 'copel',
      nome: 'Copel',
      estado: 'PR',
      suportada: false
    }
  ]

  return res.status(200).json({
    sucesso: true,
    dados: distribuidoras,
    total: distribuidoras.length,
    suportadas: distribuidoras.filter(d => d.suportada).length
  })
}

/**
 * POST /api/bills/extraction-reference
 * Retorna formato esperado de dados extraídos de fatura
 * Útil para integração com sistemas externos
 */
export async function getExtractionReferenceFormat(req, res) {
  const referenceFormat = {
    cliente: {
      nome_cliente: 'JOÃO DA SILVA',
      cpf_cnpj_parcial: '123.456.789-00',
      endereco: 'Rua das Flores, 123',
      bairro: 'Centro',
      cidade: 'NATAL',
      estado: 'RN',
      cep: '59000-000',
      distribuidora: 'neoenergia_cosern'
    },
    unidade: {
      codigo_cliente: '0123456789',
      codigo_instalacao: '987654321',
      classe_tarifaria: 'Residencial - B1',
      tipo_fornecimento: 'Monofásico',
      tensao: 127,
      modalidade: 'Ativa',
      referencia_fatura: '05/2024',
      leitura_atual: 45672,
      leitura_anterior: 45234,
      numero_dias: 30
    },
    consumo: {
      consumo_medio: 150,
      consumo_12_meses: [120, 130, 140, 145, 150, 155, 160, 165, 170, 165, 155, 145],
      compensacao_energia: 0,
      tarifa: 0.95,
      confianca_extracao: 95
    }
  }

  return res.status(200).json({
    sucesso: true,
    formato_esperado: referenceFormat,
    descricao: 'Estrutura esperada para dados extraídos de faturas'
  })
}
