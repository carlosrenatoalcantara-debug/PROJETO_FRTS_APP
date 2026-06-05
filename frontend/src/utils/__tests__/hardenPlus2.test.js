import { describe, it, expect } from 'vitest'
import { montarMatriz, montarColunaUnica } from '../../../../backend/src/ai/parserMatricial.js'
import { extrairSpecsTecnicas } from '../../../../backend/src/ai/parserTecnicoInversor.js'
import { normalizarEntradasPorMppt } from '../../../../backend/src/equipamentos/inversores/index.js'
import huaweiM2 from '../../../../backend/src/ai/__fixtures__/golden/huawei_m2.json'
import huaweiM3 from '../../../../backend/src/ai/__fixtures__/golden/huawei_m3.json'
import sungrow from '../../../../backend/src/ai/__fixtures__/golden/sungrow_sg110cx.json'
import chint from '../../../../backend/src/ai/__fixtures__/golden/chint_sca.json'

/**
 * P1-INV-HARDEN-PLUS-02 — recuperação de dados REAIS (Huawei/Sungrow/CHINT).
 * Sem IA, sem inferência. Replica o pipeline do InternalAdapter: parser
 * posicional (coluna única / matricial) + complemento GLOBAL do texto.
 */
const CK = ['potencia_kw', 'potencia_maxima_kw', 'corrente_ac_saida', 'tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max', 'corrente_max_por_mppt', 'corrente_isc_max', 'n_mppts', 'strings_por_mppt', 'eficiencia_maxima', 'grau_protecao_ip', 'peso_kg', 'dimensoes', 'fases']
const GLOBAIS = ['dimensoes', 'grau_protecao_ip', 'certificacoes', 'temperatura_operacao', 'fases', 'peso_kg', 'garantia_anos', 'eficiencia_maxima', 'eficiencia_europeia', 'tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max']
const fill = (e) => CK.filter(k => e[k] != null).length

// Replica o complemento global do InternalAdapter (coluna única / matricial).
function comGlobais(esp, texto, modelo) {
  const out = { ...esp }
  const g = extrairSpecsTecnicas(texto, modelo)
  for (const k of GLOBAIS) if (out[k] == null && g[k] != null) out[k] = g[k]
  return out
}
const colunaUnica = (fx, modelo) => comGlobais(montarColunaUnica(fx.tokens).especificacoes, fx.texto, modelo)
function matricialModelo(fx, modelos, modelo) {
  const m = montarMatriz(fx.tokens, modelos)
  return comGlobais(m.porModelo[modelo].especificacoes, fx.texto, modelo)
}

describe('Huawei — aliases + nota de rodapé + milhar (meta 60%→≥85%)', () => {
  it('M2: Vmáx=1100 (pula footnote), MPPT 200–1000, corrente/MPPT=30, fill≥85%', () => {
    const e = colunaUnica(huaweiM2, 'SUN2000-100KTL-M2')
    expect(e.tensao_max_entrada).toBe(1100)   // "Max. Input Voltage 1 1,100 V"
    expect(e.tensao_mppt_min).toBe(200)        // "MPPT Operating Voltage Range 2 200 V ~ 1,000 V"
    expect(e.tensao_mppt_max).toBe(1000)
    expect(e.corrente_max_por_mppt).toBe(30)   // "Max. Current per MPPT 30 A"
    expect(e.n_mppts).toBe(10)
    expect(e.fases).toBe(3)
    expect(fill(e) / CK.length).toBeGreaterThanOrEqual(0.85)
  })
  it('M3 (matricial): Vmáx 1100, MPPT 200–1000, fill≥85%', () => {
    const m = montarMatriz(huaweiM3.tokens, ['SUN2000-30KTL-M3', 'SUN2000-36KTL-M3', 'SUN2000-40KTL-M3'])
    expect(m.ok).toBe(true)
    const modelo = m.modelos[Math.floor(m.modelos.length / 2)]
    const e = comGlobais(m.porModelo[modelo].especificacoes, huaweiM3.texto, modelo)
    expect(e.tensao_max_entrada).toBe(1100)
    expect(e.tensao_mppt_min).toBe(200)
    expect(e.tensao_mppt_max).toBe(1000)
    expect(fill(e) / CK.length).toBeGreaterThanOrEqual(0.85)
  })
})

describe('Sungrow SG110CX — single-column posicional (meta 27%→≥85%)', () => {
  it('potência, tensão, faixa MPPT, nº MPPT, fases recuperados; fill≥85%', () => {
    const e = colunaUnica(sungrow, 'SG110CX-P2')
    expect(e.potencia_kw).toBe(110)
    expect(e.tensao_max_entrada).toBe(1100)
    expect(e.tensao_mppt_min).toBe(180)
    expect(e.tensao_mppt_max).toBe(1000)
    expect(e.n_mppts).toBe(12)
    expect(e.fases).toBe(3)                    // "Fases de alimentação" (não 0.99 = fator de potência)
    expect(e.eficiencia_maxima).toBe(98.5)
    expect(fill(e) / CK.length).toBeGreaterThanOrEqual(0.85)
  })
})

describe('CHINT CPS — células ASSIMÉTRICAS + cobertura (meta 80%→≥90%)', () => {
  const modelos = ['SCA50KTL-T', 'SCA60KTL-T']
  it('SCA50: strings_por_mppt="3/3/2/2" → entradas_por_mppt=[3,3,2,2] (assimetria preservada)', () => {
    const m = montarMatriz(chint.tokens, modelos)
    const e = m.porModelo['SCA50KTL-T'].especificacoes
    expect(e.strings_por_mppt).toBe('3/3/2/2')
    expect(normalizarEntradasPorMppt(e)).toEqual([3, 3, 2, 2])
  })
  it('MPPT range, corrente/MPPT, Isc, eficiência; fill≥90%', () => {
    const e = matricialModelo(chint, modelos, 'SCA60KTL-T')
    expect(e.tensao_max_entrada).toBe(1100)
    expect(e.tensao_mppt_min).toBe(200)
    expect(e.tensao_mppt_max).toBe(1000)
    expect(e.corrente_max_por_mppt).toBe(39)
    expect(e.corrente_isc_max).toBe(45)
    expect(e.eficiencia_maxima).toBe(99)       // "99.0% maximum efficiency" (prosa, valor antes)
    expect(fill(e) / CK.length).toBeGreaterThanOrEqual(0.90)
  })
})
