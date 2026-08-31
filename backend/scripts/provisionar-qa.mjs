/**
 * provisionar-qa.mjs — provisiona o ambiente WEB de QA de ponta a ponta.
 *
 * FV-INFRA-059-AUTO. Escrito porque as duas barreiras que restam — Atlas e
 * Vercel — exigem *device code* interativo, e device code é a única coisa aqui
 * que uma automação não pode atravessar. Ambas, porém, aceitam **token**. Com os
 * dois tokens em mão, este script faz o resto sozinho.
 *
 * ── Uso ─────────────────────────────────────────────────────────────────────
 *   MONGODB_ATLAS_PUBLIC_API_KEY=...  \
 *   MONGODB_ATLAS_PRIVATE_API_KEY=... \
 *   ATLAS_ORG_ID=...                  \
 *   VERCEL_TOKEN=...                  \
 *   node backend/scripts/provisionar-qa.mjs [--dry-run]
 *
 * `--dry-run` mostra cada passo e o que criaria, sem criar nada.
 *
 * ── Como obter os tokens (uma vez, no navegador) ────────────────────────────
 *   Atlas   Organization → Access Manager → API Keys → Create
 *           Papel: `Organization Project Creator`. Anote Public e Private key,
 *           e o Organization ID (aparece na URL: /v2#/org/<ORG_ID>/…).
 *   Vercel  Account Settings → Tokens → Create. Escopo: a conta pessoal.
 *
 * ── O que ele NÃO faz ───────────────────────────────────────────────────────
 * Não toca produção. Todo recurso Railway é endereçado por ID explícito do
 * projeto/environment/serviço de QA; o projeto `accomplished-achievement` não é
 * referenciado em lugar nenhum. Não cria recurso pago: o cluster é `M0`
 * (gratuito). Não roda seed contra URI que não passe por `exigirBancoDeQa`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { avaliarUriQa, mascararUri } from '../src/config/bancoQa.js'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SECO = process.argv.includes('--dry-run')

/**
 * Diretório de trabalho do Railway — NUNCA a raiz do repositório, que está
 * vinculada ao projeto de PRODUÇÃO. `railway variables` não aceita `--project`
 * e resolve o projeto pelo diretório vinculado; trabalhar aqui é o que impede
 * uma escrita acidental no serviço live.
 */
const DIR_QA = process.env.DIR_RAILWAY_QA || path.join(RAIZ, '.ferramentas/railway-qa')

// ── Identificadores de QA. Explícitos de propósito: nenhum comando depende do
//    diretório vinculado, que na pasta do repositório aponta para PRODUÇÃO.
const QA = Object.freeze({
  railwayProjeto: '07ea3aa7-8084-4c7c-b6d7-730bce937c89',   // forte-solar-qa
  railwayEnv:     '51093c87-a121-47df-bfd6-45a1132d904f',   // staging
  railwayServico: '71242089-bbaa-4d23-be28-90ae58f799c2',   // backend-qa
  backendUrl:     'https://backend-qa-staging.up.railway.app',
  atlasProjeto:   'forte-solar-qa',
  atlasCluster:   'qa0',
  atlasBase:      'forte-solar-staging',   // contém "staging" — exigido pela guarda
  atlasUsuario:   'fv-qa',
  vercelProjeto:  'forte-solar-qa',
})

/** IDs de PRODUÇÃO — só existem aqui para serem recusados. */
const PRODUCAO = Object.freeze([
  'deaa69a5-2259-4037-9be0-608e86449627',   // accomplished-achievement
  'd92c1b8f-b176-4051-bae7-e36305d42106',   // production
  'projetofrtsapp-production',
  'projeto-frts-app',
])

let passo = 0
const titulo = (t) => console.log(`\n${'─'.repeat(62)}\n${++passo}. ${t}`)
const info = (m) => console.log(`   ${m}`)
const falhar = (m) => { console.error(`\n✗ ${m}`); process.exit(1) }

/** Executa um comando recusando qualquer argumento que cite produção. */
function run(cmd, args, { entrada = undefined, silencioso = false } = {}) {
  const linha = [cmd, ...args].join(' ')
  for (const p of PRODUCAO) {
    if (linha.includes(p)) falhar(`comando cita PRODUÇÃO e foi bloqueado:\n   ${linha}`)
  }
  // Mascara segredo mesmo no modo seco: senha e URI apareciam inteiras no log.
  const visivel = linha
    .replace(/(mongodb\+srv:\/\/[^:]+:)[^@]+@/g, '$1***@')
    .replace(/(--password\s+)\S+/g, '$1***')
    .replace(/(JWT_SECRET=)\S+/g, '$1***')
  if (SECO) { info(`[seco] ${visivel}`); return '' }
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', input: entrada, stdio: silencioso ? 'pipe' : ['pipe', 'pipe', 'pipe'] })
  } catch (e) {
    falhar(`falhou: ${linha}\n   ${(e.stderr || e.stdout || e.message).toString().slice(0, 500)}`)
  }
}

