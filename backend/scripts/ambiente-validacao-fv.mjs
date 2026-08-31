/**
 * ambiente-validacao-fv.mjs — ambiente ISOLADO para validar o fluxo FV.
 *
 * FV-UX-012A. Sobe um MongoDB efêmero (mongodb-memory-server) numa porta fixa,
 * semeia o mínimo para operar a nova UX e imprime as credenciais.
 *
 * ── Por que não usar o banco configurado ─────────────────────────────────────
 * O `.env` aponta para o Atlas de PRODUÇÃO. Rodar o teste lá seria:
 *   • criar as coleções cotacaos/orcamentos/baselines, que não existem;
 *   • gerar uma Baseline IMUTÁVEL e INDELETÁVEL por desenho (M-2) — um artefato
 *     de teste ficaria permanentemente no contrato de um projeto real.
 * Além disso seria inútil: todos os 588 projetos têm `empresa_id: null` e o RBAC
 * é fail-closed desde a Fase 0.5 — nenhum token operaria sobre eles.
 *
 * Uso:
 *   node backend/scripts/ambiente-validacao-fv.mjs
 * Mantém o processo vivo até Ctrl+C. Escreve as credenciais em
 * `backend/.ambiente-validacao.json` para o restante da sprint consumir.
 */
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const PORTA = 37017

const mongod = await MongoMemoryServer.create({ instance: { port: PORTA, dbName: 'forte_solar_validacao' } })
const uri = mongod.getUri('forte_solar_validacao')
await mongoose.connect(uri)

const { ProjetoFV } = await import('../src/models/ProjetoFV.js')
const { Cliente } = await import('../src/models/Cliente.js')
const { Empresa } = await import('../src/models/Empresa.js')
const { Equipamento } = await import('../src/models/Equipamento.js')
const { Cotacao } = await import('../src/models/Cotacao.js')
const { Orcamento } = await import('../src/models/Orcamento.js')
const { Baseline } = await import('../src/models/Baseline.js')
await Promise.all([Cotacao.init(), Orcamento.init(), Baseline.init()])

// ── Semente mínima ──────────────────────────────────────────────────────────
// Sufixo único: o mongodb-memory-server reaproveita o dbpath entre execuções,
// e um CNPJ fixo colidiria com o índice único na segunda rodada.
const selo = Date.now().toString().slice(-8)
const empresa = await Empresa.create({ nome: `Forte Solar — Validação ${selo}`, cnpj: selo.padStart(14, '9') })
const cliente = await Cliente.create({
  nome: `Cliente de Validação ${selo}`, email: `validacao+${selo}@exemplo.com`,
  cidade: 'Natal', estado: 'RN', empresa_id: empresa._id,
})
await Equipamento.create([
  { tipo: 'modulo',   fabricante: 'DAH',  modelo: 'DHN-550' },
  { tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN-5K' },
])

// Projeto LIMPO: sem cotação, sem orçamento, sem baseline — o teste começa do zero.
const projeto = await ProjetoFV.create({
  nome: `Projeto de Validação ${selo}`,
  clienteId: cliente._id,
  empresa_id: empresa._id,
  status: 'rascunho',
  consumo_kwh_mes: 800,
  valor_kwh: 0.92,
  cidade: 'Natal', estado: 'RN',
})

const credenciais = {
  uri,
  porta: PORTA,
  empresa_id: String(empresa._id),
  cliente_id: String(cliente._id),
  projeto_id: String(projeto._id),
  criado_em: new Date().toISOString(),
}
writeFileSync(path.join(RAIZ, '.ambiente-validacao.json'), JSON.stringify(credenciais, null, 2))

console.log('╔══ AMBIENTE DE VALIDAÇÃO FV-UX-012A ══╗')
console.log('URI        :', uri)
console.log('empresa_id :', credenciais.empresa_id)
console.log('projeto_id :', credenciais.projeto_id)
console.log('\nEstado inicial do projeto (registro §1):')
console.log('  cotações   :', await Cotacao.countDocuments({ projeto_ref: projeto._id }))
console.log('  orçamentos :', await Orcamento.countDocuments({ projeto_ref: projeto._id }))
console.log('  baselines  :', await Baseline.countDocuments({ projeto_ref: projeto._id }))
console.log('  status     :', projeto.status, '| freeze:', projeto.governanca?.freeze_status ?? 'null')
console.log('\nAmbiente no ar. Ctrl+C para encerrar.')

process.on('SIGINT', async () => { await mongoose.disconnect(); await mongod.stop(); process.exit(0) })
await new Promise(() => {})
