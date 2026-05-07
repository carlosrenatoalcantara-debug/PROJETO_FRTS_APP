import Anthropic from '@anthropic-ai/sdk'
import { PDFParse } from 'pdf-parse'
import { DatasheetCache } from '../models/DatasheetCache.js'
import { Equipamento } from '../models/Equipamento.js'

// ─────────────────────────────────────────────────────────────────────────────
// CACHE: carrega exemplos de fabricantes já vistos para enriquecer o prompt
// ─────────────────────────────────────────────────────────────────────────────

async function carregarExemplosCache(fabricanteHint) {
  try {
    const query = fabricanteHint
      ? { fabricante: { $regex: fabricanteHint, $options: 'i' } }
      : {}
    // Até 4 fabricantes mais recentes como contexto
    const docs = await DatasheetCache.find(query).sort({ ultimaExtracao: -1 }).limit(4).lean()
    return docs
  } catch {
    return []
  }
}

async function salvarNoCache(resultado) {
  if (!resultado?.fabricante || !resultado?.modelo) return
  const { fabricante, modelo, variantes = [] } = resultado
  const potencias = variantes.map(v => v.potenciaW).filter(Boolean)
  const exemplo = variantes[0] || {}

  try {
    await DatasheetCache.findOneAndUpdate(
      { fabricante: { $regex: `^${fabricante}$`, $options: 'i' } },
      {
        $set:  { fabricante, ultimaExtracao: new Date() },
        $inc:  { totalExtrações: 1 },
        $push: {
          modelos: {
            $each: [{
              codigo: modelo,
              potencias,
              exemplo: {
                potenciaW:  exemplo.potenciaW  || null,
                voc:        exemplo.voc        || null,
                vmpp:       exemplo.vmpp       || null,
                isc:        exemplo.isc        || null,
                impp:       exemplo.impp       || null,
                eficiencia: exemplo.eficiencia || null,
              },
            }],
            // Não duplicar modelos já conhecidos
            $position: 0,
          },
        },
      },
      { upsert: true, new: true }
    )
    // Remove modelos duplicados mantendo apenas o mais recente de cada código
    await DatasheetCache.findOneAndUpdate(
      { fabricante: { $regex: `^${fabricante}$`, $options: 'i' } },
      [{ $set: {
        modelos: {
          $reduce: {
            input: '$modelos',
            initialValue: [],
            in: {
              $cond: [
                { $in: ['$$this.codigo', '$$value.codigo'] },
                '$$value',
                { $concatArrays: ['$$value', ['$$this']] },
              ],
            },
          },
        },
      }}]
    )
  } catch (e) {
    console.warn('Cache: erro ao salvar:', e.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRAÇÃO VIA CLAUDE — lê qualquer fabricante, qualquer potência, qualquer formato
// ─────────────────────────────────────────────────────────────────────────────

function montarPromptClaude(exemplosCache) {
  let contexto = ''
  if (exemplosCache.length > 0) {
    contexto = '\n\nFABRICANTES JÁ CONHECIDOS NO SISTEMA (use como referência de formato):\n'
    for (const doc of exemplosCache) {
      const m = doc.modelos?.[0]
      if (!m) continue
      contexto += `- ${doc.fabricante}: modelo ${m.codigo}, potências ${m.potencias.join('/')}W`
      if (m.exemplo?.voc) contexto += `, Voc≈${m.exemplo.voc}V, Vmpp≈${m.exemplo.vmpp}V`
      contexto += '\n'
    }
  }

  return `Você é especialista em equipamentos fotovoltaicos. Analise este datasheet e retorne SOMENTE um JSON válido, sem markdown, sem explicação.

REGRAS OBRIGATÓRIAS:
1. "fabricante": nome oficial da empresa (ex: ZNShine Solar, Risen Energy, Canadian Solar, Jinko Solar, Trina Solar, LONGi, JA Solar, BYD, Huawei, Fronius, SMA, WEG, Growatt, Solis, Deye, Sofar, Solax, GoodWe). NUNCA use "Desconhecido".
2. "modelo": código técnico do produto. NUNCA use certificações ISO/IEC/UL como modelo.
3. "tipo": "modulo" para painéis fotovoltaicos, "inversor" para inversores solares.
4. Para MÓDULOS com múltiplas potências na tabela: crie UMA variante para CADA potência listada.
5. Para INVERSORES: extraia TODOS os campos abaixo. São usados para gerar o diagrama unifilar completo.
6. Valores numéricos devem ser números. Use null se não encontrar.${contexto}

════════════════════════════════════════
FORMATO PARA MÓDULOS:
{
  "fabricante": "string",
  "modelo": "string",
  "tipo": "modulo",
  "variantes": [
    { "potenciaW": 560, "voc": 50.67, "vmpp": 41.95, "isc": 14.13, "impp": 13.35, "eficiencia": 21.68 }
  ]
}

════════════════════════════════════════
FORMATO PARA INVERSORES (extraia TUDO que encontrar):
{
  "fabricante": "string",
  "modelo": "string",
  "tipo": "inversor",
  "variantes": [{
    "potencia_nominal_kw":    <Potência AC nominal em kW — número>,
    "potencia_maxima_kw":     <Potência AC máxima em kW — número ou null>,
    "tensao_ac_nominal":      <Tensão AC nominal em V, ex: 220 ou 380>,
    "fases":                  <Número de fases: 1 ou 3>,
    "frequencia_hz":          <Frequência em Hz, ex: 60>,
    "corrente_ac_saida":      <Corrente AC de saída em A — número>,
    "fator_potencia":         <Fator de potência, ex: 1.0 ou ">0.99">,
    "thdi":                   <THD de corrente em %, ex: 3 — número ou null>,
    "n_mppts":                <Número de rastreadores MPPT — inteiro>,
    "strings_por_mppt":       <Número de entradas/strings por MPPT — inteiro ou null>,
    "tensao_mppt_min":        <Tensão mínima da faixa MPPT em V>,
    "tensao_mppt_max":        <Tensão máxima da faixa MPPT em V>,
    "tensao_max_entrada":     <Tensão máxima de entrada DC (Vmax) em V>,
    "corrente_max_entrada":   <Corrente máxima de entrada DC total em A>,
    "corrente_max_por_mppt":  <Corrente máxima por MPPT em A>,
    "corrente_isc_max":       <Corrente de curto-circuito máxima por string em A ou null>,
    "eficiencia_maxima":      <Eficiência máxima em %, ex: 98.4>,
    "eficiencia_europeia":    <Eficiência europeia EURO em % ou null>,
    "protecao_antiilhamento": <true/false ou "certificada" ou null>,
    "protecao_sobretensao_dc": <Tipo de proteção DC, ex: "Tipo II" ou null>,
    "protecao_sobretensao_ac": <Tipo de proteção AC ou null>,
    "grau_protecao_ip":       <Grau IP, ex: "IP65" ou "IP66">,
    "temperatura_operacao":   <Faixa de temperatura, ex: "-25 a +60°C">,
    "peso_kg":                <Peso em kg — número>,
    "dimensoes":              <Dimensões HxLxP em mm, ex: "365x315x135">,
    "garantia_anos":          <Garantia em anos — inteiro>
  }]
}`
}

async function extrairComClaude(pdfBuffer, exemplosCache = []) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') },
        },
        {
          type: 'text',
          text: montarPromptClaude(exemplosCache),
        },
      ],
    }],
  })

  const limpo = message.content[0].text.trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(limpo)
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSERS DE TEXTO — fallback para os 5 formatos conhecidos (sem API key)
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
    [/byd/i, 'BYD'],
    [/huawei/i, 'Huawei'],
    [/growatt/i, 'Growatt'],
    [/fronius/i, 'Fronius'],
    [/deye/i, 'Deye'],
    [/solis/i, 'Solis'],
    [/weg\b/i, 'WEG'],
    [/sma\b/i, 'SMA'],
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
    /\b(CS[0-9][A-Z0-9-]+)/i,
    /\b(TSM-[A-Z0-9-]+)/i,
    /\b(LR[0-9]-[0-9A-Z-]+)/i,
    /\b(JAM[0-9A-Z-]+)/i,
  ]
  for (const re of padroes) {
    const m = texto.match(re)
    if (m) return m[1]
  }
  return null
}

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
    impp:      imp ? parseFloat(imp[1])  : null,
    voc:       voc ? parseFloat(voc[1])  : null,
    isc:       isc ? parseFloat(isc[1])  : null,
    eficiencia: ef ? parseFloat(ef[1])   : null,
  }]
}

