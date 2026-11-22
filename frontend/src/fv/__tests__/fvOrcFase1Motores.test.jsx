/**
 * FV-ORC-000 Fase 1 — testes golden dos motores da proposta de grupo.
 *
 * Valores-alvo: proposta de 8 páginas do "Cliente B" (ampliação, RN), feita fora
 * do sistema. Fixture anonimizada: o histórico mensal é SINTÉTICO, montado para
 * reproduzir as referências impressas (média 10.009; penúltimo 15.048; último
 * 18.518). Dados elétricos do módulo/inversor são sintéticos e plausíveis.
 */
import { describe, it, expect } from 'vitest'
import {
  produtividadeMensal, estatisticaConsumo, compararOpcoes,
} from '@fortesolar/fv-shared/financeiro/comparativo-energetico'
import {
  precificarOpcao, parcelarPagamento, paraCentavos, MODO_PACOTE, CATEGORIA, PAGADOR,
} from '@fortesolar/fv-shared/financeiro/precificacao-opcao'
import {
  sugerirDistribuicaoStrings, STATUS_DISTRIBUICAO,
} from '@fortesolar/fv-shared/engenharia/distribuicao-strings'

import { eficienciaUsada } from '../../utils/eficienciaPadrao'

describe('eficienciaUsada (D1)', () => {
  it('igual ao padrão da empresa → configurado; diferente → manual', () => {
    expect(eficienciaUsada(25, 25)).toEqual({ performance_ratio: 0.75, performance_ratio_origem: 'configurado' })
    expect(eficienciaUsada(20, 25)).toEqual({ performance_ratio: 0.8, performance_ratio_origem: 'manual' })
    expect(eficienciaUsada(22, null)).toEqual({ performance_ratio: 0.78, performance_ratio_origem: 'manual' })
  })
  it('perdas inválidas não geram número', () => {
    for (const v of [null, '', 'x', -1, 100]) {
      expect(eficienciaUsada(v, 25)).toEqual({ performance_ratio: null, performance_ratio_origem: null })
    }
  })
})

// 10 meses somando 86.542 + 15.048 + 18.518 = 120.108 → média 10.009 exata.
const HISTORICO = [
  ...Array.from({ length: 8 }, (_, i) => ({ mes: `m${i + 1}`, kwh: 8654 })),
  { mes: 'm9', kwh: 8655 }, { mes: 'm10', kwh: 8655 },
  { mes: 'set/26', kwh: 15048 }, { mes: 'out/26', kwh: 18518 },
]
const PROD = 130
const CREDITO_GD = 3395.75

const ref = (op, chave) => op.comparacoes.find((c) => c.chave === chave)
const um = (v) => Math.round(v * 10) / 10

