/**
 * ativosController.js — P1-ASSET-CORE-01 (FASE 5)
 * CRUD do Gêmeo Digital + geração a partir de projeto. Backend apenas (sem telas).
 */
import mongoose from 'mongoose'
import { AtivoEquipamento } from '../models/AtivoEquipamento.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { gerarAtivosProjeto, gerarQrCode } from '../services/ativoService.js'

function _dbOk(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    return false
  }
  return true
}

// Máquina de estados (P0-ASSET-MODEL-01 / FASE 3 do design)
const TRANSICOES = {
  planejado:   ['instalado', 'desativado'],
  instalado:   ['operacional', 'desativado'],
  operacional: ['manutencao', 'substituido', 'desativado'],
  manutencao:  ['operacional', 'substituido'],
  substituido: [],
  desativado:  [],
}

// GET /api/ativos/projeto/:id  — lista ativos de um projeto (opcional ?arranjo_id=&tipo=&status=)
export const listarAtivosProjeto = async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const filtro = { projeto_id: id }
    if (req.query.arranjo_id) filtro.arranjo_id = req.query.arranjo_id
    if (req.query.tipo)       filtro.tipo = req.query.tipo
    if (req.query.status)     filtro.status = req.query.status
    const itens = await AtivoEquipamento.find(filtro).sort({ createdAt: 1 }).lean()
    const por_tipo = itens.reduce((acc, a) => { acc[a.tipo] = (acc[a.tipo] || 0) + 1; return acc }, {})
    res.json({ sucesso: true, total: itens.length, por_tipo, itens })
  } catch (e) { res.status(500).json({ erro: e.message }) }
}

// GET /api/ativos/:id
export const buscarAtivo = async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const ativo = await AtivoEquipamento.findById(id).lean()
    if (!ativo) return res.status(404).json({ erro: 'Ativo não encontrado' })
    res.json({ sucesso: true, item: ativo })
  } catch (e) { res.status(500).json({ erro: e.message }) }
}

// POST /api/ativos  — cria um ativo avulso (gera QR se ausente)
export const criarAtivo = async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const body = req.body || {}
    if (!body.projeto_id || !mongoose.Types.ObjectId.isValid(body.projeto_id)) {
      return res.status(400).json({ erro: 'projeto_id válido é obrigatório' })
    }
    if (!body.tipo) return res.status(400).json({ erro: 'tipo é obrigatório' })
    const qr_code = body.qr_code || await gerarQrCode(body.tipo)
    const doc = await AtivoEquipamento.create({
      ...body, qr_code,
      status: body.status || 'planejado',
      historico: [{ tipo: 'criacao', usuario: req.auth?.email || 'manual', descricao: 'Ativo criado manualmente' }],
    })
    res.status(201).json({ sucesso: true, item: doc.toObject() })
  } catch (e) { res.status(400).json({ erro: e.message }) }
}

// PUT /api/ativos/:id  — atualiza; valida transição de status e registra no histórico
export const atualizarAtivo = async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const ativo = await AtivoEquipamento.findById(id)
    if (!ativo) return res.status(404).json({ erro: 'Ativo não encontrado' })

    const body = req.body || {}
    // qr_code é imutável
    delete body.qr_code; delete body.chave_origem; delete body._id

    // transição de status validada
    if (body.status && body.status !== ativo.status) {
      const permitidas = TRANSICOES[ativo.status] || []
      if (!permitidas.includes(body.status)) {
        return res.status(409).json({
          erro: `Transição inválida: ${ativo.status} → ${body.status}`,
          transicoes_validas: permitidas,
        })
      }
      ativo.historico.push({
        tipo: 'mudanca_status', usuario: req.auth?.email || 'manual',
        descricao: `Status ${ativo.status} → ${body.status}`,
        status_de: ativo.status, status_para: body.status,
      })
    }

    const CAMPOS = ['arranjo_id', 'equipamento_id', 'fabricante', 'modelo', 'numero_serie',
      'quantidade', 'status', 'data_instalacao', 'data_comissionamento', 'garantia_inicio',
      'garantia_fim', 'conectividade', 'localizacao', 'observacoes', 'topologia',
      'substitui_ativo_id', 'substituido_por_ativo_id']
    for (const k of CAMPOS) if (body[k] !== undefined) ativo[k] = body[k]

    await ativo.save()
    res.json({ sucesso: true, item: ativo.toObject() })
  } catch (e) { res.status(400).json({ erro: e.message }) }
}

// POST /api/ativos/gerar/:projetoId  — gera (idempotente) os ativos do projeto
export const gerarAtivosDoProjeto = async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { projetoId } = req.params
    if (!mongoose.Types.ObjectId.isValid(projetoId)) return res.status(400).json({ erro: 'ID inválido' })
    const projeto = await ProjetoFV.findById(projetoId).lean()
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const dry_run = req.query.dry_run === '1' || req.body?.dry_run === true
    const r = await gerarAtivosProjeto(projeto, { usuario: req.auth?.email || 'sistema', dry_run })
    res.status(dry_run ? 200 : 201).json({
      sucesso: true, dry_run,
      criados: r.criados, existentes: r.existentes, total: r.total_specs, por_tipo: r.por_tipo,
    })
  } catch (e) { res.status(500).json({ erro: e.message }) }
}
