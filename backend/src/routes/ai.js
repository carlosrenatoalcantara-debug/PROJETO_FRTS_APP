/**
 * routes/ai.js — AI-ARCH-01 (FASE 7 + FASE 9)
 *
 * Diagnóstico centralizado da camada de IA.
 *   GET  /api/ai/health      → snapshot de saúde dos providers (passivo)
 *   GET  /api/ai/diagnostico → config de chaves (presença/ambiguidades/órfãs) — sem expor valores
 *   POST /api/ai/ping        → sondagem ativa (faz chamadas reais; pode custar)
 */

import express from 'express'
import { getOrchestrator } from '../ai/index.js'
import { diagnosticarChaves } from '../ai/aiKeys.js'

const router = express.Router()

router.get('/health', (_req, res) => {
  try {
    const orch = getOrchestrator()
    res.json({ ok: true, providers: orch.health_snapshot(), gerado_em: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message })
  }
})

router.get('/diagnostico', (_req, res) => {
  // Nunca expõe valores de chave — apenas presença e avisos de configuração.
  res.json({ ok: true, ...diagnosticarChaves(), gerado_em: new Date().toISOString() })
})

router.post('/ping', async (_req, res) => {
  try {
    const orch = getOrchestrator()
    const resultados = await orch.pingTodos()
    res.json({ ok: true, resultados, providers: orch.health_snapshot() })
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message })
  }
})

export default router
