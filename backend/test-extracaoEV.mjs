import 'dotenv/config'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'
import { processarDatasheetEV } from './src/controllers/carregadorEVControllerGemini.js'

async function testarExtracao() {
  console.log('\n🧪 TESTE DE EXTRAÇÃO - CARREGADORES EV COM GOOGLE GEMINI\n')
  
  const pdfDir = './pdfs_teste'
  let arquivos = []
  
  try {
    arquivos = readdirSync(pdfDir)
      .filter(f => f.endsWith('.pdf'))
      .slice(0, 2)
  } catch (err) {
    console.log(`❌ Erro ao ler diretório ${pdfDir}`)
    return
  }
  
  if (arquivos.length === 0) {
    console.log('❌ Nenhum PDF encontrado')
    return
  }
  
  let sucessos = 0
  let erros = 0
  
  for (const nomeArquivo of arquivos) {
    const caminhoCompleto = path.join(pdfDir, nomeArquivo)
    
    try {
      console.log(`📄 ${nomeArquivo}`)
      const buffer = readFileSync(caminhoCompleto)
      console.log(`   Tamanho: ${(buffer.length / 1024).toFixed(1)} KB`)
      
      console.log(`   ⏳ Enviando para Google Gemini...`)
      const resultado = await processarDatasheetEV(buffer)
      
      if (resultado.sucesso) {
        sucessos++
        console.log(`   ✅ SUCESSO`)
        const c = resultado.carregador
        console.log(`      • Marca: ${c.marca}`)
        console.log(`      • Modelo: ${c.modelo}`)
        console.log(`      • Tipo: ${c.tipo}`)
        console.log(`      • Potência: ${c.potencia_kw} kW`)
        console.log(`      • Tensão: ${c.tensao_entrada_v}V / ${c.corrente_entrada_a}A`)
      } else {
        erros++
        console.log(`   ⚠️  Falha - Avisos: ${resultado.avisos.join(' | ')}`)
      }
      
    } catch (err) {
      erros++
      console.log(`   ❌ Erro: ${err.message}`)
    }
    console.log('')
  }
  
  console.log(`\n✅ Teste concluído! Sucessos: ${sucessos} | Erros: ${erros}\n`)
}

testarExtracao().catch(console.error)
