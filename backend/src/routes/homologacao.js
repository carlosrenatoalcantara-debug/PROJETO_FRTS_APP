import { Router } from 'express'
import mongoose from 'mongoose'
import {
  gerarMemorial,
  gerarCarta,
  obterDadosART,
  obterChecklist,
  atualizarChecklist,
  atualizarStatusHomologacao,
  obterStatusHomologacao,
  testarFreezimento,
} from '../controllers/homologacaoController.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { UnidadeBeneficiaria } from '../models/UnidadeBeneficiaria.js'
import { Equipamento } from '../models/Equipamento.js'
import { AuditLog } from '../models/AuditLog.js'
import {
  gerarChecklist, validarDocumentos, montarPacoteDocumental, STATUS_HOMOLOGACAO,
} from '../utils/homologacao/homologacaoAssistida.js'
import { obterRegras, CONCESSIONARIAS_COM_REGRAS } from '../utils/homologacao/concessionariaProvider.js'

const router = Router({ mergeParams: true })

// ── helpers ────────────────────────────────────────────────────────────────
async function _carregarProjeto(projetoId) {
  if (!mongoose.Types.ObjectId.isValid(projetoId)) return null
  const projeto = await ProjetoFV.findById(projetoId).lean()
  if (!projeto) return null
  // Equipamentos referenciados (paineis + inversores)
  const ids = []
  for (const e of (projeto?.equipamentos?.paineis || [])) if (e?._id || e?.equipamento_id) ids.push(e._id || e.equipamento_id)
  if (projeto?.equipamentos?.inversor?._id) ids.push(projeto.equipamentos.inversor._id)
  if (projeto?.equipamentos?.inversor?.equipamento_id) ids.push(projeto.equipamentos.inversor.equipamento_id)
  const equipamentos = ids.length
    ? await Equipamento.find({ _id: { $in: ids } }).lean()
    : []
  const beneficiarias = await UnidadeBeneficiaria.find({ projetoId }).lean().catch(() => [])
  return { projeto, equipamentos, beneficiarias }
}

async function _auditar(req, acao, projetoId, detalhe = null) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(), usuario: req.auth?.id || req.auth?.email || 'anonymous',
      perfil: req.auth?.perfil || null, empresa: req.auth?.empresa_id || null,
      modulo: 'homologacao', acao, metodo: 'EVENT',
      path: `projeto:${projetoId}${detalhe ? ' ' + String(detalhe).slice(0, 240) : ''}`,
      status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
}

// POST para gerar memorial descritivo
router.post('/memorial', gerarMemorial)

// POST para gerar carta à concessionária
router.post('/carta', gerarCarta)

// GET para obter dados para preenchimento de ART
router.get('/art', obterDadosART)

// GET para obter checklist de documentos
router.get('/checklist', obterChecklist)

// PATCH para atualizar checklist
router.patch('/checklist', atualizarChecklist)

// PATCH para atualizar status da homologação
router.patch('/status', atualizarStatusHomologacao)

// GET para obter status atual
router.get('/status', obterStatusHomologacao)

// POST para testar freezimento e ataques
router.post('/test-freeze', testarFreezimento)

// ─── S9.0 — Homologação Assistida ────────────────────────────────────────

// GET /api/projetos-fv/:projetoId/homologacao/assistida/checklist
router.get('/assistida/checklist', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ erro: 'DB_OFFLINE' })
    const dados = await _carregarProjeto(req.params.projetoId)
    if (!dados) return res.status(404).json({ erro: 'Projeto não encontrado' })
    const checklist = gerarChecklist({
      projeto: dados.projeto, equipamentos: dados.equipamentos, beneficiarias: dados.beneficiarias,
      concessionaria: req.query.concessionaria || dados.projeto?.homologacao?.concessionaria,
    })
    _auditar(req, 'CHECKLIST_GERADO', req.params.projetoId, `${checklist.resumo.ok}/${checklist.resumo.total} ok`)
    res.json({ sucesso: true, checklist })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// GET /api/projetos-fv/:projetoId/homologacao/assistida/validacao
router.get('/assistida/validacao', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ erro: 'DB_OFFLINE' })
    const dados = await _carregarProjeto(req.params.projetoId)
    if (!dados) return res.status(404).json({ erro: 'Projeto não encontrado' })
    const v = validarDocumentos({
      projeto: dados.projeto, equipamentos: dados.equipamentos,
      concessionaria: req.query.concessionaria || dados.projeto?.homologacao?.concessionaria,
    })
    res.json({ sucesso: true, ...v })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// GET /api/projetos-fv/:projetoId/homologacao/assistida/pacote
router.get('/assistida/pacote', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ erro: 'DB_OFFLINE' })
    const dados = await _carregarProjeto(req.params.projetoId)
    if (!dados) return res.status(404).json({ erro: 'Projeto não encontrado' })
    const pacote = montarPacoteDocumental({
      projeto: dados.projeto, equipamentos: dados.equipamentos, beneficiarias: dados.beneficiarias,
      cliente: null, // Cliente seria carregado por populate — omitido aqui
      concessionaria: req.query.concessionaria || dados.projeto?.homologacao?.concessionaria,
    })
    _auditar(req, 'PACOTE_GERADO', req.params.projetoId, `eq=${pacote.equipamentos.length} bnf=${pacote.beneficiarias.length}`)
    res.json({ sucesso: true, pacote })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// PATCH /api/projetos-fv/:projetoId/homologacao/assistida/status
router.patch('/assistida/status', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ erro: 'DB_OFFLINE' })
    const { status, motivo = null } = req.body || {}
    if (!STATUS_HOMOLOGACAO.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido', validos: STATUS_HOMOLOGACAO })
    }
    const projeto = await ProjetoFV.findById(req.params.projetoId)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    projeto.homologacao = projeto.homologacao || {}
    const anterior = projeto.homologacao.status_homologacao || 'nao_iniciado'
    const usuario = req.auth?.id || req.auth?.email || req.body?.usuario || 'anonymous'

    projeto.homologacao.status_homologacao = status
    projeto.homologacao.historico_status = projeto.homologacao.historico_status || []
    projeto.homologacao.historico_status.push({ de: anterior, para: status, por: usuario, motivo })

    if (status === 'em_preparacao' && !projeto.homologacao.iniciada_em) {
      projeto.homologacao.iniciada_em = new Date()
      projeto.homologacao.iniciada_por = usuario
      _auditar(req, 'HOMOLOGACAO_INICIADA', projeto._id)
    }
    if (status === 'homologado') {
      projeto.homologacao.concluida_em = new Date()
      projeto.homologacao.concluida_por = usuario
      _auditar(req, 'HOMOLOGACAO_CONCLUIDA', projeto._id, motivo)
    }
    _auditar(req, 'STATUS_HOMOLOGACAO_ALTERADO', projeto._id, `${anterior} → ${status}${motivo ? ' | ' + motivo : ''}`)

    projeto.markModified('homologacao')
    await projeto.save()
    res.json({ sucesso: true, homologacao: projeto.homologacao })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// GET /api/projetos-fv/:projetoId/homologacao/assistida/regras?concessionaria=X
router.get('/assistida/regras', (req, res) => {
  const regras = obterRegras(req.query.concessionaria)
  res.json({
    sucesso: true,
    concessionaria: req.query.concessionaria || 'PADRAO',
    regras,
    grupos_suportados: CONCESSIONARIAS_COM_REGRAS,
    status_validos: STATUS_HOMOLOGACAO,
  })
})

export default router