function parsearZNShineInline(linhas) {
  const variantes = []
  for (const linha of linhas) {
    const m = linha.match(/^(\d{3,4})\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/)
    if (!m) continue
    const p = parseInt(m[1]), vmpp = parseFloat(m[2]), impp = parseFloat(m[3])
    const voc = parseFloat(m[4]), isc = parseFloat(m[5]), eta = parseFloat(m[6])
    if (p < 200 || p > 800 || vmpp < 25 || vmpp > 60 || voc < 30 || voc > 80 || eta < 10 || eta > 30) continue
    variantes.push({ potenciaW: p, vmpp, impp, voc, isc, eficiencia: eta })
  }
  return variantes
}

function parsearZNShineVertical(linhas) {
  const nums = []
  for (const l of linhas) {
    const m = l.match(/^([\d.]+)\s*$/)
    if (m) nums.push(parseFloat(m[1]))
  }
  const variantes = []
  let i = 0
  while (i < nums.length - 5) {
    const [p, vmpp, impp, voc, isc, eta] = nums.slice(i, i + 6)
    if (Number.isInteger(p) && p >= 200 && p <= 800 &&
        vmpp >= 30 && vmpp <= 55 && impp >= 10 && impp <= 22 &&
        voc >= 38 && voc <= 75 && isc >= 10 && isc <= 25 && eta >= 15 && eta <= 30) {
      variantes.push({ potenciaW: p, vmpp, impp, voc, isc, eficiencia: eta })
      i += 6
    } else i++
  }
  return variantes
}

