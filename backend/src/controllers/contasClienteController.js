import crypto from 'node:crypto'
import { aplicarEscopo, carimbarTenant } from '../dominio/tenancy/index.js'
import { sanitizarDadosConta, contaTemDados, resumoConta, jsonDaConta, markdownDaConta } from '../dominio/cliente/contaEnergia.js'

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

  /**
   * Recebe os DADOS lidos da conta (`{ dados }`, o corpo devolvido por
   * /api/fatura/extrair) e guarda só a lista fechada deles. Nenhum arquivo é
   * recebido nem gravado. A mesma conta enviada duas vezes devolve a já gravada.
   */
  async function anexar(req, res) {
    try {
      const cliente = await clienteDaEmpresa(req, 'anexarConta')
      if (!cliente) return res.status(404).json({ mensagem: 'Cliente não encontrado' })

      const dados = sanitizarDadosConta(req.body?.dados)
      if (!contaTemDados(dados)) {
        return res.status(400).json({ codigo: 'CONTA_SEM_DADOS', mensagem: 'Não há dados da conta para guardar.' })
      }
      const hash = crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex')

      const repetida = await ContaEnergiaCliente.findOne(
        aplicarEscopo({ clienteId: cliente._id, hash_sha256: hash }, req, { contexto: 'anexarConta.dedupe' }))
      if (repetida) return res.status(200).json(resumoConta(repetida))

      const conta = await ContaEnergiaCliente.create(carimbarTenant({
        clienteId: cliente._id,
        nome: dados.numero_cliente ? `Conta UC ${dados.numero_cliente}` : 'Conta de energia',
        mimetype: 'application/json', tamanho: Buffer.byteLength(JSON.stringify(dados)), hash_sha256: hash,
        storage_provider: null, document_path: null, url_storage: null,
        dados, numero_cliente: dados.numero_cliente ?? null, distribuidora: dados.distribuidora ?? null,
        enviado_por: req.auth?.id ?? null,
      }, req, { contexto: 'anexarConta' }))
      res.status(201).json(resumoConta(conta))
    } catch (err) {
      erro(res, err, 'Erro ao anexar a conta')
    }
  }

  /** `formato`: 'json' | 'md'. Gerado dos dados guardados, sempre iguais a eles. */
  const baixarDados = (formato) => async (req, res) => {
    try {
      const conta = await ContaEnergiaCliente
        .findOne(aplicarEscopo({ _id: req.params.contaId, clienteId: req.params.id }, req, { contexto: 'baixarDadosConta' }))
      if (!conta) return res.status(404).json({ mensagem: 'Conta não encontrada' })
      if (!contaTemDados(conta.dados)) {
        return res.status(404).json({ codigo: 'CONTA_SEM_DADOS', mensagem: 'Esta conta é anterior à guarda por dados e só tem o arquivo original.' })
      }
      const base = `conta-${String(conta.numero_cliente ?? conta._id).replace(/[^A-Za-z0-9._-]+/g, '_')}`
      const json = formato === 'json'
      res.setHeader('Content-Type', json ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${base}.${json ? 'json' : 'md'}"`)
      res.send(json ? jsonDaConta(conta) : markdownDaConta(conta))
    } catch (err) {
      erro(res, err, 'Erro ao gerar o arquivo da conta')
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
      if (!conta.document_path && !conta.url_storage) {
        return res.status(404).json({ codigo: 'SEM_ARQUIVO', mensagem: 'Esta conta guarda só os dados (JSON e Markdown); não há arquivo original.' })
      }
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

  return { anexar, listar, baixarArquivo, baixarJson: baixarDados('json'), baixarMarkdown: baixarDados('md'), excluir }
}
