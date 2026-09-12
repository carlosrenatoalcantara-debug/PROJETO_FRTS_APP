/**
 * routes/recomendacao.js
 *
 * F9: rota pública sem consumidor no frontend. Devolvia ranking construído
 * sobre o dataset comercial (incluindo custo estimado) sem exigir token.
 * Autenticada pelo mesmo motivo de `routes/string.js` — impacto zero de
 * produto, superfície pública reduzida.
 */
import { Router } from 'express'
import { recomendarSistema } from '../controllers/recomendacaoController.js'
import { authenticateToken } from '../security/auth-middleware.js'

const router = Router()

router.post('/sistema', authenticateToken, recomendarSistema)

export default router
