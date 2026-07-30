// READ-ONLY — FASE 1-3 do P1-INVERTER-DATASHEET-ENRICH-01.
// Inventaria os inversores invalidos (SEM_ESPECIFICACOES), agrupa, e calcula ROI
// (projetos beneficiados) por modelo. Nao altera nada.
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { Equipamento } from '../../src/models/Equipamento.js'
import { ProjetoFV } from '../../src/models/ProjetoFV.js'
import fs from 'fs'
import { fileURLToPath } from 'url'

await conectarBD()
if (mongoose.connection.readyState !== 1) { console.error('DB_OFFLINE'); process.exit(1) }

// Inversores invalidos
const invInversores = await Equipamento.find(
  { tipo: 'inversor', 'qualidade.nivel': 'invalido' },
  'fabricante modelo origem qualidade.nivel qualidade.alertas.codigo especificacoes'
).lean()

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
const temSemEspec = (eq) => (eq.qualidade?.alertas || []).some(a => a.codigo === 'SEM_ESPECIFICACOES')
const ehSM = (eq) => {
  const o = eq.origem || {}
  return o.tipo === 'import_solarmarket' || /solarmarket|solar market/i.test(`${o.tipo||''} ${o.fonte||''} ${o.arquivo_original_url||''}`)
}

// Carrega todos os projetos FV uma vez, indexando referencias a inversores (id + fab/modelo)
const projetos = await ProjetoFV.find({},
  'equipamentos.inversor arranjos.inversores').lean()

const projsPorEquipId = new Map()   // equipamento_id -> Set(projetoIdx)
const projsPorFabMod  = new Map()   // norm(fab)|norm(mod) -> Set(projetoIdx)
const addId = (m,k,i)=>{ if(!k)return; const s=m.get(String(k))||new Set(); s.add(i); m.set(String(k),s) }
projetos.forEach((p, i) => {
  const refs = []
  if (p.equipamentos?.inversor) refs.push(p.equipamentos.inversor)
  for (const arr of (p.arranjos || [])) for (const inv of (arr.inversores || [])) refs.push(inv)
  for (const r of refs) {
    if (r?.equipamento_id) addId(projsPorEquipId, r.equipamento_id, i)
    const fab = r?.fabricante || r?.marca, mod = r?.modelo
    if (fab && mod) addId(projsPorFabMod, `${norm(fab)}|${norm(mod)}`, i)
  }
})

const projetosDe = (eq) => {
  const set = new Set()
  for (const i of (projsPorEquipId.get(String(eq._id)) || [])) set.add(i)
  for (const i of (projsPorFabMod.get(`${norm(eq.fabricante)}|${norm(eq.modelo)}`) || [])) set.add(i)
  return set
}

// Inventario por (fabricante, modelo)
const porModelo = new Map()
for (const eq of invInversores) {
  const key = `${norm(eq.fabricante)}|${norm(eq.modelo)}`
  const cur = porModelo.get(key) || {
    fabricante: eq.fabricante, modelo: eq.modelo, ocorrencias: 0, ids: [],
    sem_especificacoes: 0, solarmarket: 0, projetos: new Set(),
  }
  cur.ocorrencias++
  cur.ids.push(String(eq._id))
  if (temSemEspec(eq)) cur.sem_especificacoes++
  if (ehSM(eq)) cur.solarmarket++
  for (const i of projetosDe(eq)) cur.projetos.add(i)
  porModelo.set(key, cur)
}

// Classificacao A/B/C — heuristica conservadora sobre identificabilidade do modelo
function classificar(modelo, fabricante) {
  const m = String(modelo || '').trim()
  const fab = String(fabricante || '').trim()
  const lixo = !m || /^(modulo|inversor|n\/?a|desconhecid|sem nome|--)$/i.test(m)
  // tem token alfanumerico tipo codigo (ex.: SUN-5K-G, MIN 5000TL-X, GW80K-HT)
  const temCodigo = /[A-Za-z]*\d+[A-Za-z0-9\-\.\/]*/.test(m) && m.replace(/[^A-Za-z0-9]/g,'').length >= 4
  const fabConhecido = fab.length >= 2 && !/desconhec/i.test(fab)
  if (lixo || !fabConhecido) return 'C' // ambiguo
  if (temCodigo && fabConhecido) return 'A' // datasheet facilmente localizavel
  return 'B' // parcialmente identificado
}

const modelos = [...porModelo.values()].map(v => ({
  fabricante: v.fabricante, modelo: v.modelo,
  ocorrencias: v.ocorrencias, sem_especificacoes: v.sem_especificacoes,
  solarmarket: v.solarmarket, projetos_beneficiados: v.projetos.size,
  classe: classificar(v.modelo, v.fabricante), ids: v.ids,
}))

// Rankings
const porOcorrencia = [...modelos].sort((a,b)=> b.ocorrencias-a.ocorrencias || b.projetos_beneficiados-a.projetos_beneficiados)
const porROI = [...modelos].sort((a,b)=> b.projetos_beneficiados-a.projetos_beneficiados || b.ocorrencias-a.ocorrencias)

const fabricantes = {}
for (const m of modelos) {
  const f = m.fabricante || '(sem)'
  fabricantes[f] = fabricantes[f] || { modelos_unicos:0, ocorrencias:0, projetos:0 }
  fabricantes[f].modelos_unicos++; fabricantes[f].ocorrencias += m.ocorrencias
  fabricantes[f].projetos += m.projetos_beneficiados
}
const fabRank = Object.entries(fabricantes).map(([fab,v])=>({fab,...v}))
  .sort((a,b)=> b.ocorrencias-a.ocorrencias)

const classeResumo = { A:0,B:0,C:0 }
const classeOcorr = { A:0,B:0,C:0 }
for (const m of modelos){ classeResumo[m.classe]++; classeOcorr[m.classe]+=m.ocorrencias }

const out = {
  sprint:'P1-INVERTER-DATASHEET-ENRICH-01', fase:'1-3', read_only:true,
  gerado_em:new Date().toISOString(),
  total_inversores_invalidos: invInversores.length,
  modelos_unicos: modelos.length,
  fabricantes_rank: fabRank,
  classificacao: { por_modelo: classeResumo, por_ocorrencia: classeOcorr },
  ranking_por_ocorrencia: porOcorrencia,
  ranking_por_roi: porROI,
}
const path = fileURLToPath(new URL('./INVENTARIO_ROI.json', import.meta.url))
fs.writeFileSync(path, JSON.stringify(out, null, 2))
console.log('total_inversores_invalidos', out.total_inversores_invalidos)
console.log('modelos_unicos', out.modelos_unicos)
console.log('classes (por modelo)', JSON.stringify(classeResumo), '(por ocorrencia)', JSON.stringify(classeOcorr))
console.log('TOP fabricantes:', JSON.stringify(fabRank.slice(0,8)))
console.log('TOP ROI (projetos):', JSON.stringify(porROI.slice(0,12).map(m=>({f:m.fabricante,mo:m.modelo,oc:m.ocorrencias,proj:m.projetos_beneficiados,cl:m.classe}))))
await mongoose.connection.close(); process.exit(0)
