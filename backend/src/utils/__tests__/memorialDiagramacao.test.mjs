/**
 * BUG-022 — DIAGRAMAÇÃO do PDF Executivo.
 *
 * Trava o objetivo do lote: o Memorial cabe em UMA página e o PDF Executivo tem
 * EXATAMENTE DUAS (Memorial + Unifilar), em todos os cenários homologados. O conteúdo
 * técnico não é testado aqui (isso é do BUG-021) — só a paginação.
 *
 * O que quebrou antes: a seção de Limitação de Operação (BUG-021.6) e os condutores por
 * identidade (BUG-021.3) aumentaram o texto, e a diagramação não foi reorganizada — o
 * Memorial passava a estourar para 3 páginas quando havia limitação.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import PDFDocument from 'pdfkit'
import { desenharMemorialDescritivo } from '../gerarMemorialDescritivo.js'
import { derivarEspecificacaoEV } from '@fortesolar/diagram-engine/adapters/especificacao-ev'

const cliente = {
  nome: 'Azevedo Hamilton Pereira da Silva', cpf_cnpj: '123.456.789-00',
  distribuidora: 'Neoenergia Cosern', numero_cliente: '0012345678',
  endereco_completo: 'RUA DESEMBARGADOR TULIO BEZERRA DE MELO, 3700, AP-2201, Capim Macio, Natal/RN',
  carga_instalada_kw: 25, disjuntor_geral_a: 63,
}
const tecnico = { nome: 'Carlos Renato Aquino de Alcantara', cft: '03501905424' }

function projetoDe({ fases, limitado, longo = false }) {
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
  const c = longo
    ? { ...cliente,
      nome: 'Azevedo Hamilton Pereira da Silva Nogueira de Albuquerque Filho',
      endereco_completo: 'RUA DESEMBARGADOR TULIO BEZERRA DE MELO, 3700, BLOCO B, APARTAMENTO 2201, VAGA 118, CAPIM MACIO, NATAL / RIO GRANDE DO NORTE, CEP 59078-590' }
    : cliente
  return {
    nome: longo ? 'Condomínio Residencial Mirante das Dunas — Torre Sul, Apartamento 2201, Vaga 118' : 'Projeto EV',
    endereco_completo: c.endereco_completo, comprimento_cabo_m: 25,
    carregadores: [carregador], calculos_nbr, clienteId: c, tecnico, corrente_aferida_a: 18,
    limitacao_operacao: limitado
      ? { habilitado: true, modo: 'potencia', potencia_max_kw: tri ? 7 : 4, corrente_max_a: null }
      : { habilitado: false },
    especificacao: derivarEspecificacaoEV({ calculos: calculos_nbr, carregador, comprimento_cabo_m: 25 }),
  }
}

/** Desenha só o memorial e devolve quantas páginas ele ocupou. */
function paginasDoMemorial(projeto) {
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
  let paginas = 1
  doc.on('pageAdded', () => { paginas++ })
  doc.on('data', () => {})
  desenharMemorialDescritivo(doc, projeto, projeto.clienteId, null)
  doc.end()
  return paginas
}

const cenarios = [
  ['monofásico sem limitação', { fases: 1, limitado: false }],
  ['monofásico COM limitação', { fases: 1, limitado: true }],
  ['trifásico sem limitação',  { fases: 3, limitado: false }],
  ['trifásico COM limitação',  { fases: 3, limitado: true }],
  ['trifásico COM limitação + nomes/endereço longos', { fases: 3, limitado: true, longo: true }],
]

for (const [nome, args] of cenarios) {
  test(`BUG-022: Memorial cabe em UMA página — ${nome}`, () => {
    assert.equal(paginasDoMemorial(projetoDe(args)), 1)
  })
}
