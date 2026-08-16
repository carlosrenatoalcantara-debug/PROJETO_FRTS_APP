import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

/**
 * FV-UX-016 §4 — prova contra o defeito que a FV-DOM-007B expôs.
 *
 * O motor de unifilar espera o formato do contexto do wizard; o documento
 * persistido tem outro formato. Quando o documento cru chegava ao motor, ele não
 * encontrava nenhum campo e desenhava os DEFAULTS internos:
 *
 *   Fronius SYMO · 5 kW · 1 MPPT · 6 módulos · 3,3 kWp · monofásico 220 V
 *
 * A nova UX não pode reproduzir isso. Como ela não gera nada — só apresenta o
 * que o domínio devolveu — a prova aqui é dupla:
 *
 *  1. os valores REAIS do projeto chegam à tela;
 *  2. nenhum dos valores de default aparece;
 *  3. o componente não contém cálculo de engenharia (varredura do fonte).
 */

const gerarUnifilarMock = vi.fn()
vi.mock('../api/agregadosFvApi', () => ({
  gerarUnifilar: (...a) => gerarUnifilarMock(...a),
}))

// A etapa lê a liberação da fase do ContratoProvider — servidor, não cliente.
const liberadaParaMock = vi.fn(() => true)
vi.mock('../providers/ContratoProvider', () => ({
  useContrato: () => ({ liberadaPara: liberadaParaMock, motivoDe: () => null }),
}))

let projetoMock = { _id: 'p1', governanca: null }
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({ projetoId: 'p1', projeto: projetoMock }),
}))

import { UnifilarProvider } from '../providers/UnifilarProvider'
import EtapaUnifilar from '../paginas/etapas/EtapaUnifilar'

/**
 * Resposta canônica para o projeto real do §4:
 * Deye SUN-8K-G03 · 8 kW · 2 MPPT · 26 módulos · 14,3 kWp · trifásico 380 V · BESS.
 */
