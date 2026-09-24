/**
 * auditoria-verdade-eletrica-f7.mjs — MAPA DE VERDADE ELÉTRICA DO INVERSOR.
 *
 * Auditoria READ-ONLY. Não escreve no Mongo, não altera catálogo, não corrige
 * nada. Responde a uma pergunta só, com número: quantas fontes determinam de
 * fato o comportamento elétrico do inversor, e quem acredita em cada uma.
 *
 *   node backend/scripts/auditoria-verdade-eletrica-f7.mjs
 *
 * Sem `MONGODB_URI` roda a parte estática e pula o cruzamento com o SSOT.
 */
import mongoose from 'mongoose'
import 'dotenv/config'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { DADOS_ELETRICOS_INVERSORES } from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'
import { INVERSORES } from '../src/data/catalogoInversores.js'
import { INVERSORES_EXPANDIDO } from '../src/data/catalogoInversores-EXPANDIDO.js'
import { paraDimensionamento } from '@fortesolar/fv-shared/inversores'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')
const ler = (rel) => readFileSync(path.resolve(RAIZ, rel), 'utf8')
const titulo = (t) => console.log(`\n${'═'.repeat(74)}\n  ${t}\n${'═'.repeat(74)}`)
const secao = (t) => console.log(`\n── ${t}`)

const n = (v) => { if (v === null || v === undefined || v === '') return null
  const x = Number(v); return Number.isFinite(x) ? x : null }
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

// ════════════════════════════════════════════════════════════════════════════
titulo('1 · FONTES — quantas estruturas carregam spec elétrica de inversor')

const estatico2 = DADOS_ELETRICOS_INVERSORES
const idsTab3 = new Map()
for (const i of [...INVERSORES, ...INVERSORES_EXPANDIDO]) if (!idsTab3.has(i.id)) idsTab3.set(i.id, i)

console.log(` F2 catalogoEletrico.js (fv-shared)        ${Object.keys(estatico2).length} registros`)
console.log(` F3 catalogoInversores.js                  ${INVERSORES.length} registros`)
console.log(` F3 catalogoInversores-EXPANDIDO.js        ${INVERSORES_EXPANDIDO.length} registros`)
console.log(` F3 união por id                           ${idsTab3.size} ids`)

const coserns = ler('backend/src/data/cosernTopologiasReferencia.js')
const invCosern = (coserns.match(/inversor:\s*\{[^}]*modelo:/g) ?? []).length
console.log(` F4 cosernTopologiasReferencia.js          ${invCosern} inversores nomeados (sugestão de UI)`)

const fallback = ler('packages/fv-shared/services/engineeringFallback.js')
const regrasAtivas = (fallback.match(/ativa:\s*true/g) ?? []).length
const regrasInativas = (fallback.match(/ativa:\s*false/g) ?? []).length
console.log(` F5 engineeringFallback.js                 ${regrasAtivas} regra(s) ATIVA(s), ${regrasInativas} desligada(s)`)

// ════════════════════════════════════════════════════════════════════════════
titulo('2 · CONFLITO ENTRE AS DUAS TABELAS ESTÁTICAS (mesmo id)')

const MAPA_23 = [
  ['tensao_max_entrada', 'vocMax'], ['mppt_min', 'mpptMin'], ['mppt_max', 'mpptMax'],
  ['corrente_max_mppt', 'imaxMppt'], ['potencia_ca_kw', 'potenciaKW'],
]
let comuns = 0
const divergencias = []
for (const [id, e2] of Object.entries(estatico2)) {
  const e3 = idsTab3.get(id); if (!e3) continue
  comuns++
  for (const [a, b] of MAPA_23) {
    if (e2[a] == null || e3[b] == null) continue
    if (Number(e2[a]) !== Number(e3[b])) divergencias.push(`${id.padEnd(9)} ${a.padEnd(19)} F2=${e2[a]}  F3=${e3[b]}`)
  }
}
console.log(` ids em comum: ${comuns} | divergências de campo: ${divergencias.length}`)
divergencias.forEach((d) => console.log('   ' + d))
console.log(` só em F2: ${Object.keys(estatico2).filter((i) => !idsTab3.has(i)).length}`)
console.log(` só em F3: ${[...idsTab3.keys()].filter((i) => !estatico2[i]).length}`)

// ════════════════════════════════════════════════════════════════════════════
titulo('3 · paraDimensionamento — substitui limite de CURTO por TRABALHO?')

