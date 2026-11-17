import crypto from 'node:crypto'
import { aplicarEscopo, carimbarTenant } from '../dominio/tenancy/index.js'
import { validarArquivoConta, resumoConta } from '../dominio/cliente/contaEnergia.js'

/**
 * Contas de energia anexadas ao cliente. Dependências injetáveis para teste:
 * { Cliente, ContaEnergiaCliente, storage: { salvar, baixar } }.
 * Toda consulta passa por aplicarEscopo (M-4): conta de outra empresa = 404.
 */
export function criarContasClienteController({ Cliente, ContaEnergiaCliente, storage }) {
  const erro = (res, err, mensagem) => {
    res.status(err.status || 500).json({ codigo: err.codigo, mensagem, erro: err.message })
  }

  const clienteDaEmpresa = (req, contexto) =>
    Cliente.findOne(aplicarEscopo({ _id: req.params.id }, req, { contexto }))

  async function anexar(req, res) {
    try {
      const cliente = await clienteDaEmpresa(req, 'anexarConta')
      if (!cliente) return res.status(404).json({ mensagem: 'Cliente não encontrado' })

      const v = validarArquivoConta(req.file)
      if (!v.ok) return res.status(v.status).json({ codigo: v.codigo, mensagem: v.mensagem })

      const { originalname, mimetype, size, buffer } = req.file
      const hash = crypto.createHash('sha256').update(buffer).digest('hex')
      const ref = await storage.salvar({
        hash, mimetype, buffer, nome: originalname,
        tipo: 'conta_energia', fabricante: String(cliente._id),
      })
      const conta = await ContaEnergiaCliente.create(carimbarTenant({
        clienteId: cliente._id, nome: originalname, mimetype, tamanho: size, hash_sha256: hash,
        storage_provider: ref.storage_provider, document_path: ref.document_path, url_storage: ref.url_storage,
        enviado_por: req.auth?.id ?? null,
      }, req, { contexto: 'anexarConta' }))
      res.status(201).json(resumoConta(conta))
    } catch (err) {
      erro(res, err, 'Erro ao anexar a conta')
    }
  }

  async function listar(req, res) {
    try {
      const cliente = await clienteDaEmpresa(req, 'listarContas')
      if (!cliente) return res.status(404).json({ mensagem: 'Cliente não encontrado' })
      const contas = await ContaEnergiaCliente
        .find(aplicarEscopo({ clienteId: cliente._id }, req, { contexto: 'listarContas' }))
        .select('-url_storage')
        .sort({ createdAt: -1 })
      res.json(contas.map(resumoConta))
    } catch (err) {
      erro(res, err, 'Erro ao listar as contas')
    }
  }

  async function baixarArquivo(req, res) {
    try {
      const conta = await ContaEnergiaCliente
        .findOne(aplicarEscopo({ _id: req.params.contaId, clienteId: req.params.id }, req, { contexto: 'baixarConta' }))
        .select('+url_storage')
      if (!conta) return res.status(404).json({ mensagem: 'Conta não encontrada' })
      const { buffer, mimetype } = await storage.baixar({
        url_storage: conta.url_storage, document_path: conta.document_path, storage_provider: conta.storage_provider,
      })
      const nome = encodeURIComponent(conta.nome || 'conta')
      res.setHeader('Content-Type', conta.mimetype || mimetype)
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${nome}`)
      res.send(buffer)
    } catch (err) {
      erro(res, err, 'Erro ao baixar a conta')
    }
  }

  async function excluir(req, res) {
    try {
      const conta = await ContaEnergiaCliente
        .findOneAndDelete(aplicarEscopo({ _id: req.params.contaId, clienteId: req.params.id }, req, { contexto: 'excluirConta' }))
      if (!conta) return res.status(404).json({ mensagem: 'Conta não encontrada' })
      res.status(204).end()
    } catch (err) {
      erro(res, err, 'Erro ao excluir a conta')
    }
  }

  return { anexar, listar, baixarArquivo, excluir }
}
