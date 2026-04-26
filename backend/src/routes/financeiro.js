import { Router } from 'express'
import { simularFinanceiro } from '../controllers/financeiroController.js'

const router = Router()

router.post('/simular', simularFinanceiro)

export default router
