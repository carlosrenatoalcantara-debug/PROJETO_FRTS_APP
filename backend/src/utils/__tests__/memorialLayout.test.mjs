/**
 * BUG-023 — VALIDAÇÃO GEOMÉTRICA DA DIAGRAMAÇÃO.
 *
 * Contar páginas não prova nada sobre qualidade editorial: um documento pode caber em 2
 * páginas e estar todo sobreposto. Estes testes extraem a POSIÇÃO REAL de cada texto do
 * PDF (pdf.js) e verificam por geometria exatamente o que o lote exige:
 *
 *   • ausência de sobreposição  → nenhum par de textos com caixas cruzadas
 *   • ausência de texto cortado → nome/endereço longos aparecem íntegros
 *   • ausência de invasão       → nada ultrapassa as margens da folha
 *   • paginação                 → no máximo 2 páginas, em todos os cenários
 *
 * Cenários obrigatórios do lote: mono, tri, com/sem limitação, nome longo, razão social
 * longa, endereço longo.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import PDFDocument from 'pdfkit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { desenharMemorialDescritivo } from '../gerarMemorialDescritivo.js'
import { derivarEspecificacaoEV } from '@fortesolar/diagram-engine/adapters/especificacao-ev'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const PDFJS = pathToUrl(path.resolve(AQUI, '../../../../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs'))
function pathToUrl(p) { return `file:///${p.replace(/\\/g, '/')}` }

const MARGEM = 26
const A4 = { W: 595.28, H: 841.89 }

const baseCliente = {
  nome: 'Azevedo Hamilton Pereira da Silva', cpf_cnpj: '123.456.789-00',
  email: 'azevedo.hamilton@exemplo.com.br', telefone: '(84) 99999-1234',
  distribuidora: 'Neoenergia Cosern', numero_cliente: '0012345678',
  endereco_completo: 'RUA DESEMBARGADOR TULIO BEZERRA DE MELO, 3700, AP-2201, Capim Macio, Natal/RN',
  cep: '59078-590', cidade: 'Natal', estado: 'RN',
  classificacao: 'Residencial', subgrupo: 'B1', tipo_ligacao: 'Trifásico',
  carga_instalada_kw: 17, disjuntor_geral_a: 32,
}
const tecnicoPadrao = { nome: 'Carlos Renato Aquino de Alcantara', cft: '03501905424' }

function projetoDe({ fases, limitado, cliente = {}, projetoNome, tecnico = tecnicoPadrao }) {
  const tri = fases === 3
  const carregador = {
    marca: 'Livoltek', modelo: 'A0220400E11', tipo: tri ? 'AC_Tri' : 'AC_Mono',
    potencia_kw: tri ? 22 : 7.4, tensao_entrada_v: tri ? 380 : 220,
    numero_fases: fases, corrente_entrada_a: 32, tipo_conector: '2',
  }
  const calculos_nbr = {
    corrente_projeto_a: 32, corrente_maxima_a: 40, bitola_cabo_mm2: 10, disjuntor_a: 40,
    dr_ma: 30, dps_kv: tri ? 420 : 275, queda_tensao_pct: 0.36,
    capacidade_cabo_a: 50, tempo_seccionamento_s: 0.2,
  }
  const c = { ...baseCliente, ...cliente }
  return {
    nome: projetoNome || 'Livotek 22k - AP 2201 - Mirante das Dunas',
    endereco_completo: c.endereco_completo, comprimento_cabo_m: 25,
    carregadores: [carregador], calculos_nbr, clienteId: c, tecnico, corrente_aferida_a: 6,
    limitacao_operacao: limitado ? { habilitado: true, modo: 'potencia', potencia_max_kw: tri ? 11 : 4 } : { habilitado: false },
    especificacao: derivarEspecificacaoEV({ calculos: calculos_nbr, carregador, comprimento_cabo_m: 25 }),
  }
}

function render(projeto) {
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
  const chunks = []
  doc.on('data', c => chunks.push(c))
  return new Promise((res) => {
    doc.on('end', () => res(Buffer.concat(chunks)))
    desenharMemorialDescritivo(doc, projeto, projeto.clienteId, null)
    doc.end()
  })
}

/** Caixas de todos os textos, por página, em coordenadas do PDF. */
async function caixasPorPagina(buf) {
  const pdfjs = await import(PDFJS)
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise
  const paginas = []
  for (let n = 1; n <= doc.numPages; n++) {
    const tc = await (await doc.getPage(n)).getTextContent()
    paginas.push(tc.items
      .filter(i => i.str.trim())
      .map(i => ({
        str: i.str,
        x: i.transform[4],
        // pdf.js dá a BASE da linha; a caixa vai da base até base+altura.
        y: i.transform[5] - i.height * 0.22,
        w: i.width,
        h: i.height,
      })))
  }
  return paginas
}

