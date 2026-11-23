/**
 * verificar-bundle.mjs — o bundle aponta para o ambiente certo? — FV-INFRA-058.
 *
 * A FV-QA-057 mediu: `npm run build`, sem modo, gera um frontend que fala com
 * `https://fortesolar.com.br/api` — a API REAL. Publicar esse bundle num
 * ambiente de QA faria o teste escrever em produção.
 *
 * Este verificador roda DEPOIS do build e falha alto quando o bundle não
 * corresponde ao ambiente pretendido. É a única barreira automatizada entre um
 * build distraído e a base de produção.
 *
 *   node scripts/verificar-bundle.mjs staging
 *   node scripts/verificar-bundle.mjs production
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(RAIZ, 'dist')

/** Hosts de produção que NUNCA podem aparecer num bundle de staging. */
const HOSTS_PRODUCAO = [
  'fortesolar.com.br',
  'projeto-frts-app.vercel.app',
  'projetofrtsapp-production.up.railway.app',
]

/**
 * FV-INFRA-058b (defeito D): a lista antiga casava só a forma exata
 * `https://fortesolar.com.br`. Um bundle com `https://www.fortesolar.com.br`
 * passava limpo. Cada host passa a ser casado com `www.` opcional e porta
 * opcional, sobre http ou https.
 */
const padraoOrigem = (host) =>
  new RegExp(`https?://(?:www\\.)?${host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?::\\d+)?`, 'g')

/** Todas as formas do host encontradas no texto, sem repetição. */
function origensEncontradas(texto) {
  const achadas = new Set()
  for (const host of HOSTS_PRODUCAO) {
    for (const m of texto.matchAll(padraoOrigem(host))) achadas.add(m[0])
  }
  return [...achadas]
}

/** Placeholders que denunciam configuração não preenchida. */
const PLACEHOLDERS = ['SUBSTITUA-API-STAGING', 'SUBSTITUA_CHAVE_STAGING', 'your_google_maps_api_key']

const alvo = (process.argv[2] || '').trim().toLowerCase()
if (alvo !== 'staging' && alvo !== 'production') {
  console.error('Uso: node scripts/verificar-bundle.mjs <staging|production>')
  process.exit(2)
}

if (!existsSync(DIST)) {
  console.error(`✗ ${path.relative(RAIZ, DIST)} não existe — rode o build antes.`)
  process.exit(1)
}

/** Todo o JS e CSS emitidos, concatenados. */
function lerBundle(dir) {
  let texto = ''
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name)
    if (entrada.isDirectory()) texto += lerBundle(p)
    else if (/\.(js|css|html)$/.test(entrada.name)) texto += readFileSync(p, 'utf8')
  }
  return texto
}

const bundle = lerBundle(DIST)
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }

console.log(`═══ verificação do bundle · alvo: ${alvo} ═══`)

// ── 1 · Placeholders ────────────────────────────────────────────────────────
for (const p of PLACEHOLDERS) {
  ok(!bundle.includes(p), `sem placeholder \`${p}\` — configuração preenchida`)
}

// ── 2 · Origens ─────────────────────────────────────────────────────────────
const encontradas = origensEncontradas(bundle)

if (alvo === 'staging') {
  ok(encontradas.length === 0,
    encontradas.length === 0
      ? 'nenhuma origem de produção no bundle'
      : `origem(ns) de PRODUÇÃO no bundle de staging: ${encontradas.join(', ')}`)
} else {
  ok(encontradas.length > 0,
    encontradas.length > 0
      ? `bundle de produção aponta para produção: ${encontradas.join(', ')}`
      : 'bundle de produção NÃO contém nenhuma origem de produção — configuração perdida?')
}

// ── 3 · Sem segredo de servidor no bundle ───────────────────────────────────
// Só `VITE_*` deveria chegar ao cliente. Estes nomes são de servidor e, se
// aparecerem, algum `.env` foi lido pelo lado errado.
for (const nome of ['JWT_SECRET', 'MONGODB_URI', 'SMTP_PASS', 'ANTHROPIC_API_KEY', 'SOLARMARKET_API_KEY', 'ADMIN_API_KEY']) {
  ok(!bundle.includes(nome), `sem \`${nome}\` no bundle`)
}
ok(!/sk-ant-[A-Za-z0-9_-]{10,}/.test(bundle), 'sem chave Anthropic embutida')
ok(!/mongodb(\+srv)?:\/\//.test(bundle), 'sem URI de MongoDB embutida')

console.log(falhas === 0
  ? `\nOK — bundle coerente com \`${alvo}\`.`
  : `\n${falhas} FALHA(S) — NÃO publique este bundle.`)
process.exit(falhas === 0 ? 0 : 1)
