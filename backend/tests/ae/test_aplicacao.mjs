/**
 * test_aplicacao.mjs — F6 da integração AE ⇄ Forte Solar
 *
 * Valida a fase de escrita:
 *   - atomicidade por equipamento (specs + histórico + knowledge_version juntos);
 *   - guarda de concorrência (estado alterado após a auditoria não é aplicado);
 *   - seleção/desmarcação respeitada;
 *   - falha isolada não contamina os demais equipamentos;
 *   - rollback a partir do histórico.
 *
 * Execução:
 *   node tests/ae/test_aplicacao.mjs
 */

import {
  criarAplicadorAuditoria, criarRepositorioMongo, RESULTADO,
} from '../../src/services/auditoriaAplicacaoService.js'

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

// ─── Relatório de auditoria (formato produzido pela F3) ──────────────────────

function itemPlano(id, versaoAtual, versaoNova, extra = {}) {
  return {
    id,
    familia: 'modulo',
    fabricante: 'Trina',
    modelo: `TSM-${id}`,
    versao_catalogo: versaoAtual,
    versao_ae: versaoNova,
    campos: [{ campo: 'potencia_w', atual: 600, proposto: 610, status: 'sobrescrita' }],
    bloqueados: [],
    plano: {
      set: {
        specs_canonicas: { potencia_w: 610 },
        origem: { tipo: 'import_ae', knowledge_version: versaoNova },
      },
      push: { 'validacao.historico': { $each: [{ tipo: 'import', por: 'auditoria_rapida_ae' }], $slice: -50 } },
    },
    ...extra,
  }
}

const relatorio = {
  atualizacoes: [
    itemPlano('eq-1', '1.0.0', '2.0.0'),
    itemPlano('eq-2', '1.0.0', '2.0.0'),
  ],
  nunca_auditados: [itemPlano('eq-novo', null, '1.0.0')],
}

/** Repositório em memória que respeita a guarda de versão. */
function repositorioFake(estado, { falharEm = null } = {}) {
  const gravacoes = []
  return {
    gravacoes,
    aplicarNoRepositorio: async ({ id, versaoEsperada, set, push }) => {
      if (falharEm === id) throw new Error('falha de escrita simulada')
      const doc = estado[id]
      if (!doc) return { status: RESULTADO.ERRO, motivo: 'não encontrado' }

      const versaoAtual = doc.origem?.knowledge_version ?? null
      if (versaoAtual !== (versaoEsperada ?? null)) {
        return { status: RESULTADO.ESTADO_ALTERADO, motivo: 'knowledge_version divergente' }
      }

      // Atômico: os três efeitos são aplicados juntos.
      doc.specs_canonicas = set.specs_canonicas
      doc.origem = set.origem
      doc.validacao = doc.validacao || { historico: [] }
      if (push) doc.validacao.historico.push(...push['validacao.historico'].$each)

      gravacoes.push({ id, versaoEsperada })
      return { status: RESULTADO.APLICADO }
    },
  }
}

// ─── 1. Contrato ─────────────────────────────────────────────────────────────

secao('1. Contrato')

let erro = null
try { criarAplicadorAuditoria({}) } catch (e) { erro = e }
assert('exige a porta de persistência', erro !== null)

// ─── 2. Aplicação completa ───────────────────────────────────────────────────

secao('2. Aplicação — caminho feliz')

const estado = {
  'eq-1': { origem: { tipo: 'manual', knowledge_version: '1.0.0' }, specs_canonicas: { potencia_w: 600 }, validacao: { historico: [] } },
  'eq-2': { origem: { tipo: 'manual', knowledge_version: '1.0.0' }, specs_canonicas: { potencia_w: 600 }, validacao: { historico: [] } },
}
const repo = repositorioFake(estado)
const res = await criarAplicadorAuditoria(repo).aplicar(relatorio)

assert('aplica os dois equipamentos', res.aplicados === 2)
assert('não conta erros', res.erros === 0)
assert('nunca auditados ficam de fora por padrão', res.total_candidatos === 2)

assert('specs técnicas gravadas', estado['eq-1'].specs_canonicas.potencia_w === 610)
assert('knowledge_version atualizada', estado['eq-1'].origem.knowledge_version === '2.0.0')
assert('origem passa a import_ae', estado['eq-1'].origem.tipo === 'import_ae')
assert('histórico gravado na mesma operação', estado['eq-1'].validacao.historico.length === 1)
assert('detalhe registra versão anterior e nova',
  res.detalhes[0].versao_anterior === '1.0.0' && res.detalhes[0].versao_nova === '2.0.0')

