// P1-SOLARMARKET-DATA-CLEANING-APPLY-01 — aplica R1/R2/R3 (auto+regra). NÃO multiarranjo, NÃO manual.
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { ProjetoFV } from '../../src/models/ProjetoFV.js'
import fs from 'fs'; import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const mx = require('./SOLARMARKET_CORRUPTION_MATRIX.json')

const APPLY = process.argv.includes('--apply')

const FAB_PREFIX = [
  ['TRINA SOLAR','Trina Solar'],['TRINA','Trina Solar'],['CANADIAN','Canadian Solar'],['JINKO','Jinko'],
  ['JAM','Ja Solar'],['HELIUS','Helius'],['ZXMR','Znshine'],['ZXM7','Znshine'],['ZXM','Znshine'],['ZNSHINE','Znshine'],
  ['LEAPTON','Leapton'],['LF','Leapton'],['DAH','Dah'],['DHN','Dah'],['DEYE','Deye'],['SUN-M','Deye'],['SUN-','Deye'],
  ['SOLIS','Solis'],['SI0','Solis'],['HCP','Honor'],['HONOR','Honor'],['TAOISTIC','Taoistic Solar'],
  ['ENERGYSUN','EnergySun'],['MFVH','Belenergy'],['MFVL','Belenergy'],['RISEN','Risen'],['NVFX','Nvolt'],['TONGWEI','Tongwei'],
]
const FABS_CONHECIDOS = [...new Set(FAB_PREFIX.map(x=>x[1].toUpperCase()))]
// remove aspas embutidas (padrão de corrupção) + trim
const limpaQuotes = (s) => String(s||'').replace(/^[\s"'`]+|[\s"'`]+$/g,'').trim()
const norm = (s) => limpaQuotes(s).toUpperCase()
const inferFab = (s) => { const u=String(s||'').toUpperCase().trim(); for(const[p,f]of FAB_PREFIX) if(u.startsWith(p)) return f; return null }
const ehWattage = (s) => /^\d{3,4}\s*w?$/i.test(String(s||'').trim())
// R3: procura fabricante na linha KIT/categoria do proposta_sm
function fabFromKit(smEquips, tipo){
  if(!Array.isArray(smEquips)) return null
  const cat = tipo==='inversor'?'inversor':'módulo'
  const candidatos=[]
  for(const e of smEquips){
    const item=String(e?.item||e?.descricao||'').toUpperCase()
    const ecat=String(e?.categoria||'').toLowerCase()
    if(ecat.includes('kit')||ecat.includes(cat)||ecat.includes('modul')){
      for(const f of FABS_CONHECIDOS) if(item.includes(f)) candidatos.push(f)
    }
  }
  const uniq=[...new Set(candidatos)]
  return uniq.length===1? uniq[0] : null  // ambíguo se >1
}
function prefixoDe(fab){ for(const[p,f]of FAB_PREFIX) if(f===fab) return p; return fab.toUpperCase() }

// valor degenerado (não é modelo real): vazio, "-", só letras (nome de fab), ou fab+wattage tipo "Trina550"
const ehDegenerado = (v) => { const s=String(v||'').replace(/\s/g,''); return !s || s.length<4 || s==='-' || /^[A-Za-z]+$/.test(s) || /^[A-Za-z]+\d{2,4}$/.test(s) }
const removerFab = (m, fab) => m.replace(new RegExp('^('+fab.toUpperCase().split(/\s+/).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+')+')\\s*','i'),'').trim()
function corrigir(marca, modelo, tipo, smEquips){
  const m=limpaQuotes(marca), mo=limpaQuotes(modelo)
  // R2: modelo = wattage, marca = "FAB MODELO"
  if(ehWattage(mo) && m && m!==mo){
    const fab=inferFab(m) || (fabFromKit(smEquips,tipo)? cap(fabFromKit(smEquips,tipo)):null)
    if(!fab) return {skip:'manual'}
    const modeloLimpo=removerFab(m,fab) || m
    if(ehDegenerado(modeloLimpo)) return {skip:'manual'}
    return {marca:fab, modelo:modeloLimpo, potencia:parseInt(mo), regra: inferFab(m)?'R2':'R2+R3', ambiguo:false}
  }
  // R1: marca == modelo (duplicação)
  if(m===mo && m){
    if(ehDegenerado(m)) return {skip:'manual'} // só fab name / "-" / fab+wattage -> manual
    let fab=inferFab(m); let regra='R1'
    if(!fab){ const k=fabFromKit(smEquips,tipo); if(k){fab=cap(k);regra='R1+R3'} }
    if(!fab) return {skip:'manual'}
    return {marca:fab, modelo:m, regra, ambiguo:false}
  }
  // wattage como marca / vazio -> manual
  return {skip:'manual'}
}
function cap(F){ const map=Object.fromEntries(FAB_PREFIX.map(x=>[x[1].toUpperCase(),x[1]])); return map[F]||F }

await conectarBD(); if(mongoose.connection.readyState!==1){console.error('DB_OFFLINE');process.exit(1)}

const diff=[]; let alterados=0, itensCorrigidos=0, manuais=0, ambiguos=0
for(const proj of mx.matriz_projetos){
  const p=await ProjetoFV.findById(proj._id)
  if(!p) continue
  const smEquips=p.proposta_sm?.equipamentos||[]
  const mudancasProj=[]
  // chave normalizada dos itens causa-D (ignora tipo, que falta na matriz)
  const chavesD=new Set(proj.itens_causa_D.map(d=>`${norm(d.marca)}|${norm(d.modelo)}`))
  // paineis
  const paineis=p.equipamentos?.paineis||[]
  for(let i=0;i<paineis.length;i++){
    const pan=paineis[i]
    if(pan.equipamento_id && pan.origem_bind==='atlas') continue
    // só itens causa-D deste projeto
    if(!chavesD.has(`${norm(pan.marca)}|${norm(pan.modelo)}`)) continue
    const c=corrigir(pan.marca,pan.modelo,'modulo',smEquips)
    if(c.skip){ manuais++; continue }
    mudancasProj.push({campo:`paineis[${i}]`,tipo:'modulo',antes:{marca:pan.marca,modelo:pan.modelo},depois:{marca:c.marca,modelo:c.modelo},regra:c.regra})
    if(APPLY){ paineis[i].marca=c.marca; paineis[i].modelo=c.modelo; if(c.potencia&&!paineis[i].potencia_w)paineis[i].potencia_w=c.potencia }
    itensCorrigidos++
  }
  // inversor
  const inv=p.equipamentos?.inversor
  if(inv && !(inv.equipamento_id&&inv.origem_bind==='atlas')){
    const ehD=chavesD.has(`${norm(inv.marca)}|${norm(inv.modelo)}`)
    if(ehD){
      const c=corrigir(inv.marca,inv.modelo,'inversor',smEquips)
      if(c.skip) manuais++
      else{
        mudancasProj.push({campo:'inversor',tipo:'inversor',antes:{marca:inv.marca,modelo:inv.modelo},depois:{marca:c.marca,modelo:c.modelo},regra:c.regra})
        if(APPLY){ inv.marca=c.marca; inv.modelo=c.modelo }
        itensCorrigidos++
      }
    }
  }
  if(mudancasProj.length){
    alterados++
    diff.push({_id:proj._id,projeto:proj.projeto,mudancas:mudancasProj})
    if(APPLY){ p.markModified('equipamentos'); await p.save() }
  }
}

const out={sprint:'P1-SOLARMARKET-DATA-CLEANING-APPLY-01',aplicado:APPLY,gerado_em:new Date().toISOString(),
  projetos_alterados:alterados,itens_corrigidos:itensCorrigidos,itens_manuais_pulados:manuais,diff}
const dir=fileURLToPath(new URL('./',import.meta.url))
fs.writeFileSync(dir+(APPLY?'CLEANING_APPLY.json':'CLEANING_DRY.json'),JSON.stringify(out,null,2))
console.log('MODO',APPLY?'APPLY':'DRY','| projetos alterados',alterados,'| itens corrigidos',itensCorrigidos,'| manuais pulados',manuais)
for(const d of diff.slice(0,40)) for(const m of d.mudancas) console.log(`  ${d.projeto} | ${m.regra} | ${m.antes.marca}/${m.antes.modelo} -> ${m.depois.marca}/${m.depois.modelo}`)
await mongoose.connection.close();process.exit(0)
