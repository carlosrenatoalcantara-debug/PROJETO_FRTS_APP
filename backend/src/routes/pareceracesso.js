import { Router } from 'express'
import multer from 'multer'
import { extrairParecer, obterUnifilarProjeto } from '../controllers/pareceracessoController.js'
import {
  listarExemplosTreinamento,
  estatisticasTreinamento,
  exportarParaTreinamento
} from '../config/trainingDataCollector.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

/**
 * POST /api/parecer-acesso/extrair
 * Upload and process a Parecer de Acesso PDF
 */
router.post('/extrair', upload.single('pdf'), extrairParecer)

/**
 * GET /api/parecer-acesso/:projectId/unifilar
 * Retrieve unifilar diagram for a project
 */
router.get('/:projectId/unifilar', obterUnifilarProjeto)

/**
 * GET /api/parecer-acesso/treinamento/estatisticas
 * Training data statistics and progress
 */
router.get('/treinamento/estatisticas', (_req, res) => {
  try {
    const stats = estatisticasTreinamento()
    res.json(stats)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

/**
 * GET /api/parecer-acesso/treinamento/exemplos
 * List collected training examples
 */
router.get('/treinamento/exemplos', (_req, res) => {
  try {
    const exemplos = listarExemplosTreinamento()
    res.json(exemplos)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

/**
 * POST /api/parecer-acesso/treinamento/exportar
 * Export training data for Gemini fine-tuning
 */
router.post('/treinamento/exportar', (_req, res) => {
  try {
    const resultado = exportarParaTreinamento()
    res.json(resultado)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

export default router
