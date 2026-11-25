import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  agruparCampos, aplicarCampo, classificarCampos, errosDeCampos, obterCamposEditaveis, resumirQualidade,
} from '@fortesolar/fv-shared/ai/campos-equipamento'
import EdicaoInversor from '../components/equipamentos/EdicaoInversor'
import ConfirmarExclusao from '../components/equipamentos/ConfirmarExclusao'
import ModalNovoModulo from '../components/equipamentos/ModalNovoModulo'
import { normalizarMulti } from '../../../backend/src/ai/normalizarMulti.js'
import { envelopeDoMicro } from '../fv/catalogo'
import { reidratarDoCatalogo } from '../fv/microinversores'

/** Pedido de 2026-11-25: categorias do catálogo, micros por arranjo, exclusão e repetidos por tensão. */
const MICRO = {
  _id: 'h1', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2250DW-4T',
  especificacoes: {
    potencia_kw: 2.25, subtipo: 'microinversor', tipo_topologia: 'MICRO', fases: 1, entradas: 4,
    modulos_por_entrada: 1, corrente_max_por_mppt: '18', corrente_isc_max: 25, corrente_ac_saida: 10.23,
  },
}
const chaves = (tipo, id, ctx = {}) => agruparCampos(tipo, classificarCampos(tipo, {}, {}, ctx))
  .find((g) => g.id === id).campos.map((c) => c.key)

beforeEach(() => { global.fetch = vi.fn() })

describe('categorias', () => {
  it('inversor e micro: CA, CC e físico-mecânicas (com garantia e certificações), nessa ordem', () => {
    for (const ctx of [{}, { micro: true }]) {
      const g = agruparCampos('inversor', classificarCampos('inversor', {}, {}, ctx))
      expect(g.map((x) => x.id)).toEqual(['ca', 'cc', 'mec'])
    }
    expect(chaves('inversor', 'ca')).toEqual(expect.arrayContaining(['potencia_kw', 'tensao_ac', 'corrente_ac_saida', 'faixa_tensao_rede']))
    expect(chaves('inversor', 'cc')).toEqual(expect.arrayContaining(['n_mppts', 'tensao_max_entrada', 'corrente_isc_max', 'oversizing_max']))
    expect(chaves('inversor', 'mec')).toEqual(expect.arrayContaining(['peso_kg', 'dimensoes', 'garantia_anos', 'certificacoes']))
  })
  it('módulo: elétricas e mecânicas', () => {
    expect(agruparCampos('modulo', classificarCampos('modulo')).map((x) => x.id)).toEqual(['ele', 'mec'])
    expect(chaves('modulo', 'ele')).toContain('coef_temp_voc')
    expect(chaves('modulo', 'mec')).toEqual(expect.arrayContaining(['garantia_produto_anos', 'certificacoes']))
  })
  it('todo campo de inversor e módulo tem categoria; campo sem grupo não some', () => {
    for (const t of ['inversor', 'modulo']) expect(obterCamposEditaveis(t).filter((c) => !c.grupo)).toEqual([])
    expect(agruparCampos('inversor', [{ key: 'x' }])[0].campos[0].key).toBe('x')
  })
  it('complementares não alteram o percentual de completude', () => {
    const a = resumirQualidade('inversor', { potencia_kw: 10, n_mppts: 2 })
    const b = resumirQualidade('inversor', { potencia_kw: 10, n_mppts: 2, oversizing_max: 1.3, fases: 3 })
    expect(b.percentual).toBe(a.percentual)
  })
})

describe('micros por arranjo', () => {
  it('campo existe só no micro e lê os nomes antigos', () => {
    expect(chaves('inversor', 'ca', { micro: true })).toContain('max_por_cabo_tronco')
    expect(chaves('inversor', 'ca')).not.toContain('max_por_cabo_tronco')
    const c = classificarCampos('inversor', { max_micros_por_ramal: 5 }, {}, { micro: true })
      .find((x) => x.key === 'max_por_cabo_tronco')
    expect(c.valor).toBe(5)
    expect(aplicarCampo({ max_micros_por_ramal: 5 }, c, 3)).toEqual({ max_por_cabo_tronco: 3 })
    expect(aplicarCampo({ max_micros_por_ramal: 5 }, c, '')).toEqual({})
  })
  it('recusa fração, zero e CC/CA em porcentagem', () => {
    const erros = (e) => errosDeCampos(classificarCampos('inversor', e, {}, { micro: true }))
    expect(erros({ max_por_cabo_tronco: 2.5 })[0]).toMatch(/inteiro/)
    expect(erros({ max_por_cabo_tronco: 0 })[0]).toMatch(/mínimo 1/)
    expect(erros({ oversizing_max: 130 })[0]).toMatch(/máximo 3/)
    expect(erros({ max_por_cabo_tronco: 3, oversizing_max: 1.3 })).toEqual([])
    expect(erros({})).toEqual([])
  })
  it('editar e salvar grava o limite como número', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ _id: 'h1' }) })
    const onSalvar = vi.fn()
    render(<EdicaoInversor inversor={MICRO} onClose={() => {}} onSalvar={onSalvar} />)
    expect(screen.getByText('CA — saída para a rede')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Máx. de micros por arranjo/), { target: { value: '3' } })
    fireEvent.click(screen.getByText('Salvar'))
    await waitFor(() => expect(onSalvar).toHaveBeenCalled())
    const corpo = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(corpo.especificacoes.max_por_cabo_tronco).toBe(3)
    expect(corpo.especificacoes.corrente_isc_max).toBe(25)
  })
  it('o catálogo entrega o limite de curto ao motor, e o bloco em edição relê o cadastro', () => {
    expect(envelopeDoMicro(MICRO).corrente_isc_max).toBe(25)
    const antes = [{ equipamento_id: 'h1', modulos: 24, entradas_por_micro: 2, _max_por_cabo_tronco: null }]
    const novo = { ...MICRO, especificacoes: { ...MICRO.especificacoes, max_por_cabo_tronco: 3 } }
    const [b] = reidratarDoCatalogo(antes, [novo])
    expect(b).toMatchObject({ modulos: 24, entradas_por_micro: 2, modulos_por_entrada: 1, _max_por_cabo_tronco: 3 })
  })
})

