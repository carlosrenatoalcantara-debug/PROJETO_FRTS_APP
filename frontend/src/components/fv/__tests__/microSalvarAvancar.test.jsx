import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/**
 * Item 3 (opção A) — micro no wizard legado.
 * "Salvar e avançar" não depende da análise de STRING (que não se aplica a
 * micro e por isso nunca devolvia resultado): o mock devolve `resultado: null`
 * de propósito. O fato do micro é `arranjos[].configuracao_eletrica.micros[]`,
 * gravado pela etapa — nunca `engenharia_eletrica`. Dados fictícios.
 */
vi.mock('../../../hooks/useCompatibilidadeEletrica', () => ({
  useCompatibilidadeEletrica: () => ({ resultado: null, carregando: false, erro: null }),
}))

import ConfiguradorArranjoFV from '../ConfiguradorArranjoFV'
import { microsDoArranjoLegado } from '../../../utils/microsDoArranjoLegado'

const PAINEL = { id: 'mod-teste', _fonte: 'catalogo', marca: 'Teste', modelo: 'M-620', potenciaW: 620, voc: 55, vmpp: 46, isc: 14, impp: 13.5, coef_temp_voc: -0.25, temp_noct: 45 }
const micro = (extra = {}) => ({
  id: '64b000000000000000000001', _fonte: 'catalogo', marca: 'Teste', modelo: 'MICRO-2K', potenciaKW: 2, nMppts: 2, tipo: 'micro',
  topologia: 'MICRO', _eletrico: { topologia: 'MICRO', tensao_max_entrada: 60, mppt_min: 16, mppt_max: 60, corrente_max_mppt: 20, potencia_ca_kw: 2 },
  _micro: { entradas: 4, modulos_por_entrada: 1 },
  ...extra,
})

let onSaveAndNext
beforeEach(() => {
  onSaveAndNext = vi.fn()
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
})
const montar = (inversor) => render(
  <ConfiguradorArranjoFV painel={PAINEL} inversor={inversor} numPaineis={16} uf="RN" projetoId="p1" dispatch={vi.fn()} tipoLigacao="monofasico" onSaveAndNext={onSaveAndNext} />,
)

describe('configurador — micro avança sem a análise de string', () => {
  it('"Salvar e avançar" habilitado e delega à etapa, sem gravar engenharia_eletrica', () => {
    montar(micro())
    const botao = screen.getByText(/Salvar e avançar/).closest('button')
    expect(botao.disabled).toBe(false)
    fireEvent.click(botao)
    expect(onSaveAndNext).toHaveBeenCalledTimes(1)
    const gravouEngenharia = global.fetch.mock.calls.some(([, init]) => String(init?.body ?? '').includes('engenharia_eletrica'))
    expect(gravouEngenharia).toBe(false)
  })

  it('sem "Salvar configuração" para micro (gravaria bloco que o backend descarta)', () => {
    montar(micro())
    expect(screen.queryByText(/Salvar configuração/)).toBeNull()
  })

  it('sem bloqueio de oversizing contra a potência de UM micro', () => {
    montar(micro())
    expect(document.body.textContent).not.toMatch(/acima do limite de segurança/)
  })

  it('cadastro incompleto continua bloqueando', () => {
    montar(micro({ _micro: { entradas: null, modulos_por_entrada: null } }))
    expect(screen.getByText(/Salvar e avançar/).closest('button').disabled).toBe(true)
  })
})

describe('microsDoArranjoLegado — mesmo fato que o fluxo canônico grava', () => {
  it('16 módulos, 4 micros de 4×1: distribuição [4,4,4,4] e referência ao catálogo', () => {
    const [m] = microsDoArranjoLegado({ inversor: micro(), numModulos: 16, quantidade: 4, fases: 'monofasico' })
    expect(m).toMatchObject({
      equipamento_id: '64b000000000000000000001', modelo: 'MICRO-2K', quantidade: 4,
      entradas_por_micro: 4, modulos_por_entrada: 1, distribuicao: [4, 4, 4, 4],
    })
  })
  it('faltou capacidade, quantidade ou módulos ⇒ null (nunca presumido)', () => {
    expect(microsDoArranjoLegado({ inversor: micro({ _micro: { entradas: null, modulos_por_entrada: 1 } }), numModulos: 16, quantidade: 4 })).toBeNull()
    expect(microsDoArranjoLegado({ inversor: micro(), numModulos: 16, quantidade: null })).toBeNull()
    expect(microsDoArranjoLegado({ inversor: micro(), numModulos: 0, quantidade: 4 })).toBeNull()
  })
  it('inversor string ⇒ null', () => {
    expect(microsDoArranjoLegado({ inversor: { ...micro(), tipo: 'string' }, numModulos: 16, quantidade: 4 })).toBeNull()
  })
})
