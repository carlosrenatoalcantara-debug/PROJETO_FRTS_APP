/**
 * auditoria-micro-fv-dom-031.mjs — FV-DOM-031, item 1
 *
 * SÓ MEDE. Nenhuma escrita, nenhum banco, nenhuma rede.
 *
 * Responde três perguntas com números, não com opinião:
 *
 *  A. Os TRÊS classificadores de topologia concordam sobre o que é micro?
 *  B. Os DOIS motores de micro concordam sobre a mesma configuração?
 *  C. O que o catálogo declara para micro chega ao consumidor pela SSOT?
 *
 *   node backend/scripts/auditoria-micro-fv-dom-031.mjs
 */
import { DADOS_ELETRICOS_INVERSORES } from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'
import { tecnologiaInversor } from '@fortesolar/fv-shared/engenharia/regras-plausibilidade'
import { lerInversor, derivarTopologia, classificarTopologiaInversor, paraDimensionamento } from '@fortesolar/fv-shared/inversores'
import { validarMicroinversores } from '@fortesolar/fv-shared/fv/validacao-microinversores'
import { avaliarModeloMicro, capacidadeDoMicro, microsNecessarios } from '@fortesolar/fv-shared/engenharia/microinversores'

// FV-DOM-031: o classificador do wizard passou a ser um ADAPTADOR de vocabulário
// sobre o canônico. Reproduzido aqui porque `frontend/src/utils/topologiaInversor.js`
// resolve `@fortesolar/fv-shared` pelo alias do Vite, indisponível neste script.
const VOCAB_WIZARD = { MICRO: 'micro', OTIMIZADOR: 'otimizador', HYBRID: 'string', STRING: 'string' }
const classificarTopologia = (inv, el) => VOCAB_WIZARD[classificarTopologiaInversor(
  { tipo_topologia: el?.topologia ?? inv?.topologia },
  { fabricante: inv?.fabricante ?? '', modelo: `${inv?.modelo ?? ''} ${inv?.id ?? ''}`.trim() })]

// Idem para o dimensionador do frontend.
const dimensionarMicroinversor = ({ numModulos, potenciaModuloW, micro }) => {
  const cap = capacidadeDoMicro(micro)
  if (cap === null) return { valido: false, qtdMicros: 0, oversizingOk: null }
  const q = microsNecessarios(numModulos, cap)
  const r = avaliarModeloMicro({ modulos: numModulos, quantidade: q,
    micro: { entradas: micro.entradas, modulos_por_entrada: micro.modulos_por_entrada,
      potencia_kw: micro.potencia_ca_kw, oversizing_max: micro.oversizing_max }, potenciaModuloW })
  const ov = r.resumo?.oversizing_mais_carregado ?? null
  const lim = r.resumo?.oversizing_max ?? null
  return { valido: r.valido, qtdMicros: q, distribuicao: r.resumo?.distribuicao ?? [],
    potenciaCcKw: r.resumo?.potencia_cc_kwp, potenciaCaKw: r.resumo?.potencia_ca_kw,
    relacaoDcAc: r.resumo?.potencia_ca_kw ? +(r.resumo.potencia_cc_kwp / r.resumo.potencia_ca_kw).toFixed(3) : null,
    oversizingMicroCheio: ov, oversizingOk: lim === null || ov === null ? null : ov <= lim,
    bloqueios: r.bloqueios, avisos: r.avisos }
}

const col = (v, n) => String(v ?? '—').padEnd(n)

