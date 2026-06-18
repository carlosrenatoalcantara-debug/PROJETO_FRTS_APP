// P0-FV-CATALOG-QUALITY-RECAL-01 — DRY-RUN (NÃO grava no Atlas)
// Executa a derivação real + o motor de qualidade real sobre a lista de 122
// inversores sem specs (forense UNKNOWN_POWER_INVENTORY.json) e valida as 4
// tecnologias. Emite a matriz para FV_CATALOG_RECAL_METRICS/MATRIX.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { derivarInversorPorModelo } from '../src/services/catalogoDerivacaoModelo.js'
import { processarEquipamento, _internals as Q } from '../src/services/catalogoQualidade.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const inv = JSON.parse(readFileSync(join(__dirname, '../docs/UNKNOWN_POWER_INVENTORY.json'), 'utf8'))
const inversores = inv.inversores || []

function nivelDe(eq) { return processarEquipamento(eq).qualidade }

// ── FASE 3/6: derivação + qualidade sobre os 122 ───────────────────────────
const matriz = { derivavel: [], parcial: [], nao_derivavel: [] }
let promovidos = 0
let com_potencia = 0
for (const it of inversores) {
  const d = derivarInversorPorModelo({ fabricante: it.fabricante, modelo: it.modelo })
  if (d.especificacoes.potencia_kw != null) com_potencia++
  const antes = nivelDe({ tipo: 'inversor', fabricante: it.fabricante, modelo: it.modelo,
    origem: { tipo: 'import_solarmarket' }, especificacoes: {} })
  // Origem mantida = import_solarmarket (identidade SolarMarket preservada; só specs derivadas)
  const depois = nivelDe({ tipo: 'inversor', fabricante: it.fabricante, modelo: it.modelo,
    origem: { tipo: 'import_solarmarket' }, especificacoes: d.especificacoes })
  if (depois.score_global > antes.score_global && d.campos_derivados.length) promovidos++
  const row = { fabricante: it.fabricante, modelo: it.modelo, potencia_kw: d.especificacoes.potencia_kw ?? null,
    metodo: d.metodo_potencia, tecnologia: d.tecnologia, nivel_antes: antes.nivel, nivel_depois: depois.nivel,
    score_antes: antes.score_global, score_depois: depois.score_global }
  matriz[d.categoria].push(row)
}

// Cross-check vs estimativa da forense
let concord = 0, diverg = []
for (const it of inversores) {
  const d = derivarPot(it.modelo)
  const est = it.potencia_kw_estimada_pelo_nome ?? null
  if (it.potencia_derivavel_do_nome) {
    if (d === est) concord++
    else if (d !== null) diverg.push({ modelo: it.modelo, forense: est, derivado: d })
  }
}
function derivarPot(m) { const r = derivarInversorPorModelo({ modelo: m }); return r.especificacoes.potencia_kw ?? null }

// ── FASE 4: Goodwe GW8000-DT ───────────────────────────────────────────────
const goodwe = derivarInversorPorModelo({ fabricante: 'Goodwe', modelo: 'GW8000-DT' })

// ── FASE 5: qualidade por tecnologia (sem falso-positivo crítico) ──────────
const fixtures = {
  string: { tipo: 'inversor', fabricante: 'Growatt', modelo: 'MID 25KTL3-X', origem: { tipo: 'datasheet_gemini' },
    especificacoes: { potencia_kw: 25, voc_max_dc: 1100, mppt_min: 200, mppt_max: 1000, n_mppts: 2, fases: 3, tensao_ac: 380, eficiencia_maxima: 98.6, isc_max_mppt: 30 } },
  // micro com MPPT_max == Voc_max (datasheet legítimo) — não pode dar crítico
  micro: { tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2000DW-4T', origem: { tipo: 'datasheet_gemini' },
    especificacoes: { potencia_kw: 2, voc_max_dc: 60, mppt_min: 16, mppt_max: 60, n_mppts: 2, fases: 1, tensao_ac: 220, eficiencia_maxima: 96.7, isc_max_mppt: 14 } },
  otimizador: { tipo: 'inversor', fabricante: 'Solaredge', modelo: 'SE 27.6K', origem: { tipo: 'datasheet_gemini' },
    especificacoes: { potencia_kw: 27.6, voc_max_dc: 1000, mppt_min: 200, mppt_max: 950, n_mppts: 1, fases: 3, tensao_ac: 380, eficiencia_maxima: 98, isc_max_mppt: 25 } },
  hibrido: { tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN-8K-SG01LP1-EU', origem: { tipo: 'datasheet_gemini' },
    especificacoes: { potencia_kw: 8, voc_max_dc: 800, mppt_min: 120, mppt_max: 800, n_mppts: 2, fases: 1, tensao_ac: 220, eficiencia_maxima: 97.6, isc_max_mppt: 26 } },
}
const fase5 = {}
for (const [tec, eq] of Object.entries(fixtures)) {
  const q = nivelDe(eq)
  const criticos = q.alertas.filter(a => a.severidade === 'critico').map(a => a.codigo)
  fase5[tec] = { nivel: q.nivel, score: q.score_global, criticos }
}

