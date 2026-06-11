#!/usr/bin/env node
/**
 * forensics-remaining-gaps.mjs
 * P0-CATALOG-REMAINING-GAPS-01
 *
 * READ-ONLY forensics sprint.
 * Identifica e classifica os projetos SM ainda sem vínculo completo.
 *
 * NÃO escreve no banco. NÃO cria equipamentos. NÃO faz bind.
 *
 * Uso:
 *   node scripts/forensics-remaining-gaps.mjs
 */

import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import 'dotenv/config'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI não configurada'); process.exit(1) }

await mongoose.connect(URI, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 40000 })
console.log('✅ MongoDB conectado (read-only)')

// ─── Imports ─────────────────────────────────────────────────────────────────
const { normalizarAgressive } = await import('../src/integracoes/solarmarket/normalizer.js')
const { ProjetoFV }           = await import('../src/models/ProjetoFV.js')
const { Equipamento }         = await import('../src/models/Equipamento.js')

// ─── Carregar catálogo Atlas completo ────────────────────────────────────────
console.log('\n📦 Carregando catálogo Atlas...')
const atlasEquipamentos = await Equipamento.find({})
  .select('_id tipo fabricante modelo identificacao')
  .lean()

console.log(`   ${atlasEquipamentos.length} equipamentos no Atlas`)

// Índices para lookup rápido
const atlasPorFabNorm = new Map()   // fab_norm → [docs]
const atlasPorHashFlex = new Map()  // normAgr(fab+mod) → doc
const atlasFabSet = new Set()       // fab_norm único

for (const doc of atlasEquipamentos) {
  const fabNorm = (doc.identificacao?.fabricante_normalizado || '').toUpperCase()
  const modNorm = (doc.identificacao?.modelo_normalizado || '').toUpperCase()
  const hashFlex = normalizarAgressive((doc.fabricante || '') + ' ' + (doc.modelo || ''))

  if (fabNorm) {
    atlasFabSet.add(fabNorm)
    if (!atlasPorFabNorm.has(fabNorm)) atlasPorFabNorm.set(fabNorm, [])
    atlasPorFabNorm.get(fabNorm).push(doc)
  }
  if (hashFlex && !atlasPorHashFlex.has(hashFlex)) {
    atlasPorHashFlex.set(hashFlex, doc)
  }
}

// ─── Carregar DatasheetCache ──────────────────────────────────────────────────
let datasheetFabs = new Set()
try {
  const { DatasheetCache } = await import('../src/models/DatasheetCache.js')
  const caches = await DatasheetCache.find({}).select('fabricante').lean()
  datasheetFabs = new Set(caches.map(c => c.fabricante?.toUpperCase()))
  console.log(`   ${datasheetFabs.size} fabricantes com datasheet em cache`)
} catch (e) {
  console.log('   DatasheetCache não disponível')
}

// ─── Carregar projetos SM ─────────────────────────────────────────────────────
console.log('\n🔍 Carregando projetos SolarMarket...')
const projetos = await ProjetoFV.find({
  'origem.tipo': 'import_solarmarket',
  'equipamentos.paineis.0': { $exists: true },
}).lean()

console.log(`   ${projetos.length} projetos com painéis importados`)

// ─── Identificar projetos incompletos ────────────────────────────────────────
const isVinculado = (eq) => eq?.equipamento_id && eq?.origem_bind === 'atlas'

const projetosIncompletos = projetos.filter(p => {
  const paineis = p.equipamentos?.paineis || []
  const inv = p.equipamentos?.inversor
  const paineisBound = paineis.every(pan => isVinculado(pan))
  const invBound = !inv || !(inv.marca || inv.modelo) || isVinculado(inv)
  return !(paineisBound && invBound)
})

const projetosCompletos = projetos.length - projetosIncompletos.length
console.log(`\n📊 Projetos COMPLETOS:    ${projetosCompletos} / ${projetos.length}`)
console.log(`   Projetos INCOMPLETOS: ${projetosIncompletos.length} / ${projetos.length}`)

