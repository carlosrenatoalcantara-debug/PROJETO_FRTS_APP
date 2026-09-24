import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Sprint D2 — Topologia → inversores compatíveis → Marca → Modelo.
 *
 * O que estes testes protegem:
 *  1. a lista de inversores vem SÓ do endpoint da D1 — não há fallback para o
 *     catálogo completo em lugar nenhum;
 *  2. incompatíveis não aparecem, e "nenhum compatível" é dito com todas as letras;
 *  3. a consulta não acontece com configuração incompleta;
 *  4. mudar tipo, fase, agrupamento ou módulo invalida a consulta anterior;
 *  5. um inversor já gravado que deixou de ser compatível é denunciado, não mantido
 *     em silêncio;
 *  6. o `equipamento_id` do SSOT continua sendo o que se persiste;
 *  7. nenhuma regra elétrica foi reproduzida no frontend.
 */

const salvarEtapa = vi.fn()
const listarCatalogo = vi.fn()
const validar = vi.fn()
const consultarCompat = vi.fn()

vi.mock('../api/agregadosFvApi', () => ({
  listarCatalogo: (...a) => listarCatalogo(...a),
  validarCompatibilidadeEletrica: (...a) => validar(...a),
  consultarInversoresCompativeis: (...a) => consultarCompat(...a),
}))

const MODULO = {
  _id: 'm1', tipo: 'modulo', fabricante: 'Znshine', modelo: 'ZXM7-650',
  especificacoes: { potencia_w: 650, voc_v: 45.5, isc_a: 18.35, vmpp_v: 38.1, impp_a: 17.06,
    coef_temp_voc_pct_c: -0.25, noct_c: 44 },
}
const SG15 = {
  _id: 'i1', tipo: 'inversor', fabricante: 'Sungrow', modelo: 'SG15RT',
  especificacoes: { potencia: 15, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
    tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 3 },
}
const PRIMO = {
  _id: 'i2', tipo: 'inversor', fabricante: 'Fronius', modelo: 'Primo 5.0-1',
  especificacoes: { potencia: 5, fases: 1, tensao_max_entrada: 1000, tensao_mppt_min: 80,
    tensao_mppt_max: 800, corrente_max_por_mppt: 18, n_mppts: 2 },
}
/** No catálogo, mas NUNCA devolvido como compatível pelo endpoint. */
const INCOMPATIVEL = {
  _id: 'i9', tipo: 'inversor', fabricante: 'ABB', modelo: 'UNO-DM-4.6',
  especificacoes: { potencia: 4.6, fases: 1, tensao_max_entrada: 600, tensao_mppt_min: 70,
    tensao_mppt_max: 480, corrente_max_por_mppt: 15, n_mppts: 1 },
}

const resposta = (compativeis) => ({
  ok: true, criterio: 'eletrica_preliminar', avaliados: 3,
  compativeis: compativeis.map((e) => ({
    equipamento_id: e._id, fabricante: e.fabricante, modelo: e.modelo,
    compativel: true, avaliacao: 'eletrica_preliminar',
  })),
  incompativeis: [{ equipamento_id: 'i9', fabricante: 'ABB', modelo: 'UNO-DM-4.6', motivo: 'CORRENTE_ISC_EXCEDIDA' }],
})

/** Projeto com módulo escolhido e configuração preliminar de string completa. */
const BASE = {
  _id: 'p1', nome: 'P',
  fatura_extracao: { tipo_ligacao: 'Trifásico', consumo_mensal_kwh: 1400 },
  dimensionamento: { num_paineis: 24, potencia_kwp: 15.6 },
  localizacao: { estado: 'RN' },
  local_resolvido: { estado: 'RN' },
  equipamentos: {
    paineis: [{ id: 'm1', marca: 'Znshine', modelo: 'ZXM7-650', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
    inversor: {},
  },
  arranjos: [{
    id: 'principal', rotulo: 'Arranjo principal', tipo: 'principal', topologia: 'string',
    paineis: [{ id: 'm1', marca: 'Znshine', modelo: 'ZXM7-650', potencia_w: 650, quantidade: 24, equipamento_id: 'm1' }],
    inversores: [],
    configuracao_eletrica: { quantidade_modulos_por_string: 12, quantidade_strings_paralelo: 2 },
  }],
  engenharia_eletrica: null,
}

let projetoAtual = BASE
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))

