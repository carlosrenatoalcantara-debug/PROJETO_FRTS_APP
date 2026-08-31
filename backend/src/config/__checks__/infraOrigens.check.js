/**
 * infraOrigens.check.js — FV-INFRA-058
 *
 * Cobre as duas barreiras que separam o ambiente de QA da produção:
 * a allowlist de CORS e a guarda do banco. Puro, sem rede e sem banco.
 *
 *   node backend/src/config/__checks__/infraOrigens.check.js
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
const ler = (rel) => { try { return readFileSync(path.resolve(RAIZ, rel), 'utf8') } catch { return '' } }

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)

/** Reimporta o módulo com o ambiente trocado — as funções leem `process.env` na chamada. */
const comEnv = async (env, fn) => {
  const antes = { ...process.env }
  for (const k of ['APP_URL', 'FRONTEND_URL', 'APP_AMBIENTE', 'NODE_ENV', 'CORS_ORIGENS']) delete process.env[k]
  Object.assign(process.env, env)
  try { return await fn(await import('../origens.js')) }
  finally { for (const k of Object.keys(process.env)) delete process.env[k]; Object.assign(process.env, antes) }
}

console.log('═══ FV-INFRA-058 — origens e banco de QA ═══')

// ═══ 1 · CORS: origem exata, nunca substring ═══════════════════════════════
secao('1 · CORS por igualdade de origem')
await comEnv({ APP_AMBIENTE: 'staging', APP_URL: 'https://staging.exemplo.com' }, async (O) => {
  ok(O.origemPermitida('https://staging.exemplo.com') === true, 'origem autorizada passa')
  ok(O.origemPermitida('https://outro.exemplo.com') === false, 'origem não autorizada é recusada')

  // O defeito medido: `origin.includes('localhost')` liberava todos estes.
  for (const hostil of [
    'https://localhost.dominio-malicioso.com',
    'https://staging.exemplo.com.malicioso.net',
    'http://localhost.evil.io',
    'https://127.0.0.1.evil.io',
  ]) ok(O.origemPermitida(hostil) === false, `recusa \`${hostil}\``)

  ok(O.origemPermitida('http://localhost:5173') === false,
    'em staging, localhost NÃO é autorizado')
  ok(O.origemPermitida(undefined) === true,
    'requisição sem `Origin` (curl, health check) passa — não há navegador a proteger')
  ok(O.origemPermitida('https://staging.exemplo.com/') === true,
    'barra final é normalizada, não vira origem diferente')
  ok(O.origemPermitida('não-é-url') === false, 'texto ilegível é recusado')
  ok(O.origemPermitida('ftp://staging.exemplo.com') === false, 'protocolo não-http é recusado')
})

// ═══ 2 · CORS_ORIGENS ══════════════════════════════════════════════════════
secao('2 · Origens extras declaradas')
await comEnv({
  APP_AMBIENTE: 'staging', APP_URL: 'https://staging.exemplo.com',
  CORS_ORIGENS: 'https://qa.exemplo.com, https://preview.exemplo.com , lixo',
}, async (O) => {
  const p = O.origensPermitidas()
  ok(p.has('https://qa.exemplo.com') && p.has('https://preview.exemplo.com'), 'extras entram na allowlist')
  ok(p.size === 3, `entrada ilegível é descartada, não aproximada (${p.size} origens)`)
})

// ═══ 3 · Fail-closed ═══════════════════════════════════════════════════════
secao('3 · Sem APP_URL, staging e produção não sobem')
for (const amb of ['staging', 'production']) {
  await comEnv({ APP_AMBIENTE: amb }, async (O) => {
    let e = null
    try { O.origemPublica() } catch (err) { e = err }
    ok(e?.codigo === 'ORIGEM_NAO_CONFIGURADA', `${amb} sem APP_URL → ${e?.codigo}`)
    ok(/APP_URL é obrigatória/.test(e?.message ?? ''), 'e a mensagem diz o que fazer')
    ok(!/localhost:5173/.test(e?.message?.split('\n')[0] ?? ''), 'sem sugerir cair em localhost')
  })
}
await comEnv({ APP_AMBIENTE: 'development' }, async (O) => {
  ok(O.origemPublica() === 'http://localhost:5173', 'em desenvolvimento há valor local explícito')
  ok(O.origemPermitida('http://localhost:5175') === true, 'e as portas locais conhecidas passam')
  ok(O.origemPermitida('https://localhost.evil.io') === false,
    'mas `localhost.evil.io` continua recusado mesmo em desenvolvimento')
})

// ═══ 4 · Link público nasce da fonte única ═════════════════════════════════
secao('4 · URL pública')
await comEnv({ APP_AMBIENTE: 'staging', APP_URL: 'https://staging.exemplo.com' }, async (O) => {
  ok(O.urlPublica('/proposta/abc') === 'https://staging.exemplo.com/proposta/abc', 'link da proposta')
  ok(O.urlPublica('proposta/abc') === 'https://staging.exemplo.com/proposta/abc', 'barra inicial opcional')
})
await comEnv({ APP_AMBIENTE: 'staging', FRONTEND_URL: 'https://legado.exemplo.com' }, async (O) => {
  ok(O.origemPublica() === 'https://legado.exemplo.com', '`FRONTEND_URL` segue valendo como alias legado')
})

