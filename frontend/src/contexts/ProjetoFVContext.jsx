import { createContext, useContext, useReducer } from 'react'

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
  },
  localizacao: {
    endereco:     '',
    lat:          null,
    lon:          null,
    cidadeEstado: '',
    uf:           null,
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
    case 'RESETAR':
      return estadoInicial
    default:
      return state
  }
}

const Ctx = createContext(null)

export function ProjetoFVProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, estadoInicial)

  const proxima  = () => {
    const proximaEtapa = state.etapa === 2 ? 2.5 : state.etapa === 2.5 ? 3 : state.etapa + 1
    dispatch({ type: 'IR_ETAPA', payload: Math.min(proximaEtapa, 8) })
  }
  const anterior = () => {
    const etapaAnterior = state.etapa === 2.5 ? 2 : state.etapa === 3 ? 2.5 : state.etapa - 1
    dispatch({ type: 'IR_ETAPA', payload: Math.max(etapaAnterior, 1) })
  }
  const irParaEtapa = (n) => dispatch({ type: 'IR_ETAPA', payload: n })

  return (
    <Ctx.Provider value={{ state, dispatch, proxima, anterior, irParaEtapa, ETAPAS }}>
      {children}
    </Ctx.Provider>
  )
}

export const useProjetoFV = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProjetoFV precisa estar dentro de ProjetoFVProvider')
  return ctx
}
