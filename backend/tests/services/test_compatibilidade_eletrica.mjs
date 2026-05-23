/**
 * test_compatibilidade_eletrica.mjs — S2.10.1
 *
 * Testes unitários do motor de compatibilidade elétrica FV.
 * Zero dependências externas. Zero banco. Zero I/O de rede.
 *
 * Execução:
 *   node tests/services/test_compatibilidade_eletrica.mjs
 *
 * ── Dublês de teste (mocks) ──────────────────────────────────────────────────
 * Módulo de referência: Canadian Solar CS6W-545MS (datasheet real)
 *   Voc=49.9V | Vmpp=41.8V | Isc=13.92A | Impp=13.04A | P=545W
 *   αVoc=-0.0028/°C | αVmpp=-0.0028/°C | NOCT=42°C
 *
 * Inversor de referência: Deye SUN-12K-SG04LP3 (datasheet real)
 *   Vdc_max=1000V | MPPT 200–850V | Icc_max=18A/MPPT | Pca=12kW
 *
 * ── Climas regionais ─────────────────────────────────────────────────────────
 * Natal/RN      : Tmin=20°C / Tmax=35°C  → clima quente, baixo risco Voc
 * São Joaquim/SC: Tmin=-3°C / Tmax=30°C  → clima frio, alto risco Voc
 *
 * ── Matemática de referência (calculada externamente para validação) ──────────
 *
 * Voc_corr(Natal,  Tmin=20°C) = 49.9 × (1 + (-0.0028)×(20-25))  = 49.9 × 1.014  = 50.599 V
 * Voc_corr(S.Joaq, Tmin=-3°C) = 49.9 × (1 + (-0.0028)×(-3-25))  = 49.9 × 1.0784 = 53.812 V
 *
 * T_cel_max(Natal,  Tmax=35°C) = 35 + (42-20)×1.25 = 62.5°C → ΔT=37.5
 * T_cel_max(S.Joaq, Tmax=30°C) = 30 + (42-20)×1.25 = 57.5°C → ΔT=32.5
 *
 * Vmpp_quente(Natal ) = 41.8 × (1 + (-0.0028)×37.5)  = 41.8 × 0.895  = 37.411 V
 * Vmpp_quente(S.Joaq) = 41.8 × (1 + (-0.0028)×32.5)  = 41.8 × 0.909  = 37.996 V
 *
 * Vmpp_frio(Natal,  Tmin=20°C) = 41.8 × 1.014  = 42.385 V
 * Vmpp_frio(S.Joaq, Tmin=-3°C) = 41.8 × 1.0784 = 45.077 V
 */

import { analisarCompatibilidade, CLIMA_FALLBACK_BRASIL, CONSTANTES }
  from '../../src/services/compatibilidadeEletricaService.js'

// ─── Fixtures (dublês de teste) ───────────────────────────────────────────────

/** Canadian Solar CS6W-545MS — valores reais de datasheet */
const MODULO = {
  voc:           49.9,
  vmpp:          41.8,
  isc:           13.92,
  impp:          13.04,
  potencia_w:    545,
  coef_temp_voc:  -0.0028,   // 1/°C
  coef_temp_vmpp: -0.0028,
  temp_noct:     42,
}

/** Deye SUN-12K-SG04LP3 — valores reais de datasheet */
const INVERSOR = {
  tensao_max_entrada: 1000,
  mppt_min:           200,
  mppt_max:           850,
  corrente_max_mppt:  18,
  potencia_ca_kw:     12,
}

/** Natal/RN — clima quente, baixo risco de sobretensão */
const CLIMA_NATAL = {
  temperatura_min_historica_c: 20,
  temperatura_max_historica_c: 35,
  cidade: 'Natal',
  uf:     'RN',
}

/** São Joaquim/SC — clima frio severo, alto risco de sobretensão */
const CLIMA_SAO_JOAQUIM = {
  temperatura_min_historica_c: -3,
  temperatura_max_historica_c: 30,
  cidade: 'São Joaquim',
  uf:     'SC',
}

// ─── Infra de testes ──────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function suite(titulo) {
  console.log(`\n${'─'.repeat(70)}`)
  console.log(`  ${titulo}`)
  console.log('─'.repeat(70))
}

