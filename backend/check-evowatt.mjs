import { PDFParse } from 'pdf-parse'
import { readFileSync } from 'fs'
import path from 'path'

const pdfDir = 'C:\\Users\\Forte Solar\\OneDrive\\Área de Trabalho\\Carregador EV'
const arquivo = 'Evowatt 7kw KS1207A21.pdf'
const fullPath = path.join(pdfDir, arquivo)

console.log('Lendo:', fullPath)
const buffer = readFileSync(fullPath)

const parser = new PDFParse({ data: buffer })
parser.getText().then(result => {
  const texto = result.text
  const textoUpper = texto.toUpperCase()

  console.log('\n📊 ANÁLISE DO EVOWATT PDF:\n')

  // Procurar variações
  console.log('✓ Contém "Evowatt":', texto.includes('Evowatt'))
  console.log('✓ Contém "EVOWATT":', textoUpper.includes('EVOWATT'))
  console.log('✓ Contém "EMOBI":', textoUpper.includes('EMOBI'))

  // Listar primeiras 30 linhas
  console.log('\n📄 Primeiras 30 linhas:\n')
  const linhas = texto.split('\n').slice(0, 30)
  linhas.forEach((l, i) => {
    if (l.trim()) {
      console.log(`${i}: ${l.substring(0, 80)}`)
    }
  })

  parser.destroy()
}).catch(console.error)
