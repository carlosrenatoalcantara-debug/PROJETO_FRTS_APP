import { Equipamento } from '../models/Equipamento.js'
import { CarregadorEV } from '../models/CarregadorEV.js'
import { PDFParse } from 'pdf-parse'
import multer from 'multer'
import mongoose from 'mongoose'
import { memoryStore } from '../config/memoryStorage.js'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
// CAT-P0-UNIFY: normalização de tipo + feature flags
import { normalizarTipo, ehCarregadorEV } from '../utils/catalogo/tipoEquipamento.js'
import { catalogoFlags } from '../config/catalogoFlags.js'

const usarMemoryStorage = () => mongoose.connection.readyState !== 1

// P1-CATALOG-PROVENANCE-01: rastreabilidade de origem na CRIAÇÃO de equipamentos.
// Valores aceitos (espelham OrigemSchema/Equipamento). O frontend pode enviar
// `origem.tipo` (ex.: datasheet) ao salvar; sem hint, o POST/lote é uma ação
// HUMANA no catálogo → 'manual' (evidência da ação, não chute). Antes este campo
// nunca era setado e o hook de qualidade defaultava tudo p/ 'desconhecido'.
export const ORIGENS_VALIDAS = ['manual', 'datasheet_gemini', 'datasheet_pdfparse', 'import_planilha', 'import_solarmarket', 'import_legado', 'desconhecido']
export function resolverOrigem(body = {}, fallback = 'manual') {
  const o = body.origem || {}
  const tipo = ORIGENS_VALIDAS.includes(o.tipo) ? o.tipo : fallback
  return { tipo, fonte: o.fonte || body.datasheet_url || null, em: new Date() }
}

// Wrapper function to make PDFParse easier to use
const pdf = async (bufferPDF) => {
  const parser = new PDFParse({ data: bufferPDF })
  const infoResult = await parser.getInfo()
  const textResult = await parser.getText()
  await parser.destroy()

  return {
    numpages: infoResult.total,
    text: textResult.text
  }
}

