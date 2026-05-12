import { Router } from 'express'
import { gerarUnifilarFV, gerarUnifilarEV, gerarArquitetura } from '../controllers/unifilarController.js'

const router = Router()

router.post('/fv/gerar', gerarUnifilarFV)
router.post('/ev/gerar', gerarUnifilarEV)
router.get('/arquitetura', gerarArquitetura)

export default router
