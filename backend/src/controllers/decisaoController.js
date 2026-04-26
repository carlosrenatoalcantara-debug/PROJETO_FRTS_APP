export function recomendarSistema(req, res) {
  try {
    const {
      consumo,
      area,
      carga,
      strings,
      validacao,
      sombreamento,
      bess,
      financeiro
    } = req.body

    if (!consumo || !strings || !validacao || !financeiro) {
      return res.status(400).json({ erro: 'Dados incompletos para recomendação' })
    }

    const alertas = []
    let confiabilidade = 'alta'
    let razaoRecomendacao = []

    // Validação de segurança
    if (validacao && !validacao.valido) {
      confiabilidade = 'baixa'
      alertas.push('Sistema não passa em validação elétrica - revisão necessária')
    }

    // Análise de simplicidade
    const numStrings = strings.totalStrings || 1
    if (numStrings > 4) {
      razaoRecomendacao.push('múltiplas strings (configuração complexa)')
      confiabilidade = confiabilidade === 'alta' ? 'media' : confiabilidade
    } else if (numStrings <= 2) {
      razaoRecomendacao.push('configuração simples e robusta')
    }

    // Análise de potência
    const potenciaKwp = strings.potenciaKwp || 5
    if (potenciaKwp < consumo.consumoMensal / 200) {
      razaoRecomendacao.push('potência adequada para o consumo')
    } else if (potenciaKwp > consumo.consumoMensal / 150) {
      razaoRecomendacao.push('potência generosa com excedentes')
    }

    // Análise de sombreamento
    if (sombreamento && sombreamento.percentualSombreamento > 25) {
      alertas.push('Sombreamento acima de 25% - revisar posicionamento')
      confiabilidade = 'media'
    } else if (sombreamento && sombreamento.percentualSombreamento > 10) {
      razaoRecomendacao.push('sombreamento moderado - geração reduzida em ~10-15%')
    } else {
      razaoRecomendacao.push('localização com excelente irradiação')
    }

    // Análise BESS
    let temBESS = false
    if (bess && bess.paybackComBateria && bess.paybackComBateria < 12) {
      temBESS = true
      razaoRecomendacao.push('BESS viável com retorno rápido')
    } else if (bess && bess.paybackComBateria && bess.paybackComBateria < 15) {
      razaoRecomendacao.push('BESS com retorno moderado')
    } else if (bess) {
      razaoRecomendacao.push('BESS não é economicamente viável no cenário atual')
    }

    // Análise Financeira
    const paybackAnos = financeiro?.payback || 8
    const economiaAnual = financeiro?.economia_total_25anos ? Math.round(financeiro.economia_total_25anos / 25) : consumo.consumoMensal * 12 * 0.95 * 0.3
    const tir = financeiro?.tir || 12

    if (tir > 10) {
      razaoRecomendacao.push('excelente retorno financeiro (TIR > 10%)')
    } else if (tir > 6) {
      razaoRecomendacao.push('retorno financeiro satisfatório')
    }

    // Construir recomendação de sistema
    const sistemaRecomendado = {
      modulos: {
        modelo: strings.painelModelo || 'CS6W-550MS',
        potencia: strings.potenciaPainelW || 550,
        quantidade: strings.paineisPorString ? strings.totalStrings * strings.paineisPorString : 10,
        marca: strings.painelMarca || 'Canadian Solar'
      },
      inversor: {
        modelo: strings.inversorModelo || 'Primo 5.0-1',
        potencia: strings.potenciaInversorKW || 5,
        marca: strings.inversorMarca || 'Fronius'
      },
      potencia: {
        total_kwp: strings.potenciaKwp || 5,
        nominal_kw: strings.potenciaInversorKW || 5
      },
      configuracao: {
        strings: strings.totalStrings || 1,
        paineisPorString: strings.paineisPorString || 10,
        voc_frio: strings.vocFrio ? `${strings.vocFrio}V` : '49.5V',
        vmp_string: strings.vmpString ? `${strings.vmpString}V` : '41.5V'
      },
      bess: temBESS ? {
        capacidade_kwh: bess?.capacidadeKWh || 10,
        autonomia_horas: bess?.autonomiaHoras || 4,
        investimento: bess?.investimentoTotal || 45000,
        payback_anos: bess?.paybackComBateria || 12
      } : null
    }

    // Gerar justificativa em português
    let justificativa = `Sistema de ${sistemaRecomendado.potencia.total_kwp}kWp recomendado baseado em análise abrangente. `
    justificativa += `Configuração com ${sistemaRecomendado.configuracao.strings} string(s) e ${sistemaRecomendado.modulos.quantidade} módulos de ${sistemaRecomendado.modulos.potencia}W. `
    justificativa += `Inversor ${sistemaRecomendado.inversor.marca} de ${sistemaRecomendado.inversor.potencia}kW garante compatibilidade elétrica. `

    if (razaoRecomendacao.length > 0) {
      justificativa += `Principais razões: ${razaoRecomendacao.join(', ')}. `
    }

    if (temBESS) {
      justificativa += `Bateria de armazenamento recomendada para aumentar autossuficiência e reduzir dependência da rede. `
    } else {
      justificativa += `Sem bateria no cenário atual (economicamente menos viável). `
    }

    justificativa += `Economia estimada de R$ ${economiaAnual.toLocaleString()}/ano com payback de ${paybackAnos} anos.`

    // Adicionar alertas de segurança
    if (!validacao?.valido) {
      alertas.push('⚠️ Validação elétrica falhou - requer análise de engenheiro')
    }
    if (area && sistemaRecomendado.modulos.quantidade * 2 > area) {
      alertas.push('⚠️ Área insuficiente para quantidade de módulos - revisão necessária')
    }

    res.json({
      sistema_recomendado: sistemaRecomendado,
      justificativa,
      economia_estimada: {
        mensal: Math.round(economiaAnual / 12),
        anual: economiaAnual
      },
      payback: paybackAnos,
      tir: +(tir.toFixed(2)),
      vpl: financeiro?.vpl || null,
      confiabilidade,
      alertas: alertas.length > 0 ? alertas : null,
      analise: {
        validacao_eletrica: validacao?.valido ? '✓ Passou' : '✗ Falhou',
        sombreamento: sombreamento?.percentualSombreamento ? `${sombreamento.percentualSombreamento.toFixed(1)}%` : 'Não analisado',
        bess_viavel: temBESS,
        rating_complexidade: numStrings <= 2 ? 'Simples' : numStrings <= 4 ? 'Moderada' : 'Complexa'
      }
    })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}
