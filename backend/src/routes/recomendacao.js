import { Router } from 'express'
import { recomendarSistema } from '../controllers/recomendacaoController.js'

const router = Router()

router.post('/sistema', recomendarSistema)

export default router
