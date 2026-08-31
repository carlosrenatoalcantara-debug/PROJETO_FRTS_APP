/**
 * auditoria-mppt-fv-ux-021.mjs — FV-UX-021, FASE 1/2
 *
 * Compara, sobre o MESMO projeto, o que `POST /api/dimensionamento/strings`
 * produz e o que o wizard (`ConfiguradorArranjoFV`) grava em
 * `engenharia_eletrica.arranjo.mppts[]`.
 *
 * Só mede. Não altera nada, não persiste nada.
 *
 *   node backend/scripts/auditoria-mppt-fv-ux-021.mjs
 */
import { montarStrings, extrairSpecsModulo, extrairSpecsInversor }
  from '../src/services/compatibilidadeFV.js'
import { calcularVocMaxString, calcularVmppMinString, calcularTemperaturas }
  from '@fortesolar/fv-shared/engenharia/normativa'

const linha = (t) => console.log(`\n── ${t}`)
const p = (k, v) => console.log(`   ${String(k).padEnd(34)} ${v}`)

/** Projeto realista: DAH 550 + Deye 8 kW, 23 módulos, Natal/RN. */
const MODULO_CAT = {
  fabricante: 'DAH', modelo: 'DHN-550',
  especificacoes: {
    potencia_w: 550, voc_v: 49.9, isc_a: 14.0, vmpp_v: 41.8, impp_a: 13.2,
    eficiencia_pct: 21.3, coef_temp_voc_pct_c: -0.27, numero_celulas: 144,
  },
}
const INVERSOR_CAT = {
  fabricante: 'Deye', modelo: 'SUN-8K-G03',
  especificacoes: {
    potencia: 8, potencia_kw: 8, fases: 3, tensao_max_entrada: 600,
    tensao_mppt_min: 160, tensao_mppt_max: 550, corrente_max_por_mppt: 16,
    n_mppts: 2, strings_por_mppt: 1,
  },
}
const QTD_MODULOS = 23
const UF = 'RN'

console.log('═══ FV-UX-021 · auditoria da topologia MPPT ═══')

// ── 1 · O que o endpoint /strings produz ────────────────────────────────────
linha('1 · POST /api/dimensionamento/strings → montarStrings')
const mod = extrairSpecsModulo(MODULO_CAT)
const inv = extrairSpecsInversor(INVERSOR_CAT)
p('módulo Voc / Vmpp / Isc', `${mod.voc} V / ${mod.vmpp} V / ${mod.isc} A`)
p('módulo coef_temp_voc lido', mod.coef_temp_voc)
p('inversor Voc max DC / MPPT', `${inv.voc_max_dc} V / ${inv.mppt_min_v}–${inv.mppt_max_v} V`)
p('inversor n_mppts', inv.n_mppts)

const r = montarStrings({ modulo: mod, inversor: inv, qtd_modulos_total: QTD_MODULOS })
p('ok', r.ok)
p('configuração', JSON.stringify(r.configuracao))
p('alertas', JSON.stringify(r.alertas.map((a) => a.codigo)))
p('devolve mppts[]?', Object.prototype.hasOwnProperty.call(r, 'mppts') ? 'sim' : 'NÃO')
p('devolve entradas[]?', JSON.stringify(r).includes('entradas') ? 'sim' : 'NÃO')

// ── 2 · Como cada motor corrige a Voc pelo frio ─────────────────────────────
linha('2 · Voc corrigida por temperatura — o coração da divergência')
// montarStrings: fator FIXO de 1.15, independente do local e do módulo.
const vocFrioEndpoint = mod.voc * 1.15
// Wizard: Tmin real do estado + coeficiente do próprio módulo.
const temps = calcularTemperaturas(UF)
const coefAbs = -0.0027   // -0,27 %/°C → fração por K (como o catálogo elétrico guarda)
const vocFrioWizard1 = calcularVocMaxString(mod.voc, 1, coefAbs, temps.tmin)
p('Tmin usada pelo wizard (RN)', `${temps.tmin} °C`)
p('Voc frio — /strings (fator 1.15)', `${vocFrioEndpoint.toFixed(2)} V`)
p('Voc frio — wizard (Tmin real)', `${vocFrioWizard1.toFixed(2)} V`)
p('diferença', `${(vocFrioEndpoint - vocFrioWizard1).toFixed(2)} V (${(((vocFrioEndpoint / vocFrioWizard1) - 1) * 100).toFixed(1)}%)`)

