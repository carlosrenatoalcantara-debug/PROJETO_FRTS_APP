/**
 * envelope-inversores-fv-ux-027.mjs — FV-UX-027, TESTE 5.1 a 5.5
 *
 * Para CADA inversor do catálogo, varre quantidades de módulos de 6 a 40 e
 * todas as distribuições uniformes possíveis (MPPTs usados × strings/MPPT),
 * registrando o ENVELOPE real de configuração.
 *
 * Usa o MESMO validador canônico que a nova UX chama, uma vez por MPPT.
 * Nenhuma regra de "melhor" é inventada: registra todas as válidas.
 *
 * Só mede. Ambiente isolado (37017).
 *
 *   node backend/scripts/envelope-inversores-fv-ux-027.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { analisarCompatibilidade } from '../src/services/compatibilidadeEletricaService.js'
import { lerInversor, paraDimensionamento } from '@fortesolar/fv-shared/inversores'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

await mongoose.connect(cred.uri)
const { Equipamento } = await import('../src/models/Equipamento.js')

const BASE = 24
const QUANTIDADES = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40]
const FASE_INSTALACAO = 1
const CLIMA = { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 }  // RN

const mod = await Equipamento.findOne({ fabricante: 'Znshine' }).lean()
const E = mod.especificacoes
const ELET = {
  voc: E.voc_v, vmpp: E.vmpp_v, isc: E.isc_a, impp: E.impp_a,
  potencia_w: E.potencia_w, coef_temp_voc: E.coef_temp_voc_pct_c, temp_noct: E.noct_c,
}

console.log('═══ FV-UX-027 · TESTE 5 — envelope de configuração ═══')
console.log(`Módulo: ${mod.fabricante} ${mod.modelo} — ${E.potencia_w} W · Voc ${E.voc_v} V · Isc ${E.isc_a} A`)
console.log(`Isc de projeto por string = ${(E.isc_a * 1.25).toFixed(2)} A (NBR 16690 §5.2)`)
console.log(`Clima: RN, Tmin ${CLIMA.temperatura_min_historica_c} / Tmax ${CLIMA.temperatura_max_historica_c}\n`)

const inversores = (await Equipamento.find({ tipo: 'inversor' }).sort({ fabricante: 1, modelo: 1 }).lean())
  .filter((i) => i.especificacoes && Object.keys(i.especificacoes).length > 0)

/** Limites do inversor pela SSOT do pacote compartilhado. */
function limites(inv) {
  const d = paraDimensionamento(inv.especificacoes, inv)
  const c = lerInversor(inv.especificacoes, inv)
  return {
    tensao_max_entrada: d.voc_max_dc, mppt_min: d.mppt_min_v, mppt_max: d.mppt_max_v,
    corrente_max_mppt: d.isc_max_mppt, potencia_ca_kw: d.potencia_kw,
    n_mppts: d.n_mppts, fases: c.fases,
    entradas_por_mppt: d.entradas_por_mppt, max_entradas: d.max_entradas_total,
    // Declara se o valor veio do catálogo ou do default do adapter.
    n_mppts_do_catalogo: lerInversor(inv.especificacoes, inv).n_mppts,
  }
}

function avaliar(L, mpptsUsados, strings, mps) {
  const r = analisarCompatibilidade({
    dados_eletricos_modulo: ELET,
    dados_eletricos_inversor: {
      tensao_max_entrada: L.tensao_max_entrada, mppt_min: L.mppt_min, mppt_max: L.mppt_max,
      corrente_max_mppt: L.corrente_max_mppt, potencia_ca_kw: L.potencia_ca_kw,
    },
    arranjo_proposto: {
      quantidade_modulos_por_string: mps, quantidade_strings_paralelo: strings,
      num_mppt_usados: 1,
    },
    dados_climaticos_regiao: CLIMA,
  })
  const criticos = (r.erros ?? []).map((x) => x.codigo)
  // Oversizing é GLOBAL: recomputado sobre o sistema inteiro, não por MPPT.
  const kwp = (mpptsUsados * strings * mps * ELET.potencia_w) / 1000
  const over = L.potencia_ca_kw ? kwp / L.potencia_ca_kw : null
  const criticosSemOver = criticos.filter((c) => !c.startsWith('OVERSIZING'))
  return {
    ok: criticosSemOver.length === 0 && over !== null && over <= 1.5,
    criticos: criticosSemOver, over, kwp,
    voc: r.calculos?.voc_string_max, vmppQ: r.calculos?.vmpp_string_quente, isc: r.calculos?.isc_total,
  }
}

