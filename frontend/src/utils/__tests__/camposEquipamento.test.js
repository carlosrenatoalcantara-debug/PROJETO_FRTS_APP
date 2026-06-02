import { describe, it, expect } from 'vitest'
import {
  obterCamposEditaveis,
  classificarCampos,
  resumirQualidade,
  STATUS,
} from '../../../../backend/src/ai/camposEquipamento.js'

/** P0-INV-CAT-03 — esquema de campos + classificador 🟢🟡🔴 (importação assistida). */

describe('camposEquipamento — esquema por tipo', () => {
  it('cada tipo tem campos e um obrigatório de potência/capacidade', () => {
    for (const tipo of ['inversor', 'modulo', 'bateria', 'carregador_ev']) {
      const campos = obterCamposEditaveis(tipo)
      expect(campos.length).toBeGreaterThan(4)
      expect(campos.some(c => c.obrigatorio)).toBe(true)
    }
  })
  it('tipo desconhecido cai em inversor', () => {
    expect(obterCamposEditaveis('xpto')).toEqual(obterCamposEditaveis('inversor'))
  })
})

describe('classificarCampos — Goodwe GW25K-DT parcial', () => {
  // Specs extraídas (faltam garantia e certificações — caso real do critério de aceite)
  const espec = { potencia_kw: 25, n_mppts: 2, tensao_max_entrada: 1000, eficiencia_maxima: 98.4, peso_kg: 30, dimensoes: '520x415x195', grau_protecao_ip: 'IP66' }

  it('marca presentes como verde e ausentes opcionais como amarelo', () => {
    const campos = classificarCampos('inversor', espec)
    const byKey = Object.fromEntries(campos.map(c => [c.key, c]))
    expect(byKey.potencia_kw.status).toBe(STATUS.OK)
    expect(byKey.eficiencia_maxima.status).toBe(STATUS.OK)
    expect(byKey.garantia_anos.status).toBe(STATUS.AUSENTE)      // opcional ausente → amarelo
    expect(byKey.certificacoes.status).toBe(STATUS.AUSENTE)
  })

  it('campo obrigatório ausente vira vermelho e bloqueia salvar', () => {
    const semPotencia = { ...espec }
    delete semPotencia.potencia_kw
    const campos = classificarCampos('inversor', semPotencia)
    const pot = campos.find(c => c.key === 'potencia_kw')
    expect(pot.status).toBe(STATUS.OBRIGATORIO)
    expect(resumirQualidade('inversor', semPotencia).podeSalvar).toBe(false)
  })

  it('resumirQualidade calcula % e lista faltantes', () => {
    const r = resumirQualidade('inversor', espec)
    expect(r.percentual).toBeGreaterThan(0)
    expect(r.percentual).toBeLessThan(100)
    expect(r.faltantes).toEqual(expect.arrayContaining(['Garantia (anos)', 'Certificações']))
    expect(r.obrigatoriosFaltando).toHaveLength(0)   // potência presente
    expect(r.podeSalvar).toBe(true)                  // sem obrigatório pendente → pode salvar
  })

  it('corrigir manualmente a garantia eleva a qualidade', () => {
    const antes = resumirQualidade('inversor', espec).percentual
    const depois = resumirQualidade('inversor', { ...espec, garantia_anos: 10, certificacoes: 'INMETRO' }).percentual
    expect(depois).toBeGreaterThan(antes)
  })
})
