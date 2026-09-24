/**
 * catalogoComercialF9.check.js — F9.
 *
 * Trava a fronteira entre o DATASET COMERCIAL e o SSOT de engenharia.
 *
 * ── O que a auditoria encontrou ─────────────────────────────────────────────
 * `catalogoInversores.js` (41) e `catalogoPaineis.js` (38) não têm NENHUMA
 * correspondência com os 52 inversores do SSOT — 10 dos 14 fabricantes
 * coincidem, zero modelos. São datasets disjuntos, não duas versões do mesmo
 * dado. Não havia o que migrar nem o que reconciliar.
 *
 * O defeito real não era divergência de valor: era `kitRecommendationService`
 * rodando um QUARTO motor elétrico sobre esse dataset e devolvendo ao usuário
 * "✓ Validação elétrica OK (Voc, Vmpp, Isc dentro dos limites)". Esse motor
 * tolerava Voc 5% ACIMA do teto do fabricante, Vmpp 10% abaixo do piso MPPT e
 * corrente 10% acima do limite — e comparava Isc do módulo contra a corrente de
 * TRABALHO do inversor, a mesma confusão de grandezas que a F8 eliminou.
 *
 *   node backend/src/dominio/__checks__/catalogoComercialF9.check.js
 */
import path from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { recomendarKits } from '../../services/kitRecommendationService.js'
import { FONTE_COMERCIAL, COMPAT_NAO_AVALIADA } from '../../data/procedenciaComercial.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ler = (rel) => semComentarios(readFileSync(path.resolve(RAIZ, rel), 'utf8'))

const arquivos = []
const anda = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n)
  if (statSync(p).isDirectory()) { if (n === '__checks__' || n === '__tests__' || n === 'node_modules') continue; anda(p) }
  else if (n.endsWith('.js')) arquivos.push(p) } }
anda(path.resolve(RAIZ, 'backend/src'))

secao('1 · A saída comercial se declara comercial')
const r = recomendarKits({ potencia_kwp: 5 })
ok(r.fonte === FONTE_COMERCIAL, `resposta traz \`fonte: '${FONTE_COMERCIAL}'\``)
ok(r.compatibilidade_eletrica === COMPAT_NAO_AVALIADA,
  `e \`compatibilidade_eletrica: '${COMPAT_NAO_AVALIADA}'\``)
ok(r.top10.length > 0, 'sanidade — o recomendador ainda devolve candidatos (feature preservada)')
ok(r.top10.every((k) => k.fonte === FONTE_COMERCIAL && k.compatibilidade_eletrica === COMPAT_NAO_AVALIADA),
  'e o rótulo viaja em CADA candidato, não só no topo')

secao('2 · Nenhum veredito técnico sai desta camada')
const textoSaida = JSON.stringify(r)
for (const palavra of ['Validação elétrica OK', 'compativel', 'compatível']) {
  ok(!textoSaida.includes(palavra), `a resposta não contém "${palavra}"`)
}
// `valido_eletrico` é sinal interno de scoring e não pode vazar no payload.
ok(!/"valido_eletrico"|"valido":\s*true/.test(textoSaida),
  'e não expõe `valido_eletrico` nem `valido: true`')

secao('3 · O pré-filtro comercial não tem tolerância nem default')
const kit = ler('backend/src/services/kitRecommendationService.js')
const fn = kit.slice(kit.indexOf('function plausivelComoCandidatoComercial'))
  .slice(0, kit.slice(kit.indexOf('function plausivelComoCandidatoComercial')).indexOf('\n}'))
ok(fn.length > 0, 'sanidade — a função do pré-filtro foi localizada')
for (const tol of ['1.05', '0.90', '1.10']) {
  ok(!fn.includes(tol), `sem a tolerância ${tol}`)
}
ok(!/\?\?\s*\d/.test(fn), 'e sem default numérico (`?? <número>`)')
// A função antiga não pode ressuscitar com o nome que afirmava validar.
ok(!/function\s+validarEletricoRapido/.test(kit),
  '`validarEletricoRapido` não existe mais — o nome afirmava um veredito')

