import { describe, it, expect } from 'vitest'
import { extrairSpecsTecnicas, potenciaDoModelo, CAMPOS_SUPORTADOS } from '../../../../backend/src/ai/parserTecnicoInversor.js'

/**
 * P0-CAT-09 — parser técnico determinístico (sem IA).
 * Texto no formato real de tabela linearizada de datasheet ("Rótulo (unidade) v1 v2 v3").
 */

// Trecho representativo do datasheet Goodwe DT (tabela multi-modelo linearizada)
const OCR_GOODWE = `
GoodWe GW17K-DT GW20K-DT GW25K-DT
Dual-MPPT, Three-Phase 17KW 20KW 25KW
Max. DC Input Power (W) 22100 26000 32500
Max. DC Input Voltage (V)* 1000 1000 1000
MPPT Range (V) 260~850 260~850 260~850
No. of MPPT 2 2 2
Strings per MPPT 2 2 2
Max. Input Current (A) 22/22 22/22 27/27
Max. Short Current (A) 27.5 27.5 33.8
Rated AC Output Power (W) 17000 20000 25000
Max. AC Output Power (W) 18700 22000 27500
Rated Grid Voltage (V) 380/400
Max. AC Output Current (A) 27.5 32.5 40.5
Max. Efficiency 98.6%
European Efficiency 98.3%
Operating Temperature Range (°C) -25~60
Weight (kg) 39 39 40
Dimension (WxHxD mm) 415x511x178
Protection Degree IP65
Warranty 10 years (standard)
Certificate IEC 62109, IEC 61727, NBR 16149
`

describe('potenciaDoModelo', () => {
  it('extrai kW do nome do modelo', () => {
    expect(potenciaDoModelo('GW20K-DT')).toBe(20)
    expect(potenciaDoModelo('GW17K-DT')).toBe(17)
    expect(potenciaDoModelo('ASW15K-LT-G2')).toBe(15)
    expect(potenciaDoModelo('MID25KTL3-X')).toBe(25)
    expect(potenciaDoModelo('1P7K-4G')).toBe(7)
    expect(potenciaDoModelo('SUN2000-100KTL')).toBe(100)
  })
  it('null quando não há potência no nome', () => {
    expect(potenciaDoModelo('MIC TL-X')).toBeNull()
  })
})

describe('extrairSpecsTecnicas — datasheet Goodwe DT (sem IA)', () => {
  // 1º modelo da série (coluna 1 da tabela) — valores per-coluna consistentes
  const esp = extrairSpecsTecnicas(OCR_GOODWE, 'GW17K-DT')

  it('preenche ≥ 80% dos campos suportados', () => {
    const n = Object.keys(esp).length
    expect(n / CAMPOS_SUPORTADOS.length).toBeGreaterThanOrEqual(0.8)
  })

  it('potência vem do NOME do modelo (per-modelo)', () => {
    expect(esp.potencia_kw).toBe(17)            // GW17K → 17kW (do nome)
    expect(esp.potencia_maxima_kw).toBe(18.7)   // 18700W (coluna 1) → 18.7kW
  })

  it('extrai campos elétricos do texto da tabela', () => {
    expect(esp.n_mppts).toBe(2)
    expect(esp.strings_por_mppt).toBe(2)
    expect(esp.tensao_max_entrada).toBe(1000)
    expect(esp.tensao_mppt_min).toBe(260)
    expect(esp.tensao_mppt_max).toBe(850)
    expect(esp.corrente_max_por_mppt).toBe(22)
    expect(esp.tensao_ac).toBe(380)
    expect(esp.corrente_ac_saida).toBe(27.5)
  })

  it('extrai eficiência, físico e proteções', () => {
    expect(esp.eficiencia_maxima).toBe(98.6)
    expect(esp.eficiencia_europeia).toBe(98.3)
    expect(esp.peso_kg).toBe(39)
    expect(esp.dimensoes).toBe('415x511x178')
    expect(esp.grau_protecao_ip).toBe('IP65')
    expect(esp.temperatura_operacao).toMatch(/-25~\+60/)
    expect(esp.garantia_anos).toBe(10)
    expect(esp.certificacoes).toMatch(/IEC 62109/)
  })
})

describe('extrairSpecsTecnicas — labels em português', () => {
  const OCR_PT = `
Potência nominal AC (W) 5000
Nº de MPPT 2
Tensão máxima CC (V) 600
Eficiência máxima 97.5%
Peso (kg) 18
Grau de proteção IP66
Garantia 12 anos
`
  it('reconhece rótulos PT', () => {
    const esp = extrairSpecsTecnicas(OCR_PT, null)
    expect(esp.potencia_kw).toBe(5)
    expect(esp.n_mppts).toBe(2)
    expect(esp.tensao_max_entrada).toBe(600)
    expect(esp.eficiencia_maxima).toBe(97.5)
    expect(esp.peso_kg).toBe(18)
    expect(esp.grau_protecao_ip).toBe('IP66')
    expect(esp.garantia_anos).toBe(12)
  })
})
