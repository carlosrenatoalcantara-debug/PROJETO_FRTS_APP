import { PDFParse } from 'pdf-parse'

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

// Extrai todas ocorrências de números flutuantes de uma linha de texto
function numerosLinha(linha) {
  return [...linha.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map(m => parseFloat(m[1]))
}

/**
 * Tenta detectar múltiplas variantes de potência em um datasheet de série.
 * Retorna array de variantes ou null se o PDF não tiver tabela multi-coluna.
 */
function extrairVariantes(texto) {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // Localiza a seção de características elétricas
  let secaoIdx = 0
  for (let i = 0; i < linhas.length; i++) {
    if (/ELECTRICAL\s*CHAR|CARACTER.{0,5}STICA.{0,5}\s*EL.{0,5}TRICA|PARAMETROS?\s*EL/i.test(linhas[i])) {
      secaoIdx = i
      break
    }
  }

  // Procura uma linha com 3+ inteiros no intervalo 200–800 formando progressão aritmética
  let potencias = null
  let linhaPotIdx = -1

  const janela = linhas.slice(secaoIdx, secaoIdx + 60)
  for (let i = 0; i < janela.length; i++) {
    const ints = [...janela[i].matchAll(/\b(\d{3,4})\b/g)].map(m => parseInt(m[1]))
    const vals = ints.filter(n => n >= 200 && n <= 800)
    if (vals.length < 3) continue
    const diffs = vals.slice(1).map((v, j) => v - vals[j])
    const passo = diffs[0]
    if (passo > 0 && passo <= 25 && diffs.every(d => d === passo)) {
      potencias = vals
      linhaPotIdx = secaoIdx + i
      break
    }
  }

  if (!potencias) return null

  const n = potencias.length
  const variantes = potencias.map(p => ({ potenciaW: p }))

  // Busca os parâmetros nas linhas seguintes (até 35 linhas após a linha de potência)
  const bloco = linhas.slice(linhaPotIdx, linhaPotIdx + 35)

  const assignParam = (chave, filtro) => {
    for (const linha of bloco) {
      const nums = numerosLinha(linha).filter(filtro)
      if (nums.length >= n) {
        // Pega os últimos n valores (a label pode ter números no nome)
        const vals = nums.slice(-n)
        vals.forEach((v, i) => { variantes[i][chave] = v })
        return true
      }
    }
    return false
  }

  // Detecta cada linha pelos rótulos de parâmetro
  for (const linha of bloco) {
    const u = linha.toUpperCase()
    const nums = numerosLinha(linha)
    const floats = nums.filter(v => v !== Math.floor(v) || (v > 0 && v < 100))

    if (/VMP|VMPP|MAX.*VOLT|VOLTAGE.*MAX/i.test(u) && !/VOC/i.test(u)) {
      const vals = nums.filter(v => v > 10 && v < 200)
      if (vals.length >= n) vals.slice(-n).forEach((v, i) => { variantes[i].vmpp = v })
    } else if (/VOC|OPEN.{0,15}CIRCUIT.{0,10}VOLT/i.test(u)) {
      const vals = nums.filter(v => v > 10 && v < 200)
      if (vals.length >= n) vals.slice(-n).forEach((v, i) => { variantes[i].voc = v })
    } else if (/IMP|IMPP|MAX.*CURR|CURRENT.*MAX/i.test(u) && !/ISC/i.test(u)) {
      const vals = nums.filter(v => v > 0 && v < 50)
      if (vals.length >= n) vals.slice(-n).forEach((v, i) => { variantes[i].impp = v })
    } else if (/ISC|SHORT.{0,15}CIRCUIT.{0,10}CURR/i.test(u)) {
      const vals = nums.filter(v => v > 0 && v < 50)
      if (vals.length >= n) vals.slice(-n).forEach((v, i) => { variantes[i].isc = v })
    } else if (/EFFICI|EFICI/i.test(u)) {
      // Eficiência: normalmente 15–27%, pode vir como "21.8" ou "21,8"
      const vals = nums.filter(v => v > 5 && v < 35)
      if (vals.length >= n) vals.slice(-n).forEach((v, i) => { variantes[i].eficiencia = v })
    }
  }

  // Só retorna se extraiu pelo menos vmpp ou voc para a maioria das variantes
  const completas = variantes.filter(v => v.vmpp || v.voc).length
  if (completas < Math.floor(n / 2)) return null

  return variantes
}

export async function extrairDatasheet(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ sucesso: false, erro: 'Arquivo PDF não fornecido' })
    }

    const parser = new PDFParse({ data: req.file.buffer })
    const textResult = await parser.getText()
    await parser.destroy()

    const textoOriginal = textResult.text
    const texto = textoOriginal.toUpperCase()
    const cabecalho = texto.substring(0, 600)

    console.log('📄 TEXTO PDF (primeiros 1500 chars):\n', texto.substring(0, 1500))

    const dados = {}

    // ── MARCA / FABRICANTE ───────────────────────────────────────────────────
    const marcaStr = primeiraMatch(cabecalho, [
      /^([A-Z][A-Z\s]{2,30}?)\s+(?:ENERGY|SOLAR|TECHNOLOGY|POWER|INDUSTRIA|CO\.|INC\.|LTD)/m,
      /^(JINKO|CANADIAN|TRINA|LONGI|JA\s*SOLAR|NPLUX|RISEN|RECOM|ASTRONERGY|SERAPHIM|SUNTECH|HYUNDAI|HANWHA|YINGLI|CSUN|CHINT|GROWATT|DEYE|SUNGROW|FRONIUS|SMA|ABB|HUAWEI|WEG|SIEMENS|LEAPTON|ZNSHINE|ZN.SHINE|MFDA|TW.SOLAR|BIFOCAL|RS6|RENESOLA)/m,
    ], v => v.length < 60 && !MODELO_BLACKLIST.has(v))
    if (marcaStr) dados.marca = marcaStr.replace(/\s+/g, ' ').trim()

    // ── MODELO ───────────────────────────────────────────────────────────────
    const modeloStr = primeiraMatch(texto, [
      /(?:MODEL|TYPE|MODELO|SERIE|PART\s*NO\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\_\/\.]{4,35})/,
      /^([A-Z]{2,6}[0-9]{2,4}[A-Z0-9\-\/\.]{3,25})/m,
    ], v => {
      if (MODELO_BLACKLIST.has(v)) return false
      return /[0-9]/.test(v) && v.length >= 4
    })
    if (modeloStr) dados.modelo = modeloStr

    // ── MULTI-VARIANTE (série com várias potências) ──────────────────────────
    const variantes = extrairVariantes(texto)

    if (variantes && variantes.length > 1) {
      // Pega a primeira variante para preencher os campos principais
      const primeira = variantes[0]
      dados.potenciaW = primeira.potenciaW
      dados.voc = primeira.voc
      dados.vmpp = primeira.vmpp
      dados.isc = primeira.isc
      dados.impp = primeira.impp
      dados.eficiencia = primeira.eficiencia

      console.log(`🔢 ${variantes.length} variantes detectadas:`, variantes.map(v => v.potenciaW + 'W').join(', '))
    } else {
      // ── POTÊNCIA (Wp) ──────────────────────────────────────────────────────
      const potStr = primeiraMatch(texto, [
        /(?:PMAX|PMPP|MAXIMUM\s*POWER|MAX\s*POWER|RATED\s*POWER|PEAK\s*POWER)\s*[:\(]?[^0-9]{0,20}?([0-9]{3,4}(?:\.[0-9]+)?)\s*W(?!H)/i,
        /([0-9]{3,4})\s*W\s*(?:@|AT|STC)/i,
        /\b([1-9][0-9]{2,3})\s*W(?![HK])/,
      ], v => { const n = parseInt(v); return n >= 50 && n <= 800 })
      if (potStr) dados.potenciaW = parseInt(potStr)

      // ── VOC ───────────────────────────────────────────────────────────────
      const vocStr = primeiraMatch(texto, [
        /(?:VOC|OPEN[\s\-]*CIRCUIT\s*VOLTAGE)\s*[:\(]?[^0-9]{0,10}([0-9]{2,3}(?:\.[0-9]{1,2})?)\s*V/i,
        /V\s*OC\s*[:\(]?[^0-9]{0,5}([0-9]{2,3}(?:\.[0-9]{1,2})?)/i,
      ], v => { const n = parseFloat(v); return n > 10 && n < 500 })
      if (vocStr) dados.voc = parseFloat(vocStr)

      // ── VMPP ──────────────────────────────────────────────────────────────
      const vmppStr = primeiraMatch(texto, [
        /(?:VMPP|VMP|MAXIMUM\s*POWER\s*VOLT(?:AGE)?|VOLTAGE\s*AT\s*MAX(?:IMUM)?\s*POWER)\s*[:\(]?[^0-9]{0,10}([0-9]{2,3}(?:\.[0-9]{1,2})?)\s*V/i,
        /V\s*MP(?:P)?\s*[:\(]?[^0-9]{0,5}([0-9]{2,3}(?:\.[0-9]{1,2})?)/i,
      ], v => { const n = parseFloat(v); return n > 10 && n < 500 })
      if (vmppStr) dados.vmpp = parseFloat(vmppStr)

      // ── ISC ───────────────────────────────────────────────────────────────
      const iscStr = primeiraMatch(texto, [
        /(?:ISC|SHORT[\s\-]*CIRCUIT\s*CURRENT)\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*A/i,
        /I\s*SC\s*[:\(]?[^0-9]{0,5}([0-9]{1,2}(?:\.[0-9]{1,2})?)/i,
      ], v => { const n = parseFloat(v); return n > 0 && n < 50 })
      if (iscStr) dados.isc = parseFloat(iscStr)

      // ── IMPP ──────────────────────────────────────────────────────────────
      const imppStr = primeiraMatch(texto, [
        /(?:IMPP|IMP|MAXIMUM\s*POWER\s*CURRENT|CURRENT\s*AT\s*MAX(?:IMUM)?\s*POWER)\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*A/i,
        /I\s*MP(?:P)?\s*[:\(]?[^0-9]{0,5}([0-9]{1,2}(?:\.[0-9]{1,2})?)/i,
      ], v => { const n = parseFloat(v); return n > 0 && n < 50 })
      if (imppStr) dados.impp = parseFloat(imppStr)

      // ── EFICIÊNCIA ────────────────────────────────────────────────────────
      const efStr = primeiraMatch(texto, [
        /(?:MODULE\s*EFFICIENCY|EFICIÊNCIA|EFFICIENCY)\s*[:\(]?[^0-9]{0,10}([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%/i,
      ], v => { const n = parseFloat(v); return n > 5 && n < 30 })
      if (efStr) dados.eficiencia = parseFloat(efStr)
    }

    // ── POTÊNCIA INVERSOR (kW) — apenas se não houver potenciaW ─────────────
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

    const camposEncontrados = Object.keys(dados).length
    const qualityScore = Math.min(100, camposEncontrados * 12)

    console.log(`✅ ${camposEncontrados} campos extraídos`, dados)

    const resposta = {
      sucesso: true,
      dados,
      qualityScore,
      avisos,
      _debug: {
        chars: texto.length,
        campos_encontrados: camposEncontrados,
        texto_inicio: texto.substring(0, 800),
      },
    }

    if (variantes && variantes.length > 1) {
      resposta.variantes = variantes
    }

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
