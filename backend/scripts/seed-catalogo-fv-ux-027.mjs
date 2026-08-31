/**
 * seed-catalogo-fv-ux-027.mjs — FV-UX-027
 *
 * Semeia o ambiente EFÊMERO com um catálogo realista para a auditoria manual:
 * o módulo Znshine 650 W e todos os inversores do catálogo elétrico de
 * referência do repositório (`fv-shared/engenharia/catalogoEletrico.js`).
 *
 * O catálogo real vive em produção, que é proibida nesta sprint. Os dados
 * abaixo são os do próprio repositório — não inventados aqui.
 *
 * Roda contra QUALQUER banco de QA — local ou de staging. `exigirBancoDeQa`
 * recusa URI de produção (FV-INFRA-058).
 *
 *   node backend/scripts/seed-catalogo-fv-ux-027.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { DADOS_ELETRICOS_INVERSORES } from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'
import { tecnologiaInversor } from '@fortesolar/fv-shared/engenharia/regras-plausibilidade'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * FV-INFRA-058: a URI deixa de estar presa à porta 37017.
 *
 * A trava original (`cred.uri.includes('37017')`) protegia bem o ambiente local
 * e impedia o staging: era impossível semear um banco remoto de QA. A proteção
 * passa a ser o `exigirBancoDeQa`, que recusa qualquer URI remota que não se
 * declare de teste — mais forte, porque também cobre outras portas locais e
 * qualquer host de produção.
 *
 * Precedência: `MONGODB_URI` do ambiente > `.ambiente-validacao.json` local.
 */
/**
 * FV-INFRA-059: resolvers DNS. Esta maquina nao resolve o SRV de `mongodb+srv://`
 * pelo resolver do SO e devolve `querySrv ECONNREFUSED` — o mesmo defeito que
 * `config/database.js` ja trata com MONGODB_DNS_SERVERS. O seed conecta direto,
 * sem passar por aquele modulo, entao aplica a mesma correcao aqui.
 * No-op quando a variavel nao esta definida.
 */
import dns from 'node:dns'
const DNS_SERVERS = (process.env.MONGODB_DNS_SERVERS || '')
  .split(',').map((x) => x.trim()).filter(Boolean)
if (DNS_SERVERS.length) {
  try { dns.setServers(DNS_SERVERS); console.log(`DNS: ${DNS_SERVERS.join(', ')}`) }
  catch (e) { console.warn('falha ao aplicar MONGODB_DNS_SERVERS:', e.message) }
}

const { exigirBancoDeQa, mascararUri } = await import('../src/config/bancoQa.js')

let uri = process.env.MONGODB_URI || ''
if (!uri) {
  try {
    uri = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8')).uri
  } catch {
    console.error('❌ Defina MONGODB_URI ou suba o ambiente isolado antes.')
    process.exit(2)
  }
}

try {
  exigirBancoDeQa(uri)
} catch (e) {
  console.error(`❌ RECUSADO (${e.codigo}): ${e.message}`)
  process.exit(1)
}
console.log(`→ semeando ${mascararUri(uri)}`)

await mongoose.connect(uri)
const { Equipamento } = await import('../src/models/Equipamento.js')

/**
 * Marca, modelo e nº de MPPTs por id, extraídos das listas de referência do
 * próprio repositório (`SeletorInversores.jsx`). O catálogo elétrico
 * compartilhado guarda apenas parâmetros elétricos — NÃO carrega a contagem de
 * MPPT nem o nome comercial, e essa ausência é ela mesma um achado desta
 * auditoria.
 *
 * Para MICROINVERSORES o catálogo elétrico declara `entradas` (entradas
 * independentes). Cada entrada de um micro rastreia seu próprio ponto de máxima
 * potência, então aqui `n_mppts = entradas` — mapeamento de DADO DE TESTE,
 * documentado, não regra de produto.
 */
