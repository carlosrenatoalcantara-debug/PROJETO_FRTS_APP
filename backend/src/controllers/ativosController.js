/**
 * ativosController.js — P1-ASSET-CORE-01 (FASE 5)
 * CRUD do Gêmeo Digital + geração a partir de projeto. Backend apenas (sem telas).
 */
import mongoose from 'mongoose'
import QRCode from 'qrcode'
import { AtivoEquipamento } from '../models/AtivoEquipamento.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { Equipamento } from '../models/Equipamento.js'
import { gerarAtivosProjeto, gerarQrCode } from '../services/ativoService.js'
import { criptografar, descriptografar } from '../services/ativoSeguranca.js'
import { parseEtiqueta } from '../services/etiquetaParser.js'

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

// ─── P1-ASSET-QR-CODE-01 ─────────────────────────────────────────────────────
// GET /api/ativos/qr/:qr  — consulta por QR: Ativo → Projeto → Arranjo → Equipamento.
// SOMENTE LEITURA de ProjetoFV/Atlas/arranjos (não altera nada).
export const consultarPorQr = async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const qr = String(req.params.qr || '').trim().toUpperCase()
    const ativo = await AtivoEquipamento.findOne({ qr_code: qr }).lean()
    if (!ativo) return res.status(404).json({ erro: 'QR não encontrado', qr_code: qr })

    const projeto = ativo.projeto_id
      ? await ProjetoFV.findById(ativo.projeto_id, 'nome cliente cliente_nome arranjos status_migracao').lean()
      : null
    // Arranjo correspondente (preserva multiarranjo) — lido de ProjetoFV.arranjos[]
    const arranjo = (projeto && ativo.arranjo_id)
      ? (projeto.arranjos || []).find(a => a.id === ativo.arranjo_id) || null
      : null
    const equipamento = ativo.equipamento_id
      ? await Equipamento.findById(ativo.equipamento_id, 'fabricante modelo tipo especificacoes qualidade.nivel').lean()
      : null

    res.json({
      sucesso: true,
      qr_code: qr,
      ativo: {
        _id: ativo._id, tipo: ativo.tipo, fabricante: ativo.fabricante, modelo: ativo.modelo,
        numero_serie: ativo.numero_serie, quantidade: ativo.quantidade, status: ativo.status,
        arranjo_id: ativo.arranjo_id,
        data_instalacao: ativo.data_instalacao, garantia_inicio: ativo.garantia_inicio,
        garantia_fim: ativo.garantia_fim, topologia: ativo.topologia, localizacao: ativo.localizacao,
        // P1-ASSET-COMMISSIONING-01 — dados as-built (senha_wifi NUNCA exposta)
        data_comissionamento: ativo.data_comissionamento, comissionado_por: ativo.comissionado_por,
        conectividade: {
          mac_wifi: ativo.conectividade?.mac_wifi ?? null,
          wifi_ssid: ativo.conectividade?.wifi_ssid ?? null,
          firmware: ativo.conectividade?.firmware ?? null,
          endereco_ip: ativo.conectividade?.endereco_ip ?? null,
          senha_definida: !!ativo.conectividade?.senha_wifi,   // só indica se há senha; não revela
        },
        historico: ativo.historico || [],
      },
      projeto: projeto ? { _id: projeto._id, nome: projeto.nome, cliente: projeto.cliente?.nome || projeto.cliente_nome || null } : null,
      // Arranjo: do ProjetoFV.arranjos[] quando existir; senão expõe o arranjo_id do ativo
      // (linkage multiarranjo preservado no Gêmeo Digital mesmo em projeto legado single-arranjo).
      arranjo: arranjo
        ? { id: arranjo.id, rotulo: arranjo.rotulo, tipo: arranjo.tipo, topologia: arranjo.topologia, origem: arranjo.origem, fonte: 'projeto.arranjos' }
        : (ativo.arranjo_id ? { id: ativo.arranjo_id, rotulo: null, tipo: null, topologia: ativo.topologia, origem: 'ativo', fonte: 'ativo.arranjo_id' } : null),
      total_arranjos_projeto: (projeto?.arranjos || []).length,
      equipamento_catalogo: equipamento || null,
    })
  } catch (e) { res.status(500).json({ erro: e.message }) }
}

// GET /api/ativos/qr/:qr/render.svg  — QR padrão (scannable) que aponta para a página do ativo.
export const renderQrSvg = async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const qr = String(req.params.qr || '').trim().toUpperCase()
    const ativo = await AtivoEquipamento.findOne({ qr_code: qr }, '_id qr_code').lean()
    if (!ativo) return res.status(404).json({ erro: 'QR não encontrado' })
    const base = (process.env.APP_URL || '').replace(/\/$/, '')
    const payload = base ? `${base}/ativo/${qr}` : qr   // scaneável: abre a página; fallback = código
    const svg = await QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', width: 240 })
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(svg)
  } catch (e) { res.status(500).json({ erro: e.message }) }
}

