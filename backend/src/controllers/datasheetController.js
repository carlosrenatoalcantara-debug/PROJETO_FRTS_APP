import { PDFParse } from 'pdf-parse'
import Anthropic from '@anthropic-ai/sdk'

// ── Extração via Claude AI ────────────────────────────────────────────────────

async function extrairComIA(textoPDF) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const texto = textoPDF.substring(0, 12000)

  const prompt = `Você é um especialista em equipamentos fotovoltaicos. Analise o texto extraído de um datasheet de equipamento solar e retorne SOMENTE um JSON válido, sem markdown, sem explicações.

REGRAS IMPORTANTES:
- "modelo" deve ser o código técnico do produto (ex: JKM550M-72HL4, RS6-560NBG, RSM110-8-540BMDG, TW-M10-66HD). NUNCA use certificações (ISO, IEC, CE, UL, MCS) como modelo.
- "fabricante" deve ser o nome da empresa fabricante (ex: Jinko Solar, Risen Energy, Leapton Solar, TW Solar, Canadian Solar). NUNCA use "Desconhecido".
- Se for uma SÉRIE com múltiplas potências na mesma tabela (ex: 560W, 565W, 570W, 575W, 580W), coloque cada uma em "variantes". Se for produto único, coloque somente um item em "variantes".
- Valores numéricos devem ser números, não strings. Use null se não encontrar.
- Para inversores: inclua potenciaKW, nMppts, correnteACSaida ao invés de potenciaW/voc/isc.

FORMATO JSON OBRIGATÓRIO:
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
}

TEXTO DO DATASHEET:
${texto}`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const resposta = message.content[0].text.trim()
  const limpo = resposta.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(limpo)
}

// ── Fallback: extração por regex (sem IA) ────────────────────────────────────

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