describe('comparativoEnergetico', () => {
  it('produtividade = HSP × 30 × eficiência; entrada inválida → null', () => {
    expect(produtividadeMensal({ hsp: 5.78, eficiencia: 0.75 })).toBeCloseTo(130.05, 2)
    expect(produtividadeMensal({ hsp: 5.78, eficiencia: 1.2 })).toBeNull()
    expect(produtividadeMensal({ hsp: 0, eficiencia: 0.8 })).toBeNull()
    expect(produtividadeMensal({ hsp: '', eficiencia: 0.8 })).toBeNull()
  })

  it('estatística: média, dois últimos, variação e média dos últimos', () => {
    const e = estatisticaConsumo(HISTORICO)
    expect(e.meses).toBe(12)
    expect(e.media_kwh).toBe(10009)
    expect(e.ultimos.map((m) => m.kwh)).toEqual([15048, 18518])
    expect(um(e.ultimos[0].variacao_pct)).toBe(50.3)
    expect(um(e.ultimos[1].variacao_pct)).toBe(85.0)
    expect(e.media_ultimos_kwh).toBe(16783)
    expect(um(e.media_ultimos_variacao_pct)).toBe(67.7)
    expect(e.maiores.map((m) => m.kwh)).toEqual([18518, 15048])
    expect(e.lacunas).toEqual([])
  })

  it('golden — três opções com crédito GD contado uma vez', () => {
    const r = compararOpcoes({
      historico: HISTORICO, produtividadeKwhKwpMes: PROD, creditoExistenteKwh: CREDITO_GD,
      opcoes: [
        { id: 'tv', potencia_kwp: 178 * 0.62 },      // 110,36 kWp
        { id: 'lumea', potencia_kwp: 177 * 0.625 },  // 110,625 kWp
        { id: 'alumifix', potencia_kwp: 82 * 0.615 },// 50,43 kWp
      ],
    })
    const [tv, lumea, alu] = r.opcoes

    expect(Math.round(tv.geracao_nova_kwh)).toBe(14347)
    expect(Math.round(tv.total_kwh)).toBe(17743)
    expect(um(tv.cobertura_media_pct)).toBe(177.3)
    expect(Math.round(ref(tv, 'ultimo_2').excedente_kwh)).toBe(2695)   // set/26
    expect(Math.round(ref(tv, 'ultimo_1').deficit_kwh)).toBe(775)      // out/26
    expect(um(ref(tv, 'ultimo_1').kwp_adicional)).toBe(6.0)
    expect(ref(tv, 'media').kwp_adicional).toBe(0)
    expect(ref(tv, 'media_ultimos').kwp_adicional).toBe(0)

    expect(Math.round(lumea.total_kwh)).toBe(17777)
    expect(Math.round(ref(lumea, 'ultimo_1').deficit_kwh)).toBe(741)
    expect(um(ref(lumea, 'ultimo_1').kwp_adicional)).toBe(5.7)

    expect(Math.round(alu.geracao_nova_kwh)).toBe(6556)
    expect(Math.round(alu.total_kwh)).toBe(9952)
    expect(um(alu.cobertura_media_pct)).toBe(99.4)
    // O PDF imprimiu "cerca de 58 kWh" (média real não inteira); com média 10.009 exata dá 57,35.
    expect(ref(alu, 'media').deficit_kwh).toBeCloseTo(57.35, 2)
    expect(um(ref(alu, 'media').kwp_adicional)).toBe(0.4)
    expect(um(ref(alu, 'media_ultimos').kwp_adicional)).toBe(52.5)
    expect(um(ref(alu, 'ultimo_2').kwp_adicional)).toBe(39.2)
    expect(um(ref(alu, 'ultimo_1').kwp_adicional)).toBe(65.9)
    expect(Math.round(ref(alu, 'ultimo_2').deficit_kwh)).toBe(5096)
    expect(Math.round(ref(alu, 'ultimo_1').deficit_kwh)).toBe(8566)
  })

  it('usina nova: sem crédito, geração = só o kit (D3)', () => {
    const r = compararOpcoes({
      historico: HISTORICO, produtividadeKwhKwpMes: PROD, opcoes: [{ id: 'a', potencia_kwp: 10 }],
    })
    expect(r.credito_existente_kwh).toBe(0)
    expect(r.opcoes[0].total_kwh).toBe(1300)
  })

  it('sem produtividade: geração null e lacuna — nunca zero', () => {
    const r = compararOpcoes({ historico: HISTORICO, produtividadeKwhKwpMes: null, opcoes: [{ potencia_kwp: 10 }] })
    expect(r.opcoes[0].total_kwh).toBeNull()
    expect(r.opcoes[0].comparacoes[0].deficit_kwh).toBeNull()
    expect(r.lacunas.join(' ')).toMatch(/Produtividade/)
  })

  it('histórico curto ou com mês inválido declara lacuna', () => {
    const e = estatisticaConsumo([{ mes: 'a', kwh: 100 }, { mes: 'b', kwh: null }])
    expect(e.media_kwh).toBe(100)
    expect(e.lacunas.length).toBe(2)
    expect(estatisticaConsumo([]).media_kwh).toBeNull()
  })
})

