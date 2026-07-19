/**
 * instalacaoService.check.js — S4A-FV-INSTALACAO-WRITE-PATH-01
 *
 * Teste de INTEGRAÇÃO do write path (backend não tem runner; roda com `node`).
 * Sobe um MongoDB em memória (mongodb-memory-server) e exercita o ciclo real:
 * criar → recuperar → atualizar → excluir, com Geradores/MPPT/Strings, refs de
 * Catálogo/Local/Superfície, e integridade do agregado (validações).
 *
 *   node backend/src/services/__checks__/instalacaoService.check.js
 *
 * Sai com código ≠ 0 se qualquer asserção falhar.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Equipamento } from '../../models/Equipamento.js'
import { Local } from '../../models/Local.js'
import { Instalacao } from '../../models/Instalacao.js'
import { InstalacaoService, ErroValidacaoInstalacao } from '../InstalacaoService.js'
import { montarGerador, montarString } from '../../dominio/topologia/index.js'

let falhas = 0
const ok = (cond, msg) => { console.log((cond ? '✓' : '✗ FALHOU') + ' ' + msg); if (!cond) falhas++ }

async function main() {
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  // ── Catálogo mínimo (inversor 2 MPPT + módulo) ─────────────────────────────
  const inversor = await Equipamento.create({ tipo: 'inversor', fabricante: 'Growatt', modelo: 'MIN-10', especificacoes: { n_mppts: 2, entradas_por_mppt: 2, potencia_kw: 10 } })
  const modulo = await Equipamento.create({ tipo: 'modulo', fabricante: 'Canadian', modelo: 'CS-550', especificacoes: { potencia_wp: 550, voc: 49.8, isc: 13.9 } })

  // ── Local com uma Superfície (para validar String→Superfície) ──────────────
  const local = await Local.create({ coordenadas: { latitude: -21.1, longitude: -47.8 }, superficies: [{ nome: 'Telhado Sul', azimute_graus: 180, inclinacao_graus: 20 }] })
  const supId = local.superficies[0]._id

  // ── Topologia válida (2 MPPT, 1 string cada, 12 módulos) ───────────────────
  function topologiaValida() {
    const g = montarGerador({ _id: inversor._id, especificacoes: { n_mppts: 2 } })
    g.mppts[0].strings.push(montarString({ indice_entrada: 1, composicao: [{ modulo_ref: modulo._id, quantidade: 12 }], superficie_id: supId }))
    g.mppts[1].strings.push(montarString({ indice_entrada: 1, composicao: [{ modulo_ref: modulo._id, quantidade: 12 }], superficie_id: supId }))
    return { local_ref: local._id, geradores: [g] }
  }

  // 1) CRIAR + PERSISTIR
  const criada = await InstalacaoService.criar(topologiaValida())
  ok(!!criada._id, 'criar: Instalação persistida com _id')
  ok(criada.geradores.length === 1 && criada.geradores[0].mppts.length === 2, 'criar: 1 gerador + 2 MPPTs')
  const totalStrings = criada.geradores[0].mppts.reduce((s, m) => s + m.strings.length, 0)
  ok(totalStrings === 2, 'criar: 2 strings incluídas')

  // 2) RECUPERAR (novo documento do banco)
  const recuperada = await InstalacaoService.buscar(criada._id)
  ok(!!recuperada, 'buscar: recupera do banco')
  ok(String(recuperada.geradores[0].inversor_ref) === String(inversor._id), 'buscar: inversor_ref persistido')
  ok(String(recuperada.geradores[0].mppts[0].strings[0].superficie_id) === String(supId), 'buscar: superficie_id persistido')
  ok(recuperada.geradores[0].mppts[0]._id === undefined, 'buscar: MPPT sem _id (endereçado por índice)')

  // 3) ATUALIZAR (adiciona 2ª string no MPPT 1)
  const patchGeradores = recuperada.toObject().geradores
  patchGeradores[0].mppts[0].strings.push({ indice_entrada: 2, composicao: [{ modulo_ref: modulo._id, quantidade: 12 }], superficie_id: supId })
  const atualizada = await InstalacaoService.atualizar(criada._id, { geradores: patchGeradores })
  const strDepois = atualizada.geradores[0].mppts[0].strings.length
  ok(strDepois === 2, 'atualizar: MPPT 1 passou a ter 2 strings')
  const releitura = await InstalacaoService.buscar(criada._id)
  ok(releitura.geradores[0].mppts[0].strings.length === 2, 'atualizar: persistiu (releitura confirma)')

  // 4) VALIDAÇÕES — rejeições
  async function esperaErro(dados, trecho, label) {
    try { await InstalacaoService.criar(dados); ok(false, label + ' (deveria falhar)') }
    catch (e) { ok(e instanceof ErroValidacaoInstalacao && e.erros.some(x => x.includes(trecho)), label) }
  }
  // 4a) inversor inexistente
  const semInv = topologiaValida(); semInv.geradores[0].inversor_ref = new mongoose.Types.ObjectId()
  await esperaErro(semInv, 'não existe no Catálogo', 'valida: inversor inexistente rejeitado')
  // 4b) nº de MPPT ≠ catálogo (remove um MPPT)
  const mpptErrado = topologiaValida(); mpptErrado.geradores[0].mppts.pop()
  await esperaErro(mpptErrado, 'MPPT(s) declarados', 'valida: nº de MPPT ≠ n_mppts rejeitado (INV-03)')
  // 4c) superfície fora do Local
  const supErrada = topologiaValida(); supErrada.geradores[0].mppts[0].strings[0].superficie_id = new mongoose.Types.ObjectId()
  await esperaErro(supErrada, 'não pertence ao Local', 'valida: superfície fora do Local rejeitada')
  // 4d) módulo que é inversor (tipo errado)
  const modErrado = topologiaValida(); modErrado.geradores[0].mppts[0].strings[0].composicao[0].modulo_ref = inversor._id
  await esperaErro(modErrado, 'não é módulo', 'valida: módulo com tipo errado rejeitado')
  // 4e) composição vazia (estrutural)
  const vazia = topologiaValida(); vazia.geradores[0].mppts[0].strings[0].composicao = []
  await esperaErro(vazia, 'estrutura', 'valida: composição vazia rejeitada (schema)')

  // 5) EXCLUIR
  const removida = await InstalacaoService.excluir(criada._id)
  ok(!!removida, 'excluir: retorna documento removido')
  ok((await InstalacaoService.buscar(criada._id)) === null, 'excluir: não recuperável após remoção')

  // 6) ISOLAMENTO — Instalacao não referencia ProjetoFV (sem ciclo)
  ok(!('projeto_ref' in Instalacao.schema.paths) && !('projetoFV_ref' in Instalacao.schema.paths), 'isolamento: Instalacao NÃO referencia ProjetoFV')

  await mongoose.disconnect()
  await mongod.stop()

  console.log(falhas === 0 ? '\nOK — write path íntegro (criar/recuperar/atualizar/excluir + validações).' : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('✖ check falhou:', e); process.exit(1) })
