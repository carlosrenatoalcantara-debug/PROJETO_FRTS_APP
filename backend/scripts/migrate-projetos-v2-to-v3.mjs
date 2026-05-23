#!/usr/bin/env node
/**
 * Migration S2.7 — ProjetoFV v2 → v3
 *
 * O que faz:
 *   - Lê todos os ProjetoFV sem schema_version: 3
 *   - Mapeia campos flat de v2 para subdocs estruturados de v3
 *   - Em dry-run (padrão): exibe relatório sem alterar nada
 *   - Com --apply: executa updateOne por documento (nunca deleta campos)
 *
 * Uso:
 *   node scripts/migrate-projetos-v2-to-v3.mjs              # dry-run (padrão)
 *   node scripts/migrate-projetos-v2-to-v3.mjs --apply      # aplica migração
 *   node scripts/migrate-projetos-v2-to-v3.mjs --limit=10   # processa primeiros 10
 *   node scripts/migrate-projetos-v2-to-v3.mjs --id=<id>    # migra somente 1 doc
 *
 * IMPORTANTE:
 *   - NUNCA remove campos v2 (additive only)
 *   - Idempotente: rodar 2x no mesmo doc produz resultado idêntico
 *   - Documentos já com schema_version: 3 são ignorados automaticamente
 */

import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])  // garante resolução SRV do Atlas em rede local

import 'dotenv/config'
import mongoose from 'mongoose'

// ─── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = !args.includes('--apply')
const LIMIT   = args.find(a => a.startsWith('--limit='))?.split('=')[1]
  ? Number(args.find(a => a.startsWith('--limit=')).split('=')[1])
  : null
const ONLY_ID = args.find(a => a.startsWith('--id='))?.split('=').slice(1).join('=') || null

if (DRY_RUN) {
  console.log('🔍 MODO DRY-RUN — nenhuma alteração será feita no banco.')
  console.log('   Para aplicar, use: node scripts/migrate-projetos-v2-to-v3.mjs --apply\n')
} else {
  console.log('⚡ MODO APPLY — as migrações SERÃO gravadas no banco!\n')
}

// ─── Conexão ──────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forte_solar'

async function conectar() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
    })
    console.log('✅ MongoDB conectado\n')
  } catch (err) {
    console.error('❌ Falha na conexão MongoDB:', err.message)
    process.exit(1)
  }
}

// ─── Schema mínimo (leitura) ──────────────────────────────────────────────────
// Usamos Mixed para leitura livre dos campos legados, sem recriar o schema completo.
const ProjetoFV = mongoose.model('ProjetoFV', new mongoose.Schema({
  schema_version:      { type: Number, default: null },
  nome:                String,
  clienteId:           mongoose.Schema.Types.ObjectId,
  status:              String,
  // v2 flat
  latitude:            Number,
  longitude:           Number,
  endereco_completo:   String,
  geocoding_origem:    String,
  geocoding_confianca: Number,
  geocodificado_em:    Date,
  irradiancia_local:   Number,
  potencia_kwp:        Number,
  geracao_mensal_kwh:  Number,
  consumo_anual_kwh:   Number,
  telhado:             mongoose.Schema.Types.Mixed,
  financeiro:          mongoose.Schema.Types.Mixed,
  equipamentos:        mongoose.Schema.Types.Mixed,
  fatura_extracao:     mongoose.Schema.Types.Mixed,
  // v3 subdocs (podem já existir se rerun)
  localizacao:         mongoose.Schema.Types.Mixed,
  dimensionamento:     mongoose.Schema.Types.Mixed,
  layout_solar:        mongoose.Schema.Types.Mixed,
  orcamento:           mongoose.Schema.Types.Mixed,
  workflow:            mongoose.Schema.Types.Mixed,
  createdAt:           Date,
  updatedAt:           Date,
}, {
  strict: false,
  timestamps: true,
  collection: 'projetofvs',
}))

// ─── Mapeamento v2 → v3 ───────────────────────────────────────────────────────

/**
 * Gera o $set para migrar um documento v2 para v3.
 * Retorna null se o documento já está em v3 ou não tem dados para migrar.
 */
