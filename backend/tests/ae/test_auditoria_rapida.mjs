/**
 * test_auditoria_rapida.mjs — F3 da integração AE ⇄ Forte Solar
 *
 * Valida o ORQUESTRADOR:
 *   - read-only (nenhuma escrita no banco);
 *   - versões iguais NÃO abrem o datasheet;
 *   - reuso do pipeline existente (normalizador → match → update);
 *   - agrupamento por família e resumo no formato acordado.
 *
 * Provider é um duplo em memória: comprova que o serviço não conhece a
 * origem física dos dados.
 *
 * Execução:
 *   node tests/ae/test_auditoria_rapida.mjs
 */

import {
  criarAuditoriaRapidaService, formatarResumo, SITUACAO,
} from '../../src/services/auditoriaRapidaService.js'

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

// ─── Duplos ──────────────────────────────────────────────────────────────────

/** Provider em memória — o serviço não sabe se é disco, API ou S3. */
function providerFake(entradas, datasheets) {
  const aberturas = []
  return {
    aberturas,
    descrever: () => ({ tipo: 'memoria', origem: 'teste' }),
    listarIndice: async () => entradas,
    obterDatasheet: async (ref) => {
      aberturas.push(ref)
      if (!datasheets[ref]) {
        const e = new Error(`ausente: ${ref}`)
        e.code = 'AE_DATASHEET_AUSENTE'
        throw e
      }
      return datasheets[ref]
    },
  }
}

const equipamentoModulo = {
  _id: 'eq-modulo',
  tipo: 'modulo',
  fabricante: 'Trina',
  modelo: 'TSM-610',
  preco_sugerido: 850,
  specs_canonicas: { potencia_w: 600, voc_v: 41.5, eficiencia_pct: null },
  origem: { tipo: 'manual', knowledge_version: '1.0.0' },
}

const equipamentoInversor = {
  _id: 'eq-inversor',
  tipo: 'inversor',
  fabricante: 'Growatt',
  modelo: 'MAX 100KTL3',
  specs_canonicas: { potencia_kw_ca: 100 },
  origem: { tipo: 'datasheet_gemini', knowledge_version: '2.0.1' }, // já atualizado
}

const equipamentoSemAE = {
  _id: 'eq-orfao',
  tipo: 'modulo',
  fabricante: 'Canadian',
  modelo: 'CS7L-660',
  specs_canonicas: { potencia_w: 660 },
  origem: { tipo: 'manual', knowledge_version: null },
}

const indice = [
  { familia: 'modulo', fabricante: 'Trina', modelo: 'TSM-610', knowledgeVersion: '2.0.0', ref: 'modulos/Trina/TSM-610' },
  { familia: 'inversor', fabricante: 'Growatt', modelo: 'MAX 100KTL3', knowledgeVersion: '2.0.1', ref: 'inversores/Growatt/MAX' },
]

const datasheets = {
  'modulos/Trina/TSM-610': {
    origin: 'AE', documentType: 'Technical Datasheet', familia: 'modulo',
    fabricante: 'Trina', modelo: 'TSM-610', knowledgeVersion: '2.0.0',
    lastAudit: '2026-07-20', confidence: 0.96,
    dados: { potencia_w: 610, voc_v: 41.5, eficiencia_pct: 22.5 },
    ref: 'modulos/Trina/TSM-610',
  },
  'inversores/Growatt/MAX': {
    origin: 'AE', documentType: 'Technical Datasheet', familia: 'inversor',
    fabricante: 'Growatt', modelo: 'MAX 100KTL3', knowledgeVersion: '2.0.1',
    dados: { potencia_kw_ca: 100 },
    ref: 'inversores/Growatt/MAX',
  },
}

const catalogo = [equipamentoModulo, equipamentoInversor, equipamentoSemAE]

function servico(provider, equipamentos = catalogo) {
  return criarAuditoriaRapidaService({
    provider,
    listarEquipamentos: async () => equipamentos,
  })
}

// ─── 1. Contrato e injeção ───────────────────────────────────────────────────

secao('1. Contrato do serviço')

