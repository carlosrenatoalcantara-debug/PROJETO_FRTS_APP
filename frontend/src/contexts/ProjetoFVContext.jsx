import { createContext, useContext, useReducer, useEffect } from 'react'

// Chave de storage para resiliência ao refresh (S2.8)
const LS_KEY = 'forte_solar_wizard_fv_v3'

const ETAPAS = [
  { num: 1, rotulo: 'Fatura'          },
  { num: 2, rotulo: 'Consumo'         },
  { num: 2.5, rotulo: 'Beneficiárias' },
  { num: 3, rotulo: 'Localização'     },
  { num: 4, rotulo: 'Irradiância'     },
  { num: 5, rotulo: 'Dimensionamento' },
  { num: 6, rotulo: 'Área'            },
  { num: 7, rotulo: 'Equipamentos'    },
  { num: 8, rotulo: 'Orçamento'       },
]

const estadoInicial = {
  etapa: 1,
  arquivo: null,
  nomeArquivo: null,
  // S2.8: âncora de persistência — preenchido após criação do ProjetoFV
  projetoId:  null,
  clienteId:  null,
  dadosCliente: {
    nomeCliente:   '',
    nomeProjeto:   '',
    telefone:      '',
    email:         '',
  },
  dadosConsumo: {
    consumoMensal:  '',
    consumosMensais: Array(12).fill(''),
    usarMeses:      false,
    concessionaria: '',
    tipoLigacao:    'monofasico',
    tensao:         '220',
    // Dados extraídos da fatura
    distribuidora: '',
    grupoTarifario: '',
    fase: '',
    valorKwh: '',
    irradiancia: '',
    historico12Meses: null,
    mediaAnual: null,
  },
  localizacao: {
    endereco:     '',
    lat:          null,
    lon:          null,
    cidadeEstado: '',
    uf:           null,
    geocoding_origem: null,
    geocoding_confianca: null,
    geocodificado_em: null,
  },
  irradiancia: {
    mensal:     null,
    mediaAnual: null,
    carregando: false,
    erro:       null,
    fonte:      null,   // 'nasa' | 'cresesb'
  },
  dimensionamento: {
    potenciaKwp:       null,
    potenciaRealKwp:   null,
    numPaineis:        null,
    numInversores:     null,
    energiaDiaria:     null,
    energiaNecessaria: null,
    areaMinima:        null,
    potenciaPainelW:   550,
    capacidadeInversorKW: 5,
  },
  area: {
    areaDisponivel: '',
    orientacao:     'Norte',
    inclinacao:     '15',
    suficiente:     null,
  },
  equipamentos: { painel: null, inversor: null, estrutura: null },
  beneficiarias: [],   // FV-04: local until projetoId exists; saved to DB at step 8
}

function reducer(state, action) {
  switch (action.type) {
    case 'IR_ETAPA':
      return { ...state, etapa: action.payload }
    case 'SET_ARQUIVO':
      return { ...state, arquivo: action.payload.arquivo, nomeArquivo: action.payload.nome }
    case 'SET_CLIENTE':
      return { ...state, dadosCliente: { ...state.dadosCliente, ...action.payload } }
    case 'SET_CONSUMO':
      return { ...state, dadosConsumo: { ...state.dadosConsumo, ...action.payload } }
    case 'SET_LOCALIZACAO':
      return { ...state, localizacao: { ...state.localizacao, ...action.payload } }
    case 'SET_IRRADIANCIA':
      return { ...state, irradiancia: { ...state.irradiancia, ...action.payload } }
    case 'SET_DIMENSIONAMENTO':
      return { ...state, dimensionamento: { ...state.dimensionamento, ...action.payload } }
    case 'SET_AREA':
      return { ...state, area: { ...state.area, ...action.payload } }
    case 'SET_EQUIPAMENTO':
      return { ...state, equipamentos: { ...state.equipamentos, [action.payload.tipo]: action.payload.item } }
    // FV-04: beneficiárias locais (array completo)
    case 'SET_BENEFICIARIAS':
      return { ...state, beneficiarias: action.payload }
    // S2.8: âncoras de persistência
    case 'SET_PROJETO_ID':
      return { ...state, projetoId: action.payload }
    case 'SET_CLIENTE_ID':
      return { ...state, clienteId: action.payload }
    // S2.8: hidratação completa do estado (retomada via ?id= ou localStorage)
    case 'HIDRATAR':
      return { ...estadoInicial, ...action.payload }
    case 'RESETAR':
      return estadoInicial
    default:
      return state
  }
}

const Ctx = createContext(null)

export function ProjetoFVProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, estadoInicial)

  // ── S2.8: persistência no localStorage (resiliência ao refresh) ──────────────
  // Salva estado sempre que muda (exceto campos não serializáveis como `arquivo`)
  useEffect(() => {
    try {
      const { arquivo, ...serializavel } = state   // File objects não são serializáveis
      localStorage.setItem(LS_KEY, JSON.stringify(serializavel))
    } catch { /* storage cheio ou privado — silencioso */ }
  }, [state])

  // ── Helpers de navegação (inalterados) ────────────────────────────────────────
  const proxima  = () => {
    const proximaEtapa = state.etapa === 2 ? 2.5 : state.etapa === 2.5 ? 3 : state.etapa + 1
    dispatch({ type: 'IR_ETAPA', payload: Math.min(proximaEtapa, 8) })
  }
  const anterior = () => {
    const etapaAnterior = state.etapa === 2.5 ? 2 : state.etapa === 3 ? 2.5 : state.etapa - 1
    dispatch({ type: 'IR_ETAPA', payload: Math.max(etapaAnterior, 1) })
  }
  const irParaEtapa = (n) => dispatch({ type: 'IR_ETAPA', payload: n })

  // ── S2.8: limpa storage ao resetar ───────────────────────────────────────────
  const resetar = () => {
    try { localStorage.removeItem(LS_KEY) } catch { /* silencioso */ }
    dispatch({ type: 'RESETAR' })
  }

  return (
    <Ctx.Provider value={{ state, dispatch, proxima, anterior, irParaEtapa, resetar, ETAPAS }}>
      {children}
    </Ctx.Provider>
  )
}

export const useProjetoFV = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProjetoFV precisa estar dentro de ProjetoFVProvider')
  return ctx
}
