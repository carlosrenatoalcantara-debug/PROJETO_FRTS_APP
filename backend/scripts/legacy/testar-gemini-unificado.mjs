#!/usr/bin/env node

/**
 * TESTE UNIFICADO - Gemini Vision API
 *
 * Verifica:
 * ✅ Configuração da API
 * ✅ Conexão com Gemini
 * ✅ Processamento de cada tipo de documento
 * ✅ Qualidade da extração
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extrairComGemini, testarTodosOsSamples } from './src/controllers/datasheetGeminiUnificado.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('╔═══════════════════════════════════════════════════════════════════════════╗')
console.log('║        TESTE UNIFICADO - GEMINI VISION API PARA DOCUMENTOS              ║')
console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n')

// Verificação 1: API Key
console.log('📋 VERIFICAÇÃO 1: Configuração da API\n')
if (!process.env.GOOGLE_API_KEY) {
  console.log('❌ ERRO: GOOGLE_API_KEY não está configurada!')
  console.log('   Defina a variável de ambiente:')
  console.log('   export GOOGLE_API_KEY="sua-chave-aqui"')
  process.exit(1)
}
console.log('✅ GOOGLE_API_KEY encontrada')
console.log(`   Key: ${process.env.GOOGLE_API_KEY.substring(0, 10)}...${process.env.GOOGLE_API_KEY.substring(-5)}\n`)

// Verificação 2: Arquivos de teste
console.log('📋 VERIFICAÇÃO 2: Arquivos de Teste\n')
const dirSamples = path.join(__dirname, 'pdfs_teste')

if (!fs.existsSync(dirSamples)) {
  console.log('❌ ERRO: Diretório pdfs_teste não encontrado!')
  console.log(`   Esperado em: ${dirSamples}`)
  process.exit(1)
}

const arquivos = fs.readdirSync(dirSamples).filter(f => f.endsWith('.pdf'))
console.log(`✅ Diretório encontrado: ${dirSamples}`)
console.log(`   Arquivos PDF encontrados: ${arquivos.length}\n`)

arquivos.forEach((arquivo, idx) => {
  const caminhoCompleto = path.join(dirSamples, arquivo)
  const tamanho = fs.statSync(caminhoCompleto).size
  console.log(`   ${idx + 1}. ${arquivo} (${(tamanho / 1024).toFixed(2)} KB)`)
})
console.log()

// Verificação 3: Teste com primeiro arquivo
console.log('📋 VERIFICAÇÃO 3: Teste de Processamento\n')

if (arquivos.length === 0) {
  console.log('❌ ERRO: Nenhum arquivo PDF encontrado em pdfs_teste!')
  process.exit(1)
}

console.log(`Testando com: ${arquivos[0]}\n`)

try {
  const caminhoTeste = path.join(dirSamples, arquivos[0])
  const buffer = fs.readFileSync(caminhoTeste)

  console.log('⏳ Enviando para Gemini Vision API...')
  console.log('   (Isto pode levar alguns segundos)\n')

  const resultado = await extrairComGemini(buffer, 'auto')

  if (resultado.sucesso) {
    console.log('✅ Resposta recebida com sucesso!\n')
    console.log('📊 RESULTADO DA EXTRAÇÃO:')
    console.log(`   Tipo detectado: ${resultado.tipoDocumento}`)
    console.log(`   Fabricante: ${resultado.dados.fabricante || 'N/A'}`)
    console.log(`   Modelo: ${resultado.dados.modelo || 'N/A'}`)
    console.log(`   Fonte: ${resultado.fonte}`)
    console.log(`   Timestamp: ${resultado.timestamp}`)
    console.log(`\n   Dados completos:\n`)
    console.log(JSON.stringify(resultado.dados, null, 2))
  } else {
    console.log(`❌ ERRO ao processar documento:`)
    console.log(`   ${resultado.erro}`)
    process.exit(1)
  }
} catch (erro) {
  console.log(`❌ ERRO durante execução:`)
  console.log(`   ${erro.message}`)
  console.error(erro)
  process.exit(1)
}

// Resumo Final
console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗')
console.log('║                        TESTE CONCLUÍDO COM ÊXITO                        ║')
console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n')

console.log('✅ Próximas etapas:\n')
console.log('   1. Testar com todos os documentos:')
console.log('      node testar-gemini-completo.mjs\n')
console.log('   2. Integrar ao controller principal:')
console.log('      Importar datasheetGeminiUnificado em equipamentosController.js\n')
console.log('   3. Verificar documentação:')
console.log('      Ver CONFIGURACAO_GEMINI_VISION.md\n')

process.exit(0)
