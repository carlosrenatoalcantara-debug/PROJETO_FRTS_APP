export function gerarMemorialDescritivo(projeto, cliente) {
  const {
    potencia_kwp = 0,
    strings = {},
    inversor = {},
    painel = {},
    estrutura = {},
    telhado = {},
    estado = '',
    concessionaria = '',
    endereco_completo = '',
  } = projeto

  const dataTentativa = new Date().toLocaleDateString('pt-BR')
  const responsavelTecnico = process.env.RESPONSAVEL_TECNICO || 'Engenheiro Responsável'

  const memorial = `
═══════════════════════════════════════════════════════════════════════════
                        MEMORIAL DESCRITIVO
            SISTEMA DE GERAÇÃO DE ENERGIA SOLAR FOTOVOLTAICA
═══════════════════════════════════════════════════════════════════════════

1. DADOS DO SOLICITANTE
────────────────────────────────────────────────────────────────────────────
Nome: ${cliente?.nome || 'N/A'}
CPF/CNPJ: ${cliente?.cpf_cnpj || 'N/A'}
Telefone: ${cliente?.telefone || 'N/A'}
Email: ${cliente?.email || 'N/A'}

2. DADOS DA INSTALAÇÃO
────────────────────────────────────────────────────────────────────────────
Endereço: ${endereco_completo || 'N/A'}
Estado: ${estado || 'N/A'}
Concessionária: ${concessionaria || 'N/A'}
Tipo de Ligação: Monofásica / Trifásica
Tensão Nominal: 127/220V ou 380V (conforme ligação)
Modalidade: Autoconsumo Remoto com Compensação de Energia

3. DADOS DO SISTEMA
────────────────────────────────────────────────────────────────────────────
Potência Instalada: ${potencia_kwp} kWp
Potência Máxima (CA): ${inversor?.potenciaKW || 'N/A'} kW

4. COMPONENTES - MÓDULOS FOTOVOLTAICOS
────────────────────────────────────────────────────────────────────────────
Marca: ${painel?.marca || 'N/A'}
Modelo: ${painel?.modelo || 'N/A'}
Potência Nominal: ${painel?.pmpp || 'N/A'} W
Tecnologia: Silício Cristalino
Tensão de Circuito Aberto (Voc): ${painel?.voc || 'N/A'} V
Corrente de Curto-circuito (Isc): ${painel?.isc || 'N/A'} A
Eficiência do Módulo: ${painel?.eficiencia || 'N/A'}%
Garantia de Produto: ${painel?.garantia_produto || 'N/A'} anos
Garantia de Performance: ${painel?.garantia_performance || 'N/A'}% aos 25 anos
Número de Módulos: ${strings?.totalModulos || 'N/A'}

5. ARRANJO DAS STRINGS
────────────────────────────────────────────────────────────────────────────
Número de Strings: ${strings?.totalStrings || 1}
Módulos por String: ${strings?.modulosPorString || 'N/A'}
Configuração DC: Strings em paralelo conectadas ao inversor

6. COMPONENTES - INVERSOR
────────────────────────────────────────────────────────────────────────────
Tipo: ${inversor?.tipo || 'String'}
Marca: ${inversor?.marca || 'N/A'}
Modelo: ${inversor?.modelo || 'N/A'}
Potência Nominal: ${inversor?.potenciaKW || 'N/A'} kW
Fases: ${inversor?.fases === 3 ? 'Trifásico' : 'Monofásico'} (${inversor?.fases || 1}F)
Tensão de Saída: ${inversor?.fases === 3 ? '380V' : '220V'}
Número de MPPT: ${inversor?.nMppts || 'N/A'}
Garantia: ${inversor?.garantia || 'N/A'} anos
Eficiência: ≥ 97% (típico)

7. COMPONENTES - ESTRUTURA
────────────────────────────────────────────────────────────────────────────
Tipo: ${estrutura?.tipo || 'Fibrocimento'}
Material: ${estrutura?.material || 'Alumínio anodizado'}
Inclinação: Conforme geometria do telhado
Orientação: Conforme exposição solar ótima
Fixação: Conforme normas ABNT e manual do fabricante

8. SISTEMA DE PROTEÇÃO
────────────────────────────────────────────────────────────────────────────
Lado DC (Entrada):
  - Disjuntor Seccionadora: 125A / 1000V DC (ou conforme cálculo)
  - DPS (Proteção contra Surtos): Tipo 2, coordenado com painel

Lado AC (Saída):
  - Disjuntor Geral: 63A / 250V ou 380V (conforme cálculo)
  - DR (Proteção Diferencial Residual): 30mA tipo A
  - DPS AC: Tipo 2, coordenado com inversor

Aterramento:
  - Eletrodo de aterramento: Haste tipo cantoneira L50x50x5mm, comprimento 2,4m
  - Resistência: ≤ 10Ω (ou conforme norma local)
  - Condutor de aterramento: Cobre nu, seção dimensionada conforme ABNT NBR 16690
  - Continuidade: Barramento de terra centralizado

9. CABEAMENTO E CONDUTOS
────────────────────────────────────────────────────────────────────────────
Lado DC:
  - Condutor DC: Cobre isolado, seção conforme queda de tensão <3%
  - Conduto: Eletroduto flexível ou rígido, classe de proteção conforme ambiente

Lado AC:
  - Condutor AC: Cobre isolado, seção conforme queda de tensão <1%
  - Conduto: Eletroduto rígido, classe de proteção IP65 (ou superior)

10. NORMAS E REGULAMENTAÇÕES APLICÁVEIS
────────────────────────────────────────────────────────────────────────────
  ✓ ABNT NBR 16690:2019 - Sistemas fotovoltaicos - Instalação
  ✓ ABNT NBR 5410:2008 - Instalações elétricas de baixa tensão
  ✓ ABNT NBR 14039:2005 - Instalações elétricas de média tensão (13,8kV)
  ✓ NR10 - Segurança em instalações e serviços em eletricidade
  ✓ ABNT NBR IEC 61936-1:2015 - Segurança de sistemas elétricos
  ✓ Resolução ANEEL nº 482/2012 - Microgeração distribuída
  ✓ Norma Técnica da Concessionária Local (${concessionaria || 'N/A'})

11. CARACTERIZAÇÃO DO PROJETO
────────────────────────────────────────────────────────────────────────────
Tipo de Projeto: Microgeração fotovoltaica conectada à rede elétrica
Modalidade: Compensação de energia (net metering)
Geração Esperada: ${(potencia_kwp * 131.44).toFixed(0)} kWh/ano (aproximado)
Redução de Consumo: Até 100% em cenários favoráveis
Vida Útil Esperada: ≥ 25 anos

12. RESPONSABILIDADES
────────────────────────────────────────────────────────────────────────────
Responsável Técnico: ${responsavelTecnico}
Empresa Instaladora: Forte Solar Energia
Data do Projeto: ${dataTentativa}
Assinado por: _________________________________
                 ${responsavelTecnico}
                 ${process.env.CREA_NÚMERO || 'CREA/CFT nº'}

════════════════════════════════════════════════════════════════════════════
Documento gerado automaticamente em ${dataTentativa}
Válido como documento técnico de referência
════════════════════════════════════════════════════════════════════════════
  `.trim()

  return memorial
}

