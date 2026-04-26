import { Router } from 'express'
import {
  listarProjetosEV,
  buscarProjetoEV,
  criarProjetoEV,
  atualizarProjetoEV,
  excluirProjetoEV,
  listarProjetosEVPorCliente,
} from '../controllers/projetosEVController.js'

const router = Router()

router.get('/',                    listarProjetosEV)
router.get('/:id',                 buscarProjetoEV)
router.get('/cliente/:clienteId',  listarProjetosEVPorCliente)
router.post('/',                   criarProjetoEV)
router.put('/:id',                 atualizarProjetoEV)
router.delete('/:id',              excluirProjetoEV)

export default router
