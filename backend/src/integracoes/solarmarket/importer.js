/**
 * importer.js — S2.9 ETL SolarMarket
 *
 * Responsabilidade: orquestrar o pipeline completo de ETL.
 * Pode ser chamado via script CLI ou via endpoint de admin.
 *
 * Pipeline:
 *   1. extractor.extrairEquipamentos()     → lineItems brutos
 *   2. validator.filtrarLote()             → filtra placeholders e inválidos
 *   3. normalizer.normalizarLote()         → canonical Equipamento shape + hash
 *   4. validator.validarNormalizado()      → segunda barreira de qualidade
 *   5. matcher.encontrarMatchesEmLote()    → busca no banco (hash, norm, fuzzy)
 *   6. deduplicator.decidirAcao()         → criar | atualizar | ignorar
 *   7. deduplicator.executarAcao()        → persiste (ou simula em dry-run)
 *   8. Relatório final
 *
 * Uso programático:
 *   import { executarImport } from './importer.js'
 *   const relatorio = await executarImport({ dryRun: true, limitePropostas: 10 })
 *
 * Uso via script CLI:
 *   node scripts/importar-solarmarket.mjs
 *   node scripts/importar-solarmarket.mjs --apply
 *   node scripts/importar-solarmarket.mjs --limite=5 --apply
 */

import { extrairEquipamentos }       from './extractor.js'
import { filtrarLote, validarNormalizado } from './validator.js'
import { normalizarLote }            from './normalizer.js'
import { encontrarMatchesEmLote }    from './matcher.js'
import { decidirAcao, executarAcao } from './deduplicator.js'

// ─── Relatório vazio ──────────────────────────────────────────────────────

function criarRelatorioVazio() {
  return {
    iniciado_em:         new Date().toISOString(),
    finalizado_em:       null,
    dry_run:             true,

    // Extração
    extracao: {
      propostas_buscadas:    0,
      propostas_com_itens:   0,
      line_items_brutos:     0,
      produtos_diretos:      0,
      erros_extracao:        [],
    },

    // Filtragem
    filtragem: {
      aprovados:        0,
      rejeitados:       0,
      rejeitados_detalhe: [],
    },

    // Normalização
    normalizacao: {
      normalizados:          0,
      descartados:           0,
      duplicatas_por_hash:   0,
    },

    // Validação pós-normalização
    validacao_pos: {
      validos:    0,
      alertas:    0,
      rejeitados: 0,
    },

    // Matching
    matching: {
      hash_exato:    0,
      normalizado:   0,
      fuzzy:         0,
      sem_match:     0,
    },

    // Persistência
    persistencia: {
      criados:     0,
      atualizados: 0,
      ignorados:   0,
      erros:       0,
      detalhes:    [],
    },

    erros_gerais: [],
  }
}

// ─── Pipeline principal ───────────────────────────────────────────────────

/**
 * Executa o pipeline completo de importação do SolarMarket.
 *
 * @param {object} opcoes
 * @param {boolean} [opcoes.dryRun=true]           true = não escreve no banco
 * @param {number}  [opcoes.limitePropostas=0]     0 = sem limite
 * @param {boolean} [opcoes.incluirProdutos=true]  tenta /products endpoint
 * @param {number}  [opcoes.confiancaMinimaUpdate=0.70]
 * @param {boolean} [opcoes.verbose=false]
 * @returns {Promise<object>}  Relatório completo
 */