// ── Preço ──────────────────────────────────────────────────────────────────
const POLITICA = {
  extra_estrutura_r_por_modulo: { Solo: 125, Laje: 25 },
  pagador_extra_estrutura: PAGADOR.FORTE_SOLAR,
  pagamento: {
    entrada_r: 1000,
    marcos: [
      { descricao: 'Após entrega dos equipamentos', pct: 50 },
      { descricao: 'Ao término da instalação', pct: 50 },
    ],
  },
}
// O % do PDF saiu de uma referência: R$ 36.000 sobre (79.258,02 + 11.000).
const PCT_REFERENCIA = (36000 / (79258.02 + 11000)) * 100

describe('precificacaoOpcao', () => {
  it('centavos: meio para cima sem erro binário', () => {
    expect(paraCentavos(1.005)).toBe(101)
    expect(paraCentavos(0.1 + 0.2)).toBe(30)
    expect(paraCentavos('x')).toBeNull()
  })

  it('golden — opção TV: kit + solo + pacote %, parcelas', () => {
    const r = precificarOpcao({
      valorKitR: 156571.66, quantidadeModulos: 178, tipoEstrutura: 'Solo',
      politica: { ...POLITICA, pacote_pct: PCT_REFERENCIA },
    })
    expect(r.lacunas).toEqual([])
    expect(r.linhas.map((l) => [l.categoria, l.valor_r])).toEqual([
      [CATEGORIA.KIT, 156571.66],
      [CATEGORIA.ESTRUTURA_EXTRA, 22250],
      [CATEGORIA.PACOTE_FORTE_SOLAR, 71324.19],
    ])
    expect(r.total_r).toBe(250145.85)
    expect(r.memoria.modo_pacote).toBe(MODO_PACOTE.PERCENTUAL)
    expect(r.pagamento.parcelas.map((p) => p.valor_r)).toEqual([1000, 35162.10, 35162.09])
  })

  it('opção Lumea: pacote reproduz o PDF; parcelas seguem a regra única', () => {
    const pct = (36000 / (80125.58 + 11000)) * 100
    const r = precificarOpcao({
      valorKitR: 154137.97, quantidadeModulos: 177, tipoEstrutura: 'Solo',
      politica: { ...POLITICA, pacote_pct: pct },
    })
    expect(r.linhas[1].valor_r).toBe(22125)
    expect(r.linhas[2].valor_r).toBe(69634.31)
    // O PDF imprimiu 34.317,15 / 34.317,16 (invertido em relação à opção TV).
    // Regra única: intermediária meio para cima, última absorve o centavo.
    expect(r.pagamento.parcelas.map((p) => p.valor_r)).toEqual([1000, 34317.16, 34317.15])
  })

  it('golden — opção Alumifix: pacote FIXO declarado na memória', () => {
    const r = precificarOpcao({
      valorKitR: 77554.60, quantidadeModulos: 82, tipoEstrutura: 'Solo',
      politica: { ...POLITICA, pacote_pct: PCT_REFERENCIA }, ajustes: { pacote_valor_r: 36000 },
    })
    expect(r.memoria.modo_pacote).toBe(MODO_PACOTE.FIXO)
    expect(r.memoria.pacote_pct).toBeNull()
    expect(r.linhas.map((l) => l.valor_r)).toEqual([77554.60, 10250, 36000])
    expect(r.total_r).toBe(123804.60)
    expect(r.pagamento.parcelas.map((p) => p.valor_r)).toEqual([1000, 17500, 17500])
  })

  it('telhado sem extra configurado: linha de estrutura não aparece', () => {
    const r = precificarOpcao({
      valorKitR: 10000, quantidadeModulos: 10, tipoEstrutura: 'Fibrocimento',
      politica: { ...POLITICA, pacote_pct: 40 },
    })
    expect(r.linhas.map((l) => l.categoria)).toEqual([CATEGORIA.KIT, CATEGORIA.PACOTE_FORTE_SOLAR])
    expect(r.linhas[1].valor_r).toBe(4000)
    expect(r.total_r).toBe(14000)
  })

  it('laje com R$ 25/módulo e custos adicionais somam no pacote', () => {
    const r = precificarOpcao({
      valorKitR: 10000, quantidadeModulos: 10, tipoEstrutura: 'Laje',
      politica: {
        ...POLITICA, pacote_pct: 40,
        custos_adicionais: [
          { descricao: 'Viagem', base: 'fixo', valor: 300 },
          { descricao: 'Instalação', base: 'por_modulo', valor: 50 },
          { descricao: 'Imposto', base: 'pct', valor: 6 },
        ],
      },
    })
    // base = 10.000 + 250 = 10.250; pacote = 4.100 + 300 + 500 + 615 = 5.515
    expect(r.linhas.map((l) => l.valor_r)).toEqual([10000, 250, 5515])
    expect(r.total_r).toBe(15765)
    expect(r.memoria.custos_adicionais.map((c) => c.valor_r)).toEqual([300, 500, 615])
  })

  it('sem % e sem valor fixo: pacote é lacuna, total null', () => {
    const r = precificarOpcao({
      valorKitR: 1000, quantidadeModulos: 2, tipoEstrutura: 'Solo',
      politica: { extra_estrutura_r_por_modulo: { Solo: 125 } },
    })
    expect(r.total_r).toBeNull()
    expect(r.lacunas.join(' ')).toMatch(/% do pacote/)
    expect(r.lacunas.join(' ')).toMatch(/Pagador do extra/)
  })

  it('quantidade não inteira e kit inválido viram lacuna', () => {
    const r = precificarOpcao({ valorKitR: 'abc', quantidadeModulos: 2.5, tipoEstrutura: 'Solo', politica: { pacote_pct: 10 } })
    expect(r.total_r).toBeNull()
    expect(r.lacunas.length).toBeGreaterThanOrEqual(2)
  })

  it('parcelamento: soma exata e validação dos marcos', () => {
    const p = parcelarPagamento({ valorR: 100, marcos: [{ pct: 33.3333 }, { pct: 33.3333 }, { pct: 33.3334 }] })
    const soma = p.parcelas.reduce((s, x) => s + paraCentavos(x.valor_r), 0)
    expect(soma).toBe(10000)
    expect(parcelarPagamento({ valorR: 100, marcos: [{ pct: 50 }] }).lacunas[0]).toMatch(/100%/)
    expect(parcelarPagamento({ valorR: 100, entradaR: 200, marcos: [] }).lacunas[0]).toMatch(/Entrada/)
  })
})

