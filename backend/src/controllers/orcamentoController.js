// Geração de PDF de orçamento comercial com jsPDF
// Este arquivo serve como referência para o frontend ou para futuro endpoint de geração no backend

export function estruturaOrcamentoPDF(dados) {
  /**
   * Estrutura completa para geração de PDF de orçamento comercial
   * Dados esperados:
   * {
   *   empresa: { nomeEmpresa, corPrimaria, corSecundaria, logo, email, telefone, site },
   *   cliente: { nomeCliente, nomeProjeto },
   *   sistema: { potenciaRealKwp, numPaineis, numInversores, areaNecessaria, percentualAtendimento },
   *   geracao: { geracaoMediaMensal, geracaoAnual, mensal: [...] },
   *   financeiro: { custoTotalEstimado, economiaMensal, economiaAnual, paybackAnos, tir, vpl, roi25Anos },
   *   entrada: { consumoMensal, tarifaEnergia, tipoSistema, potenciaPainelW },
   * }
   *
   * Estrutura do PDF (3 páginas):
   * 1. Capa + Resumo Executivo + Antes vs Depois
   * 2. Especificação Técnica + Análise Financeira
   * 3. Geração Mensal + Garantias + CTA
   */

  return {
    pagina1: {
      secoes: ['capa', 'resumoExecutivo', 'antesVsDepois'],
      descricao: 'Capa com logo, resumo dos KPIs principais, e comparativo da conta de luz sem/com solar',
    },
    pagina2: {
      secoes: ['especificacaoTecnica', 'analisaFinanceira'],
      descricao: 'Dados técnicos do sistema e métricas financeiras (payback, TIR, VPL, ROI)',
    },
    pagina3: {
      secoes: ['geracaoMensal', 'garantias', 'ctaComercial'],
      descricao: 'Tabela de geração mensal, garantias dos equipamentos, e chamada comercial',
    },
  }
}

/**
 * Exemplo de resposta JSON para o frontend usar na geração de PDF
 * O frontend usa jsPDF + esta estrutura para gerar o PDF localmente
 */
export function gerarEstruturaPDF(req, res) {
  try {
    const {
      empresa = {},
      cliente = {},
      sistema = {},
      geracao = {},
      financeiro = {},
      entrada = {},
    } = req.body

    if (!cliente?.nomeCliente) {
      return res.status(400).json({ erro: 'Dados do cliente incompletos.' })
    }

    // Validações básicas
    if (!sistema?.potenciaRealKwp) {
      return res.status(400).json({ erro: 'Dados do sistema incompletos.' })
    }

    // Gerar estrutura base do PDF
    const estrutura = {
      metadata: {
        titulo: `Proposta Comercial - ${cliente.nomeProjeto || 'Sistema FV'}`,
        data: new Date().toLocaleDateString('pt-BR'),
        empresa: empresa.nomeEmpresa || 'Forte Solar',
      },
      paginas: [
        {
          numero: 1,
          titulo: 'Proposta Comercial',
          secoes: [
            {
              tipo: 'capa',
              dados: {
                empresa,
                titulo: 'PROPOSTA COMERCIAL — ENERGIA SOLAR FOTOVOLTAICA',
                cliente: cliente.nomeCliente,
                projeto: cliente.nomeProjeto || `Sistema FV ${sistema.potenciaRealKwp} kWp`,
              },
            },
            {
              tipo: 'resumoExecutivo',
              dados: {
                potencia: sistema.potenciaRealKwp,
                geracaoMensal: geracao.geracaoMediaMensal,
                economiaAnual: financeiro.economiaAnual,
                payback: financeiro.paybackAnos,
                tir: financeiro.tir,
                roi25: financeiro.roi25Anos,
              },
            },
            {
              tipo: 'antesVsDepois',
              dados: {
                consumoMensal: entrada.consumoMensal,
                tarifaEnergia: entrada.tarifaEnergia,
                geracaoMedia: geracao.geracaoMediaMensal,
              },
            },
          ],
        },
        {
          numero: 2,
          titulo: 'Especificação Técnica e Análise Financeira',
          secoes: [
            {
              tipo: 'especificacaoTecnica',
              dados: {
                potenciaKwp: sistema.potenciaRealKwp,
                numPaineis: sistema.numPaineis,
                numInversores: sistema.numInversores,
                areaNecessaria: sistema.areaNecessaria,
                atendimento: sistema.percentualAtendimento,
                tipoSistema: entrada.tipoSistema,
                potenciaPainel: entrada.potenciaPainelW,
              },
            },
            {
              tipo: 'analisaFinanceira',
              dados: {
                investimento: financeiro.custoTotalEstimado,
                economiaMensal: financeiro.economiaMensal,
                economiaAnual: financeiro.economiaAnual,
                payback: financeiro.paybackAnos,
                tir: financeiro.tir,
                vpl: financeiro.vpl,
                roi25: financeiro.roi25Anos,
              },
            },
          ],
        },
        {
          numero: 3,
          titulo: 'Geração Mensal, Garantias e CTA',
          secoes: [
            {
              tipo: 'geracaoMensal',
              dados: {
                perfil: geracao.mensal || [],
              },
            },
            {
              tipo: 'garantias',
              dados: {
                modulo: {
                  garantiaProduto: 12,
                  garantiaPerformance: 25,
                  percentualPerformance: 80,
                },
                inversor: {
                  garantia: 10,
                },
              },
            },
            {
              tipo: 'ctaComercial',
              dados: {
                empresa: empresa.nomeEmpresa || 'Forte Solar',
                telefone: empresa.telefone || '—',
                email: empresa.email || '—',
                site: empresa.site || '—',
                validadePropostaEmDias: 30,
              },
            },
          ],
        },
      ],
      estilos: {
        corPrimaria: empresa.corPrimaria || '#f97316',
        corSecundaria: empresa.corSecundaria || '#0f172a',
        logo: empresa.logo || null,
      },
    }

    res.json(estrutura)
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}

/**
 * Endpoint para validar dados antes de gerar PDF
 * Verifica se todos os dados necessários estão presentes
 */
export function validarDadosOrcamento(req, res) {
  try {
    const { cliente, sistema, geracao, financeiro, entrada } = req.body

    const erros = []
    const avisos = []

    // Validações obrigatórias
    if (!cliente?.nomeCliente) erros.push('Cliente: nome obrigatório')
    if (!sistema?.potenciaRealKwp) erros.push('Sistema: potência obrigatória')
    if (!geracao?.geracaoMediaMensal) erros.push('Geração: dados incompletos')
    if (!financeiro?.custoTotalEstimado) erros.push('Financeiro: investimento obrigatório')
    if (!entrada?.consumoMensal) erros.push('Entrada: consumo obrigatório')

    // Validações de coerência
    if (sistema?.potenciaRealKwp && geracao?.geracaoMediaMensal) {
      if (geracao.geracaoMediaMensal > entrada?.consumoMensal * 1.5) {
        avisos.push('Geração muito superior ao consumo — verifique os dados')
      }
    }

    if (financeiro?.paybackAnos && financeiro.paybackAnos > 50) {
      avisos.push('Payback superior a 50 anos — rentabilidade baixa')
    }

    res.json({
      valido: erros.length === 0,
      erros,
      avisos,
      dadosPresentes: {
        cliente: !!cliente?.nomeCliente,
        sistema: !!sistema?.potenciaRealKwp,
        geracao: !!geracao?.geracaoMediaMensal,
        financeiro: !!financeiro?.custoTotalEstimado,
        entrada: !!entrada?.consumoMensal,
      },
    })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}