export async function executarImport(opcoes = {}) {
  const {
    dryRun             = true,
    limitePropostas    = 0,
    incluirProdutos    = true,
    confiancaMinimaUpdate = 0.70,
    verbose            = false,
  } = opcoes

  const rel = criarRelatorioVazio()
  rel.dry_run = dryRun

  const log = (msg) => {
    if (verbose) console.log(msg)
    else         process.stdout.write('.')
  }
  const logErr = (msg) => console.warn('[SM:importer]', msg)

  console.log(`\n[SM:importer] Pipeline iniciado — ${dryRun ? 'DRY-RUN' : 'APPLY'}`)
  console.log(`  Limite propostas: ${limitePropostas || 'sem limite'}`)
  console.log(`  Confiança mínima update: ${confiancaMinimaUpdate * 100}%\n`)

  // ── STEP 1: Extração ──────────────────────────────────────────────────────
  let lineItemsBrutos = []
  let produtosBrutos  = []

  try {
    const extracao = await extrairEquipamentos({ limitePropostas, incluirProdutos })

    lineItemsBrutos = extracao.lineItems
    produtosBrutos  = extracao.produtos

    rel.extracao.propostas_buscadas  = extracao.meta.propostas_buscadas
    rel.extracao.propostas_com_itens = extracao.meta.propostas_com_itens
    rel.extracao.line_items_brutos   = extracao.meta.line_items_brutos
    rel.extracao.produtos_diretos    = extracao.meta.produtos_buscados
    rel.extracao.erros_extracao      = extracao.meta.erros
  } catch (err) {
    rel.erros_gerais.push(`[STEP 1 - extração] ${err.message}`)
    logErr(`Extração falhou: ${err.message}`)
    rel.finalizado_em = new Date().toISOString()
    return rel
  }

  // Combina line items de propostas com produtos do endpoint /products
  const todosBrutos = [...lineItemsBrutos, ...produtosBrutos]
  log(`[step 1/7] ${todosBrutos.length} itens brutos extraídos`)

  // ── STEP 2: Filtragem pré-normalização ───────────────────────────────────
  const { aprovados, rejeitados } = filtrarLote(todosBrutos)

  rel.filtragem.aprovados  = aprovados.length
  rel.filtragem.rejeitados = rejeitados.length
  rel.filtragem.rejeitados_detalhe = rejeitados.map(r => ({
    nome:   r.item.nome || r.item.modelo || 'sem nome',
    motivo: r.motivo,
  }))

  log(`[step 2/7] ${aprovados.length} aprovados, ${rejeitados.length} rejeitados`)

  if (verbose && rejeitados.length > 0) {
    console.log('\n  Rejeitados na filtragem:')
    rejeitados.forEach(r => console.log(`    - "${r.item.nome || r.item.modelo}": ${r.motivo}`))
  }

  // ── STEP 3: Normalização ──────────────────────────────────────────────────
  const { normalizados, descartados, duplicatasPorHash } = normalizarLote(
    aprovados.map(a => a.item)
  )

  rel.normalizacao.normalizados        = normalizados.length
  rel.normalizacao.descartados         = descartados
  rel.normalizacao.duplicatas_por_hash = duplicatasPorHash

  log(`[step 3/7] ${normalizados.length} normalizados, ${descartados} descartados, ${duplicatasPorHash} dupl.`)

  // ── STEP 4: Validação pós-normalização ────────────────────────────────────
  const normalizadosValidos = []

  for (const norm of normalizados) {
    const valResult = validarNormalizado(norm)
    if (valResult.nivel === 'rejeitar') {
      rel.validacao_pos.rejeitados++
      log('r')
      continue
    }
    if (valResult.nivel === 'alertar') {
      rel.validacao_pos.alertas++
      // Adiciona avisos ao normalizado mas não rejeita
      norm.alertas = [...(norm.alertas || []), ...valResult.avisos]
    } else {
      rel.validacao_pos.validos++
    }
    normalizadosValidos.push(norm)
  }

  log(`[step 4/7] ${normalizadosValidos.length} passaram validação pós-norm`)

  // ── STEP 5: Matching ──────────────────────────────────────────────────────
  const matchResults = await encontrarMatchesEmLote(normalizadosValidos)

  for (const { match } of matchResults) {
    switch (match.estrategia) {
      case 'hash':        rel.matching.hash_exato++;  break
      case 'normalizado': rel.matching.normalizado++; break
      case 'fuzzy':       rel.matching.fuzzy++;       break
      default:            rel.matching.sem_match++;   break
    }
  }

  log(`[step 5/7] matches — hash:${rel.matching.hash_exato} norm:${rel.matching.normalizado} fuzzy:${rel.matching.fuzzy} novo:${rel.matching.sem_match}`)

  // ── STEP 6+7: Deduplicação + Persistência ────────────────────────────────
  for (const { normalizado, match } of matchResults) {
    try {
      const acao = decidirAcao(normalizado, match, { confiancaMinimaUpdate })
      const resultado = await executarAcao(acao, dryRun)

      switch (resultado.status) {
        case 'criado':     rel.persistencia.criados++;     break
        case 'atualizado': rel.persistencia.atualizados++; break
        case 'ignorado':   rel.persistencia.ignorados++;   break
        case 'erro':       rel.persistencia.erros++;       break
      }

      if (verbose || resultado.status === 'erro') {
        rel.persistencia.detalhes.push({
          status:           resultado.status,
          id:               resultado.id,
          fabricante:       normalizado.equipamento.fabricante,
          modelo:           normalizado.equipamento.modelo,
          tipo:             normalizado.equipamento.tipo,
          motivo:           resultado.motivo,
          campos_alterados: acao.campos_alterados,
          alertas:          normalizado.alertas || [],
        })
      }
    } catch (err) {
      rel.persistencia.erros++
      logErr(`Erro ao processar ${normalizado.equipamento?.modelo}: ${err.message}`)
      rel.erros_gerais.push(`[STEP 6/7] ${normalizado.equipamento?.modelo}: ${err.message}`)
    }
  }

  log(`[step 7/7] criados:${rel.persistencia.criados} atualizados:${rel.persistencia.atualizados} ignorados:${rel.persistencia.ignorados} erros:${rel.persistencia.erros}`)

  rel.finalizado_em = new Date().toISOString()
  return rel
}

