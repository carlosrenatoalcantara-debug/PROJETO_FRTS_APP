import { Router } from 'express'
import {
  listarClientes,
  buscarCliente,
  criarCliente,
  atualizarCliente,
  excluirCliente,
  listarProjetosPorCliente,
} from '../controllers/clientesController.js'
import { Cliente } from '../models/Cliente.js'
import { ContaEnergiaCliente } from '../models/ContaEnergiaCliente.js'
import * as storage from '../services/documentStorageService.js'
import { criarContasClienteController } from '../controllers/contasClienteController.js'

const router = Router()
const contas = criarContasClienteController({ Cliente, ContaEnergiaCliente, storage })

router.get('/',             listarClientes)
router.get('/:id',          buscarCliente)
router.get('/:id/projetos', listarProjetosPorCliente)
router.get('/:id/contas',                    contas.listar)
router.post('/:id/contas',                    contas.anexar)   // JSON { dados } — nenhum arquivo é guardado
router.get('/:id/contas/:contaId/dados.json', contas.baixarJson)
router.get('/:id/contas/:contaId/dados.md',   contas.baixarMarkdown)
router.get('/:id/contas/:contaId/arquivo',   contas.baixarArquivo)
router.delete('/:id/contas/:contaId',        contas.excluir)
router.post('/',            criarCliente)
router.put('/:id',          atualizarCliente)
router.delete('/:id',       excluirCliente)

export default router
