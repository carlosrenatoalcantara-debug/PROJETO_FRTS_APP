/**
 * legadoOrcamento.check.js — FV-DOM-003
 *
 * Comprova que `ProjetoFV.orcamento` tornou-se SOMENTE LEGADO:
 *   • zero escrita funcional
 *   • zero leitura funcional (nenhum fluxo depende dele)
 *   • agregado `Orcamento` é a única fonte operacional
 *
 * Inclui varredura ESTÁTICA do código-fonte — a prova de "zero consumidores"
 * não pode depender só de runtime.
 *
 *   node backend/src/dominio/__checks__/legadoOrcamento.check.js
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ProjetoFV } from '../../models/ProjetoFV.js'
import { Cotacao } from '../../models/Cotacao.js'
import { Orcamento } from '../../models/Orcamento.js'
import { Baseline } from '../../models/Baseline.js'
import { Cliente } from '../../models/Cliente.js'
import { Local } from '../../models/Local.js'
import { salvarEtapaProjetoFV, buscarProjetoFV } from '../../controllers/projetosFVController.js'
void Cliente; void Local

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../..')          // backend/
const FRONT = path.resolve(RAIZ, '../frontend/src')

function arquivos(dir, ext = ['.js', '.jsx']) {
  const out = []
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome)
    if (statSync(p).isDirectory()) {
      if (/__tests__|__checks__|node_modules|_deprecated/.test(nome)) continue
      out.push(...arquivos(p, ext))
    } else if (ext.includes(path.extname(nome))) out.push(p)
  }
  return out
}

function fakeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
  }
}

async function main() {
  // ═══ 1. Varredura estática ════════════════════════════════════════════════
  secao('1 · Varredura estática do código-fonte')

  const fontes = [...arquivos(path.join(RAIZ, 'src')), ...arquivos(FRONT)]
  const ADAPTER = path.join('dominio', 'orcamento', 'obterOrcamentoProjeto.js')

  const escritas = []
  const leituras = []
  for (const f of fontes) {
    const rel = path.relative(path.resolve(RAIZ, '..'), f)
    const linhas = readFileSync(f, 'utf8').split('\n')
    linhas.forEach((l, i) => {
      // Descarta comentários (de linha inteira ou finais) e linhas de doc-block.
      const codigo = /^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l.replace(/\/\/.*$/, '')
      if (/\$set\.orcamento\b|\$set\[['"]orcamento/.test(codigo)) escritas.push(`${rel}:${i + 1}`)
      // Leitura do SUBDOC de ProjetoFV. Exclui: o adapter (compat) e os arquivos
      // de ProjetoEV — `ProjetoEV.orcamento` é OUTRO agregado, fora deste escopo.
      if (f.includes(ADAPTER) || /EV[A-Za-z]*\.jsx?$|projetosEVController/.test(path.basename(f))) return
      if (/\b(projeto|proj|plano|p)\??\.orcamento\b(?!_vigente|_agregado)/.test(codigo)) {
        leituras.push(`${rel}:${i + 1}  ${l.trim().slice(0, 70)}`)
      }
    })
  }

  ok(escritas.length === 0, `ZERO escrita funcional em ProjetoFV.orcamento (${escritas.length} encontradas)`)
  escritas.forEach((e) => console.log('    →', e))
  ok(leituras.length === 0, `ZERO leitura funcional fora do adapter (${leituras.length} encontradas)`)
  leituras.forEach((e) => console.log('    →', e))

  // O adapter deve ter exatamente 1 consumidor: o fallback histórico.
  const usosAdapter = []
  for (const f of fontes) {
    if (f.includes(ADAPTER)) continue
    const rel = path.relative(path.resolve(RAIZ, '..'), f)
    readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (/obterOrcamentoProjeto\s*\(/.test(l)) usosAdapter.push(`${rel}:${i + 1}`)
    })
  }
  ok(usosAdapter.length === 1, `adapter tem 1 consumidor (fallback histórico): ${usosAdapter.join(', ') || 'nenhum'}`)

  // ═══ 2. Runtime ═══════════════════════════════════════════════════════════
  const mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all([Cotacao.init(), Orcamento.init(), Baseline.init()])

  const empresa_id = new mongoose.Types.ObjectId()
  const req = (id, body) => ({ auth: { empresa_id, email: 'check@fv' }, params: { id }, body, headers: {}, socket: {} })

  secao('2 · Escrita: a etapa NÃO toca mais o subdocumento')

  const projeto = await ProjetoFV.create({
    nome: 'FV-DOM-003', clienteId: new mongoose.Types.ObjectId(), empresa_id,
    consumo_kwh_mes: 800, valor_kwh: 0.92,
  })
  const pid = String(projeto._id)

  const PAYLOAD = {
    modo: 'kit',
    kit: { fornecedor: 'Aldo', valor_kit_r: 18000, frete_r: 1200, projeto_r: 900, mao_obra_r: 4000 },
    itens_adicionais: [{ descricao: 'Estrutura extra', tipo: 'material', quantidade: 2, valor: 350 }],
    payback_anos: 4.1, irr_pct: 22.4, npv_r: 31000,
  }

  const r1 = fakeRes()
  await salvarEtapaProjetoFV(req(pid, { etapa: 'orcamento', dados: PAYLOAD }), r1)
  ok(r1.statusCode === 200, 'etapa orcamento salva (200)')

  const doc = await ProjetoFV.findById(pid).lean()
  ok(doc.orcamento == null, 'subdocumento permanece NULL — a escrita foi removida')
  ok(doc.financeiro?.payback_anos === 4.1 && doc.financeiro?.irr_pct === 22.4,
     '`financeiro.*` continua espelhado (não é o subdoc legado; agregado não persiste derivados)')

  const orc = await Orcamento.findOne({ projeto_ref: projeto._id }).lean()
  ok(!!orc && orc.itens.length === 5, `orçamento gravado NO AGREGADO (${orc?.itens?.length} itens)`)

  secao('3 · Leitura: a UX lê o agregado, não a projeção legada')

  const r2 = fakeRes()
  await buscarProjetoFV(req(pid, {}), r2)
  const vig = r2.body?.orcamento_vigente
  ok(!!vig, 'GET expõe `orcamento_vigente` — forma própria do agregado')
  ok(vig.estado === 'RASCUNHO' && Array.isArray(vig.itens) && vig.itens.length === 5, 'agregado exposto íntegro')
  ok(vig.totais?.total_venda_r === 24800, `totais derivados do agregado (R$ ${vig.totais?.total_venda_r})`)
  ok(String(vig.cotacao_ref).length === 24, 'proveniência: aponta para a Cotação de origem')

  secao('4 · Independência do subdocumento')

  // Gravar lixo no subdoc não pode afetar nada do fluxo novo.
  await ProjetoFV.collection.updateOne({ _id: projeto._id },
    { $set: { orcamento: { total_venda_r: 999999, preco_venda_r: 999999 } } })
  const r3 = fakeRes()
  await buscarProjetoFV(req(pid, {}), r3)
  ok(r3.body?.orcamento_vigente?.totais?.total_venda_r === 24800,
     'lixo no subdocumento NÃO contamina `orcamento_vigente` — independência total')

  secao('5 · Compatibilidade preservada para projetos históricos')

  const historico = await ProjetoFV.create({
    nome: 'Histórico', clienteId: new mongoose.Types.ObjectId(), empresa_id,
    orcamento: { modo: 'kit', total_venda_r: 15000, preco_venda_r: 15000 },
  })
  const r4 = fakeRes()
  await buscarProjetoFV(req(String(historico._id), {}), r4)
  ok(r4.body?.orcamento_vigente === null, 'projeto histórico não tem agregado')
  ok(r4.body?.orcamento?.total_venda_r === 15000,
     'projeto histórico AINDA exibe seu orçamento — é por isso que o adapter sobrevive')

  secao('6 · Falha ao gravar o agregado é FATAL (fecha o achado A-3)')

  // Sem a ponte legada, engolir o erro perderia o orçamento silenciosamente.
  // O handler tem try/catch no topo: a exceção vira 500. O que importa é que o
  // cliente NÃO receba 200 com o orçamento perdido — antes, o erro era engolido.
  const projFalha = await ProjetoFV.create({ nome: 'Falha', clienteId: new mongoose.Types.ObjectId(), empresa_id })
  const original = Orcamento.prototype.save
  Orcamento.prototype.save = function () { throw new Error('falha simulada de persistência') }
  const rFalha = fakeRes()
  try {
    await salvarEtapaProjetoFV(req(String(projFalha._id), { etapa: 'orcamento', dados: PAYLOAD }), rFalha)
  } catch { rFalha.statusCode = 500 }
  Orcamento.prototype.save = original
  ok(rFalha.statusCode >= 400, `falha ao gravar o agregado vira erro ${rFalha.statusCode} — não é mais engolida (antes: 200)`)
  ok(await Orcamento.countDocuments({ projeto_ref: projFalha._id }) === 0, 'nenhum orçamento fantasma foi criado')

  await mongoose.disconnect()
  await mongod.stop()

  console.log(falhas === 0
    ? '\nOK — ProjetoFV.orcamento é somente legado; o agregado é a única fonte operacional'
    : `\n${falhas} FALHA(S)`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
