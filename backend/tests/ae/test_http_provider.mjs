/**
 * test_http_provider.mjs — F8 da integração AE ⇄ Forte Solar
 *
 * Prova que o adaptador HTTP é INTERCAMBIÁVEL com o de diretório: mesmo
 * contrato, mesma saída, e a Auditoria Rápida produz o mesmo relatório com
 * qualquer um dos dois.
 *
 * `fetch` é injetado — nenhuma rede é usada.
 *
 * Execução:
 *   node tests/ae/test_http_provider.mjs
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertProvider } from '../../src/integracoes/ae/IAEProvider.js'
import { criarAeHttpProvider } from '../../src/integracoes/ae/aeHttpProvider.js'
import { criarAeLocalFolderProvider } from '../../src/integracoes/ae/aeLocalFolderProvider.js'
import { criarProviderAE, providerConfigurado } from '../../src/integracoes/ae/index.js'
import { criarAuditoriaRapidaService } from '../../src/services/auditoriaRapidaService.js'

let passed = 0
let failed = 0

function assert(descricao, condicao, detalhes = '') {
  if (condicao) {
    console.log(`  ✅ ${descricao}`)
    passed++
  } else {
    console.error(`  ❌ ${descricao}${detalhes ? `\n     ${detalhes}` : ''}`)
    failed++
  }
}

function secao(titulo) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${titulo}`)
  console.log('─'.repeat(60))
}

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'ae')

// ─── AE simulado (mesmo conteúdo das fixtures de disco) ──────────────────────

const INDICE_REMOTO = [
  { familia: 'modulo', Manufacturer: 'Trina', Model: 'TSM-610-NEG9R.28', KnowledgeVersion: '1.2.0', ref: 'modulos/Trina/TSM-610-NEG9R.28' },
  { familia: 'inversor', fabricante: 'Growatt', modelo: 'MAX 100KTL3', knowledgeVersion: '2.0.1', ref: 'inversores/Growatt/MAX-100KTL3' },
  // Fora do escopo do AE: deve ser descartado pelo adaptador.
  { familia: 'cabo', fabricante: 'Nexans', modelo: '6mm', knowledgeVersion: '9.9.9', ref: 'cabos/Nexans/6mm' },
  // Sem ref: inutilizável, descartado.
  { familia: 'bateria', fabricante: 'X', modelo: 'Y', knowledgeVersion: '1.0' },
]

const DATASHEETS_REMOTOS = {
  'modulos/Trina/TSM-610-NEG9R.28': {
    Origin: 'AE', DocumentType: 'Technical Datasheet', familia: 'modulo',
    Manufacturer: 'Trina', Model: 'TSM-610-NEG9R.28', KnowledgeVersion: '1.2.0',
    LastAudit: '2026-07-20', Confidence: '0.96',
    // Mesmo conteúdo da fixture de disco — a comparação de
    // intercambiabilidade só é válida se a entrada for idêntica.
    dados: {
      potencia_w: 610,
      voc_v: 41.5,
      vmpp_v: 34.7,
      isc_a: 18.6,
      impp_a: 17.6,
      eficiencia_pct: 22.5,
      numero_celulas: 132,
      bifacial: true,
    },
  },
}

function fetchFake(registro = []) {
  return async (url) => {
    registro.push(url)
    const u = new URL(url)
    if (u.pathname.endsWith('/library/index')) {
      return { ok: true, status: 200, json: async () => ({ itens: INDICE_REMOTO }) }
    }
    if (u.pathname.endsWith('/library/datasheet')) {
      const ref = u.searchParams.get('ref')
      if (!DATASHEETS_REMOTOS[ref]) return { ok: false, status: 404 }
      return { ok: true, status: 200, json: async () => DATASHEETS_REMOTOS[ref] }
    }
    return { ok: false, status: 500 }
  }
}

// ─── 1. Contrato ─────────────────────────────────────────────────────────────

secao('1. Contrato e configuração')

const chamadas = []
const http = criarAeHttpProvider({ baseUrl: 'https://ae.exemplo/', fetchImpl: fetchFake(chamadas) })

assert('cumpre o contrato IAEProvider', assertProvider(http) === http)
assert('descreve origem http', http.descrever().tipo === 'http')

let erroBase = null
try { criarAeHttpProvider({ fetchImpl: fetchFake() }) } catch (e) { erroBase = e }
assert('exige baseUrl', erroBase !== null)

assert('AE_URL habilita a integração', providerConfigurado({ AE_URL: 'https://ae.exemplo' }))
const viaFactory = criarProviderAE({ AE_PROVIDER: 'http', AE_URL: 'https://ae.exemplo' })
assert('factory devolve o adaptador http', viaFactory.descrever().tipo === 'http')

let erroSemUrl = null
try { criarProviderAE({ AE_PROVIDER: 'http' }) } catch (e) { erroSemUrl = e }
assert('AE_PROVIDER=http sem AE_URL falha', erroSemUrl !== null)

// ─── 2. Índice ───────────────────────────────────────────────────────────────

secao('2. Índice remoto')

const indice = await http.listarIndice()

assert('indexa apenas famílias do escopo', indice.length === 2,
  `obtido ${indice.length}: ${JSON.stringify(indice.map(i => i.ref))}`)
assert('descarta família fora do escopo (cabo)', !indice.some(i => /cabos/.test(i.ref)))
assert('descarta item sem ref', !indice.some(i => i.ref === undefined || i.ref === 'undefined'))
assert('tolera grafia Manufacturer/Model', indice[0].fabricante === 'Trina' && indice[0].modelo === 'TSM-610-NEG9R.28')
assert('tolera grafia KnowledgeVersion', indice[0].knowledgeVersion === '1.2.0')
assert('tolera grafia minúscula', indice[1].fabricante === 'Growatt' && indice[1].knowledgeVersion === '2.0.1')
assert('barra final da baseUrl não duplica', chamadas[0] === 'https://ae.exemplo/library/index')

// ─── 3. Datasheet ────────────────────────────────────────────────────────────

secao('3. Datasheet remoto')

const ds = await http.obterDatasheet('modulos/Trina/TSM-610-NEG9R.28')
assert('origin normalizado', ds.origin === 'AE')
assert('familia resolvida', ds.familia === 'modulo')
assert('confidence convertido para número', ds.confidence === 0.96)
assert('dados técnicos preservados', ds.dados.potencia_w === 610)
assert('ref ecoada', ds.ref === 'modulos/Trina/TSM-610-NEG9R.28')

let erro404 = null
try { await http.obterDatasheet('inexistente') } catch (e) { erro404 = e }
assert('404 vira AE_DATASHEET_AUSENTE', erro404?.code === 'AE_DATASHEET_AUSENTE')

let erroRede = null
try {
  await criarAeHttpProvider({
    baseUrl: 'https://ae.exemplo',
    fetchImpl: async () => { throw new Error('conexão recusada') },
  }).listarIndice()
} catch (e) { erroRede = e }
assert('falha de rede vira AE_INDISPONIVEL', erroRede?.code === 'AE_INDISPONIVEL')

let erroTimeout = null
try {
  await criarAeHttpProvider({
    baseUrl: 'https://ae.exemplo',
    timeoutMs: 10,
    fetchImpl: (_u, opts) => new Promise((_r, rej) => {
      opts.signal.addEventListener('abort', () => {
        const e = new Error('abortado'); e.name = 'AbortError'; rej(e)
      })
    }),
  }).listarIndice()
} catch (e) { erroTimeout = e }
assert('timeout vira AE_TIMEOUT', erroTimeout?.code === 'AE_TIMEOUT')

// ─── 4. Intercambiabilidade ──────────────────────────────────────────────────

secao('4. Intercambiabilidade — mesmo relatório com qualquer adaptador')

const catalogo = [{
  _id: 'm1', tipo: 'modulo', fabricante: 'Trina', modelo: 'TSM-610-NEG9R.28',
  preco_sugerido: 900,
  specs_canonicas: { potencia_w: 600, eficiencia_pct: null },
  origem: { tipo: 'manual', knowledge_version: '1.0.0' },
}]

const relatorioDe = async (provider) => criarAuditoriaRapidaService({
  provider,
  listarEquipamentos: async () => catalogo.map(e => JSON.parse(JSON.stringify(e))),
}).executar()

const relHttp = await relatorioDe(criarAeHttpProvider({ baseUrl: 'https://ae.exemplo', fetchImpl: fetchFake() }))
const relDisco = await relatorioDe(criarAeLocalFolderProvider({ raiz: RAIZ }))

assert('mesmo total de atualizações', relHttp.total_atualizacoes === relDisco.total_atualizacoes)
assert('mesmo total por família',
  JSON.stringify(relHttp.totais_por_familia) === JSON.stringify(relDisco.totais_por_familia))

const camposHttp = relHttp.atualizacoes[0]?.campos.map(c => `${c.campo}:${c.status}`).sort()
const camposDisco = relDisco.atualizacoes[0]?.campos.map(c => `${c.campo}:${c.status}`).sort()
assert('mesmas mudanças propostas', JSON.stringify(camposHttp) === JSON.stringify(camposDisco),
  `http=${JSON.stringify(camposHttp)} disco=${JSON.stringify(camposDisco)}`)
assert('mesma versão de destino',
  relHttp.atualizacoes[0]?.versao_ae === relDisco.atualizacoes[0]?.versao_ae)
assert('o serviço não vaza o adaptador na decisão',
  relHttp.provider.tipo === 'http' && relDisco.provider.tipo === 'local-folder')

// ─── Resultado ───────────────────────────────────────────────────────────────

const sep = '═'.repeat(60)
console.log(`\n${sep}`)
console.log(`  RESULTADO: ${passed} ✅  |  ${failed} ❌  |  Total: ${passed + failed}`)
console.log(sep)

if (failed > 0) {
  console.error(`\n  ${failed} teste(s) falharam. Ver detalhes acima.`)
  process.exit(1)
} else {
  console.log('\n  F8 validada — adaptador HTTP intercambiável com o de disco. ✅')
}
