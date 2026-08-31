/**
 * auditoria-topologia-fv-dom-031b.mjs — FV-DOM-031B, item 2
 *
 * Os 6 modelos que a FV-DOM-031 apontou como "código unânime, catálogo omisso".
 * A pergunta é UMA: o dado pode ser obtido de forma INEQUÍVOCA do que já existe?
 *
 * A única fonte disponível dentro do repositório é o próprio `catalogoEletrico.js`,
 * que agrupa os modelos sob cabeçalhos de seção escritos à mão. Um cabeçalho é
 * declaração do catálogo sobre si mesmo — não é heurística nova. Onde ele
 * concorda com o classificador, o dado é inequívoco. Onde CONTRADIZ, não é.
 *
 * SÓ MEDE. Nenhuma escrita, nenhum banco, nenhuma rede.
 *
 *   node backend/scripts/auditoria-topologia-fv-dom-031b.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DADOS_ELETRICOS_INVERSORES } from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'
import { classificarTopologiaInversor } from '@fortesolar/fv-shared/inversores'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FONTE = readFileSync(path.join(RAIZ, 'packages/fv-shared/engenharia/catalogoEletrico.js'), 'utf8')

/** Marca/modelo por id — mesma tabela do seed da FV-UX-027. */
const REF = {
  dy8: ['Deye', 'SUN-8K-SG01LP1'], dy12t: ['Deye', 'SUN-12K-SG'],
  dh5: ['Deye', 'SUN-5K-SG04LP1'], dh8: ['Deye', 'SUN-8K-SG04LP1'],
  dh12t: ['Deye', 'SUN-12K-SG04LP3'], dof5: ['Deye', 'SUN-5K-SG01LP1-EU'],
}

/** Cabeçalho de seção sob o qual cada id está declarado, lido do próprio arquivo. */
function secaoDoId(id) {
  const linhas = FONTE.split('\n')
  let secao = null
  for (const l of linhas) {
    const cab = l.match(/^\s*\/\/\s*──\s*(.+?)\s*──/)
    if (cab) { secao = cab[1]; continue }
    if (new RegExp(`^\\s*${id}\\s*:`).test(l)) return secao
  }
  return null
}

/** O cabeçalho declara topologia? Só as palavras que o próprio catálogo usa. */
function topologiaDaSecao(secao) {
  if (!secao) return null
  if (/h[íi]brido/i.test(secao)) return 'HYBRID'
  if (/micro/i.test(secao)) return 'MICRO'
  if (/otimizador/i.test(secao)) return 'OTIMIZADOR'
  if (/off-?grid/i.test(secao)) return 'OFF-GRID'   // não existe no enum canônico
  if (/string/i.test(secao)) return 'STRING'
  return null
}

const col = (v, n) => String(v ?? '—').padEnd(n)
console.log('═══ FV-DOM-031B · item 2 — os 6 sem `topologia` explícita ═══\n')
console.log(col('ID', 8) + col('MODELO', 22) + col('SEÇÃO DO CATÁLOGO', 24) +
  col('SEÇÃO DIZ', 11) + col('CÓDIGO DIZ', 12) + 'VEREDITO')

const inequivocos = []
const lacunas = []
for (const id of Object.keys(REF)) {
  const [fabricante, modelo] = REF[id]
  const e = DADOS_ELETRICOS_INVERSORES[id]
  const secao = secaoDoId(id)
  const daSecao = topologiaDaSecao(secao)
  const doCodigo = classificarTopologiaInversor(
    { tensao_max_entrada: e.tensao_max_entrada, potencia_kw: e.potencia_ca_kw },
    { fabricante, modelo })

  let veredito
  if (daSecao === null) { veredito = 'LACUNA — seção não declara'; lacunas.push({ id, modelo, motivo: 'seção sem topologia' }) }
  else if (daSecao === doCodigo) { veredito = `INEQUÍVOCO → ${daSecao}`; inequivocos.push({ id, modelo, topologia: daSecao }) }
  else { veredito = `CONFLITO (${daSecao} × ${doCodigo}) — LACUNA`; lacunas.push({ id, modelo, motivo: `seção diz ${daSecao}, código diz ${doCodigo}` }) }

  console.log(col(id, 8) + col(modelo, 22) + col(secao, 24) + col(daSecao, 11) + col(doCodigo, 12) + veredito)
}

console.log(`\n── INEQUÍVOCOS (${inequivocos.length}) — preenchíveis sem heurística nova`)
for (const i of inequivocos) console.log(`   ${i.id}  ${i.modelo}  →  topologia: '${i.topologia.toLowerCase()}'`)
console.log('   ↳ o cabeçalho da seção é declaração do próprio catálogo, e o')
console.log('     classificador já chega ao MESMO resultado. Preencher torna o')
console.log('     dado explícito sem mudar veredito algum.')

console.log(`\n── LACUNAS (${lacunas.length}) — NÃO preencher`)
for (const l of lacunas) console.log(`   ${l.id}  ${l.modelo}  —  ${l.motivo}`)
console.log('   ↳ resolver exige o datasheet do fabricante, que não está no')
console.log('     repositório. Inventar aqui seria criar dado, não derivá-lo.')
console.log('     `dof5` tem agravante: "off-grid" não existe no enum canônico')
console.log('     TOPOLOGIA {STRING, MICRO, HYBRID, OTIMIZADOR} — acrescentá-lo')
console.log('     é decisão de domínio, fora do escopo deste item.')

console.log('\n═══ FIM — nenhuma escrita, nenhum arquivo alterado ═══')