// ═══ 5 · Nenhum consumidor manteve o fallback antigo ═══════════════════════
secao('5 · O `:5173` sumiu dos pontos de uso')
{
  for (const rel of [
    'backend/src/services/EnvioPropostaService.js',
    'backend/src/routes/gestao.js',
    'backend/src/security/security-headers.js',
    'backend/src/server.js',
  ]) {
    const fonte = ler(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    ok(!/process\.env\.APP_URL|process\.env\.FRONTEND_URL/.test(fonte),
      `${path.basename(rel)} não lê a variável direto`)
    ok(!/localhost:5173/.test(fonte), `${path.basename(rel)} sem fallback \`:5173\``)
  }
  const srv = ler('backend/src/server.js')
  ok(!/origin\.includes\(/.test(srv), 'server.js não usa mais `origin.includes`')
  ok(!/projeto-frts-app\.vercel\.app/.test(srv), 'e a origem de produção não está literal no código')

  const ctrl = ler('backend/src/controllers/projetosFVController.js')
  ok(!/process\.env\.APP_URL/.test(ctrl), 'o controller devolve o link pela fonte única')
}

// ═══ 6 · Banco de QA ═══════════════════════════════════════════════════════
secao('6 · A URI de QA não pode ser a de produção')
{
  const { avaliarUriQa, exigirBancoDeQa, mascararUri } = await import('../bancoQa.js')

  ok(avaliarUriQa('mongodb://127.0.0.1:37017/forte_solar_validacao').permitida, 'local passa')
  ok(avaliarUriQa('mongodb://localhost:27017/qualquer').permitida, 'localhost em outra porta também')

  const prod = avaliarUriQa('mongodb+srv://u:s@cluster0.abc.mongodb.net/forte_solar')
  ok(prod.permitida === false && prod.codigo === 'BANCO_DE_PRODUCAO',
    `Atlas com banco \`forte_solar\` é recusado (${prod.codigo})`)

  ok(avaliarUriQa('mongodb+srv://u:s@cluster0.abc.mongodb.net/forte_solar_staging').permitida,
    'Atlas com banco `…_staging` é aceito')
  ok(avaliarUriQa('mongodb+srv://u:s@c.abc.mongodb.net/fv_qa').permitida, '`fv_qa` também')
  ok(avaliarUriQa('mongodb+srv://u:s@c.abc.mongodb.net/forte_solar',
    { QA_URI_REMOTA_AUTORIZADA: 'sim' }).permitida,
    'autorização explícita libera — é decisão consciente, não default')

  ok(avaliarUriQa('').codigo === 'URI_ILEGIVEL', 'URI vazia é recusada')
  ok(avaliarUriQa('postgres://x/y').codigo === 'URI_ILEGIVEL', 'URI não-Mongo é recusada')

  let e = null
  try { exigirBancoDeQa('mongodb+srv://u:senha@cluster0.abc.mongodb.net/forte_solar') }
  catch (err) { e = err }
  ok(e?.codigo === 'BANCO_DE_PRODUCAO', 'exigirBancoDeQa lança')
  ok(!/senha/.test(e?.message ?? ''), 'e a mensagem NÃO vaza a credencial')
  ok(mascararUri('mongodb://u:senha@h/b') === 'mongodb://***@h/b', 'máscara cobre usuário e senha')

  // Comentários fora: o cabeçalho do seed CITA a trava antiga para explicar por
  // que ela saiu, e uma busca crua acusaria a própria explicação.
  const seed = ler('backend/scripts/seed-catalogo-fv-ux-027.mjs')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  ok(/exigirBancoDeQa/.test(seed), 'o seed passa pela guarda')
  ok(!/includes\('37017'\)/.test(seed), 'e não está mais preso à porta 37017')
  ok(/process\.env\.MONGODB_URI/.test(seed), 'e aceita a URI do ambiente')
}

// ═══ 6b · Guarda no BOOT, não só nos scripts ═══════════════════════════════
secao('6b · O boot de staging recusa banco de produção (FV-INFRA-059)')
{
  const db = ler('backend/src/config/database.js')
  ok(/APP_AMBIENTE.*staging/s.test(db), '`conectarBD` verifica se o ambiente é staging')
  ok(/avaliarUriQa/.test(db), 'e avalia a URI antes de conectar')
  ok(/BANCO_DE_PRODUCAO/.test(db), 'lançando com código próprio')
  // A guarda NÃO pode agir em produção nem em desenvolvimento.
  const bloco = db.slice(db.indexOf('FV-INFRA-059'), db.indexOf('USE_MEMORY_STORAGE) {'))
  ok(!/production/.test(bloco), 'a guarda não age em produção — só quando o ambiente se declara staging')

  const pf = ler('backend/scripts/preflight-staging.mjs')
  ok(/avaliarUriQa/.test(pf) && /origensPermitidas/.test(pf),
    'o preflight cobre banco e origens')
  ok(!/mongoose\.connect|fetch\(/.test(pf), 'e não conecta em nada — só lê configuração')
  ok(/mascararUri/.test(pf), 'mascarando a URI ao reportar')
}

// ═══ 7 · Secrets fora do versionamento ═════════════════════════════════════
secao('7 · Segredos nos arquivos de exemplo')
{
  const ex = ler('backend/.env.example')
  ok(!/6059:iQANRfzf/.test(ex), '`.env.example` sem a chave SolarMarket real')
  ok(/SOLARMARKET_API_KEY=SUBSTITUA/.test(ex), 'e com placeholder no lugar')
  ok(!/sk-ant-[A-Za-z0-9_-]{20,}/.test(ex), 'sem chave Anthropic real')
  ok(/APP_URL/.test(ex) && /CORS_ORIGENS/.test(ex), 'as variáveis novas estão documentadas')

  const stg = ler('frontend/.env.staging')
  ok(/VITE_API_URL=/.test(stg), '`.env.staging` existe e define a API')
  ok(!/fortesolar\.com\.br/.test(stg), 'e NÃO aponta para produção')
}

console.log(falhas === 0
  ? '\nOK — CORS fechado por origem exata, origem pública única, banco de QA protegido.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
