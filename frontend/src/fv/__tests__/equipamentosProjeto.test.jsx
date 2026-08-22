import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * FV-UX-019 — seleção de equipamentos na nova UX.
 *
 * O que estes testes protegem:
 *
 *  1. a seleção é por REFERÊNCIA ao catálogo — não há entrada livre de marca,
 *     modelo ou potência, e o `equipamento_id` sempre acompanha;
 *  2. especificação ausente no catálogo vira `null`, nunca `0`. O adapter do
 *     wizard fecha essas leituras com `?? 0`, e um zero fabricado é
 *     indistinguível de um dado real quando chega ao motor elétrico;
 *  3. gravar equipamentos não substitui o subdocumento inteiro às cegas — o
 *     handler faz `$set.equipamentos = dados`, então `estrutura` tem de sobreviver;
 *  4. nada é dimensionado, calculado ou completado no cliente.
 */

const salvarEtapa = vi.fn()
const listarCatalogo = vi.fn()

vi.mock('../api/agregadosFvApi', () => ({
  listarCatalogo: (...a) => listarCatalogo(...a),
}))

/** Catálogo canônico — `especificacoes` é Mixed, com chaves heterogêneas. */
const MODULOS = [
  { _id: 'm1', tipo: 'modulo', fabricante: 'DAH', modelo: 'DHN-550', especificacoes: { potencia: 550 } },
  { _id: 'm2', tipo: 'modulo', fabricante: 'JA Solar', modelo: 'JAM72S30', especificacoes: { potencia_w: 545 } },
  // Registro real e incompleto: o catálogo não declara a potência.
  { _id: 'm3', tipo: 'modulo', fabricante: 'Genérico', modelo: 'SEM-SPEC', especificacoes: {} },
]
const INVERSORES = [
  { _id: 'i1', tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN-8K-G03',
    especificacoes: { potencia: 8, fases: 3, tensao_max_entrada: 600, n_mppts: 2 } },
  { _id: 'i2', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2000',
    especificacoes: { potencia: 2, fases: 1, tensao_max_entrada: 60, n_mppts: 4 } },
]

const PROJETO = {
  _id: 'p1',
  nome: 'Projeto E2E',
  equipamentos: { paineis: [], inversor: {}, estrutura: { tipo: 'ceramico', descricao: 'telhado' } },
}

let projetoAtual = PROJETO
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))

import EtapaEquipamentos from '../paginas/etapas/EtapaEquipamentos'

const montar = async () => {
  render(<EtapaEquipamentos />)
  await waitFor(() => expect(screen.getByLabelText('Módulo').disabled).toBe(false))
}
const escolher = (rotulo, valor) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })
const salvar = () => fireEvent.click(screen.getByText('Salvar equipamentos'))
/** Dados enviados na etapa `equipamentos`. */
const enviado = () => salvarEtapa.mock.calls.find(([e]) => e === 'equipamentos')?.[1]

