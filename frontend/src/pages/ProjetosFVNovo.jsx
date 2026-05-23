import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { X, AlertTriangle, Cloud, CloudOff } from 'lucide-react'
import { ProjetoFVProvider, useProjetoFV } from '../contexts/ProjetoFVContext'
import { buscarProjeto, salvarEtapa, adaptarLocalizacao, adaptarDimensionamento,
         adaptarEquipamentos, adaptarLayoutSolar, adaptarWorkflow } from '../services/projetoFVApi'

const LS_KEY = 'forte_solar_wizard_fv_v3'

// Mapa: número da etapa → slice que deve ser salvo AO SAIR dela
const ETAPA_PARA_SLICE = {
  3:   'localizacao',
  5:   'dimensionamento',
  6:   'layout_solar',
  7:   'equipamentos',
  // 8 / orcamento é salvo pelo próprio E8Orcamento ao criar o projeto
}
import Stepper from '../components/ui/Stepper'
import E1Upload          from '../components/fv/etapas/E1Upload'
import E2Consumo         from '../components/fv/etapas/E2Consumo'
import E2BBeneficiarias  from '../components/fv/etapas/E2BBeneficiarias'
import E3Localizacao     from '../components/fv/etapas/E3Localizacao'
import E4Irradiancia     from '../components/fv/etapas/E4Irradiancia'
import E5Dimensionamento from '../components/fv/etapas/E5Dimensionamento'
import E6Area            from '../components/fv/etapas/E6Area'
import E7Equipamentos    from '../components/fv/etapas/E7Equipamentos'
import E8Orcamento       from '../components/fv/etapas/E8Orcamento'

const COMPONENTES = {
  1: E1Upload,
  2: E2Consumo,
  2.5: E2BBeneficiarias,
  3: E3Localizacao,
  4: E4Irradiancia,
  5: E5Dimensionamento,
  6: E6Area,
  7: E7Equipamentos,
  8: E8Orcamento,
}

