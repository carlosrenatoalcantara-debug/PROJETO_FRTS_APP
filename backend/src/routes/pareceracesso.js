import { Router } from 'express'
import multer from 'multer'
import { extrairParecer, obterUnifilarProjeto } from '../controllers/pareceracessoController.js'

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

export default router