function mapearV2ParaV3(doc) {
  const $set = {}
  const alertas = []

  // ── localizacao ──────────────────────────────────────────────────────────────
  const temLocFlat = doc.latitude || doc.longitude || doc.endereco_completo
  if (temLocFlat && !doc.localizacao?.latitude) {
    $set.localizacao = {
      endereco_completo:    doc.endereco_completo    || null,
      latitude:             doc.latitude             ?? null,
      longitude:            doc.longitude            ?? null,
      cep:                  doc.fatura_extracao?.cep || null,
      cidade:               doc.fatura_extracao?.cidade || null,
      estado:               doc.fatura_extracao?.estado || null,
      geocoding_origem:     doc.geocoding_origem     || null,
      geocoding_confianca:  doc.geocoding_confianca  ?? null,
      geocodificado_em:     doc.geocodificado_em     || null,
      irradiancia_kwh_kwp_dia: doc.irradiancia_local ?? null,
      fonte_irradiancia:    doc.irradiancia_local ? 'padrao_regional' : null,
      // S2.10-prep: fundação climática (todos null/default na migração)
      temperatura_min_historica_c: null,
      temperatura_max_historica_c: null,
      temperatura_media_c:         null,
      temperatura_referencia_c:    25,
      fonte_climatica:             'manual',
      fonte_climatica_confianca:   null,
      atualizado_clima_em:         null,
    }
  }

  // S2.10-prep: patch additive em docs que já têm localizacao (inclusive v3)
  // mas foram criados antes da fundação climática existir.
  // Usa dot-notation para não sobrescrever os campos já populados.
  if (doc.localizacao && doc.localizacao.temperatura_referencia_c === undefined) {
    $set['localizacao.temperatura_min_historica_c'] = doc.localizacao.temperatura_min_historica_c ?? null
    $set['localizacao.temperatura_max_historica_c'] = doc.localizacao.temperatura_max_historica_c ?? null
    $set['localizacao.temperatura_media_c']         = doc.localizacao.temperatura_media_c         ?? null
    $set['localizacao.temperatura_referencia_c']    = 25
    $set['localizacao.fonte_climatica']             = 'manual'
    $set['localizacao.fonte_climatica_confianca']   = null
    $set['localizacao.atualizado_clima_em']         = null
    alertas.push('S2.10-prep: campos climáticos adicionados à localizacao existente')
  }

  // ── dimensionamento ──────────────────────────────────────────────────────────
  const temDimFlat = doc.potencia_kwp || doc.geracao_mensal_kwh
  if (temDimFlat && !doc.dimensionamento?.potencia_kwp) {
    $set.dimensionamento = {
      potencia_kwp:       doc.potencia_kwp       ?? null,
      geracao_mensal_kwh: doc.geracao_mensal_kwh ?? null,
      geracao_anual_kwh:  doc.geracao_mensal_kwh ? doc.geracao_mensal_kwh * 12 : null,
      num_paineis:        null,
      num_strings:        null,
      num_inversores:     null,
      performance_ratio:  null,
      fator_capacidade:   null,
      area_total_m2:      null,
      metodo:             'manual',  // dados originados de entrada manual
      calculado_em:       doc.updatedAt || null,
    }
    if (!doc.potencia_kwp) {
      alertas.push('potencia_kwp ausente — dimensionamento incompleto')
    }
  }

  // ── layout_solar ─────────────────────────────────────────────────────────────
  // Só migra se telhado tiver dados reais (evita criar subdoc vazio de {pontos:[]})
  const temTelhadoReal = doc.telhado &&
    (doc.telhado.area_m2 > 0 || (Array.isArray(doc.telhado.pontos) && doc.telhado.pontos.length > 0))
  if (temTelhadoReal && !doc.layout_solar?.area_util_m2) {
    const t = doc.telhado
    $set.layout_solar = {
      pontos:          t.pontos      || [],
      area_util_m2:    t.area_m2     ?? null,
      orientacao:      t.orientacao  || null,
      inclinacao_graus: t.inclinacao ?? null,
      tipo_telhado:    null,
      sombreamento_pct: null,
      imagem_satelite_url: null,
    }
  }

  // ── orcamento ─────────────────────────────────────────────────────────────────
  const fin = doc.financeiro
  if (fin && (fin.custo_total_r || fin.payback_anos) && !doc.orcamento?.custo_total_r) {
    $set.orcamento = {
      custo_total_r:        fin.custo_total_r    ?? null,
      custo_equipamentos_r: fin.custo_painel_r   ?? null,  // aproximação v2
      custo_mao_obra_r:     fin.custo_mao_obra_r ?? null,
      custo_outros_r:       fin.custo_bess_r     ?? null,
      margem_pct:           null,
      preco_venda_r:        null,
      irr_pct:              fin.irr_pct          ?? null,
      npv_r:                fin.npv_r            ?? null,
      payback_anos:         fin.payback_anos     ?? null,
      payback_meses:        fin.payback_anos ? Math.round(fin.payback_anos * 12) : null,
      economia_mensal_r:    null,
      economia_anual_r:     null,
      economia_25anos_r:    fin.economia_25anos_r ?? null,
      co2_evitado_t:        null,
      tarifa_kwh:           null,
      reajuste_anual_pct:   null,
      calculado_em:         doc.updatedAt || null,
    }
  }

  // ── workflow ──────────────────────────────────────────────────────────────────
  if (!doc.workflow) {
    $set.workflow = {
      etapa_atual:          1,
      etapas_completas:     [],
      iniciado_em:          doc.createdAt || null,
      ultima_atividade:     doc.updatedAt || null,
      fluxo_origem:         'manual',   // doc legado = entrada manual
      usuario_responsavel:  null,
    }
  }

  if (Object.keys($set).length === 0) {
    return null  // nada a migrar
  }

  $set.schema_version = 3

  return { $set, alertas }
}