describe('FV-UX-019 · seleção por referência ao catálogo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projetoAtual = PROJETO
    salvarEtapa.mockResolvedValue(undefined)
    listarCatalogo.mockImplementation((tipo) =>
      Promise.resolve({ equipamentos: tipo === 'modulo' ? MODULOS : INVERSORES }))
  })

  it('1 · consome o catálogo canônico, por tipo', async () => {
    await montar()
    expect(listarCatalogo).toHaveBeenCalledWith('modulo')
    expect(listarCatalogo).toHaveBeenCalledWith('inversor')
    expect(listarCatalogo).toHaveBeenCalledTimes(2)
  })

  it('2 · grava pela etapa `equipamentos` — nenhuma etapa inventada', async () => {
    await montar()
    escolher('Módulo', 'm1')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(salvarEtapa.mock.calls.map(([e]) => e)).toEqual(['equipamentos'])
  })

  it('3 · o item gravado referencia o catálogo e copia o que o schema exige', async () => {
    await montar()
    escolher('Módulo', 'm1')
    escolher('Quantidade de módulos', '26')
    escolher('Inversor', 'i1')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const d = enviado()
    expect(d.paineis).toEqual([{
      id: 'm1', marca: 'DAH', modelo: 'DHN-550',
      potencia_w: 550, quantidade: 26, equipamento_id: 'm1',
    }])
    expect(d.inversor).toEqual({
      id: 'i1', marca: 'Deye', modelo: 'SUN-8K-G03',
      potencia_kw: 8, tipo: 'string', fases: 3, equipamento_id: 'i1',
    })
  })

  it('4 · especificação ausente vira null — nunca 0', async () => {
    await montar()
    escolher('Módulo', 'm3')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(enviado().paineis[0].potencia_w).toBe(null)
    expect(enviado().paineis[0].potencia_w).not.toBe(0)
  })

  it('4b · e a tela avisa, em vez de exibir um número inventado', async () => {
    await montar()
    escolher('Módulo', 'm3')
    expect(document.body.textContent).toContain('não declara a potência')
    expect(screen.getByLabelText('Módulo').textContent).toContain('potência não informada')
  })

  it('5 · quantidade em branco é ausência, não zero', async () => {
    await montar()
    escolher('Módulo', 'm1')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(enviado().paineis[0].quantidade).toBe(null)
  })

  it('5b · quantidade zero digitada é preservada como zero', async () => {
    await montar()
    escolher('Módulo', 'm1')
    escolher('Quantidade de módulos', '0')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(enviado().paineis[0].quantidade).toBe(0)
  })

  it('6 · `estrutura` sobrevive à substituição do subdocumento', async () => {
    await montar()
    escolher('Módulo', 'm1')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(enviado().estrutura).toEqual({ tipo: 'ceramico', descricao: 'telhado' })
  })

  it('7 · a tecnologia do inversor vem da regra única do domínio', async () => {
    await montar()
    // HMS-2000: o nome e o Voc de 60 V classificam como microinversor. Deixar o
    // campo vazio faria o motor desenhá-lo como inversor central.
    escolher('Inversor', 'i2')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(enviado().inversor.tipo).toBe('micro')
  })

  it('8 · a seleção persistida reabre carregada', async () => {
    projetoAtual = {
      ...PROJETO,
      equipamentos: {
        paineis: [{ id: 'm2', marca: 'JA Solar', modelo: 'JAM72S30', potencia_w: 545, quantidade: 30, equipamento_id: 'm2' }],
        inversor: { id: 'i1', marca: 'Deye', modelo: 'SUN-8K-G03', potencia_kw: 8, equipamento_id: 'i1' },
        estrutura: { tipo: 'ceramico', descricao: 'telhado' },
      },
    }
    await montar()
    expect(screen.getByLabelText('Módulo').value).toBe('m2')
    expect(screen.getByLabelText('Quantidade de módulos').value).toBe('30')
    expect(screen.getByLabelText('Inversor').value).toBe('i1')
  })

  it('9 · trocar a seleção substitui — não acumula', async () => {
    projetoAtual = {
      ...PROJETO,
      equipamentos: {
        paineis: [{ id: 'm1', marca: 'DAH', modelo: 'DHN-550', potencia_w: 550, quantidade: 26, equipamento_id: 'm1' }],
        inversor: {}, estrutura: null,
      },
    }
    await montar()
    escolher('Módulo', 'm2')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(enviado().paineis).toHaveLength(1)
    expect(enviado().paineis[0].equipamento_id).toBe('m2')
  })

  it('10 · limpar a seleção grava vazio, não o item anterior', async () => {
    projetoAtual = {
      ...PROJETO,
      equipamentos: {
        paineis: [{ id: 'm1', marca: 'DAH', modelo: 'DHN-550', potencia_w: 550, quantidade: 26, equipamento_id: 'm1' }],
        inversor: {}, estrutura: null,
      },
    }
    await montar()
    escolher('Módulo', '')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(enviado().paineis).toEqual([])
  })

  it('11 · sem alteração, nada é enviado', async () => {
    await montar()
    expect(screen.getByText('Salvar equipamentos').disabled).toBe(true)
    salvar()
    expect(salvarEtapa).not.toHaveBeenCalled()
  })

  it('12 · erro do servidor é exibido sem reinterpretação', async () => {
    const e = new Error('Projeto congelado — alteração de "equipamentos" bloqueada.')
    e.codigo = 'PROJETO_CONGELADO'
    salvarEtapa.mockRejectedValue(e)
    await montar()
    escolher('Módulo', 'm1')
    salvar()
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('Projeto congelado')
    expect(alerta.textContent).toContain('PROJETO_CONGELADO')
  })

  it('13 · catálogo indisponível é declarado, não contornado', async () => {
    listarCatalogo.mockRejectedValue(new Error('DB_OFFLINE'))
    render(<EtapaEquipamentos />)
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('DB_OFFLINE')
    // Sem catálogo não há lista local de reserva.
    expect(document.body.textContent).not.toContain('Canadian Solar')
  })

  it('14 · MPPT e dimensionamento continuam pendentes, e a tela diz isso', async () => {
    await montar()
    escolher('Módulo', 'm1')
    escolher('Inversor', 'i1')
    salvar()
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    const d = enviado()
    expect(d.arranjo).toBeUndefined()
    expect(d.mppts).toBeUndefined()
    expect(d.num_strings).toBeUndefined()
    expect(document.body.textContent).toContain('MPPT não são definidos aqui')
  })
})