// ── Recalibração: efeito do import_solarmarket vs antigo desconhecido ──────
const conf_solarmarket = Q.calcularConfianca({ tipo: 'import_solarmarket' }, [], null)
const conf_desconhecido = Q.calcularConfianca({ tipo: 'desconhecido' }, [], null)
const conf_derivado = Q.calcularConfianca({ tipo: 'derivado_modelo' }, [], null)
// item SolarMarket com specs completas (completude alta) — antes travava em ~52
const completo = nivelDe({ tipo: 'inversor', fabricante: 'Growatt', modelo: 'MID 25KTL3-X', origem: { tipo: 'import_solarmarket' },
  especificacoes: { potencia_kw: 25, voc_max_dc: 1100, mppt_min: 200, mppt_max: 1000, n_mppts: 2, fases: 3, tensao_ac: 380, eficiencia_maxima: 98.6, isc_max_mppt: 30 } })

const out = {
  total: inversores.length,
  matriz_contagem: { derivavel: matriz.derivavel.length, parcial: matriz.parcial.length, nao_derivavel: matriz.nao_derivavel.length },
  com_potencia_derivada: com_potencia,
  itens_com_score_melhorado: promovidos,
  crosscheck_forense: { concordancia: concord, divergencias: diverg },
  goodwe_gw8000dt: goodwe,
  fase5_por_tecnologia: fase5,
  recalibracao: {
    confianca_import_solarmarket: conf_solarmarket,
    confianca_desconhecido_antigo: conf_desconhecido,
    confianca_derivado_modelo: conf_derivado,
    item_solarmarket_completo_nivel: completo.nivel,
    item_solarmarket_completo_score: completo.score_global,
  },
  matriz,
}
writeFileSync(join(__dirname, '../docs/_recal_dryrun_out.json'), JSON.stringify(out, null, 2))

// Resumo no stdout
console.log('=== FASE 3/6 — derivação sobre', inversores.length, 'inversores ===')
console.log('derivável (kW):', matriz.derivavel.length, '| parcial (watts):', matriz.parcial.length, '| não derivável:', matriz.nao_derivavel.length)
console.log('com potência derivada:', com_potencia, '/', inversores.length, '| itens com score melhorado:', promovidos)
console.log('crosscheck forense — concordância:', concord, '| divergências:', diverg.length, diverg.slice(0, 5))
console.log('\n=== FASE 4 — Goodwe GW8000-DT ===')
console.log(JSON.stringify(goodwe))
console.log('\n=== FASE 5 — qualidade por tecnologia (críticos devem ser []) ===')
for (const [t, r] of Object.entries(fase5)) console.log(t.padEnd(11), '→ nivel:', r.nivel, '| score:', r.score, '| criticos:', JSON.stringify(r.criticos))
console.log('\n=== Recalibração confiança ===')
console.log('import_solarmarket:', conf_solarmarket, '(antes caía em desconhecido =', conf_desconhecido, ') | derivado_modelo:', conf_derivado)
console.log('item SolarMarket COMPLETO →', completo.nivel, 'score', completo.score_global, '(antes ~52/incompleto com confiança 20)')