const RESPOSTA_PROJETO_REAL = {
  sucesso: true,
  origem: 'dados_atuais',
  svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>Deye</text><text>SUN-8K-G03</text>
        <text>MPPT 1</text><text>MPPT 2</text><text>3Ø 380V</text><text>BESS 10kWh</text></svg>`,
  proveniencia: {
    painel: 'equipamentos.paineis[0]',
    inversor: 'equipamentos.inversor',
    arranjoMPPTs: 'engenharia_eletrica.arranjo.mppts',
    dimensionamento: 'dimensionamento',
    tipo_ligacao: 'fatura_extracao.tipo_ligacao',
    tensao: 'fatura_extracao.tensao_v',
    distribuidora: 'projeto.distribuidora',
    uf: 'localizacao.estado',
    nomeCliente: 'clienteId.nome',
  },
  lacunas: [],
  especificacoes: {
    potencia_cc_kwp: 14.3,
    potencia_ca_kw: 8,
    num_paineis: 26,
    num_strings: 3,
    num_mppts: 2,
    voc_max_v: 459.7,
    isc_total_a: 52.2,
    corrente_ac_a: 12.8,
    cabo_dc_mm2: '4',
    cabo_ac_mm2: '1.5',
    disjuntor_ac_a: '10',
    tensao_ac_v: 380,
    fases: 3,
    dps: { modelo: 'DPS DC 600V / In=20kA', nivel: 'Tipo II', ucMin: 566 },
  },
}

/** Os valores que o motor produz quando NÃO consegue ler o projeto. */
const DEFAULTS_PROIBIDOS = ['Fronius SYMO', '5 kW', '1 MPPT', '6 módulos', '3,3 kWp']

function montar() {
  return render(
    <UnifilarProvider>
      <EtapaUnifilar />
    </UnifilarProvider>,
  )
}

describe('FV-UX-016 · Unifilar na nova UX — sem defaults silenciosos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projetoMock = { _id: 'p1', governanca: null }
    gerarUnifilarMock.mockResolvedValue(RESPOSTA_PROJETO_REAL)
  })

  it('consome o endpoint canônico ao abrir a etapa', async () => {
    montar()
    await waitFor(() => expect(gerarUnifilarMock).toHaveBeenCalledWith('p1'))
  })

  it('exibe os dados REAIS do projeto, não os defaults do motor', async () => {
    montar()
    await screen.findByText('14.3 kWp')

    // Valores do projeto real
    expect(screen.getByText('8 kW')).toBeTruthy()      // potência CA
    expect(screen.getByText('26')).toBeTruthy()        // módulos
    expect(screen.getByText('2')).toBeTruthy()         // MPPTs
    expect(screen.getByText('380 V')).toBeTruthy()     // tensão AC
    expect(screen.getByText('3Ø')).toBeTruthy()        // trifásico

    // O SVG do domínio — com o equipamento real e o BESS — foi renderizado
    const texto = document.body.textContent
    expect(texto).toContain('Deye')
    expect(texto).toContain('SUN-8K-G03')
    expect(texto).toContain('BESS 10kWh')
  })

  it('não apresenta nenhum dos valores de default do motor', async () => {
    montar()
    await screen.findByText('14.3 kWp')
    const texto = document.body.textContent
    for (const proibido of DEFAULTS_PROIBIDOS) {
      expect(texto).not.toContain(proibido)
    }
  })

  it('mostra as lacunas declaradas pelo servidor em vez de escondê-las', async () => {
    gerarUnifilarMock.mockResolvedValue({
      ...RESPOSTA_PROJETO_REAL,
      lacunas: ['inversor', 'uf'],
      proveniencia: { ...RESPOSTA_PROJETO_REAL.proveniencia, inversor: null, uf: null },
    })
    montar()
    await screen.findByText(/2 dado\(s\) ausente\(s\)/)
    expect(screen.getByText('Inversor')).toBeTruthy()
    expect(screen.getByText('UF (temperatura de projeto)')).toBeTruthy()
    // E diz por que isso importa, em vez de exibir o default como se fosse dado.
    expect(document.body.textContent).toContain('NÃO descrevem')
  })

  it('separa snapshot congelado de dados atuais — nunca os funde', async () => {
    projetoMock = {
      _id: 'p1',
      governanca: {
        snapshot_unifilar: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>DESENHO CONGELADO</text></svg>',
          criado_em: '2026-01-15T00:00:00.000Z',
          versao: 'A',
        },
      },
    }
    montar()
    await screen.findByText('Dados atuais')
    expect(screen.getByText('Snapshot congelado')).toBeTruthy()
    // Por padrão exibe o atual — o congelado é outro fato, exibido sob escolha.
    expect(document.body.textContent).toContain('Deye')
    expect(document.body.textContent).not.toContain('DESENHO CONGELADO')
  })

  it('propaga o erro do servidor sem reinterpretá-lo', async () => {
    const e = new Error('Projeto não encontrado')
    e.codigo = 'PROJETO_INEXISTENTE'
    gerarUnifilarMock.mockRejectedValue(e)
    montar()
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Projeto não encontrado')
    expect(screen.getByRole('alert').textContent).toContain('PROJETO_INEXISTENTE')
  })

  it('usa a decisão de fase do servidor, sem booleano local de congelamento', async () => {
    liberadaParaMock.mockReturnValue(false)
    montar()
    await screen.findByText(/Engenharia ainda não liberada/)
    expect(liberadaParaMock).toHaveBeenCalledWith('engenharia')
  })
})

describe('FV-UX-016 §3 · nenhuma engenharia no cliente', () => {
  it('o componente e o provider não contêm cálculo normativo', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const aqui = path.dirname(fileURLToPath(import.meta.url))

    const fontes = [
      readFileSync(path.resolve(aqui, '../paginas/etapas/EtapaUnifilar.jsx'), 'utf8'),
      readFileSync(path.resolve(aqui, '../providers/UnifilarProvider.jsx'), 'utf8'),
    ].join('\n')

    // Nomes das funções da engenharia normativa — nenhuma pode ser chamada aqui.
    for (const proibido of [
      'montarModeloEletrico', 'calcularVocMaxString', 'calcularVmppMinString',
      'calcularIscMax', 'calcularCorrenteAC', 'selecionarCabo', 'selecionarDPS',
      'gerarUnifilarSVG', 'engenhariaNormativa', 'catalogoEletrico',
      'TEMPERATURAS_UF', 'Math.sqrt',
    ]) {
      expect(fontes).not.toContain(proibido)
    }
  })
})