/** Marca/modelo por id — extraído de `SeletorInversores.jsx`, igual ao seed da FV-UX-027. */
const REF = {
  fr5: ['Fronius', 'Primo 5.0-1'], fr8: ['Fronius', 'Primo 8.2-1'],
  fr20: ['Fronius', 'Symo 20.0-3-M'], fr25: ['Fronius', 'Symo 25.0-3-M'],
  sg5: ['Sungrow', 'SG5.0RS'], sg8: ['Sungrow', 'SG8.0RS'], sg10: ['Sungrow', 'SG10RS'],
  sg15t: ['Sungrow', 'SG15RT'], sg25t: ['Sungrow', 'SG25RT'],
  gw5s: ['Growatt', 'MID 5000TL-X'], gw5t: ['Growatt', 'MOD 5000TL3-LV'],
  gw10t: ['Growatt', 'MOD 10000TL3-X'],
  dy8: ['Deye', 'SUN-8K-SG01LP1'], dy12t: ['Deye', 'SUN-12K-SG'],
  abb4: ['ABB', 'UNO-DM-4.6-TL-PLUS'],
  weg6: ['WEG', 'SIW500H TL 6kW'], weg12: ['WEG', 'SIW500H TL 12kW'],
  sh5: ['Sungrow', 'SH5.0RS'], sh8: ['Sungrow', 'SH8.0RS'],
  sh10: ['Sungrow', 'SH10RS'], sh15t: ['Sungrow', 'SH15T'],
  sph5: ['Growatt', 'SPH 5000TL BL-UP'], sph8: ['Growatt', 'SPH 8000TL BL-UP'],
  dh5: ['Deye', 'SUN-5K-SG04LP1'], dh8: ['Deye', 'SUN-8K-SG04LP1'],
  dh12t: ['Deye', 'SUN-12K-SG04LP3'],
  gw5h: ['GoodWe', 'GW5K-ET'], gw10h: ['GoodWe', 'GW10K-ET'],
  sf6h: ['Sofar', 'HYD6000-ES'],
  aps400: ['APsystems', 'EZ1-M 400W'], aps800: ['APsystems', 'EZ1-M 800W'],
  apsds3: ['APsystems', 'DS3'], apsqs1: ['APsystems', 'QS1'],
  enph: ['Enphase', 'IQ8M'], enph8a: ['Enphase', 'IQ8A'],
  hms500: ['Hoymiles', 'HMS-500-1T'], hms800: ['Hoymiles', 'HMS-800-2T'],
  hms1600: ['Hoymiles', 'HMS-1600-4T'], hms2000: ['Hoymiles', 'HMS-2000-4T'],
  hmt2250: ['Hoymiles', 'HMT-2250-6T'],
  deyem2000: ['Deye', 'SUN-M2000G4'], tsun2000: ['TSUN', 'TSOL-MS2000'],
  vic24_3: ['Victron', 'MultiPlus-II 24/3000/70'],
  vic48_5: ['Victron', 'MultiPlus-II 48/5000/70'],
  ofg3: ['Genérico', 'OFF3000-19B'], ofg5: ['Genérico', 'OFF5000-19B'],
  dof5: ['Deye', 'SUN-5K-SG01LP1-EU'],
  se5k: ['SolarEdge', 'SE5000H HD-Wave'], se7k: ['SolarEdge', 'SE7600H HD-Wave'],
  se20k: ['SolarEdge', 'SE20K 3-Phase'],
}

console.log('═══ FV-DOM-031 · AUDITORIA DE MICROINVERSORES (só mede) ═══')

// ═══ A · Três classificadores, o mesmo catálogo ═════════════════════════════
console.log('\n══ A · Os três classificadores de topologia concordam?\n')
console.log(col('INVERSOR', 30) + col('catálogo', 12) + col('SSOT', 8) +
  col('plausibil.', 14) + col('wizard', 12) + 'ACORDO')

const linhas = []
for (const [id, e] of Object.entries(DADOS_ELETRICOS_INVERSORES)) {
  const [fabricante, modelo] = REF[id] ?? ['Genérico', id]
  // `especificacoes` como o catálogo persistiria (mesmo mapeamento do seed).
  const esp = {
    potencia_kw: e.potencia_ca_kw, potencia: e.potencia_ca_kw,
    tensao_max_entrada: e.tensao_max_entrada,
    tensao_mppt_min: e.mppt_min, tensao_mppt_max: e.mppt_max,
    corrente_max_por_mppt: e.corrente_max_mppt,
    entradas_por_mppt: e.entradas_por_mppt,
    oversizing_max: e.oversizing_max ?? null,
    ...(e.topologia === 'micro' ? { entradas: e.entradas, modulos_por_entrada: e.modulos_por_entrada } : {}),
  }
  const declarado = e.topologia ?? 'string'
  const ssot = derivarTopologia(esp, { fabricante, modelo })
  const plaus = tecnologiaInversor({ fabricante, modelo, voc_max_dc_v: e.tensao_max_entrada,
    potencia_kw_ca: e.potencia_ca_kw, n_mppts: e.entradas ?? null })
  const wiz = classificarTopologia({ fabricante, modelo, id })

  const n = (t) => String(t).toLowerCase().replace('microinversor', 'micro').replace('hybrid', 'hibrido')
  // Os TRÊS caminhos de CÓDIGO. O wizard mapeia HYBRID→string por desenho
  // documentado (seu enum não tem híbrido), então compara-se sob esse mapa.
  const codigoConcorda = n(ssot) === n(plaus) &&
    n(wiz) === (n(ssot) === 'hibrido' ? 'string' : n(ssot))
  // O catálogo é DADO, não código: divergir dele é lacuna de cadastro.
  const catalogoConcorda = n(declarado) === n(ssot)
  linhas.push({ id, nome: `${fabricante} ${modelo}`, declarado, ssot, plaus, wiz,
    codigoConcorda, catalogoConcorda, e, esp })
  console.log(col(`${fabricante} ${modelo}`, 30) + col(declarado, 12) + col(ssot, 8) +
    col(plaus, 14) + col(wiz, 12) +
    (codigoConcorda ? (catalogoConcorda ? 'sim' : 'código ok · catálogo omisso') : '◄ DIVERGE'))
}

