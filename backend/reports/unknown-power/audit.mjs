// READ-ONLY — P0-UNKNOWN-POWER-FORENSICS-01. Não altera nada.
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { Equipamento } from '../../src/models/Equipamento.js'
import { ProjetoFV } from '../../src/models/ProjetoFV.js'
import fs from 'fs'; import { fileURLToPath } from 'url'

await conectarBD(); if (mongoose.connection.readyState !== 1) { console.error('DB_OFFLINE'); process.exit(1) }
const dir = fileURLToPath(new URL('./', import.meta.url))

const num = (v) => { if (v == null || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null }
const pick = (o, ks) => { for (const k of ks) { const v = num(o?.[k]); if (v !== null && v > 0) return v } return null }
// Chaves lidas pela engenharia hoje
const INV_LIDAS = ['potencia_kw', 'potencia', 'potencia_ca']
const MOD_LIDAS = ['potencia_wp', 'potencia_w', 'potencia']
// Qualquer chave "de potência" (para detectar dado em campo alternativo)
const ehChavePotencia = (k) => /pot[eê]ncia|^pac$|^p_?ca$|^p_?max|^pmax|^pn$|^kva$|^kw$|^wp$/i.test(k)

// Projetos por equipamento (id + fab|modelo)
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
const projetos = await ProjetoFV.find({}, 'equipamentos.inversor equipamentos.paineis arranjos.inversores arranjos.paineis').lean()
const pid = new Map(), pfm = new Map()
const add = (m, k, id) => { if (!k) return; const s = m.get(String(k)) || new Set(); s.add(id); m.set(String(k), s) }
for (const p of projetos) {
  const id = String(p._id)
  const refs = []
  if (p.equipamentos?.inversor) refs.push(p.equipamentos.inversor)
  for (const x of (p.equipamentos?.paineis || [])) refs.push(x)
  for (const a of (p.arranjos || [])) { for (const i of (a.inversores || [])) refs.push(i); for (const m of (a.paineis || [])) refs.push(m) }
  for (const r of refs) { if (r?.equipamento_id) add(pid, r.equipamento_id, id); const fb = r?.fabricante || r?.marca; if (fb && r?.modelo) add(pfm, `${norm(fb)}|${norm(r.modelo)}`, id) }
}
const projDe = (eq) => { const s = new Set(); for (const i of (pid.get(String(eq._id)) || [])) s.add(i); for (const i of (pfm.get(`${norm(eq.fabricante)}|${norm(eq.modelo)}`) || [])) s.add(i); return s.size }

// Classificação A/B/C de um item "?"
function classificar(eq, lidas) {
  const esp = eq.especificacoes || {}
  // B: potência existe em OUTRA chave de especificacoes (além das lidas)
  const altEsp = Object.keys(esp).find(k => ehChavePotencia(k) && !lidas.includes(k) && num(esp[k]) > 0)
  if (altEsp) return { classe: 'B', detalhe: `especificacoes.${altEsp}=${esp[altEsp]}` }
  // A: potência no topo do doc (fora de especificacoes)
  const topo = Object.keys(eq).find(k => ehChavePotencia(k) && num(eq[k]) > 0)
  if (topo) return { classe: 'A', detalhe: `topo.${topo}=${eq[topo]}` }
  // C: realmente não existe
  return { classe: 'C', detalhe: 'nenhum campo de potência' }
}

const ESTRATEGICOS = ['deye', 'growatt', 'goodwe', 'tsun', 'hoymiles', 'solaredge', 'kehua']
const ehEstrategico = (fab) => ESTRATEGICOS.some(s => norm(fab).includes(s))

async function auditar(tipo, lidas) {
  const eqs = await Equipamento.find({ tipo }, 'fabricante modelo origem especificacoes').lean()
  const semPot = eqs.filter(e => pick(e.especificacoes || {}, lidas) === null)
  const itens = semPot.map(e => {
    const cls = classificar(e, lidas)
    return { _id: String(e._id), fabricante: e.fabricante, modelo: e.modelo, origem: e.origem?.tipo ?? null,
      projetos: projDe(e), classe: cls.classe, classe_detalhe: cls.detalhe, estrategico: ehEstrategico(e.fabricante) }
  }).sort((a, b) => b.projetos - a.projetos)
  return { total_tipo: eqs.length, sem_potencia: itens }
}

const inv = await auditar('inversor', INV_LIDAS)
const mod = await auditar('modulo', MOD_LIDAS)

// FASE2 — por fabricante (inversores)
const porFab = {}
for (const it of inv.sem_potencia) { const f = it.fabricante || '—'; porFab[f] = porFab[f] || { equipamentos: 0, projetos: new Set(), estrategico: it.estrategico }; porFab[f].equipamentos++; }
for (const it of inv.sem_potencia) for (let n = 0; n < 1; n++) { /* projetos por fab abaixo */ }
// projetos por fabricante (união)
const projPorFab = {}
{
  const fabEqs = {}
  for (const it of inv.sem_potencia) { (fabEqs[it.fabricante || '—'] = fabEqs[it.fabricante || '—'] || []).push(it) }
  for (const [f, list] of Object.entries(fabEqs)) {
    const s = new Set()
    // recomputa projetos por equipamento já temos it.projetos (count), mas para união precisamos ids — usa pfm/pid
    projPorFab[f] = list.reduce((acc, it) => acc + 0, 0) // placeholder; usamos soma de projetos por equip (com possível sobreposição baixa)
  }
}
const rankFab = Object.entries(porFab).map(([f, v]) => ({ fabricante: f, equipamentos: v.equipamentos,
  projetos: inv.sem_potencia.filter(x => (x.fabricante || '—') === f).reduce((s, x) => s + x.projetos, 0),
  estrategico: v.estrategico })).sort((a, b) => b.equipamentos - a.equipamentos)

// FASE3 — contagens A/B/C
const cont = (arr) => arr.reduce((a, x) => { a[x.classe] = (a[x.classe] || 0) + 1; return a }, { A: 0, B: 0, C: 0 })
const invABC = cont(inv.sem_potencia), modABC = cont(mod.sem_potencia)

// FASE4 — estratégico vs binding
const estrat = inv.sem_potencia.filter(x => x.estrategico)
const binding = inv.sem_potencia.filter(x => !x.estrategico)
const somaProj = (arr) => arr.reduce((s, x) => s + x.projetos, 0)

// Deliverables
fs.writeFileSync(dir + 'UNKNOWN_POWER_INVENTORY.json', JSON.stringify({
  sprint: 'P0-UNKNOWN-POWER-FORENSICS-01', read_only: true, gerado_em: new Date().toISOString(),
  inversores: { total: inv.total_tipo, sem_potencia: inv.sem_potencia.length, itens: inv.sem_potencia },
  modulos: { total: mod.total_tipo, sem_potencia: mod.sem_potencia.length, itens: mod.sem_potencia },
}, null, 2))
fs.writeFileSync(dir + 'UNKNOWN_POWER_BY_MANUFACTURER.json', JSON.stringify({
  gerado_em: new Date().toISOString(), inversores_sem_potencia: inv.sem_potencia.length,
  top20: rankFab.slice(0, 20), todos: rankFab,
}, null, 2))
fs.writeFileSync(dir + 'UNKNOWN_POWER_PRIORITY_MATRIX.json', JSON.stringify({
  gerado_em: new Date().toISOString(),
  fase3_origem: { inversores: invABC, modulos: modABC },
  fase4_impacto: {
    estrategicos: { equipamentos: estrat.length, projetos: somaProj(estrat), pct_equip: +(estrat.length / inv.sem_potencia.length * 100).toFixed(1) },
    binding_only: { equipamentos: binding.length, projetos: somaProj(binding), pct_equip: +(binding.length / inv.sem_potencia.length * 100).toFixed(1) },
  },
  fase5_prioridade: {
    P0_estrategicos_com_projetos: estrat.filter(x => x.projetos > 0).length,
    P1_estrategicos_sem_projetos_ou_binding_com_projetos: estrat.filter(x => x.projetos === 0).length + binding.filter(x => x.projetos > 0).length,
    P2_binding_sem_projetos: binding.filter(x => x.projetos === 0).length,
  },
}, null, 2))

console.log('INVERSORES sem potencia:', inv.sem_potencia.length, '| MODULOS:', mod.sem_potencia.length)
console.log('A/B/C inversores:', JSON.stringify(invABC), '| modulos:', JSON.stringify(modABC))
console.log('estrategicos:', estrat.length, 'equip /', somaProj(estrat), 'proj | binding:', binding.length, 'equip /', somaProj(binding), 'proj')
console.log('TOP fabricantes:', JSON.stringify(rankFab.slice(0, 12).map(r => `${r.fabricante}:${r.equipamentos}(${r.projetos}p)${r.estrategico ? '*' : ''}`)))
console.log('P0/P1/P2:', estrat.filter(x => x.projetos > 0).length, '/', estrat.filter(x => x.projetos === 0).length + binding.filter(x => x.projetos > 0).length, '/', binding.filter(x => x.projetos === 0).length)
await mongoose.connection.close(); process.exit(0)
