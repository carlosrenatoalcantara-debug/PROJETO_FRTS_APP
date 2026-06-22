/**
 * referencia.js — P1-COSERN-REFERENCE-TOPOLOGIES-01
 * Biblioteca de topologias de referência (COSERN). Somente leitura, sem auth.
 */
import { Router } from 'express'
import { sugerirTopologia, listarReferencias } from '../services/referenciaTopologiaService.js'

const router = Router()

// GET /api/referencia/topologia?concessionaria=COSERN&classe=T7&arquitetura=string
router.get('/topologia', (req, res) => {
  const { concessionaria = 'COSERN', classe, arquitetura } = req.query
  const r = sugerirTopologia({ concessionaria, classe, arquitetura })
  if (!r.ok) return res.status(404).json(r)
  res.json(r)
})

// GET /api/referencia/classes?concessionaria=COSERN — lista completa (Fase 10)
router.get('/classes', (req, res) => {
  const { concessionaria = 'COSERN' } = req.query
  const r = listarReferencias(concessionaria)
  if (!r.ok) return res.status(404).json(r)
  res.json(r)
})

export default router
