/**
 * preflight-staging.mjs — o ambiente está coerente e isolado? — FV-INFRA-059.
 *
 * Roda ANTES de subir ou publicar. Lê apenas variáveis de ambiente e arquivos do
 * repositório: **não conecta em banco, não chama rede, não imprime segredo**.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 * A auditoria desta sprint encontrou o caso que ele previne: `backend/.env`
 * tem `MONGODB_URI` apontando para o Atlas de PRODUÇÃO e `NODE_ENV=development`.
 * Subir o backend sem exportar uma URI explícita conecta na base real. A guarda
 * da FV-INFRA-058 (`exigirBancoDeQa`) protege os scripts de seed; o boot do
 * servidor não passava por ela.
 *
 *   node backend/scripts/preflight-staging.mjs            # usa o ambiente atual
 *   APP_AMBIENTE=staging node backend/scripts/preflight-staging.mjs
 *
 * Saída 0 = pode subir. Qualquer outra = não suba.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { avaliarUriQa, mascararUri } from '../src/config/bancoQa.js'
import { ambiente, normalizarOrigem, origensPermitidas } from '../src/config/origens.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')

let erros = 0
let avisos = 0
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) erros++ }
const aviso = (c, m) => { console.log((c ? '  ✓ ' : '  ⚠ ') + m); if (!c) avisos++ }
const secao = (t) => console.log(`\n${t}`)

const AMB = ambiente()
const ehQa = AMB === 'staging'

console.log(`═══ preflight · ambiente declarado: ${AMB} ═══`)
if (!ehQa) {
  console.log('\n⚠ APP_AMBIENTE não é `staging`. As verificações de isolamento de QA')
  console.log('  rodam mesmo assim, mas as obrigatórias de staging viram avisos.')
}
const exigir = ehQa ? ok : aviso

// ═══ 1 · Origem pública ════════════════════════════════════════════════════
secao('1 · Origem pública e CORS')
{
  const bruta = process.env.APP_URL || process.env.FRONTEND_URL || ''
  const origem = normalizarOrigem(bruta)
  exigir(!!origem, origem
    ? `APP_URL resolvida: ${origem}`
    : 'APP_URL ausente ou ilegível — em staging o processo não sobe')

  if (origem) {
    exigir(!/localhost|127\.0\.0\.1/.test(origem),
      /localhost|127\.0\.0\.1/.test(origem)
        ? `APP_URL aponta para ${origem} — um link enviado ao cliente seria inútil`
        : 'APP_URL não é localhost')
    exigir(origem.startsWith('https://'),
      origem.startsWith('https://') ? 'APP_URL usa https' : `APP_URL não usa https (${origem})`)

    let permitidas = []
    try { permitidas = [...origensPermitidas()] } catch { /* já reportado acima */ }
    ok(permitidas.length > 0, `allowlist de CORS: ${permitidas.join(', ') || '(vazia)'}`)
    ok(!permitidas.some((o) => /localhost/.test(o)) || !ehQa,
      'a allowlist de staging não contém localhost')
  }
}

// ═══ 2 · Banco ═════════════════════════════════════════════════════════════
secao('2 · Banco — isolamento de produção')
{
  const uri = process.env.MONGODB_URI || ''
  const r = avaliarUriQa(uri)
  ok(!!uri, uri ? `MONGODB_URI presente: ${mascararUri(uri)}` : 'MONGODB_URI ausente')

  if (uri) {
    exigir(r.permitida, r.permitida
      ? `banco aceito para QA (${r.info?.base || 'sem nome'})`
      : `RECUSADO (${r.codigo}) — ${r.motivo}`)
    if (r.info) {
      exigir(!r.info.local, r.info.local
        ? 'o banco é local — um staging publicado precisa de banco alcançável'
        : `host remoto: ${r.info.host}`)
    }
    ok(String(process.env.USE_MEMORY_STORAGE || '').toLowerCase() !== 'true',
      '`USE_MEMORY_STORAGE` desligado — staging precisa persistir de verdade')
  }

  // O caso encontrado na auditoria: `.env` do repositório com URI de produção.
  const envLocal = path.join(RAIZ, 'backend/.env')
  if (existsSync(envLocal)) {
    const linha = readFileSync(envLocal, 'utf8')
      .split('\n').find((l) => l.trim().startsWith('MONGODB_URI='))
    const doArquivo = linha ? linha.slice('MONGODB_URI='.length).trim() : ''
    const rArq = doArquivo ? avaliarUriQa(doArquivo) : null
    aviso(!rArq || rArq.permitida,
      rArq && !rArq.permitida
        ? 'backend/.env tem MONGODB_URI de PRODUÇÃO — só é seguro subir com MONGODB_URI '
          + 'exportada por cima. Nunca use `dotenv` sozinho em staging.'
        : 'backend/.env não carrega URI de produção')
  }
}

