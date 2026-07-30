// READ-ONLY — P1-INVERTER-DATASHEET-SOURCING-01. Inventario + ROI (uniao deduplicada) + classificacao.
// NAO altera nada. Apenas inventaria e prioriza.
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { Equipamento } from '../../src/models/Equipamento.js'
import { ProjetoFV } from '../../src/models/ProjetoFV.js'
import fs from 'fs'
import { fileURLToPath } from 'url'

await conectarBD()
if (mongoose.connection.readyState !== 1) { console.error('DB_OFFLINE'); process.exit(1) }

const norm = s => String(s||'').trim().toLowerCase().replace(/\s+/g,' ')

const inv = await Equipamento.find(
  { tipo:'inversor', 'qualidade.nivel':'invalido' },
  'fabricante modelo origem qualidade.alertas.codigo'
).lean()

// indices projeto -> referencias
const projetos = await ProjetoFV.find({}, 'equipamentos.inversor arranjos.inversores').lean()
const projsPorId=new Map(), projsPorFabMod=new Map()
const addset=(m,k,id)=>{ if(!k)return; const s=m.get(String(k))||new Set(); s.add(id); m.set(String(k),s) }
for (const p of projetos){
  const refs=[]; if(p.equipamentos?.inversor) refs.push(p.equipamentos.inversor)
  for(const a of (p.arranjos||[])) for(const i of (a.inversores||[])) refs.push(i)
  for(const r of refs){ if(r?.equipamento_id) addset(projsPorId,r.equipamento_id,String(p._id)); const fb=r?.fabricante||r?.marca; if(fb&&r?.modelo) addset(projsPorFabMod,`${norm(fb)}|${norm(r.modelo)}`,String(p._id)) }
}
const projetosDe = (eq) => {
  const s=new Set()
  for(const id of (projsPorId.get(String(eq._id))||[])) s.add(id)
  for(const id of (projsPorFabMod.get(`${norm(eq.fabricante)}|${norm(eq.modelo)}`)||[])) s.add(id)
  return s
}

function classificar(fab, modelo){
  const m=String(modelo||'').trim(), f=String(fab||'').trim()
  const lixo = !m || /^(modulo|inversor|n\/?a|desconhecid|sem nome|--)$/i.test(m)
  const fabOk = f.length>=2 && !/desconhec/i.test(f)
  const temCodigo = /[A-Za-z]*\d+[A-Za-z0-9\-\.\/]*/.test(m) && m.replace(/[^A-Za-z0-9]/g,'').length>=4
  const sujo = /@|\s{2,}|\t/.test(m) || m.split(' ').length>5   // ruido tipo "SUN-5K-G @220"
  if (lixo || !fabOk) return 'C'
  if (temCodigo && fabOk && !sujo) return 'A'
  return 'B'
}

// agrupa por fab|modelo
const grupo=new Map()
for(const e of inv){
  const k=`${norm(e.fabricante)}|${norm(e.modelo)}`
  const g=grupo.get(k)||{fabricante:e.fabricante,modelo:e.modelo,ocorrencias:0,ids:[],projetos:new Set()}
  g.ocorrencias++; g.ids.push(String(e._id))
  for(const pid of projetosDe(e)) g.projetos.add(pid)
  grupo.set(k,g)
}
const modelos=[...grupo.values()].map(g=>({
  fabricante:g.fabricante, modelo:g.modelo, ocorrencias:g.ocorrencias,
  projetos_impactados:g.projetos.size, projetos_set:[...g.projetos],
  classe:classificar(g.fabricante,g.modelo), equipamento_ids:g.ids,
}))

const porFreq=[...modelos].sort((a,b)=> b.ocorrencias-a.ocorrencias || b.projetos_impactados-a.projetos_impactados || a.modelo.localeCompare(b.modelo))
const porROI=[...modelos].sort((a,b)=> b.projetos_impactados-a.projetos_impactados || b.ocorrencias-a.ocorrencias || a.modelo.localeCompare(b.modelo))

// uniao deduplicada dos top-N por ROI
const uniaoTopN=(n)=>{ const s=new Set(); for(const m of porROI.slice(0,n)) for(const p of m.projetos_set) s.add(p); return s.size }
const uniaoTodos=(()=>{ const s=new Set(); for(const m of modelos) for(const p of m.projetos_set) s.add(p); return s.size })()

const comProjetos = modelos.filter(m=>m.projetos_impactados>0).length
const semProjetos = modelos.length - comProjetos
const classe={A:0,B:0,C:0}; for(const m of modelos) classe[m.classe]++

// priority list (sem o set bruto)
const priority = porROI.map((m,i)=>({
  prioridade:i+1, fabricante:m.fabricante, modelo:m.modelo, classe:m.classe,
  ocorrencias:m.ocorrencias, projetos_impactados:m.projetos_impactados,
  equipamento_ids:m.equipamento_ids,
  precisa_datasheet:true,
  datasheet_status:'PENDENTE',
}))

const out={
  sprint:'P1-INVERTER-DATASHEET-SOURCING-01', read_only:true, gerado_em:new Date().toISOString(),
  total_inversores_invalidos:inv.length,
  modelos_unicos:modelos.length,
  modelos_com_projetos:comProjetos, modelos_sem_projetos:semProjetos,
  classificacao:classe,
  projetos_distintos_bloqueados_total:uniaoTodos,
  uniao_roi:{ top1:uniaoTopN(1), top3:uniaoTopN(3), top5:uniaoTopN(5), top10:uniaoTopN(10), top20:uniaoTopN(20) },
  ranking_por_frequencia:porFreq.map(m=>({fabricante:m.fabricante,modelo:m.modelo,ocorrencias:m.ocorrencias,projetos:m.projetos_impactados,classe:m.classe})),
  ranking_por_roi:priority,
}
const dir=fileURLToPath(new URL('./', import.meta.url))
fs.writeFileSync(dir+'INVENTARIO_SOURCING.json', JSON.stringify(out,null,2))
fs.writeFileSync(dir+'INVERTER_DATASHEET_PRIORITY_LIST.json', JSON.stringify({
  sprint:out.sprint, gerado_em:out.gerado_em, campos_alvo:['potencia_kw','tensao_max_entrada','tensao_mppt_min','tensao_mppt_max','corrente_max_por_mppt','n_mppts','strings_por_mppt','eficiencia_maxima','fases','garantia_anos'],
  total_pdfs_necessarios:modelos.length, total_pdfs_com_roi:comProjetos,
  itens:priority,
}, null, 2))

console.log('total inversores invalidos:', inv.length)
console.log('modelos unicos:', modelos.length, '| com projetos:', comProjetos, '| sem projetos:', semProjetos)
console.log('classes:', JSON.stringify(classe))
console.log('projetos distintos bloqueados (uniao TODOS):', uniaoTodos)
console.log('uniao ROI top1/3/5/10/20:', JSON.stringify(out.uniao_roi))
console.log('TOP10 ROI:', JSON.stringify(porROI.slice(0,10).map(m=>({f:m.fabricante,mo:m.modelo,proj:m.projetos_impactados,cl:m.classe}))))
await mongoose.connection.close(); process.exit(0)
