// READ-ONLY — P0-INVERTER-IDENTITY-FORENSICS-01.
// Valida identidade real dos inversores SUN2000. NAO altera nada.
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { Equipamento } from '../../src/models/Equipamento.js'
import { ProjetoFV } from '../../src/models/ProjetoFV.js'
import fs from 'fs'
import { fileURLToPath } from 'url'

await conectarBD()
if (mongoose.connection.readyState !== 1) { console.error('DB_OFFLINE'); process.exit(1) }

const reSUN = /sun2000/i
const reHuawei = /huawei/i

// ---- FASE 1: Equipamento com SUN2000 ----
const eqs = await Equipamento.find(
  { $or: [ { modelo: reSUN }, { fabricante: reSUN }, { 'identificacao.aliases': reSUN } ] }
).lean()

const eqResumo = eqs.map(e => ({
  _id: String(e._id), fabricante: e.fabricante, modelo: e.modelo,
  fabricante_normalizado: e.identificacao?.fabricante_normalizado ?? null,
  origem_tipo: e.origem?.tipo ?? null, origem_fonte: e.origem?.fonte ?? null,
  nivel: e.qualidade?.nivel ?? null,
  aliases: e.identificacao?.aliases ?? [],
}))

// fabricantes distintos armazenados para SUN2000
const fabsArmazenados = {}
for (const e of eqResumo) fabsArmazenados[e.fabricante || '(vazio)'] = (fabsArmazenados[e.fabricante||'(vazio)']||0)+1

// ---- Huawei em QUALQUER lugar do catalogo ----
const eqHuawei = await Equipamento.countDocuments({ $or:[{fabricante:reHuawei},{modelo:reHuawei},{'identificacao.aliases':reHuawei},{'identificacao.fabricante_normalizado':reHuawei}] })

// ---- FASE 2/3: ProjetoFV — referencias a SUN2000 e dados crus SM ----
const projetos = await ProjetoFV.find({}).lean()
let projComSUN = 0
const fabPorContexto = {
  inversor_bind: {},      // equipamentos.inversor / arranjos.inversores (fabricante armazenado no projeto)
  proposta_sm_equip: {},  // proposta_sm.equipamentos[].item (string crua do SolarMarket)
  observacoes: {},
}
const add = (m,k)=>{ if(!k)return; k=String(k).trim(); if(!k)return; m[k]=(m[k]||0)+1 }
const projetosAfetadosIds = new Set()
let huaweiEmProjetoSM = 0, huaweiEmObs = 0, huaweiEmBind = 0
const amostraSM = []

for (const p of projetos) {
  let tocouSUN = false
  // binds de inversor no projeto
  const invRefs = []
  if (p.equipamentos?.inversor) invRefs.push(p.equipamentos.inversor)
  for (const a of (p.arranjos||[])) for (const inv of (a.inversores||[])) invRefs.push(inv)
  for (const r of invRefs) {
    const blob = `${r?.fabricante||''} ${r?.marca||''} ${r?.modelo||''}`
    if (reSUN.test(blob)) { tocouSUN=true; add(fabPorContexto.inversor_bind, r?.fabricante||r?.marca||'(vazio)') }
    if (reHuawei.test(blob)) huaweiEmBind++
  }
  // proposta_sm crua
  const sm = p.proposta_sm
  if (sm) {
    const smStr = JSON.stringify(sm)
    if (reSUN.test(smStr)) {
      tocouSUN = true
      // tenta achar o item de inversor e fabricante cru
      const equips = Array.isArray(sm.equipamentos) ? sm.equipamentos : []
      for (const it of equips) {
        const item = `${it?.item||it?.descricao||it?.nome||''}`
        if (reSUN.test(item)) {
          add(fabPorContexto.proposta_sm_equip, item.trim())
          if (amostraSM.length < 15) amostraSM.push({ projeto:String(p._id), categoria: it?.categoria||null, item: item.trim(), qnt: it?.qnt??it?.quantidade??null })
        }
      }
      // fabricante explicito no sm, se houver
      for (const f of ['fabricante','marca','inversor_fabricante']) if (sm[f] && reSUN.test(JSON.stringify(sm))) {}
    }
    if (reHuawei.test(smStr)) huaweiEmProjetoSM++
  }
  // observacoes
  const obs = `${p.observacoes||''} ${p.observacao||''}`
  if (reSUN.test(obs)) { tocouSUN=true; add(fabPorContexto.observacoes, 'SUN2000_mencionado') }
  if (reHuawei.test(obs)) huaweiEmObs++

  if (tocouSUN) { projComSUN++; projetosAfetadosIds.add(String(p._id)) }
}

