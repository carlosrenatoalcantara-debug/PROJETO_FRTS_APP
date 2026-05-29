import { createContext, useContext, useEffect, useState } from 'react'

const CHAVE_LS = 'forte_solar_empresa_v1'

export const PADRAO_EMPRESA = {
  logo:          null,           // base64 string (logomarca principal)
  logoReduzida:  null,           // S7.1 — logomarca reduzida (ícone/favicon)
  // Institucional (S7.1)
  razaoSocial:   '',
  nomeFantasia:  'Forte Solar',
  nomeEmpresa:   'Forte Solar',  // mantido p/ compat (= nome fantasia)
  cnpj:          '',
  ie:            '',             // inscrição estadual
  endereco:      '',
  cidade:        '',
  estado:        'SP',
  cep:           '',
  telefone:      '',
  whatsapp:      '',             // S7.1
  email:         '',
  site:          '',
  corPrimaria:   '#f97316',
  corSecundaria: '#0f172a',
  responsavelTecnico: {
    nome:          '',
    registro:      '',
    tipoRegistro:  'CREA',      // 'CREA' | 'CFT' | 'CFMV'
    uf:            'SP',
    modalidade:    '',          // S7.1 — ex.: Eletricista, Eletrotécnica
    cargo:         '',          // S7.1
    telefone:      '',          // S7.1
    email:         '',          // S7.1
  },
  // S7.1 — documentos técnicos (base64 ou URL)
  uploads: {
    assinatura:  null,
    carimbo:     null,
    artPadrao:   null,
    documentos:  [],            // [{ nome, dados }]
  },
  // S8.3.2 — dados bancários (múltiplas contas) p/ propostas/contratos/financeiro
  dadosBancarios: [],           // [{ banco, agencia, conta, tipo_conta, pix, titular, documento }]
  estadoPrincipal:           'SP',
  tensaoPadrao:              '220',
  forcaFallbackIrradiancia:  false,
  // CFG-04: Parâmetros financeiros padrão
  financeiro: {
    precoMaoDeObra:     50,    // R$/painel (mão de obra)
    precoCabosProtecao: 1500,  // R$ fixo (cabos, proteções, DPS)
    markupPct:          0,     // % de markup sobre custo de equipamentos
    validadeProposta:   15,    // dias de validade da proposta
    reajusteAnualPct:   5,     // % reajuste anual da tarifa (para payback)
    tarifaKwhPadrao:    0.95,  // R$/kWh quando não extraído da fatura

    // ── S4: Módulo financeiro EPC ────────────────────────────────────────────
    // Markup / rentabilidade
    markupPadraoPct:    30,    // % markup padrão sobre CMV (modo composição)
    lucroDesejadoPct:   20,    // % lucro-alvo (referência para o operador)
    descontoMaximoPct:  10,    // % desconto máximo autorizado
    impostosPct:        6,     // % impostos sobre a venda (Simples/ISS médio)
    comissaoPct:        3,     // % comissão de venda
    // Financiamento (Tabela Price)
    finTaxaJurosMesPct: 1.49,  // % a.m.
    finParcelasPadrao:  60,    // nº de parcelas
    finCarenciaMeses:   3,     // meses de carência
    // Parcelamento
    cartaoTaxaMesPct:   2.99,  // % a.m. (cartão)
    boletoTaxaMesPct:   1.99,  // % a.m. (boleto)
    proprioTaxaMesPct:  0,     // % a.m. (parcelamento próprio sem juros)
    parcelasPadraoCartao: 12,
    // Tarifa / energia
    bandeiraPadrao:     'verde',
    inflacaoEnergiaPct: 2,     // % a.a. adicional ao reajuste tarifário
    degradacaoAnualPct: 0.5,   // % perda de geração a.a. (módulos)
  },
}

const EmpresaCtx = createContext(null)

// Escurece uma cor hex em `pct` porcento
function escurecer(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16)       - Math.round(2.55 * pct))
  const g = Math.max(0, ((n >> 8) & 255)- Math.round(2.55 * pct))
  const b = Math.max(0, (n & 255)       - Math.round(2.55 * pct))
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function aplicarCSSVars(cor1, cor2) {
  const r = document.documentElement.style
  r.setProperty('--cor-primaria',        cor1)
  r.setProperty('--cor-primaria-hover',  escurecer(cor1, 12))
  r.setProperty('--cor-primaria-light',  cor1 + '1a') // 10% opacity
  r.setProperty('--cor-secundaria',      cor2)
}