function parsearRS6Horizontal(texto) {
  if (!/RS6/i.test(texto)) return []
  const potSet = new Set()
  for (const m of texto.matchAll(/RS6-(\d{3})~(\d{3})NBG/gi)) {
    const s = parseInt(m[1]), e = parseInt(m[2])
    for (let p = s; p <= e; p += 5) potSet.add(p)
  }
  for (const m of texto.matchAll(/RS6-(\d{3,4})[A-Z0-9-]*NBG/gi)) {
    const p = parseInt(m[1])
    if (p >= 200 && p <= 800) potSet.add(p)
  }
  if (potSet.size < 2) {
    const potRow = texto.match(/\b(\d{3}W(?:\s+\d{3}W)+)/g)
    if (potRow) for (const row of potRow) for (const m of row.matchAll(/(\d{3})W/g)) {
      const w = parseInt(m[1]); if (w >= 200 && w <= 800) potSet.add(w)
    }
    for (const m of texto.matchAll(/(\d{3})W\d{2}\.\d{2}%/g)) {
      const p = parseInt(m[1]); if (p >= 200 && p <= 800) potSet.add(p)
    }
  }
  const pots = [...potSet].sort((a, b) => a - b)
  if (pots.length < 2) return []
  const n = pots.length
  const efMap = new Map()
  for (const m of texto.matchAll(/(\d{3})W(\d{2}\.\d{2})%/g)) {
    const p = parseInt(m[1]), ef = parseFloat(m[2])
    if (p >= 200 && p <= 800 && ef > 15 && ef < 30) efMap.set(p, ef)
  }
  const efSoltos = [...texto.matchAll(/\b(\d{2}\.\d{2})%/g)].map(m => parseFloat(m[1])).filter(v => v > 15 && v < 30)
  const efs = pots.map((p, i) => efMap.get(p) || efSoltos[i] || null)
  const allVolts = [...texto.matchAll(/\b(\d{2}\.\d{2})V/g)].map(m => parseFloat(m[1])).filter(v => v > 25)
  const vmppArr = allVolts.filter(v => v < 48).slice(0, n)
  const vocArr  = allVolts.filter(v => v >= 48).slice(0, n)
  const allAmps = [...texto.matchAll(/\b(\d{2}\.\d{2})A/g)].map(m => parseFloat(m[1])).filter(v => v > 8 && v < 25)
  const imppArr = allAmps.filter(v => v < 14).slice(0, n)
  const iscArr  = allAmps.filter(v => v >= 14).slice(0, n)
  return pots.map((p, i) => ({
    potenciaW: p, eficiencia: efs[i] || null,
    impp: imppArr[i] || null, vmpp: vmppArr[i] || null,
    isc: iscArr[i] || null, voc: vocArr[i] || null,
  }))
}

