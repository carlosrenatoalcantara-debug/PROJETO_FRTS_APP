#!/usr/bin/env node
/**
 * bind-sm-equipamentos.mjs
 * P1-SOLARMARKET-PROPOSAL-EQUIPMENT-BIND-01
 *
 * Vincula equipamentos textuais dos projetos SM ao catálogo Atlas.
 * Usa o pipeline oficial: normalizer → hash_unico → matcher.
 *
 * Política:
 *   - Apenas MATCH EXATO (confiança 1.0 via hash) e NORMALIZADO (0.95) são gravados
 *   - Fuzzy (0.70–0.89) → classificados como "provável" — NÃO gravados
 *   - Não sobrescreve equipamento_id já preenchido
 *   - Idempotente: re-execução → 0 novos binds
 *
 * Uso:
 *   node scripts/bind-sm-equipamentos.mjs           # dry-run (padrão)
 *   node scripts/bind-sm-equipamentos.mjs --apply   # grava no banco
 *   node scripts/bind-sm-equipamentos.mjs --verbose
 *   node scripts/bind-sm-equipamentos.mjs --dump-sem-match  # lista não encontrados
 */

import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import 'dotenv/config'
import mongoose from 'mongoose'

const ARGS         = process.argv.slice(2)
const DRY_RUN      = !ARGS.includes('--apply')
const VERBOSE      = ARGS.includes('--verbose') || ARGS.includes('-v')
const DUMP_SEM     = ARGS.includes('--dump-sem-match')

if (DRY_RUN) {
  console.log('🔍 DRY-RUN — nenhuma escrita. Use --apply para gravar.')
} else {
  console.log('⚡ APPLY — os binds SERÃO gravados no banco.')
}

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI não configurada'); process.exit(1) }

// ─── Conexão ────────────────────────────────────────────────────────────────
await mongoose.connect(URI, { serverSelectionTimeoutMS: 15000, socketTimeoutMS: 30000 })
console.log('✅ MongoDB conectado')

// ─── Imports dinâmicos (após mongoose conectar) ───────────────────────────
const { normalizar, normalizarTexto, gerarHash } = await import('../src/integracoes/solarmarket/normalizer.js')
const { encontrarMatch }                         = await import('../src/integracoes/solarmarket/matcher.js')
const { ProjetoFV }                              = await import('../src/models/ProjetoFV.js')

// ─── Construir item bruto compatível com normalizer ───────────────────────
function criarItemBruto(marca, modelo, categoria) {
  return {
    nome:      `${marca} ${modelo}`.trim(),
    marca:     marca,
    modelo:    modelo,
    categoria: categoria,   // 'Módulo' | 'Inversor'
    qnt:       1,
    valor:     0,
  }
}

// ─── Cache de matches (normalizado → resultado) para evitar repetições ────
const cacheMatch = new Map()

async function matchEquipamento(marca, modelo, categoria) {
  const key = `${marca}|||${modelo}|||${categoria}`
  if (cacheMatch.has(key)) return cacheMatch.get(key)

  const itemBruto = criarItemBruto(marca, modelo, categoria)
  const norm = normalizar(itemBruto)
  if (!norm) {
    const res = { estrategia: 'nenhuma', confianca: 0, equipamento: null }
    cacheMatch.set(key, res)
    return res
  }

  const match = await encontrarMatch(norm)
  const res   = { estrategia: match.estrategia, confianca: match.confianca, equipamento: match.equipamento, norm }
  cacheMatch.set(key, res)
  return res
}

// ─── Relatório ─────────────────────────────────────────────────────────────
const rel = {
  projetos_processados: 0,
  paineis: { exato: 0, normalizado: 0, fuzzy: 0, sem_match: 0, ja_vinculado: 0, erros: 0 },
  inversores: { exato: 0, normalizado: 0, fuzzy: 0, sem_match: 0, ja_vinculado: 0, erros: 0 },
  binds_gravados: 0,
  projetos_totalmente_vinculados: 0,
  sem_match_detail: [],  // { marca, modelo, tipo, projetos }
}

const semMatchAgg = {}  // para consolidar sem-match

// ─── Main loop ─────────────────────────────────────────────────────────────
const projetos = await ProjetoFV.find({
  'origem.tipo': 'import_solarmarket',
  'equipamentos.paineis.0': { $exists: true },
}).lean()

console.log(`\n📊 Projetos a processar: ${projetos.length}`)

