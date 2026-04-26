export const gerarPropostaPDF = (dados) => {
  const {
    cliente = {},
    sistema = {},
    orcamento = {},
    empresa = {},
  } = dados

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
            <div class="analise-card-valor">R$ ${(economiaAnual * 25 / 1000).toFixed(0)}k</div>
          </div>
        </div>

        <div class="garantias">
          <h4>Garantias Incluídas</h4>
          <ul>
            <li>Painéis Fotovoltaicos: 25 anos</li>
            <li>Inversor: 10 anos</li>
            <li>Estrutura e Instalação: 5 anos</li>
            <li>Monitoramento: Acesso vitalício</li>
          </ul>
        </div>

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
          <p>Esta proposta é válida por 30 dias. Após esse período, será necessária nova cotação.</p>
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