function parsearRisenRSM(texto, linhas) {
  if (!/RSM/i.test(texto)) return []
  const bmdgVals = [...texto.matchAll(/(\d{3,4})BMDG/gi)].map(m => parseInt(m[1])).filter(p => p >= 200 && p <= 800)
  let pots = []
  if (bmdgVals.length >= 2) {
    const pMin = Math.min(...bmdgVals), pMax = Math.max(...bmdgVals)
    for (let p = pMin; p <= pMax; p += 5) pots.push(p)
  } else if (bmdgVals.length === 1) pots = bmdgVals
  if (pots.length < 1) return []
  const efVals = []
  for (const l of linhas) for (const m of l.matchAll(/\b(\d{2}\.\d)\b/g)) {
    const v = parseFloat(m[1]); if (v >= 18 && v <= 26) efVals.push(v)
  }
  const efUnicos = [...new Set(efVals)].sort((a, b) => a - b).slice(0, pots.length)
  const efs = new Map()
  pots.forEach((p, i) => { if (efUnicos[i] !== undefined) efs.set(p, efUnicos[i]) })
  const allFloats = []
  for (const l of linhas) for (const m of l.matchAll(/\b(\d{2}\.\d{2})\b/g)) allFloats.push(parseFloat(m[1]))
  const grupos = []
  let fi = 0
  while (fi < allFloats.length - 3 && grupos.length < pots.length) {
    const [v1, v2, v3, v4] = allFloats.slice(fi, fi + 4)
    if (v1 >= 36 && v1 <= 42 && v2 >= 17 && v2 <= 20 && v3 >= 30 && v3 <= 34 && v4 >= 16 && v4 <= 18.5) {
      grupos.push({ voc: v1, isc: v2, vmpp: v3, impp: v4 }); fi += 4
    } else fi++
  }
  grupos.sort((a, b) => a.voc - b.voc)
  return pots.map((p, i) => ({
    potenciaW: p, eficiencia: efs.get(p) || null,
    voc: grupos[i]?.voc || null, isc: grupos[i]?.isc || null,
    vmpp: grupos[i]?.vmpp || null, impp: grupos[i]?.impp || null,
  }))
}

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
// NORMALIZAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

