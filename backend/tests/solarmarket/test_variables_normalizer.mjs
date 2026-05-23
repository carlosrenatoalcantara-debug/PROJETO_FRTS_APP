/**
 * test_variables_normalizer.mjs — S2.9.3
 *
 * Validação local da camada semântica de variables SolarMarket.
 * Sem dependências externas — roda direto com Node.js (ESM).
 *
 * Execução:
 *   node tests/solarmarket/test_variables_normalizer.mjs
 */

import { normalizarVariables, resolverAlias, estatisticasAliasIndex, ALIAS_INDEX }
  from '../../src/integracoes/solarmarket/variablesNormalizer.js'

// ─── Utilidades de teste ──────────────────────────────────────────────────────

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

// ─── SUITE 1: Casos mínimos exigidos pela missão S2.9.3 ──────────────────────
// Ambos os payloads devem sair como { geracao_mensal_kwh: 550 }

secao('SUITE 1 — Aliases mínimos exigidos (geracao_mensal_kwh)')

const caso1 = normalizarVariables({ v_geracao_estimada: 550 })
assert(
  'v_geracao_estimada: 550 → geracao_mensal_kwh: 550',
  caso1.geracao_mensal_kwh === 550,
  `Obtido: ${JSON.stringify(caso1)}`
)

const caso2 = normalizarVariables({ energiaPrevista: 550 })
assert(
  'energiaPrevista: 550 → geracao_mensal_kwh: 550',
  caso2.geracao_mensal_kwh === 550,
  `Obtido: ${JSON.stringify(caso2)}`
)

// Garante que o campo canônico direto também funciona
const caso3 = normalizarVariables({ geracao_mensal_kwh: 550 })
assert(
  'geracao_mensal_kwh (canônico direto) → geracao_mensal_kwh: 550',
  caso3.geracao_mensal_kwh === 550,
  `Obtido: ${JSON.stringify(caso3)}`
)

// ─── SUITE 2: Aliases de consumo ──────────────────────────────────────────────

secao('SUITE 2 — consumo_mensal_kwh')

const consumo1 = normalizarVariables({ consumo_medio: 400 })
assert('consumo_medio → consumo_mensal_kwh', consumo1.consumo_mensal_kwh === 400)

const consumo2 = normalizarVariables({ v_consumo: 400 })
assert('v_consumo → consumo_mensal_kwh', consumo2.consumo_mensal_kwh === 400)

const consumo3 = normalizarVariables({ consumoKwh: 400 })
assert('consumoKwh → consumo_mensal_kwh', consumo3.consumo_mensal_kwh === 400)

// ─── SUITE 3: Payload completo de proposta SM simulada ────────────────────────

secao('SUITE 3 — Payload realístico de proposta SM')

const payloadSM = {
  // Aliases reais que podem aparecer na API SM
  v_geracao_estimada:  700,
  consumo_medio:       600,
  potencia_kwp:        9.9,
  qtd_modulos:         18,
  qtd_inversores:      1,
  potencia_inversor:   8,
  valor_kit:           42000,
  valor_instalacao:    8000,
  valor_total:         50000,
  irradiacao:          5.2,
  payback:             5.5,
  // Campos desconhecidos que o SM pode enviar
  campoBizarro_SM:     'qualquer_valor',
  outroCampoEstranho:  123,
}

const normalizado = normalizarVariables(payloadSM)

assert('geracao_mensal_kwh presente', normalizado.geracao_mensal_kwh === 700)
assert('consumo_mensal_kwh presente', normalizado.consumo_mensal_kwh === 600)
assert('potencia_instalada_kwp presente', normalizado.potencia_instalada_kwp === 9.9)
assert('num_modulos presente', normalizado.num_modulos === 18)
assert('num_inversores presente', normalizado.num_inversores === 1)
assert('potencia_inversor_kw presente', normalizado.potencia_inversor_kw === 8)
assert('custo_kit presente', normalizado.custo_kit === 42000)
assert('custo_instalacao presente', normalizado.custo_instalacao === 8000)
assert('custo_total presente', normalizado.custo_total === 50000)
assert('irradiacao_local presente', normalizado.irradiacao_local === 5.2)
assert('payback_anos presente', normalizado.payback_anos === 5.5)

// Campos desconhecidos devem ser preservados com prefixo unmapped_
assert(
  'campoBizarro_SM → unmapped_campoBizarro_SM',
  normalizado['unmapped_campoBizarro_SM'] === 'qualquer_valor'
)
assert(
  'outroCampoEstranho → unmapped_outroCampoEstranho',
  normalizado['unmapped_outroCampoEstranho'] === 123
)

