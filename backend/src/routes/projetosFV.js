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

const router = Router()

router.get('/',                    listarProjetosFV)
router.get('/:id',                 buscarProjetoFV)
router.get('/:id/telhado',         obterTelhado)
router.get('/cliente/:clienteId',  listarProjetosFVPorCliente)
router.post('/',                   criarProjetoFV)
router.post('/:id/telhado',        salvarTelhado)
router.post('/:id/unifilar/gerar', gerarUnifilarProjeto)
router.put('/:id',                 atualizarProjetoFV)
router.delete('/:id',              excluirProjetoFV)

export default router
