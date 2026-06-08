import { describe, it, expect } from 'vitest'
import { montarColunaUnica, montarMatriz, detectarColunasAuto } from '../../../../backend/src/ai/parserMatricial.js'
import { expandirModelosInversor } from '../../../../backend/src/ai/serieInversor.js'
import huaweiM3 from '../../../../backend/src/ai/__fixtures__/golden/huawei_m3.json'
import huaweiM2 from '../../../../backend/src/ai/__fixtures__/golden/huawei_m2.json'
import chint from '../../../../backend/src/ai/__fixtures__/golden/chint_sca.json'

/**
 * P1-PARSER-CHINT-HUAWEI-FIX-01 — 2 achados ALTA da auditoria multi-modelo.
 * Huawei M3: Isc=4 (tokenizer quebrou "40"→"4","0"). Chint: SCA60KTL-T perdido + fantasma.
 */

describe('Huawei — Isc (merge de fragmentos de dígito)', () => {
  it('M3: Isc=40 (não mais 4 — "4"+"0" mesclados)', () => {
    expect(montarColunaUnica(huaweiM3.tokens).especificacoes.corrente_isc_max).toBe(40)
  })
  it('M3: Isc > Imppt (fisicamente consistente)', () => {
    const e = montarColunaUnica(huaweiM3.tokens).especificacoes
    expect(e.corrente_isc_max).toBeGreaterThan(e.corrente_max_por_mppt)
  })
  it('M2: sem regressão (Isc=40, Vmáx=1100, pot=100)', () => {
    const e = montarColunaUnica(huaweiM2.tokens).especificacoes
    expect(e.corrente_isc_max).toBe(40); expect(e.tensao_max_entrada).toBe(1100); expect(e.potencia_kw).toBe(100)
  })
})

describe('Chint — 2 modelos sem fantasma', () => {
  it('expandirModelosInversor: SCA50/60KTL-T SEM "CPSSCA50" fantasma', () => {
    const mods = expandirModelosInversor(chint.texto).modelos
    expect(mods).toContain('SCA50KTL-T'); expect(mods).toContain('SCA60KTL-T')
    expect(mods.some(m => /CPSSCA/i.test(m))).toBe(false)
  })
  it('auto-detect (sem lista) reconhece header "CPS …/EU" → 2 colunas', () => {
    expect(detectarColunasAuto(chint.tokens).map(c => c.modelo)).toEqual(['SCA50KTL-T', 'SCA60KTL-T'])
  })
  it('montarMatriz extrai os 2 modelos com potência distinta 50/60', () => {
    const m = montarMatriz(chint.tokens, [])
    expect(m.modelos).toEqual(['SCA50KTL-T', 'SCA60KTL-T'])
    expect(m.porModelo['SCA50KTL-T'].especificacoes.potencia_kw).toBe(50)
    expect(m.porModelo['SCA60KTL-T'].especificacoes.potencia_kw).toBe(60)
  })
  it('sem modelos duplicados', () => {
    const m = montarMatriz(chint.tokens, [])
    expect(new Set(m.modelos).size).toBe(m.modelos.length)
  })
})
