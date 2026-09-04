import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Sprint D0 — configuração elétrica PRELIMINAR, anterior ao inversor.
 *
 * O que estes testes protegem:
 *  1. a configuração preliminar não inventa campo: tudo já tinha lugar no schema;
 *  2. ela descreve APENAS o que existe antes do inversor — nada de MPPT, entrada
 *     ou parâmetro que dependa do equipamento escolhido;
 *  3. o tipo DECLARADO manda no editor que abre; a inferência pela composição
 *     permanece só como fallback dos projetos legados;
 *  4. ausência continua ausência — projeto legado lê nulos, nunca defaults;
 *  5. gravar o nível preliminar não apaga a topologia detalhada;
 *  6. nenhuma regra de compatibilidade elétrica entrou no frontend.
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
const INV_STRING = {
  _id: 'i1', tipo: 'inversor', fabricante: 'Sungrow', modelo: 'SG15RT',
  especificacoes: { potencia: 15, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
    tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 3 },
}
const INV_MICRO = {
  _id: 'i2', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2000-4T',
  especificacoes: { potencia: 2, fases: 1, tensao_max_entrada: 60, tensao_mppt_min: 16,
    tensao_mppt_max: 60, corrente_max_por_mppt: 16, n_mppts: 4 },
}

/** Projeto com composição de string e topologia detalhada já gravada. */
const BASE = {
  _id: 'p1', nome: 'P',
  fatura_extracao: { tipo_ligacao: 'Trifásico', consumo_mensal_kwh: 1400 },
  dimensionamento: { num_paineis: 24, potencia_kwp: 15.6 },
  localizacao: { estado: 'RN' },
  local_resolvido: { estado: 'RN' },
  equipamentos: {
    paineis: [{ id: 'm1', marca: 'Znshine', modelo: 'ZXM7-650', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
    inversor: { id: 'i1', marca: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, tipo: 'string', fases: 3, equipamento_id: 'i1' },
  },
  arranjos: [{
    id: 'principal', rotulo: 'Arranjo principal', tipo: 'principal',
    topologia: 'string',
    fornecedor: { nome: 'Aldo' },
    paineis: [{ id: 'm1', marca: 'Znshine', modelo: 'ZXM7-650', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
    inversores: [{ id: 'i1', marca: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 1, equipamento_id: 'i1' }],
    configuracao_eletrica: {
      quantidade_modulos_por_string: 12,
      quantidade_strings_paralelo: 2,
      n_mppts: 3,
      mppts: [{ mppt: 1, strings_paralelo: 2, modulos_por_string: 12, total_modulos: 24 }],
    },
  }],
  engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, strings_paralelo: 2, modulos_por_string: 12 }] } },
}

let projetoAtual = BASE
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))

import EtapaMppt from '../paginas/etapas/EtapaMppt'
import {
  TIPOS_TOPOLOGIA, inteiroPositivo, totalDeModulos, lerPreliminar,
  lacunasPreliminar, preliminarCompleta, coerenciaDeModulos, paraArranjoPreliminar,
} from '../topologiaPreliminar'

const clone = (o) => JSON.parse(JSON.stringify(o))
const etapa = (nome) => salvarEtapa.mock.calls.filter(([e]) => e === nome).at(-1)?.[1]
const put = (el, v) => {
  const p = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
  p.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true }))
}

beforeEach(() => {
  vi.clearAllMocks()
  projetoAtual = clone(BASE)
  listarCatalogo.mockImplementation((t) =>
    Promise.resolve({ equipamentos: t === 'modulo' ? [MODULO] : [INV_STRING, INV_MICRO] }))
  validar.mockResolvedValue({ compativel: true, erros: [], warnings: [], calculos: {} })
  salvarEtapa.mockResolvedValue(undefined)
})

