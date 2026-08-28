import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * FV-UX-029 — composição de equipamentos.
 *
 * O que estes testes protegem:
 *  1. equipamento deixou de ser seleção transitória — é lista com quantidade;
 *  2. a composição é gravada em `arranjos[]` (decisão B), e `equipamentos` vira
 *     PROJEÇÃO derivada dela, nunca editada por conta própria;
 *  3. quantidade é inteiro > 0 — vazio e 0 são ausência;
 *  4. potência é soma do catálogo, nunca estimativa; item sem potência vira lacuna;
 *  5. a divergência com o dimensionamento é informada, não corrigida sozinha.
 */

const salvarEtapa = vi.fn()
const listarCatalogo = vi.fn()

vi.mock('../api/agregadosFvApi', () => ({
  listarCatalogo: (...a) => listarCatalogo(...a),
  validarCompatibilidadeEletrica: vi.fn(),
}))

const M650 = {
  _id: 'm1', tipo: 'modulo', fabricante: 'Znshine', modelo: 'ZXM7-UHLD144-650/M',
  especificacoes: { potencia_w: 650, voc_v: 45.5, isc_a: 18.35, vmpp_v: 38.1, impp_a: 17.06,
    coef_temp_voc_pct_c: -0.25, noct_c: 44 },
}
const M550 = {
  _id: 'm2', tipo: 'modulo', fabricante: 'DAH', modelo: 'DHN-550',
  especificacoes: { potencia_w: 550, voc_v: 49.9, isc_a: 14, vmpp_v: 41.8, impp_a: 13.2,
    coef_temp_voc_pct_c: -0.27, noct_c: 44 },
}
const MSEMPOT = {
  _id: 'm3', tipo: 'modulo', fabricante: 'Genérico', modelo: 'SEM-POT',
  especificacoes: { voc_v: 45, isc_a: 12 },
}
const INV15 = {
  _id: 'i1', tipo: 'inversor', fabricante: 'Sungrow', modelo: 'SG15RT',
  especificacoes: { potencia: 15, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
    tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 3 },
}
const INV10 = {
  _id: 'i2', tipo: 'inversor', fabricante: 'Sungrow', modelo: 'SG10RS',
  especificacoes: { potencia: 10, fases: 1, tensao_max_entrada: 1000, tensao_mppt_min: 80,
    tensao_mppt_max: 560, corrente_max_por_mppt: 25, n_mppts: 2 },
}

const PROJETO = {
  _id: 'p1', nome: 'P',
  fatura_extracao: { tipo_ligacao: 'Monofásico' },
  equipamentos: { paineis: [], inversor: {}, estrutura: { tipo: 'ceramico' } },
  dimensionamento: { num_paineis: 24 },
  arranjos: [],
  localizacao: { estado: 'RN' },
  local_resolvido: { estado: 'RN' },
}

let projetoAtual = PROJETO
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))

import EtapaEquipamentos from '../paginas/etapas/EtapaEquipamentos'
import {
  quantidade, totalModulos, potenciaCcKwp, potenciaCaKw, lacunasDaComposicao,
  coerenciaComDimensionamento, paraArranjos, daArranjos, projecaoLegado,
} from '../composicao'

const put = (el, v) => {
  const p = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
  p.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true }))
}
const montar = async () => {
  render(<EtapaEquipamentos />)
  await waitFor(() => expect(screen.getByLabelText('Módulo').disabled).toBe(false))
}
const addModulo = (id, qtd) => {
  put(screen.getByLabelText('Módulo'), id)
  fireEvent.change(screen.getByLabelText('Quantidade do novo módulo'), { target: { value: String(qtd) } })
  fireEvent.click(screen.getByText('Adicionar módulo'))
}
const addInversor = (id, qtd) => {
  put(screen.getByLabelText('Inversor'), id)
  fireEvent.change(screen.getByLabelText('Quantidade do novo inversor'), { target: { value: String(qtd) } })
  fireEvent.click(screen.getByText('Adicionar inversor'))
}
const etapa = (nome) => salvarEtapa.mock.calls.find(([e]) => e === nome)?.[1]

beforeEach(() => {
  vi.clearAllMocks()
  projetoAtual = PROJETO
  listarCatalogo.mockImplementation((t) =>
    Promise.resolve({ equipamentos: t === 'modulo' ? [M650, M550, MSEMPOT] : [INV15, INV10] }))
  salvarEtapa.mockResolvedValue(undefined)
})