for (const p of projetos) {
  rel.projetos_processados++
  let projetoTotalVinculado = true
  const $set = {}

  // ── Painéis ───────────────────────────────────────────────────────────────
  const paineis = p.equipamentos?.paineis || []
  const paineisBind = []

  for (let i = 0; i < paineis.length; i++) {
    const painel = paineis[i]

    // Idempotência: skip apenas se equipamento_id E origem_bind já estão definidos
    if (painel.equipamento_id && painel.origem_bind === 'atlas') {
      rel.paineis.ja_vinculado++
      paineisBind.push(painel)
      continue
    }

    if (!painel.marca || !painel.modelo) {
      rel.paineis.erros++
      projetoTotalVinculado = false
      paineisBind.push(painel)
      continue
    }

    try {
      const m = await matchEquipamento(painel.marca, painel.modelo, 'Módulo')

      // Re-processa se equipamento_id já existe mas origem_bind ainda não (corrige campos ausentes)
      const jaVinculadoSemBind = painel.equipamento_id && !painel.origem_bind

      if (m.confianca >= 0.95 || jaVinculadoSemBind) {
        // Exato ou normalizado — grava; ou corrige campos ausentes em bind anterior
        const tipo = m.confianca === 1.0 ? 'exato' : (m.confianca >= 0.95 ? 'normalizado' : 'remap')
        if (tipo === 'exato') rel.paineis.exato++
        else if (tipo === 'normalizado') rel.paineis.normalizado++

        const bindedPainel = {
          ...painel,
          equipamento_id: m.equipamento?._id || painel.equipamento_id,
          tipo:           m.equipamento?.tipo  || painel.tipo,
          fabricante:     m.equipamento?.fabricante || painel.fabricante,
          modelo:         m.equipamento?.modelo || painel.modelo,
          potencia_w:     m.equipamento?.especificacoes?.potencia_w || painel.potencia_w,
          origem_bind:    'atlas',
        }
        paineisBind.push(bindedPainel)

        if (VERBOSE) {
          console.log(`  [painel-${tipo}] ${p.nome} → ${m.equipamento.fabricante} ${m.equipamento.modelo}`)
        }
      } else if (m.confianca > 0) {
        rel.paineis.fuzzy++
        projetoTotalVinculado = false
        paineisBind.push(painel)  // mantém sem bind

        const smKey = `${painel.marca}|||${painel.modelo}|||modulo`
        if (!semMatchAgg[smKey]) semMatchAgg[smKey] = { marca: painel.marca, modelo: painel.modelo, tipo: 'modulo', projetos: 0, classe: 'fuzzy', confianca: m.confianca }
        semMatchAgg[smKey].projetos++
      } else {
        rel.paineis.sem_match++
        projetoTotalVinculado = false
        paineisBind.push(painel)

        const smKey = `${painel.marca}|||${painel.modelo}|||modulo`
        if (!semMatchAgg[smKey]) semMatchAgg[smKey] = { marca: painel.marca, modelo: painel.modelo, tipo: 'modulo', projetos: 0, classe: 'sem_match', confianca: 0 }
        semMatchAgg[smKey].projetos++
      }
    } catch (err) {
      rel.paineis.erros++
      projetoTotalVinculado = false
      paineisBind.push(painel)
      console.warn(`  ⚠ Erro painel ${painel.marca} ${painel.modelo}: ${err.message}`)
    }
  }

  // Atualiza paineis se houve algum bind novo OU se faltava origem_bind (remap)
  const novoBind = paineisBind.some(pb => {
    if (!pb.equipamento_id) return false
    const orig = paineis.find(o => o.modelo === pb.modelo)
    if (!orig) return true  // novo
    const idMudou = orig.equipamento_id?.toString() !== pb.equipamento_id?.toString()
    const origBind = orig.origem_bind !== 'atlas'
    return idMudou || origBind
  })
  if (novoBind) {
    $set['equipamentos.paineis'] = paineisBind
  }

  // ── Inversor ──────────────────────────────────────────────────────────────
  const inv = p.equipamentos?.inversor

  if (inv && (inv.marca || inv.modelo)) {
    // Idempotência: skip apenas se equipamento_id E origem_bind já estão definidos
    if (inv.equipamento_id && inv.origem_bind === 'atlas') {
      rel.inversores.ja_vinculado++
    } else {
      const catInv = /micro|micro.inv|NEP BDM|TSUN TSOL-M|TSUN TSOL-MP|APsystems|HOYMILES HMS/i.test(`${inv.marca} ${inv.modelo}`)
        ? 'Inversor' : 'Inversor'

      try {
        const m = await matchEquipamento(inv.marca, inv.modelo, 'Inversor')

        if (m.confianca >= 0.95) {
          const tipo = m.confianca === 1.0 ? 'exato' : 'normalizado'
          if (tipo === 'exato') rel.inversores.exato++
          else rel.inversores.normalizado++

          $set['equipamentos.inversor'] = {
            ...inv,
            equipamento_id: m.equipamento._id,
            tipo:           m.equipamento.tipo,
            fabricante:     m.equipamento.fabricante,
            modelo:         m.equipamento.modelo,
            potencia_kw:    m.equipamento.especificacoes?.potencia_kw || inv.potencia_kw,
            origem_bind:    'atlas',
          }

          if (VERBOSE) {
            console.log(`  [inversor-${tipo}] ${p.nome} → ${m.equipamento.fabricante} ${m.equipamento.modelo}`)
          }
        } else if (m.confianca > 0) {
          rel.inversores.fuzzy++
          projetoTotalVinculado = false

          const smKey = `${inv.marca}|||${inv.modelo}|||inversor`
          if (!semMatchAgg[smKey]) semMatchAgg[smKey] = { marca: inv.marca, modelo: inv.modelo, tipo: 'inversor', projetos: 0, classe: 'fuzzy', confianca: m.confianca }
          semMatchAgg[smKey].projetos++
        } else {
          rel.inversores.sem_match++
          projetoTotalVinculado = false

          const smKey = `${inv.marca}|||${inv.modelo}|||inversor`
          if (!semMatchAgg[smKey]) semMatchAgg[smKey] = { marca: inv.marca, modelo: inv.modelo, tipo: 'inversor', projetos: 0, classe: 'sem_match', confianca: 0 }
          semMatchAgg[smKey].projetos++
        }
      } catch (err) {
        rel.inversores.erros++
        projetoTotalVinculado = false
        console.warn(`  ⚠ Erro inversor ${inv.marca} ${inv.modelo}: ${err.message}`)
      }
    }
  }

  if (projetoTotalVinculado) rel.projetos_totalmente_vinculados++

  // ── Persiste se --apply ───────────────────────────────────────────────────
  if (!DRY_RUN && Object.keys($set).length > 0) {
    try {
      await ProjetoFV.updateOne({ _id: p._id }, { $set })
      rel.binds_gravados++
    } catch (err) {
      console.warn(`  ⚠ Erro ao gravar ${p.nome}: ${err.message}`)
    }
  } else if (DRY_RUN && Object.keys($set).length > 0) {
    rel.binds_gravados++  // conta como "gravaria"
  }
}