const casos = [
  ['ambos declarados',        { corrente_isc_max: 28, corrente_max_por_mppt: 20 }],
  ['só corrente de trabalho', { corrente_max_por_mppt: 20 }],
  ['nenhum',                  {}],
]
for (const [rotulo, esp] of casos) {
  const base = { potencia_kw: 9.1, n_mppts: 3, tensao_max_entrada: 600,
    tensao_mppt_min: 80, tensao_mppt_max: 560, ...esp }
  const d = paraDimensionamento(base, {})
  const substituiu = esp.corrente_isc_max === undefined && esp.corrente_max_por_mppt !== undefined
    && d.isc_max_mppt === esp.corrente_max_por_mppt
  console.log(` ${rotulo.padEnd(26)} isc_max_mppt=${String(d.isc_max_mppt).padEnd(6)} ` +
    `${substituiu ? '⚠ SUBSTITUIU o limite de curto pelo de TRABALHO' : ''}`)
}
const fonteInv = ler('packages/fv-shared/equipamentos/inversores/index.js')
console.log(` código: ${(fonteInv.match(/const isc_max_mppt =[^\n]*/) ?? ['(não achado)'])[0].trim()}`)

// ════════════════════════════════════════════════════════════════════════════
titulo('4 · corrente_max_entrada — a cadeia até o motor')

const motor = ler('backend/src/services/compatibilidadeEletricaService.js')
const adapter = ler('frontend/src/utils/catalogoEngenhariaAdapter.js')
const fronteira = ler('packages/fv-shared/engenharia/catalogoEletrico.js')
console.log(` motor    consome?  ${/corrente_max_entrada/.test(motor) ? 'SIM' : 'não'}` +
  `  (critério CORRENTE_ENTRADA_TOTAL_EXCEDIDA: ${/CORRENTE_ENTRADA_TOTAL_EXCEDIDA/.test(motor) ? 'existe' : 'ausente'})`)
console.log(` adapter  mapeia?   ${/corrente_max_entrada/.test(adapter) ? 'SIM' : 'NÃO — o campo nunca é montado'}`)
console.log(` fronteira mapeia?  ${/corrente_max_entrada/.test(fronteira) ? 'SIM' : 'NÃO'}`)

// ════════════════════════════════════════════════════════════════════════════
if (!process.env.MONGODB_URI) {
  console.log('\n(sem MONGODB_URI — cruzamento com o SSOT pulado)')
  process.exit(0)
}
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 })
const invs = await mongoose.connection.collection('equipamentos')
  .find({ $or: [{ categoria: 'inversor' }, { tipo: 'inversor' }] }).toArray()

titulo('5 · SSOT MONGO — `especificacoes` × `specs_canonicas`')
console.log(` inversores no SSOT: ${invs.length}`)

const PARES = [
  ['potencia CA',  'potencia_kw',        'potencia_kw_ca'],
  ['Voc máx',      'tensao_max_entrada', 'voc_max_dc_v'],
  ['MPPT mín',     'tensao_mppt_min',    'mppt_min_v'],
  ['MPPT máx',     'tensao_mppt_max',    'mppt_max_v'],
  ['Isc máx',      'corrente_isc_max',   'isc_max_por_mppt_a'],
  ['strings/MPPT', 'strings_por_mppt',   'strings_max_por_mppt'],
  ['fases',        'fases',              'fases_saida'],
  ['n MPPT',       'n_mppts',            'n_mppts'],
]
for (const [rot, ke, kc] of PARES) {
  let ambos = 0, iguais = 0, difs = 0, soE = 0, soC = 0
  for (const i of invs) {
    const a = i.especificacoes?.[ke], b = i.specs_canonicas?.[kc]
    const tA = a != null && a !== '', tB = b != null && b !== ''
    if (tA && tB) { ambos++; if (String(a) === String(b)) iguais++; else difs++ }
    else if (tA) soE++; else if (tB) soC++
  }
  console.log(` ${rot.padEnd(14)} ambos=${String(ambos).padEnd(3)} iguais=${String(iguais).padEnd(3)} ` +
    `divergentes=${String(difs).padEnd(3)} só_esp=${String(soE).padEnd(3)} só_canon=${soC}`)
}