export function gerarCartaConcessionaria(projeto, cliente) {
  const {
    potencia_kwp = 0,
    inversor = {},
    estado = '',
    concessionaria = '',
    endereco_completo = '',
  } = projeto

  const dataAtual = new Date().toLocaleDateString('pt-BR')
  const responsavelTecnico = process.env.RESPONSAVEL_TECNICO || 'Engenheiro Responsável'

  const carta = `
════════════════════════════════════════════════════════════════════════════

Forte Solar Energia
${process.env.EMPRESA_CNPJ || 'CNPJ: XX.XXX.XXX/XXXX-XX'}
${process.env.EMPRESA_ENDERECO || 'Endereço: N/A'}

${dataAtual}

Prezados Senhores,

Vimos por meio desta solicitar a análise e aprovação técnica para conexão
de um sistema de micro geração distribuída (microgeração fotovoltaica)
na unidade consumidora abaixo discriminada.

════════════════════════════════════════════════════════════════════════════
DADOS DO TITULAR
════════════════════════════════════════════════════════════════════════════

Nome: ${cliente?.nome || 'N/A'}
CPF/CNPJ: ${cliente?.cpf_cnpj || 'N/A'}
Telefone: ${cliente?.telefone || 'N/A'}
Email: ${cliente?.email || 'N/A'}

════════════════════════════════════════════════════════════════════════════
DADOS DA INSTALAÇÃO
════════════════════════════════════════════════════════════════════════════

Concessionária: ${concessionaria || 'N/A'}
Estado: ${estado || 'N/A'}
Endereço: ${endereco_completo || 'N/A'}
Tipo de Ligação: Monofásica / Trifásica (conforme UC)
Tensão: 127/220V ou 380V (conforme ligação existente)

════════════════════════════════════════════════════════════════════════════
DADOS DO SISTEMA FOTOVOLTAICO
════════════════════════════════════════════════════════════════════════════

Potência Instalada: ${potencia_kwp} kWp
Potência CA: ${inversor?.potenciaKW || 'N/A'} kW
Modalidade: Autoconsumo com Compensação de Energia
Geração Estimada: ${(potencia_kwp * 131.44).toFixed(0)} kWh/ano

════════════════════════════════════════════════════════════════════════════
DOCUMENTAÇÃO ANEXADA
════════════════════════════════════════════════════════════════════════════

[✓] Memorial Descritivo do Sistema
[✓] Diagrama Unifilar
[✓] ART (Anotação de Responsabilidade Técnica)
[✓] Projeto de Aterramento
[✓] Relatório Técnico da Concessionária Local
[✓] Comprovante de Propriedade do Imóvel
[✓] Identidade e CPF/CNPJ do Titular

════════════════════════════════════════════════════════════════════════════
INFORMAÇÕES TÉCNICAS
════════════════════════════════════════════════════════════════════════════

O sistema foi dimensionado conforme normas técnicas:
• ABNT NBR 16690:2019 (Instalação de sistemas fotovoltaicos)
• ABNT NBR 5410:2008 (Instalações elétricas de baixa tensão)
• Resolução ANEEL nº 482/2012 (Microgeração distribuída)
• Normas técnicas de ${concessionaria || 'sua concessionária'}

O sistema possui:
• Proteção contra surtos (DPS)
• Proteção diferencial (DR 30mA)
• Aterramento conforme norma
• Chaveamento para isolamento em caso de falha

════════════════════════════════════════════════════════════════════════════
RESPONSÁVEL TÉCNICO
════════════════════════════════════════════════════════════════════════════

Nome: ${responsavelTecnico}
Registro: ${process.env.CREA_NÚMERO || 'CREA/CFT nº'}
Empresa: Forte Solar Energia

════════════════════════════════════════════════════════════════════════════

Solicitamos que proceda com a avaliação técnica e administrativa desta
solicitação, bem como a emissão de parecer de aceitação ou observações
para correção.

Colocamo-nos à disposição para esclarecer dúvidas e providenciar
informações adicionais que se fizerem necessárias.

Atenciosamente,

_________________________________
${responsavelTecnico}
Responsável Técnico
Forte Solar Energia

════════════════════════════════════════════════════════════════════════════
Documento gerado em ${dataAtual}
════════════════════════════════════════════════════════════════════════════
  `.trim()

  return carta
}

