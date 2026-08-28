import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * FV-UX-028 — as cinco correções auditadas na FV-UX-027/027B.
 *
 * Todas consomem o que já existe. Nenhuma cria regra, default ou schema.
 */

const salvarEtapa = vi.fn()
const listarCatalogo = vi.fn()
const validar = vi.fn()

vi.mock('../api/agregadosFvApi', () => ({
  listarCatalogo: (...a) => listarCatalogo(...a),
  validarCompatibilidadeEletrica: (...a) => validar(...a),
}))

const MODULO = {
  _id: 'm1', tipo: 'modulo', fabricante: 'Znshine', modelo: 'ZXM7-650',
  especificacoes: { potencia_w: 650, voc_v: 45.5, isc_a: 18.35, vmpp_v: 38.1, impp_a: 17.06,
    coef_temp_voc_pct_c: -0.25, noct_c: 44 },
}
/** String trifásico, aliases canônicos. */
const INV_TRI = {
  _id: 'i1', tipo: 'inversor', fabricante: 'Sungrow', modelo: 'SG15RT',
  especificacoes: { potencia: 15, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
    tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 3 },
}
/** String monofásico. */
const INV_MONO = {
  _id: 'i2', tipo: 'inversor', fabricante: 'Sungrow', modelo: 'SG10RS',
  especificacoes: { potencia: 10, fases: 1, tensao_max_entrada: 1000, tensao_mppt_min: 80,
    tensao_mppt_max: 560, corrente_max_por_mppt: 25, n_mppts: 2 },
}
/** Microinversor. */
const INV_MICRO = {
  _id: 'i3', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2000-4T',
  especificacoes: { potencia: 2, fases: 1, tensao_max_entrada: 60, tensao_mppt_min: 16,
    tensao_mppt_max: 60, corrente_max_por_mppt: 16, n_mppts: 4 },
}
/** Híbrido. */
const INV_HIB = {
  _id: 'i4', tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN-12K-SG',
  especificacoes: { potencia: 12, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
    tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 3, suporta_bateria: true },
}
/** ALIAS `nMppts` — o SSOT reconhece; o leitor paralelo antigo NÃO reconhecia. */
const INV_ALIAS = {
  _id: 'i5', tipo: 'inversor', fabricante: 'Fronius', modelo: 'Primo 8.2-1',
  especificacoes: { potencia_kw: 8.2, fases_saida: 1, voc_max_dc: 1000, faixa_mppt_min: 80,
    faixa_mppt_max: 800, corrente_max_mppt: 18, nMppts: 2 },
}
/** Sem dados opcionais — tudo que faltar deve virar `—`. */
const INV_POBRE = {
  _id: 'i6', tipo: 'inversor', fabricante: 'Genérico', modelo: 'SEM-DADOS',
  especificacoes: { potencia: 5 },
}

const TODOS = [INV_TRI, INV_MONO, INV_MICRO, INV_HIB, INV_ALIAS, INV_POBRE]

const PROJETO = {
  _id: 'p1', nome: 'P',
  fatura_extracao: { tipo_ligacao: 'Monofásico', consumo_mensal_kwh: 1400 },
  equipamentos: { paineis: [], inversor: {} },
  dimensionamento: { num_paineis: 24 },
  localizacao: { cidade: 'Natal', estado: 'RN' },
  local_resolvido: { cidade: 'Natal', estado: 'RN' },
  engenharia_eletrica: null,
}

let projetoAtual = PROJETO
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))

import EtapaEquipamentos from '../paginas/etapas/EtapaEquipamentos'
import EtapaMppt from '../paginas/etapas/EtapaMppt'
import {
  rotuloDoInversor, avisoDeFase, nMpptsDoInversor, eletricoDoInversor,
  fasesDoInversor, tipoDoInversor, entradasPorMppt,
} from '../catalogo'

const OK = {
  compativel: true, erros: [], warnings: [],
  calculos: { voc_string_max: 561, vmpp_string_quente: 408, isc_total: 22.94 },
  clima_utilizado: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
}

