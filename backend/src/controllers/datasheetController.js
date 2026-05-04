import { PDFParse } from 'pdf-parse'

// Palavras genéricas que NÃO são modelos de equipamento
const MODELO_BLACKLIST = new Set([
  'STANDARD', 'CERTIFIED', 'MODULE', 'INVERTER', 'SOLAR', 'SERIES',
  'PRODUCT', 'SYSTEM', 'POWER', 'ENERGY', 'LINEAR', 'NORMAL', 'GENERAL',
  'TYPE', 'TEST', 'CLASS', 'GRADE', 'LEVEL', 'QUALITY', 'WARRANTY',
  'MONO', 'POLY', 'BIFACIAL', 'DATASHEET', 'SPECIFICATIONS', 'TECHNICAL',
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

export async function extrairDatasheet(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ sucesso: false, erro: 'Arquivo PDF não fornecido' })
    }

    const parser = new PDFParse({ data: req.file.buffer })
    const textResult = await parser.getText()
    await parser.destroy()

    // Guarda original (para busca case-insensitive) e versão upper
    const textoOriginal = textResult.text
    const texto = textoOriginal.toUpperCase()
    // Primeiras linhas do documento (área do título/cabeçalho)
    const cabecalho = texto.substring(0, 600)

    console.log('📄 TEXTO PDF (primeiros 1500 chars):\n', texto.substring(0, 1500))

    const dados = {}

    // ── MARCA / FABRICANTE ───────────────────────────────────────────────────
    // Procura apenas nas primeiras 600 chars, foge de texto de garantia
    const marcaStr = primeiraMatch(cabecalho, [
      // Ex: "NPLUX ENERGY TECHNOLOGY CO.,LTD"
      /^([A-Z][A-Z\s]{2,30}?)\s+(?:ENERGY|SOLAR|TECHNOLOGY|POWER|INDUSTRIA|CO\.|INC\.|LTD)/m,
      // Ex: "JINKO SOLAR" no topo
      /^(JINKO|CANADIAN|TRINA|LONGI|JA SOLAR|BIFOCAL|NPLUX|RISEN|RECOM|ASTRONERGY|SERAPHIM|SUNTECH|HYUNDAI|HANWHA|YINGLI|CSUN|CHINT|GROWATT|DEYE|SUNGROW|FRONIUS|SMA|ABB|HUAWEI|WEG|SIEMENS)/m,
    ], v => v.length < 60 && !MODELO_BLACKLIST.has(v))
    if (marcaStr) dados.marca = marcaStr.replace(/\s+/g, ' ').trim()

    // ── MODELO ───────────────────────────────────────────────────────────────
    // Padrões típicos: SP-N16-144HG-570, JKM550M-72HL4, CS6W-545MS, etc.
    const modeloStr = primeiraMatch(texto, [
      // Padrão alfanumérico com pelo menos 2 segmentos separados por - ou _
      /(?:MODEL|TYPE|MODELO|SERIE|PART NO\.?)[\s:]*([A-Z0-9][A-Z0-9\-\_\/]{4,30})/,
      // Linha que contém W/WP isolado + sufixo de modelo no início da linha
      /^([A-Z]{1,5}[0-9]{2,4}[A-Z0-9\-\/]{3,20})/m,
    ], v => {
      if (MODELO_BLACKLIST.has(v)) return false
      // Deve ter pelo menos um número para ser um modelo real
      return /[0-9]/.test(v) && v.length >= 4
    })
    if (modeloStr) dados.modelo = modeloStr

    // ── POTÊNCIA (Wp) ────────────────────────────────────────────────────────
    // Ordem de preferência: PMAX ou PMPP na tabela de specs
    const potStr = primeiraMatch(texto, [
      /(?:PMAX|PMPP|MAXIMUM\s*POWER|MAX\s*POWER|RATED\s*POWER|PEAK\s*POWER)\s*[:\(]?[^0-9]{0,20}?([0-9]{3,4}(?:\.[0-9]+)?)\s*W(?!H)/i,
      /([0-9]{3,4})\s*W\s*(?:@|AT|STC|STCONDITIONS)/i,
      // Último recurso: qualquer número 100–999 seguido de W (evita kW)
      /\b([1-9][0-9]{2,3})\s*W(?![HK])/,
    ], v => { const n = parseInt(v); return n >= 50 && n <= 800 })
    if (potStr) dados.potenciaW = parseInt(potStr)

    // ── VOC ──────────────────────────────────────────────────────────────────
    const vocStr = primeiraMatch(texto, [
      /(?:VOC|OPEN[\s\-]*CIRCUIT\s*VOLTAGE)\s*[:\(]?[^0-9]{0,10}([0-9]{2,3}(?:\.[0-9]{1,2})?)\s*V/i,
      /V\s*OC\s*[:\(]?[^0-9]{0,5}([0-9]{2,3}(?:\.[0-9]{1,2})?)/i,
    ], v => { const n = parseFloat(v); return n > 10 && n < 500 })
    if (vocStr) dados.voc = parseFloat(vocStr)

    // ── VMPP ─────────────────────────────────────────────────────────────────
    const vmppStr = primeiraMatch(texto, [
      /(?:VMPP|VMP|MAXIMUM\s*POWER\s*VOLT(?:AGE)?|VOLTAGE\s*AT\s*MAX(?:IMUM)?\s*POWER)\s*[:\(]?[^0-9]{0,10}([0-9]{2,3}(?:\.[0-9]{1,2})?)\s*V/i,
      /V\s*MP(?:P)?\s*[:\(]?[^0-9]{0,5}([0-9]{2,3}(?:\.[0-9]{1,2})?)/i,
    ], v => { const n = parseFloat(v); return n > 10 && n < 500 })
    if (vmppStr) dados.vmpp = parseFloat(vmppStr)

    // ── ISC ──────────────────────────────────────────────────────────────────
    const iscStr = primeiraMatch(texto, [
      /(?:ISC|SHORT[\s\-]*CIRCUIT\s*CURRENT)\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*A/i,
      /I\s*SC\s*[:\(]?[^0-9]{0,5}([0-9]{1,2}(?:\.[0-9]{1,2})?)/i,
    ], v => { const n = parseFloat(v); return n > 0 && n < 50 })
    if (iscStr) dados.isc = parseFloat(iscStr)

    // ── IMPP ─────────────────────────────────────────────────────────────────
    const imppStr = primeiraMatch(texto, [
      /(?:IMPP|IMP|MAXIMUM\s*POWER\s*CURRENT|CURRENT\s*AT\s*MAX(?:IMUM)?\s*POWER)\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*A/i,
      /I\s*MP(?:P)?\s*[:\(]?[^0-9]{0,5}([0-9]{1,2}(?:\.[0-9]{1,2})?)/i,
    ], v => { const n = parseFloat(v); return n > 0 && n < 50 })
    if (imppStr) dados.impp = parseFloat(imppStr)

    // ── EFICIÊNCIA ───────────────────────────────────────────────────────────
    const efStr = primeiraMatch(texto, [
      /(?:MODULE\s*EFFICIENCY|EFICIÊNCIA|EFFICIENCY)\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%/i,
    ], v => { const n = parseFloat(v); return n > 5 && n < 30 })
    if (efStr) dados.eficiencia = parseFloat(efStr)

    // ── POTÊNCIA INVERSOR (kW) ────────────────────────────────────────────────
    if (!dados.potenciaW) {
      const kwStr = primeiraMatch(texto, [
        /(?:RATED|NOMINAL|OUTPUT)\s*(?:AC\s*)?POWER\s*[:\(]?[^0-9]{0,10}([0-9]+(?:\.[0-9]+)?)\s*KW/i,
        /([0-9]+(?:\.[0-9]+)?)\s*KW\s*(?:AC\s*)?(?:RATED|OUTPUT|NOMINAL)/i,
      ], v => { const n = parseFloat(v); return n > 0 && n < 2000 })
      if (kwStr) dados.potenciaKW = parseFloat(kwStr)
    }

    // ── MPPT (inversores) ─────────────────────────────────────────────────────
    const mpptStr = primeiraMatch(texto, [
      /(?:NUMBER\s*OF\s*MPPT|NO\.\s*OF\s*MPPT|MPPT\s*(?:QUANTITY|QTY|TRACKERS?))\s*[:\(]?[^0-9]{0,5}([0-9]+)/i,
      /([0-9]+)\s*(?:X\s*)?MPPT\s*(?:TRACKER|INPUT)/i,
    ], v => { const n = parseInt(v); return n > 0 && n < 20 })
    if (mpptStr) dados.nMppts = parseInt(mpptStr)

    // ── CORRENTE AC SAÍDA (inversores) ────────────────────────────────────────
    const iacStr = primeiraMatch(texto, [
      /(?:MAX(?:IMUM)?\s*(?:AC\s*)?OUTPUT\s*CURRENT|AC\s*OUTPUT\s*CURRENT)\s*[:\(]?[^0-9]{0,10}([0-9]+(?:\.[0-9]+)?)\s*A/i,
    ], v => { const n = parseFloat(v); return n > 0 && n < 1000 })
    if (iacStr) dados.correnteACSaida = parseFloat(iacStr)

    // ── VALIDAÇÕES ────────────────────────────────────────────────────────────
    const avisos = []
    if (dados.voc && dados.vmpp && dados.voc <= dados.vmpp)
      avisos.push(`VOC (${dados.voc}V) deveria ser maior que VMPP (${dados.vmpp}V)`)
    if (dados.isc && dados.impp && dados.isc <= dados.impp)
      avisos.push(`ISC (${dados.isc}A) deveria ser maior que IMPP (${dados.impp}A)`)
    if (dados.potenciaW && dados.vmpp && dados.impp) {
      const calc = dados.vmpp * dados.impp
      if (Math.abs(calc - dados.potenciaW) / dados.potenciaW > 0.15)
        avisos.push(`Pmpp calculado (${calc.toFixed(0)}W) difere do declarado (${dados.potenciaW}W)`)
    }

    const camposEncontrados = Object.keys(dados).length
    const qualityScore = Math.min(100, camposEncontrados * 12)

    console.log(`✅ ${camposEncontrados} campos extraídos`, dados)

    res.json({
      sucesso: true,
      dados,
      qualityScore,
      avisos,
      _debug: {
        chars: texto.length,
        campos_encontrados: camposEncontrados,
        texto_inicio: texto.substring(0, 800),
      },
    })
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
