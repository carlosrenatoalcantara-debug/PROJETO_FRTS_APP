import Anthropic from '@anthropic-ai/sdk'

// ── Extração via Claude (PDF nativo — lê tabelas, imagens, layouts complexos) ─

async function extrairComIA(pdfBuffer) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBuffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text: `Você é um especialista em equipamentos fotovoltaicos. Analise este datasheet e retorne SOMENTE um JSON válido, sem markdown, sem explicações.

REGRAS:
- "fabricante": nome da empresa fabricante (ex: ZNShine Solar, Risen Energy, Renesola, TW Solar, Canadian Solar). NUNCA "Desconhecido".
- "modelo": código técnico do produto (ex: ZXMR-UPLDD144, RSM110-8-540BMDG, RS6-560NBG, SIRIUS-HD144N). NUNCA certificações (ISO, IEC, CE).
- "tipo": "modulo" para placas, "inversor" para inversores.
- Se o datasheet tiver MÚLTIPLAS potências na mesma tabela (ex: 560W, 565W, 570W, 575W, 580W), crie uma variante para cada. Se for produto único, crie uma variante só.
- Valores numéricos devem ser números, não strings. Use null se não encontrar.
- Para módulos: potenciaW, voc (V), vmpp (V), isc (A), impp (A), eficiencia (%).
- Para inversores: potenciaKW, nMppts, correnteACSaida (A).

FORMATO OBRIGATÓRIO:
{
  "fabricante": "string",
  "modelo": "string",
  "tipo": "modulo",
  "variantes": [
    {
      "potenciaW": 590,
      "voc": 52.0,
      "vmpp": 43.5,
      "isc": 14.47,
      "impp": 13.57,
      "eficiencia": 21.8
    }
  ]
}`,
          },
        ],
      },
    ],
  })

  const resposta = message.content[0].text.trim()
  const limpo = resposta.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(limpo)
}

// ── Fallback regex (sem ANTHROPIC_API_KEY) ───────────────────────────────────

import { PDFParse } from 'pdf-parse'

const BLACKLIST = new Set([
  'STANDARD','CERTIFIED','MODULE','INVERTER','SOLAR','SERIES','PRODUCT','SYSTEM',
  'POWER','ENERGY','LINEAR','NORMAL','GENERAL','TYPE','TEST','CLASS','GRADE',
  'LEVEL','QUALITY','WARRANTY','MONO','POLY','BIFACIAL','DATASHEET','ISO45001',
  'SPECIFICATIONS','TECHNICAL','MCS','IEC61215','IEC61730','CE','UL',
])

function primeiraMatch(texto, padroes, validar) {
  for (const re of padroes) {
    const m = texto.match(re)
    if (m) {
      const val = m[1]?.trim()
      if (val && (!validar || validar(val))) return val
    }
  }
  return null
}

