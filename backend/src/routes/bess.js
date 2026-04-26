import { Router } from 'express'
import { dimensionarBESS } from '../controllers/bessController.js'

const router = Router()

router.post('/dimensionar', dimensionarBESS)

export default router