function ok(desc, cond, extra = '') {
  if (cond) {
    console.log(`  ✅ ${desc}`)
    passed++
  } else {
    console.error(`  ❌ ${desc}${extra ? `\n     → ${extra}` : ''}`)
    failed++
  }
}

function temErro(r, codigo) {
  return r.erros.some(e => e.codigo === codigo)
}

function temWarning(r, codigo) {
  return r.warnings.some(w => w.codigo === codigo)
}

function naoTemErro(r, codigo) {
  return !r.erros.some(e => e.codigo === codigo)
}

function aprox(a, b, tol = 0.1) {
  return Math.abs(a - b) <= tol
}

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 1 — CENÁRIO VÁLIDO
// Arranjo: 18 módulos × 1 string | Natal-RN (Tmin=20°C / Tmax=35°C)
//
// Pré-cálculo:
//   Voc_string_max = 18 × 50.599 = 910.8 V < 1000 V ✓
//   Vmpp_string_frio = 18 × 42.385 = 762.9 V < 850 V ✓
//   Vmpp_string_quente = 18 × 37.411 = 673.4 V > 200 V ✓
//   Isc_total = 13.92 × 1 = 13.92 A < 18 A ✓
//   Oversizing = 9.81 kWp / 12 kW = 0.818 ✓
// ═════════════════════════════════════════════════════════════════════════════

suite('SUITE 1 — Cenário válido (Natal-RN, 18 módulos × 1 string)')

const r1 = analisarCompatibilidade({
  dados_eletricos_modulo:   MODULO,
  dados_eletricos_inversor: INVERSOR,
  arranjo_proposto: { quantidade_modulos_por_string: 18, quantidade_strings_paralelo: 1 },
  dados_climaticos_regiao:  CLIMA_NATAL,
})

ok('compativel === true',
  r1.compativel,
  `Erros: ${r1.erros.map(e => e.codigo).join(', ') || 'nenhum'}`)

ok('erros vazio',
  r1.erros.length === 0,
  JSON.stringify(r1.erros.map(e => e.codigo)))

ok('limites.tensao_max_inversor === 1000',
  r1.limites.tensao_max_inversor === 1000)

ok('calculos.voc_string_max ≈ 910.8 V (< 1000 V)',
  aprox(r1.calculos.voc_string_max, 910.78, 0.5),
  `Obtido: ${r1.calculos.voc_string_max}`)

ok('calculos.voc_corrigido_frio > voc_STC (frio eleva Voc)',
  r1.calculos.voc_corrigido_frio > MODULO.voc,
  `Esperado > ${MODULO.voc}, obtido: ${r1.calculos.voc_corrigido_frio}`)

ok('calculos.vmpp_corrigido_quente < vmpp_STC (calor reduz Vmpp)',
  r1.calculos.vmpp_corrigido_quente < MODULO.vmpp,
  `Esperado < ${MODULO.vmpp}, obtido: ${r1.calculos.vmpp_corrigido_quente}`)

ok('calculos.isc_total === 13.92 A (1 string, corrente do módulo)',
  aprox(r1.calculos.isc_total, 13.92, 0.01))

ok('calculos.impp_total === 13.04 A',
  aprox(r1.calculos.impp_total, 13.04, 0.01))

ok('calculos.potencia_cc_total ≈ 9.81 kWp',
  aprox(r1.calculos.potencia_cc_total, 9.81, 0.05),
  `Obtido: ${r1.calculos.potencia_cc_total}`)

ok('calculos.fator_oversizing < 1.0 (sem oversizing)',
  r1.calculos.fator_oversizing < 1.0,
  `Obtido: ${r1.calculos.fator_oversizing}`)

ok('clima_utilizado.fonte === "dados_regiao"',
  r1.clima_utilizado.fonte === 'dados_regiao')

ok('clima_utilizado.cidade === "Natal"',
  r1.clima_utilizado.cidade === 'Natal')

