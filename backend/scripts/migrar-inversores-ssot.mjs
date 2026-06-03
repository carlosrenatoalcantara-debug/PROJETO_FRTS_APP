/**
 * migrar-inversores-ssot.mjs — P0-INV-SSOT-01
 *
 * 1) EVIDÊNCIA: para 5 fabricantes (GoodWe/Solis/SAJ/Deye/Solplanet) com
 *    `especificacoes` no vocabulário do PARSER, mostra ANTES (pick legado da
 *    qualidade) vs DEPOIS (SSOT) + dimensionamento (mesmos valores) + ficha.
 * 2) MIGRAÇÃO: recalcula a qualidade de TODOS os inversores reais do banco
 *    (Mongo se conectado; senão memory-storage) e persiste. Idempotente.
 *
 * Uso:  node scripts/migrar-inversores-ssot.mjs
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { processarEquipamento, _internals } from '../src/services/catalogoQualidade.js'
import { extrairSpecsInversor } from '../src/services/compatibilidadeFV.js'
import { diagnosticarFicha } from '../src/utils/catalogo/fichaTecnicaMap.js'

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const pick = (o, ks) => { for (const k of ks) { const v = o?.[k]; if (v != null && v !== '') return v } return null }

// ── Réplica EXATA do normalizador ANTES da SSOT (pick lists legados) ─────────
function normalizarSpecsInversor_ANTES(eq) {
  const esp = eq.especificacoes || {}
  return {
    potencia_kw_ca: num(pick(esp, ['potencia_kw','potencia_kw_ca','potencia'])),
    fases_saida: num(pick(esp, ['fases','fases_saida','numeroFases'])),
    tensao_saida_v: num(pick(esp, ['tensao_saida_v','tensao_saida','tensao_nominal_v'])),
    voc_max_dc_v: num(pick(esp, ['voc_max_dc','voc_max_dc_v','tensao_max_dc','vpv_max','voc_max'])),
    mppt_min_v: num(pick(esp, ['mppt_min_v','faixa_mppt_min','mppt_min'])),
    mppt_max_v: num(pick(esp, ['mppt_max_v','faixa_mppt_max','mppt_max'])),
    isc_max_por_mppt_a: num(pick(esp, ['isc_max_mppt','isc_max_por_mppt_a','corrente_max_mppt','ipv_max'])),
    n_mppts: num(pick(esp, ['n_mppts','mppts','numero_mppt'])),
    eficiencia_max_pct: num(pick(esp, ['eficiencia_max','eficiencia','eficiencia_max_pct'])),
  }
}
function completudeAntes(eq) {
  const sc = normalizarSpecsInversor_ANTES(eq)
  return _internals.calcularCompletude(eq, sc).score
}

// ── Amostras reais (vocabulário do PARSER) ───────────────────────────────────
const AMOSTRAS = [
  { fabricante: 'GoodWe', modelo: 'GW17K-DT', especificacoes: {
    potencia_kw: 17, potencia_maxima_kw: 18.7, n_mppts: 2, strings_por_mppt: 2,
    tensao_max_entrada: 1000, tensao_mppt_min: 260, tensao_mppt_max: 850,
    tensao_ac: 380, corrente_ac_saida: 27.5, corrente_max_por_mppt: 22,
    corrente_isc_max: 27.5, eficiencia_maxima: 98.6, peso_kg: 39,
    grau_protecao_ip: 'IP65', garantia_anos: 10, fases: 3 } },
  { fabricante: 'Solis', modelo: 'S5-GR3P10K', especificacoes: {
    potencia_kw: 10, n_mppts: 2, strings_por_mppt: 1, tensao_max_entrada: 1000,
    tensao_mppt_min: 90, tensao_mppt_max: 850, tensao_ac: 380, corrente_ac_saida: 16.1,
    corrente_isc_max: 20, eficiencia_maxima: 98.7, peso_kg: 18.5, grau_protecao_ip: 'IP66',
    garantia_anos: 5, fases: 3 } },
  { fabricante: 'SAJ', modelo: 'R5-8K-T2', especificacoes: {
    potencia_kw: 8, n_mppts: 2, tensao_max_entrada: 1000, tensao_mppt_min: 90,
    tensao_mppt_max: 850, tensao_ac: 380, corrente_isc_max: 25, eficiencia_maxima: 98.2,
    peso_kg: 20, grau_protecao_ip: 'IP65', garantia_anos: 10, fases: 3 } },
  { fabricante: 'Deye', modelo: 'SUN-8K-G04', especificacoes: {
    potencia_kw: 8, n_mppts: 2, tensao_max_entrada: 1000, tensao_mppt_min: 80,
    tensao_mppt_max: 850, tensao_ac: 380, corrente_isc_max: 26, eficiencia_maxima: 98.3,
    peso_kg: 22, grau_protecao_ip: 'IP65', garantia_anos: 10, fases: 3 } },
  { fabricante: 'Solplanet', modelo: 'ASW15K-LT-G2', especificacoes: {
    potencia_kw: 15, n_mppts: 2, tensao_max_entrada: 1000, tensao_mppt_min: 200,
    tensao_mppt_max: 850, tensao_ac: 380, corrente_isc_max: 26, eficiencia_maxima: 98.3,
    peso_kg: 19, grau_protecao_ip: 'IP66', garantia_anos: 10, fases: 3 } },
]

console.log('\n================ EVIDÊNCIA ANTES/DEPOIS (5 fabricantes) ================')
for (const a of AMOSTRAS) {
  const eq = { tipo: 'inversor', ...a }
  const antes = completudeAntes(eq)
  const r = processarEquipamento(eq)
  const depois = r.qualidade.completude_score
  const sc = r.specs_canonicas
  const dim = extrairSpecsInversor(eq)
  const ficha = diagnosticarFicha(eq).completude_pct
  console.log(`\n● ${a.fabricante} ${a.modelo}`)
  console.log(`  Catálogo(ficha)=${ficha}%  Qualidade(completude): ANTES=${antes}% → DEPOIS=${depois}%  (score_global=${r.qualidade.score_global})`)
  console.log(`  ETAPA 3 Qualidade lê  : voc_max_dc_v=${sc.voc_max_dc_v} mppt_min_v=${sc.mppt_min_v} mppt_max_v=${sc.mppt_max_v} isc=${sc.isc_max_por_mppt_a} efic=${sc.eficiencia_max_pct} tensao_ac=${sc.tensao_saida_v}`)
  console.log(`  ETAPA 4 Dimensiona usa: voc_max_dc=${dim.voc_max_dc} mppt_min_v=${dim.mppt_min_v} mppt_max_v=${dim.mppt_max_v} isc_max_mppt=${dim.isc_max_mppt} n_mppts=${dim.n_mppts} pot=${dim.potencia_kw}`)
  const mesmos = sc.voc_max_dc_v === dim.voc_max_dc && sc.mppt_min_v === dim.mppt_min_v && sc.isc_max_por_mppt_a === dim.isc_max_mppt
  console.log(`  → Qualidade e Dimensionamento usam os MESMOS campos: ${mesmos ? 'SIM ✅' : 'NÃO ❌'}`)
}

// ── MIGRAÇÃO real dos inversores do banco ────────────────────────────────────
async function migrar() {
  console.log('\n================ MIGRAÇÃO (recalcular qualidade) ================')
  let usouMongo = false
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 })
      usouMongo = mongoose.connection.readyState === 1
    }
  } catch { usouMongo = false }

  if (usouMongo) {
    const { Equipamento } = await import('../src/models/Equipamento.js')
    const invs = await Equipamento.find({ tipo: 'inversor' })
    console.log(`Mongo: ${invs.length} inversores`)
    for (const eq of invs) {
      const antes = eq.qualidade?.score_global ?? null
      await eq.save() // dispara hook pre('save') → recalcula com SSOT
      console.log(`  ${eq.fabricante} ${eq.modelo}: score ${antes} → ${eq.qualidade?.score_global}`)
    }
    await mongoose.disconnect()
  } else {
    const { memoryStore } = await import('../src/config/memoryStorage.js')
    const invs = memoryStore.findAllEquipamentos({}).filter(e => e.tipo === 'inversor')
    console.log(`memory-storage: ${invs.length} inversores`)
    for (const eq of invs) {
      const antes = eq.qualidade?.score_global ?? null
      const r = processarEquipamento(eq)
      eq.specs_canonicas = r.specs_canonicas
      eq.qualidade = r.qualidade
      eq.status_operacional = r.status_operacional
      console.log(`  ${eq.fabricante} ${eq.modelo}: score ${antes ?? 'n/a'} → ${r.qualidade.score_global} (completude=${r.qualidade.completude_score})`)
    }
    memoryStore.saveToFile()
    console.log('  ✅ memory-storage persistido')
  }
}
await migrar()
console.log('\n✅ Concluído.')