const microCatalogo = linhas.filter((l) => l.declarado === 'micro')
const divergentes = linhas.filter((l) => !l.codigoConcorda)
const catalogoOmisso = linhas.filter((l) => l.codigoConcorda && !l.catalogoConcorda)
console.log(`\n   modelos no catálogo:                     ${linhas.length}`)
console.log(`   declarados micro pelo catálogo:          ${microCatalogo.length}`)
console.log(`   os TRÊS caminhos de código concordam:    ${linhas.length - divergentes.length}`)
console.log(`   DIVERGÊNCIA DE CÓDIGO:                   ${divergentes.length}`)
for (const d of divergentes) {
  console.log(`     ${d.nome}: ssot=${d.ssot} plausib=${d.plaus} wizard=${d.wiz}`)
}
console.log(`\n   código unânime, mas o CATÁLOGO não declara: ${catalogoOmisso.length}`)
for (const d of catalogoOmisso) {
  console.log(`     ${d.nome}: campo \`topologia\` ausente → código classifica ${d.ssot}`)
}
console.log('     ↳ lacuna de CADASTRO, não conflito de regra. Fora do escopo desta sprint.')
// Quem cada consumidor real chama:
console.log('\n   consumidores:')
console.log('     nova UX (catalogo.js tipoDoInversor) → tecnologiaInversor  (regrasPlausibilidade)')
console.log('     wizard  (ConfiguradorArranjoFV)      → classificarTopologia (frontend/utils)')
console.log('     SSOT    (lerInversor/paraDimension.) → derivarTopologia     (dicionarioInversor)')

// ═══ B · O que a SSOT entrega para um micro ═════════════════════════════════
console.log('\n══ B · O catálogo declara `entradas`/`modulos_por_entrada`. Isso chega ao consumidor?\n')
console.log(col('MICRO', 30) + col('cat.entr', 10) + col('cat.mod/e', 11) +
  col('SSOT.entradas', 15) + col('SSOT.mod/e', 12) + 'paraDimensionamento')
for (const l of microCatalogo) {
  const c = lerInversor(l.esp, { fabricante: l.nome })
  const d = paraDimensionamento(l.esp, {})
  console.log(col(l.nome, 30) + col(l.e.entradas, 10) + col(l.e.modulos_por_entrada, 11) +
    col(c.entradas === undefined ? 'CAMPO INEXISTENTE' : c.entradas, 15) +
    col(c.modulos_por_entrada === undefined ? 'INEXISTENTE' : c.modulos_por_entrada, 12) +
    `entradas_por_mppt=${JSON.stringify(d.entradas_por_mppt)} n_mppts=${d.n_mppts}`)
}

// ═══ C · Os dois motores concordam? ════════════════════════════════════════
console.log('\n══ C · `dimensionarMicroinversor` × `validarMicroinversores` no MESMO caso\n')
console.log('   Cenário do enunciado: 24 × Znshine 650 W\n')
const POT_MODULO_W = 650
const NUM_MODULOS = 24
console.log(col('MICRO', 26) + col('entr', 6) + col('mod/e', 7) + col('CA kW', 7) +
  col('dimensionar', 26) + 'validar')
for (const l of microCatalogo) {
  const micro = { entradas: l.e.entradas, modulos_por_entrada: l.e.modulos_por_entrada,
    potencia_ca_kw: l.e.potencia_ca_kw, oversizing_max: l.e.oversizing_max }
  const dim = dimensionarMicroinversor({ numModulos: NUM_MODULOS, potenciaModuloW: POT_MODULO_W, micro })
  // O validador é chamado com o que o dimensionador PROPÔS.
  const val = validarMicroinversores({
    numModulos: NUM_MODULOS, numMicros: dim.qtdMicros, entradasPorMicro: l.e.entradas,
    potenciaModuloW: POT_MODULO_W, potenciaMicroCA_W: l.e.potencia_ca_kw * 1000,
    oversizingMax: l.e.oversizing_max ?? null,   // FV-DOM-031: limite do CATÁLOGO
  })
  const resumoDim = `${dim.qtdMicros} micros · DC/AC ${dim.oversizingMicroCheio}× ${dim.oversizingOk === null ? 'sem limite' : dim.oversizingOk ? 'ok' : 'EXCEDE'}`
  const resumoVal = val.valido ? 'válido' : `BLOQUEIA: ${val.bloqueios[0].slice(0, 60)}`
  const conflito = dim.oversizingOk !== val.valido ? '  ◄ CONFLITO' : '  (acordo)'
  console.log(col(l.nome, 26) + col(l.e.entradas, 6) + col(l.e.modulos_por_entrada, 7) +
    col(l.e.potencia_ca_kw, 7) + col(resumoDim, 26) + resumoVal + conflito)
}

