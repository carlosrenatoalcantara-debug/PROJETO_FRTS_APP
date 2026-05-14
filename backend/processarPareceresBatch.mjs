#!/usr/bin/env node

/**
 * Batch Processor para Parecer de Acesso
 * Processa múltiplos PDFs e coleta dados de treinamento automaticamente
 *
 * Uso: node processarPareceresBatch.mjs <caminhos dos PDFs separados por espaço>
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Configuração
const API_URL = process.env.API_URL || 'http://localhost:5005'
const API_ENDPOINT = `${API_URL}/api/parecer-acesso/extrair`
const STATS_ENDPOINT = `${API_URL}/api/parecer-acesso/treinamento/estatisticas`
const EXPORT_ENDPOINT = `${API_URL}/api/parecer-acesso/treinamento/exportar`

// Cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

/**
 * Log com cores
 */
const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  debug: (msg) => console.log(`${colors.gray}🔍 ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}\n`),
}

/**
 * Processar um Parecer PDF
 */
async function processarParecer(caminhoArquivo, indice, total) {
  try {
    // Debug: Log do caminho recebido
    console.log(`DEBUG [${indice}]: Tipo=${typeof caminhoArquivo}, Comprimento=${caminhoArquivo?.length}`)

    // Verificar se arquivo existe
    if (!fs.existsSync(caminhoArquivo)) {
      log.error(`Arquivo não encontrado: ${caminhoArquivo}`)
      return { sucesso: false, erro: 'Arquivo não encontrado', arquivo: caminhoArquivo }
    }

    const nomeArquivo = path.basename(caminhoArquivo)
    const tamanhoMB = (fs.statSync(caminhoArquivo).size / 1024 / 1024).toFixed(2)

    log.info(`[${indice}/${total}] Processando: ${nomeArquivo} (${tamanhoMB}MB)`)

    // Ler arquivo como Buffer
    const pdfBuffer = fs.readFileSync(caminhoArquivo)

    // Enviar para API usando FormData nativa (Node v18+)
    const formData = new FormData()
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    formData.append('pdf', blob, nomeArquivo)

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000), // 60 segundos timeout
    })

    if (!response.ok) {
      const erro = await response.json()
      log.error(`[${indice}/${total}] Erro ao processar ${nomeArquivo}: ${erro.erro}`)
      return {
        sucesso: false,
        erro: erro.erro,
        arquivo: nomeArquivo,
        statusCode: response.status,
      }
    }

    const dados = await response.json()

    if (!dados.sucesso) {
      log.warning(`[${indice}/${total}] Dados insuficientes no Parecer: ${nomeArquivo}`)
      return {
        sucesso: false,
        erro: 'Dados insuficientes',
        arquivo: nomeArquivo,
        completude: dados.validacao?.taxa_completude,
      }
    }

    log.success(
      `[${indice}/${total}] ${nomeArquivo} - Completude: ${dados.validacao.taxa_completude}% ✓`
    )

    return {
      sucesso: true,
      arquivo: nomeArquivo,
      completude: dados.validacao.taxa_completude,
      cliente: dados.cliente.nome,
      distribuidora: dados.extractedData.instalacao.distribuidora,
    }
  } catch (erro) {
    const mensagem = erro.message || JSON.stringify(erro)
    log.error(`[${indice}/${total}] Erro ao processar: ${mensagem}`)
    console.error(`DEBUG: Stack trace:`, erro.stack || 'N/A')
    return {
      sucesso: false,
      erro: mensagem,
      arquivo: caminhoArquivo,
    }
  }
}

/**
 * Processar lote de Parecer
 */