export const listarEquipamentos = async (req, res) => {
  try {
    const { tipo, ativo, search, ordenar } = req.query
    // CAT-P0-UNIFY (FASE 2): normaliza o tipo (hífen → underscore canônico).
    // Antes 'carregador-ev' nunca casava o enum 'carregador_ev' → sempre 0.
    const tipoNorm = tipo ? normalizarTipo(tipo) : null

    console.log(`📊 GET /api/equipamentos - Filters: tipo=${tipo}→${tipoNorm}, ativo=${ativo}, search=${search}`)

    let equipamentos

    // Usar memory storage se MongoDB está offline
    if (usarMemoryStorage()) {
      console.log('⚠️  MongoDB offline - Usando dados em memória')
      const filtro = {}
      if (tipoNorm) filtro.tipo = tipoNorm
      if (ativo !== undefined) filtro.ativo = ativo === 'true'
      if (search) filtro.search = search

      equipamentos = memoryStore.findAllEquipamentos(filtro)
      console.log(`✓ Encontrados ${equipamentos.length} equipamentos em memória`)

      // Ordenar
      if (ordenar === 'potencia') {
        equipamentos.sort((a, b) => (b.especificacoes?.potencia || 0) - (a.especificacoes?.potencia || 0))
      } else if (ordenar === 'preco') {
        equipamentos.sort((a, b) => (a.preco_sugerido || 0) - (b.preco_sugerido || 0))
      } else {
        equipamentos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      }

      return res.json({
        total: equipamentos.length,
        equipamentos,
        _debug: { origem: 'memory' }
      })
    }

    // Usar MongoDB se disponível
    const filtro = {}
    if (tipoNorm) filtro.tipo = tipoNorm
    if (ativo !== undefined) filtro.ativo = ativo === 'true'

    let query = Equipamento.find(filtro)

    if (search) {
      query = query.where({
        $or: [
          { fabricante: new RegExp(search, 'i') },
          { modelo: new RegExp(search, 'i') },
        ],
      })
    }

    if (ordenar === 'potencia') {
      query = query.sort({ 'especificacoes.potencia': -1 })
    } else if (ordenar === 'preco') {
      query = query.sort({ preco_sugerido: 1 })
    } else {
      query = query.sort({ createdAt: -1 })
    }

    equipamentos = await query.exec()
    console.log(`✓ Encontrados ${equipamentos.length} equipamentos em MongoDB`)

    // FALLBACK: tipo carregador EV (qualquer alias) sem resultados → CarregadorEV.
    // CAT-P0-UNIFY:
    //   FASE 2 — usa ehCarregadorEV (normaliza hífen/underscore)
    //   FASE 4 — respeita flag ENABLE_CARREGADOR_EV_FALLBACK (default true)
    //   FASE 1 — inclui `_id` real no objeto mapeado (corrige DELETE undefined)
    // P0-EV-CATALOG-SINGLE-SOURCE-OF-TRUTH-01: para tipo carregador, SEMPRE derivar de
    // CarregadorEV (fonte única) — ignora docs mirror armazenados (obsoletos) e evita
    // retornar a projeção lossy. O bloco abaixo REATRIBUI `equipamentos` por completo.
    let _origem = 'equipamento'
    if (ehCarregadorEV(tipoNorm)) {
      if (!catalogoFlags.ENABLE_CARREGADOR_EV_FALLBACK) {
        console.log('🚫 Fallback CarregadorEV DESABILITADO via flag — retornando vazio.')
        return res.json({ total: 0, equipamentos: [], _debug: { origem: 'equipamento', fallback_desabilitado: true } })
      }
      console.log('⚠️  Fallback: buscando de CarregadorEV collection (fonte única)...')
      const carregadores = await CarregadorEV.find({ ativo: true }).sort({ createdAt: -1 })
      console.log(`✓ Encontrados ${carregadores.length} carregadores EV`)
      _origem = 'carregador_ev_fonte_unica'

      // P0-EV-CATALOG-SINGLE-SOURCE-OF-TRUTH-01: deriva a visão COMPLETA (sem perda)
      // do CarregadorEV (fonte única). Substitui a antiga projeção lossy. Qualidade
      // calculada na leitura reusando o motor de score (sem alterá-lo).
      const { carregadorParaEquipamentoComQualidade } = await import('../utils/catalogo/carregadorEquipamentoView.js')
      const { processarEquipamento } = await import('../services/catalogoQualidade.js')
      equipamentos = carregadores.map(cg => carregadorParaEquipamentoComQualidade(cg, processarEquipamento))
    }

    res.json({
      total: equipamentos.length,
      equipamentos,
      _debug: { origem: _origem },
    })
  } catch (err) {
    console.error('❌ Erro ao listar equipamentos:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const buscarEquipamento = async (req, res) => {
  try {
    const { id } = req.params
    const equipamento = await Equipamento.findById(id)

    if (!equipamento) {
      return res.status(404).json({ erro: 'Equipamento não encontrado' })
    }

    res.json(equipamento)
  } catch (err) {
    console.error('❌ Erro ao buscar equipamento:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const criarEquipamento = async (req, res) => {
  try {
    const {
      tipo,
      fabricante,
      modelo,
      especificacoes,
      garantia_produto,
      garantia_performance,
      preco_sugerido,
      forcar = false,    // S8.6.1: bypass explícito p/ entrada manual confirmada
    } = req.body

    if (!tipo || !fabricante || !modelo) {
      return res.status(400).json({
        erro: 'Campos obrigatórios: tipo, fabricante, modelo',
        codigo: 'CAMPOS_OBRIGATORIOS',
      })
    }

    // P0-01: guard de "lixo" ALINHADO com o frontend (ModalNovoInversor).
    // Antes: backend rejeitava se fabricante OU modelo fosse lixo (||) enquanto o
    // modal só abortava se AMBOS fossem lixo (&&). A assimetria causava 422
    // silencioso em extrações parciais (marca ok, modelo lixo) → inversor não
    // persistia. Agora: só rejeita quando AMBOS são lixo (idêntico ao modal).
    // `forcar=true` ainda faz bypass total (entrada manual confirmada).
    if (!forcar) {
      const { ehDefaultLixo } = await import('../utils/catalogo/fabricanteModeloFallback.js')
      const fabLixo = ehDefaultLixo(fabricante, 'fabricante')
      const modLixo = ehDefaultLixo(modelo, 'modelo')
      if (fabLixo && modLixo) {
        return res.status(422).json({
          erro: 'Importação rejeitada: fabricante E modelo são defaults lixo (Desconhecido/Inversor/etc.).',
          codigo: 'IMPORTACAO_FALHOU',
          detalhe: { fabricante_lixo: fabLixo, modelo_lixo: modLixo, recebidos: { fabricante, modelo } },
          sugestao: 'Reprocessar datasheet ou preencher manualmente antes de salvar.',
        })
      }
      // Parcial (só um lixo): aceita mas devolve aviso na resposta (não bloqueia).
      if (fabLixo || modLixo) {
        req._avisoParcial = `Atenção: ${fabLixo ? 'fabricante' : 'modelo'} não identificado com confiança — revise a ficha técnica.`
      }
    }

    const novo = new Equipamento({
      tipo,
      fabricante,
      modelo,
      especificacoes: especificacoes || {},
      garantia_produto,
      garantia_performance,
      preco_sugerido: preco_sugerido || 0,
      origem: resolverOrigem(req.body, 'manual'),   // P1-CATALOG-PROVENANCE-01
    })

    await novo.save()
    console.log(`✓ Equipamento criado: ${novo._id} (${fabricante} ${modelo})`)
    // P0-01: anexa aviso de extração parcial (se houve), sem bloquear.
    const resposta = novo.toObject ? novo.toObject() : novo
    if (req._avisoParcial) resposta._aviso = req._avisoParcial
    res.status(201).json(resposta)
  } catch (err) {
    console.error('❌ Erro ao criar equipamento:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * P0-INV-01B — Persistência em LOTE de inversores (1 PDF → N equipamentos).
 *
 * Recebe { itens: [{ fabricante, modelo, tipo, especificacoes }] } e faz upsert
 * idempotente por (tipo, fabricante, modelo) case-insensitive.
 *
 * "Rollback seguro" = ISOLAMENTO POR ITEM: cada Equipamento é uma entidade SSOT
 * independente; uma falha no item k não corrompe nem desfaz os itens já salvos,
 * e o dedup torna o reenvio idempotente (atualiza em vez de duplicar). Não usamos
 * transação all-or-nothing de propósito — sucesso parcial é desejável e auditável.
 */
export const criarInversoresLote = async (req, res) => {
  try {
    const { itens } = req.body
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: 'Campo "itens" (array não-vazio) é obrigatório', codigo: 'ITENS_VAZIOS' })
    }
    const { ehDefaultLixo } = await import('../utils/catalogo/fabricanteModeloFallback.js')
    const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const resultado = { criados: [], atualizados: [], falhas: [] }
    const vistosNoLote = new Set()

    // Fallback de memória (MongoDB offline): mesma semântica de upsert, sem
    // buffering do Mongoose. Mantém o endpoint funcional em modo memory-storage,
    // como já fazem listar/criar equipamento.
    if (usarMemoryStorage()) {
      for (const item of itens) {
        const fabricante = String(item?.fabricante || '').trim()
        const modelo = String(item?.modelo || '').trim()
        const tipo = item?.tipo || 'inversor'
        if (!fabricante || !modelo) { resultado.falhas.push({ modelo: modelo || null, erro: 'fabricante/modelo ausente' }); continue }
        if (ehDefaultLixo(fabricante, 'fabricante') && ehDefaultLixo(modelo, 'modelo')) { resultado.falhas.push({ modelo, erro: 'fabricante E modelo são defaults lixo' }); continue }
        const chave = `${fabricante.toLowerCase()}::${modelo.toLowerCase()}`
        if (vistosNoLote.has(chave)) continue
        vistosNoLote.add(chave)
        const todos = memoryStore.findAllEquipamentos({})
        const existente = todos.find(e => e.tipo === tipo && String(e.fabricante).toLowerCase() === fabricante.toLowerCase() && String(e.modelo).toLowerCase() === modelo.toLowerCase())
        if (existente) {
          existente.especificacoes = { ...(existente.especificacoes || {}), ...(item.especificacoes || {}) }
          existente.updatedAt = new Date().toISOString()
          memoryStore.saveToFile?.()
          resultado.atualizados.push({ _id: existente._id, fabricante, modelo })
        } else {
          const novo = memoryStore.createEquipamento({ tipo, fabricante, modelo, especificacoes: item.especificacoes || {}, preco_sugerido: item.preco_sugerido || 0, ativo: true })
          resultado.criados.push({ _id: novo._id, fabricante, modelo })
        }
      }
      const algumMem = resultado.criados.length + resultado.atualizados.length > 0
      return res.status(algumMem ? 201 : 422).json({
        ok: resultado.falhas.length === 0, total: itens.length,
        criados: resultado.criados.length, atualizados: resultado.atualizados.length,
        falhas: resultado.falhas.length, detalhe: resultado,
      })
    }

    for (const item of itens) {
      const fabricante = String(item?.fabricante || '').trim()
      const modelo = String(item?.modelo || '').trim()
      const tipo = item?.tipo || 'inversor'
      try {
        if (!fabricante || !modelo) {
          resultado.falhas.push({ modelo: modelo || null, erro: 'fabricante/modelo ausente' }); continue
        }
        if (ehDefaultLixo(fabricante, 'fabricante') && ehDefaultLixo(modelo, 'modelo')) {
          resultado.falhas.push({ modelo, erro: 'fabricante E modelo são defaults lixo' }); continue
        }
        const chave = `${fabricante.toLowerCase()}::${modelo.toLowerCase()}`
        if (vistosNoLote.has(chave)) { continue } // dedup intra-lote
        vistosNoLote.add(chave)

        const existente = await Equipamento.findOne({
          tipo,
          fabricante: { $regex: `^${esc(fabricante)}$`, $options: 'i' },
          modelo: { $regex: `^${esc(modelo)}$`, $options: 'i' },
        })
        if (existente) {
          existente.especificacoes = { ...(existente.especificacoes || {}), ...(item.especificacoes || {}) }
          await existente.save()
          resultado.atualizados.push({ _id: existente._id, fabricante, modelo })
        } else {
          const novo = new Equipamento({
            tipo, fabricante, modelo,
            especificacoes: item.especificacoes || {},
            preco_sugerido: item.preco_sugerido || 0,
            origem: resolverOrigem({ origem: item.origem || req.body?.origem }, 'manual'),   // P1-CATALOG-PROVENANCE-01
          })
          await novo.save()
          resultado.criados.push({ _id: novo._id, fabricante, modelo })
        }
      } catch (e) {
        resultado.falhas.push({ modelo: modelo || null, erro: e.message })
      }
    }

    const algum = resultado.criados.length + resultado.atualizados.length > 0
    res.status(algum ? 201 : 422).json({
      ok: resultado.falhas.length === 0,
      total: itens.length,
      criados: resultado.criados.length,
      atualizados: resultado.atualizados.length,
      falhas: resultado.falhas.length,
      detalhe: resultado,
    })
  } catch (err) {
    console.error('❌ Erro no lote de inversores:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const atualizarEquipamento = async (req, res) => {
  try {
    const { id } = req.params
    const { fabricante, modelo, especificacoes, garantia_produto, garantia_performance, preco_sugerido, ativo } = req.body

    // P0-MOD-FV-QUALITY-ENGINE-01: findByIdAndUpdate CONTORNA o pre('save') hook,
    // impedindo que processarEquipamento recalcule qualidade/score após edição manual.
    // Substituído por findById + atribuição + .save() para disparar o hook corretamente.
    const equipamento = await Equipamento.findById(id)
    if (!equipamento) {
      return res.status(404).json({ erro: 'Equipamento não encontrado' })
    }

    if (fabricante !== undefined) equipamento.fabricante = fabricante
    if (modelo !== undefined) equipamento.modelo = modelo
    if (especificacoes !== undefined) {
      equipamento.especificacoes = especificacoes
      equipamento.markModified('especificacoes')
    }
    if (garantia_produto !== undefined) equipamento.garantia_produto = garantia_produto
    if (garantia_performance !== undefined) equipamento.garantia_performance = garantia_performance
    if (preco_sugerido !== undefined) equipamento.preco_sugerido = preco_sugerido
    if (ativo !== undefined) equipamento.ativo = ativo

    // Se a origem era desconhecida e o usuário está editando manualmente, promove para 'manual'
    // para que a confiança reflita a revisão humana (manual=100 vs desconhecido=20).
    if (!equipamento.origem?.tipo || equipamento.origem.tipo === 'desconhecido') {
      equipamento.origem = { ...(equipamento.origem || {}), tipo: 'manual', em: new Date() }
      equipamento.markModified('origem')
    }

    // .save() dispara pre('save') → processarEquipamento → qualidade recalculada
    await equipamento.save()

    console.log('✓ Equipamento atualizado (com qualidade recalculada):', id)
    res.json(equipamento)
  } catch (err) {
    console.error('❌ Erro ao atualizar equipamento:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const excluirEquipamento = async (req, res) => {
  try {
    const { id } = req.params
    // CAT-P0-UNIFY (FASE 1): valida id (antes vinha 'undefined' literal da tela
    // de carregadores via fallback sem _id).
    if (!id || id === 'undefined' || id === 'null' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido', codigo: 'ID_INVALIDO', recebido: id })
    }

    // Tenta primeiro em Equipamento; se não achar, tenta CarregadorEV
    // (a tela de carregadores opera sobre a coleção legada via fallback).
    let equipamento = await Equipamento.findByIdAndDelete(id)
    let origem = 'Equipamento'
    if (!equipamento) {
      equipamento = await CarregadorEV.findByIdAndDelete(id)
      origem = 'CarregadorEV'
    }

    if (!equipamento) {
      return res.status(404).json({ erro: 'Equipamento não encontrado' })
    }

    console.log(`✓ Equipamento excluído (${origem}):`, id)
    res.json({ mensagem: 'Equipamento excluído com sucesso', origem })
  } catch (err) {
    console.error('❌ Erro ao excluir equipamento:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ===== FUNÇÕES AUXILIARES PARA ANÁLISE DE IMAGENS =====

const extrairImagensDoPDF = async (bufferPDF) => {
  try {
    const pdfData = await pdf(bufferPDF)

    // PDFParse não extrai imagens diretamente, então usamos buffer bruto
    // Para método robusto, seria necessário pdf-lib ou pdfjs

    console.log(`📄 PDF contém ${pdfData.numpages} páginas`)

    // Retornar buffer PDF para extração de imagens
    return {
      buffer: bufferPDF,
      pages: pdfData.numpages,
      success: true
    }
  } catch (err) {
    console.error('❌ Erro ao extrair imagens do PDF:', err.message)
    return { success: false, error: err.message }
  }
}

const analisarImagemComClaude = async (imagemBase64, contexto = 'Analise esta imagem de datasheet') => {
  try {
    const client = new Anthropic()

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imagemBase64,
              },
            },
            {
              type: 'text',
              text: `${contexto}

Extraia as seguintes informações se estiverem visíveis:
1. Garantia de Produto (em anos)
2. Garantia de Performance (em anos ou percentual)
3. Eficiência (em %)
4. Qualquer informação técnica adicional visível
5. Selos, certificações ou badges

Retorne um JSON com a estrutura:
{
  "garantia_produto": número em anos,
  "garantia_performance": número ou string,
  "eficiencia": número,
  "certificacoes": [array de strings],
  "info_adicional": string,
  "confianca": "alta" | "media" | "baixa"
}`
            }
          ],
        }
      ],
    })

    const conteudo = message.content[0]
    if (conteudo.type === 'text') {
      try {
        const jsonMatch = conteudo.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.warn('⚠️ Não foi possível fazer parse do JSON retornado:', e.message)
        return {
          texto_bruto: conteudo.text,
          confianca: 'baixa'
        }
      }
    }

    return { error: 'Resposta inesperada da API' }
  } catch (err) {
    console.error('❌ Erro ao analisar imagem com Claude:', err.message)
    return { error: err.message }
  }
}

const converterPDFParaImagensBase64 = async (bufferPDF) => {
  // Para uma implementação mais robusta, seria necessário usar pdfjs-dist ou similar
  // Por enquanto, vamos retornar um placeholder que pode ser expandido
  // Em produção, seria necessário usar uma biblioteca como 'pdf-to-img' ou 'pdfjs-dist'

  console.log('⚠️ Nota: Conversão de PDF para imagem requer biblioteca adicional (pdfjs-dist)')
  return []
}

// ===== ANÁLISE COM GOOGLE GEMINI (GRATUITO - 60 req/min) =====
const analisarImagemComGemini = async (imagemBase64, contexto = 'Analise esta imagem de datasheet') => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      console.warn('⚠️ GOOGLE_API_KEY não configurada')
      return { error: 'Google API key not configured' }
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `${contexto}

Extraia as seguintes informações se estiverem visíveis nesta imagem de datasheet:
1. Garantia de Produto (em anos)
2. Garantia de Performance (em anos ou percentual)
3. Eficiência (em %)
4. Qualquer informação técnica adicional visível
5. Selos, certificações ou badges (IEC, CE, etc)

Retorne um JSON com a estrutura:
{
  "garantia_produto": número em anos ou null,
  "garantia_performance": string ou null,
  "eficiencia": número ou null,
  "certificacoes": [array de strings],
  "info_adicional": string,
  "confianca": "alta" | "media" | "baixa"
}

Responda APENAS com o JSON, sem markdown ou explicações.`

    // Converter base64 para buffer
    const imageBuffer = Buffer.from(imagemBase64, 'base64')

    const result = await model.generateContent([
      {
        inlineData: {
          data: imagemBase64,
          mimeType: 'image/jpeg',
        },
      },
      prompt,
    ])

    const resposta = result.response.text()

    try {
      // Extrair JSON da resposta
      const jsonMatch = resposta.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.warn('⚠️ Erro ao fazer parse do JSON do Gemini:', e.message)
      return {
        texto_bruto: resposta,
        confianca: 'baixa'
      }
    }

    return { error: 'Resposta inesperada do Gemini' }
  } catch (err) {
    console.error('❌ Erro ao analisar imagem com Gemini:', err.message)
    return { error: err.message }
  }
}

export const extrairDatasheet = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo PDF não fornecido' })
    }

    const pdfData = await pdf(req.file.buffer)
    const texto = (pdfData.text || '').toUpperCase()
    const linhas = texto.split('\n')

    const especificacoes = {}

    // ===== EXTRAIR MODELO =====
    const regexModelos = [
      /MODEL[\s:]*([A-Z0-9\-\/_]+)/,
      /TYPE[\s:]*([A-Z0-9\-\/_]+)/,
      /MODELO[\s:]*([A-Z0-9\-\/_]+)/,
      /^([A-Z0-9\-\/_]+)[\s]*(SERIES|MODULE|INVERTER)/,
      /PRODUCT[\s:]*([A-Z0-9\-\/_]+)/
    ]

    for (const regex of regexModelos) {
      const match = texto.match(regex)
      if (match && match[1]) {
        especificacoes.modelo = match[1].trim()
        break
      }
    }

    // ===== EXTRAIR FABRICANTE =====
    const regexFabricantes = [
      /MANUFACTURER[\s:]*([A-Z\s]+?)(?:\n|$)/,
      /FABRICANTE[\s:]*([A-Z\s]+?)(?:\n|$)/,
      /^([A-Z][A-Z\s]+?)\s+(?:MODULE|INVERTER|SOLAR)/,
    ]

    for (const regex of regexFabricantes) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const fab = match[1].trim()
        if (fab.length < 50) {
          especificacoes.fabricante = fab
          break
        }
      }
    }

    // ===== EXTRAIR POTÊNCIA (Wp) =====
    const regexPotenciaWp = [
      /(\d+)\s*W[\s\-]*(MODULE|RATED|PEAK|POWER)?(?!\w)/i,
      /RATED[\s:]*POWER[\s:]*([0-9.]+)\s*W/i,
      /POTÊNCIA[\s:]*([0-9.]+)\s*W/i,
      /(\d+(?:\.?\d+)?)\s*WP/i,
      /(\d+)\s*W\s*(?:@|AT)\s*STC/i,
      /POWER[\s]*OUTPUT[\s:]*([0-9.]+)\s*W/i,
      /MODULE[\s]*POWER[\s:]*([0-9.]+)\s*W/i,
      /NOMINAL[\s]*POWER[\s:]*([0-9.]+)\s*W/i,
    ]

    for (const regex of regexPotenciaWp) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const pot = parseInt(match[1])
        if (pot > 10 && pot < 10000) {
          especificacoes.potencia_wp = pot
          break
        }
      }
    }

    // ===== EXTRAIR POTÊNCIA (kW) =====
    const regexPotenciaKW = [
      /(\d+(?:\.\d+)?)\s*KW/i,
      /RATED[\s:]*POWER[\s:]*([0-9.]+)\s*KW/i,
      /POTÊNCIA[\s:]*NOMINAL[\s:]*([0-9.]+)\s*KW/i,
      /(\d+(?:\.\d+)?)\s*K[\s]*W/i
    ]

    if (!especificacoes.potencia_wp) {
      for (const regex of regexPotenciaKW) {
        const match = texto.match(regex)
        if (match && match[1]) {
          especificacoes.potencia_kw = parseFloat(match[1])
          break
        }
      }
    }

    // ===== EXTRAIR VOC =====
    const regexVoc = [
      /VOC[\s\(]*(?:VOLTAGE)?[\s\)]?[\s:]*([0-9.]+)\s*V/i,
      /OPEN[\s-]*CIRCUIT[\s:]*([0-9.]+)\s*V/i,
      /TENSÃO[\s]*ABERTA[\s:]*([0-9.]+)\s*V/i,
      /V\s*OC[\s:]*([0-9.]+)/i
    ]

    for (const regex of regexVoc) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const voc = parseFloat(match[1])
        if (voc > 5 && voc < 500) {
          especificacoes.voc = voc
          break
        }
      }
    }

    // ===== EXTRAIR VMP =====
    const regexVmp = [
      /VMP[\s\(]*(?:VOLTAGE)?[\s\)]?[\s:]*([0-9.]+)\s*V/i,
      /MAX[\s-]*POWER[\s]*VOLT[\s:]*([0-9.]+)\s*V/i,
      /VOLTAGE[\s]*AT[\s]*MAX[\s]*POWER[\s:]*([0-9.]+)\s*V/i,
      /V\s*MP[\s:]*([0-9.]+)/i,
      /TENSÃO[\s]*MAX[\s:]*([0-9.]+)\s*V/i,
      /VOLTAGE[\s]*MAX[\s:]*([0-9.]+)\s*V/i,
    ]

    for (const regex of regexVmp) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const vmp = parseFloat(match[1])
        if (vmp > 5 && vmp < 500) {
          especificacoes.vmp = vmp
          break
        }
      }
    }

    // ===== EXTRAIR ISC =====
    const regexIsc = [
      /ISC[\s\(]*(?:CURRENT)?[\s\)]?[\s:]*([0-9.]+)\s*A/i,
      /SHORT[\s-]*CIRCUIT[\s]*CURRENT[\s:]*([0-9.]+)\s*A/i,
      /CORRENTE[\s]*CURTO[\s:]*([0-9.]+)\s*A/i,
      /I\s*SC[\s:]*([0-9.]+)/i,
      /SHORT[\s-]*CIRCUIT[\s]*AMPERES[\s:]*([0-9.]+)/i,
      /I\s*SC[\s]*\(AMPERES\)[\s:]*([0-9.]+)/i,
    ]

    for (const regex of regexIsc) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const isc = parseFloat(match[1])
        if (isc > 0 && isc < 100) {
          especificacoes.isc = isc
          break
        }
      }
    }

    // ===== EXTRAIR IMP =====
    const regexImp = [
      /IMP[\s\(]*(?:CURRENT)?[\s\)]?[\s:]*([0-9.]+)\s*A/i,
      /MAX[\s-]*POWER[\s]*CURRENT[\s:]*([0-9.]+)\s*A/i,
      /CURRENT[\s]*AT[\s]*MAX[\s]*POWER[\s:]*([0-9.]+)\s*A/i,
      /I\s*MP[\s:]*([0-9.]+)/i,
      /MAX[\s-]*POWER[\s]*AMPERES[\s:]*([0-9.]+)/i,
      /I\s*MP[\s]*\(AMPERES\)[\s:]*([0-9.]+)/i,
    ]

    for (const regex of regexImp) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const imp = parseFloat(match[1])
        if (imp > 0 && imp < 100) {
          especificacoes.imp = imp
          break
        }
      }
    }

    // ===== EXTRAIR EFICIÊNCIA =====
    const regexEficiencia = [
      /EFFIC[A-Z]*[\s\(]*MODULE[\s\)]?[\s:]*([0-9.]+)\s*%/i,
      /EFICIÊNCIA[\s:]*([0-9.]+)\s*%/i,
      /EFFICIENCY[\s:]*([0-9.]+)\s*%/i,
      /([0-9.]+)\s*%[\s]*EFFICIENCY/i
    ]

    for (const regex of regexEficiencia) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const eff = parseFloat(match[1])
        if (eff > 5 && eff < 25) {
          especificacoes.eficiencia = eff
          break
        }
      }
    }

    // ===== EXTRAIR GARANTIA (texto) =====
    const regexGarantia = [
      /WARRANTY[\s:]*(\d+)\s*YEAR/i,
      /GARANTIA[\s:]*(\d+)\s*ANO/i,
      /PRODUCT[\s]*WARRANTY[\s:]*(\d+)/i,
      /(\d+)\s*YEAR[\s]*(?:WARRANTY|GUARANTEE)/i
    ]

    let garantiaEncontrada = false
    for (const regex of regexGarantia) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const garantia = parseInt(match[1])
        if (garantia > 0 && garantia < 100) {
          especificacoes.garantia_anos = garantia
          garantiaEncontrada = true
          break
        }
      }
    }

    // ===== ANÁLISE COM GOOGLE GEMINI (GRATUITO) (se garantia não encontrada) =====
    let analiseVisao = null
    if (!garantiaEncontrada && req.file && req.file.buffer) {
      try {
        console.log('🔍 Tentando extrair garantia com Google Gemini (visão de imagem)...')

        // Extrair imagens do PDF
        const resultadoExtracao = await extrairImagensDoPDF(req.file.buffer)

        if (resultadoExtracao.success) {
          // Converter PDF para Base64 para enviar ao Gemini
          const pdfBase64 = req.file.buffer.toString('base64')

          // Analisar com Google Gemini focando em garantias
          // Gemini é GRATUITO (60 req/min) - muito melhor para custos operacionais
          analiseVisao = await analisarImagemComGemini(
            pdfBase64,
            'Este é um datasheet de equipamento solar em formato PDF. Procure por informações de garantia, selos, badges e certificações. Extraia qualquer informação sobre garantia de produto, performance ou tempo de vida útil.'
          )

          if (analiseVisao && !analiseVisao.error) {
            console.log('✓ Análise de visão concluída:', analiseVisao)

            // Mesclar informações da análise de visão
            if (analiseVisao.garantia_produto && !especificacoes.garantia_anos) {
              especificacoes.garantia_anos = analiseVisao.garantia_produto
            }
            if (analiseVisao.garantia_performance) {
              especificacoes.garantia_performance = analiseVisao.garantia_performance
            }
            if (analiseVisao.certificacoes && analiseVisao.certificacoes.length > 0) {
              especificacoes.certificacoes = analiseVisao.certificacoes
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ Erro ao analisar com visão:', err.message)
        // Continuar mesmo se falhar a análise de visão
      }
    }

    // ===== EXTRAIR TENSÃO ENTRADA (para inversores) =====
    const regexTensaoEntrada = [
      /INPUT[\s]*VOLTAGE[\s:]*([0-9.]+)\s*V/i,
      /TENSÃO[\s]*ENTRADA[\s:]*([0-9.]+)\s*V/i,
      /DC[\s]*VOLTAGE[\s:]*([0-9.]+)\s*V/i,
      /([0-9.]+)[\s]*V[\s]*(?:DC|INPUT)/i
    ]

    for (const regex of regexTensaoEntrada) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const tensao = parseInt(match[1])
        if (tensao > 50 && tensao < 1000) {
          especificacoes.tensao_entrada = tensao
          break
        }
      }
    }

    // ===== EXTRAIR MPPT =====
    const regexMppt = [
      /MPPT[\s:]*(\d+)/i,
      /NUMBER[\s]*OF[\s]*MPPT[\s:]*(\d+)/i,
      /(\d+)\s*MPPT/i
    ]

    for (const regex of regexMppt) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const mppt = parseInt(match[1])
        if (mppt > 0 && mppt < 20) {
          especificacoes.mppt = mppt
          break
        }
      }
    }

    // ===== EXTRAIR CORRENTE MÁXIMA SAÍDA (para inversores) =====
    const regexCorrenteMaxSaida = [
      /MAX[\s]*OUTPUT[\s]*CURRENT[\s:]*([0-9.]+)\s*A/i,
      /CORRENTE[\s]*MÁXIMA[\s]*SAÍDA[\s:]*([0-9.]+)\s*A/i,
      /MAXIMUM[\s]*OUTPUT[\s]*CURRENT[\s:]*([0-9.]+)\s*A/i,
      /OUTPUT[\s]*CURRENT[\s:]*([0-9.]+)\s*A(?:\s|$)/i,
      /AC[\s]*OUTPUT[\s]*CURRENT[\s:]*([0-9.]+)\s*A/i,
      /MAX[\s]*AC[\s]*CURRENT[\s:]*([0-9.]+)\s*A/i,
    ]

    for (const regex of regexCorrenteMaxSaida) {
      const match = texto.match(regex)
      if (match && match[1]) {
        const corrente = parseFloat(match[1])
        if (corrente > 0 && corrente < 1000) {
          especificacoes.corrente_maxima_saida_ac = corrente
          break
        }
      }
    }

    // ===== VALIDAÇÃO CRUZADA =====
    let qualityScore = Object.keys(especificacoes).length * 10
    const avisos = []

    // Validar coerência entre Pmpp e Vmp×Imp
    if (especificacoes.vmp && especificacoes.imp && especificacoes.potencia_wp) {
      const pmppTeorico = especificacoes.vmp * especificacoes.imp
      const diferenca = Math.abs(pmppTeorico - especificacoes.potencia_wp) / especificacoes.potencia_wp
      if (diferenca > 0.15) {
        avisos.push(`⚠️ Inconsistência: Pmpp calculado (${pmppTeorico.toFixed(0)}W) ≠ Pmpp informado (${especificacoes.potencia_wp}W)`)
        qualityScore -= 10
      }
    }

    // Validar se Voc > Vmp (deve ser sempre maior)
    if (especificacoes.voc && especificacoes.vmp && especificacoes.voc <= especificacoes.vmp) {
      avisos.push(`⚠️ Inconsistência: VOC (${especificacoes.voc}V) deve ser > VMP (${especificacoes.vmp}V)`)
      qualityScore -= 10
    }

    // Validar se Isc > Imp (deve ser sempre maior)
    if (especificacoes.isc && especificacoes.imp && especificacoes.isc <= especificacoes.imp) {
      avisos.push(`⚠️ Inconsistência: ISC (${especificacoes.isc}A) deve ser > IMP (${especificacoes.imp}A)`)
      qualityScore -= 10
    }

    qualityScore = Math.max(0, Math.min(100, qualityScore))

    console.log('✓ Datasheet extraído com sucesso:', especificacoes)
    if (avisos.length > 0) console.warn('Avisos de validação:', avisos)
    console.log('📄 Texto extraído (primeiras 500 caracteres):', texto.substring(0, 500))

    res.json({
      ...especificacoes,
      qualityScore,
      avisos,
      analiseVisao: analiseVisao || null,
      _debug: {
        total_caracteres: texto.length,
        campos_encontrados: Object.keys(especificacoes).length,
        qualidade: qualityScore >= 70 ? 'Excelente' : qualityScore >= 50 ? 'Bom' : qualityScore >= 30 ? 'Aceitável' : 'Baixa',
        analiseVisaoUsada: !garantiaEncontrada && analiseVisao && !analiseVisao.error
      }
    })
  } catch (err) {
    console.error('❌ Erro ao extrair datasheet:', err)
    res.status(500).json({ erro: 'Erro ao processar PDF: ' + err.message })
  }
}
