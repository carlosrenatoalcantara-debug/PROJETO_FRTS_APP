#!/usr/bin/env node

/**
 * TESTE COMPLETO - Gemini Vision API com todas as amostras
 *
 * Processa todos os PDFs no diretório pdfs_teste
 * Valida extração de dados para cada tipo
 * Gera relatório detalhado
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extrairComGemini } from './src/controllers/datasheetGeminiUnificado.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Cores para terminal
const cores = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
}

const log = {
  titulo: (t) => console.log(`\n${cores.bright}${cores.cyan}${t}${cores.reset}\n`),
  sucesso: (t) => console.log(`${cores.green}✅ ${t}${cores.reset}`),
  erro: (t) => console.log(`${cores.red}❌ ${t}${cores.reset}`),
  info: (t) => console.log(`${cores.blue}ℹ️ ${t}${cores.reset}`),
  aviso: (t) => console.log(`${cores.yellow}⚠️ ${t}${cores.reset}`),
}

async function main() {
  log.titulo('═══════════════════════════════════════════════════════════════')
  console.log('TESTE COMPLETO - GEMINI VISION API')
  console.log('Processando TODOS os documentos de amostra')
  log.titulo('═══════════════════════════════════════════════════════════════')

  // Validação inicial
  if (!process.env.GOOGLE_API_KEY) {
    log.erro('GOOGLE_API_KEY não está configurada!')
    process.exit(1)
  }
  log.sucesso(`API Key configurada: ${process.env.GOOGLE_API_KEY.substring(0, 10)}...`)

  const dirSamples = path.join(__dirname, 'pdfs_teste')
  if (!fs.existsSync(dirSamples)) {
    log.erro(`Diretório não encontrado: ${dirSamples}`)
    process.exit(1)
  }

  const arquivos = fs.readdirSync(dirSamples)
    .filter(f => f.endsWith('.pdf'))
    .sort()

  log.info(`${arquivos.length} documentos encontrados para processar`)

  // Resultados
  const resultados = {
    total: arquivos.length,
    sucesso: 0,
    erro: 0,
    detalhes: [],
    porTipo: {},
  }

  // Processar cada arquivo
  for (let i = 0; i < arquivos.length; i++) {
    const arquivo = arquivos[i]
    const numero = i + 1
    const porcentagem = ((numero / arquivos.length) * 100).toFixed(1)

    console.log(`\n${'─'.repeat(70)}`)
    console.log(`[${numero}/${arquivos.length} - ${porcentagem}%] ${arquivo}`)
    console.log('─'.repeat(70))

    try {
      const caminhoCompleto = path.join(dirSamples, arquivo)
      const buffer = fs.readFileSync(caminhoCompleto)
      const tamanho = (buffer.length / 1024).toFixed(2)

      log.info(`Tamanho: ${tamanho} KB`)
      log.info('Processando...')

      const resultado = await extrairComGemini(buffer, 'auto')

      if (resultado.sucesso) {
        resultados.sucesso++
        const tipo = resultado.dados.tipo || resultado.tipoDocumento

        if (!resultados.porTipo[tipo]) {
          resultados.porTipo[tipo] = 0
        }
        resultados.porTipo[tipo]++

        log.sucesso('Extração bem-sucedida!')
        console.log(`   Tipo: ${cores.bright}${resultado.tipoDocumento}${cores.reset}`)
        console.log(`   Fabricante: ${resultado.dados.fabricante || 'N/A'}`)
        console.log(`   Modelo: ${resultado.dados.modelo || 'N/A'}`)

        // Mostrar campos principais por tipo
        if (resultado.tipoDocumento === 'modulo') {
          if (resultado.dados.variantes?.[0]) {
            const v = resultado.dados.variantes[0]
            console.log(`   Potência: ${v.potencia_w}W`)
            console.log(`   VOC: ${v.voc_v}V, ISC: ${v.isc_a}A`)
            console.log(`   Eficiência: ${v.eficiencia_pct}%`)
          }
          console.log(`   Garantia: ${resultado.dados.garantia_produto_anos} anos (produto) / ${resultado.dados.garantia_performance_anos} anos (performance)`)
        }

        if (resultado.tipoDocumento === 'inversor') {
          if (resultado.dados.variantes?.[0]) {
            const v = resultado.dados.variantes[0]
            console.log(`   Potência: ${v.potencia_nominal_kw} kW`)
            console.log(`   Fases: ${v.fases_ac}F`)
            console.log(`   MPPTs: ${v.n_mppts}`)
            console.log(`   Eficiência: ${v.eficiencia_maxima_pct}%`)
          }
        }

        if (resultado.tipoDocumento === 'carregador_ev') {
          console.log(`   Potência: ${resultado.dados.potencia_kw} kW`)
          console.log(`   Tensão: ${resultado.dados.tensao_entrada_v}V (${resultado.dados.numero_fases_entrada}F)`)
          console.log(`   Corrente saída: ${resultado.dados.corrente_saida_maxima_a}A`)
          console.log(`   Conector: ${resultado.dados.tipo_conector}`)
        }

        resultados.detalhes.push({
          arquivo,
          status: 'sucesso',
          tipo: resultado.tipoDocumento,
          fabricante: resultado.dados.fabricante,
          modelo: resultado.dados.modelo,
        })
      } else {
        resultados.erro++
        log.erro(`Erro na extração: ${resultado.erro}`)
        resultados.detalhes.push({
          arquivo,
          status: 'erro',
          erro: resultado.erro,
        })
      }

      // Delay para não sobrecarregar a API (Gemini tem rate limit)
      if (i < arquivos.length - 1) {
        log.aviso('Aguardando 2 segundos antes do próximo documento...')
        await new Promise(r => setTimeout(r, 2000))
      }
    } catch (erro) {
      resultados.erro++
      log.erro(`Erro ao processar: ${erro.message}`)
      resultados.detalhes.push({
        arquivo,
        status: 'erro',
        erro: erro.message,
      })
    }
  }

  // RELATÓRIO FINAL
  log.titulo('═══════════════════════════════════════════════════════════════')
  console.log('RELATÓRIO FINAL')
  log.titulo('═══════════════════════════════════════════════════════════════')

  const taxaSucesso = ((resultados.sucesso / resultados.total) * 100).toFixed(1)
  console.log(`\n${cores.bright}Estatísticas:${cores.reset}`)
  console.log(`  Total processado: ${resultados.total}`)
  console.log(`  ${cores.green}Sucessos: ${resultados.sucesso}${cores.reset}`)
  console.log(`  ${cores.red}Erros: ${resultados.erro}${cores.reset}`)
  console.log(`  Taxa de sucesso: ${taxaSucesso}%`)

  if (Object.keys(resultados.porTipo).length > 0) {
    console.log(`\n${cores.bright}Distribuição por tipo:${cores.reset}`)
    for (const [tipo, count] of Object.entries(resultados.porTipo)) {
      console.log(`  ${tipo}: ${count} documento(s)`)
    }
  }

  console.log(`\n${cores.bright}Detalhes por arquivo:${cores.reset}\n`)
  for (const detalhe of resultados.detalhes) {
    const status = detalhe.status === 'sucesso'
      ? `${cores.green}✅${cores.reset}`
      : `${cores.red}❌${cores.reset}`
    console.log(`${status} ${detalhe.arquivo}`)
    if (detalhe.tipo) {
      console.log(`   Tipo: ${detalhe.tipo}`)
      if (detalhe.fabricante) console.log(`   Fabricante: ${detalhe.fabricante}`)
      if (detalhe.modelo) console.log(`   Modelo: ${detalhe.modelo}`)
    }
    if (detalhe.erro) {
      console.log(`   Erro: ${detalhe.erro}`)
    }
    console.log()
  }

  // Salvar relatório
  const caminhoRelatorio = path.join(__dirname, 'relatorio-gemini-teste.json')
  fs.writeFileSync(caminhoRelatorio, JSON.stringify(resultados, null, 2))
  log.info(`Relatório salvo em: ${caminhoRelatorio}`)

  // Resultado final
  log.titulo('═══════════════════════════════════════════════════════════════')
  if (resultados.erro === 0) {
    console.log(`${cores.green}${cores.bright}🎉 TODOS OS TESTES PASSARAM COM ÊXITO!${cores.reset}\n`)
  } else {
    console.log(`${cores.yellow}Teste concluído com ${resultados.erro} erro(s)${cores.reset}\n`)
  }

  console.log('Próximas etapas:')
  console.log('  1. Integrar datasheetGeminiUnificado.js ao equipamentosController.js')
  console.log('  2. Remover datasheetController.js (Claude) se desejar usar apenas Gemini')
  console.log('  3. Atualizar rotas para usar nova extração')
  console.log('  4. Testar através da API HTTP\n')

  process.exit(resultados.erro > 0 ? 1 : 0)
}

main().catch(erro => {
  log.erro(`Erro fatal: ${erro.message}`)
  console.error(erro)
  process.exit(1)
})
