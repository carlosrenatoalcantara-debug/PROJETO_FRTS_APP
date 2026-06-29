/**
 * test_fluxo_completo.mjs — P0-CATALOGO-MESTRE-MATERIAIS (Sprint 2B — validação e2e)
 *
 * Valida o FLUXO COMPLETO de cadastro contra um MongoDB EFÊMERO (mongodb-memory-server)
 * — zero escrita remota. Exercita as rotas/controllers/models/serviços reais:
 * seed de templates → criar (descrição auto + chave + classe do template) → unicidade
 * → validações do template → busca → histórico (cap 5) → status.
 *
 * Execução: npm run test:catalogo:e2e
 */
import assert from 'node:assert/strict'
import express from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { CategoriaMaterial } from '../../src/models/CategoriaMaterial.js'
import { TEMPLATES_CATEGORIA } from '../../src/seeds/catalogoTemplates.js'
import rotasMateriais from '../../src/routes/materiais.js'
import rotasCategorias from '../../src/routes/categoriasMaterial.js'

let passos = 0
const ok = (m) => { passos++; console.log(`  ✓ ${m}`) }

const mongod = await MongoMemoryServer.create()
await mongoose.connect(mongod.getUri())

// Seed dos templates (empresa_id null = tenant default, igual ao req anônimo)
for (const t of TEMPLATES_CATEGORIA) {
  await CategoriaMaterial.updateOne({ empresa_id: null, chave: t.chave }, { $set: { ...t, empresa_id: null, ativo: true } }, { upsert: true })
}

const app = express()
app.use(express.json())
app.use((req, _res, next) => { req.auth = null; next() })   // anônimo → empresa_id null
app.use('/api/materiais', rotasMateriais)
app.use('/api/categorias-material', rotasCategorias)
const srv = app.listen(0)
const base = `http://127.0.0.1:${srv.address().port}`
const call = async (m, p, body) => {
  const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

const CABO = {
  categoria: 'cabos', unidade: 'm', precoReferencia: { valor: 13 },
  especificacoes: [
    { chave: 'bitola_mm2', valor: '10' }, { chave: 'tensao_isolamento_v', valor: '0,6/1kV' },
    { chave: 'material_condutor', valor: 'cobre' }, { chave: 'n_condutores', valor: '1' },
  ],
}

const PROT = {
  categoria: 'protecao_eletrica', unidade: 'un',
  especificacoes: [{ chave: 'tipo', valor: 'Trilho DIN' }],
}

try {
  // 1. Templates expostos (5 categorias consolidadas)
  let r = await call('GET', '/api/categorias-material')
  assert.equal(r.status, 200); assert.equal(r.body.itens.length, 5)
  ok('GET /categorias-material retorna os 5 templates')

  // 2. Criar cabo — descrição auto + classe do template + chave + preço carimbado
  r = await call('POST', '/api/materiais', CABO)
  assert.equal(r.status, 201)
  assert.equal(r.body.descricao, 'Cabo 10mm² 1C 0,6/1kV cobre')
  assert.equal(r.body.classe, 'commodity')
  assert.match(r.body.chaveCanonica, /^[a-f0-9]{40}$/)
  assert.equal(r.body.precoReferencia.valor, 13)
  assert.ok(r.body.precoReferencia.atualizadoEm)
  const idCabo = r.body._id
  ok('POST cabos: 201, descrição automática, classe=commodity, chave, preço carimbado')

  // 3. Unicidade da identidade
  r = await call('POST', '/api/materiais', CABO)
  assert.equal(r.status, 409); assert.equal(r.body.codigo, 'DUPLICADO')
  ok('POST cabo duplicado: 409 (chave canônica única)')

  // 4. Obrigatório/identidade ausente
  r = await call('POST', '/api/materiais', { ...CABO, especificacoes: CABO.especificacoes.filter(e => e.chave !== 'material_condutor') })
  assert.equal(r.status, 422); assert.ok(r.body.erros.some(e => /material_condutor/.test(e)))
  ok('POST cabos sem atributo obrigatório: 422 com erro do template')

  // 5. Categoria sem template
  r = await call('POST', '/api/materiais', { ...CABO, categoria: 'inexistente' })
  assert.equal(r.status, 422); assert.equal(r.body.codigo, 'SEM_TEMPLATE')
  ok('POST categoria sem template: 422 SEM_TEMPLATE')

  // 6. Proteção elétrica: cria Trilho DIN com categoria simples
  r = await call('POST', '/api/materiais', PROT)
  assert.equal(r.status, 201)
  assert.equal(r.body.descricao, 'Trilho DIN')
  assert.equal(r.body.classe, 'commodity')
  ok('POST protecao_eletrica: 201, descrição=tipo, classe=commodity')

  // 7. protecao_eletrica sem atributo tipo → 422
  r = await call('POST', '/api/materiais', { categoria: 'protecao_eletrica', unidade: 'un', especificacoes: [] })
  assert.equal(r.status, 422); assert.ok(r.body.erros.some(e => /tipo/.test(e)))
  ok('POST protecao_eletrica sem tipo: 422')

  // 8. Busca
  r = await call('GET', '/api/materiais?q=cabo')
  assert.equal(r.status, 200); assert.ok(r.body.paginacao.total >= 1)
  ok('GET /materiais?q=cabo encontra o material')

  // 9. Histórico com cap de 5
  for (let i = 1; i <= 6; i++) await call('POST', `/api/materiais/${idCabo}/compras`, { fornecedor: `Forn ${i}`, valor: 10 + i })
  r = await call('GET', `/api/materiais/${idCabo}`)
  assert.equal(r.body.historicoCompras.length, 5)
  assert.equal(r.body.historicoCompras[4].fornecedor, 'Forn 6')   // mantém as 5 mais recentes
  ok('histórico de compras limitado a 5 (mantém as mais recentes)')

  // 10. Alterar status (sem exclusão física)
  r = await call('PATCH', `/api/materiais/${idCabo}/status`, { status: 'inativo' })
  assert.equal(r.status, 200); assert.equal(r.body.status, 'inativo')
  ok('PATCH status: inativo (sem exclusão física)')

  console.log(`\n✅ ${passos} verificações e2e passaram contra MongoDB efêmero (zero escrita remota).`)
} finally {
  srv.close(); await mongoose.disconnect(); await mongod.stop()
}
process.exit(0)