function normalizar(resultado, metodo) {
  const { fabricante, modelo, tipo = 'modulo', variantes = [] } = resultado
  const variantesNorm = Array.isArray(variantes) ? variantes : [variantes].filter(Boolean)
  const primeira = variantesNorm[0] || {}

  // Campos comuns
  const dados = { fabricante: fabricante || null, modelo: modelo || null, tipo }

  if (tipo === 'inversor') {
    // Todos os campos técnicos do inversor — passados diretamente para o frontend
    Object.assign(dados, {
      potenciaKW:            primeira.potencia_nominal_kw   || primeira.potenciaKW          || null,
      potencia_nominal_kw:   primeira.potencia_nominal_kw                                   || null,
      potencia_maxima_kw:    primeira.potencia_maxima_kw                                    || null,
      tensao_ac:             primeira.tensao_ac_nominal     || primeira.tensao_ac            || null,
      fases:                 primeira.fases                 || primeira.faseAC               || null,
      frequencia_hz:         primeira.frequencia_hz                                         || null,
      corrente_ac_saida:     primeira.corrente_ac_saida     || primeira.correnteACSaida      || null,
      fator_potencia:        primeira.fator_potencia                                        || null,
      thdi:                  primeira.thdi                                                  || null,
      nMppts:                primeira.n_mppts               || primeira.nMppts               || null,
      n_mppts:               primeira.n_mppts               || primeira.nMppts               || null,
      strings_por_mppt:      primeira.strings_por_mppt                                      || null,
      tensaoMpptMin:         primeira.tensao_mppt_min       || primeira.tensaoMpptMin        || null,
      tensao_mppt_min:       primeira.tensao_mppt_min       || primeira.tensaoMpptMin        || null,
      tensaoMpptMax:         primeira.tensao_mppt_max       || primeira.tensaoMpptMax        || null,
      tensao_mppt_max:       primeira.tensao_mppt_max       || primeira.tensaoMpptMax        || null,
      tensao_max_entrada:    primeira.tensao_max_entrada                                    || null,
      corrente_max_entrada:  primeira.corrente_max_entrada                                  || null,
      corrente_max_por_mppt: primeira.corrente_max_por_mppt                                 || null,
      corrente_isc_max:      primeira.corrente_isc_max                                      || null,
      eficiencia:            primeira.eficiencia_maxima     || primeira.eficiencia            || null,
      eficiencia_maxima:     primeira.eficiencia_maxima                                     || null,
      eficiencia_europeia:   primeira.eficiencia_europeia                                   || null,
      protecao_antiilhamento: primeira.protecao_antiilhamento                               || null,
      protecao_sobretensao_dc: primeira.protecao_sobretensao_dc                             || null,
      protecao_sobretensao_ac: primeira.protecao_sobretensao_ac                             || null,
      grau_protecao_ip:      primeira.grau_protecao_ip                                     || null,
      temperatura_operacao:  primeira.temperatura_operacao                                  || null,
      peso_kg:               primeira.peso_kg                                               || null,
      dimensoes:             primeira.dimensoes                                             || null,
      garantia_anos:         primeira.garantia_anos                                         || null,
    })
  } else {
    Object.assign(dados, {
      potenciaW:  primeira.potenciaW  || null,
      voc:        primeira.voc        || null,
      vmpp:       primeira.vmpp       || null,
      isc:        primeira.isc        || null,
      impp:       primeira.impp       || null,
      eficiencia: primeira.eficiencia || null,
    })
  }

  const camposEncontrados = Object.values(dados).filter(v => v !== null && v !== '').length
  const resposta = {
    sucesso: true,
    dados,
    qualityScore: Math.min(100, camposEncontrados * 5),
    avisos: [],
    _debug: { campos_encontrados: camposEncontrados, metodo, tipo },
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
      // Carrega exemplos do cache para enriquecer o contexto do Claude
      const exemplos = await carregarExemplosCache()
      try {
        resultado = await extrairComClaude(pdfBuffer, exemplos)
        metodo = 'claude-pdf'
        console.log(`✅ Claude extraiu: ${resultado.fabricante} | ${resultado.modelo} | ${resultado.variantes?.length || 1} variante(s)`)
        // Salva no cache para aprendizado futuro
        await salvarNoCache(resultado)
      } catch (err) {
        console.warn('⚠️ Claude indisponível, usando parser de texto:', err.message)
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

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: lista fabricantes aprendidos
// ─────────────────────────────────────────────────────────────────────────────

export async function listarFabricantesAprendidos(req, res) {
  try {
    const docs = await DatasheetCache.find({}).sort({ totalExtrações: -1 }).lean()
    res.json({
      total: docs.length,
      fabricantes: docs.map(d => ({
        fabricante:     d.fabricante,
        modelos:        d.modelos.map(m => m.codigo),
        totalExtrações: d.totalExtrações,
        ultimaExtracao: d.ultimaExtracao,
      })),
    })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEDUPLICAÇÃO: verifica se módulo já existe antes de salvar
// ─────────────────────────────────────────────────────────────────────────────

export async function verificarDuplicata(req, res) {
  try {
    const { fabricante, modelo, potenciaW, tipo = 'modulo' } = req.query
    if (!fabricante || !modelo) return res.json({ duplicata: false })

    const modeloBase = tipo === 'modulo'
      ? modelo.replace(/[-\d]+W$/, '')
      : modelo

    const query = {
      tipo,
      fabricante: { $regex: fabricante.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      modelo:     { $regex: modeloBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    }
    if (potenciaW && tipo === 'modulo') query['especificacoes.potencia_wp'] = Number(potenciaW)

    const existe = await Equipamento.findOne(query).lean()
    res.json({ duplicata: !!existe, equipamento: existe || null })
  } catch (err) {
    res.status(500).json({ erro: err.message })
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