// ─── Classificação de causa ────────────────────────────────────────────────
// A — Equipamento genuinamente ausente no Atlas (fab E modelo ausentes)
// B — Fabricante no Atlas, mas este modelo específico ausente
// C — Alias de fabricante faltando (fab com "SOLAR" extra, etc.)
// D — Dado insuficiente/corrompido (vazio, wattage como marca, descrição como modelo)
// E — Match ambíguo (múltiplos candidatos similares)
// F — Outro

function classificarItemSemBind(marca, modelo) {
  if (!marca || !modelo || marca.trim() === '' || modelo.trim() === '') {
    return { causa: 'D', detalhe: 'marca ou modelo vazio' }
  }

  // Detectar dado corrompido
  const marcaUp = marca.toUpperCase().trim()
  const modeloUp = modelo.toUpperCase().trim()

  // Wattage como marca
  if (/^\d{3,4}W$/i.test(marcaUp)) {
    return { causa: 'D', detalhe: 'wattage usado como marca' }
  }

  // Marca muito longa (descrição usada como marca)
  if (marcaUp.length > 60) {
    return { causa: 'D', detalhe: `marca muito longa (${marcaUp.length} chars) — provável descrição completa` }
  }

  // Modelo repetindo a marca (dado duplicado)
  if (marcaUp === modeloUp) {
    return { causa: 'D', detalhe: 'marca e modelo idênticos — dado corrompido' }
  }

  // Modelo numérico puro ou muito curto
  if (/^\d+$/.test(modeloUp) && modeloUp.length < 5) {
    return { causa: 'D', detalhe: `modelo numérico puro "${modelo}" — provavelmente wattage` }
  }

  // Verificar se fabricante normalizado agressivo existe no Atlas
  const fabNormSimples = normalizarAgressive(marcaUp)

  // Verificar aliases potenciais (marca SM com " SOLAR" extra vs Atlas sem)
  const marcaSemSolar = marcaUp.replace(/ SOLAR$/, '').replace(/ ENERGY$/, '').replace(/ PANELS$/, '').trim()
  const fabNormSemSufixo = normalizarAgressive(marcaSemSolar)

  // Verificar se algum fab_norm do Atlas contém ou é contido pela marca
  let fabricanteNoAtlas = false
  let fabricanteSimilarNoAtlas = false
  let docsDoFabricante = []

  for (const [fabNorm, docs] of atlasPorFabNorm) {
    const fabNormClean = normalizarAgressive(fabNorm)
    if (fabNormClean === fabNormSimples || fabNormClean === fabNormSemSufixo) {
      fabricanteNoAtlas = true
      docsDoFabricante = docs
      break
    }
    // Similar (prefixo ou sufixo)
    if (fabNormClean.startsWith(fabNormSimples) || fabNormSimples.startsWith(fabNormClean) ||
        fabNormClean.startsWith(fabNormSemSufixo) || fabNormSemSufixo.startsWith(fabNormClean)) {
      fabricanteSimilarNoAtlas = true
      docsDoFabricante = docs
    }
  }

  if (fabricanteNoAtlas || fabricanteSimilarNoAtlas) {
    // Fabricante encontrado: verificar se o modelo existe
    const modeloNormAgr = normalizarAgressive(modelo)
    const modeloExiste = docsDoFabricante.some(d => {
      const mNormAgr = normalizarAgressive((d.modelo || ''))
      return mNormAgr === modeloNormAgr
    })

    if (modeloExiste) {
      // Existe mas não foi bindado — provavelmente alias ainda necessário
      return { causa: 'C', detalhe: 'alias de fabricante necessário (modelo existe no Atlas)' }
    }

    // Verificar se é alias de MARCA necessário (SM usa nome diferente)
    if (fabricanteSimilarNoAtlas && !fabricanteNoAtlas) {
      return { causa: 'C', detalhe: `alias de fabricante similar: SM="${marca}" → possível Atlas="${docsDoFabricante[0]?.fabricante}"` }
    }

    // Fabricante existe, modelo não
    return {
      causa: 'B',
      detalhe: `fabricante "${docsDoFabricante[0]?.fabricante}" no Atlas (${docsDoFabricante.length} modelos), mas este modelo "${modelo}" ausente`,
      atlas_fab: docsDoFabricante[0]?.fabricante,
      atlas_count: docsDoFabricante.length,
    }
  }

  // Verificar hash flexível combinado
  const hashCombo = normalizarAgressive(marca + ' ' + modelo)
  if (atlasPorHashFlex.has(hashCombo)) {
    return { causa: 'C', detalhe: 'hash flexível encontra match mas bind não foi executado — alias necessário' }
  }

  // Fabricante genuinamente ausente
  return {
    causa: 'A',
    detalhe: `fabricante "${marca}" não encontrado no Atlas`,
  }
}

