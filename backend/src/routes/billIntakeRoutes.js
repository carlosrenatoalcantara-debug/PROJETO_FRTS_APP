// backend/src/routes/billIntakeRoutes.js

import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import {
  uploadBill,
  uploadBillBatch,
  detectDistributor,
  validateExtractedBillData,
  getSupportedDistributors,
  getExtractionReferenceFormat
} from '../controllers/billIntakeController.js'

const router = express.Router()

// ─── Configuração de Upload ───────────────────────────────────────────────

// Criar diretório de uploads se não existir
const uploadDir = path.join(process.cwd(), 'uploads', 'bills')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configurar multer para armazenar arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Nome único: timestamp + nome original
    const timestamp = Date.now()
    const extension = path.extname(file.originalname)
    const baseName = path.basename(file.originalname, extension)
    cb(null, `${baseName}_${timestamp}${extension}`)
  }
})

const fileFilter = (req, file, cb) => {
  // Apenas PDFs
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true)
  } else {
    cb(new Error('Apenas arquivos PDF são permitidos'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
})

// ─── Rotas ────────────────────────────────────────────────────────────────

/**
 * POST /api/bills/upload
 * Upload e processamento de uma única fatura
 *
 * Multipart form-data:
 * - file: arquivo PDF da fatura
 * - distribuidora: (opcional) identificador da distribuidora
 *
 * Exemplo com curl:
 * curl -X POST -F "file=@fatura.pdf" http://localhost:3000/api/bills/upload
 */
router.post('/upload', upload.single('file'), uploadBill)

/**
 * POST /api/bills/batch
 * Upload e processamento em lote de múltiplas faturas
 *
 * Multipart form-data:
 * - files: múltiplos arquivos PDF
 * - distribuidora: (opcional) identificador da distribuidora
 *
 * Exemplo com curl:
 * curl -X POST -F "files=@fatura1.pdf" -F "files=@fatura2.pdf" http://localhost:3000/api/bills/batch
 */
router.post('/batch', upload.array('files', 10), uploadBillBatch)

/**
 * POST /api/bills/detect-distributor
 * Detecta a distribuidora de uma fatura enviada
 *
 * Multipart form-data:
 * - file: arquivo PDF da fatura
 *
 * Resposta:
 * { sucesso: true, distribuidora: "neoenergia_cosern" }
 */
router.post('/detect-distributor', upload.single('file'), detectDistributor)

/**
 * POST /api/bills/validate
 * Valida dados extraídos de fatura (sem processar PDF)
 *
 * JSON body:
 * {
 *   cliente: {...},
 *   unidade: {...},
 *   consumo: {...}
 * }
 *
 * Útil para validar dados capturados manualmente ou via OCR externo
 */
router.post('/validate', express.json(), validateExtractedBillData)

/**
 * GET /api/bills/supported-distributors
 * Lista distribuidoras suportadas
 *
 * Resposta:
 * {
 *   sucesso: true,
 *   dados: [
 *     {
 *       id: "neoenergia_cosern",
 *       nome: "Neoenergia Cosern",
 *       estado: "RN",
 *       suportada: true
 *     },
 *     ...
 *   ],
 *   total: 5,
 *   suportadas: 1
 * }
 */
router.get('/supported-distributors', getSupportedDistributors)

/**
 * GET /api/bills/extraction-format
 * Retorna referência de formato esperado para dados extraídos
 *
 * Útil para documentação e integração com sistemas externos
 */
router.get('/extraction-format', getExtractionReferenceFormat)

// ─── Error Handling ────────────────────────────────────────────────────────

// Middleware para tratar erros de upload
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Arquivo muito grande. Máximo: 10MB',
        codigo: 'ERR_FILE_TOO_LARGE'
      })
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Muitos arquivos. Máximo: 10',
        codigo: 'ERR_TOO_MANY_FILES'
      })
    }
  }

  if (err.message === 'Apenas arquivos PDF são permitidos') {
    return res.status(400).json({
      sucesso: false,
      mensagem: err.message,
      codigo: 'ERR_INVALID_FILE_TYPE'
    })
  }

  return res.status(500).json({
    sucesso: false,
    mensagem: err.message || 'Erro interno do servidor',
    codigo: 'ERR_INTERNAL_SERVER'
  })
})

export default router