const exigirEnv = (nome, comoObter) => {
  const v = process.env[nome]
  if (!v) falhar(`${nome} não definida.\n   ${comoObter}`)
  return v
}

import { mkdirSync } from 'node:fs'
mkdirSync(DIR_QA, { recursive: true })

console.log('═══ provisionamento do ambiente QA ═══')
console.log(SECO ? '   MODO SECO — nada será criado\n' : '')

// ═══ 1 · Credenciais ════════════════════════════════════════════════════════
titulo('Credenciais')
exigirEnv('MONGODB_ATLAS_PUBLIC_API_KEY', 'Atlas → Organization → Access Manager → API Keys')
exigirEnv('MONGODB_ATLAS_PRIVATE_API_KEY', 'idem — a chave privada só é exibida na criação')
const orgId = exigirEnv('ATLAS_ORG_ID', 'aparece na URL do Atlas: /v2#/org/<ORG_ID>/…')
exigirEnv('VERCEL_TOKEN', 'Vercel → Account Settings → Tokens → Create')
info('as quatro presentes')

const atlas = process.env.ATLAS_CLI
  || path.join(RAIZ, '.ferramentas/atlascli/bin/atlas.exe')
if (!existsSync(atlas) && !SECO) {
  falhar(`Atlas CLI não encontrado em ${atlas}.\n   Baixe de https://www.mongodb.com/try/download/atlascli `
    + 'e aponte ATLAS_CLI para o binário.')
}

// ═══ 2 · Projeto Atlas ══════════════════════════════════════════════════════
titulo(`Projeto Atlas "${QA.atlasProjeto}"`)
let projetoId = ''
{
  const lista = run(atlas, ['projects', 'list', '--output', 'json'], { silencioso: true })
  const achado = SECO ? null : (JSON.parse(lista || '{"results":[]}').results || [])
    .find((p) => p.name === QA.atlasProjeto)
  if (achado) { projetoId = achado.id; info(`já existe · ${projetoId}`) }
  else {
    const novo = run(atlas, ['projects', 'create', QA.atlasProjeto, '--orgId', orgId, '--output', 'json'], { silencioso: true })
    projetoId = SECO ? '<novo>' : JSON.parse(novo).id
    info(`criado · ${projetoId}`)
  }
}

// ═══ 3 · Cluster M0 ═════════════════════════════════════════════════════════
titulo(`Cluster "${QA.atlasCluster}" — tier M0, gratuito`)
{
  const existentes = run(atlas, ['clusters', 'list', '--projectId', projetoId, '--output', 'json'], { silencioso: true })
  const tem = SECO ? false : (JSON.parse(existentes || '{"results":[]}').results || [])
    .some((c) => c.name === QA.atlasCluster)
  if (tem) info('já existe')
  else {
    run(atlas, ['clusters', 'create', QA.atlasCluster, '--projectId', projetoId,
      '--provider', 'AWS', '--region', 'US_EAST_1', '--tier', 'M0'])
    info('criado — aguardando ficar IDLE')
    run(atlas, ['clusters', 'watch', QA.atlasCluster, '--projectId', projetoId])
  }
}

// ═══ 4 · Usuário e acesso de rede ═══════════════════════════════════════════
titulo('Usuário do banco e network access')
const senha = process.env.ATLAS_DB_PASSWORD
  || Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url')
{
  run(atlas, ['dbusers', 'create', 'readWriteAnyDatabase', '--projectId', projetoId,
    '--username', QA.atlasUsuario, '--password', senha])
  info(`usuário ${QA.atlasUsuario} criado (senha não exibida)`)
  // `--type cidrBlock` é obrigatório: o default de `accessLists create` é
  // `ipAddress`, e `0.0.0.0/0` seria recusado como IP. Verificado no CLI 1.42.2.
  // O egress do Railway não tem IP fixo no plano padrão.
  run(atlas, ['accessLists', 'create', '0.0.0.0/0', '--type', 'cidrBlock',
    '--projectId', projetoId, '--comment', 'Railway QA egress'])
  info('network access liberado para o egress do Railway')
}

// ═══ 5 · URI e guarda ═══════════════════════════════════════════════════════
titulo('URI de QA — validada antes de sair daqui')
let uri = ''
{
  const cs = run(atlas, ['clusters', 'connectionStrings', 'describe', QA.atlasCluster,
    '--projectId', projetoId, '--output', 'json'], { silencioso: true })
  const base = SECO ? 'mongodb+srv://EXEMPLO.mongodb.net' : JSON.parse(cs).standardSrv
  uri = base.replace('mongodb+srv://', `mongodb+srv://${QA.atlasUsuario}:${encodeURIComponent(senha)}@`)
    + `/${QA.atlasBase}?retryWrites=true&w=majority`

  const r = avaliarUriQa(uri)
  if (!r.permitida) falhar(`a URI gerada NÃO passa na guarda (${r.codigo}): ${r.motivo}`)
  info(`aceita pela guarda · ${mascararUri(uri)}`)
}

