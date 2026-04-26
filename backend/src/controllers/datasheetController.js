// Datasheet extraction functionality
// PDF parsing will be implemented in a future update

const PATTERNS = {
  potenciaW: /(?:potencia|power|rated|nominal)[\s:]*(\d+(?:\.\d+)?)\s*w/gi,
  voc: /(?:voc|open\s*circuit\s*voltage)[\s:]*(\d+(?:\.\d+)?)\s*v/gi,
}

export async function extrairDatasheet(req, res) {
  try {
    return res.status(501).json({
      sucesso: false,
      mensagem: 'Extração de datasheet está em desenvolvimento',
      info: 'Esta funcionalidade será implementada em uma versão futura',
    })
  } catch (err) {
    console.error('Erro ao extrair datasheet:', err)
    res.status(500).json({ erro: err.message })
  }
}

export function criarPainelManual(req, res) {
  try {
    const {
      marca, modelo, pmpp, voc, vmpp, isc, impp,
      tempCoefVoc, tempCoefPmpp, tempCoefIsc,
      area, eficiencia,
      garantiaProduto, garantiaPerformance, percentualPerformance,
    } = req.body

    if (!marca || !modelo || !pmpp) {
      return res.status(400).json({ erro: 'Marca, modelo e potência são obrigatórios' })
    }

    const painelNovo = {
      id: `custom-${Date.now()}`,
      marca,
      modelo,
      pmpp: Number(pmpp),
      voc: voc ? Number(voc) : null,
      vmpp: vmpp ? Number(vmpp) : null,
      isc: isc ? Number(isc) : null,
      impp: impp ? Number(impp) : null,
      area: area ? Number(area) : null,
      eficiencia: eficiencia ? Number(eficiencia) : null,
      garantiaProduto: Number(garantiaProduto) || 10,
      garantiaPerformance: Number(garantiaPerformance) || 25,
      percentualPerformance: percentualPerformance ? Number(percentualPerformance) : 80,
      criacao: new Date().toISOString(),
    }

    console.log('✓ Painel manual criado:', painelNovo)

    res.status(201).json({
      sucesso: true,
      painel: painelNovo,
      mensagem: 'Painel cadastrado com sucesso',
    })
  } catch (err) {
    console.error('❌ Erro ao criar painel manual:', err)
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao cadastrar painel',
      detalhes: err.message,
    })
  }
}

export function criarInversorManual(req, res) {
  try {
    const {
      marca, modelo, tipoInversor, potenciaKW, faseAC,
      nMppts, tensaoMpptMin, tensaoMpptMax,
      garantia,
    } = req.body

    if (!marca || !modelo || !potenciaKW) {
      return res.status(400).json({ erro: 'Marca, modelo e potência são obrigatórios' })
    }

    if (!['string', 'micro'].includes(tipoInversor?.toLowerCase())) {
      return res.status(400).json({ erro: 'Tipo de inversor inválido: string ou micro' })
    }

    const inversorNovo = {
      id: `custom-${Date.now()}`,
      marca,
      modelo,
      tipoInversor: tipoInversor.toLowerCase(),
      potenciaKW: Number(potenciaKW),
      faseAC: faseAC ? Number(faseAC) : 1,
      nMppts: Number(nMppts) || 1,
      tensaoMpptMin: Number(tensaoMpptMin) || 200,
      tensaoMpptMax: Number(tensaoMpptMax) || 800,
      garantia: Number(garantia) || 10,
      criacao: new Date().toISOString(),
    }

    console.log('✓ Inversor manual criado:', inversorNovo)

    res.status(201).json({
      sucesso: true,
      inversor: inversorNovo,
      mensagem: 'Inversor cadastrado com sucesso',
    })
  } catch (err) {
    console.error('❌ Erro ao criar inversor manual:', err)
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao cadastrar inversor',
      detalhes: err.message,
    })
  }
}
