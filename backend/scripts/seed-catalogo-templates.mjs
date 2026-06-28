/**
 * seed-catalogo-templates.mjs — P0-CATALOGO-MESTRE-MATERIAIS (Fase 2A)
 *
 * Popula (idempotente) os Templates de Categoria a partir de
 * src/seeds/catalogoTemplates.js. NÃO cadastra nenhum MATERIAL.
 *
 *   npm run catalogo:seed-templates            # aplica
 *   npm run catalogo:seed-templates -- --dry   # apenas lista, não grava
 *
 * Requer MONGODB_URI (Atlas). Escopo de empresa: null (tenant "default").
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { conectarBD } from '../src/config/database.js'
import { CategoriaMaterial } from '../src/models/CategoriaMaterial.js'
import { TEMPLATES_CATEGORIA } from '../src/seeds/catalogoTemplates.js'

const DRY = process.argv.includes('--dry')

async function main() {
  // --dry: pré-visualização offline (não conecta ao banco).
  if (DRY) {
    for (const t of TEMPLATES_CATEGORIA) {
      const id = t.atributos.filter(x => x.identidade).map(x => x.chave).join(', ')
      console.log(`• ${t.chave} (${t.classe}) — ${t.atributos.length} atributos · identidade: ${id}`)
    }
    console.log(`\n${TEMPLATES_CATEGORIA.length} templates (dry-run, nada gravado).`)
    process.exit(0)
  }

  const ok = await conectarBD(3, 2000)
  if (!ok) { console.error('❌ MongoDB indisponível — abortando (templates exigem Atlas).'); process.exit(1) }

  let criados = 0, atualizados = 0
  for (const t of TEMPLATES_CATEGORIA) {
    const r = await CategoriaMaterial.updateOne(
      { empresa_id: null, chave: t.chave },
      { $set: { ...t, empresa_id: null, ativo: true } },
      { upsert: true },
    )
    if (r.upsertedCount) criados++; else atualizados++
    console.log(`✓ ${t.chave}`)
  }
  console.log(`\n✅ Templates: ${criados} criados, ${atualizados} atualizados (total ${TEMPLATES_CATEGORIA.length}).`)
  await mongoose.disconnect()
  process.exit(0)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