async function extrairPorRegex(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer })
  const result = await parser.getText()
  await parser.destroy()
  const textoPDF = result.text
  const texto = textoPDF.toUpperCase()
  const cab = texto.substring(0, 800)
  const dados = {}

  const marca = primeiraMatch(cab, [
    /^([A-Z][A-Z\s]{2,25}?)\s+(?:ENERGY|SOLAR|TECHNOLOGY|POWER|CO\.|INC\.|LTD)/m,
    /^(JINKO|CANADIAN|TRINA|LONGI|JA\s*SOLAR|NPLUX|RISEN|RECOM|ASTRONERGY|SERAPHIM|SUNTECH|HANWHA|YINGLI|CHINT|GROWATT|DEYE|SUNGROW|FRONIUS|SMA|HUAWEI|WEG|LEAPTON|ZNSHINE|ZN[\s\-]SHINE|MFDA|TW[\s\-]SOLAR|RS6|RENESOLA|BIFOCAL|SIRIUS)/m,
  ], v => v.length < 60 && !BLACKLIST.has(v))
  if (marca) dados.fabricante = marca.replace(/\s+/g, ' ').trim()

  const modelo = primeiraMatch(texto, [
    /(?:MODEL|TYPE|MODELO|PART\s*NO\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\_\/\.]{4,35})/,
    /^((?:RS[0-9]|JKM|CS[0-9]|TW|RSM|LP|ZX|ZN|MFD|SIRIUS)[A-Z0-9\-\/\.]{4,30})/m,
  ], v => !BLACKLIST.has(v) && /[0-9]/.test(v) && v.length >= 4)
  if (modelo) dados.modelo = modelo

  const pot = primeiraMatch(texto, [
    /(?:PMAX|PMPP|MAXIMUM\s*POWER|MAX\s*POWER)\s*[:\(]?[^0-9]{0,20}?([0-9]{3,4})\s*W(?!H)/i,
    /([0-9]{3,4})\s*W\s*(?:@|AT|STC)/i,
  ], v => { const n = parseInt(v); return n >= 50 && n <= 800 })
  if (pot) dados.potenciaW = parseInt(pot)

  const voc = primeiraMatch(texto, [/(?:VOC|OPEN[\s\-]*CIRCUIT\s*VOLTAGE)\s*[:\(]?[^0-9]{0,10}([0-9]{2,3}(?:\.[0-9]{1,2})?)\s*V/i],
    v => { const n = parseFloat(v); return n > 10 && n < 500 })
  if (voc) dados.voc = parseFloat(voc)

  const vmpp = primeiraMatch(texto, [/(?:VMPP|VMP|VOLTAGE\s*AT\s*MAX[^0-9]{0,20})\s*[:\(]?[^0-9]{0,10}([0-9]{2,3}(?:\.[0-9]{1,2})?)\s*V/i],
    v => { const n = parseFloat(v); return n > 10 && n < 500 })
  if (vmpp) dados.vmpp = parseFloat(vmpp)

  const isc = primeiraMatch(texto, [/(?:ISC|SHORT[\s\-]*CIRCUIT\s*CURRENT)\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*A/i],
    v => { const n = parseFloat(v); return n > 0 && n < 50 })
  if (isc) dados.isc = parseFloat(isc)

  const impp = primeiraMatch(texto, [/(?:IMPP|IMP|CURRENT\s*AT\s*MAX[^0-9]{0,20})\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*A/i],
    v => { const n = parseFloat(v); return n > 0 && n < 50 })
  if (impp) dados.impp = parseFloat(impp)

  const ef = primeiraMatch(texto, [/(?:MODULE\s*EFFICIENCY|EFFICIENCY)\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%/i],
    v => { const n = parseFloat(v); return n > 5 && n < 30 })
  if (ef) dados.eficiencia = parseFloat(ef)

  return {
    fabricante: dados.fabricante || null,
    modelo: dados.modelo || null,
    tipo: 'modulo',
    variantes: [{ potenciaW: dados.potenciaW || null, voc: dados.voc || null, vmpp: dados.vmpp || null, isc: dados.isc || null, impp: dados.impp || null, eficiencia: dados.eficiencia || null }],
  }
}

// ── Normaliza para o formato do frontend ──────────────────────────────────────

function normalizar(resultado, metodo) {
  const { fabricante, modelo, tipo = 'modulo', variantes = [] } = resultado
  const variantesNorm = Array.isArray(variantes) ? variantes : [variantes].filter(Boolean)
  const primeira = variantesNorm[0] || {}

  const dados = {
    fabricante:      fabricante             || null,
    modelo:          modelo                 || null,
    potenciaW:       primeira.potenciaW     || null,
    voc:             primeira.voc           || null,
    vmpp:            primeira.vmpp          || null,
    isc:             primeira.isc           || null,
    impp:            primeira.impp          || null,
    eficiencia:      primeira.eficiencia    || null,
    potenciaKW:      primeira.potenciaKW    || resultado.potenciaKW    || null,
    nMppts:          primeira.nMppts        || resultado.nMppts        || null,
    correnteACSaida: primeira.correnteACSaida || resultado.correnteACSaida || null,
  }

  const camposEncontrados = Object.values(dados).filter(v => v !== null && v !== '').length

  const resposta = {
    sucesso: true,
    dados,
    qualityScore: Math.min(100, camposEncontrados * 12),
    avisos: [],
    _debug: { campos_encontrados: camposEncontrados, metodo },
  }

  if (variantesNorm.length > 1) resposta.variantes = variantesNorm

  return resposta
}

// ── Endpoint principal ────────────────────────────────────────────────────────

export async function extrairDatasheet(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ sucesso: false, erro: 'Arquivo PDF não fornecido' })
    }

    const pdfBuffer = req.file.buffer
    console.log(`📄 PDF recebido: ${pdfBuffer.length} bytes`)

    let resultado, metodo

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        resultado = await extrairComIA(pdfBuffer)
        metodo = 'claude-pdf'
        console.log('✅ Claude extraiu:', JSON.stringify(resultado, null, 2))
      } catch (iaErr) {
        console.warn('⚠️ Falha no Claude, usando regex:', iaErr.message)
        resultado = await extrairPorRegex(pdfBuffer)
        metodo = 'regex-fallback'
      }
    } else {
      console.warn('⚠️ ANTHROPIC_API_KEY não definida — usando regex')
      resultado = await extrairPorRegex(pdfBuffer)
      metodo = 'regex'
    }

    res.json(normalizar(resultado, metodo))
  } catch (err) {
    console.error('❌ Erro ao extrair datasheet:', err)
    res.status(500).json({ sucesso: false, erro: 'Erro ao processar PDF: ' + err.message })
  }
}

export function criarPainelManual(req, res) {
  try {
    const { marca, modelo, potenciaW, voc, vmpp, isc, impp, eficiencia, garantiaProduto, garantiaPerformance } = req.body
    if (!marca || !modelo || !potenciaW)
      return res.status(400).json({ erro: 'Marca, modelo e potência (W) são obrigatórios' })
    res.status(201).json({
      sucesso: true,
      painel: {
        id: `custom-${Date.now()}`, marca, modelo,
        potenciaW: Number(potenciaW),
        voc: voc ? Number(voc) : null, vmpp: vmpp ? Number(vmpp) : null,
        isc: isc ? Number(isc) : null, impp: impp ? Number(impp) : null,
        eficiencia: eficiencia ? Number(eficiencia) : null,
        garantiaProduto: Number(garantiaProduto) || 10,
        garantiaPerformance: Number(garantiaPerformance) || 25,
        criacao: new Date().toISOString(),
      },
      mensagem: 'Painel cadastrado com sucesso',
    })
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}

export function criarInversorManual(req, res) {
  try {
    const { marca, modelo, potenciaKW, faseAC, nMppts, tensaoMpptMin, tensaoMpptMax, garantia } = req.body
    if (!marca || !modelo || !potenciaKW)
      return res.status(400).json({ erro: 'Marca, modelo e potência (kW) são obrigatórios' })
    res.status(201).json({
      sucesso: true,
      inversor: {
        id: `custom-${Date.now()}`, marca, modelo,
        potenciaKW: Number(potenciaKW),
        faseAC: faseAC ? Number(faseAC) : 1,
        nMppts: Number(nMppts) || 1,
        tensaoMpptMin: Number(tensaoMpptMin) || 200,
        tensaoMpptMax: Number(tensaoMpptMax) || 800,
        garantia: Number(garantia) || 10,
        criacao: new Date().toISOString(),
      },
      mensagem: 'Inversor cadastrado com sucesso',
    })
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}
