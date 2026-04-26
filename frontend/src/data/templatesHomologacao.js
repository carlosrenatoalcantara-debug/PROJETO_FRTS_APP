// Templates de documentos para homologação de sistemas fotovoltaicos
// AVISO: Estes templates são modelos orientativos. Devem ser revisados por
// profissional habilitado (engenheiro eletricista com CREA ativo) antes do uso.

const hoje = () => new Date().toLocaleDateString('pt-BR', {
  day: '2-digit', month: 'long', year: 'numeric',
})

export function gerarMemorialCalculo(d) {
  const {
    empresa = {},
    cliente = {},
    projeto = {},
    localizacao = {},
    consumo = {},
    irradiancia = {},
    dimensionamento = {},
    equipamentos = {},
    area = {},
  } = d

  const painel   = equipamentos.painel   ?? { marca: '_________', modelo: '_________', potenciaW: '___' }
  const inversor = equipamentos.inversor ?? { marca: '_________', modelo: '_________', potenciaKW: '___' }

  return `
MEMORIAL DESCRITIVO E DE CÁLCULO
Sistema de Geração de Energia Solar Fotovoltaica Conectado à Rede Elétrica
Microgeração Distribuída – Lei nº 14.300/2022 e Resolução ANEEL nº 482/2012

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. IDENTIFICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Empresa Projetista : ${empresa.nomeEmpresa ?? 'Forte Solar'}
CNPJ               : ${empresa.cnpj        ?? '________________'}
Responsável Técnico: ${empresa.responsavelTecnico?.nome ?? '___________________'}
Registro           : ${empresa.responsavelTecnico?.tipoRegistro ?? 'CREA'} ${empresa.responsavelTecnico?.registro ?? '____________'} / ${empresa.responsavelTecnico?.uf ?? '__'}
Telefone           : ${empresa.telefone ?? '________________'}
E-mail             : ${empresa.email    ?? '________________'}

Data de emissão    : ${hoje()}
Projeto            : ${projeto.nome ?? '________________________________'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. DADOS DO CLIENTE E LOCAL DE INSTALAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Titular            : ${cliente.nome    ?? '________________________________'}
CPF/CNPJ           : ${cliente.cpf     ?? '________________________________'}
Endereço           : ${localizacao.endereco   ?? '________________________________'}
Cidade/UF          : ${localizacao.cidadeEstado ?? '________________________________'}
CEP                : ${localizacao.cep          ?? '_____________'}
Concessionária     : ${consumo.concessionaria   ?? '________________________________'}
Número UC          : ${projeto.numeroUC         ?? '________________________________'}
Tipo de ligação    : ${consumo.tipoLigacao === 'monofasico' ? 'Monofásico' : consumo.tipoLigacao === 'bifasico' ? 'Bifásico' : 'Trifásico'}
Tensão de fornecimento: ${consumo.tensao ?? '220'} V

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. NORMAS TÉCNICAS APLICÁVEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• ABNT NBR 16690:2019  – Instalações elétricas de sistemas fotovoltaicos
• ABNT NBR 16149:2013  – Inversores para sistemas FV – Requisitos de interface
• ABNT NBR 5410:2004   – Instalações elétricas de baixa tensão
• ABNT NBR IEC 62109   – Segurança de conversores de potência para FV
• Resolução ANEEL nº 482/2012 e Resolução Normativa nº 687/2015
• Lei nº 14.300/2022   – Marco Legal da Microgeração e Minigeração Distribuída
• Regulamentação local da ${consumo.concessionaria ?? 'concessionária'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. DADOS DE IRRADIÂNCIA SOLAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fonte                : NASA POWER Climatology API (ALLSKY_SFC_SW_DWN)
Coordenadas          : Lat ${localizacao.lat?.toFixed(4) ?? '______'} / Lon ${localizacao.lon?.toFixed(4) ?? '______'}
Irradiância média anual: ${irradiancia.mediaAnual ?? '____'} kWh/m²/dia
${irradiancia.mensal ? `
Distribuição mensal:
  Jan: ${irradiancia.mensal[0]?.valor?.toFixed(2) ?? '--'} | Fev: ${irradiancia.mensal[1]?.valor?.toFixed(2) ?? '--'} | Mar: ${irradiancia.mensal[2]?.valor?.toFixed(2) ?? '--'}
  Abr: ${irradiancia.mensal[3]?.valor?.toFixed(2) ?? '--'} | Mai: ${irradiancia.mensal[4]?.valor?.toFixed(2) ?? '--'} | Jun: ${irradiancia.mensal[5]?.valor?.toFixed(2) ?? '--'}
  Jul: ${irradiancia.mensal[6]?.valor?.toFixed(2) ?? '--'} | Ago: ${irradiancia.mensal[7]?.valor?.toFixed(2) ?? '--'} | Set: ${irradiancia.mensal[8]?.valor?.toFixed(2) ?? '--'}
  Out: ${irradiancia.mensal[9]?.valor?.toFixed(2) ?? '--'} | Nov: ${irradiancia.mensal[10]?.valor?.toFixed(2) ?? '--'} | Dez: ${irradiancia.mensal[11]?.valor?.toFixed(2) ?? '--'}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. DIMENSIONAMENTO DO SISTEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5.1 Dados de consumo
  Consumo médio mensal       : ${consumo.consumoMensal ?? '____'} kWh/mês
  Energia diária média       : ${dimensionamento.energiaDiaria ?? '____'} kWh/dia
  Fator de perdas do sistema : 20% (cabeamento, sujidade, temperatura, inversão)
  Energia necessária (líq.)  : ${dimensionamento.energiaNecessaria ?? '____'} kWh/dia

5.2 Cálculo da potência de pico
  Irradiância média          : ${irradiancia.mediaAnual ?? '____'} kWh/m²/dia (HSP)
  Potência calculada (kWp)   : ${dimensionamento.energiaNecessaria ?? '____'} ÷ ${irradiancia.mediaAnual ?? '____'} = ${dimensionamento.potenciaKwp ?? '____'} kWp
  Número de módulos adotados : ${dimensionamento.numPaineis ?? '____'} módulos
  Potência real do sistema   : ${dimensionamento.potenciaRealKwp ?? '____'} kWp

5.3 Estimativa de geração anual
  Geração estimada/mês       : ${dimensionamento.potenciaRealKwp ? (dimensionamento.potenciaRealKwp * (irradiancia.mediaAnual ?? 0) * 30 * 0.80).toFixed(0) : '____'} kWh/mês
  Geração estimada/ano       : ${dimensionamento.potenciaRealKwp ? (dimensionamento.potenciaRealKwp * (irradiancia.mediaAnual ?? 0) * 365 * 0.80).toFixed(0) : '____'} kWh/ano
  Percentual de atendimento  : ~${consumo.consumoMensal && dimensionamento.potenciaRealKwp && irradiancia.mediaAnual ? Math.min(100, Math.round((dimensionamento.potenciaRealKwp * irradiancia.mediaAnual * 30 * 0.80) / consumo.consumoMensal * 100)) : '____'}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. ESPECIFICAÇÃO DOS EQUIPAMENTOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6.1 Módulos fotovoltaicos
  Fabricante / Modelo        : ${painel.marca} / ${painel.modelo}
  Potência nominal (Wp)      : ${painel.potenciaW} Wp
  Quantidade                 : ${dimensionamento.numPaineis ?? '____'} unidades
  Potência total             : ${dimensionamento.numPaineis && painel.potenciaW ? (dimensionamento.numPaineis * painel.potenciaW / 1000).toFixed(2) : '____'} kWp
  Certificação INMETRO       : Exigida – verificar certificado em anexo

6.2 Inversores
  Fabricante / Modelo        : ${inversor.marca} / ${inversor.modelo}
  Potência nominal           : ${inversor.potenciaKW ?? '____'} kW
  Quantidade                 : ${dimensionamento.numInversores ?? '____'} unidade(s)
  Tipo                       : String (on-grid, sem isolamento galvânico)
  Certificação INMETRO       : Exigida – verificar certificado em anexo
  Conformidade ABNT NBR 16149:2013: Declarada pelo fabricante

6.3 Estrutura de fixação
  Tipo                       : ${equipamentos.estrutura?.tipo ?? '_________________'}
  Fabricante / Modelo        : ${equipamentos.estrutura?.marca ?? '_________'} / ${equipamentos.estrutura?.modelo ?? '_________'}
  Orientação dos módulos     : ${area.orientacao ?? '_________'}
  Inclinação                 : ${area.inclinacao ?? '____'}°
  Área ocupada               : ${dimensionamento.areaMinima ?? '____'} m² (calculado)
  Área disponível            : ${area.areaDisponivel ?? '____'} m²

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. PROTEÇÕES ELÉTRICAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Proteção de sobretemperatura: integrada ao inversor
• Anti-ilhamento             : Função integrada ao inversor (conforme ABNT NBR 16149)
• Proteção contra surtos (DPS): Prevista no string box lado CC e no quadro CA
• String box CC              : Com fusíveis por string e seccionador
• Disjuntor CA               : Previsto no quadro de distribuição
• Aterramento                : Conforme ABNT NBR 5410 e ABNT NBR 5419

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. CONCLUSÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

O sistema fotovoltaico de ${dimensionamento.potenciaRealKwp ?? '____'} kWp ora projetado
atende às normas técnicas vigentes e é adequado para as condições do local de instalação.
A geração estimada de ${dimensionamento.potenciaRealKwp ? (dimensionamento.potenciaRealKwp * (irradiancia.mediaAnual ?? 0) * 30 * 0.80).toFixed(0) : '____'} kWh/mês
representa atendimento de aproximadamente ${consumo.consumoMensal && dimensionamento.potenciaRealKwp && irradiancia.mediaAnual ? Math.min(100, Math.round((dimensionamento.potenciaRealKwp * irradiancia.mediaAnual * 30 * 0.80) / consumo.consumoMensal * 100)) : '____'}%
do consumo médio da unidade consumidora.

${empresa.responsavelTecnico?.nome ? empresa.responsavelTecnico.nome : '_________________________________'}
${empresa.responsavelTecnico?.tipoRegistro ?? 'CREA'} nº ${empresa.responsavelTecnico?.registro ?? '____________'} / ${empresa.responsavelTecnico?.uf ?? '__'}
Responsável Técnico

Data: ${hoje()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVISO: Este memorial é um modelo orientativo gerado pelo sistema Forte Solar.
Deve ser revisado, complementado e assinado por engenheiro habilitado com CREA ativo
antes de ser submetido à concessionária.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim()
}

export function gerarCartaConcessionaria(d) {
  const { empresa = {}, cliente = {}, projeto = {}, localizacao = {}, consumo = {}, dimensionamento = {}, concessionaria = 'concessionária local' } = d

  return `
${localizacao.cidadeEstado?.split(' - ')[0] ?? '_____________'}, ${hoje()}

À ${concessionaria}
Departamento de Geração Distribuída / Atendimento ao Cliente

Ref.: Solicitação de Aprovação de Acesso de Microgeração Distribuída
      Sistema Fotovoltaico – Unidade Consumidora nº ${projeto.numeroUC ?? '_______________'}

Prezados Senhores,

${cliente.nome ?? '_______________________________'}, ${cliente.tipoPessoa === 'PJ' ? 'pessoa jurídica' : 'pessoa física'},
inscrito(a) no ${cliente.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'} sob o nº ${cliente.cpf ?? '_________________________'},
residente/sediado(a) na ${localizacao.endereco ?? '___________________________________'},
${localizacao.cidadeEstado ?? '_________________________'}, vem respeitosamente a esta
distribuidora solicitar a aprovação de acesso para implantação de sistema de
MICROGERAÇÃO DISTRIBUÍDA, na modalidade fotovoltaica, conforme faculta a
Lei Federal nº 14.300/2022 e a Resolução Normativa ANEEL nº 482/2012.

DADOS DO SISTEMA FOTOVOLTAICO PROPOSTO:
  • Potência instalada        : ${dimensionamento.potenciaRealKwp ?? '____'} kWp
  • Número de módulos         : ${dimensionamento.numPaineis ?? '____'} módulos de ${(projeto.equipamentos?.painel?.potenciaW ?? '___')} Wp
  • Número de inversores      : ${dimensionamento.numInversores ?? '____'} inversor(es) de ${(projeto.equipamentos?.inversor?.potenciaKW ?? '___')} kW
  • Tipo de conexão à rede    : ${consumo.tipoLigacao === 'monofasico' ? 'Monofásico' : consumo.tipoLigacao === 'bifasico' ? 'Bifásico' : 'Trifásico'}
  • Tensão de conexão         : ${consumo.tensao ?? '220'} V

Informamos que o projeto técnico foi elaborado em conformidade com a
ABNT NBR 16690:2019 e normas correlatas, e será submetido acompanhado dos
seguintes documentos:

  ✓ Memorial descritivo e de cálculo
  ✓ Diagrama unifilar assinado pelo responsável técnico
  ✓ ART de projeto (${empresa.responsavelTecnico?.tipoRegistro ?? 'CREA'} nº ${empresa.responsavelTecnico?.registro ?? '_____________'})
  ✓ Certificados INMETRO dos equipamentos
  ✓ Nota fiscal dos equipamentos

O responsável técnico pelo projeto é o Sr(a). ${empresa.responsavelTecnico?.nome ?? '____________________'},
${empresa.responsavelTecnico?.tipoRegistro ?? 'CREA'} nº ${empresa.responsavelTecnico?.registro ?? '_____________'} / ${empresa.responsavelTecnico?.uf ?? '__'},
que pode ser contatado pelo telefone ${empresa.telefone ?? '____________'} ou
e-mail ${empresa.email ?? '____________________'}.

Diante do exposto, solicitamos a análise e aprovação do presente pedido de acesso,
dentro do prazo legal de 30 (trinta) dias úteis estabelecido pela regulamentação vigente.

Atenciosamente,

_____________________________________________
${cliente.nome ?? '________________________________'}
${cliente.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}: ${cliente.cpf ?? '___________________________'}

_____________________________________________
${empresa.responsavelTecnico?.nome ?? '________________________________'}
${empresa.responsavelTecnico?.tipoRegistro ?? 'CREA'} nº ${empresa.responsavelTecnico?.registro ?? '_____________'} / ${empresa.responsavelTecnico?.uf ?? '__'}
Responsável Técnico

${empresa.nomeEmpresa ?? 'Forte Solar'} | ${empresa.telefone ?? ''} | ${empresa.email ?? ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVISO: Modelo orientativo. Adaptar conforme exigências específicas da concessionária.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim()
}

export function gerarDadosART(d) {
  const { empresa = {}, cliente = {}, projeto = {}, localizacao = {}, consumo = {}, dimensionamento = {} } = d
  return `
DADOS PARA PREENCHIMENTO DE ART (CREA/CFT)
Sistema: e-CAT CREA ou Sistema CFT online
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DADOS DO PROFISSIONAL
  Nome completo   : ${empresa.responsavelTecnico?.nome ?? '________________________________'}
  Registro        : ${empresa.responsavelTecnico?.tipoRegistro ?? 'CREA'} ${empresa.responsavelTecnico?.registro ?? '_____________'} / ${empresa.responsavelTecnico?.uf ?? '__'}
  Especialidade   : Engenharia Elétrica

TIPO DE ART
  ☐ ART de Projeto
  ☐ ART de Execução
  ☐ ART de Projeto + Execução (quando permitido)

DADOS DO CONTRATANTE
  Nome/Razão Social: ${cliente.nome ?? '________________________________'}
  CPF/CNPJ         : ${cliente.cpf  ?? '________________________________'}
  Endereço         : ${localizacao.endereco ?? '________________________________'}
  Cidade/UF/CEP    : ${localizacao.cidadeEstado ?? '________________________'} / ${localizacao.cep ?? '_________'}

DESCRIÇÃO DOS SERVIÇOS (sugestão)
  "Projeto e/ou execução de sistema de microgeração distribuída fotovoltaica
  conectado à rede elétrica (SFCR), com potência instalada de ${dimensionamento.potenciaRealKwp ?? '____'} kWp,
  composto por ${dimensionamento.numPaineis ?? '____'} módulos fotovoltaicos e ${dimensionamento.numInversores ?? '____'} inversor(es),
  conforme ABNT NBR 16690:2019 e demais normas aplicáveis,
  instalado no endereço ${localizacao.endereco ?? '________________________'}, ${localizacao.cidadeEstado ?? '_______'}."

ENQUADRAMENTO NA TABELA DE ATIVIDADES (sugestão)
  • Código: 01 – Projeto / Instalações Elétricas
  • Descrição: Projeto de instalação elétrica de baixa tensão (sistema fotovoltaico)
  • Valor de referência: Verificar tabela de honorários do CREA/UF vigente

VALOR DA OBRA/SERVIÇO
  Valor estimado dos equipamentos: R$ ${projeto.valorReais?.toLocaleString('pt-BR') ?? '__________'}
  Obs: O valor da ART é calculado automaticamente pelo sistema do CREA

ANOTAÇÕES IMPORTANTES
  • Guardar cópia da ART assinada para o dossiê do projeto
  • Enviar cópia ao cliente e arquivar via dossiê
  • Para sistemas > 75 kWp: verificar necessidade de licença ambiental
  • Para execução: ART deve ser registrada ANTES do início dos serviços

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVISO: Apenas o profissional habilitado pode emitir e assinar a ART.
Este documento é apenas um roteiro de preenchimento.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim()
}
