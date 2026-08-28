import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * FV-UX-043 — UX do Parecer de Acesso.
 *
 * O que estes testes protegem:
 *   1. os três estados do domínio aparecem como três telas distintas;
 *   2. a tela NÃO valida, NÃO normaliza e NÃO compara — só renderiza o que o
 *      servidor respondeu (senão haveria uma segunda implementação da regra);
 *   3. campo em branco vira `null`, nunca valor plausível;
 *   4. o e-mail nunca é sintetizado;
 *   5. conflito é exibido dizendo que NADA foi alterado (FV-DOM-042/D4);
 *   6. bloqueio impede confirmar; lacuna não impede nada;
 *   7. o Gate fechado desabilita a escrita;
 *   8. o arquivo é usado só pelo NOME — nada é lido nem enviado.
 */

const registrarParecer = vi.fn()
const obterParecer = vi.fn()
const confirmarParecer = vi.fn()

vi.mock('../api/agregadosFvApi', () => ({
  registrarParecer: (...a) => registrarParecer(...a),
  obterParecer: (...a) => obterParecer(...a),
  confirmarParecer: (...a) => confirmarParecer(...a),
}))

import ParecerDeAcesso from '../componentes/ParecerDeAcesso'

const SEM_PARECER = { registrado: false, estado: null, confirmado: false, dados: null, validacao: null }

const DADOS = {
  documento: { numero_parecer: '2409118802', emitido_em: '2026-03-11T00:00:00.000Z',
    distribuidora: 'Neoenergia' },
  cliente: { nome: 'JOÃO SILVA', cpf_cnpj: '123.456.789-10', email: null, endereco: null },
  uc: { numero_cliente: '2409118802', tipo_ligacao: 'Monofásico', tensao_v: 220,
    grupo_tarifario: 'B', modalidade_gd: 'GD II', modalidade_gd_aceita: true },
  geracao: {
    modulos: [{ marca: 'Znshine', modelo: 'ZXM7', potencia_w: 650, quantidade: 24 }],
    inversores: [{ marca: 'Hoymiles', modelo: 'HMS-2000-4T', potencia_kw: 2, quantidade: 8 }],
    potencia_instalada_kwp: 15.6,
  },
}
const EXTRAIDO = {
  registrado: true, estado: 'extraido', confirmado: false, dados: DADOS,
  validacao: { aproveitavel: true, confirmavel: true, impeditivos: [], bloqueios: [],
    lacunas: ['cliente.email', 'cliente.endereco'] },
}
const montar = async (props = {}) => {
  render(<ParecerDeAcesso projetoId="p1" liberado {...props} />)
  await waitFor(() => expect(screen.queryByText('Carregando…')).toBe(null))
}

beforeEach(() => {
  vi.clearAllMocks()
  obterParecer.mockResolvedValue(SEM_PARECER)
})

// ═══ 1 · Estado: nenhum parecer ════════════════════════════════════════════
describe('FV-UX-043 · nenhum parecer', () => {
  it('1 · convida a registrar e diz que não há leitura automática', async () => {
    await montar()
    expect(screen.getByText('Registrar parecer manualmente')).toBeTruthy()
    expect(screen.getByText(/leitura automática de PDF não está disponível/i)).toBeTruthy()
    expect(screen.getByText(/não é enviado a nenhum serviço externo/i)).toBeTruthy()
  })

  it('2 · Gate fechado desabilita o registro', async () => {
    await montar({ liberado: false })
    expect(screen.getByText('Registrar parecer manualmente').closest('button').disabled).toBe(true)
    expect(screen.getByText(/O Gate bloqueia esta fase/i)).toBeTruthy()
  })

  it('3 · o arquivo é usado só pelo NOME — nada é lido', async () => {
    await montar()
    fireEvent.click(screen.getByText('Registrar parecer manualmente'))
    expect(screen.getByText(/apenas registra o/i)).toBeTruthy()
    const fonte = readFileSync(
      resolve(process.cwd(), 'src/fv/componentes/ParecerDeAcesso.jsx'), 'utf8')
    expect(/FileReader|readAsArrayBuffer|readAsText|FormData/.test(fonte)).toBe(false)
    expect(fonte.includes('e.target.files?.[0]?.name')).toBe(true)
  })
})

