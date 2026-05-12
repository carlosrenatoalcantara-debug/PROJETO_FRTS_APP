import 'dotenv/config'
import { readFileSync } from 'fs'
import path from 'path'
import { processarDatasheetEV } from './src/controllers/carregadorEVControllerGemini.js'

const pdfDir = 'C:\\Users\\Forte Solar\\OneDrive\\Área de Trabalho\\Carregador EV'

const arquivos = [
  'EVE 0074B - Datasheet rev 1.6.pdf',
  'EVE 0074C - Datasheet rev 1.6.pdf',
  'EVE 0110C - Datasheet rev 1.6.pdf',
  'EVE 0220B - Datasheet rev 1.6.pdf',
  'Evowatt 7kw KS1207A21.pdf',
  '[SOLPLANET] Datasheet - Evcharger 7.4kW (3).pdf',
  'Datasheet_CVBE_MO_220V_7.4KW.pdf',
]

async function testar() {
  console.log('\n🧪 TESTE COM PDFs DO USUÁRIO\n')

  let sucessos = 0
  let erros = 0
  let avisos = 0

  for (const arquivo of arquivos) {
    try {
      const fullPath = path.join(pdfDir, arquivo)
      const buffer = readFileSync(fullPath)

      console.log(`📄 ${arquivo}`)
      const resultado = await processarDatasheetEV(buffer)

      if (resultado.sucesso) {
        sucessos++
        const c = resultado.carregador
        console.log(`   ✅ SUCESSO - ${c.marca} ${c.modelo}`)
        if (resultado.avisos.length > 0) {
          avisos++
          resultado.avisos.forEach(a => console.log(`      ${a}`))
        }
      } else {
        erros++
        console.log(`   ❌ FALHA`)
        resultado.avisos.forEach(a => console.log(`      ${a}`))
      }
    } catch (err) {
      erros++
      console.log(`   ❌ ERRO: ${err.message}`)
    }
    console.log('')
  }

  console.log('='.repeat(70))
  console.log(`✅ Sucessos: ${sucessos}`)
  console.log(`⚠️  Com Avisos: ${avisos}`)
  console.log(`❌ Erros: ${erros}`)
  console.log('='.repeat(70) + '\n')
}

testar().catch(console.error)