secao('4 · O Core de engenharia não importa o dataset comercial')
const CORE = ['backend/src/services/compatibilidadeEletricaService.js',
  'backend/src/services/compatibilidadeFV.js',
  'backend/src/services/catalogoQualidade.js',
  'backend/src/services/inversoresCompativeisService.js']
for (const f of CORE) {
  ok(!/data\/catalogo(Inversores|Paineis|Eletrico)/.test(ler(f)),
    `${path.basename(f)} não importa tabela comercial`)
}
// E nada dentro de `dominio/` — o agregado inteiro, não só os quatro acima.
const dominio = arquivos.filter((a) => a.includes(`${path.sep}dominio${path.sep}`))
const invasores = dominio.filter((a) => /from\s+['"].*data\/catalogo(Inversores|Paineis|Eletrico)/.test(semComentarios(readFileSync(a, 'utf8'))))
ok(invasores.length === 0,
  `nenhum módulo de \`dominio/\` importa tabela comercial${invasores.length ? ': ' + invasores.map((p) => path.basename(p)).join(', ') : ''}`)
ok(dominio.length > 0, 'sanidade — a varredura de `dominio/` encontrou arquivos')

secao('5 · Nenhuma tabela elétrica NOVA fora do SSOT')
// O conjunto é FECHADO: estes seis arquivos, e mais nenhum. Um arquivo novo em
// `data/` com campo elétrico e forma de tabela reprova aqui de propósito.
//
// `cosernTopologiasReferencia.js` é exceção DECLARADA, não esquecimento: a F9 o
// encontrou ao varrer e o mediu contra o SSOT — 6 inversores embutidos, 3 com
// correspondência, ZERO divergências. É biblioteca de topologias de referência
// (pré-config editável), não fonte concorrente de especificação, e se declara
// como tal no próprio cabeçalho. Registrado para F10; fora do escopo da F9.
const PERMITIDOS = new Set(['catalogoInversores.js', 'catalogoInversores-EXPANDIDO.js',
  'catalogoPaineis.js', 'catalogoPaineis-EXPANDIDO.js', 'catalogoEletrico.js',
  'cosernTopologiasReferencia.js'])
const CAMPO_ELETRICO = /\b(vocMax|mpptMin|mpptMax|imaxMppt|voc_max|tensao_max_entrada)\b/
const tabelas = arquivos.filter((a) => {
  if (!/[\\/]data[\\/]/.test(a)) return false
  if (PERMITIDOS.has(path.basename(a))) return false
  const src = semComentarios(readFileSync(a, 'utf8'))
  return CAMPO_ELETRICO.test(src) && /=\s*\[|=\s*\{/.test(src)
})
ok(tabelas.length === 0,
  `nenhuma tabela elétrica nova em \`data/\`${tabelas.length ? ': ' + tabelas.map((p) => path.basename(p)).join(', ') : ''}`)

secao('6 · As rotas comerciais sem consumidor exigem autenticação')
for (const f of ['backend/src/routes/string.js', 'backend/src/routes/recomendacao.js']) {
  const src = ler(f)
  const rotas = src.match(/router\.(get|post|put|patch|delete)\([^)]*\)/g) || []
  ok(rotas.length > 0, `sanidade — ${path.basename(f)} declara rotas`)
  ok(rotas.every((l) => l.includes('authenticateToken')),
    `todas as rotas de ${path.basename(f)} exigem token`)
}

secao('7 · A dívida P1 permanece nomeada, não esquecida')
// `/api/v1/kits/recomendar` segue público: tem consumidor vivo que não manda
// token, e autenticar agora quebraria a feature. Fechar sem registrar seria
// perder o achado.
const kits = readFileSync(path.resolve(RAIZ, 'backend/src/routes/kitsV1.js'), 'utf8')
ok(/P1/.test(kits) && /autentica/i.test(kits),
  '`routes/kitsV1.js` registra a classificação P1 em comentário')

console.log(falhas === 0
  ? '\nOK — catálogo comercial isolado; compatibilidade elétrica só pelo motor canônico.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
