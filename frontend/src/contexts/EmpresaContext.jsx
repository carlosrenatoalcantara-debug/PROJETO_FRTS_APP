import { createContext, useContext, useEffect, useState } from 'react'

const CHAVE_LS = 'forte_solar_empresa_v1'

export const PADRAO_EMPRESA = {
  logo:          null,           // base64 string
  nomeEmpresa:   'Forte Solar',
  cnpj:          '',
  endereco:      '',
  cidade:        '',
  estado:        'SP',
  cep:           '',
  telefone:      '',
  email:         '',
  site:          '',
  corPrimaria:   '#f97316',
  corSecundaria: '#0f172a',
  responsavelTecnico: {
    nome:          '',
    registro:      '',
    tipoRegistro:  'CREA',      // 'CREA' | 'CFT' | 'CFMV'
    uf:            'SP',
  },
  estadoPrincipal:           'SP',
  tensaoPadrao:              '220',
  forcaFallbackIrradiancia:  false,
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

  function salvar(dados) {
    const novo = { ...empresa, ...dados }
    setEmpresa(novo)
    localStorage.setItem(CHAVE_LS, JSON.stringify(novo))
  }

  function salvarRT(dados) {
    salvar({ responsavelTecnico: { ...empresa.responsavelTecnico, ...dados } })
  }

  function resetar() {
    setEmpresa(PADRAO_EMPRESA)
    localStorage.removeItem(CHAVE_LS)
    aplicarCSSVars(PADRAO_EMPRESA.corPrimaria, PADRAO_EMPRESA.corSecundaria)
  }

  return (
    <EmpresaCtx.Provider value={{ empresa, salvar, salvarRT, resetar }}>
      {children}
    </EmpresaCtx.Provider>
  )
}

export function useEmpresa() {
  const ctx = useContext(EmpresaCtx)
  if (!ctx) throw new Error('useEmpresa deve estar dentro de EmpresaProvider')
  return ctx
}
