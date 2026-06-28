/**
 * materiaisController.js — P0-CATALOGO-MESTRE-MATERIAIS (Fase 1)
 *
 * CRUD do Catálogo Mestre de Materiais. Apenas infraestrutura:
 *   listar (paginação + filtros + busca), buscar, criar, atualizar, alterarStatus,
 *   registrarCompra (histórico $push/$slice:-5). SEM matcher/estoque/import/snapshot.
 *
 * SSOT = MongoDB (não depende do fallback memory-storage). empresa_id vem do JWT.
 */

import { Material, STATUS_MATERIAL } from '../models/Material.js'
import { derivarChaveCanonica } from '../utils/catalogo/chaveCanonicaMaterial.js'
import {
  carregarTemplate,
  validarMaterialContraTemplate,
  gerarDescricao,
  atributosIdentidade,
} from '../services/categoriaTemplateService.js'

const HISTORICO_MAX = 5

function empresaDoReq(req) { return req.auth?.empresa_id ?? null }
function usuarioDoReq(req) { return req.auth?.email ?? 'sistema' }
function escaparRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

/** Campos aceitos do body (whitelist) — ignora qualquer campo não previsto. */
function lerCamposMaterial(body = {}) {
  const out = {}
  for (const k of ['descricao', 'categoria', 'classe', 'unidade', 'fabricante', 'modelo']) {
    if (body[k] !== undefined) out[k] = body[k]
  }
  if (Array.isArray(body.especificacoes)) out.especificacoes = body.especificacoes
  if (Array.isArray(body.aliases)) out.aliases = body.aliases.map(a => String(a).trim()).filter(Boolean)
  return out
}

/** Aplica preço de referência carimbando atualizadoEm/Por quando o valor muda. */
function aplicarPreco(doc, precoBody, usuario) {
  if (!precoBody || precoBody.valor === undefined) return
  const novoValor = precoBody.valor === null ? null : Number(precoBody.valor)
  const mudou = (doc.precoReferencia?.valor ?? null) !== (novoValor ?? null)
  doc.precoReferencia = {
    valor: novoValor,
    moeda: precoBody.moeda || doc.precoReferencia?.moeda || 'BRL',
    atualizadoEm: mudou ? new Date() : (doc.precoReferencia?.atualizadoEm ?? null),
    atualizadoPor: mudou ? usuario : (doc.precoReferencia?.atualizadoPor ?? null),
  }
}

/**
 * Aplica o Template de Categoria a um material (mutando-o): valida, define a classe,
 * gera a descrição padronizada e deriva a chaveCanonica dos atributos de identidade.
 * Retorna null em sucesso, ou { status, body } de erro pronto para responder.
 */
async function aplicarTemplate(material, empresaId) {
  const template = await carregarTemplate(empresaId, material.categoria)
  if (!template) {
    return { status: 422, body: { mensagem: `Categoria "${material.categoria}" não possui template cadastrado`, codigo: 'SEM_TEMPLATE' } }
  }
  material.classe = template.classe   // template é autoridade da classe
  const { valido, erros } = validarMaterialContraTemplate(material, template)
  if (!valido) return { status: 422, body: { mensagem: 'Material inválido para o template da categoria', erros } }

  const descricao = gerarDescricao(template, material)
  if (descricao) material.descricao = descricao
  material.chaveCanonica = derivarChaveCanonica(
    { classe: material.classe, categoria: material.categoria, fabricante: material.fabricante, modelo: material.modelo, especificacoes: material.especificacoes },
    { atributosIdentidade: atributosIdentidade(template) },
  )
  return null
}

// ─── LISTAR (paginação + filtros + busca) ────────────────────────────────────
export async function listarMateriais(req, res) {
  try {
    const pagina = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limite = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50))

    const filtro = { empresa_id: empresaDoReq(req) }
    if (req.query.categoria) filtro.categoria = String(req.query.categoria).trim().toLowerCase()
    if (req.query.classe)    filtro.classe = String(req.query.classe).trim()
    if (req.query.status)    filtro.status = String(req.query.status).trim()
    if (req.query.q) {
      // DÍVIDA TÉCNICA MONITORADA (aprovada): busca por regex case-insensitive.
      // Quando o catálogo crescer significativamente, substituir por índice dedicado
      // (text index / Atlas Search). NÃO otimizar agora. Ver
      // docs/DECISAO-MULTITENANCY-CATALOGO-MATERIAIS.md
      const rx = new RegExp(escaparRegex(String(req.query.q).trim()), 'i')
      filtro.$or = [{ descricao: rx }, { aliases: rx }]
    }

    const [itens, total] = await Promise.all([
      Material.find(filtro).sort({ descricao: 1 }).skip((pagina - 1) * limite).limit(limite).lean(),
      Material.countDocuments(filtro),
    ])

    res.json({
      itens,
      paginacao: { pagina, limite, total, totalPaginas: Math.max(1, Math.ceil(total / limite)) },
    })
  } catch (err) {
    res.status(500).json({ mensagem: 'Erro ao listar materiais', erro: err.message })
  }
}