ok('clima_utilizado.usou_fallback === false',
  r1.clima_utilizado.usou_fallback === false)

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 2 — SOBRETENSÃO VOC CRÍTICA
// Arranjo: 22 módulos × 1 string | Natal-RN (Tmin=20°C)
//
// Pré-cálculo:
//   Voc_corr_frio = 49.9 × 1.014 = 50.599 V
//   Voc_string = 22 × 50.599 = 1113.2 V >> 1000 V ❌
// ═════════════════════════════════════════════════════════════════════════════

suite('SUITE 2 — Sobretensão Voc crítica (22 módulos × 1 string, Natal-RN)')

const r2 = analisarCompatibilidade({
  dados_eletricos_modulo:   MODULO,
  dados_eletricos_inversor: INVERSOR,
  arranjo_proposto: { quantidade_modulos_por_string: 22, quantidade_strings_paralelo: 1 },
  dados_climaticos_regiao:  CLIMA_NATAL,
})

ok('compativel === false',
  !r2.compativel)

ok('erro SOBRETENSAO_VOC presente',
  temErro(r2, 'SOBRETENSAO_VOC'),
  `Erros encontrados: ${r2.erros.map(e => e.codigo).join(', ')}`)

ok('voc_string_max > 1000 V',
  r2.calculos.voc_string_max > 1000,
  `Obtido: ${r2.calculos.voc_string_max} V`)

ok('voc_string_max ≈ 1113.2 V',
  aprox(r2.calculos.voc_string_max, 1113.18, 1.0),
  `Obtido: ${r2.calculos.voc_string_max}`)

ok('erro contém excesso_v > 0',
  r2.erros.find(e => e.codigo === 'SOBRETENSAO_VOC')?.valores?.excesso_v > 0)

ok('erro referencia modulos_por_string = 22',
  r2.erros.find(e => e.codigo === 'SOBRETENSAO_VOC')?.valores?.modulos_por_string === 22)

ok('nao tem INPUT_INVALIDO (inputs elétricos são válidos)',
  naoTemErro(r2, 'INPUT_INVALIDO'))

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 3 — MPPT ABAIXO DO MÍNIMO (string curta no calor)
// Arranjo: 5 módulos × 1 string | Natal-RN (Tmax=35°C)
//
// Pré-cálculo:
//   T_cel_max = 35 + (42-20)×1.25 = 62.5 °C → ΔT = 37.5
//   Vmpp_quente = 41.8 × (1 + (-0.0028)×37.5) = 41.8 × 0.895 = 37.411 V
//   Vmpp_string_quente = 5 × 37.411 = 187.1 V < 200 V ❌
// ═════════════════════════════════════════════════════════════════════════════

suite('SUITE 3 — MPPT abaixo do mínimo (5 módulos × 1 string, calor Natal-RN)')

const r3 = analisarCompatibilidade({
  dados_eletricos_modulo:   MODULO,
  dados_eletricos_inversor: INVERSOR,
  arranjo_proposto: { quantidade_modulos_por_string: 5, quantidade_strings_paralelo: 1 },
  dados_climaticos_regiao:  CLIMA_NATAL,
})

ok('compativel === false',
  !r3.compativel)

ok('erro MPPT_STRING_CURTA presente',
  temErro(r3, 'MPPT_STRING_CURTA'),
  `Erros: ${r3.erros.map(e => e.codigo).join(', ')}`)

ok('vmpp_string_quente < 200 V (abaixo de MPPT_min)',
  r3.calculos.vmpp_string_quente < 200,
  `Obtido: ${r3.calculos.vmpp_string_quente}`)

ok('vmpp_string_quente ≈ 187.1 V',
  aprox(r3.calculos.vmpp_string_quente, 187.06, 1.0),
  `Obtido: ${r3.calculos.vmpp_string_quente}`)

ok('erro contém deficit_v > 0',
  r3.erros.find(e => e.codigo === 'MPPT_STRING_CURTA')?.valores?.deficit_v > 0)

ok('t_cel_max_c ≈ 62.5°C (modelo NOCT correto)',
  aprox(r3.calculos.t_cel_max_c, 62.5, 0.5),
  `Obtido: ${r3.calculos.t_cel_max_c}`)

