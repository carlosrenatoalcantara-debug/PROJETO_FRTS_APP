/**
 * materiais.js — P0-CATALOGO-MESTRE-MATERIAIS (Fase 1)
 *
 * Rotas do Catálogo Mestre de Materiais. Protegidas pelo módulo RBAC `catalogo`
 * (anônimo passa por compat legada; autenticado é checado na matriz).
 * Sem exclusão física (DELETE não exposto) — projetos antigos permanecem íntegros.
 */

import { Router } from 'express'
import {
  listarMateriais,
  buscarMaterial,
  criarMaterial,
  atualizarMaterial,
  alterarStatusMaterial,
  registrarCompra,
} from '../controllers/materiaisController.js'

const router = Router()

router.get('/',            listarMateriais)
router.get('/:id',         buscarMaterial)
router.post('/',           criarMaterial)
router.put('/:id',         atualizarMaterial)
router.patch('/:id',       atualizarMaterial)
router.patch('/:id/status', alterarStatusMaterial)
router.post('/:id/compras', registrarCompra)

export default router