// ═══ 1 · Modelo puro ════════════════════════════════════════════════════════
describe('D0 · modelo da configuração preliminar', () => {
  it('1 · distingue apenas String e Micro', () => {
    expect(TIPOS_TOPOLOGIA.map(([v]) => v)).toEqual(['string', 'micro'])
  })

  it('2 · inteiroPositivo: vazio e zero são ausência, nunca número', () => {
    expect(inteiroPositivo('12')).toBe(12)
    expect(inteiroPositivo(0)).toBe(null)
    expect(inteiroPositivo('')).toBe(null)
    expect(inteiroPositivo(-3)).toBe(null)
    expect(inteiroPositivo('abc')).toBe(null)
  })

  it('3 · lê o que está persistido, sem inventar', () => {
    const c = lerPreliminar(BASE)
    expect(c).toEqual({
      tipo: 'string', fases: 'Trifásico', total_modulos: 24,
      modulos_por_string: 12, quantidade_strings: 2,
    })
  })

  it('4 · projeto legado sem configuração lê NULOS — nenhum default', () => {
    const legado = { _id: 'x', arranjos: [], equipamentos: {}, fatura_extracao: {} }
    const c = lerPreliminar(legado)
    expect(c.tipo).toBe(null)
    expect(c.fases).toBe(null)
    expect(c.total_modulos).toBe(null)
    expect(c.modulos_por_string).toBe(null)
    expect(c.quantidade_strings).toBe(null)
    expect(lacunasPreliminar(c).length).toBeGreaterThan(0)
    expect(preliminarCompleta(c)).toBe(false)
  })

  it('5 · total de módulos vem da composição, somando quantidades', () => {
    expect(totalDeModulos(BASE)).toBe(24)
    const dois = clone(BASE)
    dois.arranjos[0].paineis.push({ quantidade: 6, equipamento_id: 'm2' })
    expect(totalDeModulos(dois)).toBe(30)
  })

  it('6 · Micro não exige strings — a topologia dele é por entradas', () => {
    const c = { tipo: 'micro', fases: 'Monofásico', total_modulos: 24, modulos_por_string: null, quantidade_strings: null }
    expect(lacunasPreliminar(c)).toEqual([])
    expect(preliminarCompleta(c)).toBe(true)
  })

  it('7 · String exige agrupamento; a falta é nomeada, não preenchida', () => {
    const c = { tipo: 'string', fases: 'Trifásico', total_modulos: 24, modulos_por_string: null, quantidade_strings: null }
    expect(lacunasPreliminar(c)).toEqual(['módulos por string', 'quantidade de strings'])
    expect(preliminarCompleta(c)).toBe(false)
  })

  it('8 · coerência de contagem informa a diferença, não corrige', () => {
    const c = { tipo: 'string', total_modulos: 24, modulos_por_string: 12, quantidade_strings: 2 }
    expect(coerenciaDeModulos(c)).toEqual({ declarado: 24, naComposicao: 24, diferenca: 0 })
    expect(coerenciaDeModulos({ ...c, quantidade_strings: 3 }).diferenca).toBe(-12)
    expect(coerenciaDeModulos({ tipo: 'micro', total_modulos: 24 }).declarado).toBe(null)
  })

  it('9 · gravar o preliminar PRESERVA a topologia detalhada e o resto do arranjo', () => {
    const c = { tipo: 'string', fases: 'Trifásico', total_modulos: 24, modulos_por_string: 8, quantidade_strings: 3 }
    const a = paraArranjoPreliminar(c, BASE.arranjos[0])
    expect(a.topologia).toBe('string')
    expect(a.configuracao_eletrica.quantidade_modulos_por_string).toBe(8)
    expect(a.configuracao_eletrica.quantidade_strings_paralelo).toBe(3)
    // Detalhada intacta — é pós-inversor e não pertence a este nível.
    expect(a.configuracao_eletrica.mppts).toEqual(BASE.arranjos[0].configuracao_eletrica.mppts)
    expect(a.configuracao_eletrica.n_mppts).toBe(3)
    // E nada da composição se perde.
    expect(a.paineis).toEqual(BASE.arranjos[0].paineis)
    expect(a.inversores).toEqual(BASE.arranjos[0].inversores)
    expect(a.fornecedor).toEqual({ nome: 'Aldo' })
  })

  it('10 · trocar para Micro zera o agrupamento de string, sem apagar mais nada', () => {
    const c = { tipo: 'micro', modulos_por_string: 12, quantidade_strings: 2 }
    const a = paraArranjoPreliminar(c, BASE.arranjos[0])
    expect(a.configuracao_eletrica.quantidade_modulos_por_string).toBe(null)
    expect(a.configuracao_eletrica.quantidade_strings_paralelo).toBe(null)
    expect(a.configuracao_eletrica.mppts).toBeTruthy()
  })
})

