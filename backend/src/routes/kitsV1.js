/**
 * kitsV1.js — S2.14 Passo 5
 *
 * Rotas v1 do Motor de Recomendação de Kits FV.
 * Montadas em: /api/v1/kits
 */

import { Router } from 'express'
import { recomendarKitsHandler } from '../controllers/kitRecommendationController.js'

const router = Router()

// S2.14 — Motor de Recomendação de Kits FV (read-only, sem persistência)
router.post('/recomendar', recomendarKitsHandler)

export default router
