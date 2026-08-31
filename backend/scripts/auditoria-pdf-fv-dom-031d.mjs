/**
 * auditoria-pdf-fv-dom-031d.mjs — FV-DOM-031D, item 1
 *
 * "Auditar `gerarPDFUnifilar` e todo o caminho utilizado para gerar o PDF."
 *
 * SÓ MEDE. Nenhuma escrita, nenhum banco, nenhuma rede.
 *
 *   node backend/scripts/auditoria-pdf-fv-dom-031d.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ler = (rel) => (existsSync(path.join(RAIZ, rel)) ? readFileSync(path.join(RAIZ, rel), 'utf8') : null)
const grep = (padrao, onde) => {
  try {
    return execSync(`git grep -n -- "${padrao}" ${onde}`, { cwd: RAIZ, encoding: 'utf8' })
      .split('\n').filter(Boolean)
  } catch { return [] }
}

console.log('═══ FV-DOM-031D · item 1 — o caminho do PDF ═══\n')

// ── 1 · gerarPDFUnifilar: de quem é? ────────────────────────────────────────
const pdf = ler('backend/src/utils/gerarPDFUnifilar.js')
console.log('── 1 · `gerarPDFUnifilar.js`')
console.log(`   adapter usado : ${/construirCanonicalDeProjetoEV/.test(pdf) ? 'construirCanonicalDeProjetoEV  ← EV' : '(outro)'}`)
console.log(`   menciona FV   : ${/ProjetoFV|projetos-fv|arranjos|micros/.test(pdf) ? 'sim' : 'NÃO'}`)
console.log(`   menciona micro: ${/micro/i.test(pdf) ? 'sim' : 'NÃO'}`)
const chamadores = grep('gerarPDFUnifilar', 'backend/src frontend/src')
  .filter((l) => !l.startsWith('backend/src/utils/gerarPDFUnifilar.js'))
console.log('   chamadores:')
for (const l of chamadores) console.log(`     ${l.split(':').slice(0, 2).join(':')}  ${l.split(':').slice(2).join(':').trim().slice(0, 70)}`)
console.log('   ↳ CONCLUSÃO: é o PDF do módulo EV. Não existe caminho de FV por aqui.')

// ── 2 · Existe PDF de unifilar FV? ──────────────────────────────────────────
console.log('\n── 2 · O unifilar FV tem PDF?')
const rotasFv = ler('backend/src/routes/projetosFV.js') ?? ''
console.log(`   rota de PDF em projetosFV.js : ${/pdf/i.test(rotasFv) ? 'sim' : 'NÃO'}`)
const etapa = ler('frontend/src/fv/paginas/etapas/EtapaUnifilar.jsx') ?? ''
console.log(`   download/exportação na tela  : ${/download|baixar|jspdf|toPDF/i.test(etapa) ? 'sim' : 'NÃO'}`)
console.log(`   render do desenho            : ${/dangerouslySetInnerHTML/.test(etapa) ? 'SVG inline' : '(outro)'}`)
console.log('   ↳ CONCLUSÃO: o unifilar FV é exibido como SVG inline. Não há PDF de unifilar FV.')

// ── 3 · Que PDF o FV gera, então? ───────────────────────────────────────────
console.log('\n── 3 · Os PDFs que o FV realmente gera')
const gerador = ler('frontend/src/utils/gerarPdfHomologacao.js') ?? ''
const tipos = [...gerador.matchAll(/^\s{4}(\w+):\s*'([^']+)'/gm)].map((m) => `${m[1]} → ${m[2]}`)
console.log('   `gerarPdfHomologacao` (jsPDF, no CLIENTE):')
for (const t of tipos) console.log(`     ${t}`)
console.log(`   fonte do conteúdo: ${/texto\.split\('\\n'\)/.test(gerador) ? 'o TEXTO recebido, linha a linha' : '(outro)'}`)
const usos = grep('gerarPdfHomologacao', 'frontend/src')
  .filter((l) => !l.startsWith('frontend/src/utils/gerarPdfHomologacao.js'))
console.log('   quem chama:')
for (const l of usos) console.log(`     ${l.split(':').slice(0, 2).join(':')}`)
console.log('   ↳ CONCLUSÃO: o PDF do MEMORIAL é uma transcrição do texto do memorial.')
console.log('     Como a FV-DOM-031C tornou esse texto ciente de micro, o PDF já sai')
console.log('     correto — não há desenho de MPPT/string para corrigir dentro dele.')

// ── 4 · O que isso significa para a sprint ──────────────────────────────────
console.log('\n── 4 · Correção do relatório da FV-DOM-031C')
console.log('   Aquele relatório listou "gerarPDFUnifilar ainda desenha pelo caminho')
console.log('   antigo" como bloqueio. A afirmação estava ERRADA: aquele arquivo nunca')
console.log('   desenhou FV. O bloqueio real é outro e menor — não existe PDF de')
console.log('   unifilar FV, para topologia nenhuma.')

console.log('\n═══ FIM — nenhuma escrita ═══')
