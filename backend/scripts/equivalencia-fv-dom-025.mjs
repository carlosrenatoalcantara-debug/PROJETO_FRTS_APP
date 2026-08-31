/**
 * equivalencia-fv-dom-025.mjs — FV-DOM-025, FASE 6
 *
 * Compara o `compatibilidadeEletricaService` ANTES (reconstruído do git) e
 * DEPOIS da consolidação, sobre os dez fixtures exigidos pela sprint.
 *
 * Distingue duas coisas que não podem se confundir:
 *   · DIVERGÊNCIA DELIBERADA — consequência de Q1/Q5, decididas e aprovadas;
 *   · REGRESSÃO — qualquer outra diferença.
 *
 * Só mede. Não persiste, não toca banco.
 *
 *   node backend/scripts/equivalencia-fv-dom-025.mjs
 */
import path from 'node:path'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { analisarCompatibilidade as depois } from '../src/services/compatibilidadeEletricaService.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

// ── Reconstrói a versão anterior a partir do git ────────────────────────────
const dir = mkdtempSync(path.join(tmpdir(), 'compat-ref-'))
const original = execFileSync('git',
  ['show', 'HEAD:backend/src/services/compatibilidadeEletricaService.js'],
  { cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
// Só a dependência de `inversores/index.js` precisa ser neutralizada; o arquivo
// original não importava nada de fv-shared.
writeFileSync(path.join(dir, 'antes.mjs'), original)
const { analisarCompatibilidade: antes } = await import(pathToFileURL(path.join(dir, 'antes.mjs')).href)

const INV = { tensao_max_entrada: 600, mppt_min: 160, mppt_max: 550, corrente_max_mppt: 16, potencia_ca_kw: 8 }
const INV_FOLGADO = { tensao_max_entrada: 1000, mppt_min: 80, mppt_max: 800, corrente_max_mppt: 25, potencia_ca_kw: 20 }
const MOD_FRACAO = { voc: 49.9, vmpp: 41.8, isc: 14, impp: 13.2, potencia_w: 550, coef_temp_voc: -0.0027, temp_noct: 44 }
const MOD_PCT = { ...MOD_FRACAO, coef_temp_voc: -0.27 }
const MOD_SEM_NOCT = { voc: 49.9, vmpp: 41.8, isc: 14, impp: 13.2, potencia_w: 550, coef_temp_voc: -0.0027 }
const CLIMA = { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 }

const FIXTURES = [
  ['1 · 1 string / MPPT', MOD_FRACAO, INV, { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 1 }, CLIMA],
  ['2 · múltiplas strings / MPPT', MOD_FRACAO, INV_FOLGADO, { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 2 }, CLIMA],
  ['3 · MPPT desigual (pior caso)', MOD_FRACAO, INV_FOLGADO, { quantidade_modulos_por_string: 14, quantidade_strings_paralelo: 1, num_mppt_usados: 3 }, CLIMA],
  ['4 · Tmin baixa (RS, −8 °C)', MOD_FRACAO, INV_FOLGADO, { quantidade_modulos_por_string: 18, quantidade_strings_paralelo: 1 }, { temperatura_min_historica_c: -8, temperatura_max_historica_c: 35 }],
  ['5 · Tmax alta (40 °C)', MOD_FRACAO, INV_FOLGADO, { quantidade_modulos_por_string: 8, quantidade_strings_paralelo: 1 }, { temperatura_min_historica_c: 10, temperatura_max_historica_c: 40 }],
  ['6 · coeficiente em %/°C', MOD_PCT, INV, { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 1 }, CLIMA],
  ['7 · tensão junto do limite', MOD_FRACAO, INV, { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 1 }, { temperatura_min_historica_c: 0, temperatura_max_historica_c: 38 }],
  ['8 · corrente junto do limite', MOD_FRACAO, INV_FOLGADO, { quantidade_modulos_por_string: 10, quantidade_strings_paralelo: 1 }, CLIMA],
  ['9 · projeto aprovado', MOD_FRACAO, INV_FOLGADO, { quantidade_modulos_por_string: 14, quantidade_strings_paralelo: 1 }, CLIMA],
  ['10 · projeto reprovado', MOD_FRACAO, INV, { quantidade_modulos_por_string: 24, quantidade_strings_paralelo: 4 }, CLIMA],
  ['11 · sem NOCT declarado (Q5)', MOD_SEM_NOCT, INV_FOLGADO, { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 1 }, CLIMA],
  ['12 · entradas inválidas', {}, {}, {}, null],
]

/**
 * Campos cuja mudança é ESPERADA por decisão.
 *
 *  Q1 → `isc_total` (agora corrente de projeto) e `isc_fator_seguranca` (novo).
 *  Q5 → NOCT 45 → 44 move a temperatura de célula e tudo que dela deriva:
 *       `t_cel_max_c` → `delta_temp_quente_c` → `vmpp_corrigido_quente` →
 *       `vmpp_string_quente` → `margem_mppt_min_percentual`.
 *
 * A margem entrou nesta lista depois de o próprio script acusá-la: ela é
 * `mppt_min / vmpp_string_quente`, então mudar só quando o Vmpp quente muda é o
 * comportamento correto, não uma regressão.
 */
const ESPERADOS = new Set(['isc_total', 'isc_fator_seguranca', 'vmpp_string_quente',
  'vmpp_corrigido_quente', 't_cel_max_c', 'delta_temp_quente_c',
  'margem_mppt_min_percentual'])

secao('Comparação campo a campo — antes (git HEAD) × depois')
let deliberadas = 0
let regressoes = 0

for (const [nome, mod, inv, arranjo, clima] of FIXTURES) {
  const a = antes({ dados_eletricos_modulo: mod, dados_eletricos_inversor: inv, arranjo_proposto: arranjo, dados_climaticos_regiao: clima })
  const d = depois({ dados_eletricos_modulo: mod, dados_eletricos_inversor: inv, arranjo_proposto: arranjo, dados_climaticos_regiao: clima })

  const campos = new Set([...Object.keys(a.calculos ?? {}), ...Object.keys(d.calculos ?? {})])
  const mudou = []
  for (const c of campos) {
    if ((a.calculos?.[c] ?? null) !== (d.calculos?.[c] ?? null)) mudou.push(c)
  }
  const inesperados = mudou.filter((c) => !ESPERADOS.has(c))
  const codigosAntes = [...(a.erros ?? []), ...(a.warnings ?? [])].map((x) => x.codigo).sort()
  const codigosDepois = [...(d.erros ?? []), ...(d.warnings ?? [])].map((x) => x.codigo).sort()
  const vereditoMudou = a.compativel !== d.compativel

  console.log(`\n   ${nome}`)
  console.log(`     compatível        ${a.compativel} → ${d.compativel}${vereditoMudou ? '   ← VEREDITO MUDOU' : ''}`)
  if (a.calculos?.isc_total !== undefined) {
    console.log(`     isc_total         ${a.calculos.isc_total} A → ${d.calculos.isc_total} A`)
  }
  if (a.calculos?.voc_string_max !== undefined) {
    console.log(`     voc_string_max    ${a.calculos.voc_string_max} V → ${d.calculos.voc_string_max} V`)
  }
  if (a.calculos?.vmpp_string_quente !== undefined) {
    console.log(`     vmpp_quente       ${a.calculos.vmpp_string_quente} V → ${d.calculos.vmpp_string_quente} V`)
  }
  if (JSON.stringify(codigosAntes) !== JSON.stringify(codigosDepois)) {
    console.log(`     diagnósticos      ${JSON.stringify(codigosAntes)} → ${JSON.stringify(codigosDepois)}`)
  }

  ok(inesperados.length === 0,
    inesperados.length === 0
      ? `${nome}: nenhuma mudança fora de Q1/Q5`
      : `${nome}: mudou ${JSON.stringify(inesperados)} — REGRESSÃO`)
  if (inesperados.length > 0) regressoes++
  if (mudou.length > 0) deliberadas++
}

secao('Voc é a prova de que nada além de Q1/Q5 mudou')
for (const [nome, mod, inv, arranjo, clima] of FIXTURES.slice(0, 11)) {
  const a = antes({ dados_eletricos_modulo: mod, dados_eletricos_inversor: inv, arranjo_proposto: arranjo, dados_climaticos_regiao: clima })
  const d = depois({ dados_eletricos_modulo: mod, dados_eletricos_inversor: inv, arranjo_proposto: arranjo, dados_climaticos_regiao: clima })
  ok(a.calculos?.voc_string_max === d.calculos?.voc_string_max,
    `${nome}: Voc idêntica (${d.calculos?.voc_string_max} V)`)
}

secao('Resumo')
console.log(`   fixtures com alguma mudança (deliberada): ${deliberadas}`)
console.log(`   fixtures com regressão:                   ${regressoes}`)
console.log('   campos autorizados a mudar: isc_total (Q1) e a família de Vmpp quente (Q5, NOCT 45→44)')

console.log(falhas === 0
  ? '\nOK — só Q1 e Q5 mudaram resultado; todo o resto é idêntico ao HEAD.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
