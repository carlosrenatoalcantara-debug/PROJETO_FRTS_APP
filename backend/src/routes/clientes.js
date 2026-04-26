import { Router } from 'express'
import {
  listarClientes,
  buscarCliente,
  criarCliente,
  atualizarCliente,
  excluirCliente,
  listarProjetosPorCliente,
} from '../controllers/clientesController.js'

const router = Router()

router.get('/',             listarClientes)
router.get('/:id',          buscarCliente)
router.get('/:id/projetos', listarProjetosPorCliente)
router.post('/',            criarCliente)
router.put('/:id',          atualizarCliente)
router.delete('/:id',       excluirCliente)

export default router