import EtapaMppt from '../paginas/etapas/EtapaMppt'

const clone = (o) => JSON.parse(JSON.stringify(o))
const put = (el, v) => {
  const p = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
  p.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true }))
}
const montar = async () => {
  render(<EtapaMppt />)
  await waitFor(() => expect(screen.getByLabelText('Tipo de topologia')).toBeTruthy())
}
const consultar = async () => {
  fireEvent.click(screen.getByText('Consultar inversores compatíveis'))
  await waitFor(() => expect(consultarCompat).toHaveBeenCalled())
}
const opcoes = (rot) => [...screen.getByLabelText(rot).options].map((o) => o.text)

beforeEach(() => {
  vi.clearAllMocks()
  projetoAtual = clone(BASE)
  listarCatalogo.mockImplementation((t) =>
    Promise.resolve({ equipamentos: t === 'modulo' ? [MODULO] : [SG15, PRIMO, INCOMPATIVEL] }))
  validar.mockResolvedValue({ compativel: true, erros: [], warnings: [], calculos: {} })
  consultarCompat.mockResolvedValue(resposta([SG15, PRIMO]))
  salvarEtapa.mockResolvedValue(undefined)
})

// ═══ 1 · Consulta ═══════════════════════════════════════════════════════════
describe('D2 · consulta de compatíveis', () => {
  it('1 · abre sem inversor e sem lista — nada é oferecido antes de consultar', async () => {
    await montar()
    expect(screen.queryByLabelText('Marca do inversor compatível')).toBe(null)
    expect(consultarCompat).not.toHaveBeenCalled()
  })

  it('2 · consulta envia a configuração preliminar e o módulo do SSOT', async () => {
    await montar()
    await consultar()
    const arg = consultarCompat.mock.calls[0][0]
    expect(arg.modulo_id).toBe('m1')
    expect(arg.configuracao).toMatchObject({
      tipo: 'string', fases: 'Trifásico', modulos_por_string: 12, quantidade_strings: 2,
    })
    // Nada de MPPT vai na consulta preliminar.
    expect(JSON.stringify(arg)).not.toMatch(/mppt/i)
  })

  it('3 · configuração incompleta NÃO consulta', async () => {
    const p = clone(BASE)
    p.arranjos[0].configuracao_eletrica = {}
    projetoAtual = p
    await montar()
    expect(screen.getByText('Consultar inversores compatíveis').disabled).toBe(true)
    fireEvent.click(screen.getByText('Consultar inversores compatíveis'))
    expect(consultarCompat).not.toHaveBeenCalled()
  })

  it('4 · sem módulo escolhido NÃO consulta', async () => {
    const p = clone(BASE)
    p.equipamentos.paineis = []
    p.arranjos[0].paineis = []
    projetoAtual = p
    await montar()
    expect(screen.getByText('Consultar inversores compatíveis').disabled).toBe(true)
  })
})