const serieEndpoint = Math.floor(inv.voc_max_dc / vocFrioEndpoint)
const serieWizard = Math.floor(inv.voc_max_dc / vocFrioWizard1)
p('máx. módulos em série — /strings', serieEndpoint)
p('máx. módulos em série — wizard', serieWizard)
p('DIVERGEM?', serieEndpoint !== serieWizard ? 'SIM' : 'não')

// ── 3 · Sensibilidade ao local ──────────────────────────────────────────────
linha('3 · O endpoint ignora o local; o wizard não')
for (const uf of ['RN', 'SP', 'RS']) {
  const t = calcularTemperaturas(uf)
  const v = calcularVocMaxString(mod.voc, 1, coefAbs, t.tmin)
  p(`${uf} — Tmin ${t.tmin} °C`,
    `wizard ${v.toFixed(2)} V → ${Math.floor(inv.voc_max_dc / v)} módulos | /strings ${vocFrioEndpoint.toFixed(2)} V → ${serieEndpoint} módulos`)
}

// ── 4 · Vmpp quente ─────────────────────────────────────────────────────────
linha('4 · Verificação de Vmpp a quente')
const vmppQuente = calcularVmppMinString(mod.vmpp, serieWizard, coefAbs, temps.tmax, 44)
p('wizard — Vmpp mín. da string', `${vmppQuente.toFixed(2)} V (mín. MPPT ${inv.mppt_min_v} V)`)
p('/strings — verifica Vmpp quente?', 'NÃO — só compara Vmpp STC com mppt_min_v')

// ── 5 · Forma do resultado ──────────────────────────────────────────────────
linha('5 · O que cada um entrega')
p('/strings', 'UMA configuração uniforme { n_modulos_serie, n_strings_paralelo }')
p('wizard / schema', 'mppts[] por MPPT: { mppt, strings_paralelo, modulos_por_string, total_modulos, entradas[] }')
p('/strings distribui entre MPPTs?', 'NÃO — assume 1 string por MPPT (n_paralelo <= n_mppts)')
p('/strings permite MPPT desigual?', 'NÃO')
p('/strings produz entradas físicas?', 'NÃO')

// ── 6 · Quantidade não divisível ────────────────────────────────────────────
linha('6 · 23 módulos (primo) — o caso do projeto realista')
p('resultado', JSON.stringify(r.configuracao))
p('alerta', r.alertas.map((a) => `${a.codigo}`).join(', ') || 'nenhum')
const total = r.configuracao
  ? r.configuracao.n_modulos_serie * r.configuracao.n_strings_paralelo + (r.configuracao.modulos_resto || 0)
  : null
p('total de módulos usados', `${total} de ${QTD_MODULOS}`)
p('sobra tratada como string?', 'NÃO — vira `modulos_resto`, sem string própria')

// ── 7 · Persistência ────────────────────────────────────────────────────────
linha('7 · Persistência')
p('/strings persiste?', 'NÃO — controller declara stateless')
p('caminho de gravação existente', "PUT /:id/etapa com etapa 'engenharia_eletrica'")
p('quem produz o payload hoje', 'ConfiguradorArranjoFV (wizard), 1108 linhas')

console.log('\n═══ CONCLUSÃO ═══')
console.log('Os dois motores NÃO são equivalentes: divergem na correção térmica da Voc,')
console.log('no limite de módulos em série, na verificação de Vmpp quente e na FORMA do')
console.log('resultado. O endpoint não produz `mppts[]` nem `entradas[]`.')
