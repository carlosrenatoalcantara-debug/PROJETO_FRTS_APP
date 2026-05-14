import fs from 'fs'
import path from 'path'
import { PDFParse } from 'pdf-parse'

const parecerFiles = [
  '/mnt/c/Users/Forte Solar/OneDrive/Forte Solar/3 - Projetos/132 - Fazenda Alice/132.3 - Faz Alice A - 7015263029/Cosern - 2301040659/PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO - 2301040659.pdf',
  '/mnt/c/Users/Forte Solar/OneDrive/Forte Solar/3 - Projetos/182 - Debora Cunha/Cosern/PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO - 2404171686.pdf',
  '/mnt/c/Users/Forte Solar/OneDrive/Forte Solar/3 - Projetos/142 - Rubens Oliveira/Cosern/Cosern - Antigo/PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO - 2301202946.pdf',
]

async function analyzeParecer(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`\n⚠️  File not found: ${filePath}`)
      return
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`📄 FILE: ${path.basename(filePath)}`)
    console.log(`${'='.repeat(80)}`)

    const buffer = fs.readFileSync(filePath)
    const parser = new PDFParse({ data: buffer })

    const result = await parser.parseBuffer()
    const textResult = await parser.getText()
    const texto = textResult.text.toUpperCase()

    console.log(`Pages: ${result.numpages}\n`)
    console.log(`TEXT CONTENT (First 3500 chars):\n`)
    console.log(texto.substring(0, 3500))
    console.log(`\n${'─'.repeat(80)}\n`)

    await parser.destroy()
  } catch (err) {
    console.error(`❌ Error analyzing ${path.basename(filePath)}: ${err.message}`)
  }
}

async function main() {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`PARECER DE ACESSO DOCUMENT ANALYSIS`)
  console.log(`${'='.repeat(80)}`)

  for (const file of parecerFiles) {
    await analyzeParecer(file)
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`✅ Analysis Complete`)
  console.log(`${'='.repeat(80)}\n`)
}

main().catch(console.error)
