/**
 * varredura-inversores-fv-ux-027.mjs — FV-UX-027
 *
 * Percorre TODOS os inversores do catálogo com o cenário da auditoria
 * (24 × Znshine 650 W, instalação monofásica 220 V, RN) e registra, para cada
 * um, o que a nova UX conseguiria fazer.
 *
 * Usa o MESMO validador canônico que a tela chama, uma vez por MPPT.
 * Só mede. Ambiente isolado (37017).
 *
 *   node backend/scripts/varredura-inversores-fv-ux-027.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { analisarCompatibilidade } from '../src/services/compatibilidadeEletricaService.js'
import { calcularTemperaturas } from '@fortesolar/fv-shared/engenharia/normativa'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

await mongoose.connect(cred.uri)
const { Equipamento } = await import('../src/models/Equipamento.js')

const MODULOS = 24
const FASE_INSTALACAO = 1   // monofásica, conforme o cenário

const mod = await Equipamento.findOne({ fabricante: 'Znshine' }).lean()
const E = mod.especificacoes
const ELET_MOD = {
  voc: E.voc_v, vmpp: E.vmpp_v, isc: E.isc_a, impp: E.impp_a,
  potencia_w: E.potencia_w, coef_temp_voc: E.coef_temp_voc_pct_c, temp_noct: E.noct_c,
}
console.log(`Módulo: ${mod.fabricante} ${mod.modelo}`)
console.log(`  Voc ${E.voc_v} V · Vmpp ${E.vmpp_v} V · Isc ${E.isc_a} A · Impp ${E.impp_a} A · ${E.potencia_w} W`)
console.log(`  Isc de projeto por string (×1,25) = ${(E.isc_a * 1.25).toFixed(2)} A\n`)

// Clima: o que a UX ENVIA hoje (localizacao vazia) e o que o UF diria.
const climaUX = { temperatura_min_historica_c: null, temperatura_max_historica_c: null }
const t = calcularTemperaturas('RN')
const climaUF = { temperatura_min_historica_c: t.tmin, temperatura_max_historica_c: t.tmax }
console.log(`Clima que a UX envia hoje: ${JSON.stringify(climaUX)}  → motor usa fallback 10/40`)
console.log(`Clima que a UF (RN) definiria: Tmin ${t.tmin} · Tmax ${t.tmax}\n`)

const inversores = (await Equipamento.find({ tipo: 'inversor' }).sort({ fabricante: 1, modelo: 1 }).lean()).filter((i) => i.especificacoes && Object.keys(i.especificacoes).length > 0)

/** Melhor distribuição UNIFORME de 24 módulos em nMppts, dentro dos limites. */
function melhorArranjo(inv, elet, clima) {
  const n = Number(inv.especificacoes.n_mppts) || 1
  const tentativas = []
  for (let mpptsUsados = 1; mpptsUsados <= n; mpptsUsados++) {
    for (let strings = 1; strings <= 4; strings++) {
      const total = mpptsUsados * strings
      if (MODULOS % total !== 0) continue
      const mps = MODULOS / total
      const r = analisarCompatibilidade({
        dados_eletricos_modulo: elet,
        dados_eletricos_inversor: {
          tensao_max_entrada: inv.especificacoes.tensao_max_entrada,
          mppt_min: inv.especificacoes.tensao_mppt_min,
          mppt_max: inv.especificacoes.tensao_mppt_max,
          corrente_max_mppt: inv.especificacoes.corrente_max_por_mppt,
          potencia_ca_kw: inv.especificacoes.potencia,
        },
        arranjo_proposto: {
          quantidade_modulos_por_string: mps,
          quantidade_strings_paralelo: strings,
          num_mppt_usados: 1,
        },
        dados_climaticos_regiao: clima,
      })
      const criticos = (r.erros ?? []).filter((x) => x.severidade === 'critico')
        .map((x) => x.codigo).filter((c) => c !== 'INPUT_INVALIDO')
      tentativas.push({ mpptsUsados, strings, mps, criticos, calc: r.calculos })
      if (criticos.length === 0) return { ok: true, ...tentativas.at(-1) }
    }
  }
  return { ok: false, tentativas }
}

