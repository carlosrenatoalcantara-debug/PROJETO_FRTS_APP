import Anthropic from '@anthropic-ai/sdk'
import { PDFParse } from 'pdf-parse'

// ─────────────────────────────────────────────────────────────────────────────
// EXTRAÇÃO VIA CLAUDE (PDF binário nativo — melhor qualidade)
// ─────────────────────────────────────────────────────────────────────────────

async function extrairComClaude(pdfBuffer) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') },
        },
        {
          type: 'text',
          text: `Você é especialista em equipamentos fotovoltaicos. Analise este datasheet e retorne SOMENTE um JSON válido, sem markdown.

REGRAS:
- "fabricante": nome da empresa (ex: ZNShine Solar, Risen Energy, Renesola, TW Solar, Sirius Energias Renováveis). Nunca "Desconhecido".
- "modelo": código técnico (ex: ZXMR-UPLDD144, RSM110-8-540BMDG, RS6-560NBG, SIRIUS-HD144N-550, TW-M10-66HD). Nunca certificações ISO/IEC.
- "tipo": "modulo" ou "inversor".
- Se houver múltiplas potências na mesma tabela, crie uma variante para cada (ex: 560W, 565W, 570W, 575W, 580W).
- Valores numéricos devem ser números. Use null se não encontrar.

FORMATO:
{
  "fabricante": "string",
  "modelo": "string",
  "tipo": "modulo",
  "variantes": [
    { "potenciaW": 590, "voc": 52.0, "vmpp": 43.5, "isc": 14.47, "impp": 13.57, "eficiencia": 21.8 }
  ]
}`,
        },
      ],
    }],
  })

  const limpo = message.content[0].text.trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(limpo)
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRAÇÃO POR TEXTO INTELIGENTE (fallback sem API key)
// Suporta todos os formatos identificados nos datasheets reais:
//   A. Sirius: chave-valor português
//   B. ZN-Shine 600W: 6 números em linha (pmax vmpp impp voc isc eta)
//   C. ZN-Shine 570W: blocos verticais de 6 linhas por variante
//   D. RS6/Renesola: usa códigos de modelo RS6-(\d{3})NBG para potências exatas
//   E. Risen/RSM: usa códigos de modelo RSM\d+-\d+-(\d{3})BMDG para potências exatas
// ─────────────────────────────────────────────────────────────────────────────

function detectarFabricante(texto) {
  const mapa = [
    [/znshine|zn.shine|znshine pv/i, 'ZNShine Solar'],
    [/risen energy|risenenergy/i, 'Risen Energy'],
    [/renesola/i, 'Renesola'],
    [/sirius energia/i, 'Sirius Energias Renováveis'],
    [/tw.solar|tongwei/i, 'TW Solar'],
    [/jinko/i, 'Jinko Solar'],
    [/canadian solar/i, 'Canadian Solar'],
    [/trina solar/i, 'Trina Solar'],
    [/longi/i, 'LONGi Solar'],
    [/ja solar/i, 'JA Solar'],
    [/leapton/i, 'Leapton Solar'],
  ]
  for (const [re, nome] of mapa) {
    if (re.test(texto)) return nome
  }
  return null
}

function detectarModelo(texto) {
  const padroes = [
    /\b(ZXMR-[A-Z0-9]+)/i,
    /\b(ZXNR-[A-Z0-9]+)/i,
    /\b(RSM[0-9]+-[0-9]+-[0-9A-Z]+BMDG[A-Z0-9-]*)/i,
    /\b(RS6-[0-9~]+-?[0-9A-Z]*NBG[A-Z0-9-]*)/i,
    /\b(SIRIUS-[A-Z0-9-]+)/i,
    /\b(TW-[A-Z0-9-]+)/i,
    /\b(JKM[0-9A-Z-]+)/i,
  ]
  for (const re of padroes) {
    const m = texto.match(re)
    if (m) return m[1]
  }
  return null
}

// Formato A: Sirius — chave-valor português
function parsearSirius(texto) {
  const pmax = texto.match(/Pmax\s*\(W\)\s+([\d.]+)/i)
  const vmp  = texto.match(/Vmp\s*\(V\)\s+([\d.]+)/i)
  const imp  = texto.match(/Imp\s*\(A\)\s+([\d.]+)/i)
  const voc  = texto.match(/Voc\s*\(V\)\s+([\d.]+)/i)
  const isc  = texto.match(/Isc\s*\(A\)\s+([\d.]+)/i)
  const ef   = texto.match(/Efici[eê]ncia do M[oó]dulo\s+([\d.]+)/i)
  if (!pmax || !vmp) return []
  return [{
    potenciaW: parseFloat(pmax[1]),
    vmpp:      parseFloat(vmp[1]),
    impp:      imp  ? parseFloat(imp[1])  : null,
    voc:       voc  ? parseFloat(voc[1])  : null,
    isc:       isc  ? parseFloat(isc[1])  : null,
    eficiencia: ef  ? parseFloat(ef[1])   : null,
  }]
}

