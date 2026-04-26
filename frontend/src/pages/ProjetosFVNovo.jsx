import { useNavigate } from 'react-router-dom'
import { X, AlertTriangle } from 'lucide-react'
import { ProjetoFVProvider, useProjetoFV } from '../contexts/ProjetoFVContext'
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
  const navigate = useNavigate()
  const { state, irParaEtapa, dispatch, ETAPAS } = useProjetoFV()
  const EtapaAtual = COMPONENTES[state.etapa]

  function fechar() {
    const confirmar = state.etapa > 1
      ? window.confirm('Tem certeza que deseja sair? Os dados do projeto serão perdidos.')
      : true
    if (confirmar) navigate('/projetos-fv')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Projeto Fotovoltaico</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Etapa <strong>{state.etapa}</strong> de {ETAPAS.length}
            {state.dadosCliente?.nomeCliente && (
              <span className="ml-2 text-slate-400">· {state.dadosCliente.nomeCliente}</span>
            )}
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

      {/* Alerta de perda de dados ao sair */}
      {state.etapa > 3 && (
        <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
          <AlertTriangle size={12} />
          Os dados do projeto são mantidos apenas durante esta sessão do navegador.
          Salve a proposta na etapa 8 para não perder o trabalho.
        </div>
      )}
    </div>
  )
}

export default function ProjetosFVNovo() {
  return (
    <ProjetoFVProvider>
      <WizardInterno />
    </ProjetoFVProvider>
  )
}
