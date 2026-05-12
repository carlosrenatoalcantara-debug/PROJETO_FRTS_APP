import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

async function listarModelos() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    const models = await genAI.listModels()

    console.log('\n📊 MODELOS DISPONÍVEIS:\n')
    const modelList = await models

    for await (const model of modelList) {
      console.log(`  • ${model.name} - Versão: ${model.version}`)
    }

  } catch (error) {
    console.error('❌ Erro ao listar modelos:', error.message)
  }
}

listarModelos()