// ── Strings ────────────────────────────────────────────────────────────────
const MODULO_620 = { voc: 47.9, vmpp: 40.1, coef_temp_voc: -0.25, coef_temp_vmpp: -0.29, isc: 16.3, impp: 15.47 }
const INV_8x2 = {
  numero_mppt: 8, entradas_por_mppt: 2, tensao_max_entrada: 1100, mppt_min: 180, mppt_max: 1000,
  corrente_max_por_mppt: 32, corrente_isc_max: 40,
}
const CLIMA = { tMin: 15, tMax: 40 }

describe('distribuicaoStrings', () => {
  it('golden — 178 módulos em 8×2: 14×11 + 2×12, 12 só com 12', () => {
    const r = sugerirDistribuicaoStrings({ totalModulos: 178, inversor: INV_8x2, modulo: MODULO_620, clima: CLIMA })
    expect(r.status).toBe(STATUS_DISTRIBUICAO.PRELIMINAR)
    expect(r.resumo).toEqual({
      total_modulos: 178, total_strings: 16,
      grupos: [{ modulos_por_string: 12, strings: 2 }, { modulos_por_string: 11, strings: 14 }],
    })
    for (const m of r.mppts) expect(m.strings).toBeLessThanOrEqual(2)
    expect(r.mppts.every((m) => m.tensao === 'ok')).toBe(true)
    expect(r.lacunas).toEqual([])
  })

  it('177 módulos em 8×2 — corrige o erro do PDF (11 e 12 no mesmo MPPT)', () => {
    const r = sugerirDistribuicaoStrings({ totalModulos: 177, inversor: INV_8x2, modulo: MODULO_620, clima: CLIMA })
    expect(r.resumo.total_modulos).toBe(177)
    expect(r.resumo.total_strings).toBe(15)
    expect(r.resumo.grupos).toEqual([
      { modulos_por_string: 12, strings: 12 }, { modulos_por_string: 11, strings: 3 },
    ])
    expect(r.mppts.map((m) => [m.strings, m.modulos_por_string])).toEqual([
      [2, 12], [2, 12], [2, 12], [2, 12], [2, 12], [2, 12], [2, 11], [1, 11],
    ])
  })

  it('golden — 82 módulos em 4×2: 6×10 + 2×11', () => {
    const r = sugerirDistribuicaoStrings({
      totalModulos: 82, inversor: { ...INV_8x2, numero_mppt: 4 }, modulo: MODULO_620, clima: CLIMA,
    })
    expect(r.resumo.grupos).toEqual([
      { modulos_por_string: 11, strings: 2 }, { modulos_por_string: 10, strings: 6 },
    ])
  })

  it('tensão limita o comprimento: string curta demais é descartada', () => {
    // mppt_min alto obriga strings longas → menos strings
    const r = sugerirDistribuicaoStrings({
      totalModulos: 178, inversor: { ...INV_8x2, mppt_min: 500 }, modulo: MODULO_620, clima: CLIMA,
    })
    expect(r.status).toBe(STATUS_DISTRIBUICAO.PRELIMINAR)
    expect(Math.min(...r.mppts.map((m) => m.modulos_por_string))).toBeGreaterThanOrEqual(14)
    expect(r.mppts.every((m) => m.tensao !== 'incompativel')).toBe(true)
    expect(r.resumo.total_modulos).toBe(178)
  })

  it('curto-circuito limita o paralelo por MPPT', () => {
    const r = sugerirDistribuicaoStrings({
      totalModulos: 88, inversor: { ...INV_8x2, corrente_isc_max: 20 }, modulo: MODULO_620, clima: CLIMA,
    })
    expect(r.mppts.every((m) => m.strings === 1)).toBe(true)
    expect(r.lacunas.join(' ')).toMatch(/curto limita a 1/)
  })

  it('sem dados de tensão: distribui, mas declara a lacuna', () => {
    const r = sugerirDistribuicaoStrings({ totalModulos: 178, inversor: { numero_mppt: 8, entradas_por_mppt: 2 } })
    expect(r.status).toBe(STATUS_DISTRIBUICAO.PRELIMINAR)
    expect(r.mppts.every((m) => m.tensao === 'nao_avaliado')).toBe(true)
    expect(r.lacunas.join(' ')).toMatch(/Tensão não avaliada/)
    expect(r.lacunas.join(' ')).toMatch(/Corrente não avaliada/)
  })

  it('sem MPPT/entradas no catálogo: sem_dados', () => {
    const r = sugerirDistribuicaoStrings({ totalModulos: 10, inversor: { numero_mppt: 2 } })
    expect(r.status).toBe(STATUS_DISTRIBUICAO.SEM_DADOS)
    expect(r.lacunas.join(' ')).toMatch(/entradas/)
  })

  it('impossível: módulos demais para a janela de tensão', () => {
    const r = sugerirDistribuicaoStrings({
      totalModulos: 500, inversor: { ...INV_8x2, numero_mppt: 1, entradas_por_mppt: 1 }, modulo: MODULO_620, clima: CLIMA,
    })
    expect(r.status).toBe(STATUS_DISTRIBUICAO.SEM_SOLUCAO)
  })
})