// ─── Inventário detalhado ─────────────────────────────────────────────────────
console.log('\n🔬 Analisando itens sem vínculo...')

const inventario = []
const agg = {}   // key = `marca|||modelo|||tipo` → {marca, modelo, tipo, projetos:[], causa, detalhe}

for (const p of projetosIncompletos) {
  const paineis = p.equipamentos?.paineis || []
  const inv = p.equipamentos?.inversor

  const clienteNome = p.cliente?.nome || p.cliente_nome || p.nome || p._id.toString()
  const projetoNome = p.nome || p._id.toString()

  for (const pan of paineis) {
    if (isVinculado(pan)) continue
    const { causa, detalhe, atlas_fab, atlas_count } = classificarItemSemBind(pan.marca, pan.modelo)
    const key = `${(pan.marca||'').trim()}|||${(pan.modelo||'').trim()}|||modulo`
    if (!agg[key]) {
      agg[key] = {
        marca: (pan.marca || '').trim(),
        modelo: (pan.modelo || '').trim(),
        tipo: 'modulo',
        causa,
        detalhe,
        atlas_fab: atlas_fab || null,
        atlas_count: atlas_count || 0,
        projetos_count: 0,
        projetos: [],
        tem_datasheet_cache: datasheetFabs.has(normalizarAgressive(pan.marca).slice(0, 20)) || false,
      }
    }
    agg[key].projetos_count++
    if (!agg[key].projetos.includes(projetoNome)) {
      agg[key].projetos.push(projetoNome)
    }
  }

  if (inv && (inv.marca || inv.modelo) && !isVinculado(inv)) {
    const { causa, detalhe, atlas_fab, atlas_count } = classificarItemSemBind(inv.marca, inv.modelo)
    const key = `${(inv.marca||'').trim()}|||${(inv.modelo||'').trim()}|||inversor`
    if (!agg[key]) {
      agg[key] = {
        marca: (inv.marca || '').trim(),
        modelo: (inv.modelo || '').trim(),
        tipo: 'inversor',
        causa,
        detalhe,
        atlas_fab: atlas_fab || null,
        atlas_count: atlas_count || 0,
        projetos_count: 0,
        projetos: [],
        tem_datasheet_cache: datasheetFabs.has(normalizarAgressive(inv.marca).slice(0, 20)) || false,
      }
    }
    agg[key].projetos_count++
    if (!agg[key].projetos.includes(projetoNome)) {
      agg[key].projetos.push(projetoNome)
    }
  }
}

// ─── Montar inventário ordenado por impacto ─────────────────────────────────
const itensOrdenados = Object.values(agg).sort((a, b) => b.projetos_count - a.projetos_count)

// ─── Estatísticas por causa ────────────────────────────────────────────────
const statsCausa = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
const statsProjCausa = { A: new Set(), B: new Set(), C: new Set(), D: new Set(), E: new Set(), F: new Set() }

for (const item of itensOrdenados) {
  statsCausa[item.causa] = (statsCausa[item.causa] || 0) + item.projetos_count
  for (const p of item.projetos) {
    statsProjCausa[item.causa]?.add(p)
  }
}