const cruzam = (a, b) => {
  const F = 0.30 // folga: glifos vizinhos na mesma linha encostam por antialiasing/kerning
  return a.x + a.w - F > b.x + F && b.x + b.w - F > a.x + F
      && a.y + a.h - F > b.y + F && b.y + b.h - F > a.y + F
}

const CENARIOS = [
  ['monofásico sem limitação', { fases: 1, limitado: false }],
  ['monofásico COM limitação', { fases: 1, limitado: true }],
  ['trifásico sem limitação', { fases: 3, limitado: false }],
  ['trifásico COM limitação', { fases: 3, limitado: true }],
  ['nome de cliente longo', { fases: 3, limitado: true, cliente: { nome: 'Azevedo Hamilton Pereira da Silva Nogueira de Albuquerque Filho Junior' } }],
  ['razão social longa', { fases: 3, limitado: true, cliente: {
    nome: 'RN Borrachas Artefatos de Borracha e Plásticos Industriais do Nordeste Ltda ME',
    cpf_cnpj: '12.345.678/0001-99', email: 'financeiro.contas@rnborrachasartefatos.com.br' } }],
  ['endereço longo', { fases: 3, limitado: true,
    projetoNome: 'Condomínio Residencial Mirante das Dunas — Torre Sul, Apto 2201, Vaga 118 (Wallbox)',
    tecnico: { nome: 'Carlos Renato Aquino de Alcantara Nogueira Junior', crea: 'RN-123456789' },
    cliente: { nome: 'RN Borrachas Artefatos de Borracha e Plásticos Ltda',
      endereco_completo: 'AVENIDA DESEMBARGADOR TULIO BEZERRA DE MELO, 3700, BLOCO B, APARTAMENTO 2201, VAGA DE GARAGEM 118, CAPIM MACIO, NATAL / RIO GRANDE DO NORTE, CEP 59078-590' } }],
]

for (const [nome, args] of CENARIOS) {
  test(`BUG-023: sem sobreposição e dentro da folha — ${nome}`, async () => {
    const paginas = await caixasPorPagina(await render(projetoDe(args)))

    // Paginação: até 2 páginas (regra nova do BUG-023, que substitui a de 1 página).
    assert.ok(paginas.length <= 2, `memorial usou ${paginas.length} páginas`)

    paginas.forEach((itens, p) => {
      for (const it of itens) {
        // Nada pode vazar a folha nem invadir as margens.
        assert.ok(it.x >= MARGEM - 1, `p${p + 1}: "${it.str}" começa fora da margem (x=${it.x.toFixed(1)})`)
        assert.ok(it.x + it.w <= A4.W - MARGEM + 2, `p${p + 1}: "${it.str}" ultrapassa a margem direita (x2=${(it.x + it.w).toFixed(1)})`)
        assert.ok(it.y + it.h <= A4.H - 8, `p${p + 1}: "${it.str}" vaza o rodapé`)
      }
      // Sobreposição: nenhum par de textos pode ter as caixas cruzadas.
      for (let i = 0; i < itens.length; i++) {
        for (let j = i + 1; j < itens.length; j++) {
          assert.ok(!cruzam(itens[i], itens[j]),
            `p${p + 1}: "${itens[i].str}" sobrepõe "${itens[j].str}"`)
        }
      }
    })
  })
}

test('BUG-023: textos longos saem ÍNTEGROS (nada é cortado para caber)', async () => {
  const cliente = { nome: 'RN Borrachas Artefatos de Borracha e Plásticos Industriais do Nordeste Ltda ME' }
  const paginas = await caixasPorPagina(await render(projetoDe({ fases: 3, limitado: true, cliente })))
  const texto = paginas.flat().map(i => i.str).join(' ').replace(/\s+/g, ' ')
  // O nome quebra em várias linhas (regra de quebra) — todas as palavras têm de estar lá.
  for (const palavra of ['Borrachas', 'Artefatos', 'Plásticos', 'Industriais', 'Nordeste', 'Ltda']) {
    assert.ok(texto.includes(palavra), `palavra "${palavra}" sumiu do documento`)
  }
})

test('BUG-023 (item 2): Características Gerais usa a corrente CONFIGURADA quando limitado', async () => {
  const paginas = await caixasPorPagina(await render(projetoDe({ fases: 3, limitado: true })))
  const texto = paginas.flat().map(i => i.str).join(' ').replace(/\s+/g, ' ')
  // 11 kW limitados em 380 V tri → ~17,6 A. A nominal (32 A) não pode figurar como
  // "Corrente" da faixa: o par exibido tem de ser coerente com o dimensionamento.
  assert.match(texto, /Corrente/)
  assert.match(texto, /17,59 A/)
  assert.match(texto, /11 kW/)
})