// ─── 3. Atomicidade ──────────────────────────────────────────────────────────

secao('3. Atomicidade por equipamento')

const estadoAtomico = {
  'eq-1': { origem: { knowledge_version: '1.0.0' }, specs_canonicas: { potencia_w: 600 }, validacao: { historico: [] } },
  'eq-2': { origem: { knowledge_version: '1.0.0' }, specs_canonicas: { potencia_w: 600 }, validacao: { historico: [] } },
}
const repoFalha = repositorioFake(estadoAtomico, { falharEm: 'eq-1' })
const resFalha = await criarAplicadorAuditoria(repoFalha).aplicar(relatorio)

assert('falha em um equipamento é contabilizada', resFalha.erros === 1)
assert('equipamento que falhou não teve escrita parcial',
  estadoAtomico['eq-1'].specs_canonicas.potencia_w === 600
  && estadoAtomico['eq-1'].origem.knowledge_version === '1.0.0'
  && estadoAtomico['eq-1'].validacao.historico.length === 0)
assert('falha isolada não impede os demais', resFalha.aplicados === 1)
assert('o outro equipamento foi aplicado por completo',
  estadoAtomico['eq-2'].specs_canonicas.potencia_w === 610
  && estadoAtomico['eq-2'].origem.knowledge_version === '2.0.0'
  && estadoAtomico['eq-2'].validacao.historico.length === 1)

// ─── 4. Guarda de concorrência ───────────────────────────────────────────────

secao('4. Concorrência — estado alterado após a auditoria')

const estadoMudou = {
  'eq-1': { origem: { knowledge_version: '3.0.0' }, specs_canonicas: { potencia_w: 615 }, validacao: { historico: [] } },
  'eq-2': { origem: { knowledge_version: '1.0.0' }, specs_canonicas: { potencia_w: 600 }, validacao: { historico: [] } },
}
const resConc = await criarAplicadorAuditoria(repositorioFake(estadoMudou)).aplicar(relatorio)

assert('detecta estado alterado', resConc.estado_alterado === 1)
assert('não sobrescreve o equipamento alterado', estadoMudou['eq-1'].specs_canonicas.potencia_w === 615)
assert('motivo orienta nova auditoria',
  /nova auditoria|divergente/.test(resConc.detalhes.find(d => d.id === 'eq-1').motivo))
assert('equipamento íntegro segue aplicado', resConc.aplicados === 1)

// ─── 5. Seleção ──────────────────────────────────────────────────────────────

secao('5. Seleção do usuário (Ver Detalhes)')

const estadoSel = {
  'eq-1': { origem: { knowledge_version: '1.0.0' }, specs_canonicas: { potencia_w: 600 }, validacao: { historico: [] } },
  'eq-2': { origem: { knowledge_version: '1.0.0' }, specs_canonicas: { potencia_w: 600 }, validacao: { historico: [] } },
}
const resSel = await criarAplicadorAuditoria(repositorioFake(estadoSel)).aplicar(relatorio, { selecionados: ['eq-2'] })

assert('aplica apenas o selecionado', resSel.aplicados === 1)
assert('desmarcado é ignorado', resSel.ignorados === 1)
assert('desmarcado permanece intacto', estadoSel['eq-1'].specs_canonicas.potencia_w === 600)
assert('selecionado foi aplicado', estadoSel['eq-2'].specs_canonicas.potencia_w === 610)

// Lista vazia não aplica nada.
const estadoVazio = { 'eq-1': { origem: { knowledge_version: '1.0.0' }, specs_canonicas: { potencia_w: 600 }, validacao: { historico: [] } } }
const resVazio = await criarAplicadorAuditoria(repositorioFake(estadoVazio)).aplicar(relatorio, { selecionados: [] })
assert('seleção vazia não grava nada', resVazio.aplicados === 0 && estadoVazio['eq-1'].specs_canonicas.potencia_w === 600)

// ─── 6. Nunca auditados ──────────────────────────────────────────────────────

secao('6. Primeira auditoria só entra sob pedido explícito')

const estadoNovo = { 'eq-novo': { origem: { knowledge_version: null }, specs_canonicas: {}, validacao: { historico: [] } } }
const resSem = await criarAplicadorAuditoria(repositorioFake(estadoNovo)).aplicar(relatorio, { selecionados: ['eq-novo'] })
assert('fora por padrão', resSem.aplicados === 0)

