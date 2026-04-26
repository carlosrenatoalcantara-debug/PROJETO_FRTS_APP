import { useState } from 'react'
import { FileText, Mail, Award, CheckSquare } from 'lucide-react'
import MemorialDescritivo from './MemorialDescritivo'
import CartaConcessionaria from './CartaConcessionaria'
import DadosART from './DadosART'
import ChecklistDocumentos from './ChecklistDocumentos'

export default function Homologacao({ projetoId, projeto, cliente }) {
  const [abaAtiva, setAbaAtiva] = useState('checklist')

  const abas = [
    {
      id: 'checklist',
      rotulo: 'Checklist',
      icone: CheckSquare,
      descricao: 'Acompanhe os documentos',
    },
    {
      id: 'memorial',
      rotulo: 'Memorial Descritivo',
      icone: FileText,
      descricao: 'Gere automaticamente',
    },
    {
      id: 'carta',
      rotulo: 'Carta à Concessionária',
      icone: Mail,
      descricao: 'Documento de solicitação',
    },
    {
      id: 'art',
      rotulo: 'Dados para ART',
      icone: Award,
      descricao: 'Informações técnicas',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Informação Geral */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <p className="text-sm text-indigo-900">
          <strong>🎯 Objetivo:</strong> Prepare todos os documentos necessários para homologar
          seu sistema na concessionária {projeto?.concessionaria || 'N/A'} ({projeto?.estado || 'N/A'}).
        </p>
      </div>

      {/* Abas */}
      <div className="border-b border-slate-200">
        <div className="flex gap-2 overflow-x-auto">
          {abas.map((aba) => {
            const Icon = aba.icone
            const isActive = abaAtiva === aba.id
            return (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon size={18} />
                {aba.rotulo}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="bg-white rounded-lg p-6">
        {abaAtiva === 'checklist' && (
          <ChecklistDocumentos
            projetoId={projetoId}
            estado={projeto?.estado}
            concessionaria={projeto?.concessionaria}
          />
        )}

        {abaAtiva === 'memorial' && (
          <MemorialDescritivo
            projetoId={projetoId}
            projeto={projeto}
            cliente={cliente}
          />
        )}

        {abaAtiva === 'carta' && (
          <CartaConcessionaria
            projetoId={projetoId}
            projeto={projeto}
            cliente={cliente}
          />
        )}

        {abaAtiva === 'art' && (
          <DadosART
            projetoId={projetoId}
            projeto={projeto}
            estado={projeto?.estado}
          />
        )}
      </div>

      {/* Legenda de Status */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-slate-100 rounded"></div>
          <span>Rascunho</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-100 rounded"></div>
          <span>Enviado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-100 rounded"></div>
          <span>Em Análise</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-100 rounded"></div>
          <span>Aprovado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-100 rounded"></div>
          <span>Conectado</span>
        </div>
      </div>
    </div>
  )
}