export function gerarDadosART(projeto, cliente) {
  const {
    potencia_kwp = 0,
    inversor = {},
    painel = {},
    endereco_completo = '',
  } = projeto

  const responsavelTecnico = process.env.RESPONSAVEL_TECNICO || 'Engenheiro Responsável'
  const creaNumero = process.env.CREA_NÚMERO || 'CREA/CFT nº'
  const dataAtual = new Date().toLocaleDateString('pt-BR')

  // Cálculo estimado de valor da ART (referência CREA)
  const valorART = potencia_kwp <= 5 ? 150 : potencia_kwp <= 10 ? 250 : 400

  const dadosART = {
    responsavel_tecnico: responsavelTecnico,
    crea_numero: creaNumero,
    tipo_atividade: 'Projeto e Execução de Sistema de Geração Fotovoltaica',
    potencia_instalada: `${potencia_kwp} kWp`,
    potencia_ac: `${inversor?.potenciaKW || 'N/A'} kW`,
    endereco_obra: endereco_completo || 'N/A',
    tipo_obra: 'Instalação em Edificação Existente',
    data_inicio_prevista: dataAtual,
    duracao_estimada: '7 a 10 dias',
    valor_art_sugerido: `R$ ${valorART.toFixed(2)}`,
    observacoes: 'Microgeração Distribuída conforme Resolução ANEEL 482/2012',
    normas_aplicaveis: [
      'ABNT NBR 16690:2019',
      'ABNT NBR 5410:2008',
      'NR10 - Eletricidade',
      'Resolução ANEEL 482/2012',
    ],
  }

  return dadosART
}

