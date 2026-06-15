// READ-ONLY — P1-SOLARMARKET-DATA-CLEANING-01. Classifica os 33 projetos causa-D. NAO altera nada.
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { Equipamento } from '../../src/models/Equipamento.js'
import { ProjetoFV } from '../../src/models/ProjetoFV.js'
import fs from 'fs'; import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const inv = require('../../docs/CATALOG_REMAINING_GAPS_INVENTORY.json')

await conectarBD(); if(mongoose.connection.readyState!==1){console.error('DB_OFFLINE');process.exit(1)}

// fabricantes conhecidos (prefixos) p/ inferencia
const FAB_PREFIX = [
  ['TRINA','Trina Solar'],['CANADIAN','Canadian Solar'],['JINKO','Jinko'],['JA ','Ja Solar'],['JAM','Ja Solar'],
  ['HELIUS','Helius'],['ZXM','Znshine'],['ZXMR','Znshine'],['ZNSHINE','Znshine'],['LEAPTON','Leapton'],['LF','Leapton'],
  ['DAH','Dah'],['DHN','Dah'],['DEYE','Deye'],['SUN-M','Deye'],['SUN-','Deye'],['SOLIS','Solis'],['SI0','Solis'],
  ['CHP','Chint'],['HCP','Honor'],['TAOISTIC','Taoistic Solar'],['ENERGYSUN','EnergySun'],['MFVH','Belenergy'],
  ['RISEN','Risen'],['NVFX','Nvolt'],['TONGWEI','Tongwei'],
]
const inferFab = (s) => { const u=String(s||'').toUpperCase(); for(const[p,f]of FAB_PREFIX) if(u.startsWith(p)||u.includes(' '+p)) return f; return null }
const ehWattage = (s) => /^\d{3,4}\s*w?$/i.test(String(s||'').trim())
const modeloExisteAtlas = async (fab, modelo) => {
  if(!fab||!modelo) return false
  const e = await Equipamento.findOne({ fabricante:new RegExp('^'+fab.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'), modelo:new RegExp(modelo.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i') }).lean()
  return !!e
}

// sub-classificacao A-F + recuperabilidade
function classificar(marca, modelo){
  const m=(marca||'').trim(), mo=(modelo||'').trim()
  if((!m||m==='-')&&(!mo||mo==='-')) return {cat:'E',rec:'manual',motivo:'vazio'}
  if(m===mo){ // marca==modelo
    if(/^[A-Z]+$/i.test(m) && m.length<=10 && !/\d/.test(m)) return {cat:'B',rec:'manual',motivo:'só nome de fabricante, sem modelo'}
    const fab=inferFab(m)
    return {cat:'A',rec: fab?'regra_simples':'manual',motivo:`fabricante ausente; modelo no campo marca${fab?` (infere "${fab}")`:''}`}
  }
  if(ehWattage(mo)){ // modelo = wattage -> marca tem fab+model concatenado
    const fab=inferFab(m)
    return {cat:'C',rec: fab?'regra_simples':'manual',motivo:`fab+modelo concatenados na marca; potência="${mo}"${fab?` (infere "${fab}")`:''}`}
  }
  if(ehWattage(m)) return {cat:'E',rec:'manual',motivo:`wattage usado como marca; modelo genérico "${mo}"`}
  return {cat:'F',rec:'revisao',motivo:'outro padrão'}
}

