import { GoogleGenerativeAI } from '@google/generative-ai'
import { PDFParse } from 'pdf-parse'

/**
 * Extrai dados de datasheet EV usando regex patterns (100% GRATUITO - sem IA necessária)
 * Estratégia: Extrai texto do PDF, depois usa padrões regex para encontrar dados técnicos
 */
export async function extrairDatasheetEV(pdfBuffer) {
  try {
    // Etapa 1: Extrair texto do PDF
    console.log('  [PDF Parse] Extraindo texto...')
    const parser = new PDFParse({ data: pdfBuffer })
    const textResult = await parser.getText()
    const textoOriginal = textResult.text || ''
    const texto = textoOriginal.toUpperCase()
    await parser.destroy()

    if (!texto || texto.trim().length < 100) {
      throw new Error('PDF não contém texto suficiente para análise')
    }

    console.log('  [Regex] Analisando com padrões de datasheet...')

    // ========== EXTRAÇÃO COM REGEX PATTERNS ==========

    const linhas = textoOriginal.split('\n')
    const linhasAltas = linhas.map(l => l.toUpperCase())

    // Marca/Fabricante - procura em padrões conhecidos ou no início
    let marca = 'Desconhecido'
    const marcasConhecidas = [
      'INTELBRAS', 'WALLBOX', 'ABB', 'SIEMENS', 'SOLPLANET', 'BELENERGY',
      'EVOWATT', 'DELTA', 'KEMPOWER', 'PHOENIX', 'CATL', 'CEMOSA',
      'EMOBI', 'BOREAL'
    ]

    // Mapeamento: EMOBI/Boreal = EVOWATT (marca comercial)
    const marcaAliases = {
      'EMOBI': 'EVOWATT',        // Série Boreal Master é vendida como Evowatt
      'BOREAL': 'EVOWATT',       // Boreal Master = Evowatt
    }

    // Procurar marcas conhecidas
    for (const marcaKnown of marcasConhecidas) {
      if (texto.includes(marcaKnown)) {
        // Aplicar alias se existir
        marca = marcaAliases[marcaKnown] || marcaKnown
        break
      }
    }

    // Se não encontrou marca conhecida, procura no início
    if (marca === 'Desconhecido') {
      for (let i = 0; i < Math.min(5, linhas.length); i++) {
        const linha = linhas[i].trim()
        if (linha && linha.length > 3 && linha.length < 50 && !linha.includes('http')) {
          if (!/^[0-9\-\s]+$/.test(linha) && !/estação|charger|carregador|datasheet|spec/i.test(linha)) {
            marca = linha
            break
          }
        }
      }
    }

    // Modelo - procura depois da marca, nos primeiros 500 caracteres
    let modelo = 'Sem modelo'
    const modeloPatterns = [
      /EVE\s*0\d{3}[A-Z]?/i,      // EVE 0074B, EVE 0074C, etc
      /CVBE[\s\-]*[A-Z0-9\-]*/i,  // CVBE-MO, CVBE-TR, etc
      /KS\s*\d{4}[A-Z0-9]*/i,     // KS1207A21
      /SOL[\s\-]*[\d.]+[A-Z]?/i,  // SOL7.4H
      /([A-Z]{2,}[\s\-]*[0-9]{3,}[A-Z0-9\-]*)/,
    ]

    for (const pattern of modeloPatterns) {
      const match = textoOriginal.substring(0, 500).match(pattern)
      if (match) {
        modelo = (match[0] || match[1]).trim()
        // Remover caracteres especiais no final
        modelo = modelo.replace(/[\.\-\s]+$/g, '')
        break
      }
    }

    // Potência em kW
    let potencia_kw = null
    const potenciaPatterns = [
      /(\d+(?:[\.,]\d+)?)\s*KW(?!\d)/i,
      /RATED[\s]*POWER[\s:]*(\d+(?:[\.,]\d+)?)\s*KW/i,
      /POTÊNCIA[\s:]*(\d+(?:[\.,]\d+)?)\s*KW/i,
      /POWER[\s:]*(\d+(?:[\.,]\d+)?)\s*KW/i,
      /OUTPUT[\s]*POWER[\s:]*(\d+(?:[\.,]\d+)?)\s*KW/i,
      /(\d+(?:[\.,]\d+)?)\s*KW[\s]*(AC|DC|MONOFÁSICO|TRIFÁSICO)/i,
    ]

    for (const pattern of potenciaPatterns) {
      const match = texto.match(pattern)
      if (match && match[1]) {
        potencia_kw = parseFloat(match[1].replace(',', '.'))
        if (potencia_kw > 0 && potencia_kw < 1000) {
          break
        }
      }
    }

    // Tensão de entrada (Volts)
    let tensao_entrada_v = null
    const tensaoPatterns = [
      /INPUT[\s]*VOLTAGE[\s:]*(\d+)\s*V/i,
      /TENSÃO[\s]*ENTRADA[\s:]*(\d+)\s*V/i,
      /RATED[\s]*VOLTAGE[\s:]*(\d+)\s*V/i,
      /SUPPLY[\s]*VOLTAGE[\s:]*(\d+)\s*V/i,
      /(\d{3,})[\s]*V[\s]*(AC|ENTRADA|SUPPLY)(?!\w)/i,
    ]

    for (const pattern of tensaoPatterns) {
      const match = texto.match(pattern)
      if (match && match[1]) {
        let v = parseInt(match[1])
        if ((v === 110 || v === 120 || v === 220 || v === 380 || v === 400) && !tensao_entrada_v) {
          tensao_entrada_v = v
          break
        }
      }
    }

    // Corrente de entrada (Amperes)
    let corrente_entrada_a = null
    const correntePatterns = [
      /INPUT[\s]*CURRENT[\s:]*(\d+(?:[\.,]\d+)?)\s*A/i,
      /CORRENTE[\s]*ENTRADA[\s:]*(\d+(?:[\.,]\d+)?)\s*A/i,
      /RATED[\s]*CURRENT[\s:]*(\d+(?:[\.,]\d+)?)\s*A/i,
      /(\d+(?:[\.,]\d+)?)\s*A[\s]*(MAX|MÁXIMO|INPUT|ENTRADA)(?!\w)/i,
    ]

    for (const pattern of correntePatterns) {
      const match = texto.match(pattern)
      if (match && match[1]) {
        corrente_entrada_a = parseFloat(match[1].replace(',', '.'))
        if (corrente_entrada_a > 0 && corrente_entrada_a < 200) {
          break
        }
      }
    }

    // Tipo (Monofásico/Trifásico/DC)
    let tipo = 'AC_Mono'
    let numero_fases = 1

    const tipoPatterns = [
      /TRIFÁSICO|THREE[\s]*PHASE|3[\s]*FASES|3F\+N/i,
      /MONOFÁSICO|SINGLE[\s]*PHASE|1[\s]*FASES|1F\+N/i,
      /DC[\s]*CHARGER|DIRECT[\s]*CURRENT|CARREGADOR[\s]*DC/i,
    ]

    for (const pattern of tipoPatterns) {
      if (pattern.test(texto)) {
        if (/TRIFÁSICO|THREE[\s]*PHASE|3[\s]*FASES|3F\+N/i.test(pattern.source) && pattern.test(texto)) {
          tipo = 'AC_Tri'
          numero_fases = 3
          break
        } else if (/DC[\s]*CHARGER|DIRECT[\s]*CURRENT/i.test(pattern.source) && pattern.test(texto)) {
          tipo = 'DC'
          numero_fases = 3
          break
        } else if (/MONOFÁSICO|SINGLE[\s]*PHASE|1[\s]*FASES/i.test(pattern.source) && pattern.test(texto)) {
          tipo = 'AC_Mono'
          numero_fases = 1
          break
        }
      }
    }

    // Tensão DC (para DC)
    let tensao_saida_dc_v = null
    let corrente_saida_dc_a = null

    if (tipo === 'DC') {
      const tensaoDCPatterns = [
        /OUTPUT[\s]*VOLTAGE[\s:]*(\d+)\s*V/i,
        /TENSÃO[\s]*SAÍDA[\s:]*(\d+)\s*V/i,
        /DC[\s]*OUTPUT[\s:]*(\d+)\s*V/i,
        /(\d{3})\s*VDC/i,
      ]

      for (const pattern of tensaoDCPatterns) {
        const match = texto.match(pattern)
        if (match && match[1]) {
          tensao_saida_dc_v = parseInt(match[1])
          if (tensao_saida_dc_v > 0) break
        }
      }

      const correnteDCPatterns = [
        /OUTPUT[\s]*CURRENT[\s:]*(\d+(?:[\.,]\d+)?)\s*A/i,
        /CORRENTE[\s]*SAÍDA[\s:]*(\d+(?:[\.,]\d+)?)\s*A/i,
        /MAX[\s]*CURRENT[\s:]*(\d+(?:[\.,]\d+)?)\s*A/i,
      ]

      for (const pattern of correnteDCPatterns) {
        const match = texto.match(pattern)
        if (match && match[1]) {
          corrente_saida_dc_a = parseFloat(match[1].replace(',', '.'))
          if (corrente_saida_dc_a > 0) break
        }
      }
    }

    // Protocolo de carregamento
    let protocolo_carregamento = 'IEC 61851'
    if (texto.includes('GB/T') || texto.includes('GB/T 20234')) {
      protocolo_carregamento = 'GB/T 20234'
    }

    // Tipo de conector
    let tipo_carregamento = 'Type 2'
    let tipo_conector = 'Type 2'

    const conectorPatterns = [
      /TYPE[\s]*2|MENNEKES/i,
      /CHADEMO|CHAdeMO/i,
      /CCS|COMBO/i,
      /IEC[\s]*62196/i,
    ]

    for (const pattern of conectorPatterns) {
      if (pattern.test(texto)) {
        if (/TYPE[\s]*2|MENNEKES/i.test(pattern.source)) {
          tipo_carregamento = 'Type 2'
          tipo_conector = 'Type 2'
        } else if (/CHADEMO/i.test(pattern.source)) {
          tipo_carregamento = 'CHAdeMO'
          tipo_conector = 'CHAdeMO'
        } else if (/CCS|COMBO/i.test(pattern.source)) {
          tipo_carregamento = 'CCS'
          tipo_conector = 'CCS2'
        }
        break
      }
    }

    // Temperatura operacional
    let temperatura_operacao_min = -30
    let temperatura_operacao_max = 50

    const tempPatterns = [
      /OPERATING[\s]*TEMPERATURE[\s:]*([\\-\d]+)[\s]*[°C][\s]*TO[\s]*([\\-\d]+)[\s]*[°C]/i,
      /TEMPERATURA[\s]*OPERAÇÃO[\s:]*([\\-\d]+)[\s]*[°C][\s]*A[\s]*([\\-\d]+)[\s]*[°C]/i,
      /([\\-\d]+)[\s]*[°C][\s]*(TO|A|–)[\s]*([\\-\d]+)[\s]*[°C]/i,
    ]

    for (const pattern of tempPatterns) {
      const match = texto.match(pattern)
      if (match && match[1] && match[2]) {
        temperatura_operacao_min = parseInt(match[1])
        temperatura_operacao_max = parseInt(match[2])
        break
      }
    }

    // IP Rating
    let ip_rating = 'IP54'
    const ipPatterns = [
      /IP([0-9]{2})/,
    ]

    for (const pattern of ipPatterns) {
      const match = texto.match(pattern)
      if (match && match[1]) {
        ip_rating = `IP${match[1]}`
        break
      }
    }

    // Eficiência
    let eficiencia_pct = null
    const eficienciaPatterns = [
      /EFFICIENCY[\s:]*([0-9]+(?:[\.,][0-9]+)?)\s*%/i,
      /EFICIÊNCIA[\s:]*([0-9]+(?:[\.,][0-9]+)?)\s*%/i,
    ]

    for (const pattern of eficienciaPatterns) {
      const match = texto.match(pattern)
      if (match && match[1]) {
        eficiencia_pct = parseFloat(match[1].replace(',', '.'))
        break
      }
    }

    // Garantia
    let garantia_anos = 2
    const garantiaPatterns = [
      /WARRANTY[\s:]*(\d+)\s*YEAR/i,
      /GARANTIA[\s:]*(\d+)\s*ANO/i,
    ]

    for (const pattern of garantiaPatterns) {
      const match = texto.match(pattern)
      if (match && match[1]) {
        garantia_anos = parseInt(match[1])
        break
      }
    }

    return {
      marca,
      modelo,
      tipo,
      potencia_kw,
      tensao_entrada_v,
      corrente_entrada_a,
      numero_fases,
      frequencia_hz: 60,
      tensao_saida_dc_v,
      corrente_saida_dc_a,
      protocolo_carregamento,
      tipo_carregamento,
      conector: tipo_conector,
      ip_rating,
      temperatura_operacao_min,
      temperatura_operacao_max,
      eficiencia_pct,
      fator_potencia: null,
      peso_kg: null,
      dimensoes_mm: null,
      comunicacao: ['OCPP'],
      ocpp_version: null,
      disjuntor_recomendado_a: null,
      dr_recomendado_ma: 30,
      bitola_cabo_minima_mm2: null,
      garantia_anos,
      certificacao: ['CE'],
    }

  } catch (error) {
    console.error('Erro ao extrair com regex:', error.message)
    throw new Error(`Falha na extração: ${error.message}`)
  }
}

