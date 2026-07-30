// READ-ONLY — P0-QUALITY-RULE-MICRO-CALIBRATION-01. Simula recalibracao SEM ALTERAR NADA.
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { Equipamento } from '../../src/models/Equipamento.js'
import { lerInversor } from '../../src/equipamentos/inversores/index.js'
import { aplicarRegras, _internals } from '../../src/services/regrasPlausibilidade.js'
import fs from 'fs'; import { fileURLToPath } from 'url'
const { num } = _internals

// ---- replica EXATA do motor (catalogoQualidade.js) ----
const BASE_POR_ORIGEM = { manual:100, datasheet_gemini:90, datasheet_pdfparse:75, import_planilha:60, import_legado:40, desconhecido:20 }
const MULT = { critico:0, alto:0.5, medio:0.85, baixo:0.95, info:1.0 }
const PESOS = { identificacao:15, potencia_kw_ca:10, voc_max_dc_v:15, mppt_min_v:10, mppt_max_v:10, isc_max_por_mppt_a:10, n_mppts:10, fases_saida:10, eficiencia_max_pct:5, tensao_saida_v:5 }
const temIdent = (eq) => { const f=(eq.fabricante||'').trim(), m=(eq.modelo||'').trim(); if(f.length<2||m.length<2)return false; const p=/^\s*(desconhecid[ao]|n\/?a|sem\s*nome|null|undefined|--)\s*$/i; return !(p.test(f)||p.test(m)) }
const presente = (s,c)=>{ const v=s?.[c]; if(v==null)return false; if(typeof v==='number')return Number.isFinite(v); if(typeof v==='object')return Object.values(v).some(x=>x!=null); return String(v).trim().length>0 }
function canon(eq){ const c=lerInversor(eq.especificacoes||{}); return {
  _versao:'1.0', potencia_kw_ca:num(c.potencia_kw), potencia_kw_cc_max:num(c.potencia_max_entrada_cc), fases_saida:num(c.fases),
  tensao_saida_v:num(c.tensao_ac), voc_max_dc_v:num(c.tensao_max_entrada), mppt_min_v:num(c.tensao_mppt_min), mppt_max_v:num(c.tensao_mppt_max),
  isc_max_por_mppt_a:num(c.corrente_isc_max ?? c.corrente_max_por_mppt), n_mppts:num(c.n_mppts), eficiencia_max_pct:num(c.eficiencia_maxima) } }
function plano(eq){ return { tipo:eq.tipo, fabricante:eq.fabricante, modelo:eq.modelo,
  _tem_especificacoes_originais:Boolean(eq.especificacoes && Object.keys(eq.especificacoes||{}).length>0), ...canon(eq) } }
function completude(eq, sc){ let tot=0,pre=0; for(const[c,p]of Object.entries(PESOS)){ tot+=p; const ok = c==='identificacao'?temIdent(eq):presente(sc,c); if(ok)pre+=p } return Math.round(pre/tot*100) }
function confianca(origemTipo, alertas, baseTable){ let s=baseTable[origemTipo] ?? baseTable.desconhecido; for(const a of alertas) s*=(MULT[a.severidade]??1); return Math.max(0,Math.min(100,Math.round(s))) }
function nivel(score, alertas, eq){ if(alertas.some(a=>a.severidade==='critico'))return 'invalido'; if(!temIdent(eq))return 'aguardando_revisao'; if(score>=90)return'validado'; if(score>=75)return'utilizavel'; if(score>=50)return'incompleto'; if(score>=30)return'suspeito'; return'invalido' }

// ---- deteccao de tecnologia ----
function tecnologia(eq, sc){
  const nome = `${eq.fabricante||''} ${eq.modelo||''}`.toLowerCase()
  if (/hibrid|hybrid|\bbess\b|storage|all-?in-?one|h1-|hb-|sun-?\d+k-?sg|-eu-sg/.test(nome)) return 'hibrido'
  if (/micro|sun-?m\d|tsol-?m[xpps]|hms-|hmt-|\bm2-|bdm-|iq[78]|ds3|mi-?\d{3,4}/.test(nome)) return 'microinversor'
  if (sc.voc_max_dc_v!=null && sc.voc_max_dc_v<=100) return 'microinversor'
  if (sc.voc_max_dc_v!=null && sc.voc_max_dc_v>=200) return 'string'
  // micro tipico: 1-4 paineis, potencia <=3.5kW e n_mppts>=4
  if (sc.potencia_kw_ca!=null && sc.potencia_kw_ca<=3.5 && (sc.n_mppts||0)>=4) return 'microinversor'
  return 'string'
}

