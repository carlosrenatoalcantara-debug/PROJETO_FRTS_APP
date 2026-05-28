import { Router } from 'express'
import { obterPropostaPublica } from '../controllers/projetosFVController.js'

/**
 * Rotas PÚBLICAS (sem auth) — S5.
 * Servem apenas leitura de snapshots congelados via token de compartilhamento.
 * Nunca recalculam nada; nunca expõem dados internos (custos/margem/markup).
 */
const router = Router()

router.get('/proposta/:token', obterPropostaPublica)

export default router