// ═══ 2 · Marca → Modelo sobre a lista filtrada ══════════════════════════════
describe('D2 · Marca → Modelo dos compatíveis', () => {
  it('5 · agrupa por marca, só com o que o endpoint devolveu', async () => {
    await montar()
    await consultar()
    const marcas = opcoes('Marca do inversor compatível').slice(1).map((t) => t.replace(/\s*\(\d+\)$/, ''))
    expect(marcas).toEqual(['Fronius', 'Sungrow'])
    expect(marcas).not.toContain('ABB')   // incompatível não aparece
  })

  it('6 · modelo só lista após a marca, e só os daquela marca', async () => {
    await montar()
    await consultar()
    expect(screen.getByLabelText('Modelo do inversor compatível').disabled).toBe(true)
    put(screen.getByLabelText('Marca do inversor compatível'), 'Sungrow')
    const modelos = opcoes('Modelo do inversor compatível').slice(1)
    expect(modelos).toEqual(['SG15RT'])
    expect(modelos).not.toContain('Primo 5.0-1')
  })

  it('7 · trocar a marca limpa o modelo', async () => {
    await montar()
    await consultar()
    put(screen.getByLabelText('Marca do inversor compatível'), 'Sungrow')
    put(screen.getByLabelText('Modelo do inversor compatível'), 'i1')
    expect(screen.getByLabelText('Modelo do inversor compatível').value).toBe('i1')
    put(screen.getByLabelText('Marca do inversor compatível'), 'Fronius')
    expect(screen.getByLabelText('Modelo do inversor compatível').value).toBe('')
  })

  it('8 · nenhum modelo incompatível é oferecido em marca alguma', async () => {
    await montar()
    await consultar()
    for (const marca of ['Sungrow', 'Fronius']) {
      put(screen.getByLabelText('Marca do inversor compatível'), marca)
      expect(opcoes('Modelo do inversor compatível').join(' ')).not.toContain('UNO-DM-4.6')
    }
  })
})