const REF = {
  fr5: ['Fronius', 'Primo 5.0-1', 2], fr8: ['Fronius', 'Primo 8.2-1', 2],
  fr20: ['Fronius', 'Symo 20.0-3-M', 3], fr25: ['Fronius', 'Symo 25.0-3-M', 3],
  sg5: ['Sungrow', 'SG5.0RS', 2], sg8: ['Sungrow', 'SG8.0RS', 2], sg10: ['Sungrow', 'SG10RS', 2],
  sg15t: ['Sungrow', 'SG15RT', 3], sg25t: ['Sungrow', 'SG25RT', 3],
  gw5s: ['Growatt', 'MID 5000TL-X', 2], gw5t: ['Growatt', 'MOD 5000TL3-LV', 2],
  gw10t: ['Growatt', 'MOD 10000TL3-X', 2],
  dy8: ['Deye', 'SUN-8K-SG01LP1', 2], dy12t: ['Deye', 'SUN-12K-SG', 3],
  abb4: ['ABB', 'UNO-DM-4.6-TL-PLUS', 1],
  weg6: ['WEG', 'SIW500H TL 6kW', 2], weg12: ['WEG', 'SIW500H TL 12kW', 3],
  sh5: ['Sungrow', 'SH5.0RS', 2], sh8: ['Sungrow', 'SH8.0RS', 2],
  sh10: ['Sungrow', 'SH10RS', 2], sh15t: ['Sungrow', 'SH15T', 3],
  sph5: ['Growatt', 'SPH 5000TL BL-UP', 2], sph8: ['Growatt', 'SPH 8000TL BL-UP', 2],
  dh5: ['Deye', 'SUN-5K-SG04LP1', 2], dh8: ['Deye', 'SUN-8K-SG04LP1', 2],
  dh12t: ['Deye', 'SUN-12K-SG04LP3', 3],
  gw5h: ['GoodWe', 'GW5K-ET', 2], gw10h: ['GoodWe', 'GW10K-ET', 2],
  sf6h: ['Sofar', 'HYD6000-ES', 2],
  aps400: ['APsystems', 'EZ1-M 400W', 1], aps800: ['APsystems', 'EZ1-M 800W', 2],
  apsds3: ['APsystems', 'DS3', null], apsqs1: ['APsystems', 'QS1', null],
  enph: ['Enphase', 'IQ8M', 1], enph8a: ['Enphase', 'IQ8A', 1],
  hms500: ['Hoymiles', 'HMS-500-1T', null], hms800: ['Hoymiles', 'HMS-800-2T', null],
  hms1600: ['Hoymiles', 'HMS-1600-4T', null], hms2000: ['Hoymiles', 'HMS-2000-4T', null],
  hmt2250: ['Hoymiles', 'HMT-2250-6T', null],
  deyem2000: ['Deye', 'SUN-M2000G4', null], tsun2000: ['TSUN', 'TSOL-MS2000', null],
  vic24_3: ['Victron', 'MultiPlus-II 24/3000/70', 1],
  vic48_5: ['Victron', 'MultiPlus-II 48/5000/70', 1],
  ofg3: ['Genérico', 'OFF3000-19B', 1], ofg5: ['Genérico', 'OFF5000-19B', 1],
  dof5: ['Deye', 'SUN-5K-SG01LP1-EU', 2],
  se5k: ['SolarEdge', 'SE5000H HD-Wave', 1], se7k: ['SolarEdge', 'SE7600H HD-Wave', 1],
  se20k: ['SolarEdge', 'SE20K 3-Phase', 1],
}

await Equipamento.deleteMany({ 'origem.fonte': 'seed-fv-ux-027' })

// ── Módulo do cenário: Znshine 650 W ────────────────────────────────────────
// Parâmetros do datasheet ZXM7-UHLD144 (bifacial N-type, 650 Wp).
const modulo = await Equipamento.create({
  tipo: 'modulo', fabricante: 'Znshine', modelo: 'ZXM7-UHLD144-650/M',
  origem: { tipo: 'manual', fonte: 'seed-fv-ux-027' },
  especificacoes: {
    potencia_w: 650, voc_v: 45.5, isc_a: 18.35, vmpp_v: 38.1, impp_a: 17.06,
    eficiencia_pct: 20.9, coef_temp_voc_pct_c: -0.25, noct_c: 44,
    numero_celulas: 144, largura_mm: 1134, altura_mm: 2384, peso_kg: 33.5,
  },
})
console.log(`✓ módulo: ${modulo.fabricante} ${modulo.modelo} (${modulo._id})`)

