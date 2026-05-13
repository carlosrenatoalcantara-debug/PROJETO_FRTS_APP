/**
 * Utility functions for extracting data from Parecer de Acesso PDFs
 * Pattern-based extraction with fallback mechanisms
 */

// Helper to find a line matching a pattern and get the next non-empty line
export const findLineAndNext = (linhas, pattern) => {
  for (let i = 0; i < linhas.length - 1; i++) {
    if (pattern.test(linhas[i])) {
      // Found match, now get value from same or next lines
      let j = i
      while (j < linhas.length && linhas[j].length < 3) j++ // Skip empty lines
      if (j <= i + 2) return linhas[j]
    }
  }
  return null
}

// Helper to extract value from a line that contains "Label: Value" pattern
export const extractAfterLabel = (text, labelPattern) => {
  const match = text.match(labelPattern)
  return match ? match[1]?.trim() : null
}

/**
 * Extract client information (name, CPF/CNPJ, address)
 */
export const extrairDadosCliente = (texto) => {
  const dados = {}
  const linhas = texto.split('\n').map(l => l.trim())

  // ===== NOME DO CLIENTE/PROPRIETÁRIO =====
  const nomePatterns = [
    /PROPRIETÁRIO[\s:]+([A-ZÀÁÂÃÄÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÇ\s'-]+?)(?:\n|$)/i,
    /CLIENTE[\s:]+([A-ZÀÁÂÃÄÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÇ\s'-]+?)(?:\n|$)/i,
    /SOLICITANTE[\s:]+([A-ZÀÁÂÃÄÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÇ\s'-]+?)(?:\n|$)/i,
    /REQUERENTE[\s:]+([A-ZÀÁÂÃÄÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÇ\s'-]+?)(?:\n|$)/i,
  ]

  for (const pattern of nomePatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.nome = match[1].trim()
      break
    }
  }

  // ===== CPF/CNPJ =====
  const cpfCnpjPatterns = [
    /CPF[\s:]*(\d{3}\.\d{3}\.\d{3}-\d{2})/i,
    /CNPJ[\s:]*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i,
    /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/,  // CPF pattern
    /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/,  // CNPJ pattern
  ]

  for (const pattern of cpfCnpjPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.cpf_cnpj = match[1]
      break
    }
  }

  // ===== ENDEREÇO =====
  const enderecoPatterns = [
    /ENDEREÇO[\s:]*([^\n]+)/i,
    /LOCAL DA INSTALAÇÃO[\s:]*([^\n]+)/i,
    /ROTA[\s:]*([^\n]+)/i,
  ]

  for (const pattern of enderecoPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.endereco = match[1].trim()
      break
    }
  }

  // ===== EMAIL (fallback) =====
  const emailMatch = texto.match(/[\w\.-]+@[\w\.-]+\.\w+/)
  if (emailMatch) {
    dados.email = emailMatch[0]
  }

  return dados
}

/**
 * Extract account information (número cliente, distribuidora, etc)
 */
export const extrairDadosInstalacao = (texto) => {
  const dados = {}

  // ===== NÚMERO DE CLIENTE/CONTRATO =====
  const numeroPatterns = [
    /(?:NÚMERO|NUM[ER]{0,2}|N°|N.?)[\s:]*(?:DA\s+)?(?:CLIENTE|CONTRATO|INSTALAÇÃO|UNIDADE)[\s:]*(\d+)/i,
    /CONTRATO[\s:]*(\d+)/i,
    /CLIENTE[\s:]*(\d+)/i,
    /UCC[\s:]*(\d+)/i,  // Unidade Consumidora
  ]

  for (const pattern of numeroPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.numero_cliente = match[1]
      break
    }
  }

  // ===== DISTRIBUIDORA (Cosern, etc) =====
  const distribuidoraPatterns = [
    /(COSERN|COELBA|CELPE|CEMIG|COPEL|EDP|LIGHT|ENERGISA|ENEL)/i,
    /DISTRIBUIDORA[\s:]*([A-Z\s]+?)(?:\n|$)/i,
  ]

  for (const pattern of distribuidoraPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.distribuidora = match[1].trim()
      break
    }
  }

  // ===== TENSÃO/VOLTAGEM =====
  const tensaoPatterns = [
    /(?:TENSÃO|VOLTAGEM)[\s:]*(\d+)[\s]*V/i,
    /(380|220|127)[\s]*V/i,
  ]

  let tensaoValor = null
  for (const pattern of tensaoPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      tensaoValor = parseInt(match[1])
      break
    }
  }

  if (tensaoValor) {
    dados.voltagem = tensaoValor
    // Determine phase
    if (tensaoValor === 127 || tensaoValor === 220) {
      dados.fase_tensao = 'Monofásico'
    } else if (tensaoValor === 380) {
      dados.fase_tensao = 'Trifásico'
    }
  }

  // ===== FASE (verificar padrão trifásico) =====
  if (!dados.fase_tensao) {
    const trifasico = /TRIFÁSICO|3\s*FASES?|380\s*V/i.test(texto)
    const bifasico = /BIFÁSICO|2\s*FASES?/i.test(texto)

    if (trifasico) dados.fase_tensao = 'Trifásico'
    else if (bifasico) dados.fase_tensao = 'Bifásico'
    else dados.fase_tensao = 'Monofásico' // Default
  }

  // ===== GD TIER (GD II ou GD III) =====
  const gdPatterns = [
    /GD\s*(II|III|2|3)(?:\s|\.|\n|$)/i,
    /(GD\s+II|GD\s+III)/i,
  ]

  for (const pattern of gdPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      const gdTier = match[1].replace(/\s/g, '')
      dados.gd_tier = gdTier === '3' || gdTier === 'III' ? 'GD III' : 'GD II'
      break
    }
  }
  dados.gd_tier = dados.gd_tier || 'GD II' // Default

  return dados
}

/**
 * Extract equipment specifications (painéis, inversor)
 */
export const extrairDadosEquipamento = (texto) => {
  const dados = {
    paineis: {},
    inversor: {},
  }

  // ===== PAINÉIS SOLARES =====
  // Marca
  const marcaPainelPatterns = [
    /(?:PAINEL|MODULE|MÓDULO)[\s\w]*:?\s*([A-Z][A-Z0-9\s]+?)(?:\s+(?:MODELO|MODEL)|$)/i,
    /FABRICANTE[\s\w]*PAINEL[\s:]*([A-Z][A-Z0-9\s]+?)(?:\n|$)/i,
  ]

  for (const pattern of marcaPainelPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.paineis.marca = match[1].trim()
      break
    }
  }

  // Modelo do painel
  const modeloPainelPatterns = [
    /MODELO(?:\s+PAINEL)?[\s:]*([A-Z0-9\-\_\/]+)/i,
    /PAINEL.*?MODELO[\s:]*([A-Z0-9\-\_\/]+)/i,
  ]

  for (const pattern of modeloPainelPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.paineis.modelo = match[1].trim()
      break
    }
  }

  // Potência do painel (Wp)
  const potenciaPainelPatterns = [
    /PAINEL[\s\w]*(\d+)\s*W(?:p|$)/i,
    /(?:POTÊNCIA|POWER)[\s\w]*PAINEL[\s:]*(\d+)\s*W/i,
    /(\d+)\s*W(?:p|ATTER)[\s](?:PAINEL|MODULE)/i,
  ]

  for (const pattern of potenciaPainelPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.paineis.potencia_w = parseInt(match[1])
      break
    }
  }

  // Quantidade de painéis
  const quantidadePatterns = [
    /(?:QUANTIDADE|QTD|TOTAL)[\s\w]*PAINEL[ES]?[\s:]*(\d+)/i,
    /(\d+)\s*(?:PAINÉIS|MÓDULOS|PLACAS)/i,
  ]

  for (const pattern of quantidadePatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.quantidade_paineis = parseInt(match[1])
      break
    }
  }

  // ===== INVERSOR =====
  // Marca do inversor
  const marcaInversorPatterns = [
    /INVERSOR[\s\w]*:?\s*([A-Z][A-Z0-9\s]+?)(?:\s+(?:MODELO|MODEL)|$)/i,
    /FABRICANTE[\s\w]*INVERSOR[\s:]*([A-Z][A-Z0-9\s]+?)(?:\n|$)/i,
  ]

  for (const pattern of marcaInversorPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.inversor.marca = match[1].trim()
      break
    }
  }

  // Modelo do inversor
  const modeloInversorPatterns = [
    /INVERSOR[\s\w]*MODELO[\s:]*([A-Z0-9\-\_\/]+)/i,
    /MODELO(?:\s+INVERSOR)?[\s:]*([A-Z0-9\-\_\/]+)[\s]*(?:KW|KVA|$)/i,
  ]

  for (const pattern of modeloInversorPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.inversor.modelo = match[1].trim()
      break
    }
  }

  // Potência do inversor (kW)
  const potenciaInversorPatterns = [
    /INVERSOR[\s\w]*(\d+(?:\.\d+)?)\s*KW/i,
    /(?:POTÊNCIA|POWER)[\s\w]*INVERSOR[\s:]*(\d+(?:\.\d+)?)\s*KW/i,
    /(\d+(?:\.\d+)?)\s*KW[\s]*(?:INVERSOR|INVERTER)/i,
  ]

  for (const pattern of potenciaInversorPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.inversor.potencia_kw = parseFloat(match[1])
      break
    }
  }

  // Quantidade de inversores
  const quantidadeInversorPatterns = [
    /(?:QUANTIDADE|QTD)[\s\w]*INVERSOR[ES]?[\s:]*(\d+)/i,
    /(\d+)\s*(?:INVERSORES|INVERTERS)/i,
  ]

  for (const pattern of quantidadeInversorPatterns) {
    const match = texto.match(pattern)
    if (match && match[1]) {
      dados.quantidade_inversores = parseInt(match[1])
      break
    }
  }
  dados.quantidade_inversores = dados.quantidade_inversores || 1 // Default to 1

  return dados
}

/**
 * Main function: extract all parecer data
 */
export const extrairTodosParecer = (texto) => {
  const textoUpper = texto.toUpperCase()

  return {
    cliente: extrairDadosCliente(textoUpper),
    instalacao: extrairDadosInstalacao(textoUpper),
    equipamento: extrairDadosEquipamento(textoUpper),
    texto_original_length: texto.length,
  }
}