async function processarLote(caminhos) {
  const resultados = {
    total: caminhos.length,
    processados: 0,
    sucesso: 0,
    erro: 0,
    completude_media: 0,
    detalhes: [],
  }

  log.section(`🚀 INICIANDO PROCESSAMENTO EM LOTE`)
  log.info(`Total de arquivos: ${caminhos.length}`)
  log.info(`Endpoint: ${API_ENDPOINT}`)

  // Processar cada arquivo
  for (let i = 0; i < caminhos.length; i++) {
    const resultado = await processarParecer(caminhos[i], i + 1, caminhos.length)
    resultados.detalhes.push(resultado)

    if (resultado.sucesso) {
      resultados.sucesso++
      if (resultado.completude) {
        resultados.completude_media +=
          resultado.completude
      }
    } else {
      resultados.erro++
    }

    resultados.processados++

    // Pequeno delay entre requisições (500ms)
    if (i < caminhos.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  // Calcular completude média
  if (resultados.sucesso > 0) {
    const sucessos = resultados.detalhes.filter((r) => r.sucesso && r.completude)
    if (sucessos.length > 0) {
      resultados.completude_media = (
        sucessos.reduce((sum, r) => sum + r.completude, 0) / sucessos.length
      ).toFixed(1)
    }
  }

  return resultados
}

/**
 * Obter estatísticas de treinamento
 */
async function obterEstatisticas() {
  try {
    const response = await fetch(STATS_ENDPOINT)
    if (!response.ok) throw new Error('Erro ao obter estatísticas')
    return await response.json()
  } catch (erro) {
    log.warning(`Erro ao obter estatísticas: ${erro.message}`)
    return null
  }
}

/**
 * Exportar dados para fine-tuning
 */
async function exportarParaTreinamento() {
  try {
    log.info('Exportando dados para fine-tuning...')
    const response = await fetch(EXPORT_ENDPOINT, { method: 'POST' })

    if (!response.ok) throw new Error('Erro ao exportar')

    const resultado = await response.json()
    if (!resultado.sucesso) throw new Error(resultado.erro)

    log.success('Dados exportados com sucesso!')
    console.log('\nDetalhes da exportação:')
    console.log(`  📁 Arquivo: ${resultado.arquivo}`)
    console.log(`  📊 Total de exemplos: ${resultado.total_exemplos}`)
    console.log(`  📈 Distribuição por distribuidora:`)
    Object.entries(resultado.por_distribuidora).forEach(([dist, count]) => {
      console.log(`     - ${dist}: ${count} exemplos`)
    })

    return resultado
  } catch (erro) {
    log.error(`Erro ao exportar: ${erro.message}`)
    return null
  }
}

/**
 * Exibir resumo dos resultados
 */
function exibirResumo(resultados) {
  log.section(`📊 RESUMO DO PROCESSAMENTO`)

  console.log(`Total de arquivos:       ${colors.bright}${resultados.total}${colors.reset}`)
  console.log(`✅ Processados com sucesso:  ${colors.green}${resultados.sucesso}${colors.reset}`)
  console.log(`❌ Erros:                   ${colors.red}${resultados.erro}${colors.reset}`)
  console.log(`📈 Taxa de sucesso:          ${colors.cyan}${((resultados.sucesso / resultados.total) * 100).toFixed(1)}%${colors.reset}`)
  console.log(`⭐ Completude média:         ${colors.bright}${resultados.completude_media}%${colors.reset}`)

  // Detalhes por distribuidora
  const porDistribuidora = {}
  resultados.detalhes.forEach((r) => {
    if (r.distribuidora) {
      if (!porDistribuidora[r.distribuidora]) {
        porDistribuidora[r.distribuidora] = { count: 0, completude: [] }
      }
      porDistribuidora[r.distribuidora].count++
      if (r.completude) {
        porDistribuidora[r.distribuidora].completude.push(r.completude)
      }
    }
  })

  if (Object.keys(porDistribuidora).length > 0) {
    console.log(`\n📍 Distribuição por Distribuidora:`)
    Object.entries(porDistribuidora).forEach(([dist, data]) => {
      const mediaCompletude =
        data.completude.length > 0
          ? (data.completude.reduce((a, b) => a + b) / data.completude.length).toFixed(1)
          : 'N/A'
      console.log(`   - ${dist}: ${data.count} exemplos (completude média: ${mediaCompletude}%)`)
    })
  }

  // Erros detalhados
  const erros = resultados.detalhes.filter((r) => !r.sucesso)
  if (erros.length > 0) {
    console.log(`\n${colors.red}Arquivos com erro:${colors.reset}`)
    erros.forEach((e) => {
      console.log(`   - ${e.arquivo}: ${e.erro}`)
    })
  }
}

/**
 * Main
 */
async function main() {
  // Pegar argumentos de linha de comando
  let caminhos = process.argv.slice(2)

  if (caminhos.length === 0) {
    log.warning('Nenhum arquivo fornecido')
    console.log('Uso: node processarPareceresBatch.mjs <caminho1> <caminho2> ...')
    console.log('  ou: node processarPareceresBatch.mjs @arquivo-lista.txt')
    process.exit(1)
  }

  // Se começar com @, ler arquivo com lista de caminhos
  if (caminhos.length === 1 && caminhos[0].startsWith('@')) {
    const nomeArquivo = caminhos[0].substring(1)
    try {
      // Ler com encoding UTF-8 explícito
      const conteudo = fs.readFileSync(nomeArquivo, { encoding: 'utf8' })
      caminhos = conteudo
        .split(/\r?\n/) // Suporta tanto \n quanto \r\n
        .map((linha) => linha.trim())
        .filter((linha) => linha.length > 0 && !linha.startsWith('#')) // Ignorar linhas vazias e comentários

      // Validar que cada caminho é string válida
      caminhos = caminhos.map((c, idx) => {
        if (typeof c !== 'string') {
          console.warn(`⚠️  Caminho ${idx+1} não é string válida:`, typeof c)
          return null
        }
        return c
      }).filter(c => c !== null)

      log.info(`✅ Lido arquivo ${nomeArquivo} com ${caminhos.length} caminhos`)
    } catch (erro) {
      log.error(`Erro ao ler arquivo ${nomeArquivo}: ${erro.message}`)
      process.exit(1)
    }
  }

  // Filtrar apenas arquivos que existem e são PDFs
  caminhos = caminhos.filter((c) => {
    const existe = fs.existsSync(c)
    if (!existe) {
      log.warning(`Arquivo não encontrado: ${c}`)
    }
    return existe
  })

  if (caminhos.length === 0) {
    log.error('Nenhum arquivo válido fornecido')
    process.exit(1)
  }

  // Processar lote
  const resultados = await processarLote(caminhos)

  // Exibir resumo
  exibirResumo(resultados)

  // Obter e exibir estatísticas
  log.section(`📈 ESTATÍSTICAS DE TREINAMENTO`)
  const stats = await obterEstatisticas()
  if (stats) {
    console.log(`Status: ${stats.status}`)
    console.log(`Total de exemplos coletados: ${colors.bright}${stats.total_exemplos}${colors.reset}`)
    console.log(`Completude média: ${stats.taxa_media_completude}%`)

    if (stats.total_exemplos >= 50) {
      console.log(`\n${colors.green}${colors.bright}✅ PRONTO PARA FINE-TUNING!${colors.reset}`)
      console.log(`Você tem ${stats.total_exemplos} exemplos coletados.`)

      // Perguntar se quer exportar
      log.info('Exportando dados para fine-tuning do Gemini...')
      await exportarParaTreinamento()
    } else {
      console.log(`\n${colors.yellow}Faltam ${stats.faltam_exemplos} exemplos para fine-tuning.${colors.reset}`)
    }

    if (stats.distribuicao && Object.keys(stats.distribuicao).length > 0) {
      console.log(`\n📍 Distribuição:`)
      Object.entries(stats.distribuicao).forEach(([dist, data]) => {
        console.log(`   - ${dist}: ${data.count} exemplos (${data.avg_completude}% completude)`)
      })
    }
  }

  log.section(`✨ PROCESSAMENTO CONCLUÍDO`)
}

// Executar
main().catch((err) => {
  log.error(`Erro fatal: ${err.message}`)
  process.exit(1)
})
