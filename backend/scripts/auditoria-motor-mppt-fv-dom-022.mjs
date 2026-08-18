/**
 * auditoria-motor-mppt-fv-dom-022.mjs — FV-DOM-022, FASE 1
 *
 * A sprint pede para PROMOVER "o motor do wizard" que produz
 * `engenharia_eletrica.arranjo.mppts[]`.
 *
 * Este script verifica a premissa antes de mover qualquer coisa:
 *   a) existe um motor que PRODUZ `mppts[]`?
 *   b) a validação elétrica do wizard é uma implementação só?
 *
 * Só mede. Não altera nada, não persiste nada.
 *
 *   node backend/scripts/auditoria-motor-mppt-fv-dom-022.mjs
 */
import { analisarCompatibilidade } from '../src/services/compatibilidadeEletricaService.js'

const linha = (t) => console.log(`\n── ${t}`)
const p = (k, v) => console.log(`   ${String(k).padEnd(38)} ${v}`)

// ── Réplica FIEL das funções locais do ConfiguradorArranjoFV ────────────────
// Copiadas do arquivo apenas para MEDIR a divergência. Nada daqui é promovido.
const coefVmppUI = (coefVoc) => coefVoc * 0.75
const vocFrioUI = (voc, coef, tmin) => voc * (1 + coef * (tmin - 25))
const vmppQuenteUI = (vmpp, coefVoc, tmax, tempNoct = 45) => {
  const tcelMax = tmax + (tempNoct - 20) * (1000 / 800)
  return vmpp * (1 + coefVmppUI(coefVoc) * (tcelMax - 25))
}
/** `sugerirMPPTs` do wizard, verbatim. */
function sugerirMPPTs(numPaineis, nMppts) {
  if (!numPaineis || numPaineis <= 0 || !nMppts) return Array(1).fill({ numStrings: 1, modulosPorString: 8 })
  const modsPorStr = Math.min(14, Math.max(6, Math.ceil(numPaineis / Math.max(nMppts, 1) / 1.5)))
  const stringsTotal = Math.ceil(numPaineis / modsPorStr)
  const stringsBase = Math.floor(stringsTotal / nMppts)
  const resto = stringsTotal - stringsBase * nMppts
  return Array.from({ length: nMppts }, (_, i) => ({
    numStrings: stringsBase + (i < resto ? 1 : 0),
    modulosPorString: modsPorStr,
  }))
}

const MOD = {
  voc: 49.9, vmpp: 41.8, isc: 14.0, impp: 13.2, potencia_w: 550,
  coef_temp_voc: -0.0027, temp_noct: 44,
}
const INV = {
  tensao_max_entrada: 600, mppt_min: 160, mppt_max: 550,
  corrente_max_mppt: 16, potencia_ca_kw: 8, n_mppts: 2, oversizing_max: 1.30,
}
const CLIMA = { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 }

console.log('═══ FV-DOM-022 · auditoria do "motor do wizard" ═══')

// ── 1 · Existe motor que produz mppts[]? ────────────────────────────────────
linha('1 · Quem produz `arranjo.mppts[]`')
p('sugerirMPPTs(23, 2)', JSON.stringify(sugerirMPPTs(23, 2)))
p('   é sugestão INICIAL de UI?', 'sim — `useState(() => sugerirMPPTs(...))`')
p('   o usuário edita depois?', 'sim — setMpptField / setModulosPorStringGlobal / editor')
p('constantes da heurística', '14 (máx mód/string), 6 (mín), 1.5 (divisor) — sem origem normativa')
p('modo detalhado', 'topologia2 (entradas[].strings[]) é 100% autoral do usuário')
p('mppts[] final vem de', 'ESTADO DE EDIÇÃO, não de função de engenharia')

// ── 2 · A validação elétrica é uma só? ──────────────────────────────────────
linha('2 · Duas validações elétricas vivas, ambas persistidas')
const nStrings = 2, mps = 11
const backend = analisarCompatibilidade({
  dados_eletricos_modulo: MOD,
  dados_eletricos_inversor: INV,
  arranjo_proposto: { quantidade_modulos_por_string: mps, quantidade_strings_paralelo: nStrings, num_mppt_usados: 2 },
  dados_climaticos_regiao: CLIMA,
})
const c = backend.calculos ?? {}
p('BACKEND — voc_string_max', `${c.voc_string_max} V`)
p('BACKEND — vmpp_string_quente', `${c.vmpp_string_quente} V`)
p('BACKEND — isc_total', `${c.isc_total} A`)
p('BACKEND — fator_oversizing', c.fator_oversizing)
p('BACKEND — compatível', backend.compativel)

