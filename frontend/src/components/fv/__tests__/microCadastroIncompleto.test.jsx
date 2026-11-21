import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * Item 3 (opção A) — micro sem `entradas` no catálogo bloqueia com
 * "cadastro incompleto" e link para editar o equipamento. Dados fictícios.
 */
vi.mock('../../../hooks/useCompatibilidadeEletrica', () => ({
  useCompatibilidadeEletrica: () => ({ resultado: { compativel: true, erros: [], warnings: [], limites: {}, calculos: null, clima_utilizado: null }, carregando: false, erro: null }),
}))

import ConfiguradorArranjoFV from '../ConfiguradorArranjoFV'
import { dimensionarMicroinversor } from '../../../utils/dimensionarMicro'
import { adaptarInversor } from '../../../utils/catalogoEngenhariaAdapter'

const PAINEL = { id: 'mod-teste', _fonte: 'catalogo', marca: 'Teste', modelo: 'M-620', potenciaW: 620, voc: 55, vmpp: 46, isc: 14, impp: 13.5, coef_temp_voc: -0.25, temp_noct: 45 }
const micro = (extra = {}) => ({
  id: 'abc123', _fonte: 'catalogo', marca: 'Teste', modelo: 'MICRO-2K', potenciaKW: 2, nMppts: 2, tipo: 'micro',
  topologia: 'MICRO', _eletrico: { topologia: 'MICRO', tensao_max_entrada: 60, mppt_min: 16, mppt_max: 60, corrente_max_mppt: 20, potencia_ca_kw: 2 },
  ...extra,
})

let dispatch
beforeEach(() => {
  dispatch = vi.fn()
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
})
const montar = (inversor, extra = {}) => render(
  <ConfiguradorArranjoFV painel={PAINEL} inversor={inversor} numPaineis={16} uf="RN" projetoId="p1" dispatch={dispatch} tipoLigacao="monofasico" onSaveAndNext={() => {}} {...extra} />,
)

describe('micro sem entradas no catálogo (opção A)', () => {
  it('bloqueia com "cadastro incompleto" e link para editar o micro', () => {
    montar(micro({ _micro: { entradas: null, modulos_por_entrada: null } }))
    const caixa = screen.getByTestId('micro-cadastro-incompleto')
    expect(caixa.textContent).toMatch(/Cadastro incompleto: falta nº de entradas e módulos por entrada/)
    expect(caixa.querySelector('a').getAttribute('href')).toBe('/equipamentos/inversores?editar=abc123')
    expect(screen.getByText(/Salvar e avançar/).closest('button').disabled).toBe(true)
  })

  it('com entradas no catálogo: dimensiona e a quantidade de micros é editável', () => {
    montar(micro({ _micro: { entradas: 4, modulos_por_entrada: 1 } }))
    expect(screen.queryByTestId('micro-cadastro-incompleto')).toBeNull()
    const campo = screen.getByLabelText('Microinversores')
    expect(campo.value).toBe('4')
    expect(screen.getByText('mínimo 4')).toBeTruthy()
  })

  it('quantidade escolhida abaixo do mínimo: motivo real, sem mensagem genérica', () => {
    montar(micro({ _micro: { entradas: 4, modulos_por_entrada: 1 } }), { numMicros: 3 })
    expect(screen.getByTestId('micro-bloqueio').textContent).toMatch(/3 microinversor\(es\) não comportam 16 módulos — mínimo 4/)
    expect(screen.queryByText(/Selecione módulo e quantidade/)).toBeNull()
  })
})

describe('dimensionarMicroinversor — quantidade do projetista', () => {
  const m = { entradas: 4, modulos_por_entrada: 1, potencia_ca_kw: 2 }
  it('acima do mínimo é aceita e redistribui', () => {
    const r = dimensionarMicroinversor({ numModulos: 16, potenciaModuloW: 620, micro: m, quantidade: 5 })
    expect(r.valido).toBe(true)
    expect(r.qtdMicros).toBe(5)
    expect(r.qtdMinima).toBe(4)
  })
  it('sem quantidade usa o mínimo', () => {
    expect(dimensionarMicroinversor({ numModulos: 16, potenciaModuloW: 620, micro: m }).qtdMicros).toBe(4)
  })
})

describe('adaptarInversor — lado CC do micro vem do catálogo', () => {
  it('lê entradas/modulos_por_entrada pelos aliases', () => {
    const inv = adaptarInversor({ _id: 'x1', modelo: 'M', especificacoes: { total_entradas_cc: 4, modulos_por_entrada: 1 } })
    expect(inv._micro).toEqual({ entradas: 4, modulos_por_entrada: 1 })
  })
  it('ausente fica null (nunca presumido)', () => {
    expect(adaptarInversor({ _id: 'x2', modelo: 'M', especificacoes: {} })._micro).toEqual({ entradas: null, modulos_por_entrada: null })
  })
})