// ─── BUSCAR ──────────────────────────────────────────────────────────────────
export async function buscarMaterial(req, res) {
  try {
    const material = await Material.findOne({ _id: req.params.id, empresa_id: empresaDoReq(req) }).lean()
    if (!material) return res.status(404).json({ mensagem: 'Material não encontrado' })
    res.json(material)
  } catch (err) {
    res.status(500).json({ mensagem: 'Erro ao buscar material', erro: err.message })
  }
}

// ─── CRIAR ───────────────────────────────────────────────────────────────────
export async function criarMaterial(req, res) {
  try {
    const dados = lerCamposMaterial(req.body)
    const material = new Material({ ...dados, empresa_id: empresaDoReq(req) })

    const erro = await aplicarTemplate(material, empresaDoReq(req))
    if (erro) return res.status(erro.status).json(erro.body)

    aplicarPreco(material, req.body.precoReferencia, usuarioDoReq(req))
    if (req.body.status && STATUS_MATERIAL.includes(req.body.status)) material.status = req.body.status

    await material.save()
    res.status(201).json(material)
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ mensagem: 'Já existe um material com esta identidade (chave canônica)', codigo: 'DUPLICADO' })
    }
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ mensagem: 'Dados inválidos', erro: err.message })
    }
    res.status(500).json({ mensagem: 'Erro ao criar material', erro: err.message })
  }
}

// ─── ATUALIZAR ───────────────────────────────────────────────────────────────
export async function atualizarMaterial(req, res) {
  try {
    const material = await Material.findOne({ _id: req.params.id, empresa_id: empresaDoReq(req) })
    if (!material) return res.status(404).json({ mensagem: 'Material não encontrado' })

    const dados = lerCamposMaterial(req.body)
    Object.assign(material, dados)

    const erro = await aplicarTemplate(material, empresaDoReq(req))
    if (erro) return res.status(erro.status).json(erro.body)

    aplicarPreco(material, req.body.precoReferencia, usuarioDoReq(req))

    await material.save()
    res.json(material)
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ mensagem: 'Já existe um material com esta identidade (chave canônica)', codigo: 'DUPLICADO' })
    }
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ mensagem: 'Dados inválidos', erro: err.message })
    }
    res.status(500).json({ mensagem: 'Erro ao atualizar material', erro: err.message })
  }
}

// ─── ALTERAR STATUS (sem exclusão física) ────────────────────────────────────
export async function alterarStatusMaterial(req, res) {
  try {
    const { status } = req.body
    if (!STATUS_MATERIAL.includes(status)) {
      return res.status(400).json({ mensagem: `status deve ser um de: ${STATUS_MATERIAL.join(', ')}` })
    }
    const material = await Material.findOneAndUpdate(
      { _id: req.params.id, empresa_id: empresaDoReq(req) },
      { $set: { status } },
      { returnDocument: 'after' },
    )
    if (!material) return res.status(404).json({ mensagem: 'Material não encontrado' })
    res.json(material)
  } catch (err) {
    res.status(500).json({ mensagem: 'Erro ao alterar status', erro: err.message })
  }
}

// ─── REGISTRAR COMPRA (histórico bounded $push/$slice:-5) ─────────────────────
export async function registrarCompra(req, res) {
  try {
    const { data, fornecedor, valor, observacao } = req.body
    if (!fornecedor || valor == null) {
      return res.status(400).json({ mensagem: 'Campos obrigatórios: fornecedor, valor' })
    }
    const compra = {
      data: data ? new Date(data) : new Date(),
      fornecedor: String(fornecedor).trim(),
      valor: Number(valor),
      observacao: observacao ? String(observacao).trim() : null,
    }
    if (Number.isNaN(compra.valor) || compra.valor < 0) {
      return res.status(400).json({ mensagem: 'valor deve ser um número >= 0' })
    }

    const material = await Material.findOneAndUpdate(
      { _id: req.params.id, empresa_id: empresaDoReq(req) },
      { $push: { historicoCompras: { $each: [compra], $slice: -HISTORICO_MAX } } },
      { returnDocument: 'after' },
    )
    if (!material) return res.status(404).json({ mensagem: 'Material não encontrado' })
    res.status(201).json(material)
  } catch (err) {
    res.status(500).json({ mensagem: 'Erro ao registrar compra', erro: err.message })
  }
}
