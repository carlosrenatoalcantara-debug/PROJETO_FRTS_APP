/**
 * auditoria-normativa-fv-dom-023.mjs — FV-DOM-023, FASES 1/2/5
 *
 * Mede as três implementações elétricas vivas sobre as MESMAS fixtures e
 * quantifica o que cada alternativa muda.
 *
 * Só mede. Não altera código, schema, catálogo ou banco.
 *
 *   node backend/scripts/auditoria-normativa-fv-dom-023.mjs
 */
import { analisarCompatibilidade } from '../src/services/compatibilidadeEletricaService.js'
import { calcularVocMaxString, calcularVmppMinString, calcularIscMax }
  from '@fortesolar/fv-shared/engenharia/normativa'
import { REGRAS_MODULO } from '@fortesolar/fv-shared/engenharia/regras-plausibilidade'

const linha = (t) => console.log(`\n── ${t}`)
const p = (k, v) => console.log(`   ${String(k).padEnd(40)} ${v}`)
const tabela = (linhas) => {
  const larguras = linhas[0].map((_, i) => Math.max(...linhas.map((l) => String(l[i]).length)))
  for (const l of linhas) console.log('   ' + l.map((c, i) => String(c).padEnd(larguras[i])).join('  '))
}

// ── Réplicas FIÉIS das funções locais do ConfiguradorArranjoFV ──────────────
// Só para MEDIR. Nada daqui é promovido, nada é corrigido.
const coefVmppUI = (coefVoc) => coefVoc * 0.75
const vocFrioUI = (voc, coef, tmin) => voc * (1 + coef * (tmin - 25))
const vmppQuenteUI = (vmpp, coefVoc, tmax, tempNoct = 45) =>
  vmpp * (1 + coefVmppUI(coefVoc) * ((tmax + (tempNoct - 20) * (1000 / 800)) - 25))

/** Módulo real, como o catálogo o guarda: coeficiente em %/°C. */
const MOD_CAT = {
  voc: 49.9, vmpp: 41.8, isc: 14.0, impp: 13.2, potencia_w: 550,
  coef_temp_voc_pct_c: -0.27, temp_noct: 44,
}
const INV = {
  tensao_max_entrada: 600, mppt_min: 160, mppt_max: 550,
  corrente_max_mppt: 16, potencia_ca_kw: 8, n_mppts: 2,
}

const pctParaFracao = (v) => v / 100
const COEF_FRACAO = pctParaFracao(MOD_CAT.coef_temp_voc_pct_c)   // -0.0027

console.log('═══ FV-DOM-023 · inventário normativo e impacto ═══')

// ════════════════════════════════════════════════════════════════════════════
linha('FASE 2 · Unidade canônica do coeficiente no catálogo')
const regraCoef = REGRAS_MODULO.find((r) => r.campo === 'coef_temp_voc_pct_c')
p('campo canônico (catalogoQualidade)', 'coef_temp_voc_pct_c')
p('sufixo declara a unidade', '%/°C')
p('regra de plausibilidade', regraCoef ? regraCoef.codigo : '(não encontrada)')
p('faixa aceita', '[-0.5, -0.15] %/°C')
const forade = regraCoef?.valida?.({ coef_temp_voc_pct_c: -0.0027 })
p('valor em FRAÇÃO (-0.0027) passa?', forade?.ok === false ? 'NÃO — reprovado pela regra' : 'sim')
p('CONCLUSÃO', '%/°C é a unidade canônica do catálogo, e é validada')

// ════════════════════════════════════════════════════════════════════════════
linha('FASE 1 · Q1 — Isc e fator de segurança')
p('fv-shared (calcularIscMax)', 'Isc × 1.25 — cita NBR 16690 §5.2')
p('wizard (validarArranjo)', 'Isc × nStrings × 1.25 — cita NBR 16274')
p('backend (compatibilidadeEletricaService)', 'Isc × nStrings — SEM fator')
p('compatibilidadeFV (/strings)', 'Isc da string, sem paralelo e sem fator')
const iscShared = calcularIscMax(MOD_CAT.isc)
p('Isc de 1 módulo — fv-shared', `${iscShared} A`)
p('fonte normativa NO PROJETO', 'NBR 16690 §5.2, citada em fv-shared — pacote canônico')

