import { describe, it, expect } from 'vitest'
import { montarMatriz, CONF } from '../../../../backend/src/ai/parserMatricial.js'
import { extrairSpecsTecnicas } from '../../../../backend/src/ai/parserTecnicoInversor.js'
import { validarPlausibilidadeInversor } from '../../../../backend/src/ai/validacaoEletricaInversor.js'
import sungrow from '../../../../backend/src/ai/__fixtures__/golden/sungrow_rt.json'
import goodweMs from '../../../../backend/src/ai/__fixtures__/golden/goodwe_ms.json'
import deye from '../../../../backend/src/ai/__fixtures__/golden/deye_lv.json'
import hopewind from '../../../../backend/src/ai/__fixtures__/golden/hopewind.json'

/**
 * GOLDEN SUITE — P1-INV-HARDEN-01.
 *
 * Fonte da verdade de regressão do parser. Os fixtures contêm os TOKENS
 * posicionais REAIS (congelados) dos datasheets. Qualquer alteração futura do
 * parser DEVE passar nesta suíte. Sem PDFs em runtime, sem IA.
 *
 * (Solis e Kehua = PDF imagem, 0 tokens → fora do escopo; GoodWe DT, Solplanet
 *  e SAJ reais não foram fornecidos — cobertos por testes sintéticos/posicionais
 *  em parserMatricial.test.js.)
 */

describe('GOLDEN · Sungrow RT (6 modelos — valores distintos por coluna)', () => {
  const r = montarMatriz(sungrow.tokens, sungrow.modelos)
  const esp = (m) => r.porModelo[m].especificacoes
  const st = (m) => r.porModelo[m]._status

  it('detecta os 6 modelos', () => {
    expect(r.ok).toBe(true)
    expect(r.modelos).toEqual(['SG5.0RT', 'SG6.0RT', 'SG7.0RT', 'SG8.0RT', 'SG10RT', 'SG12RT'])
  })

  it('potência nominal distinta: 5/6/7/8/10/12', () => {
    expect(sungrow.modelos.map(m => esp(m).potencia_kw)).toEqual([5, 6, 7, 8, 10, 12])
  })

  it('corrente CA de saída distinta', () => {
    expect(sungrow.modelos.map(m => esp(m).corrente_ac_saida)).toEqual([8.3, 10, 11.7, 13.3, 16.7, 20])
  })

  it('eficiência: 98.4 (SG5-7) / 98.5 (SG8-12)', () => {
    expect(sungrow.modelos.map(m => esp(m).eficiencia_maxima)).toEqual([98.4, 98.4, 98.4, 98.5, 98.5, 98.5])
  })

  it('CÉLULAS COMPARTILHADAS: tensão CC/MPPT replicadas (todas)', () => {
    for (const m of sungrow.modelos) {
      expect(esp(m).tensao_max_entrada).toBe(1100)
      expect(esp(m).tensao_mppt_min).toBe(160)
      expect(esp(m).tensao_mppt_max).toBe(1000)
    }
  })

  it('CÉLULAS AGRUPADAS (carry-forward): Isc 32(SG5-7)/48(SG8-12) com confiança', () => {
    expect(sungrow.modelos.map(m => esp(m).corrente_isc_max)).toEqual([32, 32, 32, 48, 48, 48])
    // origem do grupo = ENCONTRADO; propagados = INFERIDO_ALTA
    expect(st('SG5.0RT').corrente_isc_max).toBe(CONF.ENCONTRADO)
    expect(st('SG6.0RT').corrente_isc_max).toBe(CONF.INF_ALTA)
    expect(st('SG8.0RT').corrente_isc_max).toBe(CONF.ENCONTRADO)
    expect(st('SG10RT').corrente_isc_max).toBe(CONF.INF_ALTA)
  })

  it('strings por MPPT distintas: 1/1 (SG5-6) e 2/1 (SG7-12)', () => {
    expect(sungrow.modelos.map(m => esp(m).strings_por_mppt)).toEqual(['1/1', '1/1', '2/1', '2/1', '2/1', '2/1'])
  })

  it('plausibilidade elétrica: SEM alertas críticos', () => {
    for (const m of sungrow.modelos) {
      const criticos = validarPlausibilidadeInversor(esp(m)).filter(a => a.severidade === 'critico')
      expect(criticos).toEqual([])
    }
  })
})

describe('GOLDEN · GoodWe MS (3 modelos monofásicos)', () => {
  const r = montarMatriz(goodweMs.tokens, goodweMs.modelos)
  it('potência distinta 7 / 8.5 / 10 kW', () => {
    expect(r.ok).toBe(true)
    expect(goodweMs.modelos.map(m => r.porModelo[m].especificacoes.potencia_kw)).toEqual([7, 8.5, 10])
  })
  it('eficiência 97.5 / 97.8 / 97.8', () => {
    expect(goodweMs.modelos.map(m => r.porModelo[m].especificacoes.eficiencia_maxima)).toEqual([97.5, 97.8, 97.8])
  })
})

describe('GOLDEN · single-model (parser de texto)', () => {
  it('Deye SUN-23K-G04-LV: 23 kW, IP65, efic 98.7', () => {
    const e = extrairSpecsTecnicas(deye.texto, deye.modelo)
    expect(e.potencia_kw).toBe(23)
    expect(e.grau_protecao_ip).toBe('IP65')
    expect(e.eficiencia_maxima).toBe(98.7)
  })
  it('Hopewind HSSP: potência e eficiência extraídas', () => {
    const e = extrairSpecsTecnicas(hopewind.texto, 'HSSP6K-G01')
    expect(e.eficiencia_maxima).toBeGreaterThanOrEqual(97)
    expect(e.grau_protecao_ip).toMatch(/IP6/)
  })
})
