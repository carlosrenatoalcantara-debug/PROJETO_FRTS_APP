import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Regressão do cenário gravado pelo operador em 15/11/2026 (wizard legado):
 * 16 módulos de 620 W + Hoymiles HMS-2250DW-4T. Lá não havia onde informar a
 * quantidade de micros e o avanço travava. No fluxo canônico a quantidade é do
 * operador, a lacuna do catálogo é dita, e salvar nunca é bloqueado.
 *
 * O registro do micro reproduz o cadastro REAL: sem `entradas`, sem
 * `modulos_por_entrada`, potência nominal (3) maior que a máxima (2,25).
 * Nenhum dado de cliente — só equipamento.
 */
const HOYMILES_REAL = {
  _id: 'mi2', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2250DW-4T',
  origem: { tipo: 'manual', fonte: null },
  especificacoes: {
    potencia_kw: 3, potencia_maxima_kw: 2.25, corrente_ac_saida: 10.82,
    n_mppts: 2, strings_por_mppt: 2, tensao_max_entrada: 65,
    corrente_max_por_mppt: 18, tipo_topologia: 'MICRO',
  },
}

const { salvarEtapa } = vi.hoisted(() => ({ salvarEtapa: vi.fn() }))
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: { _id: 'p1', arranjos: [] }, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))
const { default: EtapaMicroinversores } = await import('../paginas/etapas/EtapaMicroinversores')

const ARRANJO = {
  tipo: 'principal', topologia: 'micro',
  inversores: [{ equipamento_id: 'mi2', quantidade: 4 }],
  paineis: [{ equipamento_id: 'm620', quantidade: 16 }],
}

function montar() {
  return render(
    <EtapaMicroinversores
      catalogoInversores={[HOYMILES_REAL]} arranjoPrincipal={ARRANJO}
      totalModulos={16} potenciaModuloW={620} fases="Trifásico"
    />,
  )
}
const campo = (rotulo) => screen.getByLabelText(rotulo)
const digitar = (rotulo, valor) => fireEvent.change(campo(rotulo), { target: { value: String(valor) } })

beforeEach(() => { salvarEtapa.mockReset().mockResolvedValue({}) })

describe('16 × 620 W + HMS-2250DW-4T com o cadastro real', () => {
  it('a quantidade de micros vem da composição e é EDITÁVEL', () => {
    montar()
    const q = campo('Quantidade de microinversores 1')
    expect(q.value).toBe('4')
    expect(q.readOnly).toBe(false)
    digitar('Quantidade de microinversores 1', 5)
    expect(campo('Quantidade de microinversores 1').value).toBe('5')
  })

  it('catálogo sem entradas: lacuna dita, nada assumido, com ação de correção', () => {
    montar()
    expect(campo('Entradas por micro 1').value).toBe('')
    expect(campo('Módulos por entrada 1').value).toBe('')
    const proc = campo('Procedência da capacidade 1')
    expect(proc.textContent).toMatch(/Capacidade não determinada/)
    expect(proc.querySelector('a').getAttribute('href')).toBe('/equipamentos/inversores')
    // Sem capacidade não se oferece atribuição — seria capacidade inventada.
    expect(screen.queryByText(/Atribuir \d+ módulo/)).toBeNull()
    expect(screen.getByText('16 módulo(s) ainda não atribuído(s) a nenhum microinversor.')).toBeTruthy()
  })

  it('potência 3 × 2,25 kW: conflito visível, com link, e nenhum valor escolhido', () => {
    montar()
    const bloco = campo('Cadastro inconsistente 1')
    expect(bloco.textContent).toMatch(/nenhum dos valores é usado no cálculo/i)
    expect(bloco.querySelector('a').getAttribute('href')).toBe('/equipamentos/inversores')
    expect(screen.getByText(/potência não declarada/)).toBeTruthy()
  })

  it('capacidade manual 4×1 → atribui os 16 por ação explícita → 4 micros de 4 módulos', () => {
    montar()
    digitar('Entradas por micro 1', 4)
    digitar('Módulos por entrada 1', 1)
    expect(campo('Procedência da capacidade 1').textContent).toMatch(/informado manualmente/)
    // Não preenche sozinho: oferece.
    expect(campo('Módulos do modelo 1').value).toBe('')
    fireEvent.click(screen.getByText('Atribuir 16 módulo(s) a este modelo'))
    expect(campo('Módulos do modelo 1').value).toBe('16')
    for (const n of [1, 2, 3, 4]) expect(campo(`Micro ${n}`).textContent).toMatch(/4 módulo\(s\)/)
    expect(screen.queryByText(/ainda não atribuído/)).toBeNull()
    expect(screen.getByText('16 de 16')).toBeTruthy()
  })

  it('a atribuição oferecida nunca passa da capacidade do modelo', () => {
    montar()
    digitar('Quantidade de microinversores 1', 3)
    digitar('Entradas por micro 1', 4)
    digitar('Módulos por entrada 1', 1)
    fireEvent.click(screen.getByText('Atribuir 12 módulo(s) a este modelo'))
    expect(campo('Módulos do modelo 1').value).toBe('12')
    expect(screen.getByText('4 módulo(s) ainda não atribuído(s) a nenhum microinversor.')).toBeTruthy()
  })

  it('salvar não é bloqueado e grava micros[] com a quantidade do operador', async () => {
    montar()
    digitar('Entradas por micro 1', 4)
    digitar('Módulos por entrada 1', 1)
    fireEvent.click(screen.getByText('Atribuir 16 módulo(s) a este modelo'))
    const salvar = screen.getByText('Salvar topologia')
    expect(salvar.disabled).toBe(false)
    fireEvent.click(salvar)
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalledTimes(1))
    const [etapa, { lista }] = salvarEtapa.mock.calls[0]
    expect(etapa).toBe('arranjos')
    const micros = lista[0].configuracao_eletrica.micros
    expect(micros).toHaveLength(1)
    expect(micros[0]).toMatchObject({
      equipamento_id: 'mi2', quantidade: 4, entradas_por_micro: 4, modulos_por_entrada: 1,
      distribuicao: [4, 4, 4, 4],
    })
    // INV-58: derivado e dado de catálogo não são persistidos no projeto.
    expect(micros[0]).not.toHaveProperty('_potencia_kw')
    expect(micros[0]).not.toHaveProperty('_conflitos')
  })
})
