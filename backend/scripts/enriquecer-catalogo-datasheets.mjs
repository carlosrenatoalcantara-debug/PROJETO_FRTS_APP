#!/usr/bin/env node
import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import 'dotenv/config'
import fs from 'fs'
import os from 'os'
import path from 'path'
import mongoose from 'mongoose'
import { fileURLToPath } from 'url'
import { Equipamento } from '../src/models/Equipamento.js'
// S2.6.3: DatasheetProcessamento precisa ser importado para criar os índices
import '../src/models/DatasheetProcessamento.js'
import { extrairComGemini } from '../src/controllers/datasheetGeminiUnificado.js'
import { obterEstatisticasCache } from '../src/services/datasheetCacheService.js'
import {
  encontrarMatch,
  listarDatasheets,
  montarAtualizacaoIncremental,
  normalizarExtracaoGemini,
} from '../src/services/catalogoDatasheetEnriquecimento.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const flag = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null
const has = (name) => args.includes(`--${name}`)

function normalizarNomePasta(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function resolverDatasheetsDefault() {
  const explicit = flag('dir')
  if (explicit) return explicit

  const candidates = [
    path.join(os.homedir(), 'OneDrive', 'Área de Trabalho', 'datasheets'),
    path.join(os.homedir(), 'OneDrive', 'Area de Trabalho', 'datasheets'),
    path.join(os.homedir(), 'Desktop', 'datasheets'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  const oneDrive = path.join(os.homedir(), 'OneDrive')
  if (fs.existsSync(oneDrive)) {
    for (const child of fs.readdirSync(oneDrive, { withFileTypes: true })) {
      if (!child.isDirectory()) continue
      const n = normalizarNomePasta(child.name)
      if (n.includes('area') && n.includes('trabalho')) {
        const candidate = path.join(oneDrive, child.name, 'datasheets')
        if (fs.existsSync(candidate)) return candidate
      }
    }
  }

  return path.join(os.homedir(), 'OneDrive', 'Área de Trabalho', 'datasheets')
}

const datasheetsDir = resolverDatasheetsDefault()
const tipoFiltro = flag('tipo')
const limit = flag('limit') ? Number(flag('limit')) : null
const apply = has('apply')
const scanOnly = has('scan-only')
const verbose = has('verbose')
const threshold = flag('threshold') ? Number(flag('threshold')) : 55
const desconhecidoThreshold = flag('desconhecido-threshold') ? Number(flag('desconhecido-threshold')) : 70
const aplicarMesmoComCritico = has('aplicar-mesmo-com-critico')
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forte_solar'

const report = {
  inicio: new Date().toISOString(),
  modo: apply ? 'apply' : 'dry-run',
  datasheetsDir,
  totalArquivos: 0,
  processados: 0,
  // S2.6.3: contadores de cache
  cache_hits: 0,
  gemini_calls: 0,
  extraidos: 0,
  entradasTecnicas: 0,
  matches: 0,
  atualizaveis: 0,
  atualizados: 0,
  semMatch: 0,
  semCamposNovos: 0,
  validacaoCritica: 0,
  conflitos: 0,
  erros: 0,
  porTipo: {},
  itens: [],
}

function incTipo(tipo, campo) {
  report.porTipo[tipo] = report.porTipo[tipo] || {}
  report.porTipo[tipo][campo] = (report.porTipo[tipo][campo] || 0) + 1
}

function safeUri(uri) {
  return String(uri || '').replace(/\/\/[^@]+@/, '//***@')
}

async function conectar() {
  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    maxPoolSize: 3,
  })
}

async function salvarRelatorio() {
  report.fim = new Date().toISOString()
  const reportsDir = path.join(projectRoot, 'reports')
  fs.mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(reportsDir, `catalogo-enriquecimento-${stamp}.json`)
  fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8')
  return file
}

function logResumoInicial(arquivos) {
  console.log('S2.6.2 - Enriquecimento automatico do catalogo FV via datasheets')
  console.log(`Modo: ${apply ? 'APPLY (persistira alteracoes)' : 'DRY-RUN (sem alterar o banco)'}`)
  console.log(`Pasta: ${datasheetsDir}`)
  console.log(`Arquivos PDF encontrados: ${arquivos.length}`)
  if (tipoFiltro) console.log(`Filtro tipo: ${tipoFiltro}`)
  if (limit) console.log(`Limite: ${limit}`)
}

async function main() {
  if (!fs.existsSync(datasheetsDir)) {
    console.error(`Pasta de datasheets nao encontrada: ${datasheetsDir}`)
    process.exit(2)
  }

  let arquivos = listarDatasheets(datasheetsDir)
  if (tipoFiltro) arquivos = arquivos.filter(a => a.tipo === tipoFiltro)
  if (limit) arquivos = arquivos.slice(0, limit)
  report.totalArquivos = arquivos.length
  logResumoInicial(arquivos)

  if (scanOnly) {
    report.itens = arquivos.map(a => ({ arquivo: a.relative, tipo: a.tipo, status: 'scan' }))
    const relatorio = await salvarRelatorio()
    console.log(`Relatorio salvo em: ${relatorio}`)
    return
  }

  if (!process.env.GOOGLE_API_KEY) {
    console.error('GOOGLE_API_KEY nao configurada. O pipeline reutiliza o Gemini existente e precisa dessa chave no ambiente.')
    process.exit(3)
  }

  console.log(`MongoDB: ${safeUri(MONGODB_URI)}`)
  await conectar()
  const filtroEquipamentos = tipoFiltro ? { tipo: tipoFiltro } : {}
  const equipamentos = await Equipamento.find(filtroEquipamentos).lean()
  console.log(`Equipamentos carregados do catalogo: ${equipamentos.length}`)

  for (const arquivo of arquivos) {
    report.processados += 1
    incTipo(arquivo.tipo, 'processados')

    const item = {
      arquivo: arquivo.relative,
      tipo: arquivo.tipo,
      status: 'iniciado',
      entradas: [],
    }
    report.itens.push(item)

    try {
      if (verbose) console.log(`\n[${report.processados}/${report.totalArquivos}] ${arquivo.relative}`)
      const buffer = fs.readFileSync(arquivo.fullPath)
      // S2.6.3: passa arquivo_nome para rastreabilidade no cache
      const extracao = await extrairComGemini(buffer, arquivo.tipo, { arquivo_nome: arquivo.relative })

      // S2.6.3: contabiliza hits e calls Gemini
      if (extracao?._cache_hit) {
        report.cache_hits++
        incTipo(arquivo.tipo, 'cache_hits')
      } else {
        report.gemini_calls++
        incTipo(arquivo.tipo, 'gemini_calls')
      }

      if (!extracao?.sucesso) {
        item.status = 'erro_extracao'
        item.erro = extracao?.erro || 'extracao sem sucesso'
        report.erros += 1
        incTipo(arquivo.tipo, 'erros')
        console.warn(`Falha na extracao: ${arquivo.relative} - ${item.erro}`)
        continue
      }

      report.extraidos += 1
      incTipo(arquivo.tipo, 'extraidos')

      const entradas = normalizarExtracaoGemini(extracao, arquivo)
      report.entradasTecnicas += entradas.length
      item.totalEntradas = entradas.length

      for (const entrada of entradas) {
        const detalhe = {
          fabricante: entrada.fabricante,
          modelo: entrada.modelo,
          status: 'avaliando',
        }
        item.entradas.push(detalhe)

        const match = encontrarMatch(entrada, equipamentos, { threshold, desconhecidoThreshold })
        if (!match) {
          detalhe.status = 'sem_match'
          report.semMatch += 1
          incTipo(arquivo.tipo, 'sem_match')
          continue
        }

        report.matches += 1
        incTipo(arquivo.tipo, 'matches')
        detalhe.match = {
          id: String(match.equipamento._id),
          fabricante: match.equipamento.fabricante,
          modelo: match.equipamento.modelo,
          score: match.score,
        }

        const update = montarAtualizacaoIncremental(match.equipamento, entrada, { aplicarMesmoComCritico })
        detalhe.preenchidos = update.preenchidos || []
        detalhe.conflitos = update.conflitos || []
        detalhe.alertas = (update.alertas || []).map(a => ({ codigo: a.codigo, severidade: a.severidade, campo: a.campo }))
        report.conflitos += detalhe.conflitos.length

        if (!update.aplicar) {
          detalhe.status = update.motivo || 'nao_aplicavel'
          if (update.motivo === 'validacao_critica') report.validacaoCritica += 1
          if (update.motivo === 'sem_campos_novos') report.semCamposNovos += 1
          incTipo(arquivo.tipo, detalhe.status)
          continue
        }

        report.atualizaveis += 1
        incTipo(arquivo.tipo, 'atualizaveis')

        if (apply) {
          await Equipamento.collection.updateOne(
            { _id: match.equipamento._id },
            {
              $set: update.set,
              $push: update.push,
            }
          )
          report.atualizados += 1
          incTipo(arquivo.tipo, 'atualizados')
          detalhe.status = 'atualizado'
        } else {
          detalhe.status = 'dry_run_atualizavel'
        }

        if (verbose) {
          console.log(
            `  match ${detalhe.match.score}: ${detalhe.match.fabricante} ${detalhe.match.modelo} ` +
            `-> ${detalhe.status} (${detalhe.preenchidos.length} campo(s))`
          )
        }
      }

      item.status = 'processado'
    } catch (err) {
      item.status = 'erro'
      item.erro = err.message
      report.erros += 1
      incTipo(arquivo.tipo, 'erros')
      console.warn(`Erro em ${arquivo.relative}: ${err.message}`)
    }

    await new Promise(resolve => setTimeout(resolve, 400))
  }

  // S2.6.3: estatísticas do cache ao final do pipeline
  let cacheStats = null
  try {
    cacheStats = await obterEstatisticasCache()
    report.cache_stats = cacheStats
  } catch { /* silencioso se DB não disponível */ }

  await mongoose.disconnect()
  const relatorio = await salvarRelatorio()

  const sep = '─'.repeat(60)
  console.log(`\n${sep}`)
  console.log('RELATORIO FINAL — S2.6.2 Enriquecimento Datasheets')
  console.log(sep)
  console.log(`Processados          : ${report.processados}/${report.totalArquivos}`)
  console.log(`Extraidos            : ${report.extraidos}`)
  console.log(`Entradas tecnicas    : ${report.entradasTecnicas}`)
  console.log(`Matches              : ${report.matches}`)
  console.log(`Atualizaveis         : ${report.atualizaveis}`)
  console.log(`Atualizados          : ${report.atualizados}`)
  console.log(`Sem match            : ${report.semMatch}`)
  console.log(`Sem campos novos     : ${report.semCamposNovos}`)
  console.log(`Validacao critica    : ${report.validacaoCritica}`)
  console.log(`Conflitos preservados: ${report.conflitos}`)
  console.log(`Erros                : ${report.erros}`)

  // ── S2.6.3: ANÁLISE DO CACHE ──────────────────────────────────────────────
  console.log(`\n${sep}`)
  console.log('CACHE SEMANTICO — S2.6.3 Analise de Impacto')
  console.log(sep)
  console.log(`Cache hits (esta execucao) : ${report.cache_hits}`)
  console.log(`Chamadas Gemini (esta exec): ${report.gemini_calls}`)
  const totalExec = report.cache_hits + report.gemini_calls
  const hitRate = totalExec > 0 ? ((report.cache_hits / totalExec) * 100).toFixed(1) : '0.0'
  console.log(`Taxa de hit desta execucao : ${hitRate}%`)

  if (cacheStats) {
    console.log(`\nCache total no banco:`)
    console.log(`  Documentos cacheados     : ${cacheStats.total_documentos}`)
    console.log(`  Total hits acumulados    : ${cacheStats.total_hits_acumulados}`)
    console.log(`  Versao atual (${cacheStats.versao_atual})   : ${cacheStats.documentos_versao_atual} docs`)
    console.log(`  Versoes antigas          : ${cacheStats.documentos_versao_antiga} docs`)

    // Impacto estimado na cota Gemini Free Tier (1500 RPD)
    const cotaDiaria = 1500
    const docsParaProcessar = cacheStats.total_documentos
    const callsEconomizadas = cacheStats.total_hits_acumulados
    const pctCotaEconomizada = docsParaProcessar > 0
      ? ((callsEconomizadas / cotaDiaria) * 100).toFixed(1)
      : '0.0'
    console.log(`\nIMPACTO NA COTA GEMINI FREE TIER (${cotaDiaria} RPD):`)
    console.log(`  Chamadas economizadas    : ${callsEconomizadas}`)
    console.log(`  % da cota diaria poupada : ${pctCotaEconomizada}%`)
    console.log(`  Estimativa: ${docsParaProcessar} PDFs -> ${docsParaProcessar} calls na 1a execucao`)
    console.log(`  Estimativa: N-x execucoes subsequentes -> 0 calls (100% cache)`)
  }

  console.log(`\nESTRATEGIA DE INVALIDACAO DE CACHE:`)
  console.log(`  1. Hash SHA-256 muda    -> arquivo PDF diferente -> reprocessa`)
  console.log(`  2. versao_parser muda   -> prompt/logica mudou -> reprocessa`)
  console.log(`  3. --forcar (flag)      -> ignora cache explicitamente`)
  console.log(`  Para invalidar: bump VERSAO_PARSER em datasheetCacheService.js`)

  console.log(`\nSEGURANCA DE COLISAO SHA-256:`)
  console.log(`  Espaco de saida: 2^256 ~ 1.16e77 combinacoes`)
  console.log(`  Prob. colisao para 1 bilhao de PDFs: ~ 4.3e-58`)
  console.log(`  Risco pratico: ZERO no horizonte de vida do projeto`)

  console.log(`\nRelatorio JSON salvo em: ${relatorio}`)
  if (!apply) console.log('Dry-run concluido. Para persistir, rode novamente com --apply.')
}

main().catch(async (err) => {
  report.erros += 1
  report.erroFatal = err.message
  try { await salvarRelatorio() } catch {}
  console.error('Falha fatal:', err)
  process.exit(1)
})