// ════════════════════════════════════════════════════════════════════════════
linha('FASE 1 · Q2/Q3 — Correção térmica de Voc e Vmpp')
p('fv-shared Voc', 'n × Voc × [1 + coefAbs × (Tmin−25)], clamp fator ≥ 0.8 — NBR 16690 §5.1')
p('backend Voc', 'n × Voc × [1 + coefVoc × (Tmin−25)], sem clamp — IEC 61215')
p('wizard Voc', 'idem backend, sem clamp e SEM normalizar unidade')
p('fv-shared Vmpp', 'Tcel = Tmax + 1.25×(NOCT−20); usa o MESMO coefAbs de Voc; NOCT padrão 44')
p('backend Vmpp', 'idem; coefVmpp = coefVoc quando ausente; NOCT padrão 45')
p('wizard Vmpp', 'coefVmpp = coefVoc × 0.75; NOCT padrão 45')
p('origem do ×0.75', 'comentário do próprio código: "estimativa" — SEM norma citada')

// ════════════════════════════════════════════════════════════════════════════
linha('FASE 5 · Impacto — Voc frio (Tmin 14 °C, RN), por módulos em série')
tabela([
  ['n', 'fv-shared', 'backend', 'wizard(%/°C cru)', 'limite 600 V'],
  ...[10, 11, 12].map((n) => {
    const s = calcularVocMaxString(MOD_CAT.voc, n, COEF_FRACAO, 14)
    const b = analisarCompatibilidade({
      dados_eletricos_modulo: { ...MOD_CAT, coef_temp_voc: MOD_CAT.coef_temp_voc_pct_c },
      dados_eletricos_inversor: INV,
      arranjo_proposto: { quantidade_modulos_por_string: n, quantidade_strings_paralelo: 1, num_mppt_usados: 2 },
      dados_climaticos_regiao: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
    }).calculos?.voc_string_max
    const w = vocFrioUI(MOD_CAT.voc, MOD_CAT.coef_temp_voc_pct_c, 14) * n
    return [n, `${s} V`, `${b} V`, `${w.toFixed(0)} V`, s <= 600 ? 'ok' : 'EXCEDE']
  }),
])
p('leitura', 'fv-shared e backend concordam; o wizard erra por ~4× (unidade)')

// ════════════════════════════════════════════════════════════════════════════
linha('FASE 5 · Impacto — máximo de módulos em série por alternativa')
const maxSerie = (vocUnit) => Math.floor(INV.tensao_max_entrada / vocUnit)
const vocUnitShared = calcularVocMaxString(MOD_CAT.voc, 1, COEF_FRACAO, 14)
const vocUnitWizard = vocFrioUI(MOD_CAT.voc, MOD_CAT.coef_temp_voc_pct_c, 14)
tabela([
  ['Tmin', 'fv-shared/backend', 'wizard (coef cru)'],
  ...[-8, 2, 14].map((t) => [
    `${t} °C`,
    `${maxSerie(calcularVocMaxString(MOD_CAT.voc, 1, COEF_FRACAO, t))} módulos`,
    `${maxSerie(vocFrioUI(MOD_CAT.voc, MOD_CAT.coef_temp_voc_pct_c, t))} módulos`,
  ]),
])
p('impacto do erro de unidade', `${maxSerie(vocUnitShared)} → ${maxSerie(vocUnitWizard)} módulos por string`)

