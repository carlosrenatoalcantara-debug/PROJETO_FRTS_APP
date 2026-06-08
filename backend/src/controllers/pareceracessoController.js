import { PDFParse } from 'pdf-parse'
import { Cliente } from '../models/Cliente.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { Equipamento } from '../models/Equipamento.js'
import { gerarResumoPadraoStrings } from '../utils/otimizadorStrings.js'
import * as SVG from '../utils/simbolosUnifilar.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { adicionarExemploTreinamento } from '../config/trainingDataCollector.js'

// Wrapper function to make PDFParse easier to use
const pdf = async (bufferPDF) => {
  const parser = new PDFParse({ data: bufferPDF })
  const infoResult = await parser.getInfo()
  const textResult = await parser.getText()
  await parser.destroy()

  return {
    numpages: infoResult.total,
    text: textResult.text
  }
}

/**
 * Extract Parecer data using Google Gemini API vision model
 * Optimized with examples and strict extraction rules
 */
const extrairPareceComGemini = async (bufferPDF) => {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY não configurada no .env')
  }

  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // Convert PDF to base64
  const base64PDF = bufferPDF.toString('base64')

  const prompt = `VOCÊ É UM ESPECIALISTA EM PARECER DE ACESSO PARA MICROGERAÇÃO SOLAR NO BRASIL

Contexto:
- Documento: Parecer de Acesso para Conexão de Mini e Microgeração (Resolução Normativa ANEEL)
- Distribuidoras: Cosern, CELPE, CEEE, Enel, AES, etc
- Propósito: Extrair dados de cliente, instalação e equipamento

EXEMPLOS DE RESPOSTA ESPERADA:
=========================================
Exemplo 1 - Cosern Monofásico:
{
  "cliente": {
    "nome": "JOÃO SILVA DOS SANTOS",
    "cpf_cnpj": "123.456.789-10",
    "email": null,
    "endereco": "RUA PRINCIPAL, 123, NATAL - RN"
  },
  "instalacao": {
    "numero_cliente": "2409118802",
    "numero_contrato": "0000123456",
    "numero_parecer": "2409118802",
    "distribuidora": "Cosern",
    "fase_tensao": "Monofásico",
    "voltagem": 220,
    "gd_tier": "GD II"
  },
  "equipamento": {
    "paineis": {
      "marca": "Neosolar",
      "modelo": "NS550W",
      "potencia_w": 550,
      "quantidade": 20
    },
    "inversor": {
      "marca": "Growatt",
      "modelo": "MIC 10000TL-X",
      "potencia_kw": 10
    },
    "quantidade_paineis": 20
  },
  "rede": {
    "potencia_contratada_kw": 11,
    "grupo_tarifario": "B1"
  }
}

REGRAS DE EXTRAÇÃO CRÍTICAS:
=========================================
1. NOMES: Use EXATAMENTE como aparece (maiúsculas, minúsculas, acentos)
2. NÚMEROS: Sem formatação (5000, não 5.000 ou 5,000)
3. CPF/CNPJ: Mantenha a formatação original do documento
4. MARCA/MODELO: Completo e exato (ex: "Neosolar", "NS550W", não abreviado)
5. VOLTAGEM: 220 ou 380 (sempre número)
6. FASES: "Monofásico" ou "Trifásico" (exatamente assim)
7. POTÊNCIAS: Sempre em números inteiros (sem decimais se possível)
8. CAMPOS AUSENTES: Use null, NUNCA deixe de fora
9. JSON VÁLIDO: Retorne APENAS JSON, sem markdown, sem explicações

ORDEM DE BUSCA NO DOCUMENTO:
=========================================
1. Cabeçalho: Número do parecer, data, distribuidora
2. Dados do requerente/cliente: Nome, CPF/CNPJ, endereço
3. Dados da unidade consumidora: Número cliente, fases, voltagem
4. Características: Potência, GD tier
5. Equipamentos: Painéis (marca, modelo, potência, quantidade), Inversor
6. Rede: Potência contratada, grupo tarifário

Agora analise ESTE DOCUMENTO e extraia RIGOROSAMENTE:
=========================================`

  try {
    const response = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64PDF
        }
      },
      {
        text: prompt
      }
    ])

    const responseText = response.response.text()
    console.log(`✓ Resposta do Gemini recebida (${responseText.length} chars)`)

    // Parse JSON response (handle markdown code blocks)
    let jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    let jsonStr

    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    } else {
      // Try to find raw JSON
      jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Não foi possível extrair JSON da resposta do Gemini')
      }
      jsonStr = jsonMatch[0]
    }

    const dados = JSON.parse(jsonStr)
    console.log(`✓ Dados extraídos com sucesso via Gemini`)

    // Ensure all required fields exist with proper types
    const equipDados = dados.equipamento || {}
    return {
      cliente: {
        nome: dados.cliente?.nome || null,
        cpf_cnpj: dados.cliente?.cpf_cnpj || null,
        email: dados.cliente?.email || null,
        endereco: dados.cliente?.endereco || null
      },
      instalacao: {
        numero_cliente: dados.instalacao?.numero_cliente || null,
        numero_contrato: dados.instalacao?.numero_contrato || null,
        numero_parecer: dados.instalacao?.numero_parecer || null,
        distribuidora: dados.instalacao?.distribuidora || null,
        fase_tensao: dados.instalacao?.fase_tensao || 'Monofásico',
        voltagem: dados.instalacao?.voltagem || 220,
        gd_tier: dados.instalacao?.gd_tier || 'GD II'
      },
      equipamento: {
        paineis: {
          marca: equipDados.paineis?.marca || null,
          modelo: equipDados.paineis?.modelo || null,
          potencia_w: equipDados.paineis?.potencia_w || 0
        },
        inversor: {
          marca: equipDados.inversor?.marca || null,
          modelo: equipDados.inversor?.modelo || null,
          potencia_kw: equipDados.inversor?.potencia_kw || 0
        },
        quantidade_paineis: equipDados.quantidade_paineis || equipDados.paineis?.quantidade || 0
      },
      rede: dados.rede || {}
    }
  } catch (err) {
    console.error('❌ Erro ao usar Gemini API:', err.message)
    throw new Error(`Falha na análise do Parecer com Gemini: ${err.message}`)
  }
}

