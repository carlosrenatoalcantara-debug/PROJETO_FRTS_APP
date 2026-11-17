/**
 * Extração determinística de fatura (caminho PDF) — fixtures SINTÉTICAS.
 * Nenhum dado real: ver backend/src/dominio/fatura/__fixtures__/faturasSinteticas.js.
 */
import { describe, it, expect } from 'vitest'
import { extrairDadosDoTexto } from '../../../backend/src/dominio/fatura/textoFatura.js'
import {
  FATURA_COSERN_NOVA, FATURA_COSERN_LEGADA,
} from '../../../backend/src/dominio/fatura/__fixtures__/faturasSinteticas.js'

describe('refator sem mudança de comportamento — campos que já funcionavam', () => {
  const d = extrairDadosDoTexto(FATURA_COSERN_NOVA)
  it('nome, endereço, CEP, cidade, UF', () => {
    expect(d.nome).toBe('FULANO DE TAL TESTE')
    expect(d.endereco).toBe('RUA DOS TESTES 100 BAIRRO FICTICIO')
    expect(d.cep).toBe('59000-000')
    expect(d.cidade).toBe('CIDADE TESTE')
    expect(d.estado).toBe('RN')
  })
  it('classificação, subgrupo, ligação trifásica 380', () => {
    expect(d.classificacao).toBe('B1')
    expect(d.subgrupo).toBe('Residencial')
    expect(d.tipoLigacao).toBe('Trifásico 380V')
  })
})

describe('UC — número da unidade consumidora', () => {
  it('formato ATUAL: rótulo "NÚMERO DA UNIDADE CONSUMIDORA" + NNN.NNN.NNN-NN na linha seguinte', () => {
    expect(extrairDadosDoTexto(FATURA_COSERN_NOVA).numeroCliente).toBe('001.234.567-89')
  })
  it('formato LEGADO: "CÓDIGO DO CLIENTE" + só dígitos', () => {
    expect(extrairDadosDoTexto(FATURA_COSERN_LEGADA).numeroCliente).toBe('7012345678')
  })
  it('rótulo e valor na mesma linha', () => {
    const t = 'NÚMERO DA UNIDADE CONSUMIDORA: 009.876.543-21\nOUTRA LINHA'
    expect(extrairDadosDoTexto(t).numeroCliente).toBe('009.876.543-21')
  })
  it('armadilhas: sem o rótulo, débito em conta / medidor / chave / nota NÃO viram UC', () => {
    const semUc = FATURA_COSERN_NOVA
      .replace('NÚMERO DA UNIDADE CONSUMIDORA\n001.234.567-89\n', '')
    expect(extrairDadosDoTexto(semUc).numeroCliente).toBeNull()
  })
  it('rótulo presente mas valor fora do formato: não aceita qualquer número', () => {
    const t = 'NÚMERO DA UNIDADE CONSUMIDORA\n987654321\n'
    expect(extrairDadosDoTexto(t).numeroCliente).toBeNull()
  })
})

describe('média de consumo — 12 meses mais recentes', () => {
  it('fatura com 13 pontos usa só os 12 mais recentes (397, não 389)', () => {
    const d = extrairDadosDoTexto(FATURA_COSERN_NOVA)
    expect(d.periodoMeses).toBe(12)
    expect(d.mediaAnual).toBe(397)        // 4760 / 12 = 396,67
    expect(d.consumoKwh).toBe(397)
    // O ponto descartado é o MAIS ANTIGO (OUT/25 = 300), não o atual.
    expect(d.historico12Meses.some((h) => h.ano === '25' && h.mes === 'OUT')).toBe(false)
    expect(d.historico12Meses[0]).toMatchObject({ mes: 'OUT', ano: '26', consumo: 410 })
  })

  it('ordem embaralhada no texto não muda o resultado', () => {
    const linhas = FATURA_COSERN_NOVA.split('\n')
    const ini = linhas.findIndex((l) => l.startsWith('OUT26'))
    const bloco = linhas.slice(ini, ini + 13).reverse()
    const t = [...linhas.slice(0, ini), ...bloco, ...linhas.slice(ini + 13)].join('\n')
    expect(extrairDadosDoTexto(t).mediaAnual).toBe(397)
  })

  it('consumo com separador de milhar não é descartado', () => {
    const d = extrairDadosDoTexto(FATURA_COSERN_LEGADA)
    expect(d.periodoMeses).toBe(3)
    expect(d.historico12Meses.map((h) => h.consumo)).toEqual([210, 1050, 190])
    expect(d.mediaAnual).toBe(483)        // 1450 / 3 = 483,3
  })

  it('mês repetido conta uma vez', () => {
    const t = 'CONSUMO / kWh\nOUT26 400 30\nOUT26 400 30\nSET26 200 30\n'
    const d = extrairDadosDoTexto(t)
    expect(d.periodoMeses).toBe(2)
    expect(d.mediaAnual).toBe(300)
  })
})