// ════════════════════════════════════════════════════════════════════════════
linha('FASE 5 · Impacto — Vmpp quente (Tmax 38 °C, 11 módulos)')
const vmppShared = calcularVmppMinString(MOD_CAT.vmpp, 11, COEF_FRACAO, 38, 44)
const vmppBackend = analisarCompatibilidade({
  dados_eletricos_modulo: { ...MOD_CAT, coef_temp_voc: MOD_CAT.coef_temp_voc_pct_c },
  dados_eletricos_inversor: INV,
  arranjo_proposto: { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 1, num_mppt_usados: 2 },
  dados_climaticos_regiao: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
}).calculos?.vmpp_string_quente
const vmppWizard = vmppQuenteUI(MOD_CAT.vmpp, COEF_FRACAO, 38, 44) * 11
tabela([
  ['implementação', 'Vmpp quente', 'coef usado', 'NOCT', 'vs mppt_min 160 V'],
  ['fv-shared', `${vmppShared} V`, 'coefVoc', '44', vmppShared >= 160 ? 'ok' : 'ABAIXO'],
  ['backend', `${vmppBackend} V`, 'coefVoc', '45', vmppBackend >= 160 ? 'ok' : 'ABAIXO'],
  ['wizard', `${vmppWizard.toFixed(2)} V`, 'coefVoc×0.75', '45', vmppWizard >= 160 ? 'ok' : 'ABAIXO'],
])
p('diferença fv-shared × wizard', `${(vmppWizard - vmppShared).toFixed(2)} V (${(((vmppWizard / vmppShared) - 1) * 100).toFixed(1)}%)`)
p('diferença fv-shared × backend', `${(vmppBackend - vmppShared).toFixed(2)} V — só o NOCT padrão (44 vs 45)`)

// ════════════════════════════════════════════════════════════════════════════
linha('FASE 5 · Impacto — Isc por MPPT (limite 16 A)')
tabela([
  ['strings', 'backend (×1.0)', 'wizard/fv-shared (×1.25)', 'veredito backend', 'veredito ×1.25'],
  ...[1, 2].map((n) => {
    const b = MOD_CAT.isc * n
    const w = MOD_CAT.isc * n * 1.25
    return [n, `${b.toFixed(2)} A`, `${w.toFixed(2)} A`,
      b > 16 ? 'EXCEDE' : 'ok', w > 16 ? 'EXCEDE' : 'ok']
  }),
])
p('caso decisivo', '1 string: backend aprova (14 A), ×1.25 reprova (17,5 A)')
p('consequência', 'o mesmo arranjo é seguro por um motor e inseguro pelo outro')

// ════════════════════════════════════════════════════════════════════════════
linha('FASE 5 · Impacto — critério de Vmpp mínimo')
p('backend bloqueia se', `Vmpp QUENTE (${vmppBackend} V) < mppt_min (160 V)`)
p('wizard bloqueia se', `Vmpp STC (${(MOD_CAT.vmpp * 11).toFixed(2)} V) < mppt_min (160 V)`)
p('qual é o pior caso físico?', 'o QUENTE — Vmpp cai com a temperatura')
p('fonte no projeto', 'NBR 16690 §5.1, citada em calcularVmppMinString (fv-shared)')

// ════════════════════════════════════════════════════════════════════════════
linha('FASE 5 · Casos-limite')
for (const [nome, args] of [
  ['string única (1 módulo)', [MOD_CAT.voc, 1, COEF_FRACAO, 14]],
  ['Tmin negativo (−8 °C, RS)', [MOD_CAT.voc, 11, COEF_FRACAO, -8]],
  ['Tmin positivo alto (25 °C)', [MOD_CAT.voc, 11, COEF_FRACAO, 25]],
  ['coeficiente ausente (0)', [MOD_CAT.voc, 11, 0, 14]],
]) {
  p(nome, `${calcularVocMaxString(...args)} V`)
}
const vazio = analisarCompatibilidade({
  dados_eletricos_modulo: {}, dados_eletricos_inversor: {},
  arranjo_proposto: {}, dados_climaticos_regiao: null,
})
p('projeto vazio — backend', `compativel=${vazio.compativel}, erro=${vazio.erros?.[0]?.codigo}`)
p('clima ausente — fallback', 'Tmin 10 / Tmax 40, com warning CLIMA_FALLBACK_APLICADO')

console.log('\n═══ FIM DA MEDIÇÃO ═══')