function WizardInterno() {
  const navigate    = useNavigate()
  const [params]    = useSearchParams()
  const { state, irParaEtapa, dispatch, resetar, ETAPAS } = useProjetoFV()
  const EtapaAtual  = COMPONENTES[state.etapa]
  const etapaAnteriorRef = useRef(state.etapa)

  // ── S2.8: restaurar do localStorage na montagem ───────────────────────────────
  useEffect(() => {
    const idParam = params.get('id')

    if (idParam) {
      // Retomada via ?id=: carregar projeto do banco
      buscarProjeto(idParam)
        .then(projeto => {
          // Hidrata o contexto com os campos v3 disponíveis
          dispatch({
            type: 'HIDRATAR',
            payload: {
              projetoId: String(projeto._id),
              etapa:     projeto.workflow?.etapa_atual ?? 1,
              dadosCliente: {
                nomeCliente:  projeto.clienteId?.nome   || '',
                nomeProjeto:  projeto.nome              || '',
                telefone:     projeto.clienteId?.telefone || '',
                email:        projeto.clienteId?.email  || '',
              },
              localizacao: projeto.localizacao ? {
                endereco:            projeto.localizacao.endereco_completo || '',
                lat:                 projeto.localizacao.latitude          ?? null,
                lon:                 projeto.localizacao.longitude         ?? null,
                cidadeEstado:        [projeto.localizacao.cidade, projeto.localizacao.estado].filter(Boolean).join(', '),
                uf:                  projeto.localizacao.estado            || null,
                geocoding_origem:    projeto.localizacao.geocoding_origem  || null,
                geocoding_confianca: projeto.localizacao.geocoding_confianca ?? null,
                geocodificado_em:    projeto.localizacao.geocodificado_em  || null,
              } : undefined,
            },
          })
        })
        .catch(err => console.warn('[Wizard] Falha ao carregar projeto:', err.message))
      return
    }

    // Sem ?id=: tentar restaurar do localStorage
    try {
      const salvo = localStorage.getItem(LS_KEY)
      if (salvo) {
        const parsed = JSON.parse(salvo)
        // Só restaura se tiver dados reais (não apenas o estado inicial)
        if (parsed?.dadosCliente?.nomeCliente || parsed?.projetoId) {
          dispatch({ type: 'HIDRATAR', payload: parsed })
        }
      }
    } catch { /* storage corrompido — ignora */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── S2.8: autosave de slice ao avançar etapa (só se projetoId existe) ────────
  useEffect(() => {
    const etapaAnterior = etapaAnteriorRef.current
    const etapaAtual    = state.etapa

    // Só salva quando avança (não na volta)
    if (etapaAtual > etapaAnterior && state.projetoId) {
      const sliceNome = ETAPA_PARA_SLICE[etapaAnterior]
      if (sliceNome) {
        const dados = buildSliceDados(sliceNome, state)
        if (dados) {
          salvarEtapa(state.projetoId, sliceNome, dados)
            .then(() => console.info(`[Wizard] ✓ slice "${sliceNome}" salvo`))
            .catch(err => console.warn(`[Wizard] slice "${sliceNome}" falhou:`, err.message))
        }
      }
      // Sempre atualiza workflow
      salvarEtapa(state.projetoId, 'workflow', adaptarWorkflow(etapaAtual, []))
        .catch(() => {/* silencioso */})
    }

    etapaAnteriorRef.current = etapaAtual
  }, [state.etapa]) // eslint-disable-line react-hooks/exhaustive-deps

  function fechar() {
    const confirmar = state.etapa > 1
      ? window.confirm('Tem certeza que deseja sair? Os dados foram salvos no navegador.')
      : true
    if (confirmar) navigate('/projetos-fv')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Projeto Fotovoltaico</h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
            <span>Etapa <strong>{state.etapa}</strong> de {ETAPAS.length}</span>
            {state.dadosCliente?.nomeCliente && (
              <span className="text-slate-400">· {state.dadosCliente.nomeCliente}</span>
            )}
            {/* S2.8: indicador de persistência */}
            {state.projetoId
              ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <Cloud size={11} /> Salvo
                </span>
              : <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <CloudOff size={11} /> Não salvo
                </span>
            }
          </p>
        </div>
        <button
          onClick={fechar}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          title="Cancelar e voltar"
        >
          <X size={20} />
        </button>
      </div>

      {/* Stepper */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-4 shadow-sm overflow-x-auto">
        <Stepper
          etapas={ETAPAS}
          etapaAtual={state.etapa}
          onIrPara={irParaEtapa}
        />
      </div>

      {/* Conteúdo da etapa */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <EtapaAtual />
      </div>

      {/* S2.8: aviso atualizado — localStorage protege do refresh */}
      {state.etapa > 3 && (
        <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
          <AlertTriangle size={12} />
          {state.projetoId
            ? `Projeto salvo no banco. ID: ${state.projetoId}`
            : 'Dados salvos no navegador. Salve a proposta na etapa 8 para persistir definitivamente.'
          }
        </div>
      )}
    </div>
  )
}

/**
 * Monta o payload de dados para um slice específico a partir do estado do contexto.
 * Usado pelo autosave hook no WizardInterno.
 */
function buildSliceDados(sliceNome, state) {
  switch (sliceNome) {
    case 'localizacao':
      return adaptarLocalizacao(state.localizacao, state.irradiancia)
    case 'dimensionamento':
      return adaptarDimensionamento(state.dimensionamento, state.irradiancia)
    case 'equipamentos':
      return adaptarEquipamentos(state.equipamentos, state.dimensionamento)
    case 'layout_solar':
      return adaptarLayoutSolar(state.area)
    default:
      return null
  }
}

export default function ProjetosFVNovo() {
  return (
    <ProjetoFVProvider>
      <WizardInterno />
    </ProjetoFVProvider>
  )
}
