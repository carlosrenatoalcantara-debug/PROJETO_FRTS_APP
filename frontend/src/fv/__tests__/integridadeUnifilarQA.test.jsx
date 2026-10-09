/**
 * integridadeUnifilarQA — BUG-QA-01 e BUG-QA-02.
 *
 * Os dois defeitos saíram do teste operacional de 61 cenários e têm a mesma
 * forma: o desenho saía tecnicamente plausível e materialmente falso.
 *
 *   QA-01  micro sem `distribuicao[]` → unifilar com 0 módulos / 0 kWp, no mesmo
 *          projeto cujo memorial dizia 8 módulos / 4,4 kWp.
 *   QA-02  30 módulos em série (Voc 1614 V) num inversor de 550 V → desenhou.
 *
 * O que estes testes prendem é a REGRA, não o número: derivar só quando é
 * inequívoco, recusar quando não é, e nunca inventar limite ausente.
 */
import { describe, it, expect } from 'vitest'
import {
  microsDoArranjo,
} from '../../../../backend/src/dominio/unifilar/adaptarProjeto.js'
import {
  modulosDosMicros, avaliarVocContraInversor, MOTIVOS_UNIFILAR,
} from '../../../../backend/src/dominio/unifilar/integridade.js'

const MICRO = (extra = {}) => ({
  equipamento_id: 'micro-1', marca: 'Hoymiles', modelo: 'HMS-2000-4T',
  quantidade: 2, entradas_por_micro: 4, modulos_por_entrada: 1, ...extra,
})
const ARRANJO = (micros, nModulos = 8) => ({
  id: 'arr_1', tipo: 'principal',
  dimensionamento: { n_modulos: nModulos },
  paineis: [{ id: 'm1', equipamento_id: 'm1', potencia_w: 550, quantidade: nModulos }],
  inversores: [{ equipamento_id: 'micro-1', potencia_kw: 2, quantidade: 2 }],
  configuracao_eletrica: { micros },
})

describe('BUG-QA-01 · quantidade de módulos do microinversor', () => {
  it('1 · usa a distribuição persistida quando ela existe', () => {
    const r = microsDoArranjo(ARRANJO([MICRO({ distribuicao: [4, 4] })]))
    expect(r[0].distribuicao).toEqual([4, 4])
  })

  it('2 · UM modelo sem distribuição: deriva da composição do arranjo', () => {
    // 8 módulos no arranjo, 2 micros de capacidade 4 → [4,4]. É o mesmo valor
    // que `distribuicaoDoBloco` teria gravado; não há escolha a fazer.
    const r = microsDoArranjo(ARRANJO([MICRO()], 8))
    expect(r[0].distribuicao).toEqual([4, 4])
    expect(r[0].distribuicao.reduce((a, b) => a + b, 0)).toBe(8)
  })

  it('3 · a derivação equilibra, não enche a primeira unidade', () => {
    const r = microsDoArranjo(ARRANJO([MICRO()], 7))
    expect(r[0].distribuicao).toEqual([4, 3])
  })

  it('4 · lê a composição por `paineis[].quantidade` quando falta `n_modulos`', () => {
    const a = ARRANJO([MICRO()], 8)
    delete a.dimensionamento
    expect(microsDoArranjo(a)[0].distribuicao).toEqual([4, 4])
  })

  it('5 · NÃO deriva da capacidade: 2 micros × 4 entradas não viram 8 módulos', () => {
    // O arranjo declara 5 módulos. Se a derivação usasse capacidade (2×4×1=8),
    // o desenho afirmaria 8 — ocupação total que o projeto não declarou.
    const r = microsDoArranjo(ARRANJO([MICRO()], 5))
    expect(r[0].distribuicao.reduce((a, b) => a + b, 0)).toBe(5)
  })

  it('6 · DOIS modelos sem distribuição: não deriva — a repartição é ambígua', () => {
    const r = microsDoArranjo(ARRANJO([MICRO(), MICRO({ modelo: 'HMS-1000-2T', entradas_por_micro: 2 })], 12))
    expect(r[0].distribuicao).toEqual([])
    expect(r[1].distribuicao).toEqual([])
  })

  it('7 · sem composição conhecida também não deriva', () => {
    const a = ARRANJO([MICRO()], 8)
    delete a.dimensionamento
    a.paineis = []
    expect(microsDoArranjo(a)[0].distribuicao).toEqual([])
  })

  it('8 · o portão recusa quando a distribuição ficou indeterminada', () => {
    const imp = modulosDosMicros([{ modelo: 'A', distribuicao: [] }, { modelo: 'B', distribuicao: [] }])
    expect(imp?.codigo).toBe(MOTIVOS_UNIFILAR.DISTRIBUICAO_MICRO_INDETERMINADA)
    expect(imp.detalhe.modelos_sem_distribuicao).toEqual(['A', 'B'])
  })

  it('9 · e libera quando todos os modelos sabem a sua', () => {
    expect(modulosDosMicros([{ modelo: 'A', distribuicao: [4, 4] }])).toBeNull()
  })
})

describe('BUG-QA-02 · Voc contra o limite de entrada do inversor', () => {
  it('10 · Voc abaixo do limite passa', () => {
    expect(avaliarVocContraInversor({ vocMax: 510.8, limite: 600 })).toBeNull()
  })

  it('11 · Voc exatamente no limite passa — o limite é o teto, não a barreira', () => {
    expect(avaliarVocContraInversor({ vocMax: 600, limite: 600 })).toBeNull()
  })

  it('12 · Voc acima do limite recusa, com os dois números no detalhe', () => {
    const imp = avaliarVocContraInversor({ vocMax: 1614.2, limite: 550, inversor: 'Solis RHI-5K' })
    expect(imp?.codigo).toBe(MOTIVOS_UNIFILAR.VOC_ACIMA_DO_LIMITE)
    expect(imp.detalhe.voc_max_v).toBe(1614.2)
    expect(imp.detalhe.tensao_max_entrada_v).toBe(550)
    expect(imp.detalhe.inversor).toBe('Solis RHI-5K')
  })

  it('13 · limite ausente é NÃO AVALIADO, não bloqueio inventado', () => {
    expect(avaliarVocContraInversor({ vocMax: 1614.2, limite: null })).toBeNull()
    expect(avaliarVocContraInversor({ vocMax: 1614.2, limite: 0 })).toBeNull()
    expect(avaliarVocContraInversor({ vocMax: 1614.2 })).toBeNull()
  })

  it('14 · Voc desconhecido também não bloqueia', () => {
    expect(avaliarVocContraInversor({ vocMax: null, limite: 550 })).toBeNull()
  })

  it('15 · o arranjo entra no detalhe quando informado', () => {
    const imp = avaliarVocContraInversor({ vocMax: 900, limite: 600, arranjo: 'arr_2' })
    expect(imp.detalhe.arranjo_id).toBe('arr_2')
  })
})
