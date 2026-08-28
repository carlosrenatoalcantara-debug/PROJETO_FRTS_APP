/**
 * medir-acervo-potencia-fv-dom-052.mjs — FV-DOM-052
 *
 * CONTAGEM, nada mais. Responde quantos projetos do acervo conseguem afirmar uma
 * potência instalada e quantos cairiam no fallback fabricado do motor.
 *
 * ── SOMENTE LEITURA ─────────────────────────────────────────────────────────
 * Nenhuma escrita, nenhum backfill, nenhuma correção. O script não importa
 * modelo com `save`, não chama `updateOne` e não grava arquivo — a saída é o
 * terminal. Recusa-se a rodar se receber `--fix` ou equivalente.
 *
 * ── NÃO FOI EXECUTADO CONTRA PRODUÇÃO ───────────────────────────────────────
 * Ler o Atlas de produção exige autorização explícita, que esta sprint não tem.
 * O script fica pronto; a execução é decisão de quem tem a credencial.
 *
 *   MONGODB_URI="<uri>" node backend/scripts/medir-acervo-potencia-fv-dom-052.mjs
 */
import mongoose from 'mongoose'

if (process.argv.slice(2).some((a) => /^--(fix|corrigir|backfill|write)$/.test(a))) {
  console.error('Este script é somente leitura. Não existe modo de escrita.')
  process.exit(2)
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('Defina MONGODB_URI. O script não descobre banco sozinho.')
  process.exit(2)
}

await mongoose.connect(uri)
const { ProjetoFV } = await import('../src/models/ProjetoFV.js')
const { derivarPotencias } = await import('../src/dominio/potencia/index.js')
const { potenciaPaineisKwp } = await import('../src/services/arranjosService.js')

const p = (k, v) => console.log(`   ${String(k).padEnd(48)} ${v}`)
const pct = (n, t) => (t === 0 ? '—' : `${((n / t) * 100).toFixed(1)}%`)

const projetos = await ProjetoFV.find({}, {
  dimensionamento: 1, equipamentos: 1, arranjos: 1, engenharia_eletrica: 1,
  local_resolvido: 1, localizacao: 1, fatura_extracao: 1, nome: 1,
}).lean()

const c = {
  total: projetos.length,
  comNecessidade: 0, comComprada: 0, comInstalada: 0,
  cairiaNoFallback: 0, semPmpp: 0,
  micro: 0, string: 0,
  divergeNecComp: 0, divergeCompInst: 0,
  cacheGravado: 0, cacheDivergente: 0,
}

for (const proj of projetos) {
  let r
  try { r = derivarPotencias(proj) } catch { continue }

  if (r.necessidade.valor != null) c.comNecessidade++
  if (r.comprada.valor != null) c.comComprada++
  if (r.instalada.valor != null) c.comInstalada++
  if (r.instalada.motivo === 'TOPOLOGIA_AUSENTE') c.cairiaNoFallback++
  if (r.instalada.motivo === 'MODULO_SEM_POTENCIA') c.semPmpp++
  if (r.instalada.topologia === 'micro') c.micro++; else c.string++

  if (r.divergencias.necessidade_vs_comprada.divergente) c.divergeNecComp++
  if (r.divergencias.comprada_vs_instalada.divergente) c.divergeCompInst++

  // Quarta verdade latente (FV-DOM-051): `arranjos[].potencia_kwp` gravado vence
  // a soma dos painéis em `enriquecerArranjo`. Mede quantos já têm valor lá.
  for (const a of proj.arranjos ?? []) {
    if (a?.potencia_kwp == null) continue
    c.cacheGravado++
    const somado = potenciaPaineisKwp(a.paineis ?? [])
    if (Number(a.potencia_kwp) !== Number(somado)) c.cacheDivergente++
  }
}

console.log('═══ FV-DOM-052 — acervo (somente contagem) ═══\n')
p('projetos lidos', c.total)
console.log()
p('com necessidade calculada', `${c.comNecessidade}  (${pct(c.comNecessidade, c.total)})`)
p('com composição comprada', `${c.comComprada}  (${pct(c.comComprada, c.total)})`)
p('com POTÊNCIA INSTALADA afirmável', `${c.comInstalada}  (${pct(c.comInstalada, c.total)})`)
console.log()
p('cairiam no fallback (topologia ausente)', `${c.cairiaNoFallback}  (${pct(c.cairiaNoFallback, c.total)})`)
p('com topologia mas sem Pmpp do módulo', `${c.semPmpp}  (${pct(c.semPmpp, c.total)})`)
console.log()
p('classificados como micro', c.micro)
p('classificados como string', c.string)
console.log()
p('necessidade ≠ comprada', `${c.divergeNecComp}  (${pct(c.divergeNecComp, c.total)})`)
p('comprada ≠ instalada (só onde há instalada)', `${c.divergeCompInst}  (${pct(c.divergeCompInst, c.comInstalada)})`)
console.log()
p('arranjos com `potencia_kwp` gravado', c.cacheGravado)
p('  destes, ≠ soma dos painéis', c.cacheDivergente)

await mongoose.disconnect()
console.log('\nNada foi escrito.')