// ── Inversores: todos os do catálogo de referência ──────────────────────────
let criados = 0
const resumo = { string: [], microinversor: [], hibrido: [], otimizador: [] }
for (const [id, e] of Object.entries(DADOS_ELETRICOS_INVERSORES)) {
  const [fabricante, modeloNome, nMpptsRef] = REF[id] ?? ['Genérico', id, null]
  // Micro: cada entrada independente é um MPPT próprio.
  const nMppts = nMpptsRef ?? e.entradas ?? null
  const fases = e.potencia_ca_kw >= 12 || /symo|3-phase|TL3|_3|t$/i.test(modeloNome + id) ? 3 : 1
  const tec = tecnologiaInversor({
    fabricante, modelo: modeloNome,
    voc_max_dc_v: e.tensao_max_entrada,
    potencia_kw_ca: e.potencia_ca_kw,
    n_mppts: nMppts,
  })
  await Equipamento.create({
    tipo: 'inversor', fabricante, modelo: modeloNome,
    origem: { tipo: 'manual', fonte: 'seed-fv-ux-027' },
    especificacoes: {
      potencia: e.potencia_ca_kw, potencia_kw: e.potencia_ca_kw,
      fases,
      tensao_max_entrada: e.tensao_max_entrada,
      tensao_mppt_min: e.mppt_min, tensao_mppt_max: e.mppt_max,
      corrente_max_por_mppt: e.corrente_max_mppt,
      n_mppts: nMppts,
      strings_por_mppt: e.entradas_por_mppt ?? null,
      oversizing_max: e.oversizing_max ?? null,
      eficiencia_maxima: 97.5,
      tipo_inversor: tec === 'microinversor' ? 'micro' : tec,
      ...(e.topologia === 'micro'
        ? { entradas: e.entradas, modulos_por_entrada: e.modulos_por_entrada }
        : {}),
    },
  })
  criados++
  ;(resumo[tec] ??= []).push(
    `${fabricante} ${modeloNome} — ${e.potencia_ca_kw} kW, ${fases}F, ${nMppts ?? '?'} MPPT, Vmax ${e.tensao_max_entrada} V, MPPT ${e.mppt_min}-${e.mppt_max} V, Imax ${e.corrente_max_mppt} A`)
}

console.log(`✓ ${criados} inversores semeados\n`)
for (const [tec, lista] of Object.entries(resumo)) {
  if (!lista.length) continue
  console.log(`── ${tec} (${lista.length})`)
  for (const l of lista) console.log(`   ${l}`)
}

// ── O porteiro do catálogo: o que ficou utilizável em projeto ───────────────
const utilizaveis = await Equipamento.countDocuments({
  'origem.fonte': 'seed-fv-ux-027', utilizavel_em_projeto: { $ne: false },
})
const bloqueados = await Equipamento.find({
  'origem.fonte': 'seed-fv-ux-027', utilizavel_em_projeto: false,
}).select('tipo fabricante modelo bloqueio_engenharia').lean()
console.log(`\n── porteiro do catálogo`)
console.log(`   utilizáveis em projeto: ${utilizaveis} de ${criados + 1}`)
for (const b of bloqueados) {
  console.log(`   BLOQUEADO ${b.tipo} ${b.fabricante} ${b.modelo} — ${JSON.stringify(b.bloqueio_engenharia)}`)
}

// O ambiente local grava projeto/cliente de validação; um banco de staging
// remoto não tem esse arquivo, e a ausência não é erro.
try {
  const c = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
  console.log(`\nprojeto/cliente do ambiente: ${c.projeto_id} / ${c.cliente_id}`)
} catch { /* banco remoto de QA: sem ambiente local */ }
await mongoose.disconnect()