beforeEach(() => {
  vi.clearAllMocks()
  projetoAtual = PROJETO
  listarCatalogo.mockImplementation((t) =>
    Promise.resolve({ equipamentos: t === 'modulo' ? [MODULO] : TODOS }))
  validar.mockResolvedValue(OK)
  salvarEtapa.mockResolvedValue(undefined)
})

// ═══ A5b · SSOT ═════════════════════════════════════════════════════════════
describe('A5b · catálogo consome o leitor SSOT', () => {
  it('1 · alias `nMppts` passa a ser reconhecido', () => {
    expect(nMpptsDoInversor(INV_ALIAS)).toBe(2)
  })

  it('2 · aliases de tensão e corrente também', () => {
    const e = eletricoDoInversor(INV_ALIAS)
    expect(e.tensao_max_entrada).toBe(1000)   // voc_max_dc
    expect(e.mppt_min).toBe(80)               // faixa_mppt_min
    expect(e.mppt_max).toBe(800)              // faixa_mppt_max
    expect(e.corrente_max_mppt).toBe(18)      // corrente_max_mppt
    expect(e.potencia_ca_kw).toBe(8.2)        // potencia_kw
  })

  it('3 · `fases_saida` é lido como fase', () => {
    expect(fasesDoInversor(INV_ALIAS)).toBe(1)
  })

  it('4 · ausência continua ausência — nenhum default numérico', () => {
    const e = eletricoDoInversor(INV_POBRE)
    expect(e.tensao_max_entrada).toBe(null)
    expect(e.mppt_min).toBe(null)
    expect(e.mppt_max).toBe(null)
    expect(e.corrente_max_mppt).toBe(null)
    expect(nMpptsDoInversor(INV_POBRE)).toBe(null)
    expect(fasesDoInversor(INV_POBRE)).toBe(null)
    // Os defaults de `paraDimensionamento` (600/100/550/13/2) NÃO podem vazar.
    for (const proibido of [600, 100, 550, 13, 2]) {
      expect(Object.values(e)).not.toContain(proibido)
    }
  })

  it('5 · `entradas_por_mppt` chega como array do SSOT', () => {
    const v = entradasPorMppt({ especificacoes: { n_mppts: 2, strings_por_mppt: 2 } })
    expect(Array.isArray(v)).toBe(true)
  })
})