export function gerarChecklistDocumentos(estado, concessionaria) {
  const concessionariasChecklistMap = {
    COSERN: [
      { documento: 'Memorial Descritivo', obrigatorio: true, descricao: 'Descrição técnica do sistema' },
      { documento: 'Diagrama Unifilar', obrigatorio: true, descricao: 'Esquema de ligação do sistema' },
      { documento: 'ART (Anotação de Responsabilidade Técnica)', obrigatorio: true, descricao: 'Registro profissional do engenheiro' },
      { documento: 'Projeto de Aterramento', obrigatorio: true, descricao: 'Cálculo e esquema de aterramento' },
      { documento: 'Comprovante de Propriedade', obrigatorio: true, descricao: 'Escritura ou contrato do imóvel' },
      { documento: 'Identidade e CPF do Titular', obrigatorio: true, descricao: 'Cópias dos documentos' },
      { documento: 'Procuração (se aplicável)', obrigatorio: false, descricao: 'Se representante assina documentos' },
    ],
    CPFL: [
      { documento: 'Memorial Descritivo', obrigatorio: true, descricao: 'Descrição técnica do sistema' },
      { documento: 'Diagrama Unifilar', obrigatorio: true, descricao: 'Esquema de ligação' },
      { documento: 'ART', obrigatorio: true, descricao: 'Anotação de Responsabilidade Técnica' },
      { documento: 'Formulário de Conexão CPFL', obrigatorio: true, descricao: 'Formulário próprio da concessionária' },
      { documento: 'Planta da Edificação', obrigatorio: false, descricao: 'Localização dos componentes' },
      { documento: 'Comprovante de Propriedade', obrigatorio: true, descricao: 'Escritura ou contrato' },
    ],
    CEMIG: [
      { documento: 'Memorial Descritivo', obrigatorio: true },
      { documento: 'Diagrama Unifilar', obrigatorio: true },
      { documento: 'ART', obrigatorio: true },
      { documento: 'Formulário de Solicitação CEMIG', obrigatorio: true },
      { documento: 'Comprovante de Propriedade', obrigatorio: true },
      { documento: 'RG e CPF', obrigatorio: true },
    ],
  }

  const checklist = concessionariasChecklistMap[concessionaria] || concessionariasChecklistMap.COSERN

  return {
    concessionaria: concessionaria || 'Não informada',
    estado: estado || 'N/A',
    documentos: checklist.map(doc => ({
      ...doc,
      concluido: false,
    })),
    status: 'rascunho',
    data_criacao: new Date().toISOString(),
  }
}
