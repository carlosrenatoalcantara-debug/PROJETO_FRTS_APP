import { Router } from 'express'
import {
  listarProjetosFV,
  buscarProjetoFV,
  criarProjetoFV,
  atualizarProjetoFV,
  excluirProjetoFV,
  listarProjetosFVPorCliente,
  salvarTelhado,
  obterTelhado,
  gerarUnifilarProjeto,
} from '../controllers/projetosFVController.js'
import {
  prepararComFatura,
  finalizarComFatura,
} from '../controllers/projetoFVFunilController.js'

const router = Router()

// ── Funil v2 (S2 — endpoints encadeados sem efeito no fluxo legado) ─────────
router.post('/preparar-com-fatura', prepararComFatura)
router.post('/finalizar-com-fatura', finalizarComFatura)

// ── CRUD existente (preservado) ─────────────────────────────────────────────
router.get('/',                    listarProjetosFV)
router.get('/:id',                 buscarProjetoFV)
router.get('/:id/telhado',         obterTelhado)
router.get('/cliente/:clienteId',  listarProjetosFVPorCliente)
router.post('/',                   criarProjetoFV)
router.post('/:id/telhado',        salvarTelhado)
router.post('/:id/unifilar/gerar', gerarUnifilarProjeto)
router.put('/:id',                 atualizarProjetoFV)
router.patch('/:id',               atualizarProjetoFV)  // alias para consistência com EV
router.delete('/:id',              excluirProjetoFV)

export default router