/**
 * Validate extracted parecer data quality
 */
const validarExtracao = (dados) => {
  const erros = []
  const avisos = []

  // Validações críticas
  if (!dados.cliente?.nome) erros.push('Nome do cliente não encontrado')
  if (!dados.instalacao?.numero_cliente) erros.push('Número de cliente não encontrado')
  if (!dados.equipamento?.paineis?.marca) erros.push('Marca do painel não encontrada')
  if (!dados.equipamento?.inversor?.marca) erros.push('Marca do inversor não encontrada')

  // Avisos (campos recomendados)
  if (!dados.cliente?.cpf_cnpj) avisos.push('CPF/CNPJ não encontrado')
  if (!dados.cliente?.email) avisos.push('Email não encontrado')
  if (!dados.equipamento?.paineis?.quantidade === 0) avisos.push('Quantidade de painéis não especificada')

  // Validação de formato
  if (dados.cliente?.cpf_cnpj && !/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(dados.cliente.cpf_cnpj)) {
    avisos.push(`CPF/CNPJ com formato não padrão: ${dados.cliente.cpf_cnpj}`)
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    taxa_completude: calcularCompletude(dados)
  }
}

/**
 * Calculate data completeness percentage
 */
const calcularCompletude = (dados) => {
  const campos_importantes = [
    dados.cliente?.nome,
    dados.cliente?.cpf_cnpj,
    dados.instalacao?.numero_cliente,
    dados.instalacao?.distribuidora,
    dados.instalacao?.fase_tensao,
    dados.equipamento?.paineis?.marca,
    dados.equipamento?.paineis?.modelo,
    dados.equipamento?.paineis?.potencia_w,
    dados.equipamento?.quantidade_paineis,
    dados.equipamento?.inversor?.marca,
    dados.equipamento?.inversor?.modelo,
    dados.equipamento?.inversor?.potencia_kw
  ]

  const preenchidos = campos_importantes.filter(campo => campo !== null && campo !== undefined && campo !== '').length
  return Math.round((preenchidos / campos_importantes.length) * 100)
}

/**
 * Log extraction metrics for training optimization
 */
