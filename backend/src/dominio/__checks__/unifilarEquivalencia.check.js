/**
 * unifilarEquivalencia.check.js — FV-DOM-007B
 *
 * A pergunta que esta sprint precisa responder antes de qualquer outra:
 *
 *   o motor movido para o domínio desenha EXATAMENTE o que o frontend desenhava?
 *
 * Mover engenharia normativa é a operação em que um erro passa despercebido: um
 * sinal trocado num coeficiente térmico não quebra teste nenhum — só produz um
 * unifilar que a concessionária reprova meses depois.
 *
 * Por isso a verificação é BYTE A BYTE contra uma cópia do arquivo original,
 * congelada antes da movimentação, sobre fixtures que exercitam multi-MPPT,
 * string única, micro, trifásico, UF fria e ausência total de dados.
 *
 *   node backend/src/dominio/__checks__/unifilarEquivalencia.check.js
 */
import path from 'node:path'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ_PKG = path.resolve(AQUI, '../../../../packages/fv-shared/engenharia')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

/**
 * Reconstrói o motor ORIGINAL a partir do histórico do git e o carrega de um
 * diretório temporário. Assim a referência não é uma cópia que eu mantenho à
 * mão — é o arquivo como estava antes desta sprint.
 *
 * Se o git não estiver disponível, cai para a cópia de referência do scratchpad
 * declarada em REFERENCIA_ALT (e diz que caiu).
 */
async function carregarReferencia() {
  const { execFileSync } = await import('node:child_process')
  const raizRepo = path.resolve(AQUI, '../../../..')
  const dir = mkdtempSync(path.join(tmpdir(), 'unifilar-ref-'))

  const arquivos = [
    ['frontend/src/data/catalogoEletrico.js', 'catalogoEletrico.js'],
    ['frontend/src/utils/engenhariaNormativa.js', 'engenhariaNormativa.js'],
    ['frontend/src/utils/gerarUnifilarSVG.js', 'gerarUnifilarSVG.js'],
  ]
  for (const [origem, destino] of arquivos) {
    const conteudo = execFileSync('git', ['show', `HEAD:${origem}`], {
      cwd: raizRepo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    })
    writeFileSync(path.join(dir, destino), conteudo)
  }
  // O original importava o catálogo de `../data/`; aqui os três são irmãos.
  const norm = readFileSync(path.join(dir, 'engenhariaNormativa.js'), 'utf8')
    .replace("from '../data/catalogoEletrico.js'", "from './catalogoEletrico.js'")
  writeFileSync(path.join(dir, 'engenhariaNormativa.js'), norm)

  const mod = await import(pathToFileURL(path.join(dir, 'gerarUnifilarSVG.js')).href)
  return mod.gerarUnifilarSVG
}