// ─── Formatador de relatório para console ────────────────────────────────

/**
 * Imprime o relatório no console em formato legível.
 *
 * @param {object} relatorio  Resultado de executarImport()
 */
export function imprimirRelatorio(relatorio) {
  const sep = '─'.repeat(70)
  console.log(`\n${sep}`)
  console.log(`RELATÓRIO DE IMPORTAÇÃO SOLARMARKET — S2.9`)
  console.log(sep)
  console.log(`Modo       : ${relatorio.dry_run ? 'DRY-RUN (nenhuma escrita)' : 'APPLY (escrito no banco)'}`)
  console.log(`Início     : ${relatorio.iniciado_em}`)
  console.log(`Fim        : ${relatorio.finalizado_em}`)

  console.log(`\n📥 EXTRAÇÃO`)
  console.log(`  Propostas buscadas  : ${relatorio.extracao.propostas_buscadas}`)
  console.log(`  Propostas com itens : ${relatorio.extracao.propostas_com_itens}`)
  console.log(`  Line items brutos   : ${relatorio.extracao.line_items_brutos}`)
  console.log(`  Produtos diretos    : ${relatorio.extracao.produtos_diretos}`)

  console.log(`\n🔍 FILTRAGEM`)
  console.log(`  Aprovados           : ${relatorio.filtragem.aprovados}`)
  console.log(`  Rejeitados          : ${relatorio.filtragem.rejeitados}`)
  if (relatorio.filtragem.rejeitados_detalhe?.length > 0) {
    const amostra = relatorio.filtragem.rejeitados_detalhe.slice(0, 5)
    amostra.forEach(r => console.log(`    - "${r.nome}": ${r.motivo}`))
    if (relatorio.filtragem.rejeitados_detalhe.length > 5) {
      console.log(`    ... e mais ${relatorio.filtragem.rejeitados_detalhe.length - 5}`)
    }
  }

  console.log(`\n🔄 NORMALIZAÇÃO`)
  console.log(`  Normalizados        : ${relatorio.normalizacao.normalizados}`)
  console.log(`  Descartados         : ${relatorio.normalizacao.descartados}`)
  console.log(`  Dupl. por hash      : ${relatorio.normalizacao.duplicatas_por_hash}`)

  console.log(`\n✅ VALIDAÇÃO PÓS-NORM`)
  console.log(`  Válidos             : ${relatorio.validacao_pos.validos}`)
  console.log(`  Com alertas         : ${relatorio.validacao_pos.alertas}`)
  console.log(`  Rejeitados          : ${relatorio.validacao_pos.rejeitados}`)

  console.log(`\n🎯 MATCHING`)
  console.log(`  Hash exato          : ${relatorio.matching.hash_exato}`)
  console.log(`  Normalizado         : ${relatorio.matching.normalizado}`)
  console.log(`  Fuzzy               : ${relatorio.matching.fuzzy}`)
  console.log(`  Sem match (novo)    : ${relatorio.matching.sem_match}`)

  console.log(`\n💾 PERSISTÊNCIA`)
  console.log(`  Criados             : ${relatorio.persistencia.criados}`)
  console.log(`  Atualizados         : ${relatorio.persistencia.atualizados}`)
  console.log(`  Ignorados           : ${relatorio.persistencia.ignorados}`)
  console.log(`  Erros               : ${relatorio.persistencia.erros}`)

  if (relatorio.persistencia.erros > 0 || relatorio.erros_gerais.length > 0) {
    console.log(`\n⚠️  ERROS`)
    relatorio.erros_gerais.forEach(e => console.log(`  - ${e}`))
    relatorio.persistencia.detalhes
      .filter(d => d.status === 'erro')
      .forEach(d => console.log(`  - [${d.fabricante} ${d.modelo}]: ${d.motivo}`))
  }

  if (relatorio.dry_run) {
    console.log(`\n💡 Para aplicar: node scripts/importar-solarmarket.mjs --apply`)
  }

  console.log(`${sep}\n`)
}
