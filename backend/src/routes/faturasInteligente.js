import { Router } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import { PDFParse } from 'pdf-parse'
import { FaturaEnergia } from '../models/FaturaEnergia.js'
import { AuditLog } from '../models/AuditLog.js'
import { CONCESSIONARIAS_SUPORTADAS } from '../utils/fatura/concessionariaDetector.js'
import { montarFaturaInteligente } from '../services/faturaIntelligenceService.js'
import { detectarDuplicidade } from '../utils/fatura/faturaValidador.js'
import { gerarDashboardEnergetico } from '../utils/fatura/analisadorEnergetico.js'

/**
 * Rotas /api/faturas — Sprint 8.5 (camada de inteligência sobre faturas).
 * Não substitui /api/fatura/extrair (fluxo legado preservado).
 *
 *   GET  /api/faturas                     → lista (revisao pendente primeiro)
 *   GET  /api/faturas/concessionarias    → catálogo de concessionárias suportadas
 *   GET  /api/faturas/:id                 → detalhe normalizado
 *   POST /api/faturas/analisar            → upload PDF | texto | gemini → normalizado
 *   PUT  /api/faturas/:id/campo           → correção manual (caminho + valor, audit DELTA)
 *   POST /api/faturas/:id/aprovar         → revisada/aprovada → cria Cliente (sem duplicar)
 */
const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

function _dbOk(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    return false
  }
  return true
}

async function auditar(req, acao, alvo, detalhe = null) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(), usuario: req.auth?.id || req.auth?.email || 'anonymous',
      perfil: req.auth?.perfil || null, empresa: req.auth?.empresa_id || null,
      modulo: 'fv', acao, metodo: 'EVENT',
      path: `fatura:${alvo}${detalhe ? ' ' + String(detalhe).slice(0, 200) : ''}`, status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
}

router.get('/concessionarias', (_req, res) => {
  res.json({ sucesso: true, concessionarias: CONCESSIONARIAS_SUPORTADAS })
})

router.get('/', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const filtro = {}
    if (req.query.status) filtro.status_revisao = req.query.status
    const itens = await FaturaEnergia.find(filtro).sort({ status_revisao: 1, createdAt: -1 }).limit(200)
    res.json({ sucesso: true, itens })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ erro: 'ID inválido' })
    const f = await FaturaEnergia.findById(req.params.id)
    if (!f) return res.status(404).json({ erro: 'Fatura não encontrada' })
    res.json({ sucesso: true, item: f })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

/**
 * S8.9 — GET /:id/analise
 * Dashboard energético completo (Grupo A, tarifação, GD, sazonalidade,
 * consistência) computado a partir da FaturaEnergia persistida.
 */
router.get('/:id/analise', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ erro: 'ID inválido' })
    const f = await FaturaEnergia.findById(req.params.id).lean()
    if (!f) return res.status(404).json({ erro: 'Fatura não encontrada' })
    const dashboard = gerarDashboardEnergetico(f)
    res.json({ sucesso: true, fatura_id: f._id, dashboard })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

/**
 * S8.9 — POST /analise — análise sem persistir (a partir de uma fatura JSON).
 * Body: { fatura } — estrutura já normalizada (output de parsearFatura).
 */
