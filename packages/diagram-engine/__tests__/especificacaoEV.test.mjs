/**
 * BUG-021 FASE 2 — a ESPECIFICAÇÃO EXECUTIVA é a fonte única de componentes/condutores.
 *
 * O que estes testes travam:
 *  - identidade permanente dos condutores (L1/L2/L3/N/PE) — nunca texto livre;
 *  - componentes obrigatórios especificados só por atributos técnicos (sem fabricante/modelo);
 *  - retrocompatibilidade: projeto sem a estrutura cai no fallback derivado do Motor;
 *  - PRECEDÊNCIA: quando a especificação existe, ela GANHA do Motor — é o que impede
 *    o unifilar de desenhar um componente antigo depois que o operador trocou a spec.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  derivarEspecificacaoEV, especificacaoDoProjeto, especificacaoValida, quantidadeDPS, bitolaPrincipal,
} from '../adapters/especificacaoEV.js'
import { adaptarProjetoEV, argsDeProjetoEV } from '../adapters/ev.js'

const calcMotor = { disjuntor_a: 40, bitola_cabo_mm2: 10, dr_ma: 30, dps_kv: 420 }
const carrTri = { numero_fases: 3, tensao_entrada_v: 380, potencia_kw: 22 }
const carrMono = { numero_fases: 1, tensao_entrada_v: 220, potencia_kw: 7 }

test('BUG-021.3: condutores têm identidade permanente (mono = L1,N,PE / tri = L1,L2,L3,N,PE)', () => {
  const mono = derivarEspecificacaoEV({ calculos: calcMotor, carregador: carrMono, comprimento_cabo_m: 25 })
  const tri = derivarEspecificacaoEV({ calculos: calcMotor, carregador: carrTri, comprimento_cabo_m: 25 })
  assert.deepEqual(mono.condutores.map(c => c.id), ['L1', 'N', 'PE'])
  assert.deepEqual(tri.condutores.map(c => c.id), ['L1', 'L2', 'L3', 'N', 'PE'])
  // bitola e comprimento são os ÚNICOS campos editáveis — vêm semeados do Motor.
  assert.equal(tri.condutores.every(c => c.bitola_mm2 === 10 && c.comprimento_m === 25), true)
})

test('BUG-021.4: componentes obrigatórios existem e não carregam fabricante/modelo', () => {
  const esp = derivarEspecificacaoEV({ calculos: calcMotor, carregador: carrTri, comprimento_cabo_m: 25 })
  assert.deepEqual(esp.componentes.disjuntor, { corrente_a: 40, curva: 'C', polos: 4 })
  assert.deepEqual(esp.componentes.idr, { corrente_a: 40, sensibilidade_ma: 30, tipo: 'A', polos: 4 })
  assert.deepEqual(esp.componentes.dps, { classe: 'II', tensao_v: 420, imax_ka: 45, polos: 1 })
  for (const c of Object.values(esp.componentes)) {
    assert.equal('fabricante' in c, false)
    assert.equal('modelo' in c, false)
  }
})

test('BUG-021.1: nº de DPS = 1 por condutor vivo (mono 2, tri 4)', () => {
  assert.equal(quantidadeDPS(derivarEspecificacaoEV({ calculos: calcMotor, carregador: carrMono })), 2)
  assert.equal(quantidadeDPS(derivarEspecificacaoEV({ calculos: calcMotor, carregador: carrTri })), 4)
})

test('retrocompat: projeto SEM especificação cai no fallback derivado do Motor', () => {
  const esp = especificacaoDoProjeto({ calculos_nbr: calcMotor, carregadores: [carrTri], comprimento_cabo_m: 30 })
  assert.equal(esp.fases, 3)
  assert.equal(esp.componentes.disjuntor.corrente_a, 40)
  assert.equal(bitolaPrincipal(esp), 10)
  assert.equal(esp.condutores[0].comprimento_m, 30)
})

test('casca vazia do Mongoose NÃO é especificação válida — cai no fallback do Motor', () => {
  // Ao adicionar `especificacao` ao schema, o Mongoose passa a materializar os DEFAULTS
  // em TODO projeto antigo: componentes existem mas sem valores, e condutores: []. Se
  // isso passasse por "especificação salva", um projeto TRIFÁSICO abriria com 2 DPS e
  // zero condutores. A regra de validade tem que rejeitar essa casca.
  const casca = {
    versao: 1, fases: null,
    componentes: {
      disjuntor: { corrente_a: null, curva: 'C', polos: null },
      idr: { corrente_a: null, sensibilidade_ma: 30, tipo: 'A', polos: null },
      dps: { classe: 'II', tensao_v: null, imax_ka: 45, polos: 1 },
    },
    condutores: [],
  }
  assert.equal(especificacaoValida(casca), false)

  const esp = especificacaoDoProjeto({ especificacao: casca, calculos_nbr: calcMotor, carregadores: [carrTri], comprimento_cabo_m: 25 })
  assert.equal(esp.fases, 3)                                   // e não null
  assert.equal(quantidadeDPS(esp), 4)                          // e não 2
  assert.deepEqual(esp.condutores.map(c => c.id), ['L1', 'L2', 'L3', 'N', 'PE'])
  assert.equal(esp.componentes.disjuntor.corrente_a, 40)
})

test('projeto COM especificação salva: ela vence o Motor (não se volta ao fallback)', () => {
  const salva = derivarEspecificacaoEV({ calculos: calcMotor, carregador: carrTri, comprimento_cabo_m: 25 })
  salva.componentes.disjuntor.corrente_a = 50      // operador trocou o disjuntor
  const esp = especificacaoDoProjeto({ especificacao: salva, calculos_nbr: calcMotor, carregadores: [carrTri] })
  assert.equal(esp.componentes.disjuntor.corrente_a, 50)  // NÃO voltou para os 40 A do Motor
})

test('BUG-021.2: o UNIFILAR desenha a especificação — não o valor antigo do Motor', () => {
  // Operador especifica algo DIFERENTE do que o Motor dimensionou.
  const esp = derivarEspecificacaoEV({ calculos: calcMotor, carregador: carrTri, comprimento_cabo_m: 25 })
  esp.componentes.disjuntor.corrente_a = 63
  esp.componentes.disjuntor.curva = 'D'
  esp.componentes.idr.sensibilidade_ma = 300
  esp.componentes.idr.tipo = 'B'
  esp.componentes.dps.tensao_v = 275
  esp.componentes.dps.imax_ka = 65
  esp.condutores.forEach(c => { c.bitola_mm2 = 16 })
  esp.condutores.find(c => c.id === 'PE').bitola_mm2 = 10   // PE com bitola própria

  const { components, connections } = adaptarProjetoEV({
    calculos: calcMotor, bom: [], numero_fases: 3, carregador: carrTri, projeto: { fases: 3 }, especificacao: esp,
  })
  const disj = components.find(c => c.id === 'disj')
  const dr = components.find(c => c.id === 'dr')
  const dps = components.filter(c => c.tipo === 'dps')

  assert.equal(disj.specs.corrente_a, 63)      // e NÃO os 40 A do Motor
  assert.equal(disj.specs.curva, 'D')
  assert.equal(dr.specs.ma, 300)
  assert.equal(dr.specs.classe, 'B')
  assert.equal(dps.length, 4)
  assert.equal(dps[0].specs.tensao_v, 275)
  assert.equal(dps[0].specs.imax_ka, 65)

  // Condutores: tronco com a bitola especificada; PE com a SUA bitola (16 vs 10).
  const tronco = connections.find(c => c.id === 'c-dr-carr')
  const terra = connections.find(c => c.id === 'c-terra-barr-carr')
  assert.equal(tronco.specs.bitola_mm2, 16)
  assert.equal(terra.condutores[0].bitola_mm2, 10)
})

test('projeto LEGADO: a lista impressa é REGENERADA (não imprime 2 DPS num trifásico)', () => {
  // Projeto salvo ANTES da correção: bom com 2 DPS e strings antigas, e sem especificação.
  // O PDF não pode desenhar 4 DPS e imprimir "2 un" ao lado.
  const bomAntigo = [
    { item: 'Disjuntor termomagnético', especificacao: '40A Curva C', quantidade: 1, unidade: 'un', categoria: 'Proteções' },
    { item: 'DPS (Proteção contra Surtos)', especificacao: '420V Classe II', quantidade: 2, unidade: 'un', categoria: 'Proteções' },
  ]
  const projeto = {
    calculos_nbr: calcMotor, carregadores: [carrTri], comprimento_cabo_m: 25,
    bom: bomAntigo, fases: 3,
  }
  const args = argsDeProjetoEV(projeto)
  const dps = args.bom.find(b => /^DPS/.test(b.item))
  const disj = args.bom.find(b => /^Disjuntor/.test(b.item))
  assert.equal(dps.quantidade, 4)                                   // e não os 2 salvos
  assert.equal(disj.especificacao, '40A Curva C · 4P')              // string nova, com polos
  assert.equal(args.bom.filter(b => /^Cabo /.test(b.item)).length, 5) // 5 condutores (tri)
})

test('projeto MIGRADO: a lista SALVA é respeitada (preços/quantidades do operador)', () => {
  const esp = derivarEspecificacaoEV({ calculos: calcMotor, carregador: carrTri, comprimento_cabo_m: 25 })
  const bomOperador = [
    { item: 'Disjuntor termomagnético', especificacao: '40A Curva C · 4P', quantidade: 1, unidade: 'un', preco_unitario: 120 },
  ]
  const args = argsDeProjetoEV({
    especificacao: esp, calculos_nbr: calcMotor, carregadores: [carrTri], comprimento_cabo_m: 25, bom: bomOperador, fases: 3,
  })
  assert.equal(args.bom.length, 1)                       // não regenerou por cima
  assert.equal(args.bom[0].preco_unitario, 120)          // preservou o preço do operador
})
