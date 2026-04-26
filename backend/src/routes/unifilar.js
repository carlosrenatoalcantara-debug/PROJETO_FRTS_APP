import { Router } from 'express'
import { gerarUnifilarFV, gerarUnifilarEV } from '../controllers/unifilarController.js'

const router = Router()

router.post('/fv/gerar', gerarUnifilarFV)
router.post('/ev/gerar', gerarUnifilarEV)

export default router