// ═══ D · Os defaults de cada motor ═════════════════════════════════════════
console.log('\n══ D · Defaults fabricados nos dois motores (mesma classe da FV-DOM-029)\n')
{
  const semNada = dimensionarMicroinversor({ numModulos: 24, potenciaModuloW: 650, micro: {} })
  console.log(`   dimensionarMicroinversor({}) → entradas=${semNada.entradasPorMicro} ` +
    `modulosPorMicro=${semNada.modulosPorMicro} qtdMicros=${semNada.qtdMicros} ` +
    `oversizingOk=${semNada.oversizingOk}`)
  console.log('     ↳ REMOVIDOS: `entradas ?? 1`, `modulos_por_entrada ?? 1`,')
  console.log('       `oversizing_max ?? 1.25`, `potencia_ca_kw ?? 0`. Sem capacidade declarada,')
  console.log('       o motor recusa em vez de fingir um micro de 1 entrada.')

  const cat = validarMicroinversores({ numModulos: 24, numMicros: 6, entradasPorMicro: 4,
    potenciaModuloW: 650, potenciaMicroCA_W: 2000 })
  const comLimite = validarMicroinversores({ numModulos: 24, numMicros: 6, entradasPorMicro: 4,
    potenciaModuloW: 650, potenciaMicroCA_W: 2000, oversizingMax: 1.25 })
  console.log(`\n   validarMicroinversores sem oversizingMax → válido=${cat.valido} (default 1,50)`)
  console.log(`   o MESMO caso com o 1,25 do catálogo      → válido=${comLimite.valido}`)
  console.log(`     ↳ ${cat.valido !== comLimite.valido ? 'O DEFAULT MUDA O VEREDITO.' : 'mesmo veredito neste caso.'}`)
}

// ═══ E · O caso exato do enunciado ═════════════════════════════════════════
console.log('\n══ E · O caso do enunciado: 24 módulos, 6 micros, 4 entradas, 1 módulo/entrada\n')
{
  const dim = dimensionarMicroinversor({ numModulos: 24, potenciaModuloW: 650,
    micro: { entradas: 4, modulos_por_entrada: 1, potencia_ca_kw: 2.0, oversizing_max: 1.25 } })
  console.log(`   dimensionar → ${dim.qtdMicros} micros · distribuição ${JSON.stringify(dim.distribuicao)} · ` +
    `CC ${dim.potenciaCcKw} kWp · CA ${dim.potenciaCaKw} kW · DC/AC ${dim.relacaoDcAc}× · ` +
    `micro cheio ${dim.oversizingMicroCheio}× (${dim.oversizingOk ? 'ok' : 'EXCEDE'})`)
  const val = validarMicroinversores({ numModulos: 24, numMicros: 6, entradasPorMicro: 4,
    potenciaModuloW: 650, potenciaMicroCA_W: 2000, oversizingMax: 1.25 })
  console.log(`   validar     → válido=${val.valido}` +
    (val.bloqueios.length ? `\n                 bloqueios: ${val.bloqueios.join(' | ')}` : '') +
    (val.avisos.length ? `\n                 avisos: ${val.avisos.join(' | ')}` : ''))
}

console.log('\n══ F · Modelos MISTOS (4 × Micro A + 2 × Micro B)\n')
{
  const a = validarMicroinversores({ numModulos: 16, numMicros: 4, entradasPorMicro: 4,
    potenciaModuloW: 650, potenciaMicroCA_W: 2000, oversizingMax: 1.25 })
  const b = validarMicroinversores({ numModulos: 8, numMicros: 2, entradasPorMicro: 4,
    potenciaModuloW: 650, potenciaMicroCA_W: 1600, oversizingMax: 1.25 })
  console.log(`   chamando o validador UMA VEZ POR MODELO (16+8 = 24 módulos):`)
  console.log(`     Micro A (4 un., 2,0 kW): válido=${a.valido}`)
  console.log(`     Micro B (2 un., 1,6 kW): válido=${b.valido}`)
  console.log('   ↳ FV-DOM-031 (decisão 1): `arranjos[].configuracao_eletrica.micros[]`')
  console.log('     passou a guardar quantidade, entradas e distribuição POR MODELO.')
}

console.log('\n═══ FIM — nenhuma escrita, nenhum banco, nenhum arquivo alterado ═══')
