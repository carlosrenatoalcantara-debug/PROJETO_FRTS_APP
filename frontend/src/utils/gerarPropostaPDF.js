export const gerarPropostaPDF = (dados) => {
  const {
    cliente = {},
    sistema = {},
    orcamento = {},
    empresa = {},
    financeiro = null,   // S4: resultado do centro financeiro EPC (opcional)
    comercial = null,    // S4.2: cenários comerciais comparados (opcional)
    geoespacial = null,  // S6: layout/telhado (panos, área útil, capacidade)
    validadeDias = 30,
  } = dados

  const brlFmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const {
    nome = 'Cliente',
    email = 'email@example.com',
    endereco = 'Endereço',
    telefone = '(00) 0000-0000',
  } = cliente

  const {
    potenciakWp = 15,
    numPaineis = 68,
    numInversores = 1,
    economiaAnual = 15000,
    payback = 8.5,
  } = sistema

  const {
    total = 150000,
    precoWp = 10,
    itens = [],
  } = orcamento

  const {
    nome: nomeEmpresa = 'Forte Solar',
    logo = '',
    telefone: telefoneEmpresa = '(11) 3000-0000',
    email: emailEmpresa = 'contato@fortesolar.com.br',
  } = empresa

  // S4: seção de condições de pagamento (somente se houver dados financeiros)
  const vc = financeiro?.visao_cliente || null
  const finBanco = financeiro?.financiamento || null
  const parcel = financeiro?.parcelamento || null
  // S4.1: usa cenário realista (Lei 14.300) quando disponível — proposta honesta
  const retShow = financeiro?.retorno_realista || financeiro?.retorno || null
  const roiPct = retShow?.roi_pct ?? null
  const economia25 = retShow?.economia_25_anos ?? null
  const premissasReg = financeiro?.regulatorio || null

  // S4.3: versão, status jurídico, código de verificação e assinaturas
  const revCom = comercial?.revisao_comercial_atual || 'A'
  const statusJur = comercial?.status_juridico || null
  const codigoVerificacao = comercial?.snapshot_comercial?.hash || null
  const assinaturasCom = Array.isArray(comercial?.assinaturas) ? comercial.assinaturas : []
  const secaoAssinaturasDigitais = assinaturasCom.length > 0 ? `
        <h2 class="subtitulo">Assinaturas Digitais</h2>
        <div class="especificacoes">
          ${assinaturasCom.map(a => `
            <div class="especificacoes-item">
              <span class="especificacoes-label">${(a.papel || '').toUpperCase()} — ${a.nome || ''}</span>
              <span class="especificacoes-valor" style="font-family:monospace;font-size:10px;">${(a.hash || '').slice(0, 16)}… · ${a.timestamp ? new Date(a.timestamp).toLocaleString('pt-BR') : ''}</span>
            </div>
          `).join('')}
        </div>
        <p style="font-size:10px;color:#999;margin-bottom:20px;">Assinaturas com hash SHA-256, timestamp e trilha de auditoria (IP/dispositivo registrados no sistema).</p>
  ` : ''

  // S4.2/4.3.1: tabela comparativa de cenários comerciais + freeze individual
  const listaCenarios = comercial?.cenarios?.cenarios || comercial?.snapshot_comercial?.cenarios?.cenarios || null
  const cenGov = comercial?.cenarios_governanca || {}
  const algumCongeladoInd = Object.values(cenGov).some(g => g?.freeze_status === 'CONGELADO')
  const secaoCenarios = (Array.isArray(listaCenarios) && listaCenarios.length > 0) ? `
        <h2 class="subtitulo">Comparação de Cenários</h2>
        <table class="orcamento-tabela">
          <thead>
            <tr>
              <th>Cenário</th><th class="orcamento-valor">Economia 25a</th>
              <th class="orcamento-valor">Payback</th><th class="orcamento-valor">ROI</th>
              <th class="orcamento-valor">Status</th>
            </tr>
          </thead>
          <tbody>
            ${listaCenarios.map(c => {
              const g = cenGov[c.id] || {}
              const st = g.freeze_status === 'CONGELADO'
                ? `Congelado${g.revisao_atual ? ' (Rev ' + g.revisao_atual + ')' : ''}`
                : (g.workflow_status || '—')
              return `
              <tr>
                <td>${c.label}</td>
                <td class="orcamento-valor">${brlFmt(c.economia_25_anos)}</td>
                <td class="orcamento-valor">${c.payback_anos != null ? c.payback_anos + ' anos' : '—'}</td>
                <td class="orcamento-valor">${c.roi_pct != null ? Math.round(c.roi_pct) + '%' : '—'}</td>
                <td class="orcamento-valor">${st}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
        <p style="font-size:10px;color:#999;margin-bottom:20px;">Cenários conforme premissas regulatórias (Lei 14.300/2022). O cenário Realista é a base da proposta.${algumCongeladoInd ? ' Cenários marcados como "Congelado" foram congelados individualmente, com hash e revisão próprios.' : ''}</p>
  ` : ''

  // S6: seção de layout/telhado (área útil + panos)
  const geoPanos = Array.isArray(geoespacial?.panos) ? geoespacial.panos : []
  const secaoLayout = (geoespacial && geoPanos.length > 0) ? `
        <h2 class="subtitulo">Layout no Telhado</h2>
        <div class="resumo">
          <div class="resumo-card">
            <div class="resumo-card-titulo">Área útil</div>
            <div class="resumo-card-valor">${geoespacial.area_util_total} m²</div>
            <div class="resumo-card-sub">${geoespacial.total_panos} pano(s) · sombra média ${geoespacial.fator_sombra_medio}%</div>
          </div>
          <div class="resumo-card">
            <div class="resumo-card-titulo">Capacidade máxima</div>
            <div class="resumo-card-valor">${geoespacial.max_modulos_total} módulos</div>
            <div class="resumo-card-sub">Fator de geração médio ${geoespacial.fator_geracao_medio}</div>
          </div>
        </div>
        <table class="orcamento-tabela">
          <thead><tr><th>Pano</th><th class="orcamento-valor">Orientação</th><th class="orcamento-valor">Inclin.</th><th class="orcamento-valor">Área útil</th><th class="orcamento-valor">Sombra</th><th class="orcamento-valor">Módulos</th></tr></thead>
          <tbody>
            ${geoPanos.map(p => `
              <tr>
                <td>${p.nome}</td>
                <td class="orcamento-valor">${p.orientacao}</td>
                <td class="orcamento-valor">${p.inclinacao}°</td>
                <td class="orcamento-valor">${p.area_util} m²</td>
                <td class="orcamento-valor">${p.fator_sombra_pct}%</td>
                <td class="orcamento-valor">${p.capacidade_modulos}</td>
              </tr>`).join('')}
          </tbody>
        </table>
  ` : ''

  const secaoRegulatoria = premissasReg ? `
        <h2 class="subtitulo">Premissas Regulatórias (Lei 14.300/2022)</h2>
        <div class="especificacoes">
          <div class="especificacoes-item"><span class="especificacoes-label">Modalidade</span><span class="especificacoes-valor">${premissasReg.modalidade} — ${premissasReg.modalidade_descricao || ''}</span></div>
          <div class="especificacoes-item"><span class="especificacoes-label">Ano de instalação</span><span class="especificacoes-valor">${premissasReg.ano_instalacao}${premissasReg.grandfathered ? ' (direito adquirido até 2045)' : ''}</span></div>
          <div class="especificacoes-item"><span class="especificacoes-label">Fator de compensação</span><span class="especificacoes-valor">${Math.round((premissasReg.fator_compensacao || 0) * 100)}%</span></div>
          <div class="especificacoes-item"><span class="especificacoes-label">Simultaneidade (autoconsumo)</span><span class="especificacoes-valor">${Math.round((premissasReg.simultaneidade || 0) * 100)}%</span></div>
          <div class="especificacoes-item"><span class="especificacoes-label">Tarifa considerada</span><span class="especificacoes-valor">R$ ${Number(premissasReg.tarifa_cheia_kwh || 0).toFixed(2)}/kWh + reajuste ${premissasReg.reajuste_anual_pct}% a.a.</span></div>
        </div>
        <p style="font-size:10px;color:#999;margin-bottom:20px;">Economia projetada considera a cobrança gradual do Fio B (TUSD) sobre a energia compensada, conforme a Lei 14.300/2022.</p>
  ` : ''

  const secaoPagamento = (finBanco || parcel) ? `
        <h2 class="subtitulo">Condições de Pagamento</h2>
        <div class="analise-financeira">
          ${finBanco ? `
          <div class="analise-card">
            <div class="analise-card-titulo">Financiamento</div>
            <div class="analise-card-valor">${finBanco.parcelas}× ${brlFmt(finBanco.parcela)}</div>
            <div class="resumo-card-sub">Entrada ${brlFmt(finBanco.entrada)} · CET ~${finBanco.cet_aa_pct}% a.a.</div>
          </div>` : ''}
          ${parcel ? `
          <div class="analise-card">
            <div class="analise-card-titulo">Parcelamento (${parcel.tipo})</div>
            <div class="analise-card-valor">${parcel.parcelas}× ${brlFmt(parcel.parcela)}</div>
            <div class="resumo-card-sub">${parcel.juros > 0 ? `Total ${brlFmt(parcel.total)}` : 'Sem juros'}</div>
          </div>` : ''}
          <div class="analise-card">
            <div class="analise-card-titulo">À vista</div>
            <div class="analise-card-valor">${brlFmt(total)}</div>
          </div>
        </div>
  ` : ''

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0066cc; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #0066cc; }
        .logo-text { font-size: 12px; color: #666; }
        .data { text-align: right; color: #666; }
        .data-valor { font-size: 14px; font-weight: bold; }

        .cliente-info { background: #f9f9f9; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
        .cliente-info h3 { font-size: 14px; color: #0066cc; margin-bottom: 10px; }
        .cliente-info p { font-size: 12px; line-height: 1.6; color: #555; }

        .titulo { font-size: 24px; font-weight: bold; margin-bottom: 30px; color: #0066cc; }
        .subtitulo { font-size: 16px; font-weight: bold; margin-top: 25px; margin-bottom: 15px; color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 8px; }

        .resumo { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .resumo-card { background: #f0f7ff; padding: 15px; border-radius: 5px; border-left: 4px solid #0066cc; }
        .resumo-card-titulo { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
        .resumo-card-valor { font-size: 20px; font-weight: bold; color: #0066cc; }
        .resumo-card-sub { font-size: 10px; color: #999; margin-top: 3px; }

        .especificacoes { background: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 30px; }
        .especificacoes-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 12px; }
        .especificacoes-item:last-child { border-bottom: none; }
        .especificacoes-label { color: #666; }
        .especificacoes-valor { font-weight: bold; }

        .orcamento-tabela { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
        .orcamento-tabela th { background: #0066cc; color: white; padding: 10px; text-align: left; font-weight: bold; }
        .orcamento-tabela td { padding: 10px; border-bottom: 1px solid #ddd; }
        .orcamento-tabela tr:nth-child(even) { background: #f9f9f9; }
        .orcamento-valor { text-align: right; }

        .total-box { background: #0066cc; color: white; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
        .total-box h3 { font-size: 12px; margin-bottom: 10px; opacity: 0.9; }
        .total-valor { font-size: 32px; font-weight: bold; }
        .total-preco-wp { font-size: 12px; margin-top: 10px; opacity: 0.9; }

        .analise-financeira { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px; }
        .analise-card { background: #f0f0f0; padding: 15px; border-radius: 5px; text-align: center; }
        .analise-card-titulo { font-size: 11px; color: #666; margin-bottom: 8px; }
        .analise-card-valor { font-size: 18px; font-weight: bold; color: #0066cc; }

        .garantias { background: #fffbe6; border-left: 4px solid #ffb500; padding: 15px; border-radius: 5px; margin-bottom: 30px; font-size: 11px; line-height: 1.6; }
        .garantias h4 { color: #ff6b00; margin-bottom: 8px; }
        .garantias ul { margin-left: 20px; }
        .garantias li { margin-bottom: 5px; }

        .footer { text-align: center; border-top: 1px solid #ddd; padding-top: 20px; font-size: 10px; color: #999; }
        .footer-contato { margin-top: 10px; }

        .assinatura { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .assinatura-box { text-align: center; }
        .assinatura-linha { border-top: 1px solid #333; margin-bottom: 10px; }
        .assinatura-nome { font-size: 12px; font-weight: bold; }
        .assinatura-cargo { font-size: 11px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <div class="logo">${nomeEmpresa}</div>
            <div class="logo-text">Sistema de Energia Solar</div>
          </div>
          <div class="data">
            <div class="data-valor">PROPOSTA COMERCIAL</div>
            <div style="font-size: 11px; margin-top: 5px;">${new Date().toLocaleDateString('pt-BR')}</div>
            <div style="font-size: 10px; margin-top: 3px; color:#888;">Revisão ${revCom}${statusJur ? ' · ' + statusJur.replace(/_/g, ' ') : ''}</div>
            ${codigoVerificacao ? `<div style="font-size: 9px; margin-top: 2px; color:#aaa; font-family:monospace;">cód.: ${String(codigoVerificacao).slice(0, 12)}</div>` : ''}
          </div>
        </div>

        <div class="cliente-info">
          <h3>CLIENTE</h3>
          <p><strong>${nome}</strong></p>
          <p>Telefone: ${telefone}</p>
          <p>Email: ${email}</p>
          <p>Local: ${endereco}</p>
        </div>

        <h1 class="titulo">PROPOSTA DE SISTEMA FOTOVOLTAICO</h1>

        <div class="resumo">
          <div class="resumo-card">
            <div class="resumo-card-titulo">Potência do Sistema</div>
            <div class="resumo-card-valor">${potenciakWp} kWp</div>
            <div class="resumo-card-sub">${numPaineis} painéis de 550W</div>
          </div>
          <div class="resumo-card">
            <div class="resumo-card-titulo">Economia Anual</div>
            <div class="resumo-card-valor">R$ ${(economiaAnual / 1000).toFixed(1)}k</div>
            <div class="resumo-card-sub">Payback: ${payback} anos</div>
          </div>
        </div>

        <h2 class="subtitulo">Especificações Técnicas</h2>
        <div class="especificacoes">
          <div class="especificacoes-item">
            <span class="especificacoes-label">Módulos Fotovoltaicos</span>
            <span class="especificacoes-valor">${numPaineis} × 550W</span>
          </div>
          <div class="especificacoes-item">
            <span class="especificacoes-label">Inversor(es)</span>
            <span class="especificacoes-valor">${numInversores} inversor(es) de ${Math.round(potenciakWp / numInversores)} kW</span>
          </div>
          <div class="especificacoes-item">
            <span class="especificacoes-label">Tipo de Sistema</span>
            <span class="especificacoes-valor">On-Grid (Conectado à rede)</span>
          </div>
          <div class="especificacoes-item">
            <span class="especificacoes-label">Estrutura</span>
            <span class="especificacoes-valor">Alumínio anodizado</span>
          </div>
          <div class="especificacoes-item">
            <span class="especificacoes-label">Garantia dos Painéis</span>
            <span class="especificacoes-valor">25 anos</span>
          </div>
          <div class="especificacoes-item">
            <span class="especificacoes-label">Garantia do Inversor</span>
            <span class="especificacoes-valor">10 anos</span>
          </div>
        </div>

        ${secaoLayout}

        <h2 class="subtitulo">Orçamento Detalhado</h2>
        <table class="orcamento-tabela">
          <thead>
            <tr>
              <th>Item</th>
              <th>Valor</th>
              <th>% do Total</th>
            </tr>
          </thead>
          <tbody>
            ${itens.map(item => `
              <tr>
                <td>${item.descricao}</td>
                <td class="orcamento-valor">R$ ${item.valor.toLocaleString('pt-BR')}</td>
                <td class="orcamento-valor">${item.percentual}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-box">
          <h3>INVESTIMENTO TOTAL</h3>
          <div class="total-valor">R$ ${total.toLocaleString('pt-BR')}</div>
          <div class="total-preco-wp">Preço por Wp: R$ ${precoWp}</div>
        </div>

        ${secaoPagamento}

        <h2 class="subtitulo">Análise Financeira</h2>
        <div class="analise-financeira">
          <div class="analise-card">
            <div class="analise-card-titulo">Economia Anual</div>
            <div class="analise-card-valor">R$ ${(economiaAnual / 1000).toFixed(1)}k</div>
          </div>
          <div class="analise-card">
            <div class="analise-card-titulo">Payback</div>
            <div class="analise-card-valor">${payback}a</div>
          </div>
          <div class="analise-card">
            <div class="analise-card-titulo">Economia em 25 anos</div>
            <div class="analise-card-valor">R$ ${economia25 != null ? (economia25 / 1000).toFixed(0) : (economiaAnual * 25 / 1000).toFixed(0)}k</div>
          </div>
          ${roiPct != null ? `
          <div class="analise-card">
            <div class="analise-card-titulo">ROI (25 anos)</div>
            <div class="analise-card-valor">${Number(roiPct).toFixed(0)}%</div>
          </div>` : ''}
        </div>

        ${secaoRegulatoria}

        ${secaoCenarios}

        <div class="garantias">
          <h4>Garantias Incluídas</h4>
          <ul>
            <li>Painéis Fotovoltaicos: 25 anos</li>
            <li>Inversor: 10 anos</li>
            <li>Estrutura e Instalação: 5 anos</li>
            <li>Monitoramento: Acesso vitalício</li>
          </ul>
        </div>

        ${secaoAssinaturasDigitais}

        <div class="assinatura">
          <div class="assinatura-box">
            <div class="assinatura-linha"></div>
            <div class="assinatura-nome">${nome}</div>
            <div class="assinatura-cargo">Cliente</div>
          </div>
          <div class="assinatura-box">
            <div class="assinatura-linha"></div>
            <div class="assinatura-nome">${nomeEmpresa}</div>
            <div class="assinatura-cargo">Responsável Técnico</div>
          </div>
        </div>

        <div class="footer">
          <p>Esta proposta é válida por ${validadeDias} dias. Após esse período, será necessária nova cotação.</p>
          <div class="footer-contato">
            ${nomeEmpresa} | ${emailEmpresa} | ${telefoneEmpresa}
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  return htmlContent
}

export const abrirOuBaixarProposta = (htmlContent) => {
  const novaAba = window.open()
  novaAba.document.write(htmlContent)
  novaAba.document.close()

  navigator.clipboard.writeText(htmlContent)

  return {
    status: 'success',
    mensagem: 'Proposta gerada. Nova aba aberta para visualizar/imprimir como PDF.',
  }
}