// ═══ 2 · Registro ══════════════════════════════════════════════════════════
describe('FV-UX-043 · registro', () => {
  it('4 · campo em branco vira null — nunca valor plausível', async () => {
    registrarParecer.mockResolvedValue({ sucesso: true, comparacao: null })
    await montar()
    fireEvent.click(screen.getByText('Registrar parecer manualmente'))
    fireEvent.click(screen.getByText('Registrar parecer'))

    await waitFor(() => expect(registrarParecer).toHaveBeenCalled())
    const [, corpo] = registrarParecer.mock.calls[0]
    expect(corpo.metodo).toBe('manual')
    expect(corpo.dados.uc.tipo_ligacao).toBe(null)
    expect(corpo.dados.uc.tensao_v).toBe(null)
    expect(corpo.dados.uc.modalidade_gd).toBe(null)
    expect(corpo.dados.geracao.modulos).toEqual([])
    // O e-mail NUNCA é sintetizado.
    expect(corpo.dados.cliente.email).toBe(null)
  })

  it('5 · o que foi digitado chega como digitado', async () => {
    registrarParecer.mockResolvedValue({ sucesso: true, comparacao: null })
    await montar()
    fireEvent.click(screen.getByText('Registrar parecer manualmente'))
    const digitar = (rotulo, valor) => fireEvent.change(
      screen.getByText(rotulo).parentElement.querySelector('input'), { target: { value: valor } })
    digitar('Número do parecer', '2409118802')
    digitar('Tensão (V)', '220')
    fireEvent.click(screen.getByText('Registrar parecer'))

    await waitFor(() => expect(registrarParecer).toHaveBeenCalled())
    const [, corpo] = registrarParecer.mock.calls[0]
    expect(corpo.dados.numero_parecer).toBe('2409118802')
    expect(corpo.dados.uc.tensao_v).toBe(220)
  })

  it('6 · o erro real do servidor chega ao operador', async () => {
    const erro = new Error('Sem identificação do cliente')
    erro.codigo = 'EXTRACAO_INVALIDA'
    registrarParecer.mockRejectedValue(erro)
    await montar()
    fireEvent.click(screen.getByText('Registrar parecer manualmente'))
    fireEvent.click(screen.getByText('Registrar parecer'))
    await waitFor(() =>
      expect(screen.getByText(/Sem identificação do cliente \(EXTRACAO_INVALIDA\)/)).toBeTruthy())
  })
})

// ═══ 3 · Estado: extraído ══════════════════════════════════════════════════
describe('FV-UX-043 · parecer extraído', () => {
  beforeEach(() => { obterParecer.mockResolvedValue(EXTRAIDO) })

  it('7 · mostra os dados do documento e o selo de pendência', async () => {
    await montar()
    expect(screen.getByText('extraído — aguarda conferência')).toBeTruthy()
    // Número do parecer e número de cliente coincidem neste documento — é como
    // vêm em vários pareceres reais (o exemplo do extrator legado é assim).
    expect(screen.getAllByText('2409118802').length).toBe(2)
    expect(screen.getByText('24 × Znshine ZXM7')).toBeTruthy()
    // A quantidade de INVERSOR aparece — era o que o legado perdia.
    expect(screen.getByText('8 × Hoymiles HMS-2000-4T')).toBeTruthy()
  })

  it('8 · lacuna é listada e NÃO impede confirmar', async () => {
    await montar()
    expect(screen.getByText(/2 dado\(s\) que o documento não informou/)).toBeTruthy()
    expect(screen.getByText('Confirmar conferência').closest('button').disabled).toBe(false)
  })

  it('9 · bloqueio impede confirmar', async () => {
    obterParecer.mockResolvedValue({ ...EXTRAIDO,
      validacao: { ...EXTRAIDO.validacao, confirmavel: false,
        bloqueios: ['Quantidade ausente ou inválida no módulo "Znshine ZXM7".'] } })
    await montar()
    expect(screen.getByText(/Precisa de correção antes da conferência/)).toBeTruthy()
    expect(screen.getByText(/Quantidade ausente/)).toBeTruthy()
    expect(screen.getByText('Confirmar conferência').closest('button').disabled).toBe(true)
  })

  it('10 · modalidade fora do domínio é declarada, não convertida', async () => {
    obterParecer.mockResolvedValue({ ...EXTRAIDO,
      dados: { ...DADOS, uc: { ...DADOS.uc, modalidade_gd: 'GD I', modalidade_gd_aceita: false } } })
    await montar()
    expect(screen.getByText('GD I')).toBeTruthy()
    expect(screen.getByText(/preservado como veio no documento — não foi convertido/i)).toBeTruthy()
  })

  it('11 · confirmar chama o servidor e recarrega', async () => {
    confirmarParecer.mockResolvedValue({ sucesso: true })
    await montar()
    fireEvent.click(screen.getByText('Confirmar conferência'))
    await waitFor(() => expect(confirmarParecer).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(obterParecer.mock.calls.length).toBe(2))
  })

  it('12 · diz que confirmar NÃO copia dado para o projeto', async () => {
    await montar()
    expect(screen.getByText(/Nenhum dado é copiado para o projeto/i)).toBeTruthy()
  })

  it('13 · Gate fechado desabilita a confirmação', async () => {
    await montar({ liberado: false })
    expect(screen.getByText('Confirmar conferência').closest('button').disabled).toBe(true)
  })
})