const vocUI = vocFrioUI(MOD.voc, MOD.coef_temp_voc, CLIMA.temperatura_min_historica_c) * mps
const vmppQuenteUIv = vmppQuenteUI(MOD.vmpp, MOD.coef_temp_voc, CLIMA.temperatura_max_historica_c, MOD.temp_noct) * mps
const iscUI = MOD.isc * nStrings * 1.25
p('WIZARD (local) — Voc frio string', `${vocUI.toFixed(2)} V`)
p('WIZARD (local) — Vmpp quente', `${vmppQuenteUIv.toFixed(2)} V`)
p('WIZARD (local) — Isc total (fs 1,25)', `${iscUI.toFixed(2)} A`)

linha('3 · Onde divergem')
p('Isc — backend', `isc × strings = ${c.isc_total} A`)
p('Isc — wizard', `isc × strings × 1,25 = ${iscUI.toFixed(2)} A`)
p('DIVERGEM?', c.isc_total !== Number(iscUI.toFixed(3)) ? 'SIM' : 'não')
p('limite do MPPT', `${INV.corrente_max_mppt} A`)
p('veredito backend (Isc)', c.isc_total > INV.corrente_max_mppt ? 'EXCEDE' : 'ok')
p('veredito wizard (Isc)', iscUI > INV.corrente_max_mppt ? 'EXCEDE' : 'ok')
p('CONCLUSÃO', c.isc_total <= INV.corrente_max_mppt && iscUI > INV.corrente_max_mppt
  ? 'os dois discordam sobre o MESMO arranjo'
  : 'mesmo veredito neste caso')

linha('4 · Critério de Vmpp mínimo')
p('backend bloqueia quando', 'vmpp_string_QUENTE < mppt_min')
p('wizard bloqueia quando', 'vmpp_string_STC < mppt_min')
p('vmpp STC × mps', `${(MOD.vmpp * mps).toFixed(2)} V`)
p('vmpp quente × mps', `${vmppQuenteUIv.toFixed(2)} V`)
p('mesma grandeza?', 'NÃO — um usa STC, o outro a temperatura de célula')

linha('5 · Coeficiente térmico')
p('backend', 'normalizarCoefTemp: |coef| > 0.1 → /100 (aceita %/°C e 1/°C)')
p('wizard local', 'usa o coeficiente CRU, sem normalizar')
const coefPct = -0.27   // como o catálogo Equipamento guarda (%/°C)
p(`com coef ${coefPct} (%/°C) — backend`,
  `${(MOD.voc * (1 + (Math.abs(coefPct) > 0.1 ? coefPct / 100 : coefPct) * (14 - 25))).toFixed(2)} V`)
p(`com coef ${coefPct} (%/°C) — wizard`,
  `${vocFrioUI(MOD.voc, coefPct, 14).toFixed(2)} V`)
p('DIVERGEM?', 'SIM — o wizard trata %/°C como fração e explode a correção')

linha('6 · Onde cada resultado é gravado')
p('backend → compatibilidade.diagnosticos', 'sim (erros + warnings da API)')
p('wizard → compatibilidade.validacoes_locais', 'sim (bloqueios + avisos locais)')
p('convivem no mesmo documento?', 'SIM — dois pareceres, possivelmente contraditórios')

console.log('\n═══ CONCLUSÃO ═══')
console.log('Não existe "o motor do wizard" a promover:')
console.log(' • `mppts[]` é AUTORADO pelo usuário — sugerirMPPTs é semente de UI, não engenharia;')
console.log(' • a análise elétrica JÁ vive no backend (compatibilidadeEletricaService);')
console.log(' • o wizard mantém uma SEGUNDA validação local que diverge da primeira;')
console.log(' • as duas são persistidas lado a lado no mesmo subdocumento.')
