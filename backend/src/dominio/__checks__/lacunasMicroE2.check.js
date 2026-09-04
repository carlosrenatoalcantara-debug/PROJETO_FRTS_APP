/**
 * lacunasMicroE2.check.js — Sprint E2.
 *
 * O que este check protege:
 *  1. capacidade só existe com dado real, e a procedência nunca vira `ssot` por
 *     omissão;
 *  2. corrente é motor SEPARADO, reusa a primitiva normativa e devolve
 *     `nao_avaliado` sempre que falta limite — nunca "ok" por ausência;
 *  3. o limite do RAMAL não existe no SSOT e o sistema diz isso, em vez de
 *     inventar ampacidade;
 *  4. a política de arranjos × fases é nomeada e a fase vazia é campo próprio;
 *  5. composição com dois modelos não é uniformizada: capacidade e regra por
 *     modelo, balanceamento global;
 *  6. `max_por_cabo_tronco` — o nome que o sistema já usava — alimenta a regra;
 *  7. `n_mppts` NÃO é convertido em `entradas`.
 *
 * Puro: sem banco, sem HTTP.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  planejarMicros, planejarComposicaoMicro, POLITICA_ARRANJOS,
} from '@fortesolar/fv-shared/engenharia/arranjos-micro'
import {
  correnteDaEntrada, correnteDoMicro, correnteDoRamal, avaliarCorrenteMicro, VEREDITO,
} from '@fortesolar/fv-shared/engenharia/corrente-micro'
import { lerInversor, CAMPOS_INVERSOR } from '@fortesolar/fv-shared/inversores/dicionario'
import { FATOR_ISC_NBR16690 } from '@fortesolar/fv-shared/engenharia/normativa'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const DEYE = { entradas: 4, modulos_por_entrada: 1, fabricante: 'Deye', rotulo: 'Deye', origem: 'ssot' }
const HOY = { entradas: 2, modulos_por_entrada: 1, fabricante: 'Hoymiles', rotulo: 'Hoymiles' }

// ── 1. Capacidade e procedência ─────────────────────────────────────────────
secao('1. Capacidade só com dado real')
{
  ok(planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
    .capacidade_por_micro === 4, 'com entradas e módulos por entrada, capacidade é calculada')

  for (const [nome, micro] of [
    ['sem entradas', { modulos_por_entrada: 1, fabricante: 'Deye' }],
    ['sem módulos por entrada', { entradas: 4, fabricante: 'Deye' }],
    ['sem nada', { fabricante: 'Deye' }],
  ]) {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro, fases: 'Trifásico' })
    ok(p.capacidade_por_micro === null && p.distribuicao === null,
      `${nome}: sem capacidade e sem distribuição`)
  }
  ok(/entradas \/ módulos por entrada/i.test(
    planejarMicros({ modulos: 24, quantidade: 6, micro: { fabricante: 'Deye' }, fases: 'Trifásico' })
      .lacunas.join(' ')), 'a lacuna de capacidade é nomeada')

  ok(planejarMicros({ modulos: 24, quantidade: 6, micro: { ...DEYE, origem: undefined }, fases: 'Monofásico' })
    .procedencia_capacidade === 'desconhecida',
  'procedência sem declaração é `desconhecida`, nunca `ssot`')
  ok(planejarMicros({ modulos: 24, quantidade: 6, micro: { ...DEYE, origem: 'manual' }, fases: 'Monofásico' })
    .procedencia_capacidade === 'manual', 'entrada do operador é marcada como manual')
}

// ── 2. Corrente: motor separado e sem veredito por omissão ──────────────────
secao('2. Corrente')
{
  const src = readFileSync(path.join(RAIZ, '../packages/fv-shared/engenharia/correnteMicro.js'), 'utf8')
  ok(/from '\.\/engenhariaNormativa\.js'/.test(src) && /correnteProjeto/.test(src),
    'reusa a primitiva normativa em vez de reimplementar a fórmula')
  ok(!/[^_A-Za-z]1\.25[^0-9]/.test(src), 'o fator 1,25 não é reescrito aqui')

  // ── Ajuste de compatibilidade de corrente ────────────────────────────────
  // As duas asserções seguintes afirmavam que `Isc × 1,25` acima da corrente de
  // TRABALHO era `excedida`. São grandezas diferentes: quem reprova é o limite
  // de CURTO. O fator normativo continua calculado e continua conferido aqui.
  const boa = correnteDaEntrada({ iscModulo: 9, imppModulo: 8.5, limiteEntrada: 13, limiteCurto: 16.9 })
  ok(boa.veredito === VEREDITO.OK &&
     boa.projeto_normativa.corrente_a === +(9 * FATOR_ISC_NBR16690).toFixed(2),
  'dentro dos dois limites: `ok`, com o valor normativo reportado')
  ok(correnteDaEntrada({ iscModulo: 18.35, imppModulo: 17, limiteEntrada: 13, limiteCurto: 16.9 })
    .veredito === VEREDITO.EXCEDIDA,
  'Isc acima do limite de CURTO: `excedida`')
  ok(correnteDaEntrada({ iscModulo: 13.83, imppModulo: 14, limiteEntrada: 13, limiteCurto: 16.9 })
    .veredito === VEREDITO.ATENCAO,
  'Impp acima do limite de TRABALHO: `atencao`, nunca impedimento')
  ok(correnteDaEntrada({ iscModulo: 9 }).veredito === VEREDITO.NAO_AVALIADO,
    'sem limite declarado: `nao_avaliado`, nunca `ok`')
  ok(correnteDaEntrada({ limiteEntrada: 13 }).veredito === VEREDITO.NAO_AVALIADO,
    'sem Isc do módulo: `nao_avaliado`')
  ok(correnteDoMicro({}).veredito === VEREDITO.NAO_AVALIADO,
    'sem `corrente_ac_saida`: `nao_avaliado`')

  const ramal = correnteDoRamal({ correnteAcSaida: 10, micros: 3 })
  ok(ramal.corrente_a === 30, 'a corrente do ramal é calculada e informada')
  ok(ramal.veredito === VEREDITO.NAO_AVALIADO && ramal.limite_a === null,
    'mas o veredito é `nao_avaliado`: não há limite de ramal no SSOT')
  ok(/não declara limite/i.test(ramal.motivo), 'e o motivo diz exatamente isso')

  ok(!Object.keys(CAMPOS_INVERSOR).some((c) => /corrente.*(ramal|tronco)/i.test(c)),
    'nenhum campo de limite de ramal foi inventado no dicionário')

  const semDistribuicao = planejarMicros({ modulos: 24, quantidade: 6, micro: { fabricante: 'Deye' }, fases: 'Trifásico' })
  const comCorrente = avaliarCorrenteMicro({
    micro: { corrente_max_por_mppt: 13, corrente_isc_max: 16.9 },
    iscModulo: 9, imppModulo: 8.5,
  })
  ok(semDistribuicao.distribuicao === null && comCorrente.entrada.veredito === VEREDITO.OK,
    'corrente e distribuição são independentes: uma pode faltar sem derrubar a outra')
}

// ── 3. Política de arranjos × fases ─────────────────────────────────────────
secao('3. Arranjos × fases')
{
  ok(POLITICA_ARRANJOS.id === 'minimo_de_ramais', 'a política aplicada é nomeada')
  ok(!!POLITICA_ARRANJOS.descricao, 'e descrita')
  ok(POLITICA_ARRANJOS.alternativa_nao_implementada.id === 'ocupar_todas_as_fases'
    && /não existe no sistema/i.test(POLITICA_ARRANJOS.alternativa_nao_implementada.motivo),
  'a alternativa não implementada fica registrada com o motivo')

  const p6 = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Trifásico' })
  ok(JSON.stringify(p6.fases.fases_sem_arranjo) === '["L3"]',
    'fase sem arranjo é campo próprio, não um zero a interpretar')
  ok(/L3 sem nenhum microinversor/.test(p6.avisos.join(' ')), 'e é dita em texto')
  ok(p6.fases.politica === POLITICA_ARRANJOS.id, 'o plano declara qual política produziu o resultado')

  const p7 = planejarMicros({ modulos: 28, quantidade: 7, micro: DEYE, fases: 'Trifásico' })
  ok(JSON.stringify(p7.fases.por_fase) === '{"L1":3,"L2":3,"L3":1}' &&
    p7.fases.fases_sem_arranjo.length === 0, '7 micros ocupam as três fases')

  const p8 = planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' })
  ok(p8.fases.desequilibrio === 1, '8 micros: resíduo de 1, declarado')
  ok(JSON.stringify(planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' }))
    === JSON.stringify(p8), 'determinístico entre chamadas')

  const mono = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
  ok(mono.fases.atribuicao === null, 'monofásico continua sem fase fabricada')

  for (const rel of ['arranjosMicro.js', 'correnteMicro.js']) {
    const src = readFileSync(path.join(RAIZ, `../packages/fv-shared/engenharia/${rel}`), 'utf8')
    ok(!/from ['"][^'"]*(electrical|evInvariants)/.test(src) && !/max_imbalance_percent/.test(src),
      `${rel}: o limite de desequilíbrio do domínio EV não é usado`)
  }
}

// ── 4. Composição com dois modelos ──────────────────────────────────────────
secao('4. Composição mista')
{
  const c = planejarComposicaoMicro({
    modelos: [
      { modulos: 12, quantidade: 3, micro: { ...DEYE, rotulo: 'A' } },
      { modulos: 12, quantidade: 3, micro: { ...DEYE, rotulo: 'B' } },
    ],
    fases: 'Trifásico',
  })
  ok(c.por_modelo[0].arranjos[0].fase !== c.por_modelo[1].arranjos[0].fase,
    'dois modelos não empilham na mesma fase — o balanceamento é global')
  ok(c.por_modelo[0].fases.equilibrado === null,
    'nenhum modelo se declara equilibrado sozinho: quem sabe é a composição')

  const dif = planejarComposicaoMicro({
    modelos: [
      { modulos: 12, quantidade: 3, micro: { ...DEYE, rotulo: 'Deye' } },
      { modulos: 8, quantidade: 4, micro: { ...HOY, rotulo: 'Hoymiles' } },
    ],
    fases: 'Trifásico',
  })
  ok(JSON.stringify(dif.por_modelo.map((p) => p.capacidade_por_micro)) === '[4,2]',
    'capacidades diferentes são preservadas, não uniformizadas')
  ok(JSON.stringify(dif.por_modelo[0].distribuicao) === '[4,4,4]' &&
    JSON.stringify(dif.por_modelo[1].distribuicao) === '[2,2,2,2]',
  'cada modelo distribui pela SUA capacidade')
  ok(dif.por_modelo[0].regra.fonte === 'fabricante' && dif.por_modelo[1].regra.fonte === null,
    'cada modelo usa a SUA regra — nenhum herda a do outro')
  ok(dif.homogenea === false && /capacidades diferentes/i.test(dif.avisos.join(' ')),
    'a heterogeneidade é declarada, não mascarada')
  ok(dif.por_modelo.map((p) => p.rotulo).join('|') === 'Deye|Hoymiles',
    'cada modelo continua identificável')
}

// ── 5. Vocabulário do SSOT ──────────────────────────────────────────────────
secao('5. SSOT')
{
  ok(lerInversor({ max_por_cabo_tronco: 4 }).max_por_cabo_tronco === 4,
    '`max_por_cabo_tronco` — nome que o extrator de datasheet já grava — alimenta a regra')
  ok(lerInversor({}).max_por_cabo_tronco === null, 'ausente continua null')

  for (const rel of ['arranjosMicro.js', 'correnteMicro.js', 'regrasMicroFabricante.js']) {
    const src = readFileSync(path.join(RAIZ, `../packages/fv-shared/engenharia/${rel}`), 'utf8')
    ok(!/n_mppts|entradas_por_mppt/.test(src),
      `${rel}: \`n_mppts\` não é convertido em \`entradas\``)
  }
}

console.log(`\n${falhas === 0 ? '✓ TODOS OS CHECKS PASSARAM' : `✗ ${falhas} CHECK(S) FALHARAM`}`)
process.exit(falhas === 0 ? 0 : 1)