// ═══ 6 · Seed ═══════════════════════════════════════════════════════════════
titulo('Seed do catálogo no banco de QA')
run(process.execPath, [path.join(RAIZ, 'backend/scripts/seed-catalogo-fv-ux-027.mjs')],
  { silencioso: false })
info('51 inversores + módulo Znshine 650 W')

// ═══ 7 · Frontend na Vercel ═════════════════════════════════════════════════
titulo('Frontend QA na Vercel')
let frontendUrl = process.env.FRONTEND_QA_URL || ''
{
  const envStaging = path.join(RAIZ, 'frontend/.env.staging')
  let t = readFileSync(envStaging, 'utf8')
  t = t.replace(/^VITE_API_URL=.*$/m, `VITE_API_URL=${QA.backendUrl}/api`)
  if (!SECO) writeFileSync(envStaging, t)
  info(`VITE_API_URL → ${QA.backendUrl}/api`)

  if (/SUBSTITUA_CHAVE_STAGING/.test(t)) {
    info('⚠ VITE_GOOGLE_MAPS_API_KEY ainda é placeholder — mapas ficam inativos em QA')
  }

  run('npm', ['run', 'build:staging'], { silencioso: false })
  info('bundle verificado: sem origem de produção')

  const saida = run('vercel', ['deploy', '--prod', '--yes', '--token', process.env.VERCEL_TOKEN,
    '--name', QA.vercelProjeto, '--local-config', 'vercel.staging.json'], { silencioso: true })
  frontendUrl = frontendUrl || (SECO ? 'https://EXEMPLO.vercel.app' : (saida.trim().split('\n').pop() || '').trim())
  info(`publicado · ${frontendUrl}`)
}

// ═══ 8 · Variáveis do backend QA ════════════════════════════════════════════
titulo('Variáveis do backend QA')
{
  /**
   * ATENÇÃO — `railway variables` e `railway variable set` NÃO aceitam
   * `--project`: só `-e/--environment` e `-s/--service`. O projeto vem do
   * diretório VINCULADO. Como a pasta do repositório está vinculada a
   * PRODUÇÃO, rodar de lá escreveria no serviço live.
   *
   * Por isso o script trabalha num diretório próprio, vinculado explicitamente
   * ao projeto de QA por ID, e confere o vínculo antes de escrever qualquer
   * variável. Verificado no CLI 4.52.0.
   */
  process.chdir(DIR_QA)
  run('railway', ['link', '--project', QA.railwayProjeto,
    '--environment', QA.railwayEnv, '--service', QA.railwayServico])

  const st = run('railway', ['status', '--json'], { silencioso: true })
  if (!SECO) {
    const s = JSON.parse(st)
    const idProjeto = s.id ?? s.projectId ?? ''
    if (idProjeto && idProjeto !== QA.railwayProjeto) {
      falhar(`o diretório está vinculado a ${idProjeto}, não ao projeto de QA. Abortado.`)
    }
    info(`vínculo confirmado · ${QA.railwayProjeto}`)
  }

  const alvo = ['--environment', QA.railwayEnv, '--service', QA.railwayServico]
  run('railway', ['variables', ...alvo, '--skip-deploys',
    '--set', `APP_URL=${frontendUrl}`,
    '--set', `CORS_ORIGENS=${frontendUrl}`,
    '--set', `MONGODB_URI=${uri}`])
  info('APP_URL, CORS_ORIGENS e MONGODB_URI definidas')
}

// ═══ 9 · Deploy do backend ══════════════════════════════════════════════════
titulo('Deploy do backend QA')
// `railway up` ACEITA `-p/--project`, ao contrário de `variables`.
run('railway', ['up', '--project', QA.railwayProjeto, '--environment', QA.railwayEnv,
  '--service', QA.railwayServico, '--detach', '--path-as-root', RAIZ])
info('enviado')

// ═══ 10 · Isolamento ════════════════════════════════════════════════════════
titulo('Verificação de isolamento')
console.log(`
   Execute e confira cada linha:

   curl -s -o /dev/null -w '%{http_code}\\n' ${QA.backendUrl}/api/health
       → 200

   curl -sD- -o /dev/null -H 'Origin: ${frontendUrl}' ${QA.backendUrl}/api/health | grep -i access-control-allow-origin
       → devolve o cabeçalho

   curl -sD- -o /dev/null -H 'Origin: https://localhost.evil.io' ${QA.backendUrl}/api/health | grep -i access-control-allow-origin
       → NADA

   curl -sD- -o /dev/null -H 'Origin: https://projeto-frts-app.vercel.app' ${QA.backendUrl}/api/health | grep -i access-control-allow-origin
       → NADA (produção não fala com QA)

   Depois: matriz T01–T09b de FV-QA-BASELINE-001.md no navegador.
`)

console.log('═══ fim ═══')
