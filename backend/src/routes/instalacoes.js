/**
 * routes/instalacoes.js — S4A-FV-INSTALACAO-WRITE-PATH-01
 *
 * Rotas REST do Aggregate Root Instalacao. Write path isolado — não altera
 * nenhuma rota existente.
 */

import { Router } from 'express'
import {
  criarInstalacao,
  buscarInstalacao,
  atualizarInstalacao,
  excluirInstalacao,
} from '../controllers/instalacaoController.js'

const router = Router()

router.post('/', criarInstalacao)
router.get('/:id', buscarInstalacao)
router.put('/:id', atualizarInstalacao)
router.delete('/:id', excluirInstalacao)

export default router
