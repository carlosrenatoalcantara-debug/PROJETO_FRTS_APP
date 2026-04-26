import { Router } from 'express'
import { recomendarSistema } from '../controllers/decisaoController.js'

const router = Router()

router.post('/recomendar', recomendarSistema)

export default router
