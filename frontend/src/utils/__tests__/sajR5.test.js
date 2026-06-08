import { describe, it, expect } from 'vitest'
import { montarMatriz, expandirHeaderCombinado } from '../../../../backend/src/ai/parserMatricial.js'
import { extrairFabricanteModelo } from '../../../../backend/src/utils/catalogo/fabricanteModeloFallback.js'
import saj from '../../../../backend/src/ai/__fixtures__/golden/saj_r5_s2.json'

/**
 * P1-PARSER-SAJ-01 — SAJ R5-…-S2: cabeçalho COMBINADO de 7 modelos numa célula
 * ("R5-3K/3.6K/4K/5K/6K/7K/8K-S2"). Antes: colunas<2 → colapsava em 1 modelo, fab=null.
 */

describe('expandirHeaderCombinado — range de potências por "/"', () => {
  it('expande "R5-3K/3.6K/4K/5K/6K/7K/8K-S2" nos 7 modelos', () => {
    expect(expandirHeaderCombinado('R5-3K/3.6K/4K/5K/6K/7K/8K-S2')).toEqual([
      'R5-3K-S2', 'R5-3.6K-S2', 'R5-4K-S2', 'R5-5K-S2', 'R5-6K-S2', 'R5-7K-S2', 'R5-8K-S2',
    ])
  })
  it('não expande header simples (1 potência) nem texto comum', () => {
    expect(expandirHeaderCombinado('R5-5K-S2')).toBeNull()
    expect(expandirHeaderCombinado('Rated AC Power')).toBeNull()
  })
})

describe('GOLDEN · SAJ R5-S2 (header combinado, 7 modelos)', () => {
  const m = montarMatriz(saj.tokens, [])
  it('fabricante SAJ reconhecido sem a palavra "SAJ" no PDF (modelo R5)', () => {
    expect(extrairFabricanteModelo(saj.texto).fabricante).toBe('SAJ')
  })
  it('detecta os 7 modelos R5-…-S2', () => {
    expect(m.modelos).toEqual(['R5-3K-S2', 'R5-3.6K-S2', 'R5-4K-S2', 'R5-5K-S2', 'R5-6K-S2', 'R5-7K-S2', 'R5-8K-S2'])
  })
  it('potência DISTINTA por coluna: 3/3.68/4/5/6/7/8', () => {
    expect(m.modelos.map(x => m.porModelo[x].especificacoes.potencia_kw)).toEqual([3, 3.68, 4, 5, 6, 7, 8])
  })
  it('corrente CA distinta por modelo (não colapsada)', () => {
    const iac = m.modelos.map(x => m.porModelo[x].especificacoes.corrente_ac_saida)
    expect(iac[0]).toBe(14.4); expect(iac[6]).toBe(34.8)
    expect(new Set(iac).size).toBeGreaterThan(4)
  })
  it('campos COMPARTILHADOS replicados: tensao_partida 100, MPPT 90–550, 2 MPPTs', () => {
    for (const x of m.modelos) {
      const e = m.porModelo[x].especificacoes
      expect(e.tensao_partida).toBe(100)
      expect(e.tensao_mppt_min).toBe(90); expect(e.tensao_mppt_max).toBe(550)
      expect(e.n_mppts).toBe(2)
    }
  })
  it('cobertura ≥ 12/13 campos críticos por modelo', () => {
    const CK = ['potencia_kw', 'potencia_maxima_kw', 'tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max', 'corrente_max_por_mppt', 'n_mppts', 'tensao_partida', 'corrente_ac_saida', 'eficiencia_maxima', 'peso_kg', 'dimensoes', 'grau_protecao_ip']
    for (const x of m.modelos) {
      const e = m.porModelo[x].especificacoes
      expect(CK.filter(k => e[k] != null).length).toBeGreaterThanOrEqual(12)
    }
  })
})