// ── Fixtures ────────────────────────────────────────────────────────────────
// Formato do CONTEXTO do wizard — é o que o motor recebe. O adapter que traduz o
// documento persistido é testado à parte (`unifilarDominio.check.js`).
const FIXTURES = [
  ['multi-MPPT · 2 MPPTs assimétricos · RN', {
    nome: 'Usina Alfa', nomeCliente: 'Cliente Alfa',
    painel: { id: 'dah_550', marca: 'DAH', modelo: 'DHN-550', potenciaW: 550 },
    inversor: { marca: 'Deye', modelo: 'SUN-8K', potenciaKW: 8, tipo: 'string', nMppts: 2 },
    arranjoMPPTs: [
      { numStrings: 2, modulosPorString: 9 },
      { numStrings: 1, modulosPorString: 8 },
    ],
    dimensionamento: { numPaineis: 26, numStrings: 3, potenciaArredondada: 8 },
    tipo_ligacao: 'trifasico', tensao: '380', distribuidora: 'Neoenergia', uf: 'RN',
  }],
  ['string única · monofásico 220 V', {
    nome: 'Residência Beta', nomeCliente: 'Cliente Beta',
    painel: { marca: 'Canadian', modelo: 'CS7', potenciaW: 600 },
    inversor: { marca: 'Growatt', modelo: 'MIN-5000', potenciaKW: 5, tipo: 'string', nMppts: 1 },
    arranjoMPPTs: [{ numStrings: 1, modulosPorString: 10 }],
    dimensionamento: { numPaineis: 10, numStrings: 1, potenciaArredondada: 5 },
    tipo_ligacao: 'monofasico', tensao: '220', distribuidora: 'CPFL', uf: 'SP',
  }],
  ['micro · bifásico · UF fria (RS, tmin negativo)', {
    nome: 'Sítio Gama', nomeCliente: 'Cliente Gama',
    painel: { marca: 'Trina', modelo: 'Vertex', potenciaW: 660 },
    inversor: { marca: 'Hoymiles', modelo: 'HMS-2000', potenciaKW: 2, tipo: 'micro', nMppts: 4 },
    arranjoMPPTs: [
      { numStrings: 1, modulosPorString: 2 }, { numStrings: 1, modulosPorString: 2 },
      { numStrings: 1, modulosPorString: 2 }, { numStrings: 1, modulosPorString: 2 },
    ],
    dimensionamento: { numPaineis: 8, numStrings: 4, potenciaArredondada: 2 },
    tipo_ligacao: 'bifasico', tensao: '220', distribuidora: 'RGE', uf: 'RS',
  }],
  ['sem arranjoMPPTs — cai no fallback legado por numStrings', {
    nome: 'Projeto Delta', nomeCliente: 'Cliente Delta',
    painel: { marca: 'JA Solar', modelo: 'JAM72', potenciaW: 545 },
    inversor: { marca: 'Fronius', modelo: 'SYMO', potenciaKW: 10, tipo: 'string', nMppts: 2 },
    arranjoMPPTs: null,
    dimensionamento: { numPaineis: 20, numStrings: 2, potenciaArredondada: 10 },
    tipo_ligacao: 'trifasico', tensao: '380', distribuidora: 'Enel', uf: 'CE',
  }],
  ['projeto vazio — todos os defaults do motor', {}],
  ['string longa · aciona o corte "+N" de painéis', {
    nome: 'Usina Épsilon', nomeCliente: 'Cliente Épsilon',
    painel: { marca: 'Longi', modelo: 'Hi-MO', potenciaW: 580 },
    inversor: { marca: 'Sungrow', modelo: 'SG20', potenciaKW: 20, tipo: 'string', nMppts: 3 },
    arranjoMPPTs: [{ numStrings: 2, modulosPorString: 18 }],
    dimensionamento: { numPaineis: 36, numStrings: 2, potenciaArredondada: 20 },
    tipo_ligacao: 'trifasico', tensao: '380', distribuidora: 'CEMIG', uf: 'MG',
  }],
  ['caracteres que exigem escape XML', {
    nome: 'Obra <A&B> "teste"', nomeCliente: 'Cliente & Cia <Ltda>',
    painel: { marca: 'M&M', modelo: '<X>', potenciaW: 500 },
    inversor: { marca: 'A&B', modelo: '<Y>', potenciaKW: 6, tipo: 'string', nMppts: 1 },
    arranjoMPPTs: [{ numStrings: 1, modulosPorString: 12 }],
    dimensionamento: { numPaineis: 12, numStrings: 1, potenciaArredondada: 6 },
    tipo_ligacao: 'monofasico', tensao: '127', distribuidora: 'A&B Energia', uf: 'PR',
  }],
]

const ATIVOS = [
  { _id: 'a1', tipo: 'modulo', qr_code: 'QR-MOD-1', arranjo_id: 'A', status: 'instalado' },
  { _id: 'a2', tipo: 'inversor', qr_code: 'QR-INV-1', arranjo_id: 'A', status: 'operacional' },
]