const registrarMetricaExtracao = async (resultado) => {
  try {
    // Se quiser persistir em DB, descomente:
    // await MetricaExtracao.create({
    //   timestamp: new Date(),
    //   taxa_sucesso: resultado.valido ? 1 : 0,
    //   taxa_completude: resultado.taxa_completude,
    //   erros: resultado.erros,
    //   avisos: resultado.avisos,
    //   tempo_processamento_ms: resultado.tempo_ms,
    //   tokens_usados: resultado.tokens
    // })

    // Por enquanto, log em console com estrutura para análise
    console.log(`📊 Métrica de Extração:`, {
      valido: resultado.valido,
      completude: resultado.taxa_completude + '%',
      erros: resultado.erros.length,
      avisos: resultado.avisos.length,
      tempo_ms: resultado.tempo_ms
    })
  } catch (err) {
    console.warn(`⚠️  Erro ao registrar métrica:`, err.message)
  }
}

/**
 * POST /api/parecer-acesso/extrair
 * Upload and process a Parecer de Acesso PDF
 *
 * Steps:
 * 1. Parse PDF and extract text
 * 2. Extract client, installation, and equipment data (using Gemini API)
 * 3. Validate extracted data quality
 * 4. Search for existing client or create new
 * 5. Look up equipment in database
 * 6. Create ProjetoFV with extracted data
 * 7. Generate unifilar SVG diagram
 * 8. Return project, diagram, and extracted data with quality metrics
 */
