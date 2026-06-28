/**
 * categoriasMaterialController.js — P0-CATALOGO-MESTRE-MATERIAIS (Sprint 2A)
 *
 * Leitura dos Templates de Categoria — consumido pelo formulário dinâmico de
 * cadastro de materiais (e, futuramente, pelo importador Excel). Apenas leitura
 * nesta sprint (gestão/edição de templates é via seed versionado).
 */
import { CategoriaMaterial } from '../models/CategoriaMaterial.js'

function empresaDoReq(req) { return req.auth?.empresa_id ?? null }

/** Lista os templates (categorias) ativos da empresa, ordenados por rótulo/chave. */
export async function listarCategorias(req, res) {
  try {
    const filtro = { empresa_id: empresaDoReq(req) }
    if (req.query.ativo !== 'todos') filtro.ativo = true
    const itens = await CategoriaMaterial.find(filtro).sort({ chave: 1 }).lean()
    res.json({ itens })
  } catch (err) {
    res.status(500).json({ mensagem: 'Erro ao listar categorias', erro: err.message })
  }
}

/** Retorna um template por chave (slug). */
export async function buscarCategoria(req, res) {
  try {
    const chave = String(req.params.chave || '').trim().toLowerCase()
    const categoria = await CategoriaMaterial.findOne({ empresa_id: empresaDoReq(req), chave }).lean()
    if (!categoria) return res.status(404).json({ mensagem: 'Categoria/template não encontrado' })
    res.json(categoria)
  } catch (err) {
    res.status(500).json({ mensagem: 'Erro ao buscar categoria', erro: err.message })
  }
}