// ---- regras RECALIBRADAS (apenas as 3 afetadas) — avaliadas em memoria ----
function alertasRecalibrados(p, tech){
  // pega alertas atuais e remove/ajusta as 3 regras tech-sensiveis
  const base = aplicarRegras(p).filter(a=>!['MPPT_INCOERENTE','VOC_MAX_DC_IMPLAUSIVEL','MPPT_FAIXA_IMPLAUSIVEL'].includes(a.codigo))
  const min=p.mppt_min_v, max=p.mppt_max_v, voc=p.voc_max_dc_v
  // MPPT_INCOERENTE (universal): min<max e max<=voc (permite igualdade)
  if(min!=null&&max!=null){ if(min>=max) base.push({codigo:'MPPT_INCOERENTE',severidade:'critico'}); else if(voc!=null&&max>voc) base.push({codigo:'MPPT_INCOERENTE',severidade:'critico'}) }
  // VOC_MAX_DC por tecnologia
  if(voc!=null){ const [lo,hi]= tech==='microinversor'?[16,150]:[200,1500]; if(voc<lo||voc>hi) base.push({codigo:'VOC_MAX_DC_IMPLAUSIVEL',severidade:'alto'}) }
  // MPPT_FAIXA por tecnologia
  if(tech==='microinversor'){ if(min!=null&&(min<10||min>80))base.push({codigo:'MPPT_FAIXA_IMPLAUSIVEL',severidade:'medio'}); if(max!=null&&(max<20||max>150))base.push({codigo:'MPPT_FAIXA_IMPLAUSIVEL',severidade:'medio'}) }
  else { if(min!=null&&(min<50||min>400))base.push({codigo:'MPPT_FAIXA_IMPLAUSIVEL',severidade:'medio'}); if(max!=null&&(max<200||max>1000))base.push({codigo:'MPPT_FAIXA_IMPLAUSIVEL',severidade:'medio'}) }
  return base
}

await conectarBD(); if(mongoose.connection.readyState!==1){console.error('DB_OFFLINE');process.exit(1)}
const inv = await Equipamento.find({tipo:'inversor'},'fabricante modelo tipo especificacoes origem fonte_dados qualidade.nivel qualidade.score_global').lean()
const ehEnriquecidoDatasheet = (eq)=> Object.values(eq.fonte_dados||{}).some(f=>f?.fonte==='datasheet_oficial')
const outros = await Equipamento.find({tipo:{$ne:'inversor'}},'qualidade.nivel qualidade.score_global').lean()

// projetos por equipamento (para ROI)
const {ProjetoFV}=await import('../../src/models/ProjetoFV.js')
const projetos=await ProjetoFV.find({},'equipamentos.inversor arranjos.inversores').lean()
const normk=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ')
const pid=new Map(),pfm=new Map(); const adds=(m,k,id)=>{if(!k)return;const s=m.get(String(k))||new Set();s.add(id);m.set(String(k),s)}
for(const p of projetos){const r=[];if(p.equipamentos?.inversor)r.push(p.equipamentos.inversor);for(const a of(p.arranjos||[]))for(const i of(a.inversores||[]))r.push(i);for(const x of r){if(x?.equipamento_id)adds(pid,x.equipamento_id,String(p._id));const fb=x?.fabricante||x?.marca;if(fb&&x?.modelo)adds(pfm,`${normk(fb)}|${normk(x.modelo)}`,String(p._id))}}
const projDe=(eq)=>{const s=new Set();for(const i of(pid.get(String(eq._id))||[]))s.add(i);for(const i of(pfm.get(`${normk(eq.fabricante)}|${normk(eq.modelo)}`)||[]))s.add(i);return s}

const cenarios = {
  atual:        { base:BASE_POR_ORIGEM, recal:false },
  A_regras:     { base:BASE_POR_ORIGEM, recal:true },
  B_regras_conf:{ base:{...BASE_POR_ORIGEM, import_solarmarket:60}, recal:true },
}
const resultados={}; const detalhePorTech={}; const transicoes={}; let validacaoOK=0, validacaoTotal=0
const projetosRecuperados={A_regras:new Set(), B_regras_conf:new Set(), C_regras_origem_datasheet:new Set()}

for(const eq of inv){
  const sc=canon(eq), p=plano(eq), tech=tecnologia(eq,sc)
  detalhePorTech[tech]=(detalhePorTech[tech]||0)+1
  const compl=completude(eq,sc)
  // ATUAL (replica) — valida contra DB
  const aAtual=aplicarRegras(p)
  const confAtual=confianca(eq.origem?.tipo, aAtual, BASE_POR_ORIGEM)
  const scoreAtual=Math.round(compl*0.4+confAtual*0.6)
  const nivAtual=nivel(scoreAtual,aAtual,eq)
  validacaoTotal++; if(nivAtual===eq.qualidade?.nivel) validacaoOK++
  eq.__sim={ atual:{nivel:nivAtual,score:scoreAtual,db:eq.qualidade?.nivel} }
  for(const [nome,cfg] of Object.entries(cenarios)){
    if(nome==='atual')continue
    const al = cfg.recal? alertasRecalibrados(p,tech) : aplicarRegras(p)
    const cf = confianca(eq.origem?.tipo, al, cfg.base)
    const sg = Math.round(compl*0.4+cf*0.6)
    const nv = nivel(sg,al,eq)
    eq.__sim[nome]={nivel:nv,score:sg}
    if(eq.qualidade?.nivel==='invalido' && nv!=='invalido') for(const x of projDe(eq)) projetosRecuperados[nome].add(x)
  }
  // Cenario C: regras recalibradas + origem datasheet SOMENTE p/ itens enriquecidos por datasheet
  {
    const al = alertasRecalibrados(p,tech)
    const origemC = ehEnriquecidoDatasheet(eq) ? 'datasheet_pdfparse' : eq.origem?.tipo
    const cf = confianca(origemC, al, BASE_POR_ORIGEM)
    const sg = Math.round(compl*0.4+cf*0.6)
    const nv = nivel(sg,al,eq)
    eq.__sim['C_regras_origem_datasheet']={nivel:nv,score:sg}
    if(eq.qualidade?.nivel==='invalido' && nv!=='invalido') for(const x of projDe(eq)) projetosRecuperados['C_regras_origem_datasheet'].add(x)
  }
}