let erroProvider = null
try { criarAuditoriaRapidaService({ listarEquipamentos: async () => [] }) } catch (e) { erroProvider = e }
assert('exige provider válido', erroProvider !== null)

let erroRepo = null
try { criarAuditoriaRapidaService({ provider: providerFake([], {}) }) } catch (e) { erroRepo = e }
assert('exige listarEquipamentos', erroRepo !== null)

// ─── 2. Execução completa ────────────────────────────────────────────────────

secao('2. Auditoria Rápida — execução')

const p = providerFake(indice, datasheets)
const rel = await servico(p).executar()

assert('analisa todo o catálogo', rel.analisados === 3)
assert('não conhece a origem física (provider opaco)', rel.provider.tipo === 'memoria')

// Versão igual não abre arquivo — requisito explícito.
assert('abre APENAS o datasheet divergente', p.aberturas.length === 1,
  `abertos: ${JSON.stringify(p.aberturas)}`)
assert('o aberto é o do módulo', p.aberturas[0] === 'modulos/Trina/TSM-610')
assert('contador de aberturas confere', rel.datasheets_abertos === 1)

assert('inversor com versão igual entra em "atualizados"',
  rel.atualizados.some(e => e.id === 'eq-inversor'))
assert('equipamento sem datasheet AE é reportado',
  rel.sem_datasheet.some(e => e.id === 'eq-orfao'))

// ─── 3. Atualização proposta ─────────────────────────────────────────────────

secao('3. Atualização proposta (módulo, AE 2.0.0 > catálogo 1.0.0)')

const atualizacao = rel.atualizacoes.find(a => a.id === 'eq-modulo')
assert('módulo entra como atualização disponível', atualizacao?.situacao === SITUACAO.ATUALIZACAO_DISPONIVEL)
assert('mostra versão do catálogo e do AE',
  atualizacao?.versao_catalogo === '1.0.0' && atualizacao?.versao_ae === '2.0.0')

const potencia = atualizacao?.campos.find(c => c.campo === 'potencia_w')
assert('propõe sobrescrever a potência', potencia?.status === 'sobrescrita')
assert('mostra valor atual e proposto', potencia?.atual === 600 && potencia?.proposto === 610)

const eficiencia = atualizacao?.campos.find(c => c.campo === 'eficiencia_pct')
assert('propõe preencher a lacuna', eficiencia?.status === 'preenchimento' && eficiencia?.proposto === 22.5)

assert('total por família contabiliza módulo', rel.totais_por_familia.modulo === 1)
assert('inversor não gera atualização', rel.totais_por_familia.inversor === 0)
assert('total geral confere', rel.total_atualizacoes === 1)

// ─── 4. Read-only ────────────────────────────────────────────────────────────

secao('4. Garantia read-only')

assert('não muta o equipamento do catálogo', equipamentoModulo.specs_canonicas.potencia_w === 600)
assert('não muta a origem do equipamento', equipamentoModulo.origem.knowledge_version === '1.0.0')
assert('plano de escrita é apenas calculado', typeof atualizacao?.plano?.set === 'object')
assert('nenhum campo comercial no plano', atualizacao?.plano?.set?.preco_sugerido === undefined)
assert('preço do catálogo intacto', equipamentoModulo.preco_sugerido === 850)

// ─── 5. Proteção manual ──────────────────────────────────────────────────────

secao('5. Proteção manual de campo')

const protegido = { ...equipamentoModulo, protecao: { campos_protegidos: ['potencia_w'] } }
const relProtegido = await servico(providerFake(indice, datasheets), [protegido]).executar()
const regProtegido = relProtegido.atualizacoes.find(a => a.id === 'eq-modulo')

assert('campo protegido aparece como bloqueado',
  regProtegido?.bloqueados.some(b => b.campo === 'potencia_w' && b.status === 'bloqueado_por_protecao_manual'))
assert('campo protegido não é proposto para sobrescrita',
  !regProtegido?.campos.some(c => c.campo === 'potencia_w'))
assert('demais campos seguem propostos',
  regProtegido?.campos.some(c => c.campo === 'eficiencia_pct'))

