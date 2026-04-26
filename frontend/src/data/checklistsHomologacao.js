// Checklists de documentos por concessionária para homologação de GD
// Baseado nos manuais de acesso de microgeração distribuída (Lei 14.300/2022)

const DOCS_BASE = [
  { id: 'rg_cpf',      cat: 'Documentação Pessoal', texto: 'RG e CPF do titular (cópia)',                             obrigatorio: true  },
  { id: 'comp_end',    cat: 'Documentação Pessoal', texto: 'Comprovante de endereço atualizado (últimos 3 meses)',     obrigatorio: true  },
  { id: 'fatura',      cat: 'Documentação Pessoal', texto: 'Última fatura de energia elétrica',                        obrigatorio: true  },
  { id: 'art_proj',    cat: 'Documentação Técnica',  texto: 'ART de projeto (CREA) ou RRT (CAU) assinada',            obrigatorio: true  },
  { id: 'art_exec',    cat: 'Documentação Técnica',  texto: 'ART de execução assinada (após instalação)',              obrigatorio: true  },
  { id: 'unifilar',    cat: 'Documentação Técnica',  texto: 'Diagrama unifilar do sistema FV assinado pelo RT',        obrigatorio: true  },
  { id: 'memorial',    cat: 'Documentação Técnica',  texto: 'Memorial descritivo e de cálculo',                        obrigatorio: true  },
  { id: 'cert_inv',    cat: 'Equipamentos',          texto: 'Certificado INMETRO do(s) inversor(es)',                  obrigatorio: true  },
  { id: 'cert_mod',    cat: 'Equipamentos',          texto: 'Certificado INMETRO dos módulos fotovoltaicos',            obrigatorio: false },
  { id: 'nf_equip',    cat: 'Equipamentos',          texto: 'Nota fiscal dos equipamentos (módulos e inversores)',      obrigatorio: true  },
  { id: 'foto_inst',   cat: 'Instalação',            texto: 'Fotos da instalação: módulos, inversores, quadro e string box', obrigatorio: true },
  { id: 'form_conc',   cat: 'Formulários',           texto: 'Formulário de solicitação de acesso da concessionária',   obrigatorio: true  },
]

