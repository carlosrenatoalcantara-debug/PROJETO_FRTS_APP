import { describe, it, expect } from 'vitest'
import {
  lerInversor, derivarTopologia, normalizarEntradasPorMppt, TOPOLOGIA,
} from '../../../../backend/src/equipamentos/inversores/index.js'
import { extrairSpecsInversor } from '../../../../backend/src/services/compatibilidadeFV.js'
import { classificarCampos, rotuloEntradas } from '../../../../backend/src/ai/camposEquipamento.js'

/**
 * P1-INV-TOPOLOGY-01 — lado CC canônico (entradas_por_mppt + tipo_topologia).
 * Dados conforme datasheets reais auditados (P1-INV-DOMAIN-01).
 */

describe('derivarTopologia (STRING | MICRO | HYBRID)', () => {
  it('string por padrão', () => {
    expect(derivarTopologia({}, { fabricante: 'GoodWe', modelo: 'GW25K-DT' })).toBe(TOPOLOGIA.STRING)
  })
  it('micro por fabricante (Hoymiles/APsystems/TSUN)', () => {
    expect(derivarTopologia({}, { fabricante: 'Hoymiles', modelo: 'HMS-2000DW-4T' })).toBe(TOPOLOGIA.MICRO)
    expect(derivarTopologia({}, { fabricante: 'APsystems', modelo: 'QT2D' })).toBe(TOPOLOGIA.MICRO)
    expect(derivarTopologia({}, { fabricante: 'TSUN', modelo: 'MX3000D' })).toBe(TOPOLOGIA.MICRO)
  })
  it('híbrido por subtipo/bateria', () => {
    expect(derivarTopologia({ subtipo: 'híbrido' })).toBe(TOPOLOGIA.HYBRID)
    expect(derivarTopologia({ suporta_bateria: true })).toBe(TOPOLOGIA.HYBRID)
  })
  it('respeita tipo_topologia já gravado', () => {
    expect(derivarTopologia({ tipo_topologia: 'MICRO' })).toBe(TOPOLOGIA.MICRO)
  })
})

describe('normalizarEntradasPorMppt — migração "3/3"→[3,3]', () => {
  it('"2/1" → [2,1]', () => expect(normalizarEntradasPorMppt({ strings_por_mppt: '2/1' })).toEqual([2, 1]))
  it('"1/1/1/1" → [1,1,1,1]', () => expect(normalizarEntradasPorMppt({ strings_por_mppt: '1/1/1/1' })).toEqual([1, 1, 1, 1]))
  it('"3" + 2 MPPT → [3,3] (GoodWe GW25K)', () => expect(normalizarEntradasPorMppt({ strings_por_mppt: '3', n_mppts: 2 })).toEqual([3, 3]))
  it('array já normalizado é preservado', () => expect(normalizarEntradasPorMppt({ entradas_por_mppt: [2, 2, 2] })).toEqual([2, 2, 2]))
  it('indeduzível → null', () => expect(normalizarEntradasPorMppt({})).toBeNull())
})

describe('Evidência por fabricante (datasheets reais)', () => {
  const CASOS = [
    { nome: 'GoodWe GW25K-DT', esp: { n_mppts: 2, strings_por_mppt: '3' }, ctx: { fabricante: 'GoodWe', modelo: 'GW25K-DT' }, topo: 'STRING', entradas: [3, 3] },
    { nome: 'Sungrow SG10RT',  esp: { n_mppts: 2, strings_por_mppt: '2/1' }, ctx: { fabricante: 'Sungrow', modelo: 'SG10RT' }, topo: 'STRING', entradas: [2, 1] },
    { nome: 'SAJ R5-8K',       esp: { n_mppts: 2, strings_por_mppt: '1/1' }, ctx: { fabricante: 'SAJ', modelo: 'R5-8K-S2' }, topo: 'STRING', entradas: [1, 1] },
    { nome: 'Hopewind HSSP6K', esp: { n_mppts: 2, entradas_por_mppt: [2, 1] }, ctx: { fabricante: 'Hopewind', modelo: 'HSSP6K-G01' }, topo: 'STRING', entradas: [2, 1] },
    { nome: 'TSUN MX3000D',    esp: { n_mppts: 3, strings_por_mppt: '2/2/2' }, ctx: { fabricante: 'TSUN', modelo: 'MX3000D' }, topo: 'MICRO', entradas: [2, 2, 2] },
    { nome: 'Hoymiles HMS-2000', esp: { n_mppts: 4, strings_por_mppt: '1/1/1/1' }, ctx: { fabricante: 'Hoymiles', modelo: 'HMS-2000DW-4T' }, topo: 'MICRO', entradas: [1, 1, 1, 1] },
    { nome: 'APsystems QT2D',  esp: { n_mppts: 4, entradas_por_mppt: [2, 2, 2, 2] }, ctx: { fabricante: 'APsystems', modelo: 'QT2D' }, topo: 'MICRO', entradas: [2, 2, 2, 2] },
  ]
  for (const c of CASOS) {
    it(`${c.nome}: topologia=${c.topo}, entradas_por_mppt=${JSON.stringify(c.entradas)}`, () => {
      const r = lerInversor(c.esp, c.ctx)
      expect(r.tipo_topologia).toBe(c.topo)
      expect(r.entradas_por_mppt).toEqual(c.entradas)
    })
  }
})

describe('compatibilidade: projetos existentes não quebram', () => {
  it('inversor legado SEM entradas: strings_por_mppt preservado, entradas derivado', () => {
    const esp = { potencia_kw: 5, vpv_max: 600, n_mppts: 2, strings_por_mppt: '2/2' }
    const r = lerInversor(esp, { fabricante: 'Growatt', modelo: 'MID' })
    expect(esp.strings_por_mppt).toBe('2/2')             // intacto (compat)
    expect(r.entradas_por_mppt).toEqual([2, 2])          // derivado
    expect(r.tipo_topologia).toBe('STRING')
  })
  it('dimensionamento recebe entradas_por_mppt como limite físico (sem alterar regras)', () => {
    const eq = { tipo: 'inversor', fabricante: 'Sungrow', modelo: 'SG10RT', especificacoes: { potencia_kw: 10, tensao_max_entrada: 1100, tensao_mppt_min: 160, tensao_mppt_max: 1000, corrente_isc_max: 30, n_mppts: 2, strings_por_mppt: '2/1' } }
    const d = extrairSpecsInversor(eq)
    expect(d.n_mppts).toBe(2)                            // regra elétrica intacta
    expect(d.entradas_por_mppt).toEqual([2, 1])          // limite físico exposto
    expect(d.max_entradas_total).toBe(3)
  })
})

describe('Importação Assistida: rótulo dinâmico', () => {
  it('STRING → "Strings por MPPT"; MICRO → "Módulos por MPPT"', () => {
    expect(rotuloEntradas('STRING')).toBe('Strings por MPPT')
    expect(rotuloEntradas('MICRO')).toBe('Módulos por MPPT')
  })
  it('classificarCampos formata array como "3/3" e relabela por topologia', () => {
    const campos = classificarCampos('inversor', { tipo_topologia: 'MICRO', entradas_por_mppt: [2, 2, 2] })
    const ent = campos.find(c => c.key === 'entradas_por_mppt')
    expect(ent.valor).toBe('2/2/2')
    expect(ent.label).toMatch(/Módulos por MPPT/)
  })
})
