/**
 * instalacaoModel.check.js — S2-FV-TOPOLOGY-FOUNDATION-01
 *
 * Verificação do SCHEMA do Aggregate Root Instalacao (o backend não tem runner de
 * testes; este check roda com `node` e valida via validateSync, sem DB).
 * A lógica de fábrica é coberta por vitest (frontend/.../topologiaFV.test.js).
 *
 *   node backend/src/dominio/topologia/__checks__/instalacaoModel.check.js
 *
 * Sai com código ≠ 0 se qualquer invariante estrutural falhar.
 */
import mongoose from 'mongoose'
import { Instalacao } from '../../../models/Instalacao.js'
import { montarGerador, montarString } from '../index.js'

const oid = () => new mongoose.Types.ObjectId()
let falhas = 0
const ok = (cond, msg) => { console.log((cond ? '✓' : '✗ FALHOU') + ' ' + msg); if (!cond) falhas++ }

const inv = { _id: oid(), especificacoes: { n_mppts: 2, entradas_por_mppt: 2 } }
const sup = oid(), modA = oid(), modB = oid()

// Topologia válida completa (mono-modelo + heterogênea).
const g = montarGerador(inv)
g.mppts[0].strings.push(montarString({ indice_entrada: 1, composicao: [{ modulo_ref: modA, quantidade: 12 }], superficie_id: sup }))
g.mppts[1].strings.push(montarString({ indice_entrada: 1, composicao: [{ modulo_ref: modA, quantidade: 10 }, { modulo_ref: modB, quantidade: 2 }], superficie_id: sup }))
const inst = new Instalacao({ local_ref: null, geradores: [g] })

ok(!inst.validateSync(), 'Instalacao valida topologia completa')
ok(!!inst.geradores[0]._id, 'Gerador TEM identidade própria (_id)')
ok(inst.geradores[0].mppts[0]._id === undefined, 'MPPT SEM _id (endereçado por índice)')
ok(inst.geradores[0].mppts[0].strings[0]._id === undefined, 'String SEM _id (endereçada por entrada)')
ok(inst.geradores[0].mppts.length === 2, 'MPPTs materializados = n_mppts do Catálogo')
ok(inst.geradores[0].ramal_ca_ref === null, 'Ramal CA deferido (null)')

// strict mode descarta qualquer derivado injetado na String.
const injetado = new Instalacao({ geradores: [{ inversor_ref: inv._id, mppts: [{ indice: 1, strings: [{ indice_entrada: 1, superficie_id: sup, composicao: [{ modulo_ref: modA, quantidade: 5 }], voc: 500, kwp: 2.7, isc: 13, quantidade: 5 }] }] }] })
const s = injetado.geradores[0].mppts[0].strings[0]
ok(s.voc === undefined && s.kwp === undefined && s.isc === undefined, 'derivados (voc/kwp/isc) descartados pelo schema')
ok(s.quantidade === undefined, 'String NÃO tem quantidade própria')
ok(Array.isArray(s.composicao) && s.composicao[0].quantidade === 5, 'quantidade existe só POR ITEM da composição')

// Invariantes rejeitadas.
ok(!!new Instalacao({ geradores: [{ inversor_ref: inv._id, mppts: [{ indice: 1, strings: [{ superficie_id: sup, composicao: [] }] }] }] }).validateSync(), 'composição vazia é rejeitada')
ok(!!new Instalacao({ geradores: [{ inversor_ref: inv._id, mppts: [{ indice: 1, strings: [{ composicao: [{ modulo_ref: modA, quantidade: 5 }] }] }] }] }).validateSync(), 'String sem superficie_id é rejeitada')
ok(!!new Instalacao({ geradores: [{ mppts: [] }] }).validateSync(), 'Gerador sem inversor_ref é rejeitado')

console.log(falhas === 0 ? '\nOK — todas as invariantes do schema passaram.' : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