// ─── Relatório ──────────────────────────────────────────────────────────────
const sep = '─'.repeat(65)
console.log(`\n${sep}`)
console.log(`RELATÓRIO DE BINDING${DRY_RUN ? ' (DRY-RUN)' : ''} — P1-SM-PROPOSAL-EQUIPMENT-BIND`)
console.log(sep)
console.log(`  Projetos processados        : ${rel.projetos_processados}`)
console.log(`  Projetos totalmente vinculados: ${rel.projetos_totalmente_vinculados}`)
console.log(`  Projetos ${DRY_RUN ? 'que teriam' : 'com'} bind gravado : ${rel.binds_gravados}`)

console.log(`\n  MÓDULOS`)
console.log(`    Exato (hash, conf=1.0)  : ${rel.paineis.exato}`)
console.log(`    Normalizado (conf=0.95) : ${rel.paineis.normalizado}`)
console.log(`    Fuzzy (conf<0.95) NÃO gravado: ${rel.paineis.fuzzy}`)
console.log(`    Sem match               : ${rel.paineis.sem_match}`)
console.log(`    Já vinculado (skip)     : ${rel.paineis.ja_vinculado}`)

console.log(`\n  INVERSORES`)
console.log(`    Exato (hash, conf=1.0)  : ${rel.inversores.exato}`)
console.log(`    Normalizado (conf=0.95) : ${rel.inversores.normalizado}`)
console.log(`    Fuzzy (conf<0.95) NÃO gravado: ${rel.inversores.fuzzy}`)
console.log(`    Sem match               : ${rel.inversores.sem_match}`)
console.log(`    Já vinculado (skip)     : ${rel.inversores.ja_vinculado}`)

// Consolidar sem-match e fuzzy para relatório
const semMatchSorted = Object.values(semMatchAgg)
  .sort((a, b) => b.projetos - a.projetos)

const top50 = semMatchSorted.slice(0, 50)
console.log(`\n  SEM MATCH / FUZZY (não gravados) — top ${Math.min(top50.length, 50)}:`)
console.log(`  ${'TIPO'.padEnd(10)} ${'CLASSE'.padEnd(12)} ${'PROJ'.padEnd(6)} ${'MARCA + MODELO'}`)
console.log(`  ${'-'.repeat(62)}`)
for (const s of top50) {
  const classe = s.classe === 'fuzzy' ? `fuzzy(${s.confianca.toFixed(2)})` : 'sem_match'
  console.log(`  ${s.tipo.padEnd(10)} ${classe.padEnd(12)} ${String(s.projetos).padEnd(6)} ${s.marca} ${s.modelo}`)
}

const fabricantesSemMatch = [...new Set(
  Object.values(semMatchAgg).map(s => s.marca)
)].sort()
console.log(`\n  Fabricantes sem match/fuzzy (${fabricantesSemMatch.length}):`)
fabricantesSemMatch.forEach(f => console.log(`    - ${f}`))

if (DRY_RUN) {
  console.log(`\n💡 Para gravar: node scripts/bind-sm-equipamentos.mjs --apply`)
}
console.log(`${sep}\n`)

// Salva o resultado do dry-run como JSON
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const outFile = join(__dirname, '..', 'docs', `SOLARMARKET_EQUIPMENT_BIND_${DRY_RUN ? 'DRYRUN' : 'LOTE'}.json`)
writeFileSync(outFile, JSON.stringify({
  lote:       DRY_RUN ? null : `BIND-${new Date().toISOString().slice(0,10).replace(/-/g,'')}${new Date().toISOString().slice(11,16).replace(':','')}`,
  dry_run:    DRY_RUN,
  gerado_em:  new Date().toISOString(),
  rel,
  sem_match_top50: top50,
}, null, 2))
console.log(`📄 Relatório salvo em: ${outFile}`)

await mongoose.disconnect()