// POST /api/ativos/qr/:qr/comissionar — registra dados reais do equipamento instalado.
// SOMENTE AtivoEquipamento (não toca Atlas/ProjetoFV). Registra diffs no histórico.
// Mapeamento campo da sprint → caminho no modelo:
const MAP_COMISSIONAMENTO = {
  numero_serie:  'numero_serie',
  mac_address:   'conectividade.mac_wifi',
  firmware:      'conectividade.firmware',
  ip_local:      'conectividade.endereco_ip',
  wifi_ssid:     'conectividade.wifi_ssid',
  wifi_senha:    'conectividade.senha_wifi',
}
const _get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o)
const _set = (o, p, v) => { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { a[ks[i]] = a[ks[i]] || {}; a = a[ks[i]] } a[ks[ks.length - 1]] = v }
const _sensivel = (campo) => campo === 'wifi_senha'

export const comissionarPorQr = async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const qr = String(req.params.qr || '').trim().toUpperCase()
    const ativo = await AtivoEquipamento.findOne({ qr_code: qr })
    if (!ativo) return res.status(404).json({ erro: 'QR não encontrado', qr_code: qr })

    const body = req.body || {}
    const por = body.comissionado_por || req.auth?.email || 'campo'
    const alteracoes = []

    for (const [campoSprint, caminho] of Object.entries(MAP_COMISSIONAMENTO)) {
      if (!(campoSprint in body)) continue
      const novo = body[campoSprint] === '' ? null : body[campoSprint]
      const armazenado = _get(ativo, caminho) ?? null
      if (_sensivel(campoSprint)) {
        // SENSÍVEL: compara em claro (descriptografa o armazenado) e PERSISTE CRIPTOGRAFADO
        const antigoPlano = descriptografar(armazenado, ativo._id)
        if (String(antigoPlano ?? '') === String(novo ?? '')) continue   // sem mudança
        _set(ativo, caminho, novo == null ? null : criptografar(novo, ativo._id))
        alteracoes.push({ campo: campoSprint, de: antigoPlano ? '••••••' : null, para: novo ? '••••••' : null })
      } else {
        if (String(armazenado ?? '') === String(novo ?? '')) continue   // sem mudança → ignora
        _set(ativo, caminho, novo)
        alteracoes.push({ campo: campoSprint, de: armazenado, para: novo })
      }
    }

    if (alteracoes.length === 0 && !body.forcar) {
      return res.status(200).json({ sucesso: true, sem_mudanca: true, qr_code: qr })
    }

    ativo.markModified('conectividade')
    ativo.data_comissionamento = body.data_comissionamento ? new Date(body.data_comissionamento) : new Date()
    ativo.comissionado_por = por

    // Avança o ciclo de vida no primeiro comissionamento (planejado → instalado), registrando.
    const status_de = ativo.status
    let status_para = status_de
    if (status_de === 'planejado') { ativo.status = 'instalado'; status_para = 'instalado' }

    ativo.historico.push({
      tipo: 'comissionamento', data: new Date(), usuario: por,
      descricao: `Comissionamento — ${alteracoes.length} campo(s) registrado(s)`,
      status_de, status_para,
      alteracoes,
    })

    await ativo.save()
    const obj = ativo.toObject()
    if (obj.conectividade) obj.conectividade.senha_wifi = obj.conectividade.senha_wifi ? '••••••' : null  // nunca devolve a senha em claro
    res.json({ sucesso: true, qr_code: qr, alteracoes_registradas: alteracoes.length, status: ativo.status, item: obj })
  } catch (e) { res.status(400).json({ erro: e.message }) }
}

// POST /api/ativos/scan — P1-COMMISSIONING-SCAN-01
// Extrai serial/MAC/SSID/senha de um QR (body.texto) ou de uma FOTO da etiqueta (campo "foto", OCR).
// Pura extração: NÃO grava nada (o salvar é o /comissionar). Não toca Atlas/ProjetoFV.
export const scanEtiqueta = async (req, res) => {
  try {
    let texto = (req.body?.texto || '').toString()
    let fonte = texto ? 'qr' : null
    if (!texto && req.file) {
      const mod = await import('tesseract.js'); const Tesseract = mod.default ?? mod
      const { data } = await Tesseract.recognize(req.file.buffer, 'por+eng')
      texto = data?.text || ''
      fonte = 'ocr'
    }
    if (!texto.trim()) return res.status(400).json({ erro: 'Envie {texto} (QR) ou uma foto no campo "foto".' })
    const r = parseEtiqueta(texto, { fabricante: req.body?.fabricante })
    res.json({ sucesso: true, fonte, campos: r.campos, confianca: r.confianca, texto_bruto: r.texto_normalizado.slice(0, 500) })
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
