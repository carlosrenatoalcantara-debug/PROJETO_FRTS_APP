import { describe, it, expect } from 'vitest'
import { montarMatriz } from '../../../../backend/src/ai/parserMatricial.js'
import { lerInversor, derivarTopologia, normalizarEntradasPorMppt, TOPOLOGIA } from '../../../../backend/src/equipamentos/inversores/index.js'
import { extrairFabricanteModelo } from '../../../../backend/src/utils/catalogo/fabricanteModeloFallback.js'
import { classificarCampos } from '../../../../backend/src/ai/camposEquipamento.js'
import { montarFichaTecnica } from '../../../../backend/src/utils/catalogo/fichaTecnicaMap.js'
import hoymiles from '../../../../backend/src/ai/__fixtures__/golden/hoymiles_hms.json'

/**
 * P1-MICRO-READINESS-01 — valida que a infra atual suporta microinversores
 * reais (Hoymiles, APsystems, TSUN, NEP) ponta-a-ponta, SEM bancos paralelos
 * nem modelo específico de micro.
 */

describe('1. Reconhecimento de fabricante + topologia MICRO', () => {
  const CASOS = [
    ['Hoymiles HMS-2000DW-4T microinversor', 'Hoymiles'],
    ['APsystems QT2D microinverter 4 canais', 'APsystems'],
    ['TSUN microinversor TSOL-MX3000D Gen3', 'TSUN'],
    ['NEP microinversor MINV BDM-2250', 'NEP'],
  ]
  for (const [texto, fab] of CASOS) {
    it(`${fab}: fabricante reconhecido e topologia = MICRO`, () => {
      const fm = extrairFabricanteModelo(texto)
      expect(fm.fabricante).toBe(fab)
      expect(derivarTopologia({}, { fabricante: fm.fabricante, modelo: fm.modelo })).toBe(TOPOLOGIA.MICRO)
    })
  }
})

describe('2. Hoymiles HMS — extração REAL do datasheet (matricial)', () => {
  const r = montarMatriz(hoymiles.tokens, [])
  it('auto-detecta a família HMS-1600/1800/2000DW-4T', () => {
    expect(r.ok).toBe(true)
    expect(r.modelos).toEqual(['HMS-1600DW-4T', 'HMS-1800DW-4T', 'HMS-2000DW-4T'])
  })
  it('HMS-2000: MICRO, 2 MPPT, entradas_por_mppt=[2,2], Vmáx=65', () => {
    const esp = r.porModelo['HMS-2000DW-4T'].especificacoes
    const c = lerInversor(esp, { fabricante: 'Hoymiles', modelo: 'HMS-2000DW-4T' })
    expect(c.tipo_topologia).toBe(TOPOLOGIA.MICRO)
    expect(c.n_mppts).toBe(2)
    expect(c.entradas_por_mppt).toEqual([2, 2])
    expect(c.tensao_max_entrada).toBe(65)
  })
})

describe('3. entradas_por_mppt para micros (saídas/MPPT e total CC)', () => {
  it('Hoymiles "saídas por MPPT"=2, 2 MPPT → [2,2]', () => {
    expect(normalizarEntradasPorMppt({ strings_por_mppt: 2, n_mppts: 2 })).toEqual([2, 2])
  })
  it('TSUN MX3000D: total 6 entradas CC, 3 MPPT → [2,2,2]', () => {
    expect(normalizarEntradasPorMppt({ total_entradas_cc: 6, n_mppts: 3 })).toEqual([2, 2, 2])
  })
  it('APsystems QT2D: total 4 entradas, 4 MPPT → [1,1,1,1]', () => {
    expect(normalizarEntradasPorMppt({ total_entradas_cc: 4, n_mppts: 4 })).toEqual([1, 1, 1, 1])
  })
  it('distribuição com resto: 5 entradas, 2 MPPT → [3,2]', () => {
    expect(normalizarEntradasPorMppt({ total_entradas_cc: 5, n_mppts: 2 })).toEqual([3, 2])
  })
})

describe('4. Importação Assistida — "Módulos por MPPT" (MICRO) vs "Strings por MPPT" (STRING)', () => {
  it('MICRO exibe "Módulos por MPPT"', () => {
    const campos = classificarCampos('inversor', { tipo_topologia: 'MICRO', entradas_por_mppt: [2, 2, 2] })
    const ent = campos.find(c => c.key === 'entradas_por_mppt')
    expect(ent.label).toMatch(/Módulos por MPPT/)
    expect(ent.valor).toBe('2/2/2')
  })
  it('STRING exibe "Strings por MPPT"', () => {
    const campos = classificarCampos('inversor', { tipo_topologia: 'STRING', entradas_por_mppt: [2, 1] })
    const ent = campos.find(c => c.key === 'entradas_por_mppt')
    expect(ent.label).toMatch(/Strings por MPPT/)
  })
})

describe('5. Catálogo / Ficha Técnica exibe Topologia + MPPT + Entradas', () => {
  it('ficha do micro mostra Topologia=MICRO, Nº MPPT e Entradas por MPPT', () => {
    const eq = { tipo: 'inversor', fabricante: 'TSUN', modelo: 'TSOL-MX3000D', especificacoes: { tipo_topologia: 'MICRO', n_mppts: 3, entradas_por_mppt: [2, 2, 2], potencia_maxima_kw: 3.3 } }
    const ficha = montarFichaTecnica(eq)
    const cc = ficha.grupos.find(g => g.titulo === 'Entrada CC').campos
    const get = (rot) => cc.find(c => c.rotulo === rot)?.valor
    expect(get('Topologia')).toBe('MICRO')
    expect(get('Nº MPPT')).toBe(3)
    expect(get('Entradas por MPPT')).toEqual([2, 2, 2])
  })
})