// ═══ Modelo puro ════════════════════════════════════════════════════════════
describe('FV-UX-029 · modelo da composição', () => {
  it('1 · quantidade: inteiro > 0; vazio e 0 são ausência', () => {
    expect(quantidade('24')).toBe(24)
    expect(quantidade(24)).toBe(24)
    expect(quantidade('')).toBe(null)
    expect(quantidade(0)).toBe(null)
    expect(quantidade(-3)).toBe(null)
    expect(quantidade('abc')).toBe(null)
    expect(quantidade('12.7')).toBe(12)
  })

  it('2 · potência CC é soma do catálogo', () => {
    const c = { paineis: [{ potencia_w: 650, quantidade: 24 }, { potencia_w: 550, quantidade: 4 }], inversores: [] }
    expect(totalModulos(c)).toBe(28)
    expect(potenciaCcKwp(c)).toBe(17.8)   // 24×650 + 4×550 = 17 800 W
  })

  it('3 · potência CA soma quantidade × potência', () => {
    const c = { paineis: [], inversores: [{ potencia_kw: 15, quantidade: 2 }, { potencia_kw: 10, quantidade: 1 }] }
    expect(potenciaCaKw(c)).toBe(40)
  })

  it('4 · item sem potência vira lacuna e NÃO entra na soma', () => {
    const c = { paineis: [{ modelo: 'X', potencia_w: 650, quantidade: 10 }, { modelo: 'SEM', potencia_w: null, quantidade: 5 }], inversores: [] }
    expect(potenciaCcKwp(c)).toBe(6.5)
    expect(lacunasDaComposicao(c)).toEqual(['módulo SEM: potência não declarada'])
  })

  it('5 · coerência com o dimensionamento apenas informa a diferença', () => {
    const c = { paineis: [{ potencia_w: 650, quantidade: 26 }], inversores: [] }
    expect(coerenciaComDimensionamento(c, 24)).toEqual({ previsto: 24, naComposicao: 26, diferenca: 2 })
    expect(coerenciaComDimensionamento(c, null).diferenca).toBe(null)
  })

  it('6 · ida e volta `arranjos[]` preserva a composição', () => {
    const c = {
      paineis: [{ id: 'm1', marca: 'Z', modelo: 'A', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
      inversores: [{ id: 'i1', marca: 'S', modelo: 'B', potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 2, equipamento_id: 'i1' }],
    }
    const volta = daArranjos(paraArranjos(c))
    expect(volta.paineis[0]).toMatchObject({ modelo: 'A', quantidade: 24, equipamento_id: 'm1' })
    expect(volta.inversores[0]).toMatchObject({ modelo: 'B', quantidade: 2, equipamento_id: 'i1' })
  })

  it('7 · `paraArranjos` preserva campos que a tela não edita', () => {
    const existente = { id: 'x', rotulo: 'Meu', tipo: 'principal', fornecedor: { nome: 'Aldo' }, somente_leitura: false }
    const a = paraArranjos({ paineis: [], inversores: [] }, existente)[0]
    expect(a.fornecedor).toEqual({ nome: 'Aldo' })
    expect(a.id).toBe('x')
    expect(a.rotulo).toBe('Meu')
  })

  it('8 · a projeção legada leva o TOTAL de módulos e preserva a estrutura', () => {
    const c = {
      paineis: [{ id: 'a', potencia_w: 650, quantidade: 20, equipamento_id: 'a' },
        { id: 'b', potencia_w: 550, quantidade: 4, equipamento_id: 'b' }],
      inversores: [{ id: 'i', potencia_kw: 15, quantidade: 2, equipamento_id: 'i' }],
    }
    const p = projecaoLegado(c, { estrutura: { tipo: 'ceramico' } })
    expect(p.paineis).toHaveLength(1)
    expect(p.paineis[0].equipamento_id).toBe('a')
    expect(p.paineis[0].quantidade).toBe(24)          // total, não a do item
    expect(p.inversor.equipamento_id).toBe('i')
    expect(p.estrutura).toEqual({ tipo: 'ceramico' })
  })

  it('8b · composição vazia projeta vazio, sem inventar', () => {
    const p = projecaoLegado({ paineis: [], inversores: [] })
    expect(p.paineis).toEqual([])
    expect(p.inversor).toEqual({})
  })
})

// ═══ Tela ═══════════════════════════════════════════════════════════════════
describe('FV-UX-029 · a tela compõe', () => {
  it('9 · começa vazia e declara isso', async () => {
    await montar()
    expect(document.body.textContent).toContain('nenhum módulo na composição')
    expect(document.body.textContent).toContain('nenhum inversor na composição')
  })

  it('10 · adiciona módulo com quantidade', async () => {
    await montar()
    addModulo('m1', 24)
    expect(document.body.textContent).toContain('Znshine ZXM7-UHLD144-650/M')
    expect(document.body.textContent).toContain('24 un.')
    expect(document.body.textContent).toContain('15.6 kWp')
  })

  it('11 · adiciona DOIS modelos de módulo', async () => {
    await montar()
    addModulo('m1', 20)
    addModulo('m2', 4)
    expect(screen.getByLabelText('Quantidade do módulo 1').value).toBe('20')
    expect(screen.getByLabelText('Quantidade do módulo 2').value).toBe('4')
    expect(document.body.textContent).toContain('24 un.')
    expect(document.body.textContent).toContain('15.2 kWp')   // 20×650 + 4×550
  })

  it('12 · adiciona inversores, inclusive mais de um modelo', async () => {
    await montar()
    addInversor('i1', 2)
    addInversor('i2', 1)
    expect(document.body.textContent).toContain('SG15RT')
    expect(document.body.textContent).toContain('SG10RS')
    expect(document.body.textContent).toContain('40 kW')      // 2×15 + 1×10
  })

  it('13 · o mesmo modelo adicionado de novo SOMA, não duplica a linha', async () => {
    await montar()
    addModulo('m1', 10)
    addModulo('m1', 14)
    expect(screen.queryByLabelText('Quantidade do módulo 2')).toBeNull()
    expect(screen.getByLabelText('Quantidade do módulo 1').value).toBe('24')
  })

  it('14 · quantidade inválida não adiciona', async () => {
    await montar()
    put(screen.getByLabelText('Módulo'), 'm1')
    fireEvent.change(screen.getByLabelText('Quantidade do novo módulo'), { target: { value: '0' } })
    expect(screen.getByText('Adicionar módulo').disabled).toBe(true)
  })

  it('15 · remover item', async () => {
    await montar()
    addModulo('m1', 24)
    fireEvent.click(screen.getAllByText('remover')[0])
    expect(document.body.textContent).toContain('nenhum módulo na composição')
  })

  it('16 · editar quantidade na linha', async () => {
    await montar()
    addModulo('m1', 24)
    fireEvent.change(screen.getByLabelText('Quantidade do módulo 1'), { target: { value: '26' } })
    expect(document.body.textContent).toContain('26 un.')
  })

  it('17 · divergência com o dimensionamento é informada', async () => {
    await montar()
    addModulo('m1', 26)
    expect(document.body.textContent).toContain('diferença de +2')
    fireEvent.change(screen.getByLabelText('Quantidade do módulo 1'), { target: { value: '24' } })
    expect(document.body.textContent).toContain('composição confere')
  })

  it('18 · item sem potência no catálogo vira lacuna declarada', async () => {
    await montar()
    addModulo('m3', 5)
    expect(document.body.textContent).toContain('sem potência declarada')
    expect(document.body.textContent).toContain('nenhum valor foi assumido')
  })

  it('19 · multi-modelo avisa que a engenharia usa o primeiro', async () => {
    await montar()
    addModulo('m1', 20)
    addModulo('m2', 4)
    expect(document.body.textContent).toContain('2 modelos de módulo')
    expect(document.body.textContent).toContain('usarão o primeiro da lista')
  })

  it('20 · aviso de fase continua funcionando (A4 da FV-UX-028)', async () => {
    await montar()
    addInversor('i1', 1)   // trifásico em instalação monofásica
    expect(document.body.textContent).toContain('adequação da entrada elétrica')
  })
})

// ═══ Persistência ═══════════════════════════════════════════════════════════
describe('FV-UX-029 · persistência em `arranjos[]`', () => {
  const compor = async () => {
    await montar()
    addModulo('m1', 24)
    addInversor('i1', 2)
    fireEvent.click(screen.getByText('Salvar composição'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
  }

  it('21 · grava as duas etapas existentes, nesta ordem', async () => {
    await compor()
    expect(salvarEtapa.mock.calls.map(([e]) => e)).toEqual(['arranjos', 'equipamentos'])
  })

  it('22 · `arranjos` recebe a composição inteira', async () => {
    await compor()
    const d = etapa('arranjos')
    expect(Array.isArray(d.lista)).toBe(true)
    expect(d.lista).toHaveLength(1)
    expect(d.lista[0].tipo).toBe('principal')
    expect(d.lista[0].paineis[0]).toMatchObject({ quantidade: 24, equipamento_id: 'm1' })
    expect(d.lista[0].inversores[0]).toMatchObject({ quantidade: 2, equipamento_id: 'i1' })
  })

  it('23 · `equipamentos` é a PROJEÇÃO — um módulo, um inversor', async () => {
    await compor()
    const d = etapa('equipamentos')
    expect(d.paineis).toHaveLength(1)
    expect(d.paineis[0].quantidade).toBe(24)
    expect(d.inversor.equipamento_id).toBe('i1')
    expect(d.estrutura).toEqual({ tipo: 'ceramico' })   // preservada
  })

  it('24 · nenhum indicador financeiro é gravado', async () => {
    await compor()
    const bruto = JSON.stringify([etapa('arranjos'), etapa('equipamentos')])
    for (const p of ['payback', 'vpl', 'tir', 'preco', 'valor_unitario']) {
      expect(bruto.toLowerCase().includes(p), `gravou \`${p}\``).toBe(false)
    }
  })

  it('25 · reload lê de `arranjos[]`', async () => {
    projetoAtual = {
      ...PROJETO,
      arranjos: [{
        id: 'principal', tipo: 'principal', rotulo: 'Arranjo principal',
        paineis: [{ id: 'm1', marca: 'Znshine', modelo: 'ZXM7', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
        inversores: [{ id: 'i1', marca: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, quantidade: 2, equipamento_id: 'i1' }],
      }],
    }
    await montar()
    expect(screen.getByLabelText('Quantidade do módulo 1').value).toBe('24')
    expect(screen.getByLabelText('Quantidade do inversor 1').value).toBe('2')
  })

  it('26 · projeto legado sem `arranjos[]` é lido de `equipamentos`', async () => {
    projetoAtual = {
      ...PROJETO, arranjos: [],
      equipamentos: {
        paineis: [{ id: 'm1', marca: 'Znshine', modelo: 'ZXM7', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
        inversor: { id: 'i1', marca: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, equipamento_id: 'i1' },
      },
    }
    await montar()
    expect(screen.getByLabelText('Quantidade do módulo 1').value).toBe('24')
    expect(screen.getByLabelText('Quantidade do inversor 1').value).toBe('1')   // default do legado
  })

  it('27 · erro do servidor é propagado', async () => {
    const e = new Error('Projeto congelado')
    e.codigo = 'PROJETO_CONGELADO'
    salvarEtapa.mockRejectedValue(e)
    await montar()
    addModulo('m1', 24)
    fireEvent.click(screen.getByText('Salvar composição'))
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('PROJETO_CONGELADO')
  })

  it('28 · sem alteração, nada é enviado', async () => {
    await montar()
    expect(screen.getByText('Salvar composição').disabled).toBe(true)
  })
})

// ═══ Sem regra nova ═════════════════════════════════════════════════════════
describe('FV-UX-029 · nenhuma regra nova no cliente', () => {
  const ler = async (rel) => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    return readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), rel), 'utf8')
  }
  const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('29 · nenhuma fórmula elétrica ou financeira', async () => {
    const fontes = semComentarios(await ler('../composicao.js'))
      + semComentarios(await ler('../paginas/etapas/EtapaEquipamentos.jsx'))
    for (const p of ['Math.pow', 'Math.ceil', 'fatorTermico', 'correnteProjeto', '1.25',
      'calcularVPL', 'calcularTIR', 'oversizing', 'voc', 'isc']) {
      expect(fontes.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('30 · nenhum default e nenhuma rota nova', async () => {
    const fonte = semComentarios(await ler('../composicao.js'))
    for (const d of ['?? 24', '|| 24', '?? 650', '|| 650', '?? 1,']) {
      expect(fonte.includes(d), `encontrou \`${d}\``).toBe(false)
    }
    const tela = await ler('../paginas/etapas/EtapaEquipamentos.jsx')
    for (const p of ['fetch(', 'apiFetch', 'axios', 'createContext', 'localStorage']) {
      expect(tela.includes(p), `encontrou \`${p}\``).toBe(false)
    }
    expect(tela.includes('acoes.salvarEtapa')).toBe(true)
  })
})
