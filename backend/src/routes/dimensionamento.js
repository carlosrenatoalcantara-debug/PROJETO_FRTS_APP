/**
 * 🌞 Rotas — Dimensionamento FV
 *
 * Todas stateless. Não persistem. Apenas calculam e retornam.
 *
 * Endpoints:
 *   POST /api/dimensionamento/calcular   — kWp, geração, payback, VPL, TIR
 *   POST /api/dimensionamento/strings    — montagem de strings + validação elétrica
 *   POST /api/dimensionamento/acessorios — DPS, disjuntores, bitola, conectores
 */

import { Router } from 'express'
import {
  calcularDimensionamento,
  calcularStrings,
  calcularAcessorios,
} from '../controllers/dimensionamentoController.js'

const router = Router()

router.post('/calcular',    calcularDimensionamento)
router.post('/strings',     calcularStrings)
router.post('/acessorios',  calcularAcessorios)

// Health check do módulo
router.get('/health', (_req, res) => {
  res.json({
    sucesso: true,
    modulo: 'dimensionamento-fv',
    versao: '1.0.0',
    endpoints: ['POST /calcular', 'POST /strings', 'POST /acessorios'],
  })
})

export default router