router.post('/analise', async (req, res) => {
  try {
    const { fatura } = req.body || {}
    if (!fatura) return res.status(400).json({ erro: 'Forneça `fatura` no body.' })
    const dashboard = gerarDashboardEnergetico(fatura)
    res.json({ sucesso: true, dashboard })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

/**
 * Analisar: aceita PDF (multipart `pdf`), `texto` ou `gemini` no body.
 * Pelo menos um caminho de entrada é obrigatório. Sempre devolve estrutura
 * normalizada; persiste se Mongo estiver disponível.
 */
router.post('/analisar', upload.single('pdf'), async (req, res) => {
  try {
    let texto = req.body?.texto || ''
    let arquivoNome = req.body?.arquivo_nome || null

    if (req.file) {
      arquivoNome = req.file.originalname
      try {
        const parser = new PDFParse({ data: req.file.buffer })
        const r = await parser.getText()
        await parser.destroy()
        texto = (r.text || '').toString()
      } catch (err) {
        return res.status(400).json({ erro: `Falha ao ler PDF: ${err.message}` })
      }
    }

    let gemini = null
    if (req.body?.gemini) {
      try { gemini = typeof req.body.gemini === 'string' ? JSON.parse(req.body.gemini) : req.body.gemini }
      catch { /* ignora */ }
    }
    if (!texto && !gemini) return res.status(400).json({ erro: 'Forneça PDF, texto ou gemini.' })

    const normalizada = montarFaturaInteligente({ texto, gemini, fonte: req.file ? 'PDF' : (gemini ? 'Gemini' : 'TEXTO') })

    // Persiste se DB disponível
    let salvo = null
    if (mongoose.connection.readyState === 1) {
      salvo = await FaturaEnergia.create({
        origem: { tipo: req.file ? 'PDF' : 'TEXTO', arquivo_nome: arquivoNome, importado_por: req.auth?.id || null },
        concessionaria_detectada: normalizada.concessionaria_detectada,
        cliente: normalizada.cliente,
        unidade_consumidora: normalizada.unidade_consumidora,
        classificacao: normalizada.classificacao,
        ligacao: normalizada.ligacao,
        historico_consumo: normalizada.historico_consumo,
        analise: normalizada.analise,
        grupo_a: normalizada.grupo_a,
        geracao_existente: normalizada.geracao_existente,
        consumo_atual_kwh: normalizada.consumo_atual_kwh,
        flags: normalizada.flags,
        alertas: normalizada.alertas,
        necessita_revisao: normalizada.necessita_revisao,
        status_revisao: normalizada.status_revisao,
        empresa_id: req.auth?.empresa_id || null,
      })
      auditar(req, 'FATURA_IMPORTADA', salvo._id, `${normalizada.concessionaria_detectada.concessionaria} | ${arquivoNome || 'texto'}`)
      auditar(req, 'FATURA_PROCESSADA', salvo._id, `alertas=${normalizada.alertas.length} revisao=${normalizada.necessita_revisao}`)
    }

    res.status(salvo ? 201 : 200).json({ sucesso: true, fatura: salvo || normalizada, persistida: !!salvo })
  } catch (err) {
    console.error('[faturas] analisar:', err)
    res.status(500).json({ erro: err.message })
  }
})

/**
 * PUT /api/faturas/:id/campo — correção manual (caminho + valor).
 * Body: { caminho: 'cliente.nome', valor: 'João', usuario? }
 * Audita CAMPO_CORRIGIDO_MANUAL com {antes, depois}.
 */
router.put('/:id/campo', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { caminho, valor } = req.body || {}
    if (!caminho) return res.status(400).json({ erro: 'caminho obrigatório (ex.: cliente.nome).' })
    const f = await FaturaEnergia.findById(req.params.id)
    if (!f) return res.status(404).json({ erro: 'Fatura não encontrada' })

    // navega até o pai do campo
    const partes = caminho.split('.')
    let cursor = f
    for (let i = 0; i < partes.length - 1; i++) {
      const k = partes[i]
      if (cursor[k] == null || typeof cursor[k] !== 'object') cursor[k] = {}
      cursor = cursor[k]
    }
    const ultimo = partes[partes.length - 1]
    const antes = cursor[ultimo]
    cursor[ultimo] = { valor, fonte: 'Manual', confianca: 1 }
    f.markModified(partes[0])

    await f.save()
    auditar(req, 'CAMPO_CORRIGIDO_MANUAL', f._id, `${caminho}: ${JSON.stringify(antes?.valor ?? null)} → ${JSON.stringify(valor)}`)
    res.json({ sucesso: true, item: f })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

/**
 * POST /api/faturas/:id/aprovar — cria Cliente se ainda não existir (sem duplicar
 * por CPF/CNPJ ou UC). NÃO cria ProjetoFV automaticamente (operador inicia).
 */
router.post('/:id/aprovar', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const f = await FaturaEnergia.findById(req.params.id)
    if (!f) return res.status(404).json({ erro: 'Fatura não encontrada' })

    // Verifica duplicidade com faturas previamente aprovadas
    const ucAtual = f.unidade_consumidora?.numero_uc?.valor
    if (ucAtual) {
      const conflito = await FaturaEnergia.findOne({
        _id: { $ne: f._id }, status_revisao: 'aprovada',
        'unidade_consumidora.numero_uc.valor': ucAtual,
      })
      if (conflito) {
        return res.status(409).json({
          erro: `UC ${ucAtual} já foi importada (fatura ${conflito._id}). Confirme antes de duplicar.`,
        })
      }
    }

    // Cria Cliente — opcional (controlado pelo body)
    let clienteId = null
    if (req.body?.criar_cliente !== false) {
      try {
        const { Cliente } = await import('../models/Cliente.js')
        const cpf = f.cliente?.cpf_cnpj?.valor
        let cliente = null
        if (cpf) cliente = await Cliente.findOne({ cpf_cnpj: cpf })
        if (!cliente) {
          cliente = await Cliente.create({
            nome:      f.cliente?.nome?.valor || 'Importado',
            cpf_cnpj:  cpf || null,
            email:     null,
            telefone:  null,
            endereco:  f.cliente?.endereco?.valor || null,
            cidade:    f.cliente?.cidade?.valor || null,
            uf:        f.cliente?.uf?.valor || null,
            cep:       f.cliente?.cep?.valor || null,
          })
        }
        clienteId = cliente?._id || null
      } catch (e) {
        // Se o model Cliente tiver outro shape, registra o pulo mas não falha aprovação
        console.warn('[faturas] aprovar — Cliente não criado:', e.message)
      }
    }

    f.status_revisao = 'aprovada'
    f.necessita_revisao = false
    f.revisado_por = req.auth?.id || req.auth?.email || req.body?.usuario || null
    f.revisado_em = new Date()
    if (clienteId) f.cliente_id = clienteId
    await f.save()
    auditar(req, 'FATURA_APROVADA', f._id, `cliente=${clienteId || '—'}`)
    res.json({ sucesso: true, item: f, cliente_id: clienteId })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

export default router