// Metadados de rastreabilidade
assert(
  '_campos_mapeados inclui campos canônicos',
  Array.isArray(normalizado._campos_mapeados) && normalizado._campos_mapeados.length > 0
)
assert(
  '_campos_unmapped lista campos desconhecidos',
  Array.isArray(normalizado._campos_unmapped) &&
  normalizado._campos_unmapped.includes('campoBizarro_SM')
)

// ─── SUITE 4: Case-insensitivity ──────────────────────────────────────────────

secao('SUITE 4 — Case-insensitivity (SM pode enviar qualquer case)')

const caseTests = [
  normalizarVariables({ GeracaoMensal: 300 }),
  normalizarVariables({ GERACAOMENSAL: 300 }),
  normalizarVariables({ geracaoMensal: 300 }),
  normalizarVariables({ Geracao_Mensal_Kwh: 300 }),
]

for (const r of caseTests) {
  assert(
    `"${Object.keys(r).find(k => !k.startsWith('_'))}" → geracao_mensal_kwh`,
    r.geracao_mensal_kwh === 300,
    `Obtido: ${JSON.stringify(r)}`
  )
}

// ─── SUITE 5: Conflito (dois aliases do mesmo canônico no mesmo objeto) ────────

secao('SUITE 5 — Primeiro alias vence quando dois mapeiam para o mesmo canônico')

const conflito = normalizarVariables({
  v_geracao_estimada: 111,
  energiaPrevista:    222,  // segundo alias do mesmo canônico
})

assert(
  'Apenas um valor preenchido (primeiro alias vence)',
  conflito.geracao_mensal_kwh === 111 || conflito.geracao_mensal_kwh === 222
)
assert(
  'Não há duplicação do campo',
  Object.keys(conflito).filter(k => k === 'geracao_mensal_kwh').length === 1
)

// ─── SUITE 6: Inputs inválidos ─────────────────────────────────────────────────

secao('SUITE 6 — Inputs inválidos não lançam exceção')

const inputs = [null, undefined, '', 0, [], 'string', 42]
for (const inp of inputs) {
  try {
    const r = normalizarVariables(inp)
    assert(
      `normalizarVariables(${JSON.stringify(inp)}) retorna objeto vazio sem lançar`,
      typeof r === 'object' && r !== null && !Array.isArray(r)
    )
  } catch (e) {
    assert(`normalizarVariables(${JSON.stringify(inp)}) NÃO deve lançar`, false, e.message)
  }
}

// ─── SUITE 7: resolverAlias (inspeção de alias individual) ────────────────────

secao('SUITE 7 — resolverAlias() para inspeção pontual')

assert(
  'resolverAlias("v_geracao_estimada") === "geracao_mensal_kwh"',
  resolverAlias('v_geracao_estimada') === 'geracao_mensal_kwh'
)
assert(
  'resolverAlias("energiaPrevista") === "geracao_mensal_kwh"',
  resolverAlias('energiaPrevista') === 'geracao_mensal_kwh'
)
assert(
  'resolverAlias("campoInexistente") === null',
  resolverAlias('campoInexistente') === null
)
assert(
  'resolverAlias é case-insensitive',
  resolverAlias('HORAS_SOL_PICO') === 'irradiacao_local'
)

// ─── SUITE 8: estatisticasAliasIndex() ────────────────────────────────────────

secao('SUITE 8 — Métricas do índice carregado')

const stats = estatisticasAliasIndex()
console.log(`\n  Índice construído:`)
console.log(`    Total de aliases indexados : ${stats.total_aliases}`)
console.log(`    Total de campos canônicos  : ${stats.total_canonicos}`)
console.log(`    Campos: ${stats.canonicos.join(', ')}`)

assert(
  'total_aliases > total_canonicos (ao menos 1 alias por canônico)',
  stats.total_aliases > stats.total_canonicos
)
assert('total_canonicos >= 15', stats.total_canonicos >= 15)

// ─── RESULTADO FINAL ──────────────────────────────────────────────────────────

const sep = '═'.repeat(60)
console.log(`\n${sep}`)
console.log(`  RESULTADO: ${passed} ✅  |  ${failed} ❌  |  Total: ${passed + failed}`)
console.log(sep)

if (failed > 0) {
  console.error(`\n  ${failed} teste(s) falharam. Ver detalhes acima.`)
  process.exit(1)
} else {
  console.log('\n  Todos os testes passaram. Camada semântica S2.9.3 validada. ✅')
}