// ═══ 3 · Segredos ══════════════════════════════════════════════════════════
secao('3 · Segredos')
{
  exigir(!!process.env.JWT_SECRET, process.env.JWT_SECRET
    ? 'JWT_SECRET definido' : 'JWT_SECRET ausente — a aplicação não inicia')
  const s = process.env.JWT_SECRET || ''
  if (s) {
    exigir(s.length >= 32,
      s.length >= 32 ? 'JWT_SECRET com comprimento razoável'
        : `JWT_SECRET curto (${s.length} caracteres) — use um segredo próprio de staging`)
    const exemplo = /validacao_fv|dev-key|changeme|secret123/i.test(s)
    exigir(!exemplo, exemplo
      ? 'JWT_SECRET é um valor de exemplo/desenvolvimento — emita um próprio de staging'
      : 'JWT_SECRET não é um valor de exemplo')
  }

  const smtpUser = process.env.SMTP_USER ?? ''
  const smtpPass = process.env.SMTP_PASS ?? ''
  aviso(smtpUser === '' && smtpPass === '',
    smtpUser === '' && smtpPass === ''
      ? 'SMTP vazio — nenhum e-mail sai de staging (recomendado)'
      : 'SMTP CONFIGURADO em staging: e-mails serão enviados de verdade. '
        + 'Se essa credencial for a de produção, pare.')

  for (const nome of ['ANTHROPIC_API_KEY', 'SOLARMARKET_API_KEY', 'ADMIN_API_KEY']) {
    const v = process.env[nome] ?? ''
    aviso(v === '' || !/SUBSTITUA|dev-key-123|seu-valor/i.test(v),
      v === '' ? `${nome} ausente — recursos que dependem dela ficam inativos`
        : `${nome} ainda com valor de exemplo`)
  }
}

// ═══ 4 · Bundle do frontend ════════════════════════════════════════════════
secao('4 · Frontend')
{
  const envStaging = path.join(RAIZ, 'frontend/.env.staging')
  ok(existsSync(envStaging), '`frontend/.env.staging` existe')
  if (existsSync(envStaging)) {
    const t = readFileSync(envStaging, 'utf8')
    exigir(!/SUBSTITUA/.test(t),
      /SUBSTITUA/.test(t)
        ? '`.env.staging` ainda tem placeholders — preencha antes do build'
        : '`.env.staging` preenchido')
    ok(!/fortesolar\.com\.br|railway\.app/.test(t),
      '`.env.staging` não aponta para produção')
  }
  ok(existsSync(path.join(RAIZ, 'frontend/vercel.staging.json')),
    '`vercel.staging.json` existe (SPA fallback sem proxy para produção)')

  const dist = path.join(RAIZ, 'frontend/dist')
  aviso(!existsSync(dist),
    existsSync(dist)
      ? '`frontend/dist` existe de um build anterior — rode `npm run build:staging` '
        + 'e `verificar:bundle staging` antes de publicar'
      : 'sem `dist` residual')
}

// ═══ Veredito ══════════════════════════════════════════════════════════════
console.log(`\n${'─'.repeat(60)}`)
if (erros > 0) {
  console.log(`✗ ${erros} bloqueio(s)${avisos ? ` e ${avisos} aviso(s)` : ''}. NÃO suba este ambiente.`)
  process.exit(1)
}
console.log(avisos > 0
  ? `✓ sem bloqueios · ${avisos} aviso(s) para conferir antes de publicar.`
  : '✓ ambiente coerente e isolado.')
process.exit(0)