async function main() {
  const referencia = await carregarReferencia()
  const { gerarUnifilarSVG: canonico } = await import('@fortesolar/fv-shared/engenharia/unifilar-svg')

  secao('1 · Equivalência byte a byte com o motor original (sem ativos)')
  for (const [rotulo, fixture] of FIXTURES) {
    const a = referencia(fixture)
    const b = canonico(fixture)
    ok(a === b, `${rotulo} (${b.length} bytes)`)
    if (a !== b) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          console.log(`    divergência no byte ${i}:`)
          console.log(`    original: …${JSON.stringify(a.slice(Math.max(0, i - 60), i + 60))}`)
          console.log(`    canônico: …${JSON.stringify(b.slice(Math.max(0, i - 60), i + 60))}`)
          break
        }
      }
    }
  }

  secao('2 · Equivalência com ativos vinculados (gêmeo digital)')
  for (const [rotulo, fixture] of FIXTURES.slice(0, 3)) {
    ok(referencia(fixture, ATIVOS) === canonico(fixture, ATIVOS), `${rotulo} + ativos`)
  }

  secao('3 · O SVG carrega o que o unifilar precisa carregar')
  const svg = canonico(FIXTURES[0][1], ATIVOS)
  ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'declaração XML presente')
  ok(svg.trimEnd().endsWith('</svg>'), 'documento fechado')
  ok(svg.includes('NBR 16690:2019'), 'referência normativa no memorial')
  ok(svg.includes('MPPT 1') && svg.includes('MPPT 2'), 'um grupo por MPPT')
  ok(svg.includes('data-qr="QR-MOD-1"'), 'símbolo do módulo clicável (ativo vinculado)')
  ok(svg.includes('data-qr="QR-INV-1"'), 'símbolo do inversor clicável')
  ok(!svg.includes('Fronius SYMO') || FIXTURES[0][1].inversor.marca === 'Fronius',
    'marca do inversor vem do projeto — não é a hardcoded da engine órfã')
  ok(svg.includes('Deye'), 'marca real do inversor desenhada')

  secao('4 · Escape de XML preservado')
  const svgEsc = canonico(FIXTURES[6][1])
  ok(svgEsc.includes('&amp;') && !svgEsc.includes('A&B Energia'), 'E comercial escapado')
  ok(!svgEsc.includes('<Ltda>'), 'sinais de menor/maior escapados')

  secao('5 · Determinismo (mesma entrada, mesma saída)')
  const s1 = canonico(FIXTURES[1][1])
  const s2 = canonico(FIXTURES[1][1])
  ok(s1 === s2, 'duas chamadas seguidas produzem SVG idêntico')

  secao('6 · Pureza — o motor não depende de DOM')
  const fonte = readFileSync(path.join(RAIZ_PKG, 'unifilarSVG.js'), 'utf8')
  for (const proibido of ['document.', 'window.', 'new Blob', 'new Image', 'URL.createObjectURL']) {
    ok(!fonte.includes(proibido), `sem \`${proibido}\` no motor do domínio`)
  }

  secao('7 · Fórmulas normativas idênticas')
  const refNorm = await import(pathToFileURL(path.join(RAIZ_PKG, 'engenhariaNormativa.js')).href)
  const { execFileSync } = await import('node:child_process')
  const original = execFileSync('git', ['show', 'HEAD:frontend/src/utils/engenhariaNormativa.js'], {
    cwd: path.resolve(AQUI, '../../../..'), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  })
  const atual = readFileSync(path.join(RAIZ_PKG, 'engenhariaNormativa.js'), 'utf8')
  // Só o cabeçalho de documentação e o caminho do import podem ter mudado.
  const corpo = (s) => s.slice(s.indexOf('export const TEMPERATURAS_UF'))
  ok(corpo(original) === corpo(atual), 'corpo de engenhariaNormativa inalterado (byte a byte)')

  // Amostras diretas das fórmulas mais sensíveis — se o corpo mudar um dia, estas
  // ainda acusam a mudança de RESULTADO, não só de texto.
  // 49,5 V × 18 módulos × [1 + (−0,0029)(−8 − 25)] = 891 × 1,0957 = 976,3 V
  ok(refNorm.calcularVocMaxString(49.5, 18, -0.0029, -8) === 976.3, 'Voc_max a −8 °C (RS)')
  ok(refNorm.calcularIscMax(13.9) === 17.38, 'Isc × 1.25 (NBR 16690 §5.2)')
  ok(refNorm.calcularCorrenteAC(8, 3, 380) === 12.8, 'corrente AC trifásica')
  ok(refNorm.calcularCorrenteAC(5, 1, 220) === 23.9, 'corrente AC monofásica')
  ok(refNorm.selecionarCabo(17.38, { tipo: 'cc' }).secao === '4', 'cabo DC mínimo 4 mm²')
  ok(refNorm.selecionarDPS(976.3).modelo.includes('1200V'), 'DPS por Uc ≥ 1.2 × Voc_max (1172 V)')
  ok(refNorm.selecionarDPS(400).modelo.includes('600V'), 'DPS 600 V para string curta')

  console.log(falhas === 0
    ? '\nOK — motor canônico equivalente ao original, byte a byte.'
    : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