// ═══ 3 · Persistência ═══════════════════════════════════════════════════════
describe('D2 · persistência do inversor', () => {
  it('9 · salva o `equipamento_id` do SSOT nas duas etapas de sempre', async () => {
    await montar()
    await consultar()
    put(screen.getByLabelText('Marca do inversor compatível'), 'Sungrow')
    put(screen.getByLabelText('Modelo do inversor compatível'), 'i1')
    fireEvent.click(screen.getByText('Usar este inversor'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())

    const arranjos = salvarEtapa.mock.calls.find(([e]) => e === 'arranjos')?.[1]
    const inv = arranjos.lista.find((a) => a.tipo === 'principal').inversores[0]
    expect(inv.equipamento_id).toBe('i1')
    expect(inv.marca).toBe('Sungrow')
    expect(inv.modelo).toBe('SG15RT')
    // A composição de módulos não se perde.
    expect(arranjos.lista.find((a) => a.tipo === 'principal').paineis[0].equipamento_id).toBe('m1')
    // E a projeção legada é escrita, como em Equipamentos.
    expect(salvarEtapa.mock.calls.some(([e]) => e === 'equipamentos')).toBe(true)
  })
})

// ═══ 4 · Invalidação ════════════════════════════════════════════════════════
describe('D2 · invalidação quando a configuração muda', () => {
  const comInversor = () => {
    const p = clone(BASE)
    const inv = { id: 'i1', marca: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, tipo: 'string', fases: 3, quantidade: 1, equipamento_id: 'i1' }
    p.equipamentos.inversor = inv
    p.arranjos[0].inversores = [inv]
    return p
  }

  it('10 · inversor gravado e ainda compatível é declarado compatível', async () => {
    projetoAtual = comInversor()
    await montar()
    await consultar()
    expect(document.body.textContent).toContain('compatível com a configuração atual')
  })

  it('11 · inversor gravado que saiu da lista é DENUNCIADO, não mantido em silêncio', async () => {
    projetoAtual = comInversor()
    consultarCompat.mockResolvedValue(resposta([PRIMO]))   // SG15RT sumiu
    await montar()
    await consultar()
    expect(document.body.textContent).toContain('NÃO é compatível com a configuração atual')
  })

  it('12 · mudar o tipo invalida a consulta anterior', async () => {
    await montar()
    await consultar()
    expect(screen.getByLabelText('Marca do inversor compatível')).toBeTruthy()
    put(screen.getByLabelText('Tipo de topologia'), 'micro')
    // A lista some: a consulta anterior não vale para a configuração nova.
    expect(screen.queryByLabelText('Marca do inversor compatível')).toBe(null)
  })

  it('13 · mudar o agrupamento invalida a consulta anterior', async () => {
    await montar()
    await consultar()
    fireEvent.change(screen.getByLabelText('Módulos por string'), { target: { value: '8' } })
    expect(screen.queryByLabelText('Marca do inversor compatível')).toBe(null)
  })

  it('14 · sem consulta válida, a compatibilidade do gravado não é afirmada', async () => {
    projetoAtual = comInversor()
    await montar()
    expect(document.body.textContent).toContain('compatibilidade não verificada')
  })
})

// ═══ 5 · Sem candidatos e falhas ════════════════════════════════════════════
describe('D2 · impedimentos', () => {
  it('15 · nenhum compatível: diz isso e não oferece lista', async () => {
    consultarCompat.mockResolvedValue({ ...resposta([]), codigo: 'SEM_CANDIDATOS', avaliados: 3 })
    await montar()
    await consultar()
    expect(document.body.textContent).toContain('Nenhum inversor compatível encontrado')
    expect(screen.queryByLabelText('Marca do inversor compatível')).toBe(null)
  })

  it('16 · dado insuficiente é distinguido de "nenhum compatível"', async () => {
    const e = new Error('O módulo do catálogo não declara: coef_temp_voc.')
    e.codigo = 'MODULO_SEM_DADOS'
    consultarCompat.mockRejectedValue(e)
    await montar()
    await consultar()
    await waitFor(() => expect(document.body.textContent).toContain('Não foi possível avaliar'))
    expect(document.body.textContent).toContain('MODULO_SEM_DADOS')
    expect(document.body.textContent).not.toContain('Nenhum inversor compatível encontrado')
  })
})

// ═══ 6 · Projetos legados ═══════════════════════════════════════════════════
describe('D2 · projetos legados', () => {
  it('17 · projeto sem configuração preliminar abre e não consulta', async () => {
    const p = clone(BASE)
    delete p.arranjos[0].topologia
    p.arranjos[0].configuracao_eletrica = {}
    projetoAtual = p
    await montar()
    expect(screen.getByText('Consultar inversores compatíveis').disabled).toBe(true)
    expect(consultarCompat).not.toHaveBeenCalled()
  })

  it('18 · projeto legado com inversor mostra o que está gravado, sem exigir nova escolha', async () => {
    const p = clone(BASE)
    delete p.arranjos[0].topologia
    p.arranjos[0].configuracao_eletrica = {}
    const inv = { id: 'i1', marca: 'Sungrow', modelo: 'SG15RT', quantidade: 1, equipamento_id: 'i1' }
    p.equipamentos.inversor = inv
    p.arranjos[0].inversores = [inv]
    projetoAtual = p
    await montar()
    expect(document.body.textContent).toContain('SG15RT')
  })
})

// ═══ 7 · Nenhuma regra elétrica no cliente ══════════════════════════════════
describe('D2 · a regra continua no servidor', () => {
  it('19 · a tela não reproduz nenhuma fórmula de compatibilidade', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const aqui = path.dirname(url.fileURLToPath(import.meta.url))
    const bruto = await fs.readFile(path.resolve(aqui, '../paginas/etapas/EtapaMppt.jsx'), 'utf8')
    const fonte = bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    // A tela pode CHAMAR o endpoint e EXIBIR o que o motor respondeu — inclusive
    // nomear em português o que ele não avaliou. O que ela não pode é calcular.
    // Por isso a varredura procura ARITMÉTICA elétrica, não vocabulário: proibir
    // a palavra "oversizing" barraria a frase que avisa o usuário de que o
    // oversizing NÃO é avaliado aqui — exatamente a transparência que se quer.
    expect(fonte.includes('consultarInversoresCompativeis')).toBe(true)
    for (const p of ['Math.pow', '* 1.25', '1.25 *', 'coef_temp_voc *',
      'voc_string =', 'isc_total =', 'oversizing =', '/ potencia_ca']) {
      expect(fonte.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })
})
