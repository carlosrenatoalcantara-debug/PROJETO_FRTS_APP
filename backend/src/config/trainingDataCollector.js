/**
 * Training Data Collector para Fine-Tuning do Gemini
 * Coleta exemplos de Parecer com extrações validadas
 * para treinar modelo customizado
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRAINING_DATA_DIR = path.join(__dirname, '../../data/training-data')
const TRAINING_FILE = path.join(TRAINING_DATA_DIR, 'parecer-training-examples.jsonl')

/**
 * Ensure training data directory exists
 */
export const inicializarTreinamento = () => {
  if (!fs.existsSync(TRAINING_DATA_DIR)) {
    fs.mkdirSync(TRAINING_DATA_DIR, { recursive: true })
    console.log(`📁 Diretório de treinamento criado: ${TRAINING_DATA_DIR}`)
  }
}

/**
 * Adicionar exemplo de treinamento validado
 * Formato: {input: base64_pdf, output: json_estruturado}
 */
export const adicionarExemploTreinamento = async (pdfBuffer, dadosExtraidos, validacao) => {
  try {
    // Validar que a extração foi bem-sucedida
    if (!validacao.valido) {
      console.warn(`⚠️  Exemplo rejeitado: extração com erros (${validacao.taxa_completude}% completa)`)
      return false
    }

    // Exemplo no formato esperado pelo Gemini
    const exemplo = {
      input: pdfBuffer.toString('base64'),
      output: JSON.stringify({
        cliente: dadosExtraidos.cliente,
        instalacao: dadosExtraidos.instalacao,
        equipamento: dadosExtraidos.equipamento,
        rede: dadosExtraidos.rede || {}
      }),
      metadata: {
        timestamp: new Date().toISOString(),
        taxa_completude: validacao.taxa_completude,
        avisos: validacao.avisos,
        distribuidora: dadosExtraidos.instalacao?.distribuidora,
        fase_tensao: dadosExtraidos.instalacao?.fase_tensao
      }
    }

    // Append ao arquivo JSONL (JSON Lines format - one JSON object per line)
    fs.appendFileSync(
      TRAINING_FILE,
      JSON.stringify(exemplo) + '\n',
      'utf-8'
    )

    console.log(`✅ Exemplo de treinamento adicionado (${validacao.taxa_completude}% completo)`)
    return true
  } catch (err) {
    console.error(`❌ Erro ao adicionar exemplo de treinamento:`, err.message)
    return false
  }
}

/**
 * Listar exemplos de treinamento coletados
 */
export const listarExemplosTreinamento = () => {
  try {
    if (!fs.existsSync(TRAINING_FILE)) {
      return {
        total: 0,
        exemplos: []
      }
    }

    const conteudo = fs.readFileSync(TRAINING_FILE, 'utf-8')
    const linhas = conteudo.split('\n').filter(l => l.trim())

    // Parse cada linha
    const exemplos = linhas.map((linha, index) => {
      try {
        const obj = JSON.parse(linha)
        return {
          numero: index + 1,
          completude: obj.metadata?.taxa_completude,
          distribuidora: obj.metadata?.distribuidora,
          fase: obj.metadata?.fase_tensao,
          timestamp: obj.metadata?.timestamp
        }
      } catch (e) {
        return null
      }
    }).filter(Boolean)

    return {
      total: exemplos.length,
      exemplos: exemplos,
      caminhoArquivo: TRAINING_FILE,
      statusTreinamento: exemplos.length >= 50 ? '✅ Pronto para fine-tuning' : `⏳ ${50 - exemplos.length} exemplos ainda necessários`
    }
  } catch (err) {
    console.error(`❌ Erro ao listar exemplos:`, err.message)
    return { total: 0, exemplos: [], erro: err.message }
  }
}

/**
 * Exportar dados para fine-tuning do Gemini
 * Gera arquivo em formato compatível com Gemini API
 */
