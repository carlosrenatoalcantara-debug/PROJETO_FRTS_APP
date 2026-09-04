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
  await waitFor(() => expect(screen.getByLabelText('Marca do módulo').disabled).toBe(false))
}
const escolher = (rotulo, valor) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })
const salvar = () => fireEvent.click(screen.getByText('Salvar equipamentos'))
/** Dados enviados na etapa `equipamentos`. */
const enviado = () => salvarEtapa.mock.calls.find(([e]) => e === 'equipamentos')?.[1]

/**
 * FV-UX-029 substituiu o contrato desta tela: a seleção ÚNICA (um módulo, um
 * inversor) virou COMPOSIÇÃO (N modelos, cada um com quantidade), persistida em
 * `ProjetoFV.arranjos[]`.
 *
 * Os testes de interação que existiam aqui descreviam a tela antiga. Cada uma
 * das intenções que eles protegiam foi reescrita para o contrato novo em
 * `composicaoEquipamentos.test.jsx`:
 *
 *   catálogo consumido por tipo          → teste 9  (a tela começa vazia)
 *   item referencia o catálogo           → testes 22 e 23
 *   especificação ausente vira null      → testes 4 e 18
 *   `estrutura` sobrevive ao save        → teste 23
 *   tecnologia pela regra do domínio     → testes 12 e 20
 *   seleção persistida reabre            → testes 25 e 26
 *   trocar não acumula                   → teste 13 (mesmo modelo SOMA)
 *   sem alteração nada é enviado         → teste 28
 *   erro do servidor propagado           → teste 27
 *   catálogo indisponível declarado      → mantido abaixo
 *   MPPT/dimensionamento fora da etapa   → mantido abaixo
 *
 * O bloco de verificação de CÓDIGO-FONTE segue aqui: ele não depende da forma da
 * tela e continua valendo palavra por palavra.
 */
describe('FV-UX-019 · o que independe da forma da tela', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projetoAtual = PROJETO
    salvarEtapa.mockResolvedValue(undefined)
    listarCatalogo.mockImplementation((tipo) =>
      Promise.resolve({ equipamentos: tipo === 'modulo' ? MODULOS : INVERSORES }))
  })

  it('1 · consome o catálogo canônico, por tipo', async () => {
    render(<EtapaEquipamentos />)
    await waitFor(() => expect(listarCatalogo).toHaveBeenCalledWith('modulo'))
    expect(listarCatalogo).toHaveBeenCalledWith('inversor')
    expect(listarCatalogo).toHaveBeenCalledTimes(2)
  })

  it('13 · catálogo indisponível é declarado, não contornado', async () => {
    listarCatalogo.mockRejectedValue(new Error('DB_OFFLINE'))
    render(<EtapaEquipamentos />)
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('DB_OFFLINE')
    expect(document.body.textContent).not.toContain('Canadian Solar')
  })

  it('14 · MPPT e dimensionamento continuam fora desta etapa', async () => {
    render(<EtapaEquipamentos />)
    await waitFor(() => expect(screen.getByLabelText('Marca do módulo').disabled).toBe(false))
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
    const fontes = semComentarios(await ler('../paginas/etapas/EtapaEquipamentos.jsx'))
      + semComentarios(await ler('../catalogo.js'))
    for (const p of ['Math.pow', 'Math.sqrt', 'Math.ceil', 'Math.floor',
      'engenhariaNormativa', 'unifilar-svg', 'calcularVPL', 'calcularTIR',
      'num_strings', 'modulos_por_string']) {
      expect(fontes.includes(p), `encontrou \`${p}\``).toBe(false)
    }
  })

  it('17b · `oversizing` é LIDO do catálogo, nunca calculado aqui', async () => {
    // FV-DOM-031: `catalogo.js` passou a expor `oversizing_max`, que é um campo
    // DECLARADO pelo fabricante — a leitura dele é o oposto de calcular. O guard
    // continua valendo para o cálculo: nenhuma divisão CC/CA deste lado.
    const fontes = semComentarios(await ler('../paginas/etapas/EtapaEquipamentos.jsx'))
      + semComentarios(await ler('../catalogo.js'))
    for (const p of ['dc_ac', 'dcAc', 'relacaoDcAc', 'oversizing >', 'oversizing <',
      'oversizing_max *', 'oversizing_max /', '/ potencia_ca', '/ potenciaCa']) {
      expect(fontes.includes(p), `encontrou cálculo \`${p}\``).toBe(false)
    }
    // Toda menção a oversizing em `catalogo.js` é leitura pela SSOT.
    const cat = semComentarios(await ler('../catalogo.js'))
    for (const linha of cat.split('\n').filter((l) => /oversizing/i.test(l))) {
      expect(
        /canonico\(equipamento\)\?\.oversizing_max|oversizingMaxDoInversor|oversizing_max:/.test(linha),
        `linha computa em vez de ler: ${linha.trim()}`,
      ).toBe(true)
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