// ─── Ranking de fabricantes bloqueantes ─────────────────────────────────────
const rankFab = {}
for (const item of itensOrdenados) {
  const fab = item.marca || 'DESCONHECIDO'
  if (!rankFab[fab]) rankFab[fab] = { projetos: new Set(), itens: 0, causa: item.causa }
  item.projetos.forEach(p => rankFab[fab].projetos.add(p))
  rankFab[fab].itens++
}

const rankFabOrdenado = Object.entries(rankFab)
  .map(([fab, v]) => ({ fabricante: fab, projetos_bloqueados: v.projetos.size, causa_principal: v.causa }))
  .sort((a, b) => b.projetos_bloqueados - a.projetos_bloqueados)

// ─── ROI por fabricante ────────────────────────────────────────────────────
// ROI = projetos que seriam liberados se este fabricante fosse importado
// Para Causa A: todos os projetos do fabricante seriam liberados (se for o único gargalo)
// Para Causa B: apenas os projetos onde este modelo específico está ausente
const roiRanking = []

// Agrupar por fabricante com causa A ou B (ação clara = importar equipamentos)
const fabParaImportar = {}
for (const item of itensOrdenados) {
  if (item.causa === 'A' || item.causa === 'B') {
    if (!fabParaImportar[item.marca]) {
      fabParaImportar[item.marca] = {
        fabricante: item.marca,
        causa: item.causa,
        modelos_ausentes: [],
        projetos: new Set(),
      }
    }
    fabParaImportar[item.marca].modelos_ausentes.push(item.modelo)
    item.projetos.forEach(p => fabParaImportar[item.marca].projetos.add(p))
  }
}

for (const [fab, v] of Object.entries(fabParaImportar)) {
  roiRanking.push({
    fabricante: fab,
    projetos_liberados: v.projetos.size,
    modelos_ausentes: [...new Set(v.modelos_ausentes)],
    n_modelos: new Set(v.modelos_ausentes).size,
    causa: v.causa,
    acao: v.causa === 'A' ? 'Importar fabricante completo' : 'Importar modelos específicos',
  })
}
roiRanking.sort((a, b) => b.projetos_liberados - a.projetos_liberados)

// ─── Projetos individuais inventário ─────────────────────────────────────────
const projetosInventario = projetosIncompletos.map(p => {
  const paineis = p.equipamentos?.paineis || []
  const inv = p.equipamentos?.inversor

  const paineisSemBind = paineis
    .filter(pan => !isVinculado(pan))
    .map(pan => {
      const { causa, detalhe } = classificarItemSemBind(pan.marca, pan.modelo)
      return { marca: pan.marca, modelo: pan.modelo, categoria: 'modulo', causa, detalhe }
    })

  const invSemBind = (inv && (inv.marca || inv.modelo) && !isVinculado(inv))
    ? (() => {
        const { causa, detalhe } = classificarItemSemBind(inv.marca, inv.modelo)
        return [{ marca: inv.marca, modelo: inv.modelo, categoria: 'inversor', causa, detalhe }]
      })()
    : []

  return {
    _id: p._id.toString(),
    projeto: p.nome || p._id.toString(),
    cliente: p.cliente?.nome || p.cliente_nome || '—',
    itens_sem_bind: [...paineisSemBind, ...invSemBind],
    total_sem_bind: paineisSemBind.length + invSemBind.length,
  }
}).sort((a, b) => b.total_sem_bind - a.total_sem_bind)

// ─── Análise de datasheets locais ─────────────────────────────────────────────
const comDatasheetCache = itensOrdenados.filter(i => i.tem_datasheet_cache)
const projsBloqueadosComCache = new Set()
for (const item of comDatasheetCache) {
  item.projetos.forEach(p => projsBloqueadosComCache.add(p))
}