// ═══ 4 · Conflito — D4 ═════════════════════════════════════════════════════
describe('FV-UX-043 · conflito', () => {
  it('14 · exibe a divergência e afirma que nada foi alterado', async () => {
    obterParecer.mockResolvedValue(SEM_PARECER)
    registrarParecer.mockResolvedValue({
      sucesso: true,
      comparacao: { tem_conflito: true, novos: [], iguais: [],
        conflitos: [{ campo: 'uc.tipo_ligacao', parecer: 'Monofásico', projeto: 'Trifásico' }] },
    })
    render(<ParecerDeAcesso projetoId="p1" liberado />)
    await waitFor(() => expect(screen.queryByText('Carregando…')).toBe(null))
    obterParecer.mockResolvedValue(EXTRAIDO)
    fireEvent.click(screen.getByText('Registrar parecer manualmente'))
    fireEvent.click(screen.getByText('Registrar parecer'))

    await waitFor(() => expect(screen.getByText(/1 divergência\(s\)/)).toBeTruthy())
    expect(screen.getByText(/Tipo de ligação/)).toBeTruthy()
    expect(screen.getByText(/Nada foi alterado no projeto/i)).toBeTruthy()
  })
})

// ═══ 5 · Estado: confirmado ════════════════════════════════════════════════
describe('FV-UX-043 · parecer confirmado', () => {
  it('15 · vira somente leitura', async () => {
    obterParecer.mockResolvedValue({ ...EXTRAIDO, estado: 'confirmado', confirmado: true })
    await montar()
    expect(screen.getByText('conferido')).toBeTruthy()
    expect(screen.queryByText('Confirmar conferência')).toBe(null)
    expect(screen.queryByText('Registrar parecer manualmente')).toBe(null)
    expect(screen.getByText(/Documento conferido pelo operador/i)).toBeTruthy()
  })
})

// ═══ 6 · A tela não reimplementa a regra ═══════════════════════════════════
describe('FV-UX-043 · a regra fica no domínio', () => {
  it('16 · a tela não valida, não normaliza e não compara', async () => {
    const fonte = readFileSync(
      resolve(process.cwd(), 'src/fv/componentes/ParecerDeAcesso.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    // Nenhuma cópia das regras do domínio.
    expect(/validarExtracao|normalizarExtracao|compararComCanonico/.test(fonte)).toBe(false)
    expect(/\{\s*127\s*,\s*220\s*,\s*380\s*\}|\[127, 220, 380\]/.test(fonte)).toBe(false)
    expect(/GD II'\s*,\s*'GD III/.test(fonte)).toBe(false)
    expect(/\\d\{3\}\\.\\d\{3\}/.test(fonte)).toBe(false)   // regex de CPF
    // Nem cálculo de coerência.
    expect(/potencia_w\s*\*\s*quantidade/.test(fonte)).toBe(false)
    // Quem decide se pode confirmar é o servidor.
    expect(fonte.includes('validacao?.confirmavel === false')).toBe(true)
  })
})
