import { Router } from 'express'
import { calcularFV } from '../controllers/engenhariaController.js'

const router = Router()

router.post('/fv', calcularFV)

export default router