// Formato B: ZN-Shine 600W — linha com 6 números: pmax vmpp impp voc isc eta
function parsearZNShineInline(linhas) {
  const variantes = []
  for (const linha of linhas) {
    const m = linha.match(/^(\d{3,4})\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/)
    if (!m) continue
    const p    = parseInt(m[1])
    const vmpp = parseFloat(m[2])
    const impp = parseFloat(m[3])
    const voc  = parseFloat(m[4])
    const isc  = parseFloat(m[5])
    const eta  = parseFloat(m[6])
    if (p < 200 || p > 800) continue
    if (vmpp < 25 || vmpp > 60) continue
    if (voc  < 30 || voc  > 80) continue
    if (eta  < 10 || eta  > 30) continue
    variantes.push({ potenciaW: p, vmpp, impp, voc, isc, eficiencia: eta })
  }
  return variantes
}

// Formato C: ZN-Shine 570W — blocos verticais: [int pmax, vmpp, impp, voc, isc, eta] 6 linhas seguidas
function parsearZNShineVertical(linhas) {
  const nums = []
  for (const l of linhas) {
    const m = l.match(/^([\d.]+)\s*$/)
    if (m) nums.push(parseFloat(m[1]))
  }
  const variantes = []
  let i = 0
  while (i < nums.length - 5) {
    const p    = nums[i]
    const vmpp = nums[i+1]
    const impp = nums[i+2]
    const voc  = nums[i+3]
    const isc  = nums[i+4]
    const eta  = nums[i+5]
    if (Number.isInteger(p) && p >= 200 && p <= 800 &&
        vmpp >= 30 && vmpp <= 55 &&
        impp >= 10 && impp <= 22 &&
        voc  >= 38 && voc  <= 75 &&
        isc  >= 10 && isc  <= 25 &&
        eta  >= 15 && eta  <= 30) {
      variantes.push({ potenciaW: p, vmpp, impp, voc, isc, eficiencia: eta })
      i += 6
    } else {
      i++
    }
  }
  return variantes
}

// Formato D: RS6/Renesola — extrai potências dos códigos de modelo RS6-(\d{3})NBG
// Lida com notação de faixa RS6-560~580NBG e com "580W22.45%" concatenado no texto
function parsearRS6Horizontal(texto) {
  if (!/RS6/i.test(texto)) return []

  const potSet = new Set()

  // Notação de faixa: RS6-560~580NBG → 560, 565, 570, 575, 580
  for (const m of texto.matchAll(/RS6-(\d{3})~(\d{3})NBG/gi)) {
    const s = parseInt(m[1]), e = parseInt(m[2])
    for (let p = s; p <= e; p += 5) potSet.add(p)
  }

  // Potências individuais em códigos de modelo: RS6-560NBG
  for (const m of texto.matchAll(/RS6-(\d{3,4})[A-Z0-9-]*NBG/gi)) {
    const p = parseInt(m[1])
    if (p >= 200 && p <= 800) potSet.add(p)
  }

  // Fallback W-sufixo (ex: "560W 565W 570W 575W")
  if (potSet.size < 2) {
    const potRow = texto.match(/\b(\d{3}W(?:\s+\d{3}W)+)/g)
    if (potRow) {
      for (const row of potRow) {
        for (const m of row.matchAll(/(\d{3})W/g)) {
          const w = parseInt(m[1])
          if (w >= 200 && w <= 800) potSet.add(w)
        }
      }
    }
    // Concatenado: "580W22.45%"
    for (const m of texto.matchAll(/(\d{3})W\d{2}\.\d{2}%/g)) {
      const p = parseInt(m[1])
      if (p >= 200 && p <= 800) potSet.add(p)
    }
  }

  let pots = [...potSet].sort((a, b) => a - b)

  if (pots.length < 2) return []

  const n = pots.length

  // Eficiência: percentuais soltos + concatenados do tipo "580W22.45%"
  const efMap = new Map()
  for (const m of texto.matchAll(/(\d{3})W(\d{2}\.\d{2})%/g)) {
    const p = parseInt(m[1]); const ef = parseFloat(m[2])
    if (p >= 200 && p <= 800 && ef > 15 && ef < 30) efMap.set(p, ef)
  }
  const efSoltos = [...texto.matchAll(/\b(\d{2}\.\d{2})%/g)].map(m => parseFloat(m[1]))
    .filter(v => v > 15 && v < 30)
  const efs = pots.map((p, i) => efMap.get(p) || efSoltos[i] || null)

  // Separa Vmpp (<48V) de Voc (>=48V) por range — PDFParse pode misturar a ordem das colunas
  const allVolts = [...texto.matchAll(/\b(\d{2}\.\d{2})V/g)].map(m => parseFloat(m[1])).filter(v => v > 25)
  const vmppArr = allVolts.filter(v => v < 48).slice(0, n)
  const vocArr  = allVolts.filter(v => v >= 48).slice(0, n)

  // Separa Impp (<14A) de Isc (>=14A) por range
  const allAmps = [...texto.matchAll(/\b(\d{2}\.\d{2})A/g)].map(m => parseFloat(m[1])).filter(v => v > 8 && v < 25)
  const imppArr = allAmps.filter(v => v < 14).slice(0, n)
  const iscArr  = allAmps.filter(v => v >= 14).slice(0, n)

  return pots.map((p, i) => ({
    potenciaW:  p,
    eficiencia: efs[i]     || null,
    impp:       imppArr[i] || null,
    vmpp:       vmppArr[i] || null,
    isc:        iscArr[i]  || null,
    voc:        vocArr[i]  || null,
  }))
}

