import { Router } from 'express'
import {
  listarAtivosProjeto, buscarAtivo, criarAtivo, atualizarAtivo, gerarAtivosDoProjeto,
} from '../controllers/ativosController.js'

// P1-ASSET-CORE-01 — rotas do Gêmeo Digital (backend apenas)
const router = Router()

router.get('/projeto/:id',     listarAtivosProjeto)
router.post('/gerar/:projetoId', gerarAtivosDoProjeto)
router.get('/:id',             buscarAtivo)
router.post('/',               criarAtivo)
router.put('/:id',             atualizarAtivo)

export default router
