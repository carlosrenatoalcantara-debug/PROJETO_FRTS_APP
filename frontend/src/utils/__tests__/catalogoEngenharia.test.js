import { describe, it, expect } from 'vitest'
import { adaptarModulo, adaptarInversor, snapshotEquipamentoSelecao, agruparInversores } from '../catalogoEngenhariaAdapter'
import { avaliarUtilizavel } from '../utilizavelProjeto'

// ── Fixtures: Equipamento "Mongo" fake ──────────────────────────────────────────
const moduloMongo = {
  _id: 'M1', fabricante: 'Trina', modelo: 'TSM-670NEG21C', tipo: 'modulo',
  especificacoes: { potencia: 670, voc: 45.2, vmpp: 38.2, isc: 18.5, imp: 17.6, eficiencia: 22.5, coef_temp_voc: -0.0025, noct: 44, comprimento: 2384, largura: 1134, peso: 33 },
  garantia_produto: { value: 15, unit: 'anos' }, garantia_performance: { value: 30, unit: 'anos' },
  preco_sugerido: 820, utilizavel_em_projeto: true, certificacao: { inmetro: { numero: 'INMETRO-123' } },
}
const inversorDeye = {
  _id: 'I1', fabricante: 'Deye', modelo: 'SUN-8K-SG04LP3', tipo: 'inversor',
  especificacoes: { potencia: 8, mppts: 2, voc_max: 1000, faixa_mppt_min: 200, faixa_mppt_max: 850, corrente_max_mppt: 36, isc_max_mppt: 45, fases: 3, strings_por_mppt: 2 },
  garantia_produto: { value: 5, unit: 'anos' }, preco_sugerido: 4200, utilizavel_em_projeto: true,
}
const inversorIncompleto = {
  _id: 'I2', fabricante: 'X', modelo: 'NoMPPT', tipo: 'inversor',
  especificacoes: { potencia: 5, voc_max: 600 }, utilizavel_em_projeto: false, bloqueio_engenharia: ['MPPT', 'Corrente MPPT'],
}

describe('adaptarModulo', () => {
  it('mapeia campos elétricos e coeficiente real', () => {
    const m = adaptarModulo(moduloMongo)
    expect(m.potenciaW).toBe(670)
    expect(m.voc).toBe(45.2)
    expect(m.isc).toBe(18.5)
    expect(m.coef_temp_voc).toBe(-0.0025)   // coeficiente REAL (não genérico)
    expect(m.garantiaProduto).toBe(15)
    expect(m.garantiaPerformance).toBe(30)
    expect(m.registro_inmetro).toBe('INMETRO-123')
    expect(m.dimensoes.comprimento).toBe(2384)
    expect(m._catalogo_original).toBe(moduloMongo) // preserva original
    expect(m._fonte).toBe('catalogo')
  })
})

describe('adaptarInversor', () => {
  it('mapeia MPPT, tensão CC, corrente e fases', () => {
    const i = adaptarInversor(inversorDeye)
    expect(i.potenciaKW).toBe(8)
    expect(i.nMppts).toBe(2)
    expect(i._eletrico.tensao_max_entrada).toBe(1000)
    expect(i._eletrico.mppt_min).toBe(200)
    expect(i._eletrico.mppt_max).toBe(850)
    expect(i._eletrico.corrente_max_mppt).toBe(36)
    expect(i._fases).toBe(3)
  })
  it('agrupa em tree tipo→marca→fase', () => {
    const tree = agruparInversores([inversorDeye])
    expect(tree.string.Deye.trifasico).toHaveLength(1)
  })
})

describe('snapshot imutável', () => {
  it('congela dados elétricos + fonte + data + referências documentais', () => {
    const m = adaptarModulo(moduloMongo)
    const snap = snapshotEquipamentoSelecao(m)
    expect(snap.fabricante).toBe('Trina')
    expect(snap.modelo).toBe('TSM-670NEG21C')
    expect(snap.fonte).toBe('catalogo')
    expect(snap.data_selecao).toBeTruthy()
    expect(snap.dados_eletricos.voc).toBe(45.2)
    // imutabilidade: alterar o catálogo depois NÃO muda o snapshot já criado
    const snapJson = JSON.stringify(snap)
    moduloMongo.especificacoes.voc = 99
    expect(JSON.stringify(snap)).toBe(snapJson)
    moduloMongo.especificacoes.voc = 45.2 // restaura
  })
})

describe('bloqueio engenharia', () => {
  it('inversor sem MPPT é bloqueado', () => {
    const av = avaliarUtilizavel('inversor', inversorIncompleto.especificacoes)
    expect(av.utilizavel).toBe(false)
    expect(av.faltando).toContain('MPPT')
  })
  it('módulo completo é liberado', () => {
    const av = avaliarUtilizavel('modulo', moduloMongo.especificacoes)
    expect(av.utilizavel).toBe(true)
    expect(av.faltando).toHaveLength(0)
  })
})