export const CHECKLISTS = {
  'CEMIG Distribuição': {
    nome: 'CEMIG Distribuição',
    sistema: 'Portal do Engenheiro CEMIG / Sistema de Geração Distribuída',
    link: 'https://www.cemig.com.br/para-a-sua-empresa/geracao-distribuida/',
    prazo: 'Até 30 dias úteis (microgeração)',
    obs: 'Formulário CEMIG-GD é obrigatório. Submissão preferencialmente online via portal.',
    docs: [
      ...DOCS_BASE,
      { id: 'form_cemig',   cat: 'Formulários',  texto: 'Formulário CEMIG de solicitação de acesso (GD-01)',      obrigatorio: true  },
      { id: 'prop_tecnica', cat: 'Documentação Técnica', texto: 'Proposta técnica com configuração do sistema',   obrigatorio: true  },
      { id: 'cert_aterr',   cat: 'Documentação Técnica', texto: 'Laudo de aterramento e SPDA (se aplicável)',     obrigatorio: false },
    ],
  },

  'COPEL Distribuição': {
    nome: 'COPEL Distribuição',
    sistema: 'Portal COPEL GD Online',
    link: 'https://agencia.copel.com/hsbclient/',
    prazo: 'Até 30 dias úteis',
    obs: 'COPEL exige envio digital via portal. Sistema 220/380V (Paraná já migrou para 220V residencial).',
    docs: [
      ...DOCS_BASE,
      { id: 'form_copel',   cat: 'Formulários',  texto: 'Formulário de microgeração COPEL (Portal GD)',          obrigatorio: true  },
      { id: 'layout_telhado', cat: 'Documentação Técnica', texto: 'Layout de instalação dos módulos no telhado', obrigatorio: true  },
      { id: 'spec_sheet',   cat: 'Equipamentos',  texto: 'Datasheet técnico do inversor e dos módulos',          obrigatorio: true  },
    ],
  },

  'Neoenergia Pernambuco (CELPE)': {
    nome: 'Neoenergia CELPE',
    sistema: 'SIG-R (Sistema de Informações de Geração)',
    link: 'https://www.neoenergiapernambuco.com.br/geracao-distribuida',
    prazo: 'Até 30 dias úteis',
    obs: 'Submissão exclusivamente via SIG-R. Necessário certificado digital para RT.',
    docs: [
      ...DOCS_BASE,
      { id: 'sigr_form',    cat: 'Formulários',  texto: 'Formulário SIG-R (gerado pelo sistema da concessionária)', obrigatorio: true },
      { id: 'laudo_tec',    cat: 'Documentação Técnica', texto: 'Laudo técnico de instalação',                     obrigatorio: true  },
      { id: 'cert_digital', cat: 'Documentação Técnica', texto: 'Certificado digital do responsável técnico (e-CPF/e-CNPJ)', obrigatorio: true },
    ],
  },

  'Neoenergia Coelba': {
    nome: 'Neoenergia Coelba (BA)',
    sistema: 'Portal Neoenergia / Formulário próprio',
    link: 'https://www.neoenergiabahia.com.br',
    prazo: 'Até 30 dias úteis',
    obs: 'Bahia tem alta irradiância (5,8 kWh/m²/dia). Verificar capacidade de transformador da região.',
    docs: [
      ...DOCS_BASE,
      { id: 'form_neoenergia', cat: 'Formulários', texto: 'Formulário de solicitação Neoenergia Bahia',           obrigatorio: true },
      { id: 'croqui',          cat: 'Documentação Técnica', texto: 'Croqui de localização do imóvel',             obrigatorio: true },
    ],
  },

  'ENEL São Paulo': {
    nome: 'ENEL São Paulo',
    sistema: 'Portal ENEL GD / ENEL X',
    link: 'https://www.eneldistribuicaosp.com.br/para-sua-empresa/geracao-distribuida',
    prazo: 'Até 30 dias úteis',
    obs: 'São Paulo ainda tem regiões com 127V. Verificar tensão local antes do projeto.',
    docs: [
      ...DOCS_BASE,
      { id: 'form_enel_sp', cat: 'Formulários',  texto: 'Formulário de microgeração ENEL SP',                    obrigatorio: true  },
      { id: 'planta_baixa', cat: 'Documentação Técnica', texto: 'Planta baixa simplificada do imóvel',            obrigatorio: false },
    ],
  },

  'ENEL Rio': {
    nome: 'ENEL Rio de Janeiro',
    sistema: 'Portal ENEL GD Rio',
    link: 'https://www.eneldistribuicaorio.com.br',
    prazo: 'Até 30 dias úteis',
    obs: 'Verificar possibilidade de acesso ao neutro para sistema monofásico.',
    docs: [
      ...DOCS_BASE,
      { id: 'form_enel_rj', cat: 'Formulários',  texto: 'Formulário de solicitação ENEL Rio',                    obrigatorio: true },
    ],
  },

  'ENEL Ceará': {
    nome: 'ENEL Ceará',
    sistema: 'Portal ENEL GD Ceará',
    link: 'https://www.eneldistribuicaocearense.com.br',
    prazo: 'Até 30 dias úteis',
    obs: 'Ceará é excelente para FV (irradiância ~5,9 kWh/m²/dia). ENEL CE tem portal simplificado.',
    docs: [
      ...DOCS_BASE,
      { id: 'form_enel_ce', cat: 'Formulários',  texto: 'Formulário de solicitação ENEL Ceará',                  obrigatorio: true },
    ],
  },

  'CELESC Distribuição': {
    nome: 'CELESC (SC)',
    sistema: 'Portal CELESC GD',
    link: 'https://www.celesc.com.br/geracao-distribuida',
    prazo: 'Até 30 dias úteis',
    obs: 'Santa Catarina já migrou para 220V residencial (220/380V). Verificar padrão local.',
    docs: [
      ...DOCS_BASE,
      { id: 'form_celesc',  cat: 'Formulários',  texto: 'Formulário CELESC de solicitação de acesso',            obrigatorio: true },
      { id: 'proj_eletrico',cat: 'Documentação Técnica', texto: 'Projeto elétrico completo (além do unifilar)',  obrigatorio: false },
    ],
  },

  'Genérico': {
    nome: 'Genérico (outras concessionárias)',
    sistema: 'Verificar portal da concessionária local',
    link: null,
    prazo: 'Até 30 dias úteis (prazo legal - Resolução ANEEL 482/2012 e Lei 14.300/2022)',
    obs: 'Use este checklist como base e adicione os documentos específicos da concessionária local.',
    docs: DOCS_BASE,
  },
}

export const NOMES_CONCESSIONARIAS = Object.keys(CHECKLISTS)

export function getChecklist(concessionaria) {
  return CHECKLISTS[concessionaria] ?? CHECKLISTS['Genérico']
}