function extrairPorRegex(textoPDF) {
  const texto = textoPDF.toUpperCase()
  const cab = texto.substring(0, 800)
  const dados = {}

  // Fabricante — apenas no cabeçalho
  const marca = primeiraMatch(cab, [
    /^([A-Z][A-Z\s]{2,25}?)\s+(?:ENERGY|SOLAR|TECHNOLOGY|POWER|CO\.|INC\.|LTD)/m,
    /^(JINKO|CANADIAN|TRINA|LONGI|JA\s*SOLAR|NPLUX|RISEN|RECOM|ASTRONERGY|SERAPHIM|SUNTECH|HANWHA|YINGLI|CHINT|GROWATT|DEYE|SUNGROW|FRONIUS|SMA|HUAWEI|WEG|LEAPTON|ZNSHINE|ZN[\s\-]SHINE|MFDA|TW[\s\-]SOLAR|RS6|RENESOLA|BIFOCAL)/m,
  ], v => v.length < 60 && !BLACKLIST.has(v))
  if (marca) dados.fabricante = marca.replace(/\s+/g, ' ').trim()

  // Modelo — exclui blacklist explicitamente
  const modelo = primeiraMatch(texto, [
    /(?:MODEL|TYPE|MODELO|PART\s*NO\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\_\/\.]{4,35})/,
    /^((?:RS[0-9]|JKM|CS[0-9]|TW|RSM|LP|ZN|MFD)[A-Z0-9\-\/\.]{4,30})/m,
  ], v => !BLACKLIST.has(v) && /[0-9]/.test(v) && v.length >= 4)
  if (modelo) dados.modelo = modelo

  // Potência
  const pot = primeiraMatch(texto, [
    /(?:PMAX|PMPP|MAXIMUM\s*POWER|MAX\s*POWER)\s*[:\(]?[^0-9]{0,20}?([0-9]{3,4})\s*W(?!H)/i,
    /([0-9]{3,4})\s*W\s*(?:@|AT|STC)/i,
  ], v => { const n = parseInt(v); return n >= 50 && n <= 800 })
  if (pot) dados.potenciaW = parseInt(pot)

  // VOC
  const voc = primeiraMatch(texto, [
    /(?:VOC|OPEN[\s\-]*CIRCUIT\s*VOLTAGE)\s*[:\(]?[^0-9]{0,10}([0-9]{2,3}(?:\.[0-9]{1,2})?)\s*V/i,
  ], v => { const n = parseFloat(v); return n > 10 && n < 500 })
  if (voc) dados.voc = parseFloat(voc)

  // VMPP
  const vmpp = primeiraMatch(texto, [
    /(?:VMPP|VMP|VOLTAGE\s*AT\s*MAX[^0-9]{0,20})\s*[:\(]?[^0-9]{0,10}([0-9]{2,3}(?:\.[0-9]{1,2})?)\s*V/i,
  ], v => { const n = parseFloat(v); return n > 10 && n < 500 })
  if (vmpp) dados.vmpp = parseFloat(vmpp)

  // ISC
  const isc = primeiraMatch(texto, [
    /(?:ISC|SHORT[\s\-]*CIRCUIT\s*CURRENT)\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*A/i,
  ], v => { const n = parseFloat(v); return n > 0 && n < 50 })
  if (isc) dados.isc = parseFloat(isc)

  // IMPP
  const impp = primeiraMatch(texto, [
    /(?:IMPP|IMP|CURRENT\s*AT\s*MAX[^0-9]{0,20})\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*A/i,
  ], v => { const n = parseFloat(v); return n > 0 && n < 50 })
  if (impp) dados.impp = parseFloat(impp)

  // Eficiência
  const ef = primeiraMatch(texto, [
    /(?:MODULE\s*EFFICIENCY|EFFICIENCY)\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%/i,
  ], v => { const n = parseFloat(v); return n > 5 && n < 30 })
  if (ef) dados.eficiencia = parseFloat(ef)

  return {
    fabricante: dados.fabricante || null,
    modelo: dados.modelo || null,
    tipo: 'modulo',
    variantes: [{ potenciaW: dados.potenciaW, voc: dados.voc, vmpp: dados.vmpp, isc: dados.isc, impp: dados.impp, eficiencia: dados.eficiencia }],
  }
}

// ── Normaliza resultado (IA ou regex) para o formato do frontend ──────────────

function normalizar(resultado) {
  const { fabricante, modelo, tipo = 'modulo', variantes = [] } = resultado
  const variantesNorm = Array.isArray(variantes) ? variantes : [variantes].filter(Boolean)
  const primeira = variantesNorm[0] || {}

  const dados = {
    fabricante: fabricante || null,
    modelo: modelo || null,
    potenciaW:    primeira.potenciaW    || null,
    voc:          primeira.voc          || null,
    vmpp:         primeira.vmpp         || null,
    isc:          primeira.isc          || null,
    impp:         primeira.impp         || null,
    eficiencia:   primeira.eficiencia   || null,
    potenciaKW:   primeira.potenciaKW   || resultado.potenciaKW   || null,
    nMppts:       primeira.nMppts       || resultado.nMppts       || null,
    correnteACSaida: primeira.correnteACSaida || resultado.correnteACSaida || null,
  }

  const camposEncontrados = Object.values(dados).filter(v => v !== null && v !== '').length

  const resposta = {
    sucesso: true,
    dados,
    qualityScore: Math.min(100, camposEncontrados * 12),
    avisos: [],
    _debug: { campos_encontrados: camposEncontrados },
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

    const parser = new PDFParse({ data: req.file.buffer })
    const textResult = await parser.getText()
    await parser.destroy()

    const textoPDF = textResult.text
    console.log(`📄 PDF lido: ${textoPDF.length} chars`)

    let resultado
    let metodo = 'regex'

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        resultado = await extrairComIA(textoPDF)
        metodo = 'ia'
        console.log('✅ IA extraiu:', JSON.stringify(resultado, null, 2))
      } catch (iaErr) {
        console.warn('⚠️ Falha na IA, usando regex:', iaErr.message)
        resultado = extrairPorRegex(textoPDF)
      }
    } else {
      console.warn('⚠️ ANTHROPIC_API_KEY não definida — usando extração por regex')
      resultado = extrairPorRegex(textoPDF)
    }

    const resposta = normalizar(resultado)
    resposta._debug.metodo = metodo

    res.json(resposta)
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
        voc: voc ? Number(voc) : null,
        vmpp: vmpp ? Number(vmpp) : null,
        isc: isc ? Number(isc) : null,
        impp: impp ? Number(impp) : null,
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