export const extrairParecer = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo PDF não fornecido' })
    }

    console.log(`📄 Processing Parecer PDF... (${req.file.size} bytes)`)

    // ===== STEP 1: Parse PDF =====
    let pdfData, texto
    try {
      pdfData = await pdf(req.file.buffer)
      texto = pdfData.text || ''
      console.log(`✓ PDF parsed: ${pdfData.numpages} pages`)
    } catch (pdfErr) {
      console.error('❌ Erro ao fazer parse do PDF:', pdfErr.message)
      return res.status(400).json({
        erro: 'Erro ao processar PDF. Verifique se o arquivo é válido.',
        detalhes: pdfErr.message
      })
    }

    // ===== STEP 2: Extract data from parecer using Gemini API =====
    const tempoInicio = Date.now()
    let dadosCliente, dadosInstalacao, dadosEquipamento, validacao
    try {
      const dadosExtraidos = await extrairPareceComGemini(req.file.buffer)
      dadosCliente = dadosExtraidos.cliente
      dadosInstalacao = dadosExtraidos.instalacao
      dadosEquipamento = dadosExtraidos.equipamento

      // Validar qualidade da extração
      validacao = validarExtracao({
        cliente: dadosCliente,
        instalacao: dadosInstalacao,
        equipamento: dadosEquipamento
      })

      // Registrar métricas para otimização futura
      const tempoMs = Date.now() - tempoInicio
      registrarMetricaExtracao({
        valido: validacao.valido,
        taxa_completude: validacao.taxa_completude,
        erros: validacao.erros,
        avisos: validacao.avisos,
        tempo_ms: tempoMs
      })

      // Se há erros críticos, rejeitar
      if (!validacao.valido) {
        console.warn(`⚠️  Extração incompleta:`, validacao.erros)
        return res.status(400).json({
          erro: 'Dados insuficientes no Parecer',
          erros_extracao: validacao.erros,
          avisos: validacao.avisos,
          taxa_completude: validacao.taxa_completude
        })
      }

      console.log(`✓ Extração validada (${validacao.taxa_completude}% completa)`)

      // Coletar exemplo para treinamento futuro do modelo
      const exemploAdicionado = await adicionarExemploTreinamento(
        req.file.buffer,
        {
          cliente: dadosCliente,
          instalacao: dadosInstalacao,
          equipamento: dadosEquipamento,
          rede: {}
        },
        validacao
      )

      if (exemploAdicionado) {
        console.log(`📚 Exemplo adicionado ao conjunto de treinamento`)
      }
    } catch (geminiErr) {
      console.error(`❌ Erro na extração com Gemini:`, geminiErr.message)
      return res.status(400).json({
        erro: 'Erro ao processar Parecer com Gemini API',
        detalhes: geminiErr.message
      })
    }

    console.log(`✓ Data extracted:`, {
      nome: dadosCliente.nome,
      cpf: dadosCliente.cpf_cnpj,
      numero_cliente: dadosInstalacao.numero_cliente,
      painel_marca: dadosEquipamento.paineis.marca,
      inversor_marca: dadosEquipamento.inversor.marca,
    })

    // ===== STEP 3: Search for existing client or create new =====
    let cliente = null
    let clienteCreated = false

    // Search by CPF/CNPJ, account number, or email
    if (dadosCliente.cpf_cnpj || dadosInstalacao.numero_cliente) {
      const searchQuery = {}
      if (dadosCliente.cpf_cnpj) searchQuery.cpf_cnpj = dadosCliente.cpf_cnpj
      if (dadosInstalacao.numero_cliente) searchQuery.numero_cliente = dadosInstalacao.numero_cliente

      cliente = await Cliente.findOne({
        $or: Object.keys(searchQuery).map(key => ({ [key]: searchQuery[key] }))
      })
    }

    // If not found, create new client
    if (!cliente) {
      const novoCliente = new Cliente({
        nome: dadosCliente.nome || 'Cliente Parecer',
        email: dadosCliente.email || `${dadosInstalacao.numero_cliente || Date.now()}@parecer.local`,
        cpf_cnpj: dadosCliente.cpf_cnpj || '',
        numero_cliente: dadosInstalacao.numero_cliente || '',
        endereco_completo: dadosCliente.endereco || '',
        distribuidora: dadosInstalacao.distribuidora || '',
        tipo_ligacao: dadosInstalacao.fase_tensao || 'Monofásico',
        tags: ['parecer-import'],
      })

      try {
        cliente = await novoCliente.save()
        clienteCreated = true
        console.log(`✓ New cliente created: ${cliente._id}`)
      } catch (err) {
        // Handle duplicate email error
        if (err.code === 11000 && err.keyPattern.email) {
          console.warn(`⚠️  Email conflict, retrying with fallback...`)
          novoCliente.email = `${dadosInstalacao.numero_cliente || Math.random().toString(36).substring(7)}@parecer.local`
          cliente = await novoCliente.save()
          clienteCreated = true
        } else {
          throw err
        }
      }
    } else {
      console.log(`✓ Cliente found: ${cliente._id}`)
    }

    // ===== STEP 4: Look up equipment in database =====
    let painel = null
    let inversor = null

    if (dadosEquipamento.paineis.marca && dadosEquipamento.paineis.modelo) {
      painel = await Equipamento.findOne({
        tipo: 'modulo',
        fabricante: new RegExp(dadosEquipamento.paineis.marca, 'i'),
        modelo: new RegExp(dadosEquipamento.paineis.modelo, 'i'),
      })
      if (!painel) console.log(`⚠️  Painel não encontrado: ${dadosEquipamento.paineis.marca} ${dadosEquipamento.paineis.modelo}`)
    }

    if (dadosEquipamento.inversor.marca && dadosEquipamento.inversor.modelo) {
      inversor = await Equipamento.findOne({
        tipo: 'inversor',
        fabricante: new RegExp(dadosEquipamento.inversor.marca, 'i'),
        modelo: new RegExp(dadosEquipamento.inversor.modelo, 'i'),
      })
      if (!inversor) console.log(`⚠️  Inversor não encontrado: ${dadosEquipamento.inversor.marca} ${dadosEquipamento.inversor.modelo}`)
    }

    // ===== STEP 5: Create ProjetoFV =====
    const projeto = new ProjetoFV({
      clienteId: cliente._id,
      nome: `${cliente.nome} - Parecer ${dadosInstalacao.numero_cliente || new Date().toISOString().split('T')[0]}`,
      status: 'em_simulacao',
      endereco_completo: dadosCliente.endereco || cliente.endereco_completo,
      unidades_consumidoras: [
        {
          fase_tensao: dadosInstalacao.fase_tensao || 'Monofásico',
          grupo: 'B', // Default
          regra: dadosInstalacao.gd_tier || 'GD II',
          consumo_mensal_kwh: 0, // Will be updated later if available
        },
      ],
      equipamentos: {
        paineis: [
          {
            id: painel?._id,
            // P1-PARECER-ATLAS-LINK-01: vínculo persistente com o Atlas (só com match real)
            equipamento_id: painel?._id || null,
            marca: dadosEquipamento.paineis.marca || '',
            modelo: dadosEquipamento.paineis.modelo || '',
            potencia_w: dadosEquipamento.paineis.potencia_w || 0,
            quantidade: dadosEquipamento.quantidade_paineis || 1,
          },
        ],
        inversor: {
          id: inversor?._id,
          // P1-PARECER-ATLAS-LINK-01: vínculo persistente com o Atlas (só com match real)
          equipamento_id: inversor?._id || null,
          marca: dadosEquipamento.inversor.marca || '',
          modelo: dadosEquipamento.inversor.modelo || '',
          potencia_kw: dadosEquipamento.inversor.potencia_kw || 0,
          tipo: 'string',
          fases: dadosInstalacao.fase_tensao === 'Trifásico' ? 3 : 1,
        },
      },
    })

    await projeto.save()
    console.log(`✓ Projeto FV created: ${projeto._id}`)

    // ===== STEP 6: Generate Unifilar SVG =====
    let svgContent = ''
    try {
      // Otimizar configuração de strings
      const configStrings = gerarResumoPadraoStrings({
        equipamento: dadosEquipamento,
        quantidade_paineis: dadosEquipamento.quantidade_paineis || 20,
      })

      const numeroStrings = configStrings.numStrings || 1
      const painelsPorString = configStrings.paineisPorSerie || Math.ceil((dadosEquipamento.quantidade_paineis || 10) / (configStrings.numStrings || 1))
      const quantidadePaineis = configStrings.totalPaineis || dadosEquipamento.quantidade_paineis || 10

      if (configStrings.aviso) {
        console.log(`⚠️  ${configStrings.aviso}`)
      }
      console.log(`✓ Strings otimizadas: ${numeroStrings}x string de ${painelsPorString} painéis`)
      if (configStrings.potenciaTotal) {
        console.log(`  Potência total: ${configStrings.potenciaTotal}W, Tensão: ${Math.round(configStrings.tensaoNominal)}V`)
      }

      // Generate SVG using backend-compatible utility
      let conteudo = SVG.marcadores()

      const startX = 100
      const startY = 100

      // 1. Painéis (esquerda)
      for (let i = 0; i < numeroStrings; i++) {
        const x = startX
        const y = startY + i * 150
        const painelNesta = i === numeroStrings - 1 ? quantidadePaineis - i * painelsPorString : painelsPorString
        conteudo += SVG.painel(x, y, painelNesta, `String ${i + 1}`)
      }

      // 2. String Box (se múltiplas strings)
      let stringBoxX = startX + 150
      let stringBoxY = startY + (numeroStrings * 150) / 2 - 30
      if (numeroStrings > 1) {
        conteudo += SVG.stringBox(stringBoxX, stringBoxY, numeroStrings)
        stringBoxX += 120
      }

      // 3. Inversor (centro)
      let inversorX = numeroStrings > 1 ? stringBoxX : startX + 250
      let inversorY = startY + 80
      conteudo += SVG.inversor(inversorX, inversorY, dadosEquipamento.inversor.potencia_kw || 5, dadosEquipamento.inversor.modelo || 'Inversor')

      // 4. Quadro AC / Disjuntor
      let quadroX = inversorX + 150
      let quadroY = inversorY
      conteudo += SVG.disjuntor(quadroX, quadroY, '63A', 'C')

      // 5. Medidor Bidirecional
      let medidorX = quadroX + 100
      let medidorY = inversorY
      conteudo += SVG.medidorBidirecional(medidorX, medidorY)

      // 6. Rede Elétrica (direita)
      const fases = dadosInstalacao.fase_tensao === 'Trifásico' ? 3 : 1
      const tensaoLabel = dadosInstalacao.voltagem === 380 ? '220/380V' : '127V'
      conteudo += SVG.rede(medidorX + 150, medidorY, fases, tensaoLabel)

      // 7. Legenda
      conteudo += SVG.legendaFV()

      // 8. Criar SVG final
      svgContent = SVG.criarSVG(conteudo, `Diagrama Unifilar - ${cliente.nome}`)

      console.log(`✓ Unifilar SVG generated (${svgContent.length} bytes)`)
    } catch (err) {
      console.warn(`⚠️  Erro ao gerar unifilar: ${err.message}`)
      svgContent = '' // Continue without SVG if generation fails
    }

    // ===== STEP 7: Return results =====
    res.json({
      sucesso: true,
      projeto: {
        _id: projeto._id,
        nome: projeto.nome,
        clienteId: cliente._id,
        cliente_nome: cliente.nome,
        status: projeto.status,
        createdAt: projeto.createdAt,
      },
      cliente: {
        _id: cliente._id,
        nome: cliente.nome,
        novo: clienteCreated,
      },
      svg: svgContent,
      extractedData: {
        cliente: dadosCliente,
        instalacao: dadosInstalacao,
        equipamento: dadosEquipamento,
      },
      validacao: {
        taxa_completude: validacao.taxa_completude,
        erros: validacao.erros,
        avisos: validacao.avisos,
      },
      resumo: {
        cliente_encontrado: !clienteCreated,
        painel_encontrado_db: !!painel,
        inversor_encontrado_db: !!inversor,
        unifilar_gerado: svgContent.length > 100,
      },
    })
  } catch (err) {
    console.error('❌ Erro ao processar Parecer:', err)
    res.status(500).json({
      erro: err.message,
      detalhes: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    })
  }
}

