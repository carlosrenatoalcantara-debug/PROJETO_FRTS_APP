import { Router } from 'express'
import {
  gerarPropostaComercial,
  baixarProposta,
  visualizarProposta,
} from '../controllers/propostaController.js'

const router = Router({ mergeParams: true })

// POST para gerar e baixar proposta (download direto)
router.post('/gerar', gerarPropostaComercial)

// GET para baixar proposta salva
router.get('/download', baixarProposta)

// POST para gerar proposta como preview (base64)
router.post('/visualizar', visualizarProposta)

export default router