// ─── 6. Nunca auditado ───────────────────────────────────────────────────────

secao('6. Primeira auditoria (sem KnowledgeVersion no catálogo)')

const semVersao = { ...equipamentoModulo, origem: { tipo: 'manual', knowledge_version: null } }
const relNovo = await servico(providerFake(indice, datasheets), [semVersao]).executar()

assert('não conta como atualização', relNovo.total_atualizacoes === 0)
assert('entra na categoria própria', relNovo.nunca_auditados.some(e => e.id === 'eq-modulo'))
assert('categoria marcada corretamente',
  relNovo.nunca_auditados[0]?.situacao === SITUACAO.NUNCA_AUDITADO)

// ─── 7. Proteções contra aplicação indevida ──────────────────────────────────

secao('7. Situações que nunca viram atualização')

// AE com versão inferior (regressão) não autoriza.
const indiceInferior = [{ ...indice[0], knowledgeVersion: '0.9.0' }]
const relInferior = await servico(providerFake(indiceInferior, datasheets), [equipamentoModulo]).executar()
assert('versão inferior do AE não gera atualização', relInferior.total_atualizacoes === 0)
assert('versão inferior vai para revisão',
  relInferior.revisao.some(r => r.motivo === 'inferior'))

// Versões não comparáveis não autorizam.
const indiceRuim = [{ ...indice[0], knowledgeVersion: 'rev-B' }]
const equipRuim = { ...equipamentoModulo, origem: { tipo: 'manual', knowledge_version: 'rev-A' } }
const relRuim = await servico(providerFake(indiceRuim, datasheets), [equipRuim]).executar()
assert('versão não comparável vai para revisão',
  relRuim.revisao.some(r => r.motivo === 'nao_comparavel'))
assert('não comparável não gera atualização', relRuim.total_atualizacoes === 0)

// Datasheet ilegível é erro, não atualização.
const relErro = await servico(providerFake(indice, {}), [equipamentoModulo]).executar()
assert('datasheet ausente vira erro reportado', relErro.erros.length === 1)
assert('erro não vira atualização', relErro.total_atualizacoes === 0)

// Potência divergente: 610 do AE não pode casar com um módulo de 600 W de outro modelo.
const outroModelo = {
  _id: 'eq-600', tipo: 'modulo', fabricante: 'Trina', modelo: 'TSM-600',
  specs_canonicas: { potencia_w: 600 }, origem: { tipo: 'manual', knowledge_version: '1.0.0' },
}
const relPotencia = await servico(providerFake(indice, datasheets), [outroModelo]).executar()
assert('modelo de outra potência não é pareado',
  relPotencia.sem_datasheet.some(e => e.id === 'eq-600') || relPotencia.total_atualizacoes === 0,
  JSON.stringify({ atualizacoes: relPotencia.total_atualizacoes, sem: relPotencia.sem_datasheet.length }))

// ─── 8. Resumo ───────────────────────────────────────────────────────────────

secao('8. Resumo no formato acordado')

const resumo = formatarResumo(rel)
console.log('\n' + resumo.split('\n').map(l => '    ' + l).join('\n') + '\n')

assert('inicia com "Auditoria concluída"', resumo.startsWith('Auditoria concluída'))
assert('mostra equipamentos analisados', resumo.includes('Equipamentos analisados: 3'))
assert('lista as 4 famílias',
  ['Módulos', 'Inversores', 'Carregadores', 'Baterias'].every(f => resumo.includes(f)))
assert('mostra o total', /Total \.+ 1/.test(resumo))

// ─── Resultado ───────────────────────────────────────────────────────────────

const sep = '═'.repeat(60)
console.log(`\n${sep}`)
console.log(`  RESULTADO: ${passed} ✅  |  ${failed} ❌  |  Total: ${passed + failed}`)
console.log(sep)

if (failed > 0) {
  console.error(`\n  ${failed} teste(s) falharam. Ver detalhes acima.`)
  process.exit(1)
} else {
  console.log('\n  F3 validada — orquestrador read-only sobre o pipeline existente. ✅')
}
