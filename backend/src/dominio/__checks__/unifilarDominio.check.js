/**
 * unifilarDominio.check.js — FV-DOM-007B
 *
 * O motor foi provado equivalente em `unifilarEquivalencia.check.js`. Aqui se
 * verifica a peça NOVA: o adapter que traduz o documento persistido para a
 * entrada do motor.
 *
 * É a peça que muda o desenho — e por isso a que precisa de mais atenção. Antes
 * dela, o motor recebia o documento cru, não achava nenhum campo que procurava,
 * e desenhava os DEFAULTS: 550 W, 5 kW, 1 MPPT, monofásico 220 V, 6 módulos.
 *
 *   node backend/src/dominio/__checks__/unifilarDominio.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { adaptarProjetoParaUnifilar, gerarUnifilarDoProjeto } from '../unifilar/index.js'
import { gerarUnifilarSVG } from '@fortesolar/fv-shared/engenharia/unifilar-svg'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

/** Projeto no formato PERSISTIDO (snake_case, aninhado) — como vem do Mongo. */
const PROJETO = {
  _id: '000000000000000000000001',
  nome: 'Usina Validação',
  clienteId: { nome: 'Cliente Validação' },
  distribuidora: 'Neoenergia Cosern',
  localizacao: { cidade: 'Natal', estado: 'RN' },
  fatura_extracao: { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Cosern' },
  equipamentos: {
    paineis: [{ id: 'dah_550', marca: 'DAH', modelo: 'DHN-550', potencia_w: 550, quantidade: 26 }],
    inversor: { marca: 'Deye', modelo: 'SUN-8K-G03', potencia_kw: 8, tipo: 'string', fases: 3 },
  },
  dimensionamento: { potencia_kwp: 14.3, num_paineis: 26, num_strings: 3, num_inversores: 1 },
  engenharia_eletrica: {
    arranjo: {
      num_mppts_usados: 2,
      mppts: [
        { mppt: 1, strings_paralelo: 2, modulos_por_string: 9 },
        { mppt: 2, strings_paralelo: 1, modulos_por_string: 8 },
      ],
    },
  },
}

const VAZIO = { _id: 'x', nome: 'Projeto Novo' }

function main() {
  secao('1 · Tradução snake_case → entrada do motor')
  const { entrada, proveniencia } = adaptarProjetoParaUnifilar(PROJETO)
  ok(entrada.painel?.potenciaW === 550, 'potencia_w → potenciaW')
  ok(entrada.inversor?.potenciaKW === 8, 'potencia_kw → potenciaKW')
  ok(entrada.dimensionamento.numPaineis === 26, 'num_paineis → numPaineis')
  ok(entrada.dimensionamento.numStrings === 3, 'num_strings → numStrings')
  ok(entrada.dimensionamento.potenciaArredondada === 14.3, 'potencia_kwp → potenciaArredondada')
  ok(entrada.tipo_ligacao === 'Trifásico', 'ligação vem de fatura_extracao')
  ok(entrada.tensao === '380', 'tensão vem de fatura_extracao, como string')
  ok(entrada.uf === 'RN', 'UF vem de localizacao.estado')
  ok(entrada.nomeCliente === 'Cliente Validação', 'cliente populado')

  secao('2 · Topologia MPPT preservada (contagem, não entradas)')
  ok(entrada.arranjoMPPTs?.length === 2, 'dois MPPTs')
  ok(entrada.arranjoMPPTs[0].numStrings === 2 && entrada.arranjoMPPTs[0].modulosPorString === 9, 'MPPT 1: 2×9')
  ok(entrada.arranjoMPPTs[1].numStrings === 1 && entrada.arranjoMPPTs[1].modulosPorString === 8, 'MPPT 2: 1×8')
  ok(entrada.inversor.nMppts === 2, 'nMppts do arranjo confirmado pela engenharia')

  secao('3 · Proveniência declarada para cada campo (M-3)')
  ok(proveniencia.painel === 'equipamentos.paineis[0]', 'painel')
  ok(proveniencia.inversor === 'equipamentos.inversor', 'inversor')
  ok(proveniencia.arranjoMPPTs === 'engenharia_eletrica.arranjo.mppts', 'arranjo')
  ok(proveniencia.tipo_ligacao === 'fatura_extracao.tipo_ligacao', 'ligação')
  ok(proveniencia.uf === 'localizacao.estado', 'UF')
  ok(Object.values(proveniencia).every((v) => v === null || typeof v === 'string'),
    'toda proveniência é caminho de campo ou null')

  secao('4 · Projeto vazio: defaults ficam VISÍVEIS, não silenciosos')
  const r = gerarUnifilarDoProjeto(VAZIO)
  ok(r.lacunas.includes('painel'), 'painel ausente declarado como lacuna')
  ok(r.lacunas.includes('inversor'), 'inversor ausente declarado como lacuna')
  ok(r.lacunas.includes('uf'), 'UF ausente declarada como lacuna')
  /**
   * FV-DOM-056 — contrato REVOGADO. Até esta sprint, um projeto vazio ainda
   * produzia um diagrama: as lacunas eram declaradas, mas o desenho saía com os
   * defaults do motor. A FV-QA-055 mostrou aonde isso leva (T07/T09: Voc de
   * 3933 V num inversor de 1000 V), e agora a ausência de topologia recusa o
   * desenho em vez de preenchê-lo. As lacunas acima continuam sendo declaradas.
   */
  ok(r.svg === null, 'projeto vazio NÃO gera diagrama (FV-DOM-056)')
  ok(r.impedimento?.codigo === 'TOPOLOGIA_AUSENTE',
    `e declara o motivo: ${r.impedimento?.codigo}`)
  const { proveniencia: pv } = adaptarProjetoParaUnifilar(VAZIO)
  ok(pv.inversor === null,
    'subdocumento `equipamentos.inversor` vazio NÃO conta como fonte')

  secao('5 · O desenho descreve o projeto — não a engine órfã')
  const cheio = gerarUnifilarDoProjeto(PROJETO)
  ok(cheio.svg.includes('Deye'), 'marca real do inversor')
  ok(cheio.svg.includes('SUN-8K-G03'), 'modelo real do inversor')
  ok(!cheio.svg.includes('Fronius SYMO'), 'sem a marca hardcoded da engine antiga')
  ok(cheio.svg.includes('MPPT 1') && cheio.svg.includes('MPPT 2'), 'dois grupos MPPT desenhados')
  ok(cheio.svg.includes('3Ø 380V'), 'ligação trifásica desenhada')
  ok(cheio.lacunas.length === 0, 'projeto completo não tem lacuna')

  secao('6 · Especificações batem com o desenho')
  const e = cheio.especificacoes
  ok(e.num_paineis === 26, `26 módulos (${e.num_paineis})`)
  ok(e.num_strings === 3, `3 strings (${e.num_strings})`)
  ok(e.num_mppts === 2, `2 MPPTs (${e.num_mppts})`)
  ok(e.potencia_cc_kwp === 14.3, `14,3 kWp (${e.potencia_cc_kwp})`)
  ok(e.fases === 3 && e.tensao_ac_v === 380, 'trifásico 380 V')
  ok(cheio.svg.includes(`${e.voc_max_v}V`), 'Voc_max das especificações aparece no SVG')
  ok(Number(e.cabo_dc_mm2) >= 4, `cabo DC ≥ 4 mm² (${e.cabo_dc_mm2})`)

  secao('7 · A UF muda o resultado elétrico (Tmin → Voc_max)')
  const rn = gerarUnifilarDoProjeto(PROJETO).especificacoes.voc_max_v
  const rs = gerarUnifilarDoProjeto({
    ...PROJETO, localizacao: { estado: 'RS' },
  }).especificacoes.voc_max_v
  ok(rs > rn, `RS (tmin −8 °C) produz Voc_max maior que RN: ${rs} > ${rn}`)

  secao('8 · Precedência: clima da engenharia elétrica vence a localização')
  const comClima = adaptarProjetoParaUnifilar({
    ...PROJETO,
    engenharia_eletrica: { ...PROJETO.engenharia_eletrica, clima_utilizado: { uf: 'MG' } },
  })
  ok(comClima.entrada.uf === 'MG', 'usa a UF que a análise elétrica de fato usou')
  ok(comClima.proveniencia.uf === 'engenharia_eletrica.clima_utilizado.uf', 'e declara isso')

  secao('9 · Determinismo e ausência de persistência')
  const a = gerarUnifilarDoProjeto(PROJETO).svg
  const b = gerarUnifilarDoProjeto(PROJETO).svg
  ok(a === b, 'mesma entrada, mesmo SVG')
  const fonteDominio = readFileSync(path.resolve(AQUI, '../unifilar/index.js'), 'utf8')
    + readFileSync(path.resolve(AQUI, '../unifilar/adaptarProjeto.js'), 'utf8')
  for (const proibido of ['save(', 'updateOne', 'findOneAndUpdate', 'insertMany']) {
    ok(!fonteDominio.includes(proibido), `domínio não persiste (\`${proibido}\` ausente) — INV-58`)
  }
  ok(!fonteDominio.includes("from 'mongoose'"), 'domínio do unifilar não importa mongoose')

  secao('10 · A rota canônica não é a engine órfã')
  const ctrl = readFileSync(path.resolve(AQUI, '../../controllers/projetosFVController.js'), 'utf8')
  // Recorta do início do handler até a próxima declaração de topo — delimitar
  // por `\n}\n` pegaria o primeiro bloco interno, não o fim da função.
  const inicio = ctrl.indexOf('export const gerarUnifilarProjeto')
  const resto = ctrl.slice(inicio + 10)
  const fim = resto.search(/\n(export const|\/\*\*\n \* POST|\/\/ ═)/)
  const trecho = ctrl.slice(inicio, fim > 0 ? inicio + 10 + fim : ctrl.length)
  ok(!trecho.includes('Fronius SYMO'), 'marca hardcoded removida da rota')
  ok(!trecho.includes("tensao_rede: 'trifasico'"), 'trifásico fixo removido da rota')
  ok(!trecho.includes('unifilarController.js'), 'rota não delega mais à engine órfã')
  ok(trecho.includes('gerarUnifilarDoProjeto'), 'rota usa o motor canônico')
  ok(trecho.includes('proveniencia'), 'rota devolve proveniência')

  secao('11 · O motor continua puro — o domínio não o alterou')
  const direto = gerarUnifilarSVG(adaptarProjetoParaUnifilar(PROJETO).entrada)
  ok(direto === cheio.svg, 'gerarUnifilarDoProjeto = adapter + motor, sem etapa oculta')

  console.log(falhas === 0
    ? '\nOK — adapter fiel ao documento persistido, defeitos visíveis, sem persistência.'
    : `\n${falhas} FALHA(S).`)
  process.exit(falhas === 0 ? 0 : 1)
}

main()
