import { Router } from 'express'
import { gerarEstruturaPDF, validarDadosOrcamento } from '../controllers/orcamentoController.js'

const router = Router()

router.post('/gerar', gerarEstruturaPDF)
router.post('/validar', validarDadosOrcamento)

export default router
