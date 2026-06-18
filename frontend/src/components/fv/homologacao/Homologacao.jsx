import { useState } from 'react'
import { ClipboardCopy, Cpu, Users, FileText, CheckSquare, History, Lock } from 'lucide-react'
import CentralDados from './CentralDados'
import CentralEquipamentos from './CentralEquipamentos'
import CentralDocumentos from './CentralDocumentos'
import CentralHistorico from './CentralHistorico'
import ChecklistDocumentos from './ChecklistDocumentos'
import BeneficiariasPainel from '../BeneficiariasPainel'
import { obterEquipamentosEngenharia } from '../../../utils/engenhariaGovernanca'

/**
 * P1-CENTRAL-HOMOLOGACAO-MVP — Central Operacional de Homologação.
 * Reorganiza a aba Homologação em 6 sub-abas, reutilizando os componentes
 * existentes (Memorial, Carta, ART, Checklist, Beneficiárias) e o snapshot.
 * NÃO automatiza portais — apenas consolida e facilita o copy/paste manual.
 */
export default function Homologacao({ projetoId, projeto, cliente }) {
  const [abaAtiva, setAbaAtiva] = useState('dados')
  const [projetoLocal, setProjetoLocal] = useState(projeto)
  const proj = projetoLocal || projeto

  // P1-HOMOLOGACAO-SNAPSHOT-01: origem dos equipamentos (snapshot quando congelado).
  const eng = obterEquipamentosEngenharia(proj)
  const usaSnapshot = eng.origem === 'snapshot'

  const idProjeto = projetoId || proj?._id
  const estado = proj?.estado || proj?.localizacao?.estado
  const concessionaria = proj?.homologacao?.concessionaria || proj?.concessionaria

  const abas = [
    { id: 'dados', rotulo: 'Dados', icone: ClipboardCopy },
    { id: 'equipamentos', rotulo: 'Equipamentos', icone: Cpu },
    { id: 'beneficiarias', rotulo: 'Beneficiárias', icone: Users },
    { id: 'documentos', rotulo: 'Documentos', icone: FileText },
    { id: 'checklist', rotulo: 'Checklist', icone: CheckSquare },
    { id: 'historico', rotulo: 'Histórico', icone: History },
  ]

  function aplicarProtocolo(patch) {
    setProjetoLocal((p) => ({
      ...(p || {}),
      homologacao: { ...((p || {}).homologacao || {}), ...patch },
    }))
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho da Central */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-indigo-900">
          <strong>Central de Homologação</strong> — consolida dados, equipamentos, documentos e
          checklist para homologar em {concessionaria || 'N/A'} ({estado || 'N/A'}).
        </p>
        {usaSnapshot && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <Lock size={13} /> Orçamento congelado
          </span>
        )}
      </div>

      {/* Sub-abas (scroll horizontal no mobile) */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1 overflow-x-auto">
          {abas.map((aba) => {
            const Icon = aba.icone
            const isActive = abaAtiva === aba.id
            return (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`px-3 sm:px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon size={17} />
                {aba.rotulo}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="bg-white rounded-lg p-4 sm:p-6">
        {abaAtiva === 'dados' && (
          <CentralDados projeto={proj} cliente={cliente} />
        )}
        {abaAtiva === 'equipamentos' && (
          <CentralEquipamentos projeto={proj} />
        )}
        {abaAtiva === 'beneficiarias' && (
          <BeneficiariasPainel projetoId={idProjeto} />
        )}
        {abaAtiva === 'documentos' && (
          <CentralDocumentos projetoId={idProjeto} projeto={proj} cliente={cliente} />
        )}
        {abaAtiva === 'checklist' && (
          <ChecklistDocumentos
            projetoId={idProjeto}
            estado={estado}
            concessionaria={concessionaria}
          />
        )}
        {abaAtiva === 'historico' && (
          <CentralHistorico projeto={proj} onAtualizar={aplicarProtocolo} />
        )}
      </div>
    </div>
  )
}
