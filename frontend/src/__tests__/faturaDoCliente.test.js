/**
 * Projeto FV nasce com o cadastro do cliente (docs/DECISAO_FLUXO_FV_2026-11.md,
 * lacuna 1). Sem isso o operador redigita consumo, ligação e concessionária.
 * Dados fictícios — nenhum cliente real.
 */
import { describe, it, expect } from 'vitest'
import { faturaDoCliente } from '../../../backend/src/dominio/projeto/faturaDoCliente.js'

const CLIENTE = {
  nome: 'Fulano de Tal',
  numero_cliente: '123.456.789-00',
  codigo_instalacao: '9988',
  distribuidora: 'COSERN',
  tipo_ligacao: 'Trifásico 380V',
  classificacao: 'B1',
  subgrupo: 'Residencial',
  consumo_kwh: 384,
  valor_kwh: 0.95,
  carga_instalada_kw: null,
  disjuntor_geral_a: null,
}

describe('faturaDoCliente', () => {
  it('copia os campos presentes, nos nomes de fatura_extracao', () => {
    expect(faturaDoCliente(CLIENTE)).toEqual({
      numero_cliente: '123.456.789-00',
      codigo_instalacao: '9988',
      concessionaria: 'COSERN',
      tipo_ligacao: 'Trifásico 380V',
      classificacao: 'B1',
      subgrupo: 'Residencial',
      consumo_mensal_kwh: 384,
      valor_kwh: 0.95,
    })
  })

  it('"não informado" do schema do Cliente (0 e string vazia) é omitido, nunca default', () => {
    const f = faturaDoCliente({ distribuidora: '', tipo_ligacao: '  ', consumo_kwh: 0, valor_kwh: 0, numero_cliente: '' })
    expect(f).toEqual({})
  })

  it('não grava tensão nem marca confirmação/método (nada foi extraído de documento)', () => {
    const f = faturaDoCliente(CLIENTE)
    expect(f).not.toHaveProperty('tensao_v')
    expect(f).not.toHaveProperty('confirmado_pelo_usuario')
    expect(f).not.toHaveProperty('metodo')
  })

  it('não copia dado pessoal para a fatura do projeto', () => {
    const f = faturaDoCliente({ ...CLIENTE, cpf_cnpj: '000.000.000-00', telefone: '84999990000' })
    expect(f).not.toHaveProperty('cpf_cnpj')
    expect(f).not.toHaveProperty('telefone')
    expect(f).not.toHaveProperty('nome')
  })

  it('entrada nula ou inválida devolve objeto vazio', () => {
    expect(faturaDoCliente(null)).toEqual({})
    expect(faturaDoCliente(undefined)).toEqual({})
    expect(faturaDoCliente('x')).toEqual({})
  })

  it('consumo e tarifa negativos ou não numéricos são omitidos', () => {
    expect(faturaDoCliente({ consumo_kwh: -5, valor_kwh: 'abc' })).toEqual({})
  })
})