// ---- FASE 4: tabela por modelo (catalogo SUN2000) com projetos afetados ----
const norm = s => String(s||'').trim().toLowerCase().replace(/\s+/g,' ')
// projetos por equipamento_id e por fab|modelo (reuso simples)
const projsPorId=new Map(), projsPorFabMod=new Map()
const addset=(m,k,id)=>{ if(!k)return; const s=m.get(String(k))||new Set(); s.add(id); m.set(String(k),s) }
for (const p of projetos) {
  const refs=[]; if(p.equipamentos?.inversor) refs.push(p.equipamentos.inversor)
  for (const a of (p.arranjos||[])) for (const inv of (a.inversores||[])) refs.push(inv)
  for (const r of refs){ if(r?.equipamento_id) addset(projsPorId,r.equipamento_id,String(p._id)); const fb=r?.fabricante||r?.marca; if(fb&&r?.modelo) addset(projsPorFabMod,`${norm(fb)}|${norm(r.modelo)}`,String(p._id)) }
}
const tabela = eqResumo.map(e=>{
  const set=new Set()
  for(const id of (projsPorId.get(e._id)||[])) set.add(id)
  for(const id of (projsPorFabMod.get(`${norm(e.fabricante)}|${norm(e.modelo)}`)||[])) set.add(id)
  return { modelo:e.modelo, fabricante_armazenado:e.fabricante, fabricante_normalizado:e.fabricante_normalizado, origem_tipo:e.origem_tipo, projetos_afetados:set.size }
}).sort((a,b)=>b.projetos_afetados-a.projetos_afetados)

const out = {
  sprint:'P0-INVERTER-IDENTITY-FORENSICS-01', read_only:true, gerado_em:new Date().toISOString(),
  fase1_equipamentos_sun2000: { total: eqs.length, fabricantes_armazenados: fabsArmazenados, registros: eqResumo },
  huawei_presenca: {
    catalogo_equipamento: eqHuawei,
    projeto_bind: huaweiEmBind,
    proposta_sm: huaweiEmProjetoSM,
    observacoes: huaweiEmObs,
    total_qualquer_lugar: eqHuawei + huaweiEmBind + huaweiEmProjetoSM + huaweiEmObs,
  },
  fase2_fabricante_por_contexto: fabPorContexto,
  fase2_amostra_proposta_sm: amostraSM,
  fase4_tabela: tabela,
  projetos_com_sun2000: projComSUN,
}
const path = fileURLToPath(new URL('./IDENTITY_FORENSICS.json', import.meta.url))
fs.writeFileSync(path, JSON.stringify(out,null,2))
console.log('EQ SUN2000:', eqs.length, '| fabricantes armazenados:', JSON.stringify(fabsArmazenados))
console.log('HUAWEI em qualquer lugar:', out.huawei_presenca.total_qualquer_lugar, JSON.stringify(out.huawei_presenca))
console.log('proposta_sm fabricante/item (cru):', JSON.stringify(fabPorContexto.proposta_sm_equip))
console.log('bind inversor fabricante:', JSON.stringify(fabPorContexto.inversor_bind))
console.log('projetos c/ SUN2000:', projComSUN)
console.log('TOP tabela:', JSON.stringify(tabela.slice(0,8)))
console.log('amostra SM:', JSON.stringify(amostraSM.slice(0,6)))
await mongoose.connection.close(); process.exit(0)