const resCom = await criarAplicadorAuditoria(repositorioFake(estadoNovo))
  .aplicar(relatorio, { selecionados: ['eq-novo'], incluirNuncaAuditados: true })
assert('entra quando solicitado', resCom.aplicados === 1)
assert('grava versão inicial', estadoNovo['eq-novo'].origem.knowledge_version === '1.0.0')

// ─── 7. Rollback ─────────────────────────────────────────────────────────────

secao('7. Rollback a partir do histórico')

const equipamentoAplicado = {
  _id: 'eq-1',
  specs_canonicas: { potencia_w: 610 },
  origem: { tipo: 'import_ae', knowledge_version: '2.0.0' },
  validacao: {
    historico: [
      { tipo: 'validacao_automatica', por: 'sistema' },
      {
        tipo: 'import',
        por: 'auditoria_rapida_ae',
        campos_alterados: ['specs_canonicas.potencia_w'],
        antes: {
          specs_canonicas: { potencia_w: 600 },
          origem: { tipo: 'manual', knowledge_version: '1.0.0' },
        },
        depois: { origem: { tipo: 'import_ae', knowledge_version: '2.0.0' } },
      },
    ],
  },
}

let revertido = null
const aplicadorComRollback = criarAplicadorAuditoria({
  aplicarNoRepositorio: async () => ({ status: RESULTADO.APLICADO }),
  reverterNoRepositorio: async (cmd) => { revertido = cmd; return { status: RESULTADO.APLICADO } },
})

const resRollback = await aplicadorComRollback.reverter(equipamentoAplicado)
assert('rollback executado', resRollback.status === RESULTADO.APLICADO)
assert('restaura specs anteriores', revertido.estadoAnterior.specs_canonicas.potencia_w === 600)
assert('restaura versão anterior', revertido.estadoAnterior.origem.knowledge_version === '1.0.0')

const semHistorico = await aplicadorComRollback.reverter({ _id: 'x', validacao: { historico: [] } })
assert('sem aplicação do AE não há o que reverter', semHistorico.status === RESULTADO.IGNORADO)

const semAntes = await aplicadorComRollback.reverter({
  _id: 'y', validacao: { historico: [{ por: 'auditoria_rapida_ae' }] },
})
assert('evento sem estado anterior é erro explícito', semAntes.status === RESULTADO.ERRO)

// ─── 8. Adaptador MongoDB ────────────────────────────────────────────────────

secao('8. Adaptador MongoDB — guarda no filtro')

let chamada = null
const modeloFake = {
  updateOne: async (filtro, update, opcoes) => {
    chamada = { filtro, update, opcoes }
    return { matchedCount: 1 }
  },
}
const repoMongo = criarRepositorioMongo(modeloFake)
await repoMongo.aplicarNoRepositorio({
  id: 'eq-1', versaoEsperada: '1.0.0',
  set: { specs_canonicas: { potencia_w: 610 } },
  push: { 'validacao.historico': { $each: [{}] } },
})

assert('filtro carrega a versão esperada', chamada.filtro['origem.knowledge_version'] === '1.0.0')
assert('filtro carrega o id', chamada.filtro._id === 'eq-1')
assert('$set e $push na MESMA operação (atômica)',
  chamada.update.$set !== undefined && chamada.update.$push !== undefined)

const modeloSemMatch = { updateOne: async () => ({ matchedCount: 0 }) }
const semMatch = await criarRepositorioMongo(modeloSemMatch)
  .aplicarNoRepositorio({ id: 'x', versaoEsperada: '1.0.0', set: {}, push: null })
assert('matchedCount 0 vira estado_alterado', semMatch.status === RESULTADO.ESTADO_ALTERADO)

// ─── Resultado ───────────────────────────────────────────────────────────────

const sep = '═'.repeat(60)
console.log(`\n${sep}`)
console.log(`  RESULTADO: ${passed} ✅  |  ${failed} ❌  |  Total: ${passed + failed}`)
console.log(sep)

if (failed > 0) {
  console.error(`\n  ${failed} teste(s) falharam. Ver detalhes acima.`)
  process.exit(1)
} else {
  console.log('\n  F6 validada — aplicação atômica, guarda de concorrência e rollback. ✅')
}