// ═══ A3 · Seletor enriquecido ═══════════════════════════════════════════════
describe('A3 · seletor de inversores', () => {
  it('6 · rótulo traz potência, fase, MPPTs e limites', () => {
    const r = rotuloDoInversor(INV_TRI)
    expect(r).toContain('Sungrow SG15RT')
    expect(r).toContain('15 kW')
    expect(r).toContain('Trifásico')
    expect(r).toContain('3 MPPT')
    expect(r).toContain('Vmax 1000 V')
    expect(r).toContain('MPPT 200–850 V')
    expect(r).toContain('Imax 25 A')
  })

  it('7 · dado ausente vira `—`, nunca um número inventado', () => {
    const r = rotuloDoInversor(INV_POBRE)
    expect(r).toContain('Genérico SEM-DADOS')
    expect(r).toContain('5 kW')
    expect(r).toContain('— MPPT')
    expect(r).toContain('Vmax —')
    expect(r).toContain('Imax —')
    expect(r).not.toMatch(/600|550|13 A|2 MPPT/)
  })

  it('8 · classificação vem de `tecnologiaInversor`', () => {
    expect(tipoDoInversor(INV_TRI)).toBe('string')
    expect(tipoDoInversor(INV_MICRO)).toBe('micro')
    expect(tipoDoInversor(INV_HIB)).toBe('hibrido')
  })

  it('9 · a lista é agrupada por tecnologia', async () => {
    render(<EtapaEquipamentos />)
    await waitFor(() => expect(screen.getByLabelText('Inversor').disabled).toBe(false))
    const grupos = [...screen.getByLabelText('Inversor').querySelectorAll('optgroup')]
      .map((g) => g.label.replace(/\s*\(\d+\)$/, ''))
    expect(grupos).toContain('String')
    expect(grupos).toContain('Microinversor')
    expect(grupos).toContain('Híbrido')
  })

  it('10 · a seleção continua gravando o `equipamento_id` do catálogo', async () => {
    // FV-UX-029: a tela virou composição — adicionar com quantidade, e a
    // gravação passou a ser `arranjos` + a projeção `equipamentos`.
    render(<EtapaEquipamentos />)
    await waitFor(() => expect(screen.getByLabelText('Inversor').disabled).toBe(false))
    const put = (el, v) => {
      const p = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
      p.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    put(screen.getByLabelText('Módulo'), 'm1')
    fireEvent.change(screen.getByLabelText('Quantidade do novo módulo'), { target: { value: '24' } })
    fireEvent.click(screen.getByText('Adicionar módulo'))
    put(screen.getByLabelText('Inversor'), 'i1')
    fireEvent.change(screen.getByLabelText('Quantidade do novo inversor'), { target: { value: '1' } })
    fireEvent.click(screen.getByText('Adicionar inversor'))
    fireEvent.click(screen.getByText('Salvar composição'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const arranjos = salvarEtapa.mock.calls.find(([e]) => e === 'arranjos')[1]
    expect(arranjos.lista[0].paineis[0].equipamento_id).toBe('m1')
    expect(arranjos.lista[0].inversores[0].equipamento_id).toBe('i1')
    const eq = salvarEtapa.mock.calls.find(([e]) => e === 'equipamentos')[1]
    expect(eq.inversor.equipamento_id).toBe('i1')
    expect(eq.paineis[0].equipamento_id).toBe('m1')
  })
})

// ═══ A4 · Fase ══════════════════════════════════════════════════════════════
describe('A4 · aviso de fase', () => {
  it('11 · mono + mono → sem aviso', () => {
    expect(avisoDeFase('Monofásico', 1)).toBe(null)
  })

  it('12 · mono + tri → aviso, sem bloqueio', () => {
    const a = avisoDeFase('Monofásico', 3)
    expect(a).toContain('Monofásico')
    expect(a).toContain('Trifásico')
    expect(a).toContain('adequação da entrada elétrica')
  })

  it('13 · tri + tri → sem aviso', () => {
    expect(avisoDeFase('Trifásico', 3)).toBe(null)
  })

  it('14 · fase ausente de qualquer lado → não inventa', () => {
    expect(avisoDeFase(null, 3)).toBe(null)
    expect(avisoDeFase('Monofásico', null)).toBe(null)
    expect(avisoDeFase('', 3)).toBe(null)
  })

  it('15 · a tela mostra o aviso e NÃO esconde nem bloqueia o trifásico', async () => {
    render(<EtapaEquipamentos />)
    await waitFor(() => expect(screen.getByLabelText('Inversor').disabled).toBe(false))
    const sel = screen.getByLabelText('Inversor')
    // O trifásico continua na lista.
    expect([...sel.options].some((o) => o.text.includes('SG15RT'))).toBe(true)
    const put = (el, v) => {
      const p = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
      p.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    // FV-UX-029: o aviso passou a depender do inversor ESTAR na composição.
    put(sel, 'i1')
    fireEvent.change(screen.getByLabelText('Quantidade do novo inversor'), { target: { value: '1' } })
    fireEvent.click(screen.getByText('Adicionar inversor'))
    expect(document.body.textContent).toContain('pode exigir adequação da entrada elétrica')
    // Adicionável e salvável — sem bloqueio.
    expect(screen.getByText('Salvar composição').disabled).toBe(false)
  })

  it('16 · monofásico compatível não gera aviso na tela', async () => {
    render(<EtapaEquipamentos />)
    await waitFor(() => expect(screen.getByLabelText('Inversor').disabled).toBe(false))
    const put = (el, v) => {
      const p = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
      p.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    put(screen.getByLabelText('Inversor'), 'i2')
    expect(document.body.textContent).not.toContain('adequação da entrada elétrica')
  })
})

// ═══ A1 · Separador ═════════════════════════════════════════════════════════
describe('A1 · separador do MPPT', () => {
  const montar = async () => {
    render(<EtapaMppt />)
    await screen.findByText(/MPPT 1/)
  }
  beforeEach(() => {
    projetoAtual = {
      ...PROJETO,
      equipamentos: {
        paineis: [{ id: 'm1', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
        inversor: { id: 'i1', modelo: 'SG15RT', equipamento_id: 'i1' },
      },
    }
  })

  it('17 · MPPT 1 com 0 módulos não vira "MPPT 10"', async () => {
    await montar()
    const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.startsWith('MPPT 1'))
    expect(h.textContent).not.toMatch(/^MPPT 10 módulo/)
    expect(h.textContent).toContain('·')
  })

  it('18 · MPPT 1 com 12 módulos não vira "MPPT 112"', async () => {
    await montar()
    fireEvent.click([...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '+ string')[0])
    const inp = document.querySelector('input[aria-label="MPPT 1 entrada 1 string 1 módulos"]')
    fireEvent.change(inp, { target: { value: '12' } })
    const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.startsWith('MPPT 1'))
    expect(h.textContent).not.toContain('MPPT 112')
    expect(h.textContent).toContain('MPPT 1 · 12 módulo(s)')
  })

  it('19 · MPPT 2 com 12 módulos idem', async () => {
    await montar()
    fireEvent.click([...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '+ string')[1])
    const inp = document.querySelector('input[aria-label="MPPT 2 entrada 1 string 1 módulos"]')
    fireEvent.change(inp, { target: { value: '12' } })
    const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.startsWith('MPPT 2'))
    expect(h.textContent).not.toContain('MPPT 212')
    expect(h.textContent).toContain('MPPT 2 · 12 módulo(s)')
  })
})

// ═══ A2 · Clima pela UF ═════════════════════════════════════════════════════
describe('A2 · Tmin/Tmax pela UF', () => {
  const comProjeto = async (loc) => {
    projetoAtual = {
      ...PROJETO,
      localizacao: loc,
      local_resolvido: { cidade: loc.cidade ?? null, estado: loc.estado ?? null },
      equipamentos: {
        paineis: [{ id: 'm1', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
        inversor: { id: 'i1', modelo: 'SG15RT', equipamento_id: 'i1' },
      },
    }
    render(<EtapaMppt />)
    await screen.findByText(/MPPT 1/)
    fireEvent.click([...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '+ string')[0])
    fireEvent.change(document.querySelector('input[aria-label="MPPT 1 entrada 1 string 1 módulos"]'),
      { target: { value: '12' } })
    fireEvent.click(screen.getByText('Validar arranjo'))
    await waitFor(() => expect(validar).toHaveBeenCalled())
    return validar.mock.calls[0][0].dados_climaticos_regiao
  }

  it('20 · RN sem Tmin/Tmax persistidos → tabela canônica (14 / 38)', async () => {
    const c = await comProjeto({ cidade: 'Natal', estado: 'RN' })
    expect(c.temperatura_min_historica_c).toBe(14)
    expect(c.temperatura_max_historica_c).toBe(38)
  })

  it('21 · UF fria (RS) → valores canônicos, não o fallback nacional', async () => {
    const c = await comProjeto({ cidade: 'Caxias', estado: 'RS' })
    expect(c.temperatura_min_historica_c).toBe(-8)
    expect(c.temperatura_min_historica_c).not.toBe(10)   // fallback nacional
  })

  it('22 · Tmin/Tmax persistidos têm PRECEDÊNCIA sobre a UF', async () => {
    const c = await comProjeto({
      cidade: 'Natal', estado: 'RN',
      temperatura_min_historica_c: 12, temperatura_max_historica_c: 41,
    })
    expect(c.temperatura_min_historica_c).toBe(12)
    expect(c.temperatura_max_historica_c).toBe(41)
  })

  it('23 · sem UF e sem persistidos → mantém a lacuna (null), sem inventar', async () => {
    const c = await comProjeto({ cidade: null, estado: null })
    expect(c.temperatura_min_historica_c).toBe(null)
    expect(c.temperatura_max_historica_c).toBe(null)
  })

  it('24 · a tela declara a origem das temperaturas', async () => {
    await comProjeto({ cidade: 'Natal', estado: 'RN' })
    expect(document.body.textContent).toContain('tabela RN')
  })
})
