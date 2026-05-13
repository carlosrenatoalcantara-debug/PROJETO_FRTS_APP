import { PDFParse } from 'pdf-parse'
import { Cliente } from '../models/Cliente.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { Equipamento } from '../models/Equipamento.js'
import { extrairTodosParecer } from '../utils/extrairParecer.js'
import * as SVG from '../utils/simbolosUnifilar.js'

/**
 * POST /api/parecer-acesso/extrair
 * Upload and process a Parecer de Acesso PDF
 *
 * Steps:
 * 1. Parse PDF and extract text
 * 2. Extract client, installation, and equipment data
 * 3. Search for existing client or create new
 * 4. Look up equipment in database
 * 5. Create ProjetoFV with extracted data
 * 6. Generate unifilar SVG diagram
 * 7. Return project, diagram, and extracted data
 */
export const extrairParecer = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo PDF não fornecido' })
    }

    console.log(`📄 Processing Parecer PDF... (${req.file.size} bytes)`)

    // ===== STEP 1: Parse PDF =====
    const parser = new PDFParse({ data: req.file.buffer })
    const pdfData = await parser.parseBuffer()
    const textResult = await parser.getText()
    const texto = textResult.text

    console.log(`✓ PDF parsed: ${pdfData.numpages} pages`)

    // ===== STEP 2: Extract data from parecer =====
    const { cliente: dadosCliente, instalacao: dadosInstalacao, equipamento: dadosEquipamento } = extrairTodosParecer(texto)

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
            marca: dadosEquipamento.paineis.marca || '',
            modelo: dadosEquipamento.paineis.modelo || '',
            potencia_w: dadosEquipamento.paineis.potencia_w || 0,
            quantidade: dadosEquipamento.quantidade_paineis || 1,
          },
        ],
        inversor: {
          id: inversor?._id,
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
      // Calculate strings configuration
      const potenciaPainel = dadosEquipamento.paineis.potencia_w || 400
      const potenciaInversor = (dadosEquipamento.inversor.potencia_kw || 5) * 1000
      const quantidadePaineis = dadosEquipamento.quantidade_paineis || 10

      const painelsPorString = Math.ceil((potenciaInversor / potenciaPainel) * 0.75) // 75% utilization
      const numeroStrings = Math.ceil(quantidadePaineis / painelsPorString)

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

    // ===---- STEP 7: Return results ----=====
    await parser.destroy()

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