// Formato E: Risen RSM — extrai potências dos códigos de modelo RSM\d+-\d+-(\d{3})BMDG
// Lida com "RSM110-8-530BMDG-550BMDG" (min~max) e com falsos positivos de tabelas NMOT
function parsearRisenRSM(texto, linhas) {
  if (!/RSM/i.test(texto)) return []

  // Coleta todos os valores BMDG: RSM110-8-530BMDG-550BMDG → [530, 550]
  const bmdgVals = [...texto.matchAll(/(\d{3,4})BMDG/gi)]
    .map(m => parseInt(m[1])).filter(p => p >= 200 && p <= 800)

  let pots = []
  if (bmdgVals.length >= 2) {
    // Expande do menor ao maior em steps de 5: 530→550 = [530,535,540,545,550]
    const pMin = Math.min(...bmdgVals), pMax = Math.max(...bmdgVals)
    for (let p = pMin; p <= pMax; p += 5) pots.push(p)
  } else if (bmdgVals.length === 1) {
    pots = bmdgVals
  }

  if (pots.length < 1) return []

  // Eficiência: coleta todos os valores XX.X em faixa 18-26, ordena e associa às potências ordenadas
  const efVals = []
  for (const l of linhas) {
    for (const m of l.matchAll(/\b(\d{2}\.\d)\b/g)) {
      const v = parseFloat(m[1])
      if (v >= 18 && v <= 26) efVals.push(v)
    }
  }
  const efUnicos = [...new Set(efVals)].sort((a, b) => a - b).slice(0, pots.length)
  const efs = new Map()
  pots.forEach((p, i) => { if (efUnicos[i] !== undefined) efs.set(p, efUnicos[i]) })

  // O PDF Risen produz cada valor numa linha individual. Coletamos todos os XX.XX em ordem
  // e procuramos sequências de 4 que correspondem a [Voc, Isc, Vmpp, Impp] de uma variante.
  const allFloats = []
  for (const l of linhas) {
    const nums = [...l.matchAll(/\b(\d{2}\.\d{2})\b/g)].map(m => parseFloat(m[1]))
    for (const v of nums) allFloats.push(v)
  }

  // Coleta grupos [Voc, Isc, Vmpp, Impp] e ordena por Voc crescente para alinhar com potências crescentes
  const grupos = []
  let fi = 0
  while (fi < allFloats.length - 3 && grupos.length < pots.length) {
    const [v1, v2, v3, v4] = allFloats.slice(fi, fi+4)
    if (v1 >= 36 && v1 <= 42 && v2 >= 17 && v2 <= 20 && v3 >= 30 && v3 <= 34 && v4 >= 16 && v4 <= 18.5) {
      grupos.push({ voc: v1, isc: v2, vmpp: v3, impp: v4 })
      fi += 4
    } else {
      fi++
    }
  }
  grupos.sort((a, b) => a.voc - b.voc)

  return pots.map((p, i) => ({
    potenciaW:  p,
    eficiencia: efs.get(p)     || null,
    voc:        grupos[i]?.voc  || null,
    isc:        grupos[i]?.isc  || null,
    vmpp:       grupos[i]?.vmpp || null,
    impp:       grupos[i]?.impp || null,
  }))
}