/**
 * Normaliza dados extraídos para o schema CarregadorEV
 */
export function normalizarDadosEV(dados) {
  const potenciasValidas = [3.6, 7.4, 11, 22, 30, 40, 60, 80, 90, 120, 150, 180]

  let potenciaFinal = dados.potencia_kw
  if (!potenciasValidas.includes(potenciaFinal)) {
    potenciaFinal = potenciasValidas.reduce((prev, curr) =>
      Math.abs(curr - dados.potencia_kw) < Math.abs(prev - dados.potencia_kw)
        ? curr
        : prev
    )
  }

  let tipoFinal = dados.tipo
  if (!['AC_Mono', 'AC_Tri', 'DC'].includes(tipoFinal)) {
    if (dados.numero_fases === 3) tipoFinal = 'AC_Tri'
    else if (dados.numero_fases === 1) tipoFinal = 'AC_Mono'
    else if (dados.tensao_saida_dc_v) tipoFinal = 'DC'
    else tipoFinal = 'AC_Mono'
  }

  // Garantir que marca e modelo são sempre preenchidos
  const marcaFinal = dados.marca && dados.marca !== 'Desconhecido' ? dados.marca : 'Marca não identificada'
  const modeloFinal = dados.modelo && dados.modelo !== 'Sem modelo' ? dados.modelo : 'Modelo não identificado'

  return {
    tipo: tipoFinal,
    potencia_kw: potenciaFinal,
    marca: marcaFinal,
    modelo: modeloFinal,
    tensao_entrada_v: dados.tensao_entrada_v || null,
    corrente_entrada_a: dados.corrente_entrada_a || null,
    numero_fases: dados.numero_fases || (tipoFinal === 'AC_Tri' ? 3 : 1),
    frequencia_hz: dados.frequencia_hz || 60,
    tensao_saida_dc_v: dados.tensao_saida_dc_v || null,
    corrente_saida_dc_a: dados.corrente_saida_dc_a || null,
    eficiencia_pct: dados.eficiencia_pct || null,
    fator_potencia: dados.fator_potencia || null,
    grau_protecao_ip: dados.ip_rating || 'IP54',
    temperatura_operacao: `${dados.temperatura_operacao_min || -30}°C até ${dados.temperatura_operacao_max || 50}°C`,
    peso_kg: dados.peso_kg || null,
    dimensoes_mm: dados.dimensoes_mm || null,
    protocolo_carregamento: dados.protocolo_carregamento || 'IEC 61851',
    tipo_carregamento: dados.tipo_carregamento || 'Type 2',
    tipo_conector: dados.conector || 'Type 2',
    comunicacao: Array.isArray(dados.comunicacao)
      ? dados.comunicacao.join(',')
      : dados.comunicacao || '',
    disjuntor_recomendado_a: dados.disjuntor_recomendado_a || null,
    dr_recomendado_ma: dados.dr_recomendado_ma || 30,
    bitola_cabo_minima_mm2: dados.bitola_cabo_minima_mm2 || null,
    garantia_anos: dados.garantia_anos || 2,
    ativo: true,
  }
}