export const exportarParaTreinamento = () => {
  try {
    if (!fs.existsSync(TRAINING_FILE)) {
      throw new Error('Nenhum dado de treinamento coletado ainda')
    }

    const conteudo = fs.readFileSync(TRAINING_FILE, 'utf-8')
    const exemplos = conteudo
      .split('\n')
      .filter(l => l.trim())
      .map(linha => {
        try {
          return JSON.parse(linha)
        } catch {
          return null
        }
      })
      .filter(Boolean)

    if (exemplos.length === 0) {
      throw new Error('Nenhum exemplo válido encontrado')
    }

    // Converter para formato Gemini Tuning
    const geminihemDados = exemplos.map(ex => ({
      text_input: `Extraia dados estruturados deste Parecer de Acesso em JSON:\n\n[PDF CONTENT - base64: ${ex.input.substring(0, 100)}...]`,
      output: ex.output
    }))

    const arquivo_saida = path.join(TRAINING_DATA_DIR, 'gemini-tuning-data.json')
    fs.writeFileSync(arquivo_saida, JSON.stringify(geminihemDados, null, 2), 'utf-8')

    console.log(`✅ Dados exportados para fine-tuning: ${arquivo_saida}`)
    console.log(`   Total de exemplos: ${exemplos.length}`)
    console.log(`   Distribuição por distribuidora:`)

    // Análise por distribuidora
    const porDistribuidora = {}
    exemplos.forEach(ex => {
      const dist = ex.metadata?.distribuidora || 'Desconhecida'
      porDistribuidora[dist] = (porDistribuidora[dist] || 0) + 1
    })

    Object.entries(porDistribuidora).forEach(([dist, count]) => {
      console.log(`     - ${dist}: ${count} exemplos`)
    })

    return {
      sucesso: true,
      arquivo: arquivo_saida,
      total_exemplos: exemplos.length,
      por_distribuidora: porDistribuidora
    }
  } catch (err) {
    console.error(`❌ Erro ao exportar:`, err.message)
    return { sucesso: false, erro: err.message }
  }
}

/**
 * Estatísticas de treinamento
 */
export const estatisticasTreinamento = () => {
  try {
    if (!fs.existsSync(TRAINING_FILE)) {
      return {
        status: 'vazio',
        total_exemplos: 0,
        taxa_media_completude: 0,
        distribuicao: {}
      }
    }

    const conteudo = fs.readFileSync(TRAINING_FILE, 'utf-8')
    const exemplos = conteudo
      .split('\n')
      .filter(l => l.trim())
      .map(linha => {
        try {
          return JSON.parse(linha)
        } catch {
          return null
        }
      })
      .filter(Boolean)

    const completudes = exemplos.map(ex => ex.metadata?.taxa_completude || 0)
    const media = completudes.length > 0
      ? (completudes.reduce((a, b) => a + b, 0) / completudes.length).toFixed(1)
      : 0

    const distribuicao = {}
    exemplos.forEach(ex => {
      const dist = ex.metadata?.distribuidora || 'Desconhecida'
      if (!distribuicao[dist]) {
        distribuicao[dist] = { count: 0, avg_completude: [] }
      }
      distribuicao[dist].count++
      distribuicao[dist].avg_completude.push(ex.metadata?.taxa_completude || 0)
    })

    // Calcular média de completude por distribuidora
    Object.keys(distribuicao).forEach(dist => {
      const valores = distribuicao[dist].avg_completude
      distribuicao[dist].avg_completude = (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1)
    })

    return {
      status: exemplos.length >= 50 ? '✅ Pronto para Fine-Tuning' : '⏳ Em Coleta',
      total_exemplos: exemplos.length,
      faltam_exemplos: Math.max(0, 50 - exemplos.length),
      taxa_media_completude: parseFloat(media),
      distribuicao: distribuicao,
      ultimoExemplo: exemplos[exemplos.length - 1]?.metadata?.timestamp
    }
  } catch (err) {
    console.error(`❌ Erro ao calcular estatísticas:`, err.message)
    return { erro: err.message }
  }
}

// Inicializar ao importar
inicializarTreinamento()
