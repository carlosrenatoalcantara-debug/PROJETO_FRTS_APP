import { PDFParse } from 'pdf-parse'

export async function extrairDatasheet(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ sucesso: false, erro: 'Arquivo PDF não fornecido' })
    }

    const parser = new PDFParse({ data: req.file.buffer })
    const textResult = await parser.getText()
    const texto = textResult.text.toUpperCase()
    await parser.destroy()

    const dados = {}

    // ===== MODELO =====
    for (const re of [
      /MODEL[\s:]*([A-Z0-9\-\/_]+)/,
      /TYPE[\s:]*([A-Z0-9\-\/_]+)/,
      /MODELO[\s:]*([A-Z0-9\-\/_]+)/,
      /^([A-Z0-9\-\/_]+)[\s]*(SERIES|MODULE|INVERTER)/m,
    ]) {
      const m = texto.match(re)
      if (m?.[1]) { dados.modelo = m[1].trim(); break }
    }

    // ===== FABRICANTE / MARCA =====
    for (const re of [
      /MANUFACTURER[\s:]*([A-Z][A-Z\s]{2,40}?)(?:\n|$)/,
      /FABRICANTE[\s:]*([A-Z][A-Z\s]{2,40}?)(?:\n|$)/,
      /^([A-Z][A-Z\s]{2,30}?)\s+(?:MODULE|SOLAR|ENERGY|POWER)/m,
    ]) {
      const m = texto.match(re)
      if (m?.[1] && m[1].trim().length < 50) { dados.marca = m[1].trim(); break }
    }

    // ===== POTÊNCIA Wp (módulo) =====
    for (const re of [
      /RATED[\s:]*POWER[\s:]*([0-9]+(?:\.[0-9]+)?)\s*W(?!\w)/i,
      /MAXIMUM[\s]*POWER[\s]*\(?PMPP\)?[\s:]*([0-9]+(?:\.[0-9]+)?)\s*W/i,
      /PMPP[\s:]*([0-9]+(?:\.[0-9]+)?)\s*W/i,
      /([0-9]+(?:\.[0-9]+)?)\s*WP/i,
      /([0-9]+)\s*W\s*(?:@|AT)\s*STC/i,
    ]) {
      const m = texto.match(re)
      if (m?.[1]) {
        const v = parseInt(m[1])
        if (v > 50 && v < 800) { dados.potenciaW = v; break }
      }
    }

    // ===== POTÊNCIA kW (inversor) =====
    if (!dados.potenciaW) {
      for (const re of [
        /RATED[\s:]*(?:AC\s*)?OUTPUT[\s:]*POWER[\s:]*([0-9]+(?:\.[0-9]+)?)\s*K?W/i,
        /NOMINAL[\s]*OUTPUT[\s]*POWER[\s:]*([0-9]+(?:\.[0-9]+)?)\s*KW/i,
        /([0-9]+(?:\.[0-9]+)?)\s*KW[\s]*(?:RATED|OUTPUT|NOMINAL)/i,
      ]) {
        const m = texto.match(re)
        if (m?.[1]) { dados.potenciaKW = parseFloat(m[1]); break }
      }
    }

    // ===== VOC =====
    for (const re of [
      /VOC[\s\(]*(?:OPEN[\s-]*CIRCUIT[\s]*VOLTAGE)?[\s\)]*[\s:]*([0-9]+(?:\.[0-9]+)?)\s*V/i,
      /OPEN[\s-]*CIRCUIT[\s]*VOLTAGE[\s:]*([0-9]+(?:\.[0-9]+)?)\s*V/i,
      /V\s*OC[\s:]*([0-9]+(?:\.[0-9]+)?)/i,
    ]) {
      const m = texto.match(re)
      if (m?.[1]) {
        const v = parseFloat(m[1])
        if (v > 10 && v < 500) { dados.voc = v; break }
      }
    }

    // ===== VMPP / VMP =====
    for (const re of [
      /VMPP[\s:]*([0-9]+(?:\.[0-9]+)?)\s*V/i,
      /VMP[\s:]*([0-9]+(?:\.[0-9]+)?)\s*V/i,
      /VOLTAGE[\s]*AT[\s]*MAX[\s]*POWER[\s:]*([0-9]+(?:\.[0-9]+)?)\s*V/i,
      /MAX[\s]*POWER[\s]*VOLT[\s:]*([0-9]+(?:\.[0-9]+)?)\s*V/i,
    ]) {
      const m = texto.match(re)
      if (m?.[1]) {
        const v = parseFloat(m[1])
        if (v > 10 && v < 500) { dados.vmpp = v; break }
      }
    }

    // ===== ISC =====
    for (const re of [
      /ISC[\s\(]*(?:SHORT[\s-]*CIRCUIT[\s]*CURRENT)?[\s\)]*[\s:]*([0-9]+(?:\.[0-9]+)?)\s*A/i,
      /SHORT[\s-]*CIRCUIT[\s]*CURRENT[\s:]*([0-9]+(?:\.[0-9]+)?)\s*A/i,
      /I\s*SC[\s:]*([0-9]+(?:\.[0-9]+)?)/i,
    ]) {
      const m = texto.match(re)
      if (m?.[1]) {
        const v = parseFloat(m[1])
        if (v > 0 && v < 100) { dados.isc = v; break }
      }
    }

    // ===== IMPP / IMP =====
    for (const re of [
      /IMPP[\s:]*([0-9]+(?:\.[0-9]+)?)\s*A/i,
      /IMP[\s:]*([0-9]+(?:\.[0-9]+)?)\s*A/i,
      /CURRENT[\s]*AT[\s]*MAX[\s]*POWER[\s:]*([0-9]+(?:\.[0-9]+)?)\s*A/i,
    ]) {
      const m = texto.match(re)
      if (m?.[1]) {
        const v = parseFloat(m[1])
        if (v > 0 && v < 100) { dados.impp = v; break }
      }
    }

    // ===== EFICIÊNCIA =====
    for (const re of [
      /MODULE[\s]*EFFICIENCY[\s:]*([0-9]+(?:\.[0-9]+)?)\s*%/i,
      /EFFICIENCY[\s:]*([0-9]+(?:\.[0-9]+)?)\s*%/i,
    ]) {
      const m = texto.match(re)
      if (m?.[1]) {
        const v = parseFloat(m[1])
        if (v > 5 && v < 30) { dados.eficiencia = v; break }
      }
    }

    // ===== MPPT (inversores) =====
    for (const re of [
      /NUMBER[\s]*OF[\s]*MPPT[\s:]*([0-9]+)/i,
      /([0-9]+)\s*MPPT[\s]*(?:TRACKER|INPUT)/i,
      /MPPT[\s]*(?:QUANTITY|QTY|NUMBER)?[\s:]*([0-9]+)/i,
    ]) {
      const m = texto.match(re)
      if (m?.[1]) {
        const v = parseInt(m[1])
        if (v > 0 && v < 20) { dados.nMppts = v; break }
      }
    }

    // ===== CORRENTE AC SAÍDA (inversores) =====
    for (const re of [
      /MAX(?:IMUM)?[\s]*(?:AC\s*)?OUTPUT[\s]*CURRENT[\s:]*([0-9]+(?:\.[0-9]+)?)\s*A/i,
      /AC[\s]*OUTPUT[\s]*CURRENT[\s:]*([0-9]+(?:\.[0-9]+)?)\s*A/i,
    ]) {
      const m = texto.match(re)
      if (m?.[1]) {
        const v = parseFloat(m[1])
        if (v > 0 && v < 1000) { dados.correnteACSaida = v; break }
      }
    }

    // ===== VALIDAÇÃO =====
    const avisos = []
    if (dados.voc && dados.vmpp && dados.voc <= dados.vmpp)
      avisos.push(`VOC (${dados.voc}V) deveria ser maior que VMPP (${dados.vmpp}V)`)
    if (dados.isc && dados.impp && dados.isc <= dados.impp)
      avisos.push(`ISC (${dados.isc}A) deveria ser maior que IMPP (${dados.impp}A)`)

    const camposEncontrados = Object.keys(dados).length
    const qualityScore = Math.min(100, camposEncontrados * 12)

    console.log(`✅ Datasheet extraído: ${camposEncontrados} campos`, dados)

    res.json({
      sucesso: true,
      dados,
      qualityScore,
      avisos,
      _debug: { chars: texto.length, campos: camposEncontrados },
    })
  } catch (err) {
    console.error('❌ Erro ao extrair datasheet:', err)
    res.status(500).json({ sucesso: false, erro: 'Erro ao processar PDF: ' + err.message })
  }
}

