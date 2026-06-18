import { useState } from 'react'
import { FileText, Mail, Award } from 'lucide-react'
import MemorialDescritivo from './MemorialDescritivo'
import CartaConcessionaria from './CartaConcessionaria'
import DadosART from './DadosART'

/**
 * P1-CENTRAL-HOMOLOGACAO-MVP — Aba Documentos.
 * Consolida os geradores já existentes (Memorial, Carta, ART) num só lugar.
 * NÃO recria geradores — apenas reutiliza os componentes existentes.
 */

const DOCS = [
  { id: 'memorial', rotulo: 'Memorial Descritivo', icone: FileText, descricao: 'Gerado sob demanda · usa snapshot quando congelado' },
  { id: 'carta', rotulo: 'Carta à Concessionária', icone: Mail, descricao: 'Documento de solicitação de acesso' },
  { id: 'art', rotulo: 'Dados para ART', icone: Award, descricao: 'Roteiro para registro no CREA' },
]

export default function CentralDocumentos({ projetoId, projeto, cliente }) {
  const [docAtivo, setDocAtivo] = useState('memorial')

  return (
    <div className="space-y-4">
      {/* Cartões-seletor de documento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {DOCS.map((doc) => {
          const Icon = doc.icone
          const ativo = docAtivo === doc.id
          return (
            <button
              key={doc.id}
              onClick={() => setDocAtivo(doc.id)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                ativo
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className={ativo ? 'text-indigo-600' : 'text-slate-500'} />
                <span className={`text-sm font-semibold ${ativo ? 'text-indigo-900' : 'text-slate-800'}`}>
                  {doc.rotulo}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{doc.descricao}</p>
            </button>
          )
        })}
      </div>

      {/* Conteúdo do documento selecionado — componentes existentes reutilizados */}
      <div className="border-t border-slate-100 pt-4">
        {docAtivo === 'memorial' && (
          <MemorialDescritivo projetoId={projetoId} projeto={projeto} cliente={cliente} />
        )}
        {docAtivo === 'carta' && (
          <CartaConcessionaria projetoId={projetoId} projeto={projeto} cliente={cliente} />
        )}
        {docAtivo === 'art' && (
          <DadosART projetoId={projetoId} projeto={projeto} estado={projeto?.estado || projeto?.localizacao?.estado} />
        )}
      </div>
    </div>
  )
}