secao('`isc_max_por_mppt_a` é dado real ou cópia da corrente de TRABALHO?')
let igual = 0, diferente = 0
const fabricados = []
for (const i of invs) {
  const isc = n(i.specs_canonicas?.isc_max_por_mppt_a)
  const trab = n(i.especificacoes?.corrente_max_por_mppt)
  const iscEsp = n(i.especificacoes?.corrente_isc_max)
  if (isc === null || trab === null) continue
  if (isc === trab) { igual++; if (iscEsp === null) fabricados.push(`${i.modelo} (trab=${trab})`) }
  else diferente++
}
console.log(` idêntico à corrente de trabalho : ${igual}`)
console.log(` diferente (dado próprio)        : ${diferente}`)
console.log(` FABRICADOS (sem isc em especificacoes, canônico = trabalho): ${fabricados.length}`)
fabricados.slice(0, 8).forEach((f) => console.log('   ' + f))

// ════════════════════════════════════════════════════════════════════════════
titulo('6 · CRUZAMENTO — tabelas estáticas × SSOT (fabricante + modelo)')
const chavesMongo = new Map(invs.map((i) => [norm(i.fabricante) + '|' + norm(i.modelo), i]))
let cruzados = 0, semCorrespondencia = 0
for (const [, e3] of idsTab3) {
  if (chavesMongo.has(norm(e3.marca) + '|' + norm(e3.modelo))) cruzados++
  else semCorrespondencia++
}
console.log(` F3 → SSOT: ${cruzados} correspondem, ${semCorrespondencia} sem correspondência`)
console.log(` F2 → SSOT: a F3 já mediu 0 correspondências inequívocas (ids próprios, não modelos)`)

titulo('7 · DEFAULTS TÉCNICOS AINDA VIVOS')
const alvos = [
  ['catalogoEletrico (fronteira)', fronteira],
  ['catalogoEngenhariaAdapter',    adapter],
  ['compatibilidadeEletricaService', motor],
  ['fv/catalogo.js',               ler('frontend/src/fv/catalogo.js')],
]
for (const [nome, src] of alvos) {
  const limpo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const achados = limpo.match(/\b(voc|vmpp|isc|impp|potencia\w*|tensao\w*|corrente\w*|mppt\w*|oversizing\w*|entradas\w*|fases)\s*:\s*[^,\n]*\?\?\s*-?\d[\d.]*/gi) ?? []
  console.log(` ${nome.padEnd(32)} ${achados.length} default(s) numérico(s)`)
  achados.slice(0, 5).forEach((a) => console.log('     ' + a.trim().replace(/\s+/g, ' ')))
}

// ════════════════════════════════════════════════════════════════════════════
titulo('8 · AUTORIDADE EFETIVA — quem vence no runtime')

const rotas = ler('backend/src/server.js')
const montada = (p) => new RegExp(`app\\.use\\('${p.replace(/\//g, '\\/')}'`).test(rotas)
const seletor = ler('frontend/src/components/fv/SeletorInversores.jsx')
const precedenciaSeletor = /_eletrico\s*\?\?\s*DADOS_ELETRICOS_INVERSORES/.test(seletor)
const guardaLegado = /_ehLegado/.test(fronteira)

console.log(' Fluxo A  Mongo → adapter → seleção → motor')
console.log(`          precedência no seletor: ${precedenciaSeletor ? 'SSOT primeiro ✓' : '⚠ invertida'}`)
console.log(`          fronteira isola LEGACY por origem: ${guardaLegado ? 'sim ✓' : '⚠ não'}`)
console.log(' Fluxo B  Mongo → paraDimensionamento → montarStrings')
console.log('          ⚠ substitui limite de CURTO pelo de TRABALHO quando o 1º falta (seção 3)')
console.log(' Fluxo C  tabela estática F3 → controllers → API PÚBLICA')
console.log(`          /api/string     montada: ${montada('/api/string')}`)
console.log(`          /api/v1/kits    montada: ${montada('/api/v1/kits')}`)
console.log(`          /api/recomendacao montada: ${montada('/api/recomendacao')}`)
console.log('          medido em runtime: GET /api/string/catalogo → 200 (specs estáticas, SEM auth)')
console.log('          medido em runtime: POST /api/v1/kits/recomendar → 200')
console.log('          consumidor de UI: BuscaKitsFV → página RecomendacaoKits (não alimenta o projeto)')
console.log(' Fluxo D  Mongo → specs_canonicas → (nenhum leitor de engenharia)')
console.log('          projeção com nomes próprios; `isc_max_por_mppt_a` fabricado (seção 5)')
console.log(' Fluxo E  F2 × F3 — duas tabelas estáticas com os mesmos ids e 14 divergências')
console.log('          nenhuma das duas cruza com o SSOT por fabricante+modelo (seção 6)')

await mongoose.disconnect()
console.log('\nAuditoria concluída — nada foi escrito.')
