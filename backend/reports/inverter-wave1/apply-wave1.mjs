// P1-INVERTER-DATASHEET-ENRICH-WAVE1-01 — APPLY (5 modelos verificados por datasheet oficial).
// Usa o MOTOR OFICIAL processarEquipamento (mesmo dos endpoints). Preenche SOMENTE campos vazios.
// Idempotente. Registra fonte (datasheet_oficial + URL) em fonte_dados.
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { Equipamento } from '../../src/models/Equipamento.js'
import { processarEquipamento } from '../../src/services/catalogoQualidade.js'
import fs from 'fs'
import { fileURLToPath } from 'url'

const APPLY = process.argv.includes('--apply')

const LOTE = [
  { id:'6a272aff0bb8928e11abce10', fab:'Deye', modelo:'SUN2000G3-US-220', url:'https://www.deyeinverter.com (Microinverter SUN(1300-2000)G3-US-220/EU-230)',
    specs:{potencia_kw:2.0,tensao_max_entrada:60,tensao_mppt_min:25,tensao_mppt_max:55,corrente_max_por_mppt:13,n_mppts:4,strings_por_mppt:1,eficiencia_maxima:96.5,fases:1,garantia_anos:10} },
  { id:'6a272b000bb8928e11abce25', fab:'Tsun', modelo:'TSOL-MX2250', url:'https://www.eet.energy/app/uploads/2025/07/Greensolar-tsun-2000-watt-wechselrichter-datenblatt-1.pdf (TSUNESS GEN3)',
    specs:{potencia_kw:2.25,tensao_max_entrada:60,tensao_mppt_min:16,tensao_mppt_max:60,corrente_max_por_mppt:18,n_mppts:4,strings_por_mppt:1,eficiencia_maxima:97.0,fases:1,garantia_anos:12} },
  { id:'6a272b010bb8928e11abce3b', fab:'Tsun', modelo:'TSOL-MP2250', url:'https://www.eet.energy/app/uploads/2025/07/Greensolar-tsun-2000-watt-wechselrichter-datenblatt-1.pdf (TSUNESS GEN3, familia 2250W)',
    specs:{potencia_kw:2.25,tensao_max_entrada:60,tensao_mppt_min:16,tensao_mppt_max:60,corrente_max_por_mppt:18,n_mppts:4,strings_por_mppt:1,eficiencia_maxima:97.0,fases:1,garantia_anos:12} },
  { id:'6a272b000bb8928e11abce23', fab:'Growatt', modelo:'MIN 5000TL-X', url:'https://solarempire.com.ec/wp-content/uploads/2023/08/Inversor-Growatt-MIN-5000TL-X.pdf (Growatt MIN 2500~6000TL-X)',
    specs:{potencia_kw:5.0,tensao_max_entrada:550,tensao_mppt_min:80,tensao_mppt_max:550,corrente_max_por_mppt:13.5,n_mppts:2,strings_por_mppt:1,eficiencia_maxima:98.4,fases:1,garantia_anos:10} },
  { id:'6a272aff0bb8928e11abce13', fab:'Saj', modelo:'M2-2.25K-S4', url:'https://energiasirius.com/wp-content/uploads/2024/05/Datasheet-Micro-SAJ-2.250W.pdf (SAJ M2)',
    specs:{potencia_kw:2.25,tensao_max_entrada:60,tensao_mppt_min:16,tensao_mppt_max:60,corrente_max_por_mppt:20,n_mppts:4,strings_por_mppt:1,eficiencia_maxima:97.0,fases:1,garantia_anos:12} },
]

await conectarBD()
if (mongoose.connection.readyState !== 1) { console.error('DB_OFFLINE'); process.exit(1) }

