import { describe, it, expect } from 'vitest'
import { obterCamposEditaveis, classificarCampos, resumirQualidade, rotuloEntradas, STATUS, PROVENIENCIA } from '../../../../backend/src/ai/camposEquipamento.js'

/**
 * P1-INV-UI-01 — alinhamento UI ↔ SSOT na edição de inversores.
 * A edição manual (EdicaoInversor) e a Importação Assistida usam o MESMO esquema
 * (camposEquipamento). Estes testes garantem cobertura, legendas e rótulo dinâmico.
 */

const KEYS = obterCamposEditaveis('inversor').map(c => c.key)

describe('FASE 3 — todos os campos relevantes do SSOT são editáveis', () => {
  const OBRIGATORIOS = ['tipo_topologia', 'entradas_por_mppt', 'potencia_maxima_kw', 'corrente_ac_saida', 'corrente_max_por_mppt', 'corrente_isc_max', 'eficiencia_maxima', 'peso_kg', 'dimensoes', 'grau_protecao_ip', 'certificacoes']
  for (const k of OBRIGATORIOS) {
    it(`campo editável: ${k}`, () => expect(KEYS).toContain(k))
  }
  it('entradas_por_mppt é TEXTO (suporta assimetria "3/3/2/2")', () => {
    const c = obterCamposEditaveis('inversor').find(x => x.key === 'entradas_por_mppt')
    expect(c.tipo).toBe('text')
  })
})

describe('FASE 4 — legenda EXTERNA (sem placeholder como documentação)', () => {
  it('TODO campo de inversor possui legenda (info)', () => {
    const semInfo = obterCamposEditaveis('inversor').filter(c => !c.info)
    expect(semInfo.map(c => c.key)).toEqual([])
  })
  it('legenda de entradas explica STRING vs MICRO', () => {
    const c = obterCamposEditaveis('inversor').find(x => x.key === 'entradas_por_mppt')
    expect(c.info).toMatch(/STRING/)
    expect(c.info).toMatch(/MICRO/i)
  })
})

describe('FASE 4/5 — rótulo dinâmico Strings/Módulos + array formatado', () => {
  it('STRING → "Strings por MPPT"; MICRO → "Módulos por MPPT"', () => {
    expect(rotuloEntradas('STRING')).toBe('Strings por MPPT')
    expect(rotuloEntradas('MICRO')).toBe('Módulos por MPPT')
  })
  it('classificarCampos formata array [3,3,2,2] → "3/3/2/2" e relabela', () => {
    const campos = classificarCampos('inversor', { tipo_topologia: 'MICRO', entradas_por_mppt: [2, 2, 2] })
    const ent = campos.find(c => c.key === 'entradas_por_mppt')
    expect(ent.valor).toBe('2/2/2')
    expect(ent.label).toMatch(/Módulos por MPPT/)
  })
})

describe('FASE 5 — status 🟢/🟡/🔴 consistente (mesma fonte das duas telas)', () => {
  it('presente → verde; obrigatório ausente → vermelho; opcional ausente → amarelo', () => {
    const campos = classificarCampos('inversor', { potencia_kw: 20 })
    const by = Object.fromEntries(campos.map(c => [c.key, c]))
    expect(by.potencia_kw.status).toBe(STATUS.OK)        // 🟢 presente
    expect(by.n_mppts.status).toBe(STATUS.OBRIGATORIO)   // 🔴 obrigatório ausente
    expect(by.peso_kg.status).toBe(STATUS.AUSENTE)       // 🟡 opcional ausente
  })
})

describe('FASE 6 — validação com 6 fabricantes (rótulo correto por topologia)', () => {
  const CASOS = [
    ['GoodWe',   { tipo_topologia: 'STRING', entradas_por_mppt: [2, 2], n_mppts: 2, potencia_kw: 25 }, 'Strings por MPPT'],
    ['Huawei',   { tipo_topologia: 'STRING', n_mppts: 10, potencia_kw: 100 }, 'Strings por MPPT'],
    ['Sungrow',  { tipo_topologia: 'STRING', n_mppts: 12, potencia_kw: 110 }, 'Strings por MPPT'],
    ['CHINT',    { tipo_topologia: 'STRING', entradas_por_mppt: [3, 3, 2, 2], n_mppts: 4 }, 'Strings por MPPT'],
    ['SolaX',    { tipo_topologia: 'HYBRID', n_mppts: 2, potencia_kw: 10 }, 'Strings por MPPT'],
    ['Hoymiles', { tipo_topologia: 'MICRO', entradas_por_mppt: [2, 2], n_mppts: 2 }, 'Módulos por MPPT'],
  ]
  for (const [fab, esp, rotulo] of CASOS) {
    it(`${fab}: rótulo de entradas = "${rotulo}" + qualidade calculável`, () => {
      const campos = classificarCampos('inversor', esp)
      const ent = campos.find(c => c.key === 'entradas_por_mppt')
      expect(ent.label).toMatch(new RegExp(rotulo))
      const q = resumirQualidade('inversor', esp)
      expect(q.percentual).toBeGreaterThanOrEqual(0)
      expect(q.encontrados + q.inferidos + q.pendentes).toBe(campos.length)
    })
  }
})
