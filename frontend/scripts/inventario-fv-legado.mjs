/**
 * inventario-fv-legado.mjs — FASE 1 da FV-UX-013.
 *
 * Constrói o GRAFO DE IMPORTS do frontend e classifica cada arquivo por quem o
 * alcança. A remoção do legado precisa ser decidida por alcançabilidade, não por
 * nome de arquivo — um componente com "fv" no nome pode ser usado pela UX nova,
 * e um sem "fv" pode ser exclusivo do wizard.
 *
 * Uso: node frontend/scripts/inventario-fv-legado.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(AQUI, '../src')

/** Todos os módulos do frontend, exceto testes. */
function arquivos(dir) {
  const out = []
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome)
    if (statSync(p).isDirectory()) {
      if (/__tests__|node_modules/.test(nome)) continue
      out.push(...arquivos(p))
    } else if (/\.(jsx?|tsx?)$/.test(nome)) out.push(p)
  }
  return out
}

/** Resolve um import relativo para caminho real, testando as extensões usuais. */
function resolver(deOnde, especificador) {
  if (!especificador.startsWith('.')) return null      // pacote externo ou alias
  const base = path.resolve(path.dirname(deOnde), especificador)
  const tentativas = [
    base, `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`,
    path.join(base, 'index.js'), path.join(base, 'index.jsx'),
  ]
  return tentativas.find((t) => existsSync(t) && statSync(t).isFile()) ?? null
}

const todos = arquivos(SRC)
const grafo = new Map()   // arquivo → Set(arquivos que ele importa)

for (const f of todos) {
  const src = readFileSync(f, 'utf8')
  // Só imports de CÓDIGO: comentários são descartados para não criar aresta falsa.
  const limpo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const deps = new Set()
  const padroes = [
    /import\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,        // dinâmico / lazy
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const p of padroes) {
    for (const m of limpo.matchAll(p)) {
      const alvo = resolver(f, m[1])
      if (alvo) deps.add(alvo)
    }
  }
  grafo.set(f, deps)
}

/** Tudo que uma raiz alcança, transitivamente. */
function alcancaveis(raizes) {
  const vistos = new Set()
  const fila = [...raizes].filter((r) => existsSync(r))
  while (fila.length) {
    const atual = fila.pop()
    if (vistos.has(atual)) continue
    vistos.add(atual)
    for (const d of grafo.get(atual) ?? []) if (!vistos.has(d)) fila.push(d)
  }
  return vistos
}

const rel = (f) => path.relative(SRC, f).replace(/\\/g, '/')
const em = (...p) => path.join(SRC, ...p)

// ── Raízes ───────────────────────────────────────────────────────────────────
const RAIZ_NOVA = [em('fv', 'rotas.jsx')]
const RAIZ_WIZARD = [
  em('pages', 'ProjetosFVNovo.jsx'),
  em('pages', 'NovaProposta.jsx'),
  em('pages', 'SimulacaoFV.jsx'),
  em('pages', 'ProjetosFV.jsx'),
  em('pages', 'ProjetosFVDetalhes.jsx'),
  em('pages', 'Homologacao.jsx'),
]
// Tudo que o App alcança SEM passar pelas páginas do wizard nem pela UX nova.
const OUTRAS_RAIZES = todos.filter((f) => {
  const r = rel(f)
  return /^pages\//.test(r)
    && !RAIZ_WIZARD.some((w) => w === f)
    && !/^pages\/(ProjetosFV|NovaProposta|SimulacaoFV|Homologacao)/.test(r)
})

const daNova = alcancaveis(RAIZ_NOVA)
const doWizard = alcancaveis(RAIZ_WIZARD)
const deOutros = alcancaveis([...OUTRAS_RAIZES, em('App.jsx'), em('main.jsx')].filter(Boolean))

// `deOutros` parte do App, que também alcança o wizard — remove essa contaminação.
const outrosSemWizard = alcancaveis(
  [...OUTRAS_RAIZES, em('main.jsx')].filter((f) => existsSync(f)),
)

// Quem (entre as páginas) alcança cada arquivo — essencial para classificar.
const PAGINAS = todos.filter((f) => /^pages\//.test(rel(f)))
const alcancadoresPorArquivo = new Map()
for (const p of PAGINAS) {
  for (const alvo of alcancaveis([p])) {
    if (!alcancadoresPorArquivo.has(alvo)) alcancadoresPorArquivo.set(alvo, new Set())
    alcancadoresPorArquivo.get(alvo).add(rel(p))
  }
}
// A UX nova também é uma raiz de alcance.
for (const alvo of daNova) {
  if (!alcancadoresPorArquivo.has(alvo)) alcancadoresPorArquivo.set(alvo, new Set())
  alcancadoresPorArquivo.get(alvo).add('fv/ (UX nova)')
}
const PAG_WIZARD = new Set(RAIZ_WIZARD.map(rel))
const quemAlcanca = (f) => [...(alcancadoresPorArquivo.get(f) ?? [])].sort()
/** Alcançadores que NÃO são as páginas do wizard. */
const alcancadoresExternos = (f) => quemAlcanca(f).filter((p) => !PAG_WIZARD.has(p))

// ── Classificação ────────────────────────────────────────────────────────────
const exclusivoWizard = []
const compartilhado = []
const soNova = []
const orfaos = []

for (const f of todos) {
  const r = rel(f)
  if (/^fv\//.test(r)) { soNova.push(r); continue }
  const externos = alcancadoresExternos(f)
  const w = doWizard.has(f)
  if (w && externos.length === 0) exclusivoWizard.push(r)
  else if (w) compartilhado.push({ arquivo: r, por: externos })
  else if (externos.length === 0) orfaos.push(r)
}

const secao = (t) => console.log(`\n── ${t}`)
console.log(`INVENTÁRIO FV — ${todos.length} módulos analisados (grafo de imports, comentários descartados)`)

secao(`EXCLUSIVO DO WIZARD LEGADO → candidatos a REMOVER (${exclusivoWizard.length})`)
exclusivoWizard.sort().forEach((f) => console.log('  ' + f))

secao(`COMPARTILHADO → PRESERVAR (${compartilhado.length})`)
compartilhado.sort((a, b) => a.arquivo.localeCompare(b.arquivo)).forEach((c) =>
  console.log(`  ${c.arquivo.padEnd(50)} ← ${c.por.join(', ')}`))

secao(`ÓRFÃOS — nenhuma raiz alcança (${orfaos.length})`)
orfaos.sort().forEach((f) => console.log('  ' + f))

secao(`ÁRVORE NOVA (fv/) — ${soNova.length} arquivos, sempre preservados`)
console.log('  (omitida)')

secao('RESUMO')
console.log(`  remover (exclusivo wizard) : ${exclusivoWizard.length}`)
console.log(`  preservar (compartilhado)  : ${compartilhado.length}`)
console.log(`  órfãos                     : ${orfaos.length}`)
