#!/usr/bin/env node
/**
 * import-high-roi-catalog.mjs
 * P1-CATALOG-HIGH-ROI-IMPORT-01
 *
 * Cria equipamentos Classe A no Atlas a partir de datasheets de fabricante
 * VALIDADOS (web-source: site oficial / distribuidor oficial / ENF).
 *
 * Escopo: HELIUS, RONMA, SIRIUS (Full Black). PULLING deferido (datasheet
 * sem fonte primária acessível com Voc/Isc — não fabricamos specs).
 *
 * Política:
 *   - Apenas equipamentos com datasheet validado (todos os campos elétricos da fonte)
 *   - Dedup por hash_unico — nunca cria duplicata
 *   - NUNCA altera equipamento existente
 *   - Idempotente: 2ª execução → 0 criações
 *
 * Uso:
 *   node scripts/import-high-roi-catalog.mjs           # dry-run (padrão)
 *   node scripts/import-high-roi-catalog.mjs --apply    # grava no banco
 */

import dns from 'dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])
import 'dotenv/config'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APPLY = process.argv.includes('--apply')

console.log(APPLY ? '⚡ APPLY — equipamentos SERÃO criados.' : '🔍 DRY-RUN — nenhuma escrita. Use --apply para gravar.')

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI não configurada'); process.exit(1) }

await mongoose.connect(URI, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 40000 })
console.log('✅ MongoDB conectado')

const { normalizarTexto, gerarHash } = await import('../src/integracoes/solarmarket/normalizer.js')
const { Equipamento } = await import('../src/models/Equipamento.js')

