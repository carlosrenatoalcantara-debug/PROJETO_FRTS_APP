import 'dotenv/config'
import { PDFParse } from 'pdf-parse'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'

const pdfDir = 'C:\\Users\\Forte Solar\\OneDrive\\Área de Trabalho\\Carregador EV'

async function analisarPDF(arquivo) {
  try {
    const fullPath = path.join(pdfDir, arquivo)
    const buffer = readFileSync(fullPath)
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const textoOriginal = result.text
    const texto = textoOriginal.toUpperCase()

    console.log('\n' + '='.repeat(70))
    console.log('📄 ' + arquivo)
    console.log('='.repeat(70))

    // Linhas iniciais
    const linhas = textoOriginal.split('\n')
    console.log('\nPrimeiras 10 linhas:')
    linhas.slice(0, 10).forEach((l, i) => {
      const preview = l.substring(0, 65)
      console.log(`  ${i}: ${preview}`)
    })

    // Marca
    const marcasConhecidas = ['INTELBRAS', 'WALLBOX', 'ABB', 'SIEMENS', 'SOLPLANET', 'BELENERGY', 'EVOWATT', 'DELTA', 'KEMPOWER', 'CEMOSA', 'PHOENIX']
    const marcasFound = marcasConhecidas.filter(m => texto.includes(m))
    console.log('\n📍 Marca encontrada:', marcasFound.length > 0 ? marcasFound[0] : '❌ NENHUMA')

    // Modelo
    const modelPatterns = [
      /EVE\s*0\d{3}[A-Z]?/i,
      /KS\s*\d{4}[A-Z0-9]*/i,
      /SOL[\s\-]*[\d.]+[A-Z]?/i,
      /CVBE[\s\-]*[A-Z0-9]*/i,
      /([A-Z]{2,}[\s\-]*[0-9]{3,}[A-Z0-9\-]*)/
    ]
    let modelo = '❌ NÃO ENCONTRADO'
    for (const pattern of modelPatterns) {
      const match = textoOriginal.substring(0, 500).match(pattern)
      if (match) {
        modelo = '✅ ' + (match[0] || match[1])
        break
      }
    }
    console.log('🔧 Modelo:', modelo)

    // Potência
    const potPattern = /(\d+(?:[\.,]\d+)?)\s*KW/i
    const potencia = textoOriginal.match(potPattern)?.[1]
    console.log('⚡ Potência:', potencia ? `✅ ${potencia} kW` : '❌ NÃO ENCONTRADA')

    // Tipo
    let tipo = '❌'
    if (texto.includes('TRIFÁSICO') || texto.includes('THREE PHASE') || texto.includes('3F+N')) {
      tipo = '✅ AC_Tri'
    } else if (texto.includes('DC') || texto.includes('DIRECT CURRENT')) {
      tipo = '✅ AC_DC'
    } else {
      tipo = '✅ AC_Mono'
    }
    console.log('🔌 Tipo:', tipo)

    await parser.destroy()

  } catch (err) {
    console.log('\n❌ ERRO:', err.message)
  }
}

async function main() {
  try {
    const files = readdirSync(pdfDir)
      .filter(f => f.endsWith('.pdf'))
      .sort()

    console.log(`\n🔍 ANÁLISE DE ${files.length} ARQUIVOS PDFs\n`)

    for (const arquivo of files) {
      await analisarPDF(arquivo)
    }

    console.log('\n' + '='.repeat(70))
    console.log('✅ Análise concluída!')
    console.log('='.repeat(70) + '\n')

  } catch (err) {
    console.error('Erro:', err.message)
  }
}

main()
