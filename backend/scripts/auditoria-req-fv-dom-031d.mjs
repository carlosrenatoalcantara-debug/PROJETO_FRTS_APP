/**
 * auditoria-req-fv-dom-031d.mjs — FV-DOM-031D, item 3
 *
 * O defeito: `homologacaoController::_carregarDepsDocumento` referencia `req`,
 * que NÃO é parâmetro dela. O `ReferenceError` cai no `try/catch` e a função
 * devolve `{ equipamentos: [], beneficiarias: [], origem: 'vivo' }` sempre.
 *
 * A sprint manda determinar, ANTES de corrigir:
 *   a) quais fluxos usam a função;
 *   b) se a correção altera documentos STRING existentes.
 *
 * Este script responde (b) medindo: gera o MESMO memorial duas vezes — com o
 * `deps` que a função devolve HOJE, e com o `deps` que ela devolveria CORRIGIDA
 * — e compara caractere a caractere. Não altera arquivo algum.
 *
 * Ambiente isolado (37017).
 *
 *   node backend/scripts/auditoria-req-fv-dom-031d.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { gerarMemorialDescritivo } from '../src/services/memorialDescritivoService.js'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

await mongoose.connect(cred.uri)
const { ProjetoFV } = await import('../src/models/ProjetoFV.js')
const { Equipamento } = await import('../src/models/Equipamento.js')
const { UnidadeBeneficiaria } = await import('../src/models/UnidadeBeneficiaria.js')

console.log('═══ FV-DOM-031D · item 3 — o que a correção do `req` mudaria ═══\n')

// ── (a) Quais fluxos usam a função ──────────────────────────────────────────
const fonte = readFileSync(path.join(RAIZ, 'src/controllers/homologacaoController.js'), 'utf8')
const usos = fonte.split('\n')
  .map((l, i) => [i + 1, l])
  .filter(([, l]) => /_carregarDepsDocumento\(/.test(l) && !/^function|^async function/.test(l.trim()))
console.log('── (a) chamadas de `_carregarDepsDocumento`')
for (const [n, l] of usos) console.log(`   linha ${n}: ${l.trim()}`)
const exportadores = fonte.split('\n')
  .map((l, i) => [i + 1, l])
  .filter(([, l]) => /^export (async )?function/.test(l))
console.log('   endpoints do controller:')
for (const [n, l] of exportadores) console.log(`     linha ${n}: ${l.trim().replace('export ', '').split('(')[0]}`)
console.log('   ↳ um único fluxo consome `deps`: `gerarMemorial`.')

// ── (b) O `deps` de hoje × o `deps` corrigido ───────────────────────────────
const projetos = await ProjetoFV.find({}).sort({ createdAt: -1 }).limit(12).lean()
console.log(`\n── (b) ${projetos.length} projeto(s) do ambiente, memorial gerado duas vezes\n`)

const col = (v, n) => String(v ?? '—').padEnd(n)
console.log(col('PROJETO', 34) + col('TOPOLOGIA', 11) + col('deps HOJE', 26) + col('deps CORRIGIDO', 28) + 'MEMORIAL')

let mudam = 0
const amostras = []
for (const p of projetos) {
  const arranjos = Array.isArray(p.arranjos) ? p.arranjos : []
  const a = arranjos.find((x) => x?.tipo === 'principal') ?? arranjos[0] ?? null
  const micros = a?.configuracao_eletrica?.micros?.length ? a.configuracao_eletrica.micros : null
  const topologia = micros ? 'micro' : 'string'

  // O que a função devolve HOJE (o `catch` engole o ReferenceError).
  const hoje = { equipamentos: [], beneficiarias: [], origem: 'vivo', itens_adicionais: [] }

  // O que ela devolveria com `req` correto — mesmas consultas, sem o escopo
  // (o ambiente isolado tem um tenant só, então o escopo não filtraria nada).
  const ids = []
  for (const e of (p?.equipamentos?.paineis || [])) { const id = e?.equipamento_id || e?.id; if (mongoose.Types.ObjectId.isValid(id)) ids.push(id) }
  const inv = p?.equipamentos?.inversor
  if (inv && mongoose.Types.ObjectId.isValid(inv.equipamento_id || inv.id)) ids.push(inv.equipamento_id || inv.id)
  const corrigido = {
    equipamentos: ids.length ? await Equipamento.find({ _id: { $in: ids } }).lean() : [],
    beneficiarias: await UnidadeBeneficiaria.find({ projetoId: p._id }).lean(),
    origem: 'vivo', itens_adicionais: [],
  }

  const base = {
    ...p, potencia_kwp: p.dimensionamento?.potencia_kwp ?? 0,
    strings: { totalStrings: 2, modulosPorString: 12, totalModulos: p.dimensionamento?.num_paineis ?? 24 },
    estrutura: p.equipamentos?.estrutura ?? {},
    inversor: { marca: inv?.marca, modelo: inv?.modelo, potenciaKW: inv?.potencia_kw, fases: inv?.fases, nMppts: 2 },
    painel: { marca: p.equipamentos?.paineis?.[0]?.marca, modelo: p.equipamentos?.paineis?.[0]?.modelo,
      potenciaW: p.equipamentos?.paineis?.[0]?.potencia_w },
  }
  const cli = { nome: 'Cliente' }
  const antes = gerarMemorialDescritivo(base, cli, { ...hoje, micros })
  const depois = gerarMemorialDescritivo(base, cli, { ...corrigido, micros })
  const igual = antes === depois
  if (!igual) { mudam++; amostras.push({ nome: p.nome, topologia, antes, depois }) }

  console.log(col(String(p.nome).slice(0, 32), 34) + col(topologia, 11) +
    col(`${hoje.equipamentos.length} eq · ${hoje.beneficiarias.length} benef`, 26) +
    col(`${corrigido.equipamentos.length} eq · ${corrigido.beneficiarias.length} benef`, 28) +
    (igual ? 'idêntico' : '◄ MUDA'))
}

console.log(`\n   projetos cujo memorial MUDARIA com a correção: ${mudam} de ${projetos.length}`)

if (amostras.length > 0) {
  const a = amostras[0]
  console.log(`\n── Amostra da divergência (${a.nome}, ${a.topologia})`)
  const la = a.antes.split('\n')
  const ld = a.depois.split('\n')
  let mostradas = 0
  for (let i = 0; i < Math.max(la.length, ld.length) && mostradas < 12; i++) {
    if (la[i] !== ld[i]) {
      console.log(`   linha ${i + 1}`)
      console.log(`     HOJE     : ${la[i] ?? '(ausente)'}`)
      console.log(`     CORRIGIDO: ${ld[i] ?? '(ausente)'}`)
      mostradas++
    }
  }
}

console.log('\n── Conclusão')
console.log(mudam === 0
  ? '   A correção NÃO alteraria memorial algum neste ambiente.'
  : `   A correção ALTERA ${mudam} memorial(is). É reativação de comportamento\n` +
    '   legado não validado — a sprint manda PARAR e reportar.')

await mongoose.disconnect()
