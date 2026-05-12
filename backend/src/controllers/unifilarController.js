import * as SVG from '../utils/simbolosUnifilar.js'
import { criarSVGArquitetura, gerarArquiteturaCompleta } from '../utils/arquiteturaUnifilar.js'

export function gerarUnifilarFV(req, res) {
  try {
    const { paineis, strings, inversor, tensao_rede, bess } = req.body

    if (!paineis || !strings || !inversor) {
      return res.status(400).json({ erro: 'Dados incompletos: paineis, strings, inversor obrigatórios' })
    }

    const numeroStrings = strings.length || 1
    const totalPaineis = paineis || 10
    const painelsPorString = Math.ceil(totalPaineis / numeroStrings)

    let conteudo = SVG.marcadores()

    const startX = 100
    const startY = 100

    // 1. Painéis (esquerda)
    for (let i = 0; i < numeroStrings; i++) {
      const x = startX
      const y = startY + i * 150
      conteudo += SVG.painel(x, y, painelsPorString, `String ${i + 1}`)
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
    conteudo += SVG.inversor(inversorX, inversorY, inversor.potenciaKW, inversor.modelo)

    // 4. Quadro AC / Disjuntor
    let quadroX = inversorX + 150
    let quadroY = inversorY
    conteudo += SVG.disjuntor(quadroX, quadroY, '63A', 'C')

    // 5. Medidor Bidirecional
    let medidorX = quadroX + 100
    let medidorY = inversorY
    conteudo += SVG.medidorBidirecional(medidorX, medidorY)

    // 6. BESS (se híbrido)
    if (bess && bess.capacidade) {
      let bessX = inversorX
      let bessY = inversorY + 200
      conteudo += SVG.bateria(bessX, bessY, bess.capacidade, bess.voltagem || '48V')
    }

    // 7. Rede Elétrica (direita)
    const fases = tensao_rede === 'monofasico' ? 1 : 3
    conteudo += SVG.rede(medidorX + 150, medidorY, fases, tensao_rede === 'monofasico' ? '127V' : '220/380V')

    // 8. Legenda
    conteudo += SVG.legendaFV()

    const svg = SVG.criarSVG(conteudo, 'Diagrama Unifilar - Sistema FV')

    res.json({
      sucesso: true,
      svg,
      especificacoes: {
        totalPaineis,
        numeroStrings,
        painelsPorString,
        potenciaInversor: inversor.potenciaKW,
        temBESS: !!bess,
        tensaoRede: tensao_rede,
      },
    })
  } catch (err) {
    console.error('Erro ao gerar unifilar FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export function gerarUnifilarEV(req, res) {
  try {
    const { potencia_carregador, tensao, cabo, disjuntor, dr } = req.body

    if (!potencia_carregador || !tensao) {
      return res.status(400).json({ erro: 'Dados incompletos: potencia_carregador, tensao obrigatórios' })
    }

    let conteudo = SVG.marcadores()

    const startX = 150
    const startY = 150

    // 1. Rede Elétrica (esquerda)
    const fases = tensao === 'monofasico' ? 1 : 3
    const tensaoLabel = tensao === 'monofasico' ? '127V' : '220/380V'
    conteudo += SVG.rede(startX, startY, fases, tensaoLabel)

    // 2. Disjuntor Geral
    let disjuntorX = startX + 150
    let disjuntorY = startY + 50
    const correnteDisjuntor = disjuntor?.corrente || '32A'
    conteudo += SVG.disjuntor(disjuntorX, disjuntorY, correnteDisjuntor, 'C')

    // 3. DR (Diferencial Residual) 30mA
    let drX = disjuntorX + 120
    let drY = disjuntorY
    conteudo += SVG.disjuntor(drX, drY, '30mA', 'DR')

    // 4. Cabo de Alimentação
    let caboX = drX + 120
    let caboY = drY
    const bitolaCabo = cabo?.bitola || '6mm²'
    const comprimentoCabo = cabo?.comprimento || '10m'
    conteudo += `
      <!-- Cabo de Alimentação -->
      <line x1="${caboX}" y1="${caboY}" x2="${caboX + 80}" y2="${caboY}" class="linha" stroke-width="3"/>
      <text x="${(caboX + caboX + 80) / 2}" y="${caboY - 10}" class="label">${bitolaCabo}</text>
      <text x="${(caboX + caboX + 80) / 2}" y="${caboY + 20}" class="pequeno">${comprimentoCabo}</text>
    `

    // 5. Carregador EV
    let carregadorX = caboX + 120
    let carregadorY = caboY - 30
    conteudo += SVG.carregadorEV(carregadorX, carregadorY, potencia_carregador, tensaoLabel)

    // Legenda
    conteudo += SVG.legendaEV()

    const svg = SVG.criarSVG(conteudo, 'Diagrama Unifilar - Sistema EV')

    res.json({
      sucesso: true,
      svg,
      especificacoes: {
        potenciaCarregador: potencia_carregador,
        tensao,
        bitolaCabo,
        comprimentoCabo,
        disjuntor: correnteDisjuntor,
        dr: '30mA',
      },
    })
  } catch (err) {
    console.error('Erro ao gerar unifilar EV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export function gerarArquitetura(req, res) {
  try {
    const conteudo = gerarArquiteturaCompleta()
    const svg = criarSVGArquitetura(conteudo)

    res.json({
      sucesso: true,
      svg,
      tipo: 'arquitetura-sistema',
      componentes: {
        frontend: 'Vercel (React + Vite)',
        backend: 'Railway (Node.js + Express)',
        database: 'MongoDB Atlas',
        apisExternas: ['Google Gemini Vision', 'SolarMarket API'],
        status: 'Em produção',
      },
    })
  } catch (err) {
    console.error('Erro ao gerar arquitetura:', err)
    res.status(500).json({ erro: err.message })
  }
}
