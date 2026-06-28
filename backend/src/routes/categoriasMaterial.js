/**
 * categoriasMaterial.js — P0-CATALOGO-MESTRE-MATERIAIS (Sprint 2A)
 * Leitura dos Templates de Categoria (módulo RBAC `catalogo`).
 */
import { Router } from 'express'
import { listarCategorias, buscarCategoria } from '../controllers/categoriasMaterialController.js'

const router = Router()
router.get('/', listarCategorias)
router.get('/:chave', buscarCategoria)

export default router
