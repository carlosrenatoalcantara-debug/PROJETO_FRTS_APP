import { PDFParse } from 'pdf-parse'
import { extrairDadosDoTexto, extrairFaseETensao, mapeiaGrupoTarifario } from '../dominio/fatura/textoFatura.js'
import { obterIrradianciaCity, obterIrradianciaFallback } from '../data/irradianciaRN.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { gerarComFallback, ehErroDeModelo, ehErroDeCapacidade } from '../ai/geminiModelos.js'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicKey } from '../ai/aiKeys.js'
import { CLAUDE_MODELO_PADRAO } from '../ai/adapters/claudeAdapter.js'

// ─── Gemini Vision para imagens de fatura ────────────────────────────────────
// Chave pode vir do env (Railway) ou do header X-Gemini-Key (enviado pelo frontend via localStorage)
const GEMINI_API_KEY_ENV = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY

const PROMPT_FATURA = `Você é especialista em faturas de energia elétrica brasileiras.
Analise esta imagem de conta de energia e extraia os dados do cliente.

Distribuidoras comuns: COSERN (RN), COELBA (BA), CELPE (PE), COELCE (CE), CEMIG (MG), COPEL (PR), ENEL, ENERGISA, EQUATORIAL, ELEKTRO, LIGHT, EDP, NEOENERGIA.

RETORNE APENAS JSON válido, sem markdown, sem explicação. Use null para campos não encontrados:
{
  "nome": "nome completo do cliente",
  "cpfCnpj": "CPF ou CNPJ do cliente (não da distribuidora)",
  "telefone": "telefone do cliente no formato (XX) 9XXXX-XXXX",
  "numeroCliente": "código/número do cliente",
  "codigoInstalacao": "código da instalação ou UC",
  "endereco": "endereço completo do cliente",
  "cep": "CEP formato 00000-000",
  "cidade": "cidade",
  "estado": "sigla UF 2 letras",
  "distribuidora": "nome curto da distribuidora (ex: COSERN, COELBA)",
  "classificacao": "código tarifário exato (B1, B2, B3, A1, A2, A3, A3a, A4, AS)",
  "subgrupo": "Residencial / Comercial / Industrial / Rural / Poder Público",
  "grupoTarifario": "B (baixa tensão até 2,3kV) ou A (alta/média tensão acima)",
  "tipoLigacao": "Monofásico / Bifásico / Trifásico",
  "tensaoV": número da tensão de fornecimento em volts (ex: 127, 220, 380),
  "demandaContratadaKw": número da demanda contratada em kW (só para grupo A, null para B),
  "consumoKwh": número do consumo mensal atual em kWh,
  "historico12meses": [
    {"mes": "JAN/26", "consumo": 450},
    {"mes": "FEV/26", "consumo": 480}
  ],
  "valorR": valor total da fatura em reais como número,
  "valorKwh": tarifa em R$/kWh como número decimal (ex: 0.987)
}`

async function extrairComGeminiVision(buffer, mimeType, apiKeyFromHeader) {
  const GEMINI_API_KEY = apiKeyFromHeader || GEMINI_API_KEY_ENV
  if (!GEMINI_API_KEY) {
    throw new Error('Chave Gemini não configurada. Acesse Configurações > Integrações e adicione a chave GeminiVision.')
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

  const imagePart = {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  }

  const { result, modelo } = await gerarComFallback(genAI, [PROMPT_FATURA, imagePart], {
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  })
  console.log(`🖼️ Fatura extraída com ${modelo}`)
  return parseJsonIA(result.response.text(), 'Gemini')
}

// ─── Claude Vision: fallback quando o Gemini falha (sobrecarga, cota, modelo) ──
const MIMES_CLAUDE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

async function extrairComClaudeVision(buffer, mimeType) {
  const key = getAnthropicKey()
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada')
  if (!MIMES_CLAUDE.includes(mimeType)) throw new Error(`Formato ${mimeType} não suportado pelo Claude`)

  const client = new Anthropic({ apiKey: key, timeout: 60000 })
  const msg = await client.messages.create({
    model: CLAUDE_MODELO_PADRAO,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: buffer.toString('base64') } },
        { type: 'text', text: PROMPT_FATURA },
      ],
    }],
  })
  const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  console.log(`🖼️ Fatura extraída com ${CLAUDE_MODELO_PADRAO}`)
  return parseJsonIA(text, 'Claude')
}

// Remove markdown se presente; isola o objeto JSON caso venha texto ao redor
function parseJsonIA(texto, provedor) {
  const semMarkdown = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  const ini = semMarkdown.indexOf('{')
  const fim = semMarkdown.lastIndexOf('}')
  const jsonStr = ini >= 0 && fim > ini ? semMarkdown.slice(ini, fim + 1) : semMarkdown
  try {
    return JSON.parse(jsonStr)
  } catch {
    throw new Error(`Resposta do ${provedor} não é JSON válido`)
  }
}

// Endpoint de debug: retorna o texto bruto do PDF linha por linha
export async function debugFatura(req, res) {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' })
    const parser = new PDFParse({ data: req.file.buffer })
    const textResult = await parser.getText()
    await parser.destroy()
    const linhas = (textResult.text || '').split('\n').map((l, i) => ({ linha: i + 1, texto: l }))
    res.json({ totalLinhas: linhas.length, linhas })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
}

