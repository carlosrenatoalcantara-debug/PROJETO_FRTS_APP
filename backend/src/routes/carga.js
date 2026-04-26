import { Router } from 'express'
import { analisarCarga } from '../controllers/cargaController.js'

const router = Router()

router.post('/analisar', analisarCarga)

export default router