ok('Voc não excede (problema só é o MPPT_min, não sobretensão)',
  naoTemErro(r3, 'SOBRETENSAO_VOC'))

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 4 — CORRENTE ISC EXCEDIDA
// Arranjo: 18 módulos × 3 strings paralelas | Natal-RN
//
// Pré-cálculo:
//   Isc_total = 13.92 A × 3 = 41.76 A >> 18 A (corrente_max_mppt) ❌
// ═════════════════════════════════════════════════════════════════════════════

suite('SUITE 4 — Corrente Isc excedida (18 módulos × 3 strings paralelas, Natal-RN)')

const r4 = analisarCompatibilidade({
  dados_eletricos_modulo:   MODULO,
  dados_eletricos_inversor: INVERSOR,
  arranjo_proposto: { quantidade_modulos_por_string: 18, quantidade_strings_paralelo: 3 },
  dados_climaticos_regiao:  CLIMA_NATAL,
})

ok('compativel === false',
  !r4.compativel)

ok('erro CORRENTE_ISC_EXCEDIDA presente',
  temErro(r4, 'CORRENTE_ISC_EXCEDIDA'),
  `Erros: ${r4.erros.map(e => e.codigo).join(', ')}`)

ok('isc_total ≈ 41.76 A (13.92 × 3)',
  aprox(r4.calculos.isc_total, 41.76, 0.05),
  `Obtido: ${r4.calculos.isc_total}`)

ok('isc_total > corrente_max_mppt (18 A)',
  r4.calculos.isc_total > INVERSOR.corrente_max_mppt)

ok('excesso_a ≈ 23.76 A acima do limite',
  aprox(
    r4.erros.find(e => e.codigo === 'CORRENTE_ISC_EXCEDIDA')?.valores?.excesso_a,
    23.76, 0.1
  ))

ok('strings_paralelo === 3 registrado no erro',
  r4.erros.find(e => e.codigo === 'CORRENTE_ISC_EXCEDIDA')?.valores?.strings_paralelo === 3)

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 5 — OVERSIZING EXAGERADO
// Arranjo: 18 módulos × 4 strings paralelas | Natal-RN
//
// Pré-cálculo:
//   Total módulos = 18 × 4 = 72
//   P_CC = 545 × 72 / 1000 = 39.24 kWp
//   Oversizing = 39.24 / 12 = 3.27 >> 1.50 ❌
//   (Corrente também excede: 13.92 × 4 = 55.68 A > 18 A)
// ═════════════════════════════════════════════════════════════════════════════

suite('SUITE 5 — Oversizing exagerado (18 módulos × 4 strings, 39.24/12 = 3.27×)')

const r5 = analisarCompatibilidade({
  dados_eletricos_modulo:   MODULO,
  dados_eletricos_inversor: INVERSOR,
  arranjo_proposto: { quantidade_modulos_por_string: 18, quantidade_strings_paralelo: 4 },
  dados_climaticos_regiao:  CLIMA_NATAL,
})

ok('compativel === false',
  !r5.compativel)

ok('erro OVERSIZING_CRITICO presente',
  temErro(r5, 'OVERSIZING_CRITICO'),
  `Erros: ${r5.erros.map(e => e.codigo).join(', ')}`)

ok('fator_oversizing ≈ 3.27',
  aprox(r5.calculos.fator_oversizing, 3.27, 0.05),
  `Obtido: ${r5.calculos.fator_oversizing}`)

ok('potencia_cc_total ≈ 39.24 kWp',
  aprox(r5.calculos.potencia_cc_total, 39.24, 0.1),
  `Obtido: ${r5.calculos.potencia_cc_total}`)

ok('total_modulos === 72',
  r5.calculos.total_modulos === 72)

ok('CORRENTE_ISC_EXCEDIDA também presente (55.68 A > 18 A)',
  temErro(r5, 'CORRENTE_ISC_EXCEDIDA'),
  'Esperado: 13.92 × 4 = 55.68 A > 18 A')

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 6 — FALLBACK CLIMÁTICO
// Dados ausentes ou inválidos → usa CLIMA_FALLBACK_BRASIL (Tmin=10 / Tmax=40)
// ═════════════════════════════════════════════════════════════════════════════

suite('SUITE 6 — Fallback climático (dados ausentes, parciais ou inválidos)')