export async function extrairDadosFatura(req, res) {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' })

    const mimeType = req.file.mimetype || ''
    const isImagem = mimeType.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(req.file.originalname || '')

    console.log(`📄 Processando fatura: ${req.file.originalname} (${mimeType})`)

    // ── Imagem → Gemini Vision ────────────────────────────────────────────────
    if (isImagem) {
      console.log('🖼️ Usando Gemini Vision para imagem...')
      try {
        const imgMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg'
        const apiKeyFromHeader = req.headers['x-gemini-key'] || null
        let dadosGemini
        let metodo = 'gemini_vision'
        try {
          dadosGemini = await extrairComGeminiVision(req.file.buffer, imgMime, apiKeyFromHeader)
        } catch (errGemini) {
          if (!getAnthropicKey()) throw errGemini
          console.warn('⚠️ Gemini falhou, tentando Claude Vision:', errGemini.message)
          try {
            dadosGemini = await extrairComClaudeVision(req.file.buffer, imgMime)
            metodo = 'claude_vision'
          } catch (errClaude) {
            console.warn('⚠️ Claude Vision falhou:', errClaude.message)
            throw errGemini // erro primário é o que orienta o usuário
          }
        }

        // Complementar com dados calculados a partir do que Gemini extraiu
        const { fase, tensao } = extrairFaseETensao(dadosGemini.tipoLigacao)
        // Se Gemini retornou grupoTarifario explícito, usa; senão deriva da classificação
        const grupoTarifario = dadosGemini.grupoTarifario || mapeiaGrupoTarifario(dadosGemini.classificacao)
        const cidade = dadosGemini.cidade || null
        const estado = dadosGemini.estado || null
        const irradiancia = (cidade && estado)
          ? (obterIrradianciaCity(cidade, estado) || obterIrradianciaFallback(estado))
          : (estado ? obterIrradianciaFallback(estado) : null)

        // Calcular média anual a partir do histórico (se Gemini extraiu)
        const historico = Array.isArray(dadosGemini.historico12meses)
          ? dadosGemini.historico12meses.filter(h => h && typeof h.consumo === 'number' && h.consumo > 0)
          : []
        const mediaAnual = historico.length > 0
          ? Math.round(historico.reduce((s, h) => s + h.consumo, 0) / historico.length)
          : (dadosGemini.consumoKwh || null)

        console.log('✓ Gemini extraiu:', {
          nome: dadosGemini.nome,
          distribuidora: dadosGemini.distribuidora,
          consumo: dadosGemini.consumoKwh,
          historico: historico.length,
        })

        return res.json({
          ...dadosGemini,
          // Campos derivados / enriquecidos
          grupoTarifario,
          fase,
          tensao: dadosGemini.tensaoV || tensao,  // prefere extração direta da fatura
          irradiancia,
          mediaAnual,
          historico12Meses: historico.length > 0 ? historico : null,
          periodoMeses: historico.length || null,
          valorR: dadosGemini.valorR || null,
          // Metadados da extração
          _metodo: metodo,
          _extraidoEm: new Date().toISOString(),
        })
      } catch (geminiErr) {
        const msg = String(geminiErr?.message || '')
        console.warn('⚠️ Gemini Vision falhou:', msg)
        let erro = 'Não foi possível extrair dados da imagem. Tente um PDF ou preencha manualmente.'
        if (/Chave Gemini/i.test(msg)) erro = msg
        else if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED|\b403\b/i.test(msg)) erro = 'Chave Gemini inválida ou sem permissão. Verifique GOOGLE_API_KEY.'
        else if (/\b429\b|quota|RESOURCE_EXHAUSTED/i.test(msg)) erro = 'Cota da IA (Gemini) esgotada. Tente novamente em alguns minutos.'
        else if (ehErroDeCapacidade(msg)) erro = 'IA (Gemini) sobrecarregada no momento. Tente novamente em instantes.'
        else if (ehErroDeModelo(msg)) erro = 'Modelo de IA indisponível no momento. Configure GEMINI_MODEL no servidor.'
        return res.status(422).json({ erro, detalhe: msg.slice(0, 300) })
      }
    }

    // ── PDF → PDFParse (lógica original) ────────────────────────────────────
    let textoOriginal = ''
    try {
      const parser = new PDFParse({ data: req.file.buffer })
      const textResult = await parser.getText()
      textoOriginal = textResult.text || ''
      await parser.destroy()
    } catch (pdfErr) {
      console.warn('⚠️ PDF parse falhou:', pdfErr.message)
      return res.json(templateVazio('Não foi possível extrair dados do PDF.'))
    }

    const dados = extrairDadosDoTexto(textoOriginal)

    console.log('✓ Extraído:', {
      nome: dados.nome, distribuidora: dados.distribuidora,
      classificacao: dados.classificacao, tipoLigacao: dados.tipoLigacao,
      consumo: dados.consumoKwh, valorKwh: dados.valorKwh,
      cep: dados.cep, cidade: dados.cidade,
      grupoTarifario: dados.grupoTarifario,
      fase: dados.fase, tensao: dados.tensao,
      irradiancia: dados.irradiancia,
    })

    res.json(dados)
  } catch (err) {
    console.error('❌ Erro:', err.message)
    res.status(500).json({ erro: 'Erro ao processar PDF' })
  }
}

function templateVazio(aviso) {
  return {
    nome: null, cpfCnpj: null, numeroCliente: null, codigoInstalacao: null,
    endereco: null, cep: null, cidade: null, estado: null,
    distribuidora: null, classificacao: null, subgrupo: null, tipoLigacao: null,
    consumoKwh: null, mediaAnual: null, historico12Meses: null, periodoMeses: null,
    valorR: null, valorKwh: null, aviso,
    // Dados auto-preenchimento etapa 2
    grupoTarifario: null,
    fase: null,
    tensao: null,
    irradiancia: null,
  }
}
