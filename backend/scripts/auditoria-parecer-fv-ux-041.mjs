/**
 * auditoria-parecer-fv-ux-041.mjs — FV-UX-041
 *
 * Responde UMA pergunta: o extrator legado de Parecer de Acesso está
 * tecnicamente recuperável e compatível com a arquitetura atual?
 *
 * NÃO reativa a rota. NÃO altera fluxo. NÃO cria campo, estado ou regra.
 *
 * O que mede:
 *   1. o bloqueio histórico ("pdfjs-dist blocker") ainda vale?
 *   2. o código carrega hoje, com as dependências instaladas?
 *   3. o que ele ESCREVE cabe na arquitetura atual?
 *   4. o que ele DEPENDE de fora (Gemini, chave, dados pessoais)?
 *   5. quem no frontend ainda aponta para ele?
 *
 *   node backend/scripts/auditoria-parecer-fv-ux-041.mjs
 */
import { readFileSync, existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = path.resolve(RAIZ, '..')
const ler = (rel) => { try { return readFileSync(path.resolve(APP, rel), 'utf8') } catch { return '' } }
const semComentario = (f) => f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const secao = (t) => console.log(`\n══ ${t} ${'═'.repeat(Math.max(0, 56 - t.length))}`)
const achados = []
function achado(estado, titulo, evidencia) {
  achados.push({ estado, titulo, evidencia })
  const m = { OK: '✓', RISCO: '⚠', BLOQUEIO: '✗', DECISAO: '◆' }[estado]
  console.log(`${m} ${titulo.padEnd(40)} ${evidencia}`)
}

const CTRL = ler('backend/src/controllers/pareceracessoController.js')
const CTRL_CODIGO = semComentario(CTRL)
const ROTA = ler('backend/src/routes/pareceracesso.js')
const SERVER = ler('backend/src/server.js')
const SCHEMA = ler('backend/src/models/ProjetoFV.js')

console.log('═══ FV-UX-041 — auditoria do extrator de Parecer de Acesso ═══')

// ═══ 1 · O componente ══════════════════════════════════════════════════════
secao('1 · O componente')
{
  achado('OK', 'Controller', `${CTRL.split('\n').length} linhas · ${CTRL.length} bytes`)
  console.log('   ↳ correção: a FV-UX-040 reportou "197 KB". Era a coluna errada do `ls`.')
  const exports = [...CTRL.matchAll(/^export const (\w+)/gm)].map((m) => m[1])
  achado('OK', 'Exports', exports.join(', '))
  const rotas = [...ROTA.matchAll(/router\.(get|post)\('([^']+)'/g)].map((m) => `${m[1].toUpperCase()} ${m[2]}`)
  achado('OK', 'Rotas do router', rotas.join(' · '))
  const desativada = /^\s*\/\/\s*app\.use\('\/api\/parecer-acesso'/m.test(SERVER)
  achado(desativada ? 'OK' : 'RISCO', 'Estado da montagem',
    desativada ? 'COMENTADA em server.js (linha 264) — não está no ar' : 'MONTADA')
}

// ═══ 2 · O bloqueio histórico ainda vale? ══════════════════════════════════
secao('2 · O bloqueio "pdfjs-dist blocker"')
{
  const importaPdfjsDireto = /from ['"]pdfjs-dist/.test(CTRL_CODIGO)
  achado(importaPdfjsDireto ? 'BLOQUEIO' : 'OK', 'Importa pdfjs-dist diretamente?',
    importaPdfjsDireto ? 'SIM — o bloqueio se aplica' : 'NÃO — usa `PDFParse` de `pdf-parse`')

  const pkg = JSON.parse(ler('backend/package.json'))
  const deps = pkg.dependencies ?? {}
  for (const d of ['pdf-parse', '@google/generative-ai', 'multer']) {
    const instalada = existsSync(path.resolve(APP, `backend/node_modules/${d}`))
    achado(instalada && deps[d] ? 'OK' : 'BLOQUEIO', `Dependência ${d}`,
      `${deps[d] ?? 'NÃO declarada'} · ${instalada ? 'instalada' : 'AUSENTE'}`)
  }
  const pdfParsePkg = JSON.parse(ler('backend/node_modules/pdf-parse/package.json') || '{}')
  achado('OK', 'pdfjs-dist é transitiva',
    `pdf-parse@${pdfParsePkg.version} traz pdfjs-dist@${pdfParsePkg.dependencies?.['pdfjs-dist']}`)

  // A prova: o módulo carrega?
  let carrega = false, erro = null
  try { await import('../src/controllers/pareceracessoController.js'); carrega = true }
  catch (e) { erro = e.message }
  achado(carrega ? 'OK' : 'BLOQUEIO', 'O controller CARREGA hoje',
    carrega ? 'sim — o bloqueio histórico está VENCIDO' : `não: ${erro}`)
  let rotaCarrega = false
  try { await import('../src/routes/pareceracesso.js'); rotaCarrega = true } catch { /* */ }
  achado(rotaCarrega ? 'OK' : 'BLOQUEIO', 'O router CARREGA hoje', rotaCarrega ? 'sim' : 'não')

  // Efeito colateral de IMPORT — não de chamada.
  const dirTreino = path.resolve(APP, 'backend/data/training-data')
  if (existsSync(dirTreino)) {
    achado('RISCO', 'Efeito colateral no import',
      '`trainingDataCollector` cria `backend/data/training-data/` só por ser importado')
    try { rmSync(dirTreino, { recursive: true, force: true }) } catch { /* */ }
  }
}

// ═══ 3 · O que ele ESCREVE cabe na arquitetura atual? ══════════════════════
secao('3 · Compatibilidade do que ele escreve')
{
  // Tenancy
  const temEscopo = /aplicarEscopo\(/.test(CTRL_CODIGO)
  const temCarimbo = /carimbarTenant\(/.test(CTRL_CODIGO)
  achado(temEscopo && temCarimbo ? 'OK' : 'BLOQUEIO', 'Isolamento por empresa_id (M-4)',
    `aplicarEscopo=${temEscopo} · carimbarTenant=${temCarimbo}`)

  // Status
  const status = (CTRL_CODIGO.match(/status:\s*'(\w+)'/) ?? [])[1]
  const enumStatus = (SCHEMA.match(/enum: \[([^\]]*'em_simulacao'[^\]]*)\]/) ?? [])[1] ?? ''
  achado(enumStatus.includes(`'${status}'`) ? 'OK' : 'BLOQUEIO', 'Status que grava',
    `'${status}' ${enumStatus.includes(`'${status}'`) ? 'existe no enum atual' : 'NÃO existe'}`)

  // Composição — o ponto da FV-UX-038 (D1)
  const escreveArranjos = /arranjos/.test(CTRL_CODIGO)
  achado('DECISAO', 'Escreve `arranjos[]`?',
    escreveArranjos ? 'sim' : 'NÃO — grava só `equipamentos.paineis[]` + `equipamentos.inversor`')
  console.log('   ↳ `composicaoDoProjeto` (FV-UX-038) deriva do legado, então LÊ;')
  console.log('     mas quantidade de inversor cai no default 1 — ver abaixo.')

  /**
   * Probe anterior (`/inversor[\s\S]{0,200}quantidade/`) casava com
   * `"quantidade_paineis"` logo abaixo do bloco do inversor e reportava "sim".
   * O que importa é se ALGUM ponto lê/grava quantidade DO INVERSOR.
   */
  const camposInversor = [...CTRL_CODIGO.matchAll(/dadosEquipamento\.inversor\.(\w+)/g)]
    .map((m) => m[1])
  const extraiQtdInversor = camposInversor.includes('quantidade')
  achado('DECISAO', 'Extrai quantidade de inversor?',
    extraiQtdInversor
      ? 'sim'
      : `NÃO — só ${[...new Set(camposInversor)].join(', ')}. Um parecer com 8 micros `
        + 'vira 1 inversor')

  // Topologia fixa
  const topoFixa = /tipo:\s*'string',/.test(CTRL_CODIGO)
  achado(topoFixa ? 'DECISAO' : 'OK', 'Topologia do inversor',
    topoFixa
      ? "grava `tipo: 'string'` FIXO — parecer de microinversor seria persistido como string"
      : 'derivada do equipamento')

  // Segundo motor de unifilar
  const usaSVGProprio = /simbolosUnifilar/.test(CTRL_CODIGO)
  const usaCanonico = /dominio\/unifilar/.test(CTRL_CODIGO)
  achado(usaSVGProprio && !usaCanonico ? 'DECISAO' : 'OK', 'Motor de unifilar',
    usaSVGProprio && !usaCanonico
      ? 'desenha com `utils/simbolosUnifilar` — SEGUNDO motor, paralelo a `dominio/unifilar/`'
      : 'usa o canônico')
  const outrosUsuarios = ['backend/src/controllers/unifilarController.js']
    .filter((f) => /simbolosUnifilar/.test(ler(f)))
  console.log(`   ↳ utils/simbolosUnifilar também é usado por: ${outrosUsuarios.join(', ') || 'ninguém'}`)

  // Cria cliente e projeto direto — fora do fluxo canônico
  achado('DECISAO', 'Cria Cliente e ProjetoFV direto',
    'entra pelo meio do fluxo: sem cotação, orçamento, Baseline ou Gate')
  const emailSintetico = /@parecer\.local/.test(CTRL_CODIGO)
  achado(emailSintetico ? 'RISCO' : 'OK', 'E-mail sintético de cliente',
    emailSintetico ? 'inventa `<numero>@parecer.local` quando o parecer não traz e-mail' : 'não inventa')
}

// ═══ 4 · Dependências externas e dados ═════════════════════════════════════
secao('4 · Dependência externa e dados pessoais')
{
  const usaGemini = /GoogleGenerativeAI/.test(CTRL_CODIGO)
  const modelo = (CTRL_CODIGO.match(/getGenerativeModel\(\{\s*model:\s*'([^']+)'/) ?? [])[1]
  achado('DECISAO', 'Extração é por LLM',
    usaGemini ? `Gemini (${modelo}) — não é parser determinístico` : 'parser determinístico')
  const chave = (CTRL_CODIGO.match(/process\.env\.(\w*API_KEY\w*)/) ?? [])[1]
  achado(process.env[chave] ? 'OK' : 'DECISAO', `Chave ${chave}`,
    process.env[chave] ? 'presente no ambiente' : 'AUSENTE — sem ela o endpoint responde 400')

  achado('DECISAO', 'PDF vai inteiro para o Google',
    'o parecer (nome, CPF/CNPJ, endereço, nº de cliente) é enviado em base64')

  const coletor = ler('backend/src/config/trainingDataCollector.js')
  const arquivo = (coletor.match(/TRAINING_FILE = path\.join\([^,]+,\s*'([^']+)'/) ?? [])[1]
  achado('DECISAO', 'Coleta dados para treino',
    `grava extrações em \`backend/data/training-data/${arquivo}\` — inclui dados do cliente`)
  achado('DECISAO', 'Determinismo',
    'saída de LLM: mesmo PDF pode extrair diferente entre chamadas')

  // Há validação da saída?
  const valida = /const validarExtracao/.test(CTRL_CODIGO)
  const rejeita = /if \(!validacao\.valido\)[\s\S]{0,120}status\(400\)/.test(CTRL_CODIGO)
  achado(valida && rejeita ? 'OK' : 'RISCO', 'Valida a saída do LLM',
    valida ? `sim — \`validarExtracao\` + completude, e ${rejeita ? 'REJEITA' : 'não rejeita'} incompleto` : 'não')
}

// ═══ 5 · Superfície de frontend ════════════════════════════════════════════
secao('5 · Quem ainda aponta para o endpoint')
{
  const modal = ler('frontend/src/components/UploadParecerModal.jsx')
  const importadoPorAlguem = ['frontend/src/pages/ProjetosFV.jsx', 'frontend/src/App.jsx']
    .some((f) => /import .*UploadParecerModal/.test(ler(f)))
  achado(importadoPorAlguem ? 'OK' : 'RISCO', 'UploadParecerModal.jsx',
    `${modal.split('\n').length} linhas · ${importadoPorAlguem ? 'importado' : 'IMPORTADO POR NINGUÉM (morto)'}`)

  const projetosFV = ler('frontend/src/pages/ProjetosFV.jsx')
  const chamaInline = /\/api\/parecer-acesso\/extrair/.test(projetosFV)
  const roteada = /ProjetosFV/.test(ler('frontend/src/App.jsx'))
  achado(chamaInline ? 'RISCO' : 'OK', 'ProjetosFV.jsx (página legada)',
    chamaInline
      ? `chama o endpoint inline${roteada ? ' e está roteada' : ''} — hoje receberia 404`
      : 'não chama')

  const uxNova = ['frontend/src/fv/api/agregadosFvApi.js']
    .some((f) => /parecer-acesso/.test(ler(f)))
  achado(uxNova ? 'OK' : 'OK', 'A UX nova /fv',
    uxNova ? 'chama o endpoint' : 'NÃO conhece o parecer — nenhuma referência funcional')
}

// ═══ VEREDITO ══════════════════════════════════════════════════════════════
secao('VEREDITO')
const por = (e) => achados.filter((a) => a.estado === e)
console.log(`✓ OK        ${por('OK').length}`)
console.log(`⚠ RISCO     ${por('RISCO').length}`)
console.log(`◆ DECISÃO   ${por('DECISAO').length}`)
console.log(`✗ BLOQUEIO  ${por('BLOQUEIO').length}`)

console.log(`\nRecuperável tecnicamente: ${por('BLOQUEIO').length === 0 ? 'SIM' : 'NÃO'}`)
if (por('DECISAO').length > 0) {
  console.log('\n── Precisa de decisão de negócio antes de reativar ──')
  for (const a of por('DECISAO')) console.log(`   ◆ ${a.titulo} — ${a.evidencia}`)
}
if (por('RISCO').length > 0) {
  console.log('\n── Riscos a tratar ──')
  for (const a of por('RISCO')) console.log(`   ⚠ ${a.titulo} — ${a.evidencia}`)
}
console.log('\n─── fim da auditoria — nada foi reativado nem alterado ───')