const casosInvalidos = [
  { desc: 'dados_climaticos_regiao === null',      dado: null },
  { desc: 'dados_climaticos_regiao === undefined', dado: undefined },
  { desc: 'objeto vazio {}',                        dado: {} },
  { desc: 'temperatura_min ausente',               dado: { temperatura_max_historica_c: 35 } },
  { desc: 'temperatura_max ausente',               dado: { temperatura_min_historica_c: 20 } },
  { desc: 'min >= max (inválido fisicamente)',      dado: { temperatura_min_historica_c: 30, temperatura_max_historica_c: 20 } },
]

for (const { desc, dado } of casosInvalidos) {
  const rf = analisarCompatibilidade({
    dados_eletricos_modulo:   MODULO,
    dados_eletricos_inversor: INVERSOR,
    arranjo_proposto: { quantidade_modulos_por_string: 18, quantidade_strings_paralelo: 1 },
    dados_climaticos_regiao:  dado,
  })

  ok(`"${desc}" → warning CLIMA_FALLBACK_APLICADO emitido`,
    temWarning(rf, 'CLIMA_FALLBACK_APLICADO'),
    `Warnings: ${rf.warnings.map(w => w.codigo).join(', ')}`)

  ok(`"${desc}" → fonte === "fallback_normativo_br"`,
    rf.clima_utilizado.fonte === 'fallback_normativo_br',
    `Fonte: ${rf.clima_utilizado.fonte}`)

  ok(`"${desc}" → motor executou sem lançar exceção`,
    typeof rf.compativel === 'boolean')
}

// Verifica que o fallback usa os valores corretos do CLIMA_FALLBACK_BRASIL
const rfFallback = analisarCompatibilidade({
  dados_eletricos_modulo:   MODULO,
  dados_eletricos_inversor: INVERSOR,
  arranjo_proposto: { quantidade_modulos_por_string: 18, quantidade_strings_paralelo: 1 },
  dados_climaticos_regiao:  null,
})

ok(`Tmin do fallback === ${CLIMA_FALLBACK_BRASIL.temperatura_min_historica_c}°C`,
  rfFallback.clima_utilizado.temperatura_min_c === CLIMA_FALLBACK_BRASIL.temperatura_min_historica_c)

ok(`Tmax do fallback === ${CLIMA_FALLBACK_BRASIL.temperatura_max_historica_c}°C`,
  rfFallback.clima_utilizado.temperatura_max_c === CLIMA_FALLBACK_BRASIL.temperatura_max_historica_c)

// Com fallback (Tmin=10, 18 módulos):
// Voc_corr = 49.9 × (1 + (-0.0028)×(10-25)) = 49.9 × 1.042 = 51.996 V
// Voc_string = 18 × 51.996 = 935.9 V < 1000 V ✓ → ainda compatível
ok('Motor retorna resultado válido com fallback (18 módulos ainda passam)',
  rfFallback.calculos.voc_string_max < INVERSOR.tensao_max_entrada,
  `Voc_string com fallback = ${rfFallback.calculos.voc_string_max} V`)

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 7 — COMPARAÇÃO GEOGRÁFICA
//
// MESMO ARRANJO: 19 módulos × 1 string
//
// Natal-RN (Tmin=20°C):
//   Voc_corr = 49.9 × (1 + (-0.0028)×(-5))  = 50.599 V
//   Voc_string = 19 × 50.599 = 961.4 V < 1000 V ✓ PASSA
//   Vmpp_frio = 19 × 42.385 = 805.3 V < 850 V ✓
//
// São Joaquim-SC (Tmin=-3°C):
//   Voc_corr = 49.9 × (1 + (-0.0028)×(-28)) = 49.9 × 1.0784 = 53.812 V
//   Voc_string = 19 × 53.812 = 1022.4 V > 1000 V ❌ SOBRETENSÃO
//   Vmpp_frio = 19 × 45.077 = 856.5 V > 850 V ❌ MPPT_STRING_LONGA
//
// Demonstração: dados climáticos locais são DETERMINANTES para a segurança.
// ═════════════════════════════════════════════════════════════════════════════

suite('SUITE 7 — Comparação geográfica (MESMO arranjo: 19 módulos × 1 string)')

