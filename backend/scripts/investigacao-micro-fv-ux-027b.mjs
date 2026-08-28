/**
 * investigacao-micro-fv-ux-027b.mjs — FV-UX-027B item 2
 *
 * Executa os motores de microinversor QUE JÁ EXISTEM sobre o cenário real
 * (24 × Znshine 650 W × todos os micros do catálogo) e mede o que eles já
 * entregam e o que falta.
 *
 * Não adapta micro ao modelo de string. Só mede. Ambiente isolado (37017).
 *
 *   node backend/scripts/investigacao-micro-fv-ux-027b.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { validarMicroinversores } from '@fortesolar/fv-shared/fv/validacao-microinversores'
import { lerInversor, paraDimensionamento } from '@fortesolar/fv-shared/inversores'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

// `dimensionarMicroinversor` vive em frontend/src/utils — importado por caminho
// relativo APENAS para medir. É exatamente o achado: o motor não está em fv-shared.
const { dimensionarMicroinversor, resumoDistribuicao } =
  await import('../../frontend/src/utils/dimensionarMicro.js')

await mongoose.connect(cred.uri)
const { Equipamento } = await import('../src/models/Equipamento.js')

const N = 24
const mod = await Equipamento.findOne({ fabricante: 'Znshine' }).lean()
const E = mod.especificacoes

console.log('═══ FV-UX-027B · motores de microinversor existentes ═══')
console.log(`Cenário: ${N} × ${mod.fabricante} ${mod.modelo} (${E.potencia_w} W · Voc ${E.voc_v} V · Isc ${E.isc_a} A)\n`)

const micros = (await Equipamento.find({ tipo: 'inversor' }).lean())
  .filter((i) => i.especificacoes?.tipo_inversor === 'micro')
  .sort((a, b) => `${a.fabricante}${a.modelo}`.localeCompare(`${b.fabricante}${b.modelo}`))

const col = (v, n) => String(v ?? '—').padEnd(n)

console.log('── A · `dimensionarMicroinversor` (frontend/src/utils/dimensionarMicro.js)\n')
console.log(col('MICRO', 28) + col('ENT', 5) + col('MOD/MICRO', 11) + col('QTD', 5) +
  col('DISTRIBUIÇÃO', 22) + col('CC kW', 8) + col('CA kW', 8) + col('DC/CA', 8) + 'OVER OK')
const dims = new Map()
for (const m of micros) {
  const s = m.especificacoes
  const d = dimensionarMicroinversor({
    numModulos: N, potenciaModuloW: E.potencia_w,
    micro: { entradas: s.entradas, modulos_por_entrada: s.modulos_por_entrada,
      potencia_ca_kw: s.potencia, oversizing_max: s.oversizing_max },
  })
  dims.set(m._id.toString(), d)
  console.log(col(`${m.fabricante} ${m.modelo}`, 28) + col(s.entradas, 5) +
    col(d.modulosPorMicro, 11) + col(d.qtdMicros, 5) + col(resumoDistribuicao(d), 22) +
    col(d.potenciaCcKw, 8) + col(d.potenciaCaKw, 8) + col(d.relacaoDcAc, 8) +
    (d.oversizingOk ? 'sim' : `NÃO (${d.oversizingMicroCheio}×)`))
}

console.log('\n── B · `validarMicroinversores` (fv-shared/fv/validacao-microinversores)\n')
console.log(col('MICRO', 28) + col('VÁLIDO', 8) + 'BLOQUEIOS / AVISOS')
for (const m of micros) {
  const s = m.especificacoes
  const d = dims.get(m._id.toString())
  const v = validarMicroinversores({
    numModulos: N, numMicros: d.qtdMicros,
    entradasPorMicro: s.entradas,
    potenciaModuloW: E.potencia_w,
    potenciaMicroCA_W: s.potencia * 1000,
    oversizingMax: s.oversizing_max ?? 1.5,
  })
  const msgs = [...v.bloqueios.map((b) => '⛔ ' + b), ...v.avisos.map((a) => '⚠ ' + a)]
  console.log(col(`${m.fabricante} ${m.modelo}`, 28) + col(v.valido ? 'sim' : 'NÃO', 8) +
    (msgs[0] ?? '—'))
  for (const extra of msgs.slice(1)) console.log(' '.repeat(36) + extra)
}

console.log('\n── C · O que os motores NÃO cobrem (verificação elétrica por entrada)\n')
const iscProjeto = E.isc_a * 1.25
console.log(col('MICRO', 28) + col('Vmax', 8) + col('Voc mód', 10) + col('Imax', 8) +
  col('Isc proj', 10) + 'VEREDITO ELÉTRICO POR ENTRADA')
for (const m of micros) {
  const L = paraDimensionamento(m.especificacoes, m)
  const vocOk = E.voc_v <= L.voc_max_dc
  const iscOk = iscProjeto <= L.isc_max_mppt
  console.log(col(`${m.fabricante} ${m.modelo}`, 28) + col(L.voc_max_dc, 8) + col(E.voc_v, 10) +
    col(L.isc_max_mppt, 8) + col(iscProjeto.toFixed(2), 10) +
    `${vocOk ? 'Voc ok' : 'Voc EXCEDE'} · ${iscOk ? 'Isc ok' : 'Isc EXCEDE'}`)
}
console.log('\n   Nenhum dos dois motores verifica Voc/Isc por entrada — é a lacuna real.')

console.log('\n── D · Onde cada peça vive\n')
console.log('   validarMicroinversores  → packages/fv-shared/utils/fv/validacaoMicroinversores.js  ✅ compartilhado')
console.log('   dimensionarMicroinversor→ frontend/src/utils/dimensionarMicro.js                   ❌ SÓ no frontend')
console.log('   consumidores atuais: ConfiguradorArranjoFV (wizard) e E7Equipamentos (wizard)')
console.log('   consumidores na nova UX: NENHUM')

console.log('\n── E · Campos do catálogo usados pelos motores\n')
for (const campo of ['entradas', 'modulos_por_entrada', 'potencia', 'oversizing_max']) {
  const comCampo = micros.filter((m) => m.especificacoes?.[campo] != null).length
  console.log(`   ${col(campo, 24)} presente em ${comCampo}/${micros.length} micros do catálogo`)
}
console.log(`\n   \`entradas\` NÃO está no dicionário SSOT (dicionarioInversor.js).`)
console.log(`   O SSOT tem \`entradas_por_mppt\` (array) e \`n_mppts\`.`)

await mongoose.disconnect()