// Orquestrador da extração por texto
async function extrairPorTexto(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer })
  const result = await parser.getText()
  await parser.destroy()
  const texto = result.text
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean)

  const fabricante = detectarFabricante(texto)
  const modelo     = detectarModelo(texto)

  let variantes = []

  variantes = parsearSirius(texto)
  if (!variantes.length) variantes = parsearZNShineInline(linhas)
  if (!variantes.length) variantes = parsearRS6Horizontal(texto)
  if (!variantes.length) variantes = parsearRisenRSM(texto, linhas)
  if (!variantes.length) variantes = parsearZNShineVertical(linhas)

  return { fabricante, modelo, tipo: 'modulo', variantes }
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZAÇÃO (mesmo formato para Claude e regex)
// ─────────────────────────────────────────────────────────────────────────────

function normalizar(resultado, metodo) {
  const { fabricante, modelo, tipo = 'modulo', variantes = [] } = resultado
  const variantesNorm = Array.isArray(variantes) ? variantes : [variantes].filter(Boolean)
  const primeira = variantesNorm[0] || {}

  const dados = {
    fabricante:       fabricante              || null,
    modelo:           modelo                  || null,
    potenciaW:        primeira.potenciaW      || null,
    voc:              primeira.voc            || null,
    vmpp:             primeira.vmpp           || null,
    isc:              primeira.isc            || null,
    impp:             primeira.impp           || null,
    eficiencia:       primeira.eficiencia     || null,
    potenciaKW:       primeira.potenciaKW     || resultado.potenciaKW     || null,
    nMppts:           primeira.nMppts         || resultado.nMppts         || null,
    correnteACSaida:  primeira.correnteACSaida || resultado.correnteACSaida || null,
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

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export async function extrairDatasheet(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ sucesso: false, erro: 'Arquivo PDF não fornecido' })
    }

    const pdfBuffer = req.file.buffer
    console.log(`📄 PDF recebido: ${pdfBuffer.length} bytes`)

    let resultado, metodo
    const avisosClaude = []

    if (process.env.ANTHROPIC_API_KEY) {
      // Claude é sempre o método principal — garante leitura precisa de modelo e dados
      try {
        resultado = await extrairComClaude(pdfBuffer)
        metodo = 'claude-pdf'
        console.log('✅ Claude extraiu:', JSON.stringify(resultado, null, 2))
      } catch (err) {
        console.warn('⚠️ Claude indisponível, usando parser de texto como contingência:', err.message)
        resultado = await extrairPorTexto(pdfBuffer)
        metodo = 'texto-contingencia'
        avisosClaude.push('Claude temporariamente indisponível — verifique o modelo e os dados antes de salvar.')
      }
    } else {
      console.warn('⚠️ ANTHROPIC_API_KEY não configurada — usando parser de texto')
      resultado = await extrairPorTexto(pdfBuffer)
      metodo = 'texto'
      avisosClaude.push('Chave Claude não configurada — leitura por parser de texto. Verifique o modelo e os dados antes de salvar.')
    }

    const resposta = normalizar(resultado, metodo)
    if (avisosClaude.length) resposta.avisos = [...(resposta.avisos || []), ...avisosClaude]
    res.json(resposta)
  } catch (err) {
    console.error('❌ Erro:', err)
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
        potenciaW: Number(potenciaW), voc: voc ? Number(voc) : null,
        vmpp: vmpp ? Number(vmpp) : null, isc: isc ? Number(isc) : null,
        impp: impp ? Number(impp) : null, eficiencia: eficiencia ? Number(eficiencia) : null,
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
        potenciaKW: Number(potenciaKW), faseAC: faseAC ? Number(faseAC) : 1,
        nMppts: Number(nMppts) || 1, tensaoMpptMin: Number(tensaoMpptMin) || 200,
        tensaoMpptMax: Number(tensaoMpptMax) || 800, garantia: Number(garantia) || 10,
        criacao: new Date().toISOString(),
      },
      mensagem: 'Inversor cadastrado com sucesso',
    })
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}