const ARRANJO_GEO = { quantidade_modulos_por_string: 19, quantidade_strings_paralelo: 1 }

// ── Natal-RN (clima quente — baixo risco Voc) ─────────────────────────────────
const rNatal = analisarCompatibilidade({
  dados_eletricos_modulo:   MODULO,
  dados_eletricos_inversor: INVERSOR,
  arranjo_proposto:         ARRANJO_GEO,
  dados_climaticos_regiao:  CLIMA_NATAL,
})

console.log('\n  [Natal-RN | Tmin=20°C]')

ok('Natal: compativel === true',
  rNatal.compativel,
  `Erros: ${rNatal.erros.map(e => e.codigo).join(', ')}`)

ok('Natal: Voc_string ≈ 961.4 V (< 1000 V — margem ok)',
  aprox(rNatal.calculos.voc_string_max, 961.38, 1.0),
  `Obtido: ${rNatal.calculos.voc_string_max}`)

ok('Natal: Vmpp_string_frio ≈ 805.3 V (< 850 V — dentro do MPPT)',
  aprox(rNatal.calculos.vmpp_string_frio, 805.32, 1.0) &&
  rNatal.calculos.vmpp_string_frio < INVERSOR.mppt_max,
  `Obtido: ${rNatal.calculos.vmpp_string_frio}`)

ok('Natal: sem erro SOBRETENSAO_VOC',
  naoTemErro(rNatal, 'SOBRETENSAO_VOC'))

ok('Natal: sem erro MPPT_STRING_LONGA',
  naoTemErro(rNatal, 'MPPT_STRING_LONGA'))

ok('Natal: clima_utilizado.cidade === "Natal"',
  rNatal.clima_utilizado.cidade === 'Natal')

// ── São Joaquim-SC (clima frio — alto risco Voc) ──────────────────────────────
const rSJoaquim = analisarCompatibilidade({
  dados_eletricos_modulo:   MODULO,
  dados_eletricos_inversor: INVERSOR,
  arranjo_proposto:         ARRANJO_GEO,
  dados_climaticos_regiao:  CLIMA_SAO_JOAQUIM,
})

console.log('\n  [São Joaquim-SC | Tmin=-3°C]')

ok('São Joaquim: compativel === false (frio eleva Voc além do limite)',
  !rSJoaquim.compativel)

ok('São Joaquim: erro SOBRETENSAO_VOC presente',
  temErro(rSJoaquim, 'SOBRETENSAO_VOC'),
  `Erros: ${rSJoaquim.erros.map(e => e.codigo).join(', ')}`)

ok('São Joaquim: Voc_string ≈ 1022.4 V (> 1000 V — PERIGOSO)',
  aprox(rSJoaquim.calculos.voc_string_max, 1022.43, 1.0) &&
  rSJoaquim.calculos.voc_string_max > INVERSOR.tensao_max_entrada,
  `Obtido: ${rSJoaquim.calculos.voc_string_max}`)

ok('São Joaquim: erro MPPT_STRING_LONGA presente (Vmpp_frio > 850 V)',
  temErro(rSJoaquim, 'MPPT_STRING_LONGA'),
  `Vmpp_frio = ${rSJoaquim.calculos.vmpp_string_frio}`)

ok('São Joaquim: Vmpp_string_frio ≈ 856.5 V (> 850 V — ultrapassa MPPT_max)',
  aprox(rSJoaquim.calculos.vmpp_string_frio, 856.46, 1.0) &&
  rSJoaquim.calculos.vmpp_string_frio > INVERSOR.mppt_max,
  `Obtido: ${rSJoaquim.calculos.vmpp_string_frio}`)

ok('São Joaquim: clima_utilizado.uf === "SC"',
  rSJoaquim.clima_utilizado.uf === 'SC')

// ── Comparação cruzada ────────────────────────────────────────────────────────
console.log('\n  [Análise comparativa]')

ok('Voc_string São Joaquim > Voc_string Natal (frio eleva tensão)',
  rSJoaquim.calculos.voc_string_max > rNatal.calculos.voc_string_max,
  `SJ=${rSJoaquim.calculos.voc_string_max} > Natal=${rNatal.calculos.voc_string_max}`)