// ─── S7.1: mapeamento estado plano ⇄ grupos do banco ────────────────────────────
function paraGrupos(e) {
  return {
    empresa_config: {
      razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia || e.nomeEmpresa,
      cnpj: e.cnpj, ie: e.ie, endereco: e.endereco, cidade: e.cidade,
      uf: e.estado, cep: e.cep, telefone: e.telefone, whatsapp: e.whatsapp,
      email: e.email, website: e.site,
    },
    responsavel_tecnico: { ...(e.responsavelTecnico || {}) },
    branding: {
      logo: e.logo, logoReduzida: e.logoReduzida,
      corPrimaria: e.corPrimaria, corSecundaria: e.corSecundaria,
    },
    uploads: { ...(e.uploads || {}) },
    // S8.3.2 — array de contas (substituído inteiro no backend)
    dados_bancarios: Array.isArray(e.dadosBancarios) ? e.dadosBancarios : [],
  }
}
function deGrupos(doc) {
  if (!doc) return {}
  const ec = doc.empresa_config || {}
  const rt = doc.responsavel_tecnico || {}
  const br = doc.branding || {}
  const up = doc.uploads || {}
  const flat = {}
  if (ec.razaoSocial != null) flat.razaoSocial = ec.razaoSocial
  if (ec.nomeFantasia != null) { flat.nomeFantasia = ec.nomeFantasia; flat.nomeEmpresa = ec.nomeFantasia }
  if (ec.cnpj != null) flat.cnpj = ec.cnpj
  if (ec.ie != null) flat.ie = ec.ie
  if (ec.endereco != null) flat.endereco = ec.endereco
  if (ec.cidade != null) flat.cidade = ec.cidade
  if (ec.uf != null) flat.estado = ec.uf
  if (ec.cep != null) flat.cep = ec.cep
  if (ec.telefone != null) flat.telefone = ec.telefone
  if (ec.whatsapp != null) flat.whatsapp = ec.whatsapp
  if (ec.email != null) flat.email = ec.email
  if (ec.website != null) flat.site = ec.website
  if (Object.keys(rt).length) flat.responsavelTecnico = { ...PADRAO_EMPRESA.responsavelTecnico, ...rt }
  if (br.logo != null) flat.logo = br.logo
  if (br.logoReduzida != null) flat.logoReduzida = br.logoReduzida
  if (br.corPrimaria != null) flat.corPrimaria = br.corPrimaria
  if (br.corSecundaria != null) flat.corSecundaria = br.corSecundaria
  if (Object.keys(up).length) flat.uploads = { ...PADRAO_EMPRESA.uploads, ...up }
  if (Array.isArray(doc.dados_bancarios)) flat.dadosBancarios = doc.dados_bancarios
  return flat
}

export function EmpresaProvider({ children }) {
  const [empresa, setEmpresa] = useState(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_LS)
      return salvo ? { ...PADRAO_EMPRESA, ...JSON.parse(salvo) } : PADRAO_EMPRESA
    } catch {
      return PADRAO_EMPRESA
    }
  })

  useEffect(() => {
    aplicarCSSVars(empresa.corPrimaria, empresa.corSecundaria)
  }, [empresa.corPrimaria, empresa.corSecundaria])

  // Aplica na inicialização
  useEffect(() => {
    aplicarCSSVars(empresa.corPrimaria, empresa.corSecundaria)
  }, [])

  // S7.1: carrega a configuração persistida no banco (singleton), com fallback localStorage
  useEffect(() => {
    let vivo = true
    fetch('/api/empresa')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!vivo || !data?.config) return
        const flat = deGrupos(data.config)
        if (Object.keys(flat).length) setEmpresa(prev => ({ ...prev, ...flat }))
      })
      .catch(() => { /* offline → mantém localStorage */ })
    return () => { vivo = false }
  }, [])

  // S7.1: persiste no banco (fire-and-forget; localStorage é o cache imediato)
  function persistirBackend(estado) {
    try {
      fetch('/api/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paraGrupos(estado)),
      }).catch(() => {})
    } catch { /* silencioso */ }
  }

  function salvar(dados) {
    const novo = { ...empresa, ...dados }
    setEmpresa(novo)
    localStorage.setItem(CHAVE_LS, JSON.stringify(novo))
    persistirBackend(novo)
  }

  function salvarRT(dados) {
    salvar({ responsavelTecnico: { ...empresa.responsavelTecnico, ...dados } })
  }

  // CFG-04: salva subconjunto financeiro
  function salvarFinanceiro(dados) {
    salvar({ financeiro: { ...PADRAO_EMPRESA.financeiro, ...empresa.financeiro, ...dados } })
  }

  // S7.1: salvadores institucionais
  function salvarEmpresa(dados) {
    const novo = { ...dados }
    if (dados.nomeFantasia != null) novo.nomeEmpresa = dados.nomeFantasia
    salvar(novo)
  }
  function salvarBranding(dados) {
    salvar(dados)
  }
  function salvarUploads(dados) {
    salvar({ uploads: { ...PADRAO_EMPRESA.uploads, ...empresa.uploads, ...dados } })
  }

  // S8.3.2 — salva o array de contas bancárias (substitui inteiro)
  function salvarDadosBancarios(contas) {
    salvar({ dadosBancarios: Array.isArray(contas) ? contas : [] })
  }

  function resetar() {
    setEmpresa(PADRAO_EMPRESA)
    localStorage.removeItem(CHAVE_LS)
    aplicarCSSVars(PADRAO_EMPRESA.corPrimaria, PADRAO_EMPRESA.corSecundaria)
  }

  return (
    <EmpresaCtx.Provider value={{ empresa, salvar, salvarRT, salvarFinanceiro, salvarEmpresa, salvarBranding, salvarUploads, salvarDadosBancarios, resetar }}>
      {children}
    </EmpresaCtx.Provider>
  )
}

export function useEmpresa() {
  const ctx = useContext(EmpresaCtx)
  if (!ctx) throw new Error('useEmpresa deve estar dentro de EmpresaProvider')
  return ctx
}
