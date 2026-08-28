/**
 * auditoria-caminho-micro-fv-dom-031b.mjs — FV-DOM-031B, item 3
 *
 * Percorre o caminho COMPLETO do dado de microinversor e registra, em cada
 * salto, o que efetivamente chega:
 *
 *   ProjetoFV → arranjos[] → configuracao_eletrica.micros[] → unifilar → memorial
 *
 * SÓ MEDE. Lê o projeto pela API canônica e chama os adaptadores reais —
 * nenhum é reimplementado aqui. Ambiente isolado (37017).
 *
 *   node backend/scripts/auditoria-caminho-micro-fv-dom-031b.mjs <projetoId>
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { adaptarProjetoParaUnifilar, lacunasDaProveniencia } from '../src/dominio/unifilar/index.js'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

const P = process.argv[2]
if (!P) { console.error('uso: node ... <projetoId>'); process.exit(1) }

const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const projeto = await (await fetch(`${API}/api/projetos-fv/${P}`, { headers: h })).json()
  .then((d) => d.projeto ?? d)

const sim = (v) => (v ? '✓ chega' : '✗ NÃO chega')
console.log('═══ FV-DOM-031B · item 3 — o caminho do micro ═══\n')

// ── Salto 1: ProjetoFV → arranjos[] ─────────────────────────────────────────
const a = projeto?.arranjos?.[0] ?? null
console.log('── 1 · ProjetoFV → arranjos[]')
console.log(`   ${sim(!!a)}  arranjo principal · topologia = ${a?.topologia ?? '—'}`)
console.log(`   ${sim((a?.inversores ?? []).length > 0)}  inversores[] com quantidade: ` +
  JSON.stringify((a?.inversores ?? []).map((i) => `${i.modelo}×${i.quantidade}`)))

// ── Salto 2: arranjos[] → configuracao_eletrica.micros[] ────────────────────
const micros = a?.configuracao_eletrica?.micros ?? []
console.log('\n── 2 · arranjos[] → configuracao_eletrica.micros[]')
console.log(`   ${sim(micros.length > 0)}  ${micros.length} modelo(s)`)
for (const m of micros) {
  console.log(`      ${m.modelo}: ${m.quantidade} un. × ${m.entradas_por_micro} entradas × ` +
    `${m.modulos_por_entrada} mód/entrada · distribuição ${JSON.stringify(m.distribuicao)}`)
}

// ── Salto 3: → unifilar ─────────────────────────────────────────────────────
console.log('\n── 3 · → unifilar (adaptarProjetoParaUnifilar, o adaptador REAL)')
const { entrada, proveniencia } = adaptarProjetoParaUnifilar(projeto)
const lacunas = lacunasDaProveniencia(proveniencia)
console.log(`   proveniência do arranjo : ${proveniencia.arranjoMPPTs ?? 'null'}`)
console.log(`   entrada.mppts           : ${JSON.stringify(entrada.mppts)}`)
console.log(`   entrada.inversor.tipo   : ${entrada.inversor?.tipo ?? '—'}`)
console.log(`   entrada.inversor.nMppts : ${entrada.inversor?.nMppts ?? '—'}`)
console.log(`   lacunas                 : ${JSON.stringify(lacunas)}`)
const leMicros = JSON.stringify(entrada).includes('micros')
console.log(`   ${sim(leMicros)}  `.padEnd(14) + 'o adaptador leu `configuracao_eletrica.micros[]`')

const svg = await (await fetch(`${API}/api/projetos-fv/${P}/unifilar/gerar`, { method: 'POST', headers: h, body: '{}' })).json()
const texto = svg?.svg ?? svg?.unifilar?.svg ?? ''
console.log(`   SVG gerado              : ${texto.length} bytes`)
console.log(`   menciona "micro"        : ${/micro/i.test(texto) ? 'sim' : 'NÃO'}`)
console.log(`   menciona "string"       : ${/string/i.test(texto) ? 'sim' : 'não'}`)
console.log(`   lacunas da API          : ${JSON.stringify(svg?.lacunas ?? svg?.unifilar?.lacunas ?? null)}`)

// ── Salto 4: → memorial ─────────────────────────────────────────────────────
console.log('\n── 4 · → memorial descritivo')
const fonte = readFileSync(path.join(RAIZ, 'src/services/memorialDescritivoService.js'), 'utf8')
console.log(`   ${sim(fonte.includes('configuracao_eletrica'))}  lê \`configuracao_eletrica\``)
console.log(`   ${sim(fonte.includes('micros'))}  lê \`micros[]\``)
console.log(`   ${sim(fonte.includes('entradas'))}  lê \`entradas\``)
const trechos = fonte.split('\n')
  .map((l, i) => [i + 1, l])
  .filter(([, l]) => /Configuração DC|Número de MPPT|Tipo: \$\{inversor/.test(l))
console.log('   texto FIXO do memorial, independente da topologia:')
for (const [n, l] of trechos) console.log(`      linha ${n}: ${l.trim()}`)

console.log('\n═══ FIM — nenhuma escrita ═══')