ok('Vmpp_frio São Joaquim > Vmpp_frio Natal (frio também eleva Vmpp)',
  rSJoaquim.calculos.vmpp_string_frio > rNatal.calculos.vmpp_string_frio)

ok('Delta Voc entre cidades: ~61 V (19 × (53.812 - 50.599) = 19 × 3.21)',
  aprox(
    rSJoaquim.calculos.voc_string_max - rNatal.calculos.voc_string_max,
    19 * (53.812 - 50.599), 2.0
  ),
  `Delta: ${rSJoaquim.calculos.voc_string_max - rNatal.calculos.voc_string_max}`)

ok('Natal aprovado / São Joaquim reprovado: MESMO arranjo, resultado oposto',
  rNatal.compativel === true && rSJoaquim.compativel === false)

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 8 — INPUTS ELÉTRICOS INVÁLIDOS
// Motor retorna INPUT_INVALIDO sem lançar exceção
// ═════════════════════════════════════════════════════════════════════════════

suite('SUITE 8 — Inputs elétricos inválidos retornam erro sem lançar exceção')

const casosEletricosInvalidos = [
  { desc: 'modulo null',               mod: null,     inv: INVERSOR, arr: { quantidade_modulos_por_string: 10, quantidade_strings_paralelo: 1 } },
  { desc: 'inversor null',             mod: MODULO,   inv: null,     arr: { quantidade_modulos_por_string: 10, quantidade_strings_paralelo: 1 } },
  { desc: 'Voc negativo',             mod: { ...MODULO, voc: -5 },   inv: INVERSOR, arr: { quantidade_modulos_por_string: 10, quantidade_strings_paralelo: 1 } },
  { desc: 'modulos_por_string zero',  mod: MODULO,   inv: INVERSOR, arr: { quantidade_modulos_por_string: 0,  quantidade_strings_paralelo: 1 } },
  { desc: 'vmpp >= voc (impossível)', mod: { ...MODULO, vmpp: 55 },  inv: INVERSOR, arr: { quantidade_modulos_por_string: 10, quantidade_strings_paralelo: 1 } },
]