export function criarPainelManual(req, res) {
  try {
    const { marca, modelo, potenciaW, voc, vmpp, isc, impp, eficiencia, garantiaProduto, garantiaPerformance } = req.body

    if (!marca || !modelo || !potenciaW) {
      return res.status(400).json({ erro: 'Marca, modelo e potência (W) são obrigatórios' })
    }

    const painel = {
      id: `custom-${Date.now()}`,
      marca, modelo,
      potenciaW: Number(potenciaW),
      voc: voc ? Number(voc) : null,
      vmpp: vmpp ? Number(vmpp) : null,
      isc: isc ? Number(isc) : null,
      impp: impp ? Number(impp) : null,
      eficiencia: eficiencia ? Number(eficiencia) : null,
      garantiaProduto: Number(garantiaProduto) || 10,
      garantiaPerformance: Number(garantiaPerformance) || 25,
      criacao: new Date().toISOString(),
    }

    res.status(201).json({ sucesso: true, painel, mensagem: 'Painel cadastrado com sucesso' })
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}

export function criarInversorManual(req, res) {
  try {
    const { marca, modelo, potenciaKW, faseAC, nMppts, tensaoMpptMin, tensaoMpptMax, garantia } = req.body

    if (!marca || !modelo || !potenciaKW) {
      return res.status(400).json({ erro: 'Marca, modelo e potência (kW) são obrigatórios' })
    }

    const inversor = {
      id: `custom-${Date.now()}`,
      marca, modelo,
      potenciaKW: Number(potenciaKW),
      faseAC: faseAC ? Number(faseAC) : 1,
      nMppts: Number(nMppts) || 1,
      tensaoMpptMin: Number(tensaoMpptMin) || 200,
      tensaoMpptMax: Number(tensaoMpptMax) || 800,
      garantia: Number(garantia) || 10,
      criacao: new Date().toISOString(),
    }

    res.status(201).json({ sucesso: true, inversor, mensagem: 'Inversor cadastrado com sucesso' })
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}