describe('excluir', () => {
  it('pede confirmação na página, sem confirm() do navegador, e exclui', async () => {
    const confirmar = vi.fn(() => false)
    vi.stubGlobal('confirm', confirmar)
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    const ok = vi.fn()
    render(<ConfirmarExclusao equipamento={MICRO} onFechar={() => {}} onExcluido={ok} />)
    expect(global.fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Excluir'))
    await waitFor(() => expect(ok).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith('/api/equipamentos/h1', { method: 'DELETE' })
    expect(confirmar).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
  it('recusa do servidor aparece na tela', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 409, json: () => Promise.resolve({ erro: 'Em uso em 1 projeto(s).' }) })
    const ok = vi.fn()
    render(<ConfirmarExclusao equipamento={MICRO} onFechar={() => {}} onExcluido={ok} />)
    fireEvent.click(screen.getByText('Excluir'))
    expect((await screen.findByRole('alert')).textContent).toContain('Em uso em 1 projeto')
    expect(ok).not.toHaveBeenCalled()
  })
})

describe('importação: uma tensão por linha não vira um cadastro por tensão', () => {
  const v = (modelo, i, extra = {}) => ({ modelo_variante: modelo, potencia_nominal_kw: 2.25, n_mppts: 2, corrente_ac_saida: i, ...extra })
  const importar = (variantes) => normalizarMulti({ fabricante: 'Hoymiles', tipo: 'inversor', subtipo: 'microinversor', variantes })
  it('208/220/230/240 V do mesmo micro → um item, com a MAIOR corrente', () => {
    const itens = importar([
      v('HMS-2250DW-4T (208V)', 10.82), v('HMS-2250DW-4T (220V)', 10.23),
      v('HMS-2250DW-4T (230V)', 9.78), v('HMS-2250DW-4T (240V)', 9.38),
    ])
    expect(itens).toHaveLength(1)
    expect(itens[0].modelo).toBe('HMS-2250DW-4T')
    expect(itens[0].especificacoes).toMatchObject({ tensao_ac: '208/220/230/240', corrente_ac_saida: 10.82 })
  })
  it('potências diferentes continuam separadas; sufixo único e nomes sem tensão ficam como estão', () => {
    expect(importar([v('X (220V)', 10), v('X (380V)', 10, { potencia_nominal_kw: 5 })]).map((i) => i.modelo)).toEqual(['X (220V)', 'X (380V)'])
    expect(importar([v('Y (220V)', 10)])[0].modelo).toBe('Y (220V)')
    expect(importar([v('A-1', 1), v('A-2', 2)]).map((i) => i.modelo)).toEqual(['A-1', 'A-2'])
  })
})

describe('módulo: garantias continuam no topo do documento', () => {
  it('edita garantia e coeficiente sem criar segunda fonte', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    const onSalvar = vi.fn()
    const modulo = {
      _id: 'm1', tipo: 'modulo', fabricante: 'R', modelo: 'M', preco_sugerido: 0,
      garantia_produto: { value: 15, unit: 'anos' }, especificacoes: { potencia_wp: 620, celulas: 132 },
    }
    render(<ModalNovoModulo modulo={modulo} onClose={() => {}} onSalvar={onSalvar} />)
    expect(screen.getByLabelText('Garantia produto (anos)').value).toBe('15')
    expect(screen.getByLabelText('Nº de células').value).toBe('132')
    fireEvent.change(screen.getByLabelText('Garantia produto (anos)'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText(/Coef. temp. Voc/), { target: { value: '-0.25' } })
    fireEvent.click(screen.getByText('Salvar'))
    await waitFor(() => expect(onSalvar).toHaveBeenCalled())
    const corpo = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(corpo.garantia_produto).toEqual({ value: 12, unit: 'anos' })
    expect(corpo.especificacoes.garantia_produto_anos).toBeUndefined()
    expect(corpo.especificacoes.coef_temp_voc).toBe(-0.25)
  })
})