/**
 * GET /api/parecer-acesso/:projectId/unifilar
 * Retrieve unifilar diagram for a specific project
 */
export const obterUnifilarProjeto = async (req, res) => {
  try {
    const { projectId } = req.params

    const projeto = await ProjetoFV.findById(projectId).populate('clienteId')
    if (!projeto) {
      return res.status(404).json({ erro: 'Projeto não encontrado' })
    }

    // Regenerate SVG from project data
    let svgContent = ''
    try {
      const painelInfo = projeto.equipamentos.paineis[0] || {}
      const inversorInfo = projeto.equipamentos.inversor || {}
      const unidadeInfo = projeto.unidades_consumidoras[0] || {}

      // Use existing strings if available, otherwise calculate
      const strings = projeto.strings && projeto.strings.length > 0 ? projeto.strings : []

      let conteudo = SVG.marcadores()

      const startX = 100
      const startY = 100

      // 1. Painéis
      const numStrings = strings.length || 1
      for (let i = 0; i < numStrings; i++) {
        const x = startX
        const y = startY + i * 150
        const stringInfo = strings[i] || {}
        const paineis = stringInfo.paineis || painelInfo.quantidade || 10
        conteudo += SVG.painel(x, y, paineis, `String ${i + 1}`)
      }

      // 2. String Box
      let stringBoxX = startX + 150
      let stringBoxY = startY + (numStrings * 150) / 2 - 30
      if (numStrings > 1) {
        conteudo += SVG.stringBox(stringBoxX, stringBoxY, numStrings)
        stringBoxX += 120
      }

      // 3. Inversor
      let inversorX = numStrings > 1 ? stringBoxX : startX + 250
      let inversorY = startY + 80
      conteudo += SVG.inversor(inversorX, inversorY, inversorInfo.potencia_kw || 5, inversorInfo.modelo || 'Inversor')

      // 4. Disjuntor AC
      let quadroX = inversorX + 150
      let quadroY = inversorY
      conteudo += SVG.disjuntor(quadroX, quadroY, '63A', 'C')

      // 5. Medidor
      let medidorX = quadroX + 100
      let medidorY = inversorY
      conteudo += SVG.medidorBidirecional(medidorX, medidorY)

      // 6. Rede
      const fases = unidadeInfo.fase_tensao === 'Trifásico' ? 3 : 1
      const tensaoLabel = unidadeInfo.fase_tensao === 'Trifásico' ? '220/380V' : '127V'
      conteudo += SVG.rede(medidorX + 150, medidorY, fases, tensaoLabel)

      // 7. Legenda
      conteudo += SVG.legendaFV()

      // 8. Criar SVG
      const clienteNome = projeto.clienteId?.nome || 'Projeto'
      svgContent = SVG.criarSVG(conteudo, `Diagrama Unifilar - ${clienteNome}`)
    } catch (err) {
      console.warn(`⚠️  Erro ao gerar unifilar: ${err.message}`)
    }

    res.json({
      sucesso: true,
      projectId: projeto._id,
      svg: svgContent,
    })
  } catch (err) {
    console.error('❌ Erro ao obter unifilar:', err)
    res.status(500).json({ erro: err.message })
  }
}