// agrega transicoes vs DB nivel
function agrega(nomeCenario){
  const t={ 'invalido->suspeito':0,'invalido->incompleto':0,'invalido->utilizavel':0,'invalido->validado':0,'suspeito->utilizavel':0,'suspeito->incompleto':0,'suspeito->validado':0,'incompleto->utilizavel':0 }
  const cont={ validado:0,utilizavel:0,incompleto:0,suspeito:0,invalido:0,aguardando_revisao:0 }
  let somaScore=0
  for(const eq of inv){ const de=eq.qualidade?.nivel, para=eq.__sim[nomeCenario].nivel; cont[para]=(cont[para]||0)+1; somaScore+=eq.__sim[nomeCenario].score; const k=`${de}->${para}`; if(de!==para && t[k]!==undefined)t[k]++ }
  // score global do catalogo inteiro = (inv recalibrados + outros do DB)/total
  const somaOutros=outros.reduce((s,e)=>s+(e.qualidade?.score_global||0),0)
  const totalDocs=inv.length+outros.length
  const scoreGlobal=Number(((somaScore+somaOutros)/totalDocs).toFixed(2))
  return { transicoes:t, distribuicao_inversores:cont, score_global_catalogo:scoreGlobal }
}
const scoreGlobalAtual=Number(((inv.reduce((s,e)=>s+(e.qualidade?.score_global||0),0)+outros.reduce((s,e)=>s+(e.qualidade?.score_global||0),0))/(inv.length+outros.length)).toFixed(2))

const out={
  sprint:'P0-QUALITY-RULE-MICRO-CALIBRATION-01', read_only:true, gerado_em:new Date().toISOString(),
  validacao_replica:{ inversores:validacaoTotal, baterimporte_DB:validacaoOK, fidelidade_pct:Number((validacaoOK/validacaoTotal*100).toFixed(1)) },
  tecnologia_distribuicao: detalhePorTech,
  score_global_atual: scoreGlobalAtual,
  cenario_A_regras: agrega('A_regras'),
  cenario_B_regras_conf: agrega('B_regras_conf'),
  cenario_C_regras_origem_datasheet: agrega('C_regras_origem_datasheet'),
  projetos_recuperados:{ A_regras:projetosRecuperados.A_regras.size, B_regras_conf:projetosRecuperados.B_regras_conf.size, C_regras_origem_datasheet:projetosRecuperados.C_regras_origem_datasheet.size },
}
const dir=fileURLToPath(new URL('./',import.meta.url))
fs.writeFileSync(dir+'QUALITY_RULE_IMPACT_SIMULATION.json', JSON.stringify(out,null,2))
console.log('fidelidade replica vs DB:', out.validacao_replica.fidelidade_pct,'%  ('+validacaoOK+'/'+validacaoTotal+')')
console.log('tech:', JSON.stringify(detalhePorTech))
console.log('score global atual:', scoreGlobalAtual)
console.log('A (regras):', JSON.stringify(out.cenario_A_regras.transicoes), 'score', out.cenario_A_regras.score_global_catalogo, 'proj', out.projetos_recuperados.A_regras)
console.log('B (regras+conf):', JSON.stringify(out.cenario_B_regras_conf.transicoes), 'score', out.cenario_B_regras_conf.score_global_catalogo, 'proj', out.projetos_recuperados.B_regras_conf)
console.log('C (regras+origem datasheet nos enriquecidos):', JSON.stringify(out.cenario_C_regras_origem_datasheet.transicoes), 'score', out.cenario_C_regras_origem_datasheet.score_global_catalogo, 'proj', out.projetos_recuperados.C_regras_origem_datasheet)
console.log('dist inv A:', JSON.stringify(out.cenario_A_regras.distribuicao_inversores))
console.log('dist inv B:', JSON.stringify(out.cenario_B_regras_conf.distribuicao_inversores))
console.log('dist inv C:', JSON.stringify(out.cenario_C_regras_origem_datasheet.distribuicao_inversores))
await mongoose.connection.close(); process.exit(0)