// 33 projetos causa-D
const dProj = inv.projetos_incompletos.filter(p=>p.itens_sem_bind.some(it=>it.causa==='D'))
const matriz=[]
const recCount={auto:0,regra_simples:0,manual:0,revisao:0}
const catCount={A:0,B:0,C:0,D:0,E:0,F:0}
for(const p of dProj){
  const dItems=p.itens_sem_bind.filter(it=>it.causa==='D')
  const linhasItens=[]
  for(const it of dItems){
    const c=classificar(it.marca,it.modelo)
    // auto = regra_simples cujo modelo real já existe no Atlas
    let rec=c.rec
    if(c.rec==='regra_simples'){
      const fab=inferFab(it.marca)
      const modeloReal = c.cat==='A'? it.marca : it.marca.replace(new RegExp('^'+(fab||'').toUpperCase().split(' ')[0],'i'),'').trim()
      if(await modeloExisteAtlas(fab, c.cat==='A'?it.marca:modeloReal)) rec='auto'
    }
    catCount[c.cat]++; recCount[rec]=(recCount[rec]||0)+1
    linhasItens.push({tipo:it.tipo,marca:it.marca,modelo:it.modelo,sub_causa:c.cat,recuperabilidade:rec,motivo:c.motivo})
  }
  matriz.push({_id:p._id,projeto:p.projeto,cliente:p.cliente,itens_causa_D:linhasItens})
}

// FASE 4 — casos obrigatorios
const nomes=['Paulo Carlos','Fazenda Alice','Escola Pinheiro']
const casos=[]
for(const nome of nomes){
  const rx=new RegExp(nome.split(' ').join('.*'),'i')
  const ps=await ProjetoFV.find({$or:[{nome:rx},{'cliente.nome':rx},{cliente_nome:rx}]},'nome cliente cliente_nome equipamentos arranjos proposta_sm status_migracao').lean()
  for(const p of ps){
    const inversorTxt=`${p.equipamentos?.inversor?.marca||''} ${p.equipamentos?.inversor?.modelo||''}`.trim()
    const paineisTxt=(p.equipamentos?.paineis||[]).map(x=>`${x.marca||''} ${x.modelo||''}`.trim())
    // sinais de multiarranjo-como-texto: "+", "e ", "/", multiplos wattages, multiplos fabricantes
    const blob=[inversorTxt,...paineisTxt].join(' | ')
    const sinalMulti=/\+|\be\b|,|\/| com | mais /i.test(blob) || (blob.match(/\d{3,4}\s*w/gi)||[]).length>1
    const smEquips=Array.isArray(p.proposta_sm?.equipamentos)?p.proposta_sm.equipamentos.map(e=>({cat:e.categoria,item:e.item||e.descricao,qnt:e.qnt})):[]
    casos.push({nome_buscado:nome,projeto:p.nome,cliente:p.cliente?.nome||p.cliente_nome||'—',
      tem_arranjos:Array.isArray(p.arranjos)&&p.arranjos.length>0,n_arranjos:(p.arranjos||[]).length,
      inversor:inversorTxt,paineis:paineisTxt,sinal_multiarranjo_texto:sinalMulti,proposta_sm_equipamentos:smEquips})
  }
}

const out={sprint:'P1-SOLARMARKET-DATA-CLEANING-01',read_only:true,gerado_em:new Date().toISOString(),
  total_projetos_causa_D:dProj.length,
  sub_classificacao:catCount,
  recuperabilidade:recCount,
  matriz_projetos:matriz,
  casos_obrigatorios:casos}
const dir=fileURLToPath(new URL('./',import.meta.url))
fs.writeFileSync(dir+'SOLARMARKET_CORRUPTION_MATRIX.json',JSON.stringify(out,null,2))
console.log('projetos causa-D:',dProj.length)
console.log('sub-classificacao:',JSON.stringify(catCount))
console.log('recuperabilidade:',JSON.stringify(recCount))
console.log('=== casos obrigatorios ===')
casos.forEach(c=>console.log(`  ${c.nome_buscado}: projeto="${c.projeto}" cliente="${c.cliente}" arranjos=${c.n_arranjos} multi_texto=${c.sinal_multiarranjo_texto} inv="${c.inversor}" paineis=${JSON.stringify(c.paineis)} sm=${JSON.stringify(c.proposta_sm_equipamentos)}`))
await mongoose.connection.close();process.exit(0)
