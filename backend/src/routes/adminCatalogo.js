/**
 * 🔒 Rotas admin do catálogo técnico.
 *
 * S2.6.1 entrega apenas o endpoint de relatório (leitura).
 * Endpoints de reprocessamento/revisão são da S2.6.2/2.6.3.
 *
 * ⚠️ Sem auth nesta fase — segue regra global (ProtectedRoute = FASE 2C).
 * Rota documentada como "interno" — não exposta no frontend público ainda.
 */

import { Router } from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import { Equipamento } from '../models/Equipamento.js'
import { processarEquipamento } from '../services/catalogoQualidade.js'
import crypto from 'crypto'
import { ingerir } from '../services/catalogIntelligenceService.js'
import { avaliarUtilizavel } from '../services/utilizavelProjeto.js'
import { otimizarDocumento, detectarAssinatura } from '../services/documentOptimizerService.js'
import { salvar as salvarStorage } from '../services/documentStorageService.js'
import { analisarDocumentoTecnico } from '../services/geminiDocumentAnalyzer.js'
import { DocumentoTecnico } from '../models/DocumentoTecnico.js'
import { AuditLog } from '../models/AuditLog.js'

// S8.2: status documental do equipamento (COMPLETO/PENDENTE/INCOMPLETO)
export function statusDocumental(eq) {
  const docs = eq?.documentos_tecnicos || []
  const tem = (t) => docs.some(d => d.tipo === t)
  const temDatasheet = tem('datasheet') || !!eq?.datasheet_original?.hash
  if (eq?.tipo === 'inversor') {
    const inmetro = !!eq?.certificacao?.inmetro?.numero || tem('inmetro')
    const iec = (Array.isArray(eq?.certificacao?.normas_iec) && eq.certificacao.normas_iec.length > 0) || tem('iec')
    if (temDatasheet && (inmetro || iec)) return 'COMPLETO'
    if (temDatasheet || inmetro || iec) return 'PENDENTE'
    return 'INCOMPLETO'
  }
  return temDatasheet ? 'COMPLETO' : 'INCOMPLETO'
}

// S8.0.2: documentos exigidos para homologação por tipo (preparação — não gera nada)
export function obterDocumentosHomologacao(eq) {
  const docs = eq?.documentos_tecnicos || []
  const tem = (t) => docs.filter(d => d.tipo === t)
  if (eq?.tipo === 'modulo') {
    return { tipo: 'modulo', exigidos: ['datasheet'], presentes: tem('datasheet'),
      completo: tem('datasheet').length > 0 }
  }
  if (eq?.tipo === 'inversor') {
    const inmetro = eq?.certificacao?.inmetro?.numero || tem('inmetro').length > 0
    const iec = (Array.isArray(eq?.certificacao?.normas_iec) && eq.certificacao.normas_iec.length > 0) || tem('iec').length > 0
    return { tipo: 'inversor', exigidos: ['datasheet', 'inmetro OU certificados IEC'],
      presentes: { datasheet: tem('datasheet'), inmetro, iec },
      completo: tem('datasheet').length > 0 && (inmetro || iec) }
  }
  return { tipo: eq?.tipo, exigidos: ['datasheet'], presentes: tem('datasheet'), completo: tem('datasheet').length > 0 }
}

const router = Router()
const uploadDS = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

// S8.0: auditoria leve do catálogo (mesma trilha AuditLog)
async function _auditCatalogo(req, acao, detalhe) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(), usuario: req.auth?.id || req.auth?.email || 'anonymous',
      perfil: req.auth?.perfil || null, empresa: req.auth?.empresa_id || null,
      modulo: 'catalogo', acao, metodo: 'EVENT', path: detalhe || acao, status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
}