/** Todas as configurações uniformes válidas para uma quantidade de módulos. */
function validasPara(L, n) {
  const out = []
  for (let mppts = 1; mppts <= (L.n_mppts || 1); mppts++) {
    for (let strings = 1; strings <= 6; strings++) {
      const total = mppts * strings
      if (n % total !== 0) continue
      const mps = n / total
      if (mps < 1) continue
      const a = avaliar(L, mppts, strings, mps)
      if (a.ok) out.push({ n, mppts, strings, mps, ...a })
    }
  }
  return out
}

const linhas = []
for (const inv of inversores) {
  const L = limites(inv)
  const tec = inv.especificacoes.tipo_inversor ?? '?'
  const envelope = {}
  for (const n of QUANTIDADES) {
    const v = validasPara(L, n)
    if (v.length) envelope[n] = v
  }
  const quantidades = Object.keys(envelope).map(Number)
  linhas.push({
    nome: `${inv.fabricante} ${inv.modelo}`, tec, L,
    aceita24: !!envelope[BASE],
    config24: envelope[BASE] ?? [],
    min: quantidades.length ? Math.min(...quantidades) : null,
    max: quantidades.length ? Math.max(...quantidades) : null,
    quantidades, envelope,
  })
}

// ── 5.4 · Tabela por fase e tecnologia ──────────────────────────────────────
const col = (v, n) => String(v ?? '—').padEnd(n)
console.log('═══ 5.4 — TABELA GERAL ═══\n')
console.log(col('INVERSOR', 32) + col('TEC', 12) + col('FASE', 6) + col('kW', 6) +
  col('MPPT', 5) + col('24?', 5) + col('ENVELOPE (nº módulos)', 24) + 'CONFIG. COM 24')
for (const l of linhas) {
  const fase = l.L.fases === 3 ? '3F' : l.L.fases === 1 ? '1F' : '?'
  const env = l.quantidades.length ? `${l.min}–${l.max} (${l.quantidades.length} qtd)` : 'nenhuma'
  const cfg = l.config24.map((c) => `${c.mppts}MPPT×${c.strings}str×${c.mps}mod`).join(' | ')
  console.log(col(l.nome, 32) + col(l.tec, 12) + col(fase, 6) + col(l.L.potencia_ca_kw, 6) +
    col(l.L.n_mppts, 5) + col(l.aceita24 ? 'SIM' : 'não', 5) + col(env, 24) + cfg)
}

// ── Detalhe das configurações com 24 módulos ────────────────────────────────
console.log('\n═══ 5.2 — DETALHE DAS CONFIGURAÇÕES VÁLIDAS COM 24 MÓDULOS ═══\n')
console.log(col('INVERSOR', 30) + col('MPPT×str×mod', 16) + col('kWp', 8) + col('Voc frio', 10) +
  col('Vmpp qte', 10) + col('Isc', 9) + 'DC/CA')
for (const l of linhas.filter((x) => x.aceita24)) {
  for (const c of l.config24) {
    console.log(col(l.nome, 30) + col(`${c.mppts}×${c.strings}×${c.mps}`, 16) +
      col(c.kwp.toFixed(2), 8) + col(`${c.voc} V`, 10) + col(`${c.vmppQ} V`, 10) +
      col(`${c.isc} A`, 9) + `${c.over.toFixed(2)}×`)
  }
}

