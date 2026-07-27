/**
 * test_merge_politica.mjs — F2 da integração AE ⇄ Forte Solar
 *
 * Gate obrigatório da fase: provar que os DEFAULTS reproduzem exatamente o
 * comportamento histórico do fluxo Gemini, e que a política de sobrescrita do
 * AE só age quando explicitamente solicitada.
 *
 * Regras verificadas:
 *   - prioridade vem SÓ da KnowledgeVersion (nunca de origem.tipo);
 *   - sobrescrita atinge apenas campos técnicos da whitelist da família;
 *   - bloqueio manual explícito vence qualquer fonte automática;
 *   - dados comerciais/administrativos são inalcançáveis por construção.
 *
 * Execução:
 *   node tests/ae/test_merge_politica.mjs
 */

import {
  montarAtualizacaoIncremental, _internals,
} from '../../src/services/catalogoDatasheetEnriquecimento.js'

const { mergeSpecsIncremental, CAMPOS_POR_TIPO } = _internals

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

// ─── Cenário base ────────────────────────────────────────────────────────────

/** Equipamento de catálogo: potência divergente, eficiência ausente. */
function equipamentoBase(extra = {}) {
  return {
    _id: 'eq-1',
    tipo: 'modulo',
    fabricante: 'Trina',
    modelo: 'TSM-610',
    preco_sugerido: 850.0,
    ativo: true,
    specs_canonicas: {
      potencia_w: 600,          // divergente do AE (610)
      voc_v: 41.5,              // igual ao AE
      eficiencia_pct: null,     // lacuna
    },
    origem: { tipo: 'manual', knowledge_version: '1.0.0' },
    ...extra,
  }
}

/** Entrada derivada de um Datasheet Técnico AE. */
const entradaAE = {
  tipo: 'modulo',
  fabricante: 'Trina',
  modelo: 'TSM-610',
  specs_canonicas: {
    potencia_w: 610,
    voc_v: 41.5,
    eficiencia_pct: 22.5,
  },
  fonte: { arquivo: 'modulos/Trina/TSM-610/product.json', nome_arquivo: 'product.json' },
}

// ─── 1. Regressão: defaults preservam o fluxo Gemini ─────────────────────────

secao('1. Regressão — defaults idênticos ao comportamento histórico')

const padrao = montarAtualizacaoIncremental(equipamentoBase(), entradaAE)

assert('aplica (há lacuna a preencher)', padrao.aplicar === true)
assert('preenche apenas o campo vazio', padrao.preenchidos.join(',') === 'eficiencia_pct')
assert('divergência vira conflito, NÃO é aplicada', padrao.conflitos.some(c => c.campo === 'potencia_w'))
assert('valor divergente permanece o do catálogo', padrao.set.specs_canonicas.potencia_w === 600)
assert('nada sobrescrito por default', padrao.sobrescritos.length === 0)
assert('origem default continua datasheet_gemini', padrao.set.origem.tipo === 'datasheet_gemini')
assert('evento default continua reprocessamento_gemini',
  padrao.push['validacao.historico'].$each[0].tipo === 'reprocessamento_gemini')
assert('autor default continua s2.6.2_datasheets',
  padrao.push['validacao.historico'].$each[0].por === 's2.6.2_datasheets')
assert('knowledge_version preexistente é preservado (não apagado pelo Gemini)',
  padrao.set.origem.knowledge_version === '1.0.0')

// ─── 2. Política do AE: sobrescrever ─────────────────────────────────────────

secao('2. AE com KnowledgeVersion superior — sobrescreve técnico')

const comAE = montarAtualizacaoIncremental(equipamentoBase(), entradaAE, {
  origem: 'import_ae',
  politicaConflito: 'sobrescrever',
  knowledgeVersion: '2.0.0',
  tipoEvento: 'import',
  por: 'auditoria_rapida_ae',
})

assert('sobrescreve o campo técnico divergente', comAE.set.specs_canonicas.potencia_w === 610)
assert('registra a sobrescrita com valor anterior',
  comAE.sobrescritos.some(s => s.campo === 'potencia_w' && s.anterior === 600 && s.novo === 610))
assert('nenhum conflito remanescente', comAE.conflitos.length === 0)
assert('continua preenchendo lacunas', comAE.set.specs_canonicas.eficiencia_pct === 22.5)
assert('campos_alterados inclui o sobrescrito',
  comAE.push['validacao.historico'].$each[0].campos_alterados.includes('specs_canonicas.potencia_w'))
assert('origem passa a import_ae', comAE.set.origem.tipo === 'import_ae')
assert('grava a nova KnowledgeVersion', comAE.set.origem.knowledge_version === '2.0.0')
assert('evento de histórico usa tipo do enum existente',
  comAE.push['validacao.historico'].$each[0].tipo === 'import')

// Rollback: o estado anterior completo fica registrado.
const evento = comAE.push['validacao.historico'].$each[0]
assert('histórico guarda specs anteriores (rollback)', evento.antes.specs_canonicas.potencia_w === 600)
assert('histórico guarda versão anterior (rollback)', evento.antes.origem.knowledge_version === '1.0.0')

// ─── 3. Origem anterior NÃO confere prioridade ───────────────────────────────

secao('3. origem.tipo não é prioridade — só a KnowledgeVersion decide')