const niveis = async () => {
  const arr = await Equipamento.aggregate([{ $group:{ _id:'$qualidade.nivel', t:{ $sum:1 } } }])
  return Object.fromEntries(arr.map(x=>[x._id??'(null)',x.t]))
}
const scoreMedio = async () => {
  const r = await Equipamento.aggregate([{ $group:{ _id:null, s:{ $avg:'$qualidade.score_global' } } }])
  return Number((r[0]?.s||0).toFixed(2))
}

const antes = { niveis: await niveis(), score: await scoreMedio() }
const detalhe = []

for (const item of LOTE) {
  const eq = await Equipamento.findById(item.id)
  if (!eq) { detalhe.push({ id:item.id, erro:'nao encontrado' }); continue }
  const nivelAntes = eq.qualidade?.nivel, scoreAntes = eq.qualidade?.score_global
  eq.especificacoes = eq.especificacoes || {}
  eq.fonte_dados = eq.fonte_dados || {}
  const preenchidos = [], pulados = []
  for (const [k,v] of Object.entries(item.specs)) {
    const atual = eq.especificacoes[k]
    if (atual === undefined || atual === null || atual === '') {   // SOMENTE campos vazios
      eq.especificacoes[k] = v
      eq.fonte_dados[k] = { fonte:'datasheet_oficial', url:item.url, modelo_datasheet:item.modelo, em:new Date() }
      preenchidos.push(k)
    } else { pulados.push(k) }   // nunca sobrescreve (idempotente)
  }
  if (APPLY && preenchidos.length) {
    // P1-MICRO-CALIBRATION-APPLY: specs vieram de datasheet oficial -> origem datasheet
    eq.origem = { ...(eq.origem || {}), tipo: 'datasheet_pdfparse', fonte: 'datasheet_oficial (Wave1)', em: new Date() }
    eq.markModified('origem')
    eq.markModified('especificacoes'); eq.markModified('fonte_dados')
    const r = processarEquipamento(eq.toObject(), { tipoEvento:'enriquecimento_datasheet_wave1' })
    eq.specs_canonicas = r.specs_canonicas; eq.identificacao = r.identificacao
    eq.qualidade = r.qualidade; eq.status_operacional = r.status_operacional
    await eq.save()
    detalhe.push({ id:item.id, modelo:item.modelo, preenchidos, pulados, nivel_antes:nivelAntes, nivel_depois:r.qualidade?.nivel, score_antes:scoreAntes, score_depois:r.qualidade?.score_global, alertas_depois:(r.qualidade?.alertas||[]).map(a=>a.codigo) })
  } else {
    // dry preview (sem salvar)
    const r = processarEquipamento(eq.toObject(), { tipoEvento:'dryrun' })
    detalhe.push({ id:item.id, modelo:item.modelo, preenchidos, pulados, nivel_antes:nivelAntes, nivel_previsto:r.qualidade?.nivel, score_previsto:r.qualidade?.score_global, dry:true })
  }
}

const depois = APPLY ? { niveis: await niveis(), score: await scoreMedio() } : null
const out = { sprint:'P1-INVERTER-DATASHEET-ENRICH-WAVE1-01', aplicado:APPLY, gerado_em:new Date().toISOString(), antes, depois, detalhe }
const dir = fileURLToPath(new URL('./', import.meta.url))
fs.writeFileSync(dir+(APPLY?'APPLY_RESULT.json':'DRY_PREVIEW.json'), JSON.stringify(out,null,2))
console.log('MODO:', APPLY?'APPLY':'DRY')
console.log('antes niveis:', JSON.stringify(antes.niveis), 'score', antes.score)
if (depois) console.log('depois niveis:', JSON.stringify(depois.niveis), 'score', depois.score)
for (const d of detalhe) console.log(' ', d.modelo, '| preench:', (d.preenchidos||[]).length, '| nivel:', d.nivel_antes, '->', d.nivel_depois||d.nivel_previsto, '| score:', (d.score_depois??d.score_previsto), '| alertas:', JSON.stringify(d.alertas_depois||[]))
await mongoose.connection.close(); process.exit(0)