/**
 * Valida dados
 */
export function validarDadosEV(dados) {
  const avisos = []

  if (!dados.marca || dados.marca === 'Desconhecido') {
    avisos.push('⚠ Marca não identificada')
  }

  if (!dados.modelo || dados.modelo === 'Sem modelo') {
    avisos.push('⚠ Modelo não identificado')
  }

  if (!dados.potencia_kw || dados.potencia_kw <= 0) {
    avisos.push('⚠ Potência inválida')
  }

  if (!['AC_Mono', 'AC_Tri', 'DC'].includes(dados.tipo)) {
    avisos.push(`⚠ Tipo inválido: ${dados.tipo}`)
  }

  const temDadosEssenciais = !!(
    dados.marca &&
    dados.marca !== 'Desconhecido' &&
    dados.modelo &&
    dados.modelo !== 'Sem modelo' &&
    dados.potencia_kw &&
    dados.potencia_kw > 0
  )

  return {
    valido: temDadosEssenciais,
    avisos: avisos.length > 0 ? avisos : [],
  }
}

/**
 * Pipeline completo: extrai → normaliza → valida
 */
export async function processarDatasheetEV(pdfBuffer) {
  try {
    console.log('[EV] Iniciando extração com regex patterns...')
    const dadosExtraidos = await extrairDatasheetEV(pdfBuffer)
    console.log('[EV] Extração concluída:', dadosExtraidos.marca, dadosExtraidos.modelo)

    const dadosNormalizados = normalizarDadosEV(dadosExtraidos)
    console.log('[EV] Normalização concluída')

    const validacao = validarDadosEV(dadosNormalizados)
    console.log('[EV] Validação:', validacao.valido ? 'OK' : 'Com avisos')

    return {
      sucesso: validacao.valido,
      carregador: dadosNormalizados,
      avisos: validacao.avisos,
      erro: null,
    }

  } catch (error) {
    console.error('[EV] Erro no processamento:', error.message)
    return {
      sucesso: false,
      carregador: null,
      avisos: ['Falha ao processar datasheet'],
      erro: error.message,
    }
  }
}