// ─── Datasheets VALIDADOS (cada campo elétrico vem da ficha do fabricante) ─────
// fonte = URL do datasheet primário. Todos os valores STC.
const DATASHEETS = [
  // ===== HELIUS (fabricante p/ bind = "Helius", marca comercial = Helius Energy / Sunlink PV) =====
  {
    fabricante: 'Helius', modelo: 'HMF144T10-570HL', tipo: 'modulo',
    fonte: 'https://alumifixsolar.com.br/wp-content/uploads/2024/01/English_Datasheet-HMF144T10-1.pdf',
    specs: { potencia_wp: 570, voc: 50.97, vmp: 42.99, isc: 14.08, imp: 13.26, eficiencia: 22.10,
             celulas: 144, tipo_celula: 'N-Type Monocristalina MBB Half-Cell', dimensoes: '2278x1134x30 mm', peso_kg: 27.4,
             tensao_max_sistema: 1500, fusivel_serie_max: 25,
             coef_temp_pmax: -0.30, coef_temp_voc: -0.25, coef_temp_isc: 0.045 },
    garantia_produto: { value: 15, unit: 'anos' }, garantia_performance: { value: 30, unit: 'anos' },
  },
  {
    fabricante: 'Helius', modelo: 'HMF132T10R-575HL', tipo: 'modulo',
    fonte: 'https://loja.stentor.com.br (Helius HMF132T10R datasheet, 565-590HL)',
    specs: { potencia_wp: 575, voc: 48.97, vmp: 40.46, isc: 15.02, imp: 14.21, eficiencia: 22.28,
             celulas: 132, tipo_celula: 'N-Type Monocristalina MBB Half-Cell', dimensoes: '2278x1134x30 mm', peso_kg: 27,
             tensao_max_sistema: 1500, fusivel_serie_max: 25,
             coef_temp_pmax: -0.30, coef_temp_voc: -0.25, coef_temp_isc: 0.045 },
    garantia_produto: { value: 15, unit: 'anos' }, garantia_performance: { value: 30, unit: 'anos' },
  },
  {
    fabricante: 'Helius', modelo: 'HMF132T12R-600HL', tipo: 'modulo',
    fonte: 'https://loja.stentor.com.br (Helius HMF132T12R datasheet, 600-625HL)',
    specs: { potencia_wp: 600, voc: 47.69, vmp: 39.47, isc: 15.93, imp: 15.21, eficiencia: 22.20,
             celulas: 132, tipo_celula: 'N-Type Monocristalina MBB Half-Cell', dimensoes: '2384x1134x30 mm', peso_kg: 27.5,
             tensao_max_sistema: 1500, fusivel_serie_max: 35,
             coef_temp_pmax: -0.30, coef_temp_voc: -0.25, coef_temp_isc: 0.045 },
    garantia_produto: { value: 15, unit: 'anos' }, garantia_performance: { value: 30, unit: 'anos' },
  },
  {
    fabricante: 'Helius', modelo: 'HMF144M10-555H', tipo: 'modulo',
    fonte: 'https://loja.stentor.com.br/shop/manual/heliushmf144m10.pdf',
    specs: { potencia_wp: 555, voc: 50.05, vmp: 42.14, isc: 14.07, imp: 13.17, eficiencia: 21.50,
             celulas: 144, tipo_celula: 'Monocristalina PERC 16 Busbar Half-Cell', dimensoes: '2278x1134x30 mm', peso_kg: 27,
             tensao_max_sistema: 1500, fusivel_serie_max: 30,
             coef_temp_pmax: -0.36, coef_temp_voc: -0.275, coef_temp_isc: 0.045 },
    garantia_produto: { value: 15, unit: 'anos' }, garantia_performance: { value: 30, unit: 'anos' },
  },

  // ===== RONMA (fabricante p/ bind = "Ronma Solar") =====
  {
    fabricante: 'Ronma Solar', modelo: 'RM-585W-182M/144TB', tipo: 'modulo',
    fonte: 'https://ronmasolar.com.br/wp-content/uploads/2025/08/CATALOGO-TABLET.pdf',
    specs: { potencia_wp: 585, voc: 53.26, vmp: 45.06, isc: 13.83, imp: 13.00, eficiencia: 22.60,
             celulas: 144, tipo_celula: 'N-TOPCon Monocristalina Bifacial', dimensoes: '2279x1134x30 mm', peso_kg: 32,
             tensao_max_sistema: 1500, fusivel_serie_max: 30, bifacial: true,
             coef_temp_pmax: -0.29, coef_temp_voc: -0.25, coef_temp_isc: 0.045 },
    garantia_produto: { value: 15, unit: 'anos' }, garantia_performance: { value: 30, unit: 'anos' },
  },
  {
    fabricante: 'Ronma Solar', modelo: 'RM-570W-182M/144TB', tipo: 'modulo',
    fonte: 'https://ronmasolar.com.br/wp-content/uploads/2025/08/CATALOGO-TABLET.pdf',
    specs: { potencia_wp: 570, voc: 52.77, vmp: 44.39, isc: 13.62, imp: 12.85, eficiencia: 22.06,
             celulas: 144, tipo_celula: 'N-TOPCon Monocristalina Bifacial', dimensoes: '2279x1134x30 mm', peso_kg: 32,
             tensao_max_sistema: 1500, fusivel_serie_max: 30, bifacial: true,
             coef_temp_pmax: -0.29, coef_temp_voc: -0.25, coef_temp_isc: 0.045 },
    garantia_produto: { value: 15, unit: 'anos' }, garantia_performance: { value: 30, unit: 'anos' },
  },
  {
    fabricante: 'Ronma Solar', modelo: 'RM-620W-182R/132TB', tipo: 'modulo',
    fonte: 'https://ronmasolar.com.br/wp-content/uploads/2025/08/CATALOGO-TABLET.pdf',
    specs: { potencia_wp: 620, voc: 49.60, vmp: 41.40, isc: 15.91, imp: 14.99, eficiencia: 23.00,
             celulas: 132, tipo_celula: 'N-TOPCon Monocristalina Bifacial', dimensoes: '2382x1134x30 mm', peso_kg: 33,
             tensao_max_sistema: 1500, fusivel_serie_max: 30, bifacial: true,
             coef_temp_pmax: -0.30, coef_temp_voc: -0.25, coef_temp_isc: 0.046 },
    garantia_produto: { value: 15, unit: 'anos' }, garantia_performance: { value: 30, unit: 'anos' },
  },

  // ===== SIRIUS Full Black (fabricante canônico = "Sirius Energias Renováveis") =====
  // Bind das variantes textuais ("Full Black", "RS6-550MX-E3", typos) requer aliases → FIX-02.
  {
    fabricante: 'Sirius Energias Renováveis', modelo: 'SIRIUS-RS6-550MX-E3', tipo: 'modulo',
    fonte: 'https://energiasirius.com/wp-content/uploads/2023/10/Datasheet-Modulo-Sirius-FullBlack-550w.pdf',
    specs: { potencia_wp: 550, voc: 50.10, vmp: 42.25, isc: 13.94, imp: 13.02, eficiencia: 21.30,
             celulas: 144, tipo_celula: 'Mono P-Type Half-Cut Full Black', dimensoes: '2278x1134x35 mm', peso_kg: 27,
             tensao_max_sistema: 1500, fusivel_serie_max: 30, linha: 'Full Black 3ª Geração',
             coef_temp_pmax: -0.35, coef_temp_voc: -0.27, coef_temp_isc: 0.048 },
    garantia_produto: { value: 15, unit: 'anos' }, garantia_performance: { value: 30, unit: 'anos' },
    aliases: ['Sirius Full Black', 'Sirius Full Black 550W', 'RS6-550MX-E3'],
  },
]