describe('FV-UX-019 · nenhum catálogo paralelo, nenhum cálculo no cliente', () => {
  const ler = async (rel) => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    return readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), rel), 'utf8')
  }
  const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('15 · nenhuma lista de modelos embutida — o catálogo é a fonte', async () => {
    const fontes = semComentarios(await ler('../paginas/etapas/EtapaEquipamentos.jsx'))
      + semComentarios(await ler('../catalogo.js'))
    for (const marca of ['Canadian', 'Fronius', 'Sungrow', 'Growatt', 'Trina', 'Risen',
      'INVERSORES_DATA', 'PAINEIS_DATA', 'DADOS_ELETRICOS']) {
      expect(fontes.includes(marca), `encontrou \`${marca}\``).toBe(false)
    }
  })

  it('16 · nenhum default técnico — o `?? 0` do adapter do wizard não entrou aqui', async () => {
    const fontes = semComentarios(await ler('../paginas/etapas/EtapaEquipamentos.jsx'))
      + semComentarios(await ler('../catalogo.js'))
    for (const p of ['?? 0', '|| 0', '?? 1,', '?? 12', '?? 25', '?? 550', '|| 550', '?? 5,']) {
      expect(fontes.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('17 · nenhuma engenharia nem finança no cliente', async () => {
    const fontes = await ler('../paginas/etapas/EtapaEquipamentos.jsx') + await ler('../catalogo.js')
    for (const p of ['Math.pow', 'Math.sqrt', 'Math.ceil', 'Math.floor',
      'engenhariaNormativa', 'unifilar-svg', 'calcularVPL', 'calcularTIR',
      'oversizing', 'num_strings', 'modulos_por_string']) {
      expect(fontes.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('18 · só entram peças CANÔNICAS do domínio compartilhado', async () => {
    const cat = await ler('../catalogo.js')
    const imports = cat.split('\n').filter((l) => l.startsWith('import '))
    // A FV-UX-019 exigia exatamente 1 import. A FV-UX-028 (A5b) somou o leitor
    // SSOT do inversor — que é o oposto de uma regra local: substituiu a lista
    // de aliases própria que este arquivo mantinha. A exigência passou a ser
    // "todo import vem de `@fortesolar/fv-shared`", que é o que importa.
    expect(imports.length).toBeGreaterThan(0)
    for (const l of imports) expect(l).toContain('@fortesolar/fv-shared')
    expect(cat).toContain('tecnologiaInversor')
    expect(cat).toContain('lerInversor')
    // E `paraDimensionamento` continua FORA do CÓDIGO: é ele que carrega os
    // defaults (`?? 2`, `?? 600`, `?? 550`, `?? 13`). O nome aparece só no
    // comentário que explica por que não é usado — citar não é usar.
    expect(semComentarios(cat)).not.toContain('paraDimensionamento')
  })

  it('19 · nenhuma chamada HTTP direta na etapa', async () => {
    const fonte = await ler('../paginas/etapas/EtapaEquipamentos.jsx')
    for (const p of ['fetch(', 'apiFetch', 'axios', "method: 'PUT'", "method: 'POST'"]) {
      expect(fonte.includes(p), `encontrou \`${p}\``).toBe(false)
    }
    expect(fonte.includes('acoes.salvarEtapa')).toBe(true)
    expect(fonte.includes('listarCatalogo')).toBe(true)
  })

  it('20 · o cliente da API usa a rota oficial do catálogo, sem criar outra', async () => {
    const api = await ler('../api/agregadosFvApi.js')
    expect(api.includes('/api/equipamentos/engenharia?tipo=')).toBe(true)
    expect(api.includes('/api/catalogo')).toBe(false)
    expect(api.includes('/equipamentos/fv')).toBe(false)
  })

  it('21 · o estado do projeto não é duplicado', async () => {
    const fonte = await ler('../paginas/etapas/EtapaEquipamentos.jsx')
    expect(fonte.includes('useProjeto')).toBe(true)
    for (const p of ['createContext', 'localStorage', 'sessionStorage', 'buscarProjeto']) {
      expect(fonte.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })
})
