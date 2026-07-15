/**
 * BUGFIX — Disponibilidade Elétrica x Limitação de Operação.
 *
 * A seção "Verificação da Disponibilidade Elétrica" somava a corrente NOMINAL do
 * carregador mesmo quando o circuito estava LIMITADO. No caso real (Livoltek 22 kW
 * limitado a 11 kW, 6 A aferidos) isso produzia "6 + 32 = 38 A" e ainda afirmava, no
 * mesmo parágrafo, que 38 A permanecia "inferior" ao disjuntor de 32 A — falso. Com o
 * valor configurado (16,71 A) o previsto é 22,71 A, coerente com o disjuntor limitado.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import PDFDocument from 'pdfkit'
import { PDFParse } from 'pdf-parse'
import { desenharMemorialDescritivo } from '../gerarMemorialDescritivo.js'
import { derivarEspecificacaoEV } from '@fortesolar/diagram-engine/adapters/especificacao-ev'

function projeto({ limitado }) {
  const carregador = {
    marca: 'Livoltek', modelo: 'A0220400E11', tipo: 'AC_Tri',
    potencia_kw: 22, tensao_entrada_v: 380, numero_fases: 3, corrente_entrada_a: 32, tipo_conector: '2',
  }
  const calculos_nbr = {
    corrente_projeto_a: 16.71, corrente_maxima_a: 21, bitola_cabo_mm2: 4, disjuntor_a: 20,
    dr_ma: 30, dps_kv: 420, queda_tensao_pct: 0.5, capacidade_cabo_a: 28, tempo_seccionamento_s: 0.2,
  }
  const cliente = {
    nome: 'Cliente Teste', cpf_cnpj: '000', distribuidora: 'COSERN', numero_cliente: '1',
    endereco_completo: 'Natal/RN', carga_instalada_kw: 17, disjuntor_geral_a: 32,
  }
  return {
    nome: 'Livoltek 22k limitado', endereco_completo: 'Natal/RN', comprimento_cabo_m: 25,
    carregadores: [carregador], calculos_nbr, clienteId: cliente,
    tecnico: { nome: 'RT', cft: '1' }, corrente_aferida_a: 6,
    especificacao: derivarEspecificacaoEV({ calculos: calculos_nbr, carregador, comprimento_cabo_m: 25 }),
    limitacao_operacao: limitado
      ? { habilitado: true, modo: 'potencia', potencia_max_kw: 11, corrente_max_a: null }
      : { habilitado: false },
  }
}

async function textoMemorial(p) {
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 })
  const chunks = []
  doc.on('data', c => chunks.push(c))
  await new Promise((res) => { doc.on('end', res); desenharMemorialDescritivo(doc, p, p.clienteId, null); doc.end() })
  const r = await new PDFParse({ data: new Uint8Array(Buffer.concat(chunks)) }).getText()
  return r.text.replace(/\s+/g, ' ')
}

test('COM limitação: previsão de fase usa a corrente CONFIGURADA e a frase fica coerente', async () => {
  const t = await textoMemorial(projeto({ limitado: true }))
  // Rótulo deixa de dizer "nominal" (32 A não é o que o circuito limitado puxa).
  assert.match(t, /corrente configurada do carregador \(operação limitada\) \(([\d,]+) A\)/)
  // A soma nominal errada (6 + 32 = 38 A) NÃO pode aparecer.
  assert.doesNotMatch(t, /será de 38 A/)
  // Relacional (sem acoplar à fórmula de conversão kW→A): previsto = aferida + configurada
  // e, sendo o carregador limitado, previsto < disjuntor geral (32 A) → frase verdadeira.
  const conf = Number(t.match(/operação limitada\) \(([\d,]+) A\)/)[1].replace(',', '.'))
  const prev = Number(t.match(/será de ([\d,]+) A/)[1].replace(',', '.'))
  assert.ok(Math.abs(prev - (6 + conf)) < 0.02, `previsto ${prev} != 6 + ${conf}`)
  assert.ok(conf < 32, 'a corrente configurada tem de ser menor que a nominal (32 A)')
  assert.ok(prev < 32, 'o previsto tem de ser inferior ao disjuntor geral (32 A) — "permanecendo inferior"')
})

test('SEM limitação: mantém a corrente NOMINAL (comportamento original preservado)', async () => {
  const t = await textoMemorial(projeto({ limitado: false }))
  assert.match(t, /corrente nominal do carregador \(32 A\)/)
  assert.match(t, /prevista na fase após a utilização do carregador será de 38 A/) // 6 + 32
})
