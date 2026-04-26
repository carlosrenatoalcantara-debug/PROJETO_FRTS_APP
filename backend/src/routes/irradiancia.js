import { Router } from 'express'
import { obterIrradiancia, atualizarIrradianciaProjetoFV } from '../controllers/irradianciaController.js'

const router = Router()

router.get('/local', obterIrradiancia)
router.post('/projetos-fv/:projetoId', atualizarIrradianciaProjetoFV)

export default router