// ─── Relatório ────────────────────────────────────────────────────────────────

function formatarRelatorio(doc, resultado) {
  const linha = `  [${doc._id}] "${doc.nome || 'sem nome'}"`
  if (!resultado) {
    return `${linha} → ⏭  já v3 ou sem dados para migrar`
  }
  const { $set, alertas } = resultado
  const campos = Object.keys($set).filter(k => k !== 'schema_version')
  let out = `${linha}\n`
  out += `    → ✅ campos a preencher: ${campos.join(', ')}\n`
  if (alertas.length > 0) {
    out += `    → ⚠️  alertas:\n`
    alertas.forEach(a => { out += `       • ${a}\n` })
  }
  return out
}

// ─── Main ─────────────────────────────────────────────────────────────────────

await conectar()

try {
  // Filtro: docs que NÃO são v3 ainda OU docs v3 sem campos climáticos (S2.10-prep)
  const filtro = ONLY_ID
    ? { _id: new mongoose.Types.ObjectId(ONLY_ID) }
    : {
        $or: [
          { schema_version: { $exists: false } },
          { schema_version: { $ne: 3 } },
          // S2.10-prep: docs v3 que ainda não têm a fundação climática
          { schema_version: 3, 'localizacao.temperatura_referencia_c': { $exists: false } },
        ],
      }

  let query = ProjetoFV.find(filtro).lean()
  if (LIMIT) query = query.limit(LIMIT)

  const docs = await query.exec()

  console.log(`📦 Documentos encontrados: ${docs.length}`)
  if (LIMIT) console.log(`   (limitado a ${LIMIT} por --limit)`)
  console.log('')

  // ── Contadores ───────────────────────────────────────────────────────────────
  let migrados    = 0
  let ignorados   = 0
  let erros       = 0
  const relatorio = []

  for (const doc of docs) {
    try {
      const resultado = mapearV2ParaV3(doc)
      relatorio.push(formatarRelatorio(doc, resultado))

      if (!resultado) {
        ignorados++
        continue
      }

      if (!DRY_RUN) {
        await ProjetoFV.updateOne({ _id: doc._id }, { $set: resultado.$set })
      }
      migrados++
    } catch (err) {
      erros++
      relatorio.push(`  [${doc._id}] "${doc.nome}" → ❌ ERRO: ${err.message}`)
    }
  }

  // ── Relatório final ───────────────────────────────────────────────────────────
  console.log('─'.repeat(70))
  console.log('RELATÓRIO DE MIGRAÇÃO\n')
  relatorio.forEach(l => console.log(l))

  console.log('─'.repeat(70))
  console.log(`\nRESUMO:`)
  console.log(`  Total processados : ${docs.length}`)
  console.log(`  Para migrar       : ${migrados}   ${DRY_RUN ? '(não aplicado — dry-run)' : '(APLICADO)'}`)
  console.log(`  Ignorados         : ${ignorados}  (já v3 ou sem dados)`)
  console.log(`  Erros             : ${erros}`)

  if (DRY_RUN && migrados > 0) {
    console.log(`\n💡 Para aplicar: node scripts/migrate-projetos-v2-to-v3.mjs --apply`)
  }
  if (!DRY_RUN && migrados > 0) {
    console.log(`\n✅ Migração concluída. ${migrados} documentos atualizados para schema_version: 3`)
  }

} finally {
  await mongoose.disconnect()
  console.log('\n🔌 Desconectado do MongoDB.')
}