const linhas = []
for (const inv of inversores) {
  const s = inv.especificacoes
  const tec = s.tipo_inversor ?? '?'
  const fases = Number(s.fases) || null
  const r = melhorArranjo(inv, ELET_MOD, climaUX)
  const kwp = (MODULOS * E.potencia_w) / 1000
  const over = s.potencia ? (kwp / s.potencia).toFixed(2) : '?'
  linhas.push({
    nome: `${inv.fabricante} ${inv.modelo}`,
    tec, fases, kw: s.potencia, nMppts: s.n_mppts,
    imax: s.corrente_max_por_mppt, vmax: s.tensao_max_entrada,
    faixa: `${s.tensao_mppt_min}-${s.tensao_mppt_max}`,
    over,
    aceita: r.ok ? `${r.mpptsUsados}×${r.strings}×${r.mps}` : '—',
    motivo: r.ok ? '' : [...new Set((r.tentativas ?? []).flatMap((x) => x.criticos))].join(',') || 'sem divisão exata',
    faseOk: fases === FASE_INSTALACAO,
  })
}

const col = (v, n) => String(v ?? '—').padEnd(n)
console.log('═══ TODOS OS INVERSORES × 24 módulos Znshine 650 W (instalação MONOFÁSICA) ═══\n')
console.log(col('INVERSOR', 34) + col('TEC', 14) + col('F', 3) + col('kW', 6) + col('MPPT', 5) +
  col('Imax', 6) + col('Vmax', 6) + col('DC/CA', 7) + col('ACEITA 24?', 12) + 'MOTIVO')
for (const l of linhas) {
  console.log(
    col(l.nome, 34) + col(l.tec, 14) + col(l.fases + 'F', 3) + col(l.kw, 6) + col(l.nMppts, 5) +
    col(l.imax, 6) + col(l.vmax, 6) + col(l.over + '×', 7) + col(l.aceita, 12) + l.motivo)
}

const aceitam = linhas.filter((l) => l.aceita !== '—')
const mono = linhas.filter((l) => l.fases === 1)
console.log(`\n── Resumo`)
console.log(`   inversores no catálogo:                 ${linhas.length}`)
console.log(`   aceitam os 24 módulos eletricamente:    ${aceitam.length}`)
console.log(`   monofásicos (compatíveis com a instalação): ${mono.length}`)
console.log(`   monofásicos QUE aceitam:                ${aceitam.filter((l) => l.fases === 1).length}`)
console.log(`   trifásicos que aceitam (exigiriam adequação): ${aceitam.filter((l) => l.fases === 3).length}`)
console.log(`\n   por tecnologia (aceitam): ${JSON.stringify(
  aceitam.reduce((a, l) => ({ ...a, [l.tec]: (a[l.tec] ?? 0) + 1 }), {}))}`)

console.log(`\n── Efeito do clima: UX atual (fallback 10/40) × UF informada (RN ${t.tmin}/${t.tmax})`)
let mudam = 0
for (const inv of inversores) {
  const a = melhorArranjo(inv, ELET_MOD, climaUX)
  const b = melhorArranjo(inv, ELET_MOD, climaUF)
  const ra = a.ok ? `${a.mpptsUsados}×${a.strings}×${a.mps}` : '—'
  const rb = b.ok ? `${b.mpptsUsados}×${b.strings}×${b.mps}` : '—'
  if (ra !== rb) { mudam++; console.log(`   ${inv.fabricante} ${inv.modelo}: ${ra} → ${rb}`) }
}
console.log(`   arranjos que MUDAM com o clima correto: ${mudam}`)

await mongoose.disconnect()
