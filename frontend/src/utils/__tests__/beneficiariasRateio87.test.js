import { describe, it, expect } from 'vitest'
import {
  calcularSomaRateio, validarRateio, parsearTextoExcel, parsearCSV,
  normalizarParaCem, MODALIDADES_GD,
} from '../../../../backend/src/utils/beneficiarias/beneficiariaRateio.js'

/**
 * Sprint 8.7 — Beneficiárias e Rateio GD (Lei 14.300).
 */

const b = (contaContrato, valor, ativa = true) => ({ contaContrato, tipoRateio: 'percentual', valor, ativa })

describe('S8.7 — cálculo e validação do rateio', () => {
  // 1) 1 UC = 100%
  it('1 UC com 100% é válido', () => {
    const val = validarRateio([b('123', 100)])
    expect(val.ok).toBe(true)
    expect(val.soma).toBeCloseTo(100, 2)
    expect(val.status).toBe('ok')
  })

  // 2) 2 UCs = 50/50
  it('2 UCs 50/50 são válidas', () => {
    const val = validarRateio([b('A', 50), b('B', 50)])
    expect(val.ok).toBe(true)
    expect(val.soma).toBe(100)
  })

  // 3) Rateio inválido: falta 5%
  it('rateio incompleto (95%) retorna status incompleto', () => {
    const val = validarRateio([b('A', 60), b('B', 35)])
    expect(val.ok).toBe(false)
    expect(val.status).toBe('incompleto')
    expect(val.diferenca).toBeCloseTo(5, 1)
  })

  // 4) Rateio excedido (110%)
  it('rateio excedido (110%) retorna status excedido', () => {
    const val = validarRateio([b('A', 70), b('B', 40)])
    expect(val.ok).toBe(false)
    expect(val.status).toBe('excedido')
  })

  // 5) UCs inativas não entram na soma
  it('UCs inativas não entram no rateio', () => {
    const lista = [b('A', 80), { ...b('B', 20), ativa: false }]
    const soma = calcularSomaRateio(lista)
    expect(soma).toBe(80)
  })
})

describe('S8.7 — parse de texto Excel (colar)', () => {
  // 6) 5 UCs via texto Excel (separador ;)
  const excel5ucs = `UC;Titular;Percentual
111111;Empresa A;20
222222;Empresa B;20
333333;Empresa C;20
444444;Empresa D;20
555555;Empresa E;20`

  it('parseia 5 UCs coladas do Excel e valida 100%', () => {
    const res = parsearTextoExcel(excel5ucs)
    expect(res.ok).toBe(true)
    expect(res.linhas.length).toBe(5)
    expect(validarRateio(res.linhas).ok).toBe(true)
    expect(res.linhas[0].titular).toBe('Empresa A')
    expect(res.linhas[0].contaContrato).toBe('111111')
    expect(res.linhas[0].valor).toBe(20)
  })

  // 7) Separador tab (TSV)
  it('parseia texto TSV (Excel nativo)', () => {
    const tsv = 'UC\tTitular\tPercentual\n900001\tCliente X\t100'
    const res = parsearTextoExcel(tsv)
    expect(res.ok).toBe(true)
    expect(res.linhas[0].valor).toBe(100)
    expect(res.separador).toBe('\t')
  })

  // 8) CSV importado normaliza CPF
  it('parsearCSV normaliza CPF/CNPJ', () => {
    const csv = 'UC;CPF/CNPJ;Percentual\n123456;12.345.678/0001-90;60\n654321;98.765.432/0001-10;40'
    const res = parsearCSV(csv)
    expect(res.ok).toBe(true)
    expect(res.linhas[0].cpf_cnpj).toBe('12345678000190')   // sem pontuação
    expect(res.rateio.ok).toBe(true)
  })
})

describe('S8.7 — normalização para 100%', () => {
  // 9) Diferença ≤ 0.5% é corrigida automaticamente no último item
  it('normalizarParaCem ajusta diferença de arredondamento', () => {
    const lista = [b('A', 33.33), b('B', 33.33), b('C', 33.33)]  // soma = 99.99
    const norm = normalizarParaCem(lista)
    expect(calcularSomaRateio(norm)).toBeCloseTo(100, 2)
  })
})

describe('S8.7 — modalidades GD (Lei 14.300)', () => {
  // 10) As 4 modalidades exigidas pela spec
  it('expõe as 4 modalidades da Lei 14.300', () => {
    const ids = MODALIDADES_GD.map(m => m.id)
    expect(ids).toContain('autoconsumo_local')
    expect(ids).toContain('autoconsumo_remoto')
    expect(ids).toContain('geracao_compartilhada')
    expect(ids).toContain('condominio')
    expect(MODALIDADES_GD.length).toBe(4)
  })
})