// ═══ 2 · A tela ═════════════════════════════════════════════════════════════
describe('D0 · a etapa Topologia', () => {
  it('11 · mostra a configuração preliminar com fases e módulos herdados', async () => {
    render(<EtapaMppt />)
    await waitFor(() => expect(screen.getByLabelText('Tipo de topologia')).toBeTruthy())
    expect(document.body.textContent).toContain('Configuração elétrica preliminar')
    expect(document.body.textContent).toContain('Trifásico')
    expect(screen.getByLabelText('Módulos por string').value).toBe('12')
    expect(screen.getByLabelText('Quantidade de strings').value).toBe('2')
  })

  it('12 · o tipo DECLARADO manda no editor, não o inversor da composição', async () => {
    // Composição é de inversor string, mas o projeto declara micro.
    const p = clone(BASE)
    p.arranjos[0].topologia = 'micro'
    projetoAtual = p
    render(<EtapaMppt />)
    await waitFor(() => expect(document.body.textContent).toContain('Configuração elétrica preliminar'))
    // O editor de micro abriu — a tela de MPPT por string não está presente.
    expect(document.body.textContent).not.toContain('Topologia MPPT')
  })

  it('13 · legado sem topologia declarada continua caindo na inferência', async () => {
    const p = clone(BASE)
    delete p.arranjos[0].topologia
    projetoAtual = p
    render(<EtapaMppt />)
    await waitFor(() => expect(document.body.textContent).toContain('Configuração elétrica preliminar'))
    // Composição é string → segue no editor de string, como antes da D0.
    expect(document.body.textContent).toContain('Topologia MPPT')
  })

  it('14 · salvar grava só o nível preliminar, pela etapa `arranjos`', async () => {
    render(<EtapaMppt />)
    await waitFor(() => expect(screen.getByLabelText('Tipo de topologia')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Módulos por string'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Quantidade de strings'), { target: { value: '3' } })
    fireEvent.click(screen.getByText('Salvar configuração'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const a = etapa('arranjos').lista.find((x) => x.tipo === 'principal')
    expect(a.topologia).toBe('string')
    expect(a.configuracao_eletrica.quantidade_modulos_por_string).toBe(8)
    expect(a.configuracao_eletrica.quantidade_strings_paralelo).toBe(3)
    expect(a.configuracao_eletrica.mppts).toBeTruthy()   // detalhada preservada
    expect(a.paineis).toHaveLength(1)                    // composição preservada
  })

  it('15 · trocar o tipo para Micro limpa strings na gravação', async () => {
    render(<EtapaMppt />)
    await waitFor(() => expect(screen.getByLabelText('Tipo de topologia')).toBeTruthy())
    put(screen.getByLabelText('Tipo de topologia'), 'micro')
    fireEvent.click(screen.getByText('Salvar configuração'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const a = etapa('arranjos').lista.find((x) => x.tipo === 'principal')
    expect(a.topologia).toBe('micro')
    expect(a.configuracao_eletrica.quantidade_modulos_por_string).toBe(null)
    expect(a.configuracao_eletrica.quantidade_strings_paralelo).toBe(null)
  })

  it('16 · declara que o filtro de compatíveis ainda não existe', async () => {
    render(<EtapaMppt />)
    await waitFor(() => expect(screen.getByLabelText('Tipo de topologia')).toBeTruthy())
    expect(document.body.textContent).toContain('inversores compatíveis')
  })
})

// ═══ 3 · Sem regra elétrica no cliente ══════════════════════════════════════
describe('D0 · nenhuma regra de compatibilidade no frontend', () => {
  const ler = async (rel) => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const aqui = path.dirname(url.fileURLToPath(import.meta.url))
    return fs.readFile(path.resolve(aqui, rel), 'utf8')
  }
  const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('17 · o módulo preliminar não faz engenharia elétrica', async () => {
    const fonte = semComentarios(await ler('../topologiaPreliminar.js'))
    for (const p of ['voc', 'isc', 'vmpp', 'Math.pow', '1.25', 'temperatura',
      'oversizing', 'tensao', 'corrente', 'compativel', 'fetch(', 'apiFetch']) {
      expect(fonte.toLowerCase().includes(p.toLowerCase()), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('18 · e não conhece MPPT nem entradas — isso é pós-inversor', async () => {
    const fonte = semComentarios(await ler('../topologiaPreliminar.js'))
    for (const p of ['mppt', 'entradas', 'micros', 'n_mppts']) {
      expect(fonte.toLowerCase().includes(p.toLowerCase()), `encontrou \`${p}\``).toBe(false)
    }
  })
})