// ─── Resumo ────────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('RESUMO EXECUTIVO — P0-CATALOG-REMAINING-GAPS-01')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`\nProjetos incompletos:      ${projetosIncompletos.length}`)
console.log(`Itens únicos sem bind:     ${itensOrdenados.length}`)
console.log(`\nCausa A (ausente total):  ${statsCausa.A} ocorrências, ${statsProjCausa.A.size} projetos`)
console.log(`Causa B (modelo ausente): ${statsCausa.B} ocorrências, ${statsProjCausa.B.size} projetos`)
console.log(`Causa C (alias faltando): ${statsCausa.C} ocorrências, ${statsProjCausa.C.size} projetos`)
console.log(`Causa D (dado corrompido): ${statsCausa.D} ocorrências, ${statsProjCausa.D.size} projetos`)
console.log(`Causa E (ambíguo):         ${statsCausa.E} ocorrências, ${statsProjCausa.E.size} projetos`)

console.log('\n─── TOP 15 FABRICANTES BLOQUEANTES ───')
rankFabOrdenado.slice(0, 15).forEach((r, i) => {
  console.log(`  ${String(i+1).padStart(2)}. ${r.fabricante.padEnd(35)} ${String(r.projetos_bloqueados).padStart(3)} proj  (${r.causa_principal})`)
})

console.log('\n─── ROI: IMPORTAR PARA LIBERAR PROJETOS ───')
roiRanking.slice(0, 10).forEach((r, i) => {
  console.log(`  ${String(i+1).padStart(2)}. ${r.fabricante.padEnd(30)} → libera ${String(r.projetos_liberados).padStart(3)} projetos  (${r.n_modelos} modelos, ${r.causa})`)
})

// ─── Gerar JSON ───────────────────────────────────────────────────────────────
const outputJSON = {
  sprint: 'P0-CATALOG-REMAINING-GAPS-01',
  gerado_em: new Date().toISOString(),
  read_only: true,

  resumo: {
    projetos_total: projetos.length,
    projetos_completos: projetosCompletos,
    projetos_incompletos: projetosIncompletos.length,
    itens_unicos_sem_bind: itensOrdenados.length,
    causas: {
      A_ausente_total:    { ocorrencias: statsCausa.A, projetos: statsProjCausa.A.size },
      B_modelo_ausente:   { ocorrencias: statsCausa.B, projetos: statsProjCausa.B.size },
      C_alias_faltando:   { ocorrencias: statsCausa.C, projetos: statsProjCausa.C.size },
      D_dado_corrompido:  { ocorrencias: statsCausa.D, projetos: statsProjCausa.D.size },
      E_ambiguo:          { ocorrencias: statsCausa.E, projetos: statsProjCausa.E.size },
      F_outro:            { ocorrencias: statsCausa.F, projetos: statsProjCausa.F.size },
    },
    projetos_resolviveis_por_importacao: roiRanking.reduce((s, r) => s + r.projetos_liberados, 0),
    projetos_com_dado_corrompido_irrecuperavel: statsProjCausa.D.size,
  },

  ranking_fabricantes_bloqueantes: rankFabOrdenado,

  roi_ranking: roiRanking,

  itens_sem_bind: itensOrdenados.map(i => ({
    marca: i.marca,
    modelo: i.modelo,
    tipo: i.tipo,
    causa: i.causa,
    detalhe: i.detalhe,
    projetos_bloqueados: i.projetos_count,
    atlas_fab_similar: i.atlas_fab,
    atlas_modelos_count: i.atlas_count,
    tem_datasheet_cache: i.tem_datasheet_cache,
    projetos: i.projetos,
  })),

  projetos_incompletos: projetosInventario,
}

const outDir = path.join(__dirname, '..', 'docs')
const outJSON = path.join(outDir, 'CATALOG_REMAINING_GAPS_INVENTORY.json')
fs.writeFileSync(outJSON, JSON.stringify(outputJSON, null, 2), 'utf8')
console.log(`\n✅ JSON salvo: ${outJSON}`)

// Expor dados para o relatório
export { outputJSON }

await mongoose.disconnect()
console.log('\n✅ Concluído. Banco desconectado.')
process.exit(0)
