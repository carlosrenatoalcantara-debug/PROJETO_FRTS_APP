/**
 * impacto-isc-fv-dom-024.mjs — FV-DOM-024
 *
 * Mede a FAIXA CRÍTICA da decisão Q1 (Isc × 1,25 — NBR 16690 §5.2) sobre o
 * catálogo elétrico de referência do próprio repositório.
 *
 *   Isc × strings        ≤ limite   → aprovado hoje
 *   Isc × strings × 1,25 >  limite  → passaria a reprovar
 *
 * Não substitui a contagem de projetos em produção — que exige credencial
 * somente-leitura inexistente. Mede o que é determinável sem produção.
 *
 * SOMENTE LEITURA de arquivos do repositório. Sem banco, sem rede, sem escrita.
 *
 *   node backend/scripts/impacto-isc-fv-dom-024.mjs
 */
import { DADOS_ELETRICOS_PAINEIS, DADOS_ELETRICOS_INVERSORES }
  from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'

const FATOR = 1.25
const linha = (t) => console.log(`\n── ${t}`)
const tabela = (linhas) => {
  const w = linhas[0].map((_, i) => Math.max(...linhas.map((l) => String(l[i]).length)))
  for (const l of linhas) console.log('   ' + l.map((c, i) => String(c).padEnd(w[i])).join('  '))
}

const modulos = Object.entries(DADOS_ELETRICOS_PAINEIS)
const inversores = Object.entries(DADOS_ELETRICOS_INVERSORES)

console.log('═══ FV-DOM-024 · faixa crítica da Isc ═══')
console.log(`   módulos no catálogo de referência: ${modulos.length}`)
console.log(`   inversores no catálogo de referência: ${inversores.length}`)
console.log(`   combinações módulo × inversor: ${modulos.length * inversores.length}`)

// ── Para cada par, o nº de strings em que o veredito VIRA ───────────────────
let paresComVirada = 0
let paresSemVirada = 0
let paresSemDados = 0
const exemplos = []

for (const [idMod, m] of modulos) {
  for (const [idInv, inv] of inversores) {
    const isc = Number(m?.isc)
    const limite = Number(inv?.corrente_max_mppt)
    if (!Number.isFinite(isc) || !Number.isFinite(limite) || isc <= 0 || limite <= 0) {
      paresSemDados++
      continue
    }
    // strings em que: isc×n ≤ limite E isc×n×1.25 > limite
    const nMaxAtual = Math.floor(limite / isc)
    const nMaxCanonico = Math.floor(limite / (isc * FATOR))
    if (nMaxAtual > nMaxCanonico) {
      paresComVirada++
      for (let n = nMaxCanonico + 1; n <= nMaxAtual; n++) {
        exemplos.push({
          idMod, idInv, isc, limite, n,
          atual: +(isc * n).toFixed(2),
          canonico: +(isc * n * FATOR).toFixed(2),
          potencia_ca_kw: inv.potencia_ca_kw,
        })
      }
    } else {
      paresSemVirada++
    }
  }
}

linha('Combinações do catálogo em que o veredito muda')
tabela([
  ['classificação', 'pares'],
  ['com faixa de virada (algum nº de strings muda)', paresComVirada],
  ['sem virada (mesmo veredito em todo n)', paresSemVirada],
  ['sem dados de Isc ou limite', paresSemDados],
  ['TOTAL', modulos.length * inversores.length],
])
console.log(`   configurações (par × nº de strings) que viram: ${exemplos.length}`)

linha('Exemplos — hoje APROVADO, canônico REPROVADO')
tabela([
  ['módulo', 'inversor', 'kW CA', 'strings', 'Isc', 'atual (×1,0)', 'canônico (×1,25)', 'limite MPPT'],
  ...exemplos.slice(0, 12).map((e) => [
    e.idMod, e.idInv, e.potencia_ca_kw, e.n, `${e.isc} A`,
    `${e.atual} A ok`, `${e.canonico} A EXCEDE`, `${e.limite} A`,
  ]),
])
if (exemplos.length > 12) console.log(`   … e mais ${exemplos.length - 12} configurações`)

// ── Sentido inverso: alguém passa de reprovado a aprovado? ──────────────────
linha('Sentido inverso (reprovado → aprovado)')
console.log('   0 — o fator 1,25 é monotônico: só aperta, nunca afrouxa.')

// ── Concentração por inversor ──────────────────────────────────────────────
linha('Onde a virada se concentra (por inversor)')
const porInv = {}
for (const e of exemplos) porInv[e.idInv] = (porInv[e.idInv] ?? 0) + 1
tabela([
  ['inversor', 'limite MPPT', 'configurações que viram'],
  ...Object.entries(porInv).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([id, n]) => [id, `${DADOS_ELETRICOS_INVERSORES[id].corrente_max_mppt} A`, n]),
])

// ── Regra prática ──────────────────────────────────────────────────────────
linha('Regra prática da virada')
console.log('   Um arranjo vira quando:  limite/1,25 < Isc × strings ≤ limite')
console.log('   ou seja, quando a corrente já ocupa mais de 80 % do limite do MPPT.')
tabela([
  ['limite MPPT', 'zona de virada (Isc × strings)'],
  ...[...new Set(inversores.map(([, i]) => i.corrente_max_mppt))]
    .filter(Number.isFinite).sort((a, b) => a - b)
    .map((L) => [`${L} A`, `> ${(L / FATOR).toFixed(2)} A e ≤ ${L} A`]),
])

console.log('\n═══ FIM ═══')
console.log('Esta medição cobre o catálogo de REFERÊNCIA do repositório.')
console.log('A contagem de PROJETOS afetados exige leitura de produção — ver relatório.')