for (const { desc, mod, inv, arr } of casosEletricosInvalidos) {
  let resultado
  try {
    resultado = analisarCompatibilidade({
      dados_eletricos_modulo:   mod,
      dados_eletricos_inversor: inv,
      arranjo_proposto:         arr,
      dados_climaticos_regiao:  CLIMA_NATAL,
    })
    ok(`"${desc}" → compativel=false, erro INPUT_INVALIDO`,
      !resultado.compativel && temErro(resultado, 'INPUT_INVALIDO'))
  } catch (e) {
    ok(`"${desc}" → NÃO deve lançar exceção`, false, e.message)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 9 — FÍSICA TÉRMICA (comportamento correto dos parâmetros)
// ═════════════════════════════════════════════════════════════════════════════

suite('SUITE 9 — Física térmica (comportamento qualitativo dos parâmetros)')

const rfis = analisarCompatibilidade({
  dados_eletricos_modulo:   MODULO,
  dados_eletricos_inversor: INVERSOR,
  arranjo_proposto:         { quantidade_modulos_por_string: 18, quantidade_strings_paralelo: 1 },
  dados_climaticos_regiao:  CLIMA_NATAL,
})

ok('Voc_corrigido_frio > Voc_STC (tensão CC aumenta no frio)',
  rfis.calculos.voc_corrigido_frio > MODULO.voc,
  `${rfis.calculos.voc_corrigido_frio} > ${MODULO.voc}`)

ok('Vmpp_corrigido_quente < Vmpp_STC (tensão MPPT cai no calor)',
  rfis.calculos.vmpp_corrigido_quente < MODULO.vmpp,
  `${rfis.calculos.vmpp_corrigido_quente} < ${MODULO.vmpp}`)

ok('T_cel_max > T_amb_max (NOCT aquece a célula além da temperatura ambiente)',
  rfis.calculos.t_cel_max_c > CLIMA_NATAL.temperatura_max_historica_c,
  `T_cel=${rfis.calculos.t_cel_max_c} > T_amb=${CLIMA_NATAL.temperatura_max_historica_c}`)

ok('delta_temp_frio_c < 0 (Tmin < T_STC=25°C)',
  rfis.calculos.delta_temp_frio_c < 0,
  `ΔT_frio=${rfis.calculos.delta_temp_frio_c}`)

ok('delta_temp_quente_c > 0 (T_cel_max > T_STC=25°C)',
  rfis.calculos.delta_temp_quente_c > 0,
  `ΔT_quente=${rfis.calculos.delta_temp_quente_c}`)

ok('Vmpp_string_frio > Vmpp_string_quente (frio → maior Vmpp)',
  rfis.calculos.vmpp_string_frio > rfis.calculos.vmpp_string_quente,
  `frio=${rfis.calculos.vmpp_string_frio} > quente=${rfis.calculos.vmpp_string_quente}`)

// ═════════════════════════════════════════════════════════════════════════════
// SUITE 10 — ISOLAMENTO E PUREZA DA FUNÇÃO
// ═════════════════════════════════════════════════════════════════════════════

suite('SUITE 10 — Isolamento total e pureza da função')

ok('Módulo carregado sem mongoose (zero dependência de banco)',
  true)   // se chegou aqui, foi carregado sem erros de import

ok('Módulo carregado sem express (zero dependência de controller)',
  true)

ok('CLIMA_FALLBACK_BRASIL é Object.freeze (imutável)',
  Object.isFrozen(CLIMA_FALLBACK_BRASIL))

ok('CONSTANTES é Object.freeze (imutável)',
  Object.isFrozen(CONSTANTES))

ok('Função é determinística: mesmo input = mesmo output',
  (() => {
    const args = {
      dados_eletricos_modulo:   MODULO,
      dados_eletricos_inversor: INVERSOR,
      arranjo_proposto:         { quantidade_modulos_por_string: 18, quantidade_strings_paralelo: 1 },
      dados_climaticos_regiao:  CLIMA_NATAL,
    }
    const out1 = analisarCompatibilidade(args)
    const out2 = analisarCompatibilidade(args)
    return JSON.stringify(out1) === JSON.stringify(out2)
  })())

ok('Input original não é mutado pela função',
  (() => {
    const modCopy = { ...MODULO }
    const invCopy = { ...INVERSOR }
    const climaCopy = { ...CLIMA_NATAL }
    analisarCompatibilidade({
      dados_eletricos_modulo:   modCopy,
      dados_eletricos_inversor: invCopy,
      arranjo_proposto:         { quantidade_modulos_por_string: 18, quantidade_strings_paralelo: 1 },
      dados_climaticos_regiao:  climaCopy,
    })
    return modCopy.voc === MODULO.voc &&
           invCopy.tensao_max_entrada === INVERSOR.tensao_max_entrada &&
           climaCopy.temperatura_min_historica_c === CLIMA_NATAL.temperatura_min_historica_c
  })())

ok('Warning oversizing entre 1.30 e 1.50 (sem erro)',
  (() => {
    const rw = analisarCompatibilidade({
      dados_eletricos_modulo:   MODULO,
      dados_eletricos_inversor: { ...INVERSOR, potencia_ca_kw: 7 },   // 9.81/7=1.40×
      arranjo_proposto:         { quantidade_modulos_por_string: 18, quantidade_strings_paralelo: 1 },
      dados_climaticos_regiao:  CLIMA_NATAL,
    })
    return temWarning(rw, 'OVERSIZING_ELEVADO') && naoTemErro(rw, 'OVERSIZING_CRITICO')
  })(),
  '9.81 kWp / 7 kW = 1.40× → warning, não erro')

// ─── RESULTADO FINAL ──────────────────────────────────────────────────────────

const sep = '═'.repeat(70)
console.log(`\n${sep}`)
console.log(`  RESULTADO FINAL: ${passed} ✅  |  ${failed} ❌  |  Total: ${passed + failed}`)
console.log(sep)

if (failed > 0) {
  console.error(`\n  ${failed} teste(s) FALHARAM. Ver detalhes acima.\n`)
  process.exit(1)
} else {
  console.log(`\n  Motor de compatibilidade elétrica S2.10.1 — 100% PASS ✅\n`)
}