for (const origemAnterior of ['manual', 'datasheet_gemini', 'import_solarmarket', 'import_ae']) {
  const r = montarAtualizacaoIncremental(
    equipamentoBase({ origem: { tipo: origemAnterior, knowledge_version: '1.0.0' } }),
    entradaAE,
    { origem: 'import_ae', politicaConflito: 'sobrescrever', knowledgeVersion: '2.0.0' },
  )
  assert(`sobrescreve mesmo com origem anterior "${origemAnterior}"`,
    r.set.specs_canonicas.potencia_w === 610)
}

// ─── 4. Bloqueio manual explícito ────────────────────────────────────────────

secao('4. Proteção manual de campo — única exceção aceita')

const protegido = montarAtualizacaoIncremental(
  equipamentoBase({ protecao: { campos_protegidos: ['potencia_w'] } }),
  entradaAE,
  { origem: 'import_ae', politicaConflito: 'sobrescrever', knowledgeVersion: '2.0.0' },
)

assert('campo protegido NÃO é sobrescrito', protegido.set.specs_canonicas.potencia_w === 600)
assert('campo protegido é reportado como bloqueado',
  protegido.bloqueados.some(b => b.campo === 'potencia_w' && b.motivo === 'protecao_manual'))
assert('campo protegido não entra em sobrescritos',
  !protegido.sobrescritos.some(s => s.campo === 'potencia_w'))
assert('demais campos seguem sendo aplicados', protegido.set.specs_canonicas.eficiencia_pct === 22.5)

// A proteção é lida do próprio equipamento quando não é passada por opção.
const protegidoImplicito = montarAtualizacaoIncremental(
  equipamentoBase({ protecao: { campos_protegidos: ['potencia_w'] } }),
  entradaAE,
  { politicaConflito: 'sobrescrever' },
)
assert('proteção do documento é respeitada sem opção explícita',
  protegidoImplicito.set.specs_canonicas.potencia_w === 600)

// ─── 5. Fronteira técnica × comercial ────────────────────────────────────────

secao('5. Dados comerciais e administrativos são inalcançáveis')

const comComercial = montarAtualizacaoIncremental(equipamentoBase(), {
  ...entradaAE,
  specs_canonicas: {
    ...entradaAE.specs_canonicas,
    preco_sugerido: 1.0,   // não pertence à whitelist técnica
    ativo: false,
    margem_lucro: 0.5,
  },
}, { origem: 'import_ae', politicaConflito: 'sobrescrever', knowledgeVersion: '2.0.0' })

assert('preço não entra em specs_canonicas', comComercial.set.specs_canonicas.preco_sugerido === undefined)
assert('flag administrativa não entra', comComercial.set.specs_canonicas.ativo === undefined)
assert('campo fora da whitelist não entra', comComercial.set.specs_canonicas.margem_lucro === undefined)
assert('set não toca preco_sugerido', comComercial.set.preco_sugerido === undefined)
assert('set não toca ativo', comComercial.set.ativo === undefined)
assert('whitelist técnica de módulo não contém campo comercial',
  !CAMPOS_POR_TIPO.modulo.includes('preco_sugerido'))

// As 4 famílias do AE possuem whitelist técnica definida.
for (const familia of ['modulo', 'inversor', 'carregador_ev', 'bateria']) {
  assert(`whitelist técnica definida para ${familia}`, (CAMPOS_POR_TIPO[familia] || []).length > 0)
}

// ─── 6. mergeSpecsIncremental isolado ────────────────────────────────────────

secao('6. mergeSpecsIncremental — contrato direto')

const m1 = mergeSpecsIncremental({ a: 1 }, { a: 2, b: 3 }, ['a', 'b'])
assert('default preserva divergência', m1.merged.a === 1 && m1.conflitos.length === 1)
assert('default preenche lacuna', m1.merged.b === 3 && m1.preenchidos.includes('b'))

const m2 = mergeSpecsIncremental({ a: 1 }, { a: 2 }, ['a'], { politicaConflito: 'sobrescrever' })
assert('sobrescrever aplica divergência', m2.merged.a === 2 && m2.sobrescritos.length === 1)

const m3 = mergeSpecsIncremental({ a: 1 }, { a: 2 }, ['a'], {
  politicaConflito: 'sobrescrever', camposProtegidos: ['a'],
})
assert('proteção vence sobrescrita', m3.merged.a === 1 && m3.bloqueados.length === 1)

const m4 = mergeSpecsIncremental({ a: 1 }, { a: 1 }, ['a'], { politicaConflito: 'sobrescrever' })
assert('valor igual não gera alteração',
  m4.sobrescritos.length === 0 && m4.conflitos.length === 0 && m4.preenchidos.length === 0)

const m5 = mergeSpecsIncremental({ a: 1 }, { z: 9 }, ['a'], { politicaConflito: 'sobrescrever' })
assert('campo fora da whitelist é ignorado', m5.merged.z === undefined)

// ─── Resultado ───────────────────────────────────────────────────────────────

const sep = '═'.repeat(60)
console.log(`\n${sep}`)
console.log(`  RESULTADO: ${passed} ✅  |  ${failed} ❌  |  Total: ${passed + failed}`)
console.log(sep)

if (failed > 0) {
  console.error(`\n  ${failed} teste(s) falharam. Ver detalhes acima.`)
  process.exit(1)
} else {
  console.log('\n  F2 validada — defaults preservados, política AE ativa sob demanda. ✅')
}
