// P1-INVERTER-DATASHEET-ENRICH-WAVE1B-01 — APPLY (modelos verificados por datasheet oficial).
// Motor oficial processarEquipamento; SOMENTE campos vazios; origem=datasheet_pdfparse; idempotente.
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { Equipamento } from '../../src/models/Equipamento.js'
import { processarEquipamento } from '../../src/services/catalogoQualidade.js'
import fs from 'fs'; import { fileURLToPath } from 'url'

const APPLY = process.argv.includes('--apply')

// Verificados por PDF/página oficial do fabricante (sem dados de terceiros)
const LOTE = [
  { id:'6a272aff0bb8928e11abce0d', fab:'Deye', modelo:'SUN2000G-US-220', proj:36,
    url:'https://www.deyeinverter.com (datasheet SUN(1300-2000)G3-US-220; mesmo micro 2000W US-220)',
    specs:{potencia_kw:2.0,tensao_max_entrada:60,tensao_mppt_min:25,tensao_mppt_max:55,corrente_max_por_mppt:13,n_mppts:4,strings_por_mppt:1,eficiencia_maxima:96.5,fases:1,garantia_anos:10} },
  { id:'6a272b010bb8928e11abce33', fab:'Deye', modelo:'SUN-M225G4-EU-Q0', proj:30,
    url:'https://www.deyeinverter.com/deyeinverter/2024/10/21/datasheet_sun-m220-225g4-eu-q0_241021_en.pdf',
    specs:{potencia_kw:2.25,tensao_max_entrada:60,tensao_mppt_min:25,tensao_mppt_max:55,corrente_max_por_mppt:18,n_mppts:4,strings_por_mppt:1,eficiencia_maxima:96.5,fases:1,garantia_anos:10} },
  { id:'6a272b070bb8928e11abce9a', fab:'Kehua', modelo:'TECH SPI6000-B2', proj:12,
    url:'https://digitalenergy.kehua.com/string-Inverter/spi3000-6000-b2-series (página oficial Kehua)',
    specs:{potencia_kw:6.0,tensao_max_entrada:550,tensao_mppt_min:100,tensao_mppt_max:550,corrente_max_por_mppt:13,n_mppts:2,strings_por_mppt:1,eficiencia_maxima:98.3,fases:1} },
]
// Diferidos: solaredge.com bloqueia download automático (403); não enriquecer por resumo de terceiros.
const DIFERIDOS = [
  { id:'6a272aff0bb8928e11abce1a', modelo:'SolarEdge SE 27.6K 380/220v', proj:11, motivo:'solaredge.com 403; arquitetura otimizador (sem faixa MPPT tradicional)' },
  { id:'6a272aff0bb8928e11abce19', modelo:'SolarEdge SE 20.1K 380/220v', proj:9,  motivo:'solaredge.com 403; modelo SE20.1K a confirmar' },
]

await conectarBD(); if(mongoose.connection.readyState!==1){console.error('DB_OFFLINE');process.exit(1)}
const niveis=async()=>Object.fromEntries((await Equipamento.aggregate([{$group:{_id:'$qualidade.nivel',t:{$sum:1}}}])).map(x=>[x._id,x.t]))
const scoreM=async()=>{const r=await Equipamento.aggregate([{$group:{_id:null,s:{$avg:'$qualidade.score_global'}}}]);return Number((r[0]?.s||0).toFixed(2))}

const antes={niveis:await niveis(),score:await scoreM()}
const detalhe=[]
for(const item of LOTE){
  const eq=await Equipamento.findById(item.id); if(!eq){detalhe.push({id:item.id,erro:'nao encontrado'});continue}
  const nivelAntes=eq.qualidade?.nivel, scoreAntes=eq.qualidade?.score_global
  eq.especificacoes=eq.especificacoes||{}; eq.fonte_dados=eq.fonte_dados||{}
  const preench=[],pulados=[]
  for(const[k,v]of Object.entries(item.specs)){
    const atual=eq.especificacoes[k]
    if(atual===undefined||atual===null||atual===''){ eq.especificacoes[k]=v; eq.fonte_dados[k]={fonte:'datasheet_oficial',url:item.url,modelo_datasheet:item.modelo,em:new Date()}; preench.push(k) }
    else pulados.push(k)
  }
  if(APPLY&&preench.length){
    eq.origem={...(eq.origem||{}),tipo:'datasheet_pdfparse',fonte:'datasheet_oficial (Wave1b)',em:new Date()}
    eq.markModified('origem'); eq.markModified('especificacoes'); eq.markModified('fonte_dados')
    const r=processarEquipamento(eq.toObject(),{tipoEvento:'enriquecimento_datasheet_wave1b'})
    eq.specs_canonicas=r.specs_canonicas; eq.identificacao=r.identificacao; eq.qualidade=r.qualidade; eq.status_operacional=r.status_operacional
    await eq.save()
    detalhe.push({modelo:item.modelo,proj:item.proj,preench,pulados,nivel_antes:nivelAntes,nivel_depois:r.qualidade?.nivel,score_antes:scoreAntes,score_depois:r.qualidade?.score_global,alertas_depois:(r.qualidade?.alertas||[]).map(a=>a.codigo)})
  } else {
    const r=processarEquipamento(eq.toObject(),{tipoEvento:'dry'})
    detalhe.push({modelo:item.modelo,proj:item.proj,preench,pulados,nivel_antes:nivelAntes,nivel_previsto:r.qualidade?.nivel,score_previsto:r.qualidade?.score_global,alertas_previstos:(r.qualidade?.alertas||[]).map(a=>a.codigo),dry:true})
  }
}
const depois=APPLY?{niveis:await niveis(),score:await scoreM()}:null
const out={sprint:'P1-INVERTER-DATASHEET-ENRICH-WAVE1B-01',aplicado:APPLY,gerado_em:new Date().toISOString(),antes,depois,detalhe,diferidos:DIFERIDOS}
const dir=fileURLToPath(new URL('./',import.meta.url))
fs.writeFileSync(dir+(APPLY?'APPLY_RESULT.json':'DRY_PREVIEW.json'),JSON.stringify(out,null,2))
console.log('MODO',APPLY?'APPLY':'DRY','| antes',JSON.stringify(antes.niveis),'score',antes.score)
if(depois)console.log('depois',JSON.stringify(depois.niveis),'score',depois.score)
for(const d of detalhe)console.log(' ',d.modelo,'| campos',(d.preench||[]).length,'| nivel',d.nivel_antes,'->',d.nivel_depois||d.nivel_previsto,'| score',(d.score_depois??d.score_previsto),'| alertas',JSON.stringify(d.alertas_depois||d.alertas_previstos))
console.log('DIFERIDOS:',DIFERIDOS.map(x=>x.modelo).join(', '))
await mongoose.connection.close(); process.exit(0)
