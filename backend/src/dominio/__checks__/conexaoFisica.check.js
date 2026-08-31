/**
 * conexaoFisica.check.js — FV-DOM-047
 *
 * Guarda as decisões das FV-DOM-044/045/046 contra regressão silenciosa.
 * O que ele protege é sobretudo o que a conexão **NÃO** faz.
 *
 *   node backend/src/dominio/__checks__/conexaoFisica.check.js
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  conexaoVazia, estaConectada, normalizarConexao, exigirRegistroValido,
  avaliarDivergencia, exigirOpcaoEscolhida, lacunasDaConexao,
  ErroConexao, MOTIVOS_CONEXAO,
} from '../conexao/index.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
const ler = (rel) => { try { return readFileSync(path.resolve(RAIZ, rel), 'utf8') } catch { return '' } }
const codigo = (rel) => ler(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)

const DOMINIO = 'backend/src/dominio/conexao/index.js'
const SCHEMA = 'backend/src/models/ProjetoFV.js'
const CTRL = 'backend/src/controllers/projetosFVController.js'

console.log('═══ FV-DOM-047 — conexão física ═══')

// ═══ 1 · Fato, não máquina ═════════════════════════════════════════════════
secao('1 · Conexão é fato, não máquina de estado')
{
  const fonte = codigo(DOMINIO)
  ok(!/enum|ESTADOS_|TRANSICOES/.test(fonte), 'nenhum enum, estado ou tabela de transição')
  ok(estaConectada({ conectada_em: new Date() }) === true, 'com data → conectada')
  ok(estaConectada(conexaoVazia()) === false, 'sem data → não conectada')
  ok(conexaoVazia().conectada_em === null, '`null` é a única forma de "não conectada"')

  const bloco = ler(SCHEMA).slice(ler(SCHEMA).indexOf('conexao: {'),
    ler(SCHEMA).indexOf('conexao: {') + 320)
  for (const campo of ['conectada_em', 'numero_medidor', 'observacoes']) {
    ok(bloco.includes(campo), `contrato tem \`${campo}\``)
  }
  for (const proibido of ['registrada_por', 'sem_homologacao', 'estado:', 'enum']) {
    ok(!bloco.includes(proibido), `contrato SEM \`${proibido}\``)
  }
}

// ═══ 2 · Zero efeito colateral ═════════════════════════════════════════════
secao('2 · Não toca Gate, Baseline nem projeto.status')
{
  const fonte = codigo(DOMINIO)
  for (const [rot, re] of [
    ['`projeto.status`', /projeto\.status|status:\s*'(em_execucao|concluido)'/],
    ['Baseline', /Baseline|baseline/],
    ['Gate', /avaliarGate|exigirBaseline|FASES_BIFURCACAO/],
  ]) ok(!re.test(fonte), `o domínio não menciona ${rot}`)

  const ctrl = codigo(CTRL)
  const bloco = ctrl.slice(ctrl.indexOf('export const registrarConexaoFV'),
    ctrl.indexOf('export const removerConexaoFV'))
  ok(!/projeto\.status\s*=/.test(bloco), 'o endpoint não escreve `projeto.status`')
  ok(!/Baseline|congelar/.test(bloco), 'nem toca Baseline')
  ok(/estadoDaOpcao\(projeto, irmas\)/.test(bloco),
    'lê o estado da opção pelo domínio do Gate — leitura, não alteração')
  ok(!/avaliarGate|exigirGate/.test(bloco), 'e NÃO invoca o Gate')
}

// ═══ 3 · A data é o fato ═══════════════════════════════════════════════════
secao('3 · Validação: só a data')
{
  const casos = [
    [null, MOTIVOS_CONEXAO.SEM_DATA, 'ausente'],
    ['', MOTIVOS_CONEXAO.SEM_DATA, 'vazia'],
    ['ontem', MOTIVOS_CONEXAO.DATA_INVALIDA, 'ilegível'],
    ['2099-01-01', MOTIVOS_CONEXAO.DATA_NO_FUTURO, 'no futuro'],
  ]
  for (const [valor, codigoEsperado, rot] of casos) {
    let e = null
    try { exigirRegistroValido({ conectada_em: valor }) } catch (err) { e = err }
    ok(e instanceof ErroConexao && e.codigo === codigoEsperado,
      `data ${rot} → ${e?.codigo}`)
  }
  const d = exigirRegistroValido({ conectada_em: '2026-05-14' })
  ok(d instanceof Date, 'data válida devolve Date')

  // Medidor NUNCA é validado — não há regra que o sustente.
  ok(!/numero_medidor[\s\S]{0,120}throw/.test(codigo(DOMINIO)),
    'nenhuma validação de `numero_medidor`')
  ok(lacunasDaConexao({ conectada_em: new Date() }).includes('conexao.numero_medidor'),
    'medidor ausente é LACUNA, não erro')
  ok(normalizarConexao({ numero_medidor: '   ' }).numero_medidor === null,
    'medidor em branco vira null, nunca valor plausível')
}

// ═══ 4 · Divergência derivada ══════════════════════════════════════════════
secao('4 · Divergência é derivada, nunca persistida')
{
  const conectada = { conectada_em: new Date() }
  ok(avaliarDivergencia({ conexao: conectada, statusHomologacao: 'homologado' })
    .divergente === false, 'conectada + homologado → sem divergência')
  const rep = avaliarDivergencia({ conexao: conectada, statusHomologacao: 'reprovado' })
  ok(rep.divergente === true && /REPROVADA/.test(rep.motivo),
    'conectada + reprovada → divergência declarada')
  ok(avaliarDivergencia({ conexao: conectada, statusHomologacao: null }).divergente === true,
    'conectada sem homologação → divergência declarada')
  ok(avaliarDivergencia({ conexao: conexaoVazia(), statusHomologacao: 'reprovado' })
    .divergente === false, 'não conectada nunca diverge')

  // NÃO bloqueia — é o oposto de impedir.
  const fonte = codigo(DOMINIO)
  ok(!/avaliarDivergencia[\s\S]{0,200}throw/.test(fonte),
    '`avaliarDivergencia` não lança — informa')
  const ctrl = codigo(CTRL)
  ok(!/divergencia[\s\S]{0,80}(return res\.status\(4|throw)/.test(ctrl),
    'e o endpoint não recusa por divergência')
}

// ═══ 5 · Regra 5 da FV-DOM-032 ═════════════════════════════════════════════
secao('5 · Só a opção escolhida registra conexão')
{
  ok(exigirOpcaoEscolhida(null) === true, 'projeto sem grupo: não bloqueia')
  ok(exigirOpcaoEscolhida({ aceita: true, grupo_tem_aceita: true }) === true,
    'a opção aceita: registra')
  ok(exigirOpcaoEscolhida({ aceita: false, grupo_tem_aceita: false }) === true,
    'ninguém escolheu ainda: não bloqueia')
  let e = null
  try { exigirOpcaoEscolhida({ aceita: false, grupo_tem_aceita: true, rotulo: 'Opção 02' }) }
  catch (err) { e = err }
  ok(e?.codigo === MOTIVOS_CONEXAO.OPCAO_NAO_ESCOLHIDA && e.status === 409,
    `opção não escolhida → ${e?.codigo} (HTTP ${e?.status})`)
}

// ═══ 6 · Legado intocado ═══════════════════════════════════════════════════
secao('6 · O legado `conectado` não é migrado nem convertido')
{
  const ctrl = codigo(CTRL)
  const bloco = ctrl.slice(ctrl.indexOf('export const obterConexaoFV'),
    ctrl.indexOf('export const removerConexaoFV'))
  ok(!/homologacao\.status\s*=/.test(bloco), 'nenhum endpoint escreve `homologacao.status`')
  ok(/legado_conectado/.test(bloco), 'mas o valor histórico é EXIBIDO')
  ok(!/conectada_em\s*=\s*[^n]/.test(bloco.replace(/conectada_em: data/g, '')),
    'nenhum backfill de data a partir do legado')
  const schema = ler(SCHEMA)
  ok(/enum: \['rascunho', 'enviado', 'analise', 'aprovado', 'conectado'\]/.test(schema),
    'e o enum legado segue intacto no schema')
}

// ═══ 7 · Auditoria obrigatória ═════════════════════════════════════════════
secao('7 · Toda escrita audita — o defeito que a máquina A tem')
{
  const ctrl = codigo(CTRL)
  const registrar = ctrl.slice(ctrl.indexOf('export const registrarConexaoFV'),
    ctrl.indexOf('export const removerConexaoFV'))
  const remover = ctrl.slice(ctrl.indexOf('export const removerConexaoFV'))
  ok(/auditarCiclo\(/.test(registrar), 'registrar audita')
  ok(/CONEXAO_CORRIGIDA[\s\S]{0,40}CONEXAO_REGISTRADA|CONEXAO_REGISTRADA/.test(registrar),
    'distinguindo registro de correção')
  ok(/auditarCiclo\(req, 'CONEXAO_REMOVIDA'/.test(remover), 'remover audita')

  /**
   * O contraste que justifica a exigência: `atualizarStatusHomologacao` (máquina
   * legada A) grava SEM auditar — e é por isso que a data e o autor de todo
   * `conectado` existente se perderam (FV-DOM-045 §1.7).
   */
  const homolog = codigo('backend/src/controllers/homologacaoController.js')
  ok(!/auditar|AuditLog/.test(homolog),
    'confirmado: o controller da máquina A continua sem auditoria (defeito registrado)')
}

console.log(falhas === 0
  ? '\nOK — conexão é fato auditado, sem efeito colateral e sem regra inventada.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
