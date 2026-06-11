#!/usr/bin/env node
/**
 * auditoria-sm-integridade.mjs
 * P0-SOLARMARKET-MIGRATION-INTEGRITY-01
 *
 * Auditoria completa dos projetos importados do SolarMarket.
 * Usa driver RAW (mongodb) para enxergar TODOS os campos,
 * incluindo os não declarados no schema Mongoose (proposta_sm, origem, status_migracao).
 *
 * Uso:
 *   node scripts/auditoria-sm-integridade.mjs
 *   node scripts/auditoria-sm-integridade.mjs --paulo-carlos   # foco no caso real
 *   node scripts/auditoria-sm-integridade.mjs --dump-amostra   # dump de 5 docs completos
 */

import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import 'dotenv/config'
import { MongoClient } from 'mongodb'

const URI   = process.env.MONGODB_URI
const ARGS  = process.argv.slice(2)
const PAULO = ARGS.includes('--paulo-carlos')
const DUMP  = ARGS.includes('--dump-amostra')

if (!URI) { console.error('MONGODB_URI não configurada'); process.exit(1) }

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000, socketTimeoutMS: 30000 })

try {
  await client.connect()
  const db = client.db()

  const col = db.collection('projetofvs')

  // ── 1. Contagem total ────────────────────────────────────────────────────────
  const total = await col.countDocuments({})
  const totalSM = await col.countDocuments({ 'origem.tipo': 'import_solarmarket' })
  const totalOrigemAny = await col.countDocuments({ origem: { $exists: true } })
  const totalStatusMig = await col.countDocuments({ status_migracao: { $exists: true } })
  const totalPropSM    = await col.countDocuments({ proposta_sm: { $exists: true } })

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('AUDITORIA DE INTEGRIDADE — IMPORTAÇÃO SOLARMARKET')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`\n📊 CONTAGENS GERAIS`)
  console.log(`  Total de projetos FV no banco        : ${total}`)
  console.log(`  Com origem.tipo='import_solarmarket' : ${totalSM}`)
  console.log(`  Com campo 'origem' (qualquer)        : ${totalOrigemAny}`)
  console.log(`  Com campo 'status_migracao'          : ${totalStatusMig}`)
  console.log(`  Com campo 'proposta_sm'              : ${totalPropSM}`)

  // ── 2. Breakdown por status_migracao ────────────────────────────────────────
  const byStatusMig = await col.aggregate([
    { $group: { _id: '$status_migracao', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray()

  console.log(`\n📊 BREAKDOWN POR status_migracao`)
  for (const b of byStatusMig) {
    console.log(`  ${String(b._id).padEnd(30)} : ${b.count}`)
  }

  // ── 3. Qualidade dos projetos SM importados ──────────────────────────────────
  if (totalSM > 0) {
    const smProjetos = await col.find({ 'origem.tipo': 'import_solarmarket' }).toArray()

    let comNome = 0, comCliente = 0, comEndereco = 0
    let comDimensionamento = 0, comNumPaineis = 0, comEquipamentos = 0
    let comPaineis = 0, comInversor = 0
    let comConsumo = 0, comFinanceiro = 0, comPropostaSM = 0
    let comDistrib = 0, comValorKwh = 0
    let semNenhum = 0

    const numPaineisDistrib = {}

    for (const p of smProjetos) {
      if (p.nome) comNome++
      if (p.clienteId) comCliente++
      if (p.endereco_completo) comEndereco++
      if (p.dimensionamento) comDimensionamento++
      if (p.dimensionamento?.num_paineis != null) {
        comNumPaineis++
        const n = String(p.dimensionamento.num_paineis)
        numPaineisDistrib[n] = (numPaineisDistrib[n] || 0) + 1
      }
      if (p.equipamentos?.paineis?.length > 0) comPaineis++
      if (p.equipamentos?.inversor?.marca || p.equipamentos?.inversor?.modelo) comInversor++
      if (p.equipamentos && (p.equipamentos.paineis?.length > 0 || p.equipamentos.inversor?.marca)) comEquipamentos++
      if (p.consumo_anual_kwh > 0 || p.consumo_kwh_mes > 0) comConsumo++
      if (p.financeiro?.custo_total_r > 0) comFinanceiro++
      if (p.proposta_sm) comPropostaSM++
      if (p.distribuidora || p.proposta_sm?.distribuidora) comDistrib++
      if (p.valor_kwh || p.proposta_sm?.tarifa_kwh_r) comValorKwh++

      const temAlgo = p.dimensionamento?.num_paineis || p.equipamentos?.paineis?.length || p.consumo_anual_kwh
      if (!temAlgo) semNenhum++
    }

    console.log(`\n📊 QUALIDADE DOS ${totalSM} PROJETOS IMPORTADOS (import_solarmarket)`)
    console.log(`  com nome                  : ${comNome} / ${totalSM}`)
    console.log(`  com clienteId             : ${comCliente} / ${totalSM}`)
    console.log(`  com endereco_completo      : ${comEndereco} / ${totalSM}`)
    console.log(`  com dimensionamento (v3)  : ${comDimensionamento} / ${totalSM}`)
    console.log(`  com dimensionamento.num_paineis : ${comNumPaineis} / ${totalSM}`)
    console.log(`  com equipamentos.paineis[]     : ${comPaineis} / ${totalSM}`)
    console.log(`  com equipamentos.inversor      : ${comInversor} / ${totalSM}`)
    console.log(`  com consumo_anual_kwh / kwh_mes: ${comConsumo} / ${totalSM}`)
    console.log(`  com financeiro.custo_total_r   : ${comFinanceiro} / ${totalSM}`)
    console.log(`  com proposta_sm (raw/extra)    : ${comPropostaSM} / ${totalSM}`)
    console.log(`  com distribuidora              : ${comDistrib} / ${totalSM}`)
    console.log(`  com tarifa_kwh / valor_kwh     : ${comValorKwh} / ${totalSM}`)
    console.log(`  SEM NENHUM DADO técnico        : ${semNenhum} / ${totalSM}  ← shells puros`)

    // Distribuição de num_paineis
    const topPaineis = Object.entries(numPaineisDistrib)
      .sort((a,b) => Number(a[0]) - Number(b[0]))
      .slice(0, 20)
    if (topPaineis.length > 0) {
      console.log(`\n  Distribuição num_paineis (top 20 valores):`)
      for (const [n, c] of topPaineis) {
        console.log(`    ${String(n).padStart(4)} módulos : ${c} projetos`)
      }
    }
  }

  // ── 4. Provar que proposta_sm NÃO está no schema Mongoose ───────────────────
  console.log(`\n📊 CAMPOS EXTRA-SCHEMA (fora do ProjetoFV.js) detectados via raw driver`)
  const camposExtra = ['proposta_sm', 'origem', 'status_migracao', 'consumo_kwh_mes',
    'distribuidora', 'valor_kwh', 'potencia_kwp_sm', 'geracao_mensal_sm']

  for (const campo of camposExtra) {
    const count = await col.countDocuments({ [campo]: { $exists: true } })
    const flag = count > 0 ? '✅ EXISTE no banco' : '❌ NÃO existe no banco'
    console.log(`  ${campo.padEnd(30)} : ${count} docs — ${flag}`)
  }

  // ── 5. Amostra de projeto enriquecido (com proposta) ────────────────────────
  const amostraProposta = await col.findOne({
    'origem.tipo': 'import_solarmarket',
    'status_migracao': 'proposta_importada'
  })
  if (amostraProposta) {
    console.log(`\n📄 AMOSTRA: 1 projeto com status_migracao='proposta_importada'`)
    console.log(`  _id              : ${amostraProposta._id}`)
    console.log(`  nome             : ${amostraProposta.nome}`)
    console.log(`  status           : ${amostraProposta.status}`)
    console.log(`  status_migracao  : ${amostraProposta.status_migracao}`)
    console.log(`  origem.id_externo: ${amostraProposta.origem?.id_externo}`)
    console.log(`  dim.num_paineis  : ${amostraProposta.dimensionamento?.num_paineis}`)
    console.log(`  dim.potencia_kwp : ${amostraProposta.dimensionamento?.potencia_kwp}`)
    console.log(`  equipamentos.paineis.length: ${amostraProposta.equipamentos?.paineis?.length}`)
    if (amostraProposta.equipamentos?.paineis?.length > 0) {
      const p0 = amostraProposta.equipamentos.paineis[0]
      console.log(`    painel[0]: ${p0.marca} ${p0.modelo} ${p0.potencia_w}W x${p0.quantidade}`)
    }
    console.log(`  proposta_sm (chaves): ${Object.keys(amostraProposta.proposta_sm || {}).join(', ') || 'NENHUMA'}`)
    if (amostraProposta.proposta_sm?.equipamentos?.length > 0) {
      console.log(`  proposta_sm.equipamentos[0]: ${JSON.stringify(amostraProposta.proposta_sm.equipamentos[0]).slice(0, 150)}`)
    }
  } else {
    console.log(`\n  ⚠ Nenhum projeto com status_migracao='proposta_importada' encontrado`)
  }

  // ── 6. Caso Paulo Carlos ─────────────────────────────────────────────────────
  console.log(`\n📄 BUSCA: Paulo Carlos`)
  const paulo = await col.find({
    nome: { $regex: /paulo.?carlos/i }
  }).toArray()

  // Busca também no cliente populado — via lookup
  const pauloViaCliente = await db.collection('clientes').find({
    nome: { $regex: /paulo.?carlos/i }
  }).toArray()

  if (paulo.length > 0) {
    console.log(`  ${paulo.length} projeto(s) com nome contendo "Paulo Carlos":`)
    for (const p of paulo) {
      console.log(`    _id: ${p._id} | nome: ${p.nome} | status_mig: ${p.status_migracao}`)
      console.log(`    dim.num_paineis: ${p.dimensionamento?.num_paineis}`)
      console.log(`    equipamentos.paineis: ${p.equipamentos?.paineis?.length || 0} itens`)
      if (p.equipamentos?.paineis?.length > 0) {
        p.equipamentos.paineis.forEach((pp, i) => {
          console.log(`      [${i}] ${pp.marca} ${pp.modelo} ${pp.potencia_w}W x${pp.quantidade}`)
        })
      }
    }
  } else {
    console.log(`  Nenhum projeto com nome contendo "Paulo Carlos"`)
  }

  if (pauloViaCliente.length > 0) {
    console.log(`  ${pauloViaCliente.length} cliente(s) com nome "Paulo Carlos":`)
    for (const c of pauloViaCliente) {
      const projs = await col.find({ clienteId: c._id }).toArray()
      console.log(`    clienteId: ${c._id} | nome: ${c.nome}`)
      console.log(`    Projetos FV: ${projs.length}`)
      for (const p of projs) {
        console.log(`      projeto: ${p.nome} | status_mig: ${p.status_migracao}`)
        console.log(`        dim.num_paineis: ${p.dimensionamento?.num_paineis}`)
        console.log(`        equipamentos.paineis: ${p.equipamentos?.paineis?.length || 0} itens`)
        if (p.equipamentos?.paineis?.length > 0) {
          p.equipamentos.paineis.forEach((pp, i) => {
            console.log(`          [${i}] ${pp.marca} ${pp.modelo} ${pp.potencia_w}W x${pp.quantidade}`)
          })
        }
        console.log(`        proposta_sm.equipamentos: ${p.proposta_sm?.equipamentos?.length || 0} itens`)
        if (p.proposta_sm?.equipamentos?.length > 0) {
          p.proposta_sm.equipamentos.forEach((eq, i) => {
            console.log(`          [${i}] cat=${eq.category} item=${eq.item} qnt=${eq.qnt}`)
          })
        }
      }
    }
  } else {
    console.log(`  Nenhum cliente com nome "Paulo Carlos"`)
  }

  if (DUMP) {
    const amostra5 = await col.find({ 'origem.tipo': 'import_solarmarket' }).limit(5).toArray()
    console.log(`\n📄 DUMP AMOSTRA (5 projetos SM, truncado):`)
    for (const p of amostra5) {
      console.log(JSON.stringify({
        _id: p._id,
        nome: p.nome,
        status_migracao: p.status_migracao,
        origem: p.origem,
        dimensionamento: p.dimensionamento ? {
          num_paineis: p.dimensionamento.num_paineis,
          potencia_kwp: p.dimensionamento.potencia_kwp,
          geracao_mensal_kwh: p.dimensionamento.geracao_mensal_kwh,
        } : null,
        equipamentos_paineis_count: p.equipamentos?.paineis?.length,
        equipamentos_painel_0: p.equipamentos?.paineis?.[0] || null,
        proposta_sm_keys: Object.keys(p.proposta_sm || {}),
      }, null, 2))
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('FIM DA AUDITORIA')
  console.log('═══════════════════════════════════════════════════════════\n')

} catch (err) {
  console.error('❌ Erro na auditoria:', err.message)
  if (err.stack) console.error(err.stack)
  process.exitCode = 1
} finally {
  await client.close()
}
