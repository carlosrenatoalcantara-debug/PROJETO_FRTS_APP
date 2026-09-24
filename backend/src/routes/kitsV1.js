/**
 * kitsV1.js — S2.14 Passo 5
 *
 * Rotas v1 do Motor de Recomendação de Kits FV.
 * Montadas em: /api/v1/kits
 */

import { Router } from 'express'
import { recomendarKitsHandler } from '../controllers/kitRecommendationController.js'

const router = Router()

// ── P1 — API comercial ativa sem autenticação (F9) ──────────────────────────
//
// `POST /api/v1/kits/recomendar` é PÚBLICA e devolve preço unitário de painel e
// inversor do dataset comercial. Diferente de `/api/string/*` e
// `/api/recomendacao/sistema` — que a F9 autenticou por não terem consumidor —
// esta tem consumidor vivo: `frontend/src/components/fv/BuscaKitsFV.jsx`, que
// hoje faz `fetch` SEM header `Authorization`. Exigir token aqui quebraria a
// feature, e decidir se a busca de kits deve ser pública é decisão de produto,
// não de engenharia.
//
// Mitigação aplicada na F9, esta sim dentro do escopo: a resposta passou a
// declarar `fonte: 'catalogo_comercial'` e
// `compatibilidade_eletrica: 'nao_avaliado'`, e deixou de afirmar validação
// elétrica. O que vaza é preço de um dataset de demonstração — não o SSOT.
//
// Pendente de decisão de produto: tornar autenticada (e ajustar o frontend) ou
// assumir como endpoint público por design.
//
// S2.14 — Motor de Recomendação de Kits FV (read-only, sem persistência)
router.post('/recomendar', recomendarKitsHandler)

export default router
