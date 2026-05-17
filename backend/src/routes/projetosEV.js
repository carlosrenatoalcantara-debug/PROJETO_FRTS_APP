import { Router } from 'express'
import {
  listarProjetosEV,
  buscarProjetoEV,
  criarProjetoEV,
  atualizarProjetoEV,
  excluirProjetoEV,
  listarProjetosEVPorCliente,
  exportarPDFProjetoEV,
  calcularNormasProjetoEV,
  recalcularPotenciasProjetosEV,
} from '../controllers/projetosEVController.js'

const router = Router()

router.get('/',                                       listarProjetosEV)
router.get('/:id',                                    buscarProjetoEV)
router.get('/:id/pdf',                                exportarPDFProjetoEV)
router.post('/:id/calcular-normas',                   calcularNormasProjetoEV)
router.get('/cliente/:clienteId',                     listarProjetosEVPorCliente)
router.post('/manutencao/recalcular-potencias',       recalcularPotenciasProjetosEV)
router.post('/',                                      criarProjetoEV)
router.put('/:id',                                    atualizarProjetoEV)
router.patch('/:id',                                  atualizarProjetoEV)  // alias PATCH = PUT
router.delete('/:id',                                 excluirProjetoEV)

export default router