// ─── Execução ──────────────────────────────────────────────────────────────
const resultado = {
  sprint: 'P1-CATALOG-HIGH-ROI-IMPORT-01',
  gerado_em: new Date().toISOString(),
  dry_run: !APPLY,
  total_datasheets: DATASHEETS.length,
  criados: [], ja_existentes: [], falhas: [],
}

for (const ds of DATASHEETS) {
  const fabNorm = normalizarTexto(ds.fabricante)
  const modNorm = normalizarTexto(ds.modelo)
  const hash = gerarHash(fabNorm, modNorm)

  // Dedup pelos campos RAW fabricante+modelo (únicos campos que o hook pre('save')
  // NÃO reescreve). hash_unico vira SHA-40 e modelo_normalizado tem o "/" preservado
  // pelo hook — ambos divergem do que normalizarTexto produz, então não servem como
  // chave de dedup idempotente. fabricante/modelo exatos são estáveis.
  const existente = await Equipamento.findOne({
    fabricante: ds.fabricante,
    modelo:     ds.modelo,
  }).lean()
  if (existente) {
    resultado.ja_existentes.push({ fabricante: ds.fabricante, modelo: ds.modelo, hash, _id: existente._id.toString() })
    console.log(`  ⏭  JÁ EXISTE: ${ds.fabricante} ${ds.modelo} (hash ${hash})`)
    continue
  }

  // Provenance por campo: tudo do datasheet do fabricante
  const fonteDados = {}
  for (const campo of Object.keys(ds.specs)) {
    fonteDados[campo] = { fonte: 'datasheet_fabricante', confianca: 1.0, url: ds.fonte }
  }

  const doc = {
    tipo: ds.tipo,
    fabricante: ds.fabricante,
    modelo: ds.modelo,
    especificacoes: ds.specs,
    garantia_produto: ds.garantia_produto,
    garantia_performance: ds.garantia_performance,
    datasheet_url: ds.fonte,
    ativo: true,
    _schema_versao: '2.0',
    origem: {
      tipo: 'datasheet_pdfparse',
      fonte: ds.fonte,
      arquivo_original_url: ds.fonte,
      em: new Date(),
    },
    identificacao: {
      fabricante_normalizado: fabNorm,
      modelo_normalizado: modNorm,
      hash_unico: hash,
      aliases: ds.aliases || [],
    },
    fonte_dados: fonteDados,
    aprovacao_tecnica: {
      status: 'aprovado',
      aprovado_em: new Date(),
      aprovado_por: 'P1-CATALOG-HIGH-ROI-IMPORT-01',
      motivo: 'Datasheet de fabricante validado (web-source oficial/distribuidor)',
    },
  }

  if (APPLY) {
    try {
      const created = await Equipamento.create(doc)
      resultado.criados.push({ fabricante: ds.fabricante, modelo: ds.modelo, hash, _id: created._id.toString(),
        qualidade: created.qualidade?.nivel, score: created.qualidade?.score_global })
      console.log(`  ✅ CRIADO: ${ds.fabricante} ${ds.modelo} (hash ${hash}) qualidade=${created.qualidade?.nivel}/${created.qualidade?.score_global}`)
    } catch (err) {
      resultado.falhas.push({ fabricante: ds.fabricante, modelo: ds.modelo, erro: err.message })
      console.log(`  ❌ FALHA: ${ds.fabricante} ${ds.modelo}: ${err.message}`)
    }
  } else {
    resultado.criados.push({ fabricante: ds.fabricante, modelo: ds.modelo, hash, _id: '(dry-run)',
      specs_count: Object.keys(ds.specs).length })
    console.log(`  + CRIARIA: ${ds.fabricante} ${ds.modelo} (hash ${hash}) — ${Object.keys(ds.specs).length} specs`)
  }
}

console.log(`\n📊 Datasheets: ${DATASHEETS.length} | Criar: ${resultado.criados.length} | Já existem: ${resultado.ja_existentes.length} | Falhas: ${resultado.falhas.length}`)

const outFile = path.join(__dirname, '..', 'docs',
  APPLY ? 'CATALOG_HIGH_ROI_IMPORT_LOTE.json' : 'CATALOG_HIGH_ROI_IMPORT_DRYRUN.json')
const prev = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {}
fs.writeFileSync(outFile, JSON.stringify({ ...prev, ...resultado }, null, 2), 'utf8')
console.log(`✅ Resultado salvo: ${outFile}`)

await mongoose.disconnect()
process.exit(0)
