import { describe, it, expect } from 'vitest'
import { montarMatriz } from '../../../../backend/src/ai/parserMatricial.js'
import x1 from '../../../../backend/src/ai/__fixtures__/golden/solax_x1_spt.json'
import x3 from '../../../../backend/src/ai/__fixtures__/golden/solax_x3_ultra.json'

/**
 * P1-PARSER-COLUMN-ALIGNMENT-01 — deslocamento de coluna em tabelas multi-modelo SolaX.
 * Antes: X3-ULTRA tinha potencia=2 (falso-match "Peak EPS output power → 2 time of rated
 * power") e MPPT ausente; valores right-aligned caíam na coluna +1.
 */

describe('SolaX X3-ULTRA (7 modelos, hybrid)', () => {
  const m = montarMatriz(x3.tokens, [])
  it('detecta os 7 modelos X3-ULT', () => {
    expect(m.modelos).toEqual(['X3-ULT-15K', 'X3-ULT-15KP', 'X3-ULT-19.9K', 'X3-ULT-20K', 'X3-ULT-20KP', 'X3-ULT-25K', 'X3-ULT-30K'])
  })
  it('potência DISTINTA e correta (não mais "2"): 15/15/19.9/20/20/25/30', () => {
    expect(m.modelos.map(x => m.porModelo[x].especificacoes.potencia_kw)).toEqual([15, 15, 19.9, 20, 20, 25, 30])
  })
  it('linhas de BACKUP/BATERIA não viram potência do inversor', () => {
    for (const x of m.modelos) expect(m.porModelo[x].especificacoes.potencia_kw).not.toBe(2)
  })
  it('faixa MPPT recuperada ("Operating voltage range" → 120–950) p/ todos', () => {
    for (const x of m.modelos) {
      const e = m.porModelo[x].especificacoes
      expect(e.tensao_mppt_min).toBe(120); expect(e.tensao_mppt_max).toBe(950)
    }
  })
  it('campos compartilhados corretos: Vmáx 1000, Imppt 36, Isc 45', () => {
    for (const x of m.modelos) {
      const e = m.porModelo[x].especificacoes
      expect(e.tensao_max_entrada).toBe(1000); expect(e.corrente_max_por_mppt).toBe(36); expect(e.corrente_isc_max).toBe(45)
    }
  })
})

describe('SolaX X1-SPT (2 modelos) — segue correto (sem regressão)', () => {
  const m = montarMatriz(x1.tokens, [])
  it('2 modelos com potência distinta 10/12', () => {
    expect(m.modelos).toEqual(['X1-SPT-10K', 'X1-SPT-12K'])
    expect(m.modelos.map(x => m.porModelo[x].especificacoes.potencia_kw)).toEqual([10, 12])
  })
  it('MPPT 35–490, Vmáx 500, Imppt 18, Isc 22', () => {
    for (const x of m.modelos) {
      const e = m.porModelo[x].especificacoes
      expect(e.tensao_mppt_min).toBe(35); expect(e.tensao_mppt_max).toBe(490)
      expect(e.tensao_max_entrada).toBe(500); expect(e.corrente_max_por_mppt).toBe(18); expect(e.corrente_isc_max).toBe(22)
    }
  })
})
