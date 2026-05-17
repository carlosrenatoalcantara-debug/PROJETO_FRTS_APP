#!/usr/bin/env node

/**
 * Script de teste para validar integração Claude Vision
 *
 * Uso:
 *   node test-claude-vision.js <caminho-do-pdf>
 *
 * Exemplo:
 *   node test-claude-vision.js ./datasheets/modulo-solar.pdf
 */

import fs from 'fs'
import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'

dotenv.config()

const arquivoPDF = process.argv[2]

if (!arquivoPDF) {
  console.error('❌ Uso: node test-claude-vision.js <arquivo-pdf>')
  process.exit(1)
}

if (!fs.existsSync(arquivoPDF)) {
  console.error(`❌ Arquivo não encontrado: ${arquivoPDF}`)
  process.exit(1)
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!ANTHROPIC_API_KEY) {
  console.error('❌ Variável ANTHROPIC_API_KEY não configurada')
  console.error('Configure em .env ou variáveis de ambiente')
  process.exit(1)
}

async function testarViaoClaude() {
  try {
    console.log('🔍 Testando Claude Vision...')
    console.log(`📄 Arquivo: ${arquivoPDF}`)

    // Ler arquivo
    const buffer = fs.readFileSync(arquivoPDF)
    const base64 = buffer.toString('base64')

    console.log(`📦 Tamanho: ${(buffer.length / 1024).toFixed(2)} KB`)

    // Inicializar cliente Claude
    const client = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    })

    console.log('\n📬 Enviando para Claude Vision...')

    // Tentar analisar como PDF (se Claude suportar)
    // Nota: Claude Vision funciona melhor com imagens. PDFs devem ser convertidos.
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Analise este datasheet de equipamento solar e extraia:

1. Garantia de Produto (anos)
2. Garantia de Performance (anos ou percentual)
3. Eficiência (%)
4. Selos e certificações visíveis
5. Modelo e Fabricante

Retorne um JSON estruturado com essa informação.`
            }
          ],
        }
      ],
    })

    console.log('\n✅ Resposta recebida de Claude:\n')
    console.log(message.content[0].text)

    // Tentar fazer parse do JSON
    try {
      const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const dados = JSON.parse(jsonMatch[0])
        console.log('\n📊 Dados Extraídos (JSON):')
        console.log(JSON.stringify(dados, null, 2))
      }
    } catch (e) {
      console.warn('⚠️ Não foi possível fazer parse do JSON')
    }

  } catch (err) {
    console.error('\n❌ Erro ao testar Claude Vision:')
    console.error(err.message)

    if (err.status === 401) {
      console.error('\n💡 Dica: Chave de API inválida ou expirada')
      console.error('Obtenha uma nova em: https://console.anthropic.com/api_keys')
    }

    if (err.status === 400 && err.message.includes('document')) {
      console.error('\n💡 Dica: Claude Vision não suporta PDFs diretos.')
      console.error('Converta o PDF para imagens PNG/JPEG e tente novamente.')
    }

    process.exit(1)
  }
}

// Executar
testarViaoClaude().then(() => {
  console.log('\n✅ Teste concluído com sucesso!')
  process.exit(0)
})
