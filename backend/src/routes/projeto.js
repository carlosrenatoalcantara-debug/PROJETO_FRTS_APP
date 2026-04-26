import { Router } from 'express'
import { simularProjetoCompleto } from '../controllers/projetoController.js'

const router = Router()

router.post('/simular', simularProjetoCompleto)

export default router