// ─── GET /api/admin/catalogo/qualidade-relatorio ─────────────────────────
//
// Retorna sumário consolidado do catálogo:
//   - Totais por tipo (modulo/inversor/carregador_ev/etc.)
//   - Distribuição por nível de qualidade
//   - Score médio (global / completude / confiança)
//   - Top alertas (códigos mais frequentes)
//   - Lista resumida de equipamentos inválidos
//   - Lista resumida de equipamentos "Desconhecido"
//
router.get('/qualidade-relatorio', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        sucesso: false,
        erro: 'MongoDB indisponível.',
        codigo: 'DB_OFFLINE',
      })
    }

    // 1. Totais por tipo
    const totaisPorTipo = await Equipamento.aggregate([
      { $group: { _id: '$tipo', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ])

    // 2. Distribuição por nível de qualidade
    const distribuicaoNivel = await Equipamento.aggregate([
      { $group: { _id: '$qualidade.nivel', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ])

    // 3. Distribuição cruzada tipo × nível
    const cruzadoTipoNivel = await Equipamento.aggregate([
      {
        $group: {
          _id: { tipo: '$tipo', nivel: '$qualidade.nivel' },
          total: { $sum: 1 },
        },
      },
      { $sort: { '_id.tipo': 1, '_id.nivel': 1 } },
    ])

    // 4. Scores médios (globais e por tipo)
    const scoresGerais = await Equipamento.aggregate([
      {
        $group: {
          _id: null,
          score_global_medio:     { $avg: '$qualidade.score_global' },
          completude_score_medio: { $avg: '$qualidade.completude_score' },
          confianca_score_medio:  { $avg: '$qualidade.confianca_score' },
          total: { $sum: 1 },
        },
      },
    ])

    const scoresPorTipo = await Equipamento.aggregate([
      {
        $group: {
          _id: '$tipo',
          score_global_medio:     { $avg: '$qualidade.score_global' },
          completude_score_medio: { $avg: '$qualidade.completude_score' },
          confianca_score_medio:  { $avg: '$qualidade.confianca_score' },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // 5. Top alertas (códigos mais frequentes)
    const topAlertas = await Equipamento.aggregate([
      { $unwind: { path: '$qualidade.alertas', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: {
            codigo: '$qualidade.alertas.codigo',
            severidade: '$qualidade.alertas.severidade',
          },
          ocorrencias: { $sum: 1 },
        },
      },
      { $sort: { ocorrencias: -1 } },
      { $limit: 25 },
    ])

    // 6. Equipamentos inválidos (até 50)
    const invalidos = await Equipamento.find(
      { 'qualidade.nivel': 'invalido' },
      'tipo fabricante modelo qualidade.score_global qualidade.alertas.codigo qualidade.alertas.severidade'
    )
      .limit(50)
      .lean()

    // 7. Equipamentos "Desconhecido"
    const padraoDesc = /^\s*(desconhecid[ao]|n\/?a|sem\s*nome|null|undefined|n[ãa]o\s*informad[ao]|--)\s*$/i
    const desconhecidos = await Equipamento.find(
      {
        $or: [
          { fabricante: { $regex: padraoDesc } },
          { modelo: { $regex: padraoDesc } },
          { 'identificacao.fabricante_normalizado': { $in: [null, '', 'DESCONHECIDO'] } },
        ],
      },
      'tipo fabricante modelo qualidade.nivel qualidade.score_global'
    )
      .limit(50)
      .lean()

    // 8. Sem qualidade calculada (provavelmente ainda não passaram pelo backfill)
    const semQualidade = await Equipamento.countDocuments({
      $or: [
        { qualidade: { $exists: false } },
        { 'qualidade.nivel': null },
      ],
    })

    // Helper para transformar arrays em map { chave: valor }
    const aMap = (arr, k = '_id') => Object.fromEntries(arr.map(x => [x[k] ?? '(sem)', x.total]))

    res.json({
      sucesso: true,
      gerado_em: new Date(),
      totais: {
        equipamentos_total: scoresGerais[0]?.total || 0,
        por_tipo: aMap(totaisPorTipo),
        sem_qualidade_calculada: semQualidade,
      },
      distribuicao_nivel: aMap(distribuicaoNivel),
      cruzado_tipo_x_nivel: cruzadoTipoNivel.map(c => ({
        tipo:  c._id.tipo,
        nivel: c._id.nivel,
        total: c.total,
      })),
      scores: {
        geral: scoresGerais[0]
          ? {
              score_global_medio:     Number((scoresGerais[0].score_global_medio || 0).toFixed(1)),
              completude_score_medio: Number((scoresGerais[0].completude_score_medio || 0).toFixed(1)),
              confianca_score_medio:  Number((scoresGerais[0].confianca_score_medio || 0).toFixed(1)),
            }
          : null,
        por_tipo: scoresPorTipo.map(s => ({
          tipo: s._id,
          total: s.total,
          score_global_medio:     Number((s.score_global_medio || 0).toFixed(1)),
          completude_score_medio: Number((s.completude_score_medio || 0).toFixed(1)),
          confianca_score_medio:  Number((s.confianca_score_medio || 0).toFixed(1)),
        })),
      },
      top_alertas: topAlertas.map(a => ({
        codigo: a._id.codigo,
        severidade: a._id.severidade,
        ocorrencias: a.ocorrencias,
      })),
      invalidos_amostra: invalidos.map(e => ({
        _id: e._id,
        tipo: e.tipo,
        fabricante: e.fabricante,
        modelo: e.modelo,
        score_global: e.qualidade?.score_global ?? null,
        codigos_alerta: (e.qualidade?.alertas || [])
          .filter(a => a.severidade === 'critico' || a.severidade === 'alto')
          .map(a => a.codigo)
          .slice(0, 5),
      })),
      desconhecidos_amostra: desconhecidos.map(e => ({
        _id: e._id,
        tipo: e.tipo,
        fabricante: e.fabricante,
        modelo: e.modelo,
        nivel: e.qualidade?.nivel ?? null,
        score_global: e.qualidade?.score_global ?? null,
      })),
    })
  } catch (err) {
    console.error('[adminCatalogo] erro no relatório:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// ─── POST /api/admin/catalogo/reprocessar-todos ────────────────────────────
//
// Recalcula qualidade de todos os equipamentos sem triggering do pre-save hook.
// Usa processarEquipamento diretamente + updateOne para eficiência.
// Query param: ?tipo=modulo|inversor|... (opcional — filtra por tipo)
//              ?limite=500 (default 500 por execução)
//
router.post('/reprocessar-todos', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ sucesso: false, erro: 'MongoDB indisponível.' })
    }

    const tipo   = req.query.tipo  || null
    const limite = Math.min(parseInt(req.query.limite) || 500, 2000)
    const filtro = tipo ? { tipo } : {}

    const equipamentos = await Equipamento.find(filtro).lean().limit(limite)

    let processados = 0, erros = 0, semMudanca = 0
    const errosDetalhe = []

    for (const eq of equipamentos) {
      try {
        const resultado = processarEquipamento(eq, { tipoEvento: 'reprocessamento_manual' })

        const update = {
          $set: {
            specs_canonicas:    resultado.specs_canonicas,
            identificacao:      resultado.identificacao,
            qualidade:          resultado.qualidade,
            status_operacional: resultado.status_operacional,
          },
        }

        if (resultado.evento_historico) {
          update.$push = {
            'validacao.historico': {
              $each:     [resultado.evento_historico],
              $slice:    -50,   // mantém últimos 50 eventos
            },
          }
        }

        await Equipamento.updateOne({ _id: eq._id }, update)
        processados++
        if (!resultado.evento_historico) semMudanca++
      } catch (err) {
        erros++
        errosDetalhe.push({ id: eq._id?.toString(), erro: err.message })
      }
    }

    res.json({
      sucesso: true,
      total_encontrados: equipamentos.length,
      processados,
      sem_mudanca:       semMudanca,
      erros,
      erros_detalhe:     errosDetalhe.slice(0, 10),
      processado_em:     new Date(),
    })
  } catch (err) {
    console.error('[adminCatalogo] reprocessar-todos:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// ─── GET /api/admin/catalogo/duplicatas ──────────────────────────────────────
//
// Detecta equipamentos duplicados ou potencialmente duplicados.
//
//  1. Duplicatas EXATAS: mesmo hash_unico (tipo|fabricante_norm|modelo_norm)
//  2. Duplicatas PROVÁVEIS: mesmo tipo + fabricante normalizado + primeiro token
//     do modelo em comum (ex: "TSM 610 NEG21C" ≈ "TSM610NEG21C")
//
router.get('/duplicatas', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ sucesso: false, erro: 'MongoDB indisponível.' })
    }

    // ── 1. Duplicatas exatas por hash_unico ───────────────────────────────
    const exatas = await Equipamento.aggregate([
      {
        $match: {
          'identificacao.hash_unico': { $nin: [null, ''] },
          ativo: { $ne: false },
        },
      },
      {
        $group: {
          _id: '$identificacao.hash_unico',
          total: { $sum: 1 },
          docs: {
            $push: {
              _id:         '$_id',
              fabricante:  '$fabricante',
              modelo:      '$modelo',
              tipo:        '$tipo',
              nivel:       '$qualidade.nivel',
              score:       '$qualidade.score_global',
              origem:      '$origem.tipo',
              createdAt:   '$createdAt',
            },
          },
        },
      },
      { $match: { total: { $gt: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 100 },
    ])

    // ── 2. Prováveis: mesmo tipo + fabricante normalizado + prefixo modelo ─
    // Agrupa por (tipo, fabricante_normalizado) e retorna grupos com > 1 item
    // cujos modelos normalizados compartilham os primeiros 8 caracteres
    const prováveisAgg = await Equipamento.aggregate([
      {
        $match: {
          'identificacao.fabricante_normalizado': { $nin: [null, '', 'DESCONHECIDO'] },
          'identificacao.modelo_normalizado':     { $nin: [null, ''] },
          ativo: { $ne: false },
        },
      },
      {
        $project: {
          tipo:     1,
          fabricante: 1,
          modelo:   1,
          fab_norm: '$identificacao.fabricante_normalizado',
          mod_norm: '$identificacao.modelo_normalizado',
          hash:     '$identificacao.hash_unico',
          nivel:    '$qualidade.nivel',
          score:    '$qualidade.score_global',
          createdAt: 1,
          // Prefixo 8 chars do modelo normalizado
          mod_prefix: { $substr: ['$identificacao.modelo_normalizado', 0, 8] },
        },
      },
      {
        $group: {
          _id: { tipo: '$tipo', fab_norm: '$fab_norm', mod_prefix: '$mod_prefix' },
          total: { $sum: 1 },
          docs: {
            $push: {
              _id: '$_id', fabricante: '$fabricante', modelo: '$modelo',
              tipo: '$tipo', nivel: '$nivel', score: '$score',
              hash: '$hash', createdAt: '$createdAt',
            },
          },
        },
      },
      { $match: { total: { $gt: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 80 },
    ])

    // Filtra grupos da etapa 2 que NÃO são exatamente os mesmos da etapa 1
    const hashesExatos = new Set(exatas.map(e => e._id))
    const provaveis = prováveisAgg.filter(g => {
      const hashes = g.docs.map(d => d.hash).filter(Boolean)
      // Se todos os docs do grupo têm o mesmo hash → já está em exatas
      const uniqHashes = [...new Set(hashes)]
      return !(uniqHashes.length === 1 && hashesExatos.has(uniqHashes[0]))
    })

    res.json({
      sucesso: true,
      gerado_em: new Date(),
      resumo: {
        grupos_exatos:    exatas.length,
        grupos_provaveis: provaveis.length,
        total_suspeitos:  exatas.length + provaveis.length,
      },
      duplicatas_exatas:    exatas,
      duplicatas_provaveis: provaveis,
    })
  } catch (err) {
    console.error('[adminCatalogo] duplicatas:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// ─── GET /api/admin/catalogo/equipamento/:id/qualidade ───────────────────────
// Reprocessa qualidade de UM equipamento e retorna o resultado
router.post('/reprocessar/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ sucesso: false, erro: 'MongoDB indisponível.' })
    }
    const eq = await Equipamento.findById(req.params.id).lean()
    if (!eq) return res.status(404).json({ sucesso: false, erro: 'Equipamento não encontrado.' })

    const resultado = processarEquipamento(eq, { tipoEvento: 'reprocessamento_manual' })
    const update = {
      $set: {
        specs_canonicas: resultado.specs_canonicas,
        identificacao:   resultado.identificacao,
        qualidade:       resultado.qualidade,
        status_operacional: resultado.status_operacional,
      },
    }
    if (resultado.evento_historico) {
      update.$push = { 'validacao.historico': { $each: [resultado.evento_historico], $slice: -50 } }
    }
    await Equipamento.updateOne({ _id: eq._id }, update)

    res.json({ sucesso: true, qualidade: resultado.qualidade, identificacao: resultado.identificacao })
  } catch (err) {
    console.error('[adminCatalogo] reprocessar/:id:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// S8.0 — INTELIGÊNCIA DE INGESTÃO + REVISÃO HUMANA + LOTE + LIMPEZA
// ═══════════════════════════════════════════════════════════════════════════════

// POST /analisar — analisa datasheet (IA) e devolve campos para REVISÃO HUMANA
// (não salva nada). multipart: campo 'pdf'; query/body: tipo
router.post('/analisar', uploadDS.single('pdf'), async (req, res) => {
  try {
    const tipo = req.body?.tipo || req.query?.tipo || 'auto'
    if (!req.file) return res.status(400).json({ sucesso: false, erro: 'Envie o datasheet no campo "pdf".' })
    const resultado = await ingerir({ buffer: req.file.buffer, tipo })
    // S8.0.1: devolve o datasheet original (hash + base64) p/ persistir na aprovação
    const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
    const datasheet_original = {
      nome: req.file.originalname || 'datasheet.pdf',
      hash, data_upload: new Date(), origem: 'upload_revisao',
      conteudo_base64: req.file.buffer.length <= 8 * 1024 * 1024
        ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null,
    }
    await _auditCatalogo(req, 'analise_ia', `${resultado.tipo} · ${Object.keys(resultado.campos).length} campos · conf ${resultado.confianca_global}`)
    res.json({ sucesso: true, ...resultado, datasheet_original, revisao_humana: true })
  } catch (err) {
    console.error('[adminCatalogo] analisar:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// PATCH /equipamento/:id — edição manual com antes/depois + fonte=Manual + reprocess
router.patch('/equipamento/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ sucesso: false, erro: 'DB_OFFLINE' })
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ sucesso: false, erro: 'ID inválido' })
    const { campos = {}, usuario = null, datasheet_original = null, certificacao = null } = req.body || {}

    const eq = await Equipamento.findById(id)
    if (!eq) return res.status(404).json({ sucesso: false, erro: 'Equipamento não encontrado' })
    // S8.0.1: anexa/atualiza o datasheet original (dedupe por hash)
    if (datasheet_original && datasheet_original.hash && eq.datasheet_original?.hash !== datasheet_original.hash) {
      eq.datasheet_original = datasheet_original
      eq.markModified('datasheet_original')
    }
    // S8.0.2: certificação (INMETRO / normas IEC)
    if (certificacao && typeof certificacao === 'object') {
      eq.certificacao = { ...(eq.certificacao || {}), ...certificacao }
      eq.markModified('certificacao')
    }

    const antes = {}
    const depois = {}
    // Campos de topo permitidos + especificacoes.*
    const TOPO = ['fabricante', 'modelo', 'tipo']
    for (const [k, v] of Object.entries(campos)) {
      if (TOPO.includes(k)) { antes[k] = eq[k]; eq[k] = v; depois[k] = v }
      else { // vai para especificacoes
        eq.especificacoes = eq.especificacoes || {}
        antes[`especificacoes.${k}`] = eq.especificacoes[k]
        eq.especificacoes[k] = v
        depois[`especificacoes.${k}`] = v
      }
    }
    eq.markModified('especificacoes')

    // Marca proveniência manual dos campos alterados
    eq.fonte_dados = eq.fonte_dados || {}
    for (const k of Object.keys(campos)) eq.fonte_dados[k] = { fonte: 'Manual', em: new Date(), por: usuario }
    eq.markModified('fonte_dados')

    // Reprocessa qualidade após edição
    const resultado = processarEquipamento(eq.toObject(), { tipoEvento: 'edicao_manual' })
    eq.specs_canonicas = resultado.specs_canonicas
    eq.identificacao = resultado.identificacao
    eq.qualidade = resultado.qualidade
    eq.status_operacional = resultado.status_operacional
    // S8.0.1: liberação para engenharia
    const av = avaliarUtilizavel(eq.tipo, eq.especificacoes)
    eq.utilizavel_em_projeto = av.utilizavel
    eq.bloqueio_engenharia = av.faltando
    await eq.save()

    await _auditCatalogo(req, 'edicao_manual', `${eq.fabricante} ${eq.modelo} — ${Object.keys(campos).join(', ')}`)
    res.json({ sucesso: true, equipamento: eq, alteracoes: { antes, depois }, qualidade: resultado.qualidade })
  } catch (err) {
    console.error('[adminCatalogo] edicao manual:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// POST /lote — ações em lote: reprocessar | validar | excluir
router.post('/lote', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ sucesso: false, erro: 'DB_OFFLINE' })
    const { ids = [], acao } = req.body || {}
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ sucesso: false, erro: 'ids vazio' })
    if (!['reprocessar', 'validar', 'excluir'].includes(acao)) return res.status(400).json({ sucesso: false, erro: 'acao inválida' })
    const validos = ids.filter(i => mongoose.Types.ObjectId.isValid(i))

    let afetados = 0
    if (acao === 'excluir') {
      const r = await Equipamento.deleteMany({ _id: { $in: validos } })
      afetados = r.deletedCount
    } else {
      const eqs = await Equipamento.find({ _id: { $in: validos } }).lean()
      for (const eq of eqs) {
        const resultado = processarEquipamento(eq, { tipoEvento: acao === 'validar' ? 'validacao_lote' : 'reprocessamento_lote' })
        const update = { $set: { specs_canonicas: resultado.specs_canonicas, identificacao: resultado.identificacao, qualidade: resultado.qualidade, status_operacional: resultado.status_operacional } }
        await Equipamento.updateOne({ _id: eq._id }, update)
        afetados++
      }
    }
    await _auditCatalogo(req, `lote_${acao}`, `${afetados} equipamento(s)`)
    res.json({ sucesso: true, acao, afetados })
  } catch (err) {
    console.error('[adminCatalogo] lote:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// DELETE /por-status — limpeza segura. Body: { status:[...], confirmarAprovados }
router.delete('/por-status', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ sucesso: false, erro: 'DB_OFFLINE' })
    const { status = [], confirmarAprovados = false } = req.body || {}
    const PERMITIDOS = ['invalido', 'suspeito', 'incompleto', 'validado', 'utilizavel']
    const alvos = status.filter(s => PERMITIDOS.includes(s))
    if (alvos.length === 0) return res.status(400).json({ sucesso: false, erro: 'Informe status válidos.' })

    // Proteção: aprovados (validado/utilizavel) só com confirmação dupla
    const incluiAprovados = alvos.some(s => ['validado', 'utilizavel'].includes(s))
    if (incluiAprovados && !confirmarAprovados) {
      return res.status(409).json({ sucesso: false, codigo: 'CONFIRMAR_APROVADOS', erro: 'Exclusão de aprovados requer confirmação dupla (confirmarAprovados=true).' })
    }
    const r = await Equipamento.deleteMany({ 'qualidade.nivel': { $in: alvos } })
    await _auditCatalogo(req, 'limpeza_por_status', `${r.deletedCount} excluídos (${alvos.join(',')})`)
    res.json({ sucesso: true, excluidos: r.deletedCount, status: alvos })
  } catch (err) {
    console.error('[adminCatalogo] por-status:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// POST /completar-ia/:id — reanalisa o datasheet salvo e devolve SOMENTE os campos
// vazios (revisão humana). Nunca sobrescreve dado manual aprovado.
router.post('/completar-ia/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ sucesso: false, erro: 'DB_OFFLINE' })
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ sucesso: false, erro: 'ID inválido' })
    const eq = await Equipamento.findById(id)
    if (!eq) return res.status(404).json({ sucesso: false, erro: 'Equipamento não encontrado' })

    const b64 = eq.datasheet_original?.conteudo_base64
    if (!b64) return res.status(409).json({ sucesso: false, codigo: 'SEM_DATASHEET', erro: 'Sem datasheet original salvo para reprocessar.' })

    const buffer = Buffer.from(String(b64).split(',').pop(), 'base64')
    const resultado = await ingerir({ buffer, tipo: eq.tipo, fabricante: eq.fabricante, modelo: eq.modelo })

    // Mantém o que já existe (manual/aprovado); sugere apenas para campos vazios
    const esp = eq.especificacoes || {}
    const fonteDados = eq.fonte_dados || {}
    const sugestoes = {}
    for (const [k, v] of Object.entries(resultado.campos)) {
      const ehManual = fonteDados[k]?.fonte === 'Manual'
      const vazio = esp[k] == null || esp[k] === ''
      if (!ehManual && vazio) sugestoes[k] = v   // {valor,fonte,confianca}
    }
    await _auditCatalogo(req, 'completar_ia', `${eq.fabricante} ${eq.modelo} — ${Object.keys(sugestoes).length} sugestão(ões)`)
    res.json({ sucesso: true, tipo: resultado.tipo, sugestoes, faltantes: resultado.faltantes, revisao_humana: true })
  } catch (err) {
    console.error('[adminCatalogo] completar-ia:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// POST /equipamento/:id/documento — anexa documento técnico (otimizado + dedupe)
router.post('/equipamento/:id/documento', uploadDS.single('arquivo'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ sucesso: false, erro: 'DB_OFFLINE' })
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ sucesso: false, erro: 'ID inválido' })
    const eq = await Equipamento.findById(id)
    if (!eq) return res.status(404).json({ sucesso: false, erro: 'Equipamento não encontrado' })

    const { tipo = 'datasheet', validade = null, modelo_relacionado = null } = req.body || {}
    if (!req.file) return res.status(400).json({ sucesso: false, erro: 'Envie o arquivo no campo "arquivo".' })

    const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
    eq.documentos_tecnicos = Array.isArray(eq.documentos_tecnicos) ? eq.documentos_tecnicos : []
    if (eq.documentos_tecnicos.some(d => d.hash === hash)) {
      return res.status(409).json({ sucesso: false, codigo: 'DUPLICADO', erro: 'Documento idêntico já anexado.' })
    }

    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    const otim = otimizarDocumento(dataUrl, { nome: req.file.originalname })

    eq.documentos_tecnicos.push({
      tipo, nome: req.file.originalname, hash, data_upload: new Date(), origem: 'upload',
      validade: validade ? new Date(validade) : null, modelo_relacionado,
      conteudo_base64: otim.conteudo,
      tamanho_original: otim.tamanho_original, tamanho_final: otim.tamanho_final,
      reducao_pct: otim.reducao_pct, dpi_final: otim.dpi_final,
    })
    eq.markModified('documentos_tecnicos')
    await eq.save()
    await _auditCatalogo(req, 'upload_documento', `${eq.fabricante} ${eq.modelo} — ${tipo}/${req.file.originalname}`)
    res.json({ sucesso: true, documento: { tipo, nome: req.file.originalname, hash, otimizacao: otim }, total: eq.documentos_tecnicos.length })
  } catch (err) {
    console.error('[adminCatalogo] documento:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// POST /documento-enterprise — upload com dedup GLOBAL + assinatura + storage (S8.2)
router.post('/documento-enterprise', uploadDS.single('arquivo'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ sucesso: false, erro: 'DB_OFFLINE' })
    if (!req.file) return res.status(400).json({ sucesso: false, erro: 'Envie o arquivo no campo "arquivo".' })
    const { tipo = 'datasheet', fabricante = null, modelo = null } = req.body || {}
    const buffer = req.file.buffer
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')

    // Dedup global: mesmo arquivo → reaproveita o documento existente
    let doc = await DocumentoTecnico.findOne({ hash_sha256: hash })
    if (doc) {
      await _auditCatalogo(req, 'UPLOAD_DOCUMENTO', `dedup ${tipo}/${req.file.originalname} (ref existente)`)
      return res.json({ sucesso: true, deduplicado: true, documento: doc })
    }

    // Assinatura digital → preserva binário (não recomprime)
    const assinatura = detectarAssinatura(buffer)
    const dataUrl = `data:${req.file.mimetype};base64,${buffer.toString('base64')}`
    let otim
    if (assinatura.assinado) {
      otim = { conteudo: dataUrl, tamanho_original: buffer.length, tamanho_final: buffer.length, reducao_pct: 0, dpi_final: null }
      await _auditCatalogo(req, 'DOCUMENTO_PRESERVADO_ASSINATURA', `${req.file.originalname} (${assinatura.tipo})`)
    } else {
      otim = otimizarDocumento(dataUrl, { nome: req.file.originalname })
      await _auditCatalogo(req, 'DOCUMENTO_OTIMIZADO', `${req.file.originalname} ${otim.reducao_pct}%`)
    }

    const { url_storage, provider } = await salvarStorage({ hash, mimetype: req.file.mimetype, dataUrl: otim.conteudo, nome: req.file.originalname })

    doc = await DocumentoTecnico.create({
      tipo, fabricante, modelo, nome: req.file.originalname, hash_sha256: hash,
      url_storage, storage_provider: provider,
      tamanho_original: otim.tamanho_original, tamanho_final: otim.tamanho_final,
      economia_pct: otim.reducao_pct, dpi_final: otim.dpi_final,
      documento_assinado: assinatura.assinado, otimizacao_pulada: assinatura.assinado,
      motivo_preservacao: assinatura.assinado ? 'Preservada validade jurídica' : null,
    })
    res.json({ sucesso: true, deduplicado: false, assinatura, documento: doc })
  } catch (err) {
    console.error('[adminCatalogo] documento-enterprise:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// POST /analisar-documento — Gemini interpreta certificado/manual (revisão humana)
router.post('/analisar-documento', uploadDS.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ sucesso: false, erro: 'Envie o arquivo no campo "arquivo".' })
    const resultado = await analisarDocumentoTecnico(req.file.buffer)
    await _auditCatalogo(req, 'ANALISE_CERTIFICADO', `${resultado.tipo} · ${resultado.modelos_mapeados.length} modelo(s)`)
    res.json({ sucesso: true, ...resultado })
  } catch (err) {
    console.error('[adminCatalogo] analisar-documento:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// GET /equipamento/:id/pacote-homologacao + /status-documental
router.get('/equipamento/:id/status-documental', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ sucesso: false, erro: 'DB_OFFLINE' })
    const eq = await Equipamento.findById(req.params.id).lean()
    if (!eq) return res.status(404).json({ sucesso: false, erro: 'Não encontrado' })
    res.json({ sucesso: true, status_documental: statusDocumental(eq), homologacao: obterDocumentosHomologacao(eq) })
  } catch (err) { res.status(500).json({ sucesso: false, erro: err.message }) }
})

// GET /health-check — diagnóstico técnico do catálogo (S8.1.1)
router.get('/health-check', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ sucesso: false, erro: 'DB_OFFLINE' })
    const eqs = await Equipamento.find({ ativo: { $ne: false } })
      .select('tipo utilizavel_em_projeto bloqueio_engenharia certificacao').lean()
    const total = eqs.length
    const liberados = eqs.filter(e => e.utilizavel_em_projeto !== false).length
    const bloqueados = total - liberados
    // Motivos agregados
    const motivos = {}
    for (const e of eqs) {
      for (const m of (e.bloqueio_engenharia || [])) motivos[m] = (motivos[m] || 0) + 1
      if (e.tipo === 'inversor' && !e.certificacao?.inmetro?.numero &&
          !(Array.isArray(e.certificacao?.normas_iec) && e.certificacao.normas_iec.length))
        motivos['Sem INMETRO/IEC'] = (motivos['Sem INMETRO/IEC'] || 0) + 1
    }
    res.json({ sucesso: true, total, liberados_engenharia: liberados, bloqueados, motivos })
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// GET /equipamento/:id/homologacao — documentos exigidos p/ homologação (preparação)
router.get('/equipamento/:id/homologacao', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ sucesso: false, erro: 'DB_OFFLINE' })
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ sucesso: false, erro: 'ID inválido' })
    const eq = await Equipamento.findById(id).lean()
    if (!eq) return res.status(404).json({ sucesso: false, erro: 'Equipamento não encontrado' })
    res.json({ sucesso: true, homologacao: obterDocumentosHomologacao(eq) })
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

export default router