// ── 5.3 · Quem precisa de menos / aceita mais ───────────────────────────────
console.log('\n═══ 5.3 — ENVELOPE: MENOS E MAIS QUE 24 ═══\n')
console.log(col('INVERSOR', 32) + col('MÍN', 6) + col('MÁX', 6) + 'QUANTIDADES VÁLIDAS')
for (const l of linhas.filter((x) => x.quantidades.length)) {
  console.log(col(l.nome, 32) + col(l.min, 6) + col(l.max, 6) + l.quantidades.join(', '))
}
const semNenhuma = linhas.filter((l) => !l.quantidades.length)
console.log(`\n   sem NENHUMA configuração válida (6–40 módulos): ${semNenhuma.length}`)
for (const l of semNenhuma) console.log(`     ${l.nome} (${l.tec}, ${l.L.fases}F, Vmax ${l.L.tensao_max_entrada} V, Imax ${l.L.corrente_max_mppt} A)`)

// ── Resumo ──────────────────────────────────────────────────────────────────
const c24 = linhas.filter((l) => l.aceita24)
const menos = linhas.filter((l) => !l.aceita24 && l.quantidades.some((q) => q < BASE))
const mais = linhas.filter((l) => l.quantidades.some((q) => q > BASE))
console.log('\n═══ RESUMO ═══')
console.log(`   inversores testados:                      ${linhas.length}`)
console.log(`   válidos com 24 módulos:                   ${c24.length}`)
console.log(`     · monofásicos:                          ${c24.filter((l) => l.L.fases === 1).length}`)
console.log(`     · trifásicos (ressalva de adequação):   ${c24.filter((l) => l.L.fases === 3).length}`)
console.log(`   exigem MENOS que 24 para funcionar:       ${menos.length}`)
console.log(`   permitem MAIS que 24:                     ${mais.length}`)
console.log(`   sem nenhuma configuração válida:          ${semNenhuma.length}`)
console.log(`   por tecnologia (válidos com 24): ${JSON.stringify(
  c24.reduce((a, l) => ({ ...a, [l.tec]: (a[l.tec] ?? 0) + 1 }), {}))}`)

// ── 5.5 · Microinversores ───────────────────────────────────────────────────
console.log('\n═══ 5.5 — MICROINVERSORES ═══\n')
console.log(col('MICRO', 30) + col('kW', 7) + col('ENTRADAS', 10) + col('MOD/ENTR', 10) +
  col('Vmax', 7) + col('Imax', 7) + col('MICROS p/ 24', 14) + 'ENVELOPE')
for (const l of linhas.filter((x) => x.tec === 'micro' || x.tec === 'microinversor')) {
  const s = inversores.find((i) => `${i.fabricante} ${i.modelo}` === l.nome).especificacoes
  const entradas = s.entradas ?? null
  const necessarios = entradas ? Math.ceil(BASE / (entradas * (s.modulos_por_entrada ?? 1))) : '?'
  console.log(col(l.nome, 30) + col(l.L.potencia_ca_kw, 7) + col(entradas, 10) +
    col(s.modulos_por_entrada, 10) + col(l.L.tensao_max_entrada, 7) + col(l.L.corrente_max_mppt, 7) +
    col(necessarios, 14) + (l.quantidades.length ? l.quantidades.join(',') : 'nenhuma no modelo de string'))
}

// ── A5 · Fonte do n_mppts ───────────────────────────────────────────────────
console.log('\n═══ A5 — FONTE DO nº DE MPPTs ═══')
const semNmppt = inversores.filter((i) => lerInversor(i.especificacoes, i).n_mppts == null)
console.log(`   inversores SEM n_mppts no catálogo: ${semNmppt.length}`)
for (const i of semNmppt) console.log(`     ${i.fabricante} ${i.modelo}`)
console.log(`   \`paraDimensionamento\` aplica default \`?? 2\` quando ausente — valor FABRICADO.`)
console.log(`   \`catalogo.js\` da nova UX lê direto ['n_mppts','mppts','numero_mppt'],`)
console.log(`   SEM passar pelo dicionário SSOT (que aceita também 'nMppts' e 'num_mppt').`)

await mongoose.disconnect()
