import { Router } from 'express'
import {
  listarClientes,
  buscarCliente,
  criarCliente,
  atualizarCliente,
  excluirCliente,
  listarProjetosPorCliente,
} from '../controllers/clientesController.js'
import multer from 'multer'
import { Cliente } from '../models/Cliente.js'
import { ContaEnergiaCliente } from '../models/ContaEnergiaCliente.js'
import * as storage from '../services/documentStorageService.js'
import { criarContasClienteController } from '../controllers/contasClienteController.js'
import { TAMANHO_MAXIMO_CONTA } from '../dominio/cliente/contaEnergia.js'

const router = Router()
const contas = criarContasClienteController({ Cliente, ContaEnergiaCliente, storage })
// Limite do multer = limite da regra; estourar vira 413 com mensagem, não 500.
const uploadConta = (req, res, next) =>
  multer({ storage: multer.memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_CONTA } })
    .single('conta')(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ codigo: 'ARQUIVO_GRANDE', mensagem: 'A conta passa de 10 MB. Envie um arquivo menor.' })
      }
      if (err) return res.status(400).json({ codigo: 'UPLOAD_INVALIDO', mensagem: err.message })
      next()
    })

router.get('/',             listarClientes)
router.get('/:id',          buscarCliente)
router.get('/:id/projetos', listarProjetosPorCliente)
router.get('/:id/contas',                    contas.listar)
router.post('/:id/contas',      uploadConta, contas.anexar)
router.get('/:id/contas/:contaId/arquivo',   contas.baixarArquivo)
router.delete('/:id/contas/:contaId',        contas.excluir)
router.post('/',            criarCliente)
router.put('/:id',          atualizarCliente)
router.delete('/:id',       excluirCliente)

export default router
