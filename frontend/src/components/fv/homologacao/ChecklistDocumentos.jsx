import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import Button from '../../ui/Button'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005'

const STATUS_CORES = {
  rascunho: 'bg-slate-100 text-slate-700',
  enviado: 'bg-blue-100 text-blue-700',
  analise: 'bg-yellow-100 text-yellow-700',
  aprovado: 'bg-green-100 text-green-700',
  conectado: 'bg-emerald-100 text-emerald-700',
}

const STATUS_LABELS = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  analise: 'Em Análise',
  aprovado: 'Aprovado',
  conectado: 'Conectado à Rede',
}

export default function ChecklistDocumentos({ projetoId, estado, concessionaria }) {
  const [checklist, setChecklist] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [status, setStatus] = useState('rascunho')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    obterChecklist()
  }, [])

  async function obterChecklist() {
    setCarregando(true)
    setErro('')

    try {
      const res = await fetch(
        `${API_URL}/api/projetos-fv/${projetoId}/homologacao/checklist?estado=${estado}&concessionaria=${concessionaria}`,
        { method: 'GET' }
      )

      if (!res.ok) {
        throw new Error('Erro ao obter checklist')
      }

      const dados = await res.json()
      setChecklist(dados.checklist)
      setStatus(dados.checklist.status)
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setCarregando(false)
    }
  }

  function toggleDocumento(index) {
    const novoChecklist = { ...checklist }
    novoChecklist.documentos[index].concluido = !novoChecklist.documentos[index].concluido
    setChecklist(novoChecklist)
  }

  async function salvarChecklist() {
    setSalvando(true)
    setErro('')

    try {
      const res = await fetch(
        `${API_URL}/api/projetos-fv/${projetoId}/homologacao/checklist`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentos: checklist.documentos,
            observacoes,
            status,
          }),
        }
      )

      if (!res.ok) {
        throw new Error('Erro ao salvar checklist')
      }

      const dados = await res.json()
      alert(`✓ Checklist atualizado! Progresso: ${dados.progresso.concluidos}/${dados.progresso.total} (${dados.progresso.percentual}%)`)
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className="text-center py-8 text-slate-500">Carregando checklist...</div>
  }

  if (!checklist) {
    return <div className="text-center py-8 text-red-500">Erro ao carregar checklist</div>
  }

  const totalDocs = checklist.documentos.length
  const docsConcluidos = checklist.documentos.filter(d => d.concluido).length
  const percentualConcluido = ((docsConcluidos / totalDocs) * 100).toFixed(0)

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-slate-900">Status da Homologação</h4>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_CORES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 p-3 rounded">
            <p className="text-xs text-slate-600">Documentos Preparados</p>
            <p className="text-2xl font-bold text-slate-900">{docsConcluidos}/{totalDocs}</p>
            <p className="text-xs text-slate-500 mt-1">{percentualConcluido}% concluído</p>
          </div>
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-xs text-blue-600">Concessionária</p>
            <p className="text-lg font-bold text-blue-900">{concessionaria || 'N/A'}</p>
            <p className="text-xs text-blue-600 mt-1">{estado}</p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="mt-4">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${percentualConcluido}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">{percentualConcluido}% de conclusão</p>
        </div>
      </div>

      {/* Lista de Documentos */}
      <div className="bg-white border border-slate-200 rounded-lg divide-y">
        <div className="p-4 bg-slate-50">
          <h4 className="font-semibold text-slate-900">Documentos Necessários</h4>
          <p className="text-xs text-slate-600 mt-1">Marque cada documento conforme prepara</p>
        </div>

        {checklist.documentos.map((doc, idx) => (
          <div
            key={idx}
            className="p-4 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors"
            onClick={() => toggleDocumento(idx)}
          >
            <div className="mt-1">
              {doc.concluido ? (
                <CheckCircle2 size={20} className="text-green-500" />
              ) : (
                <Circle size={20} className="text-slate-300" />
              )}
            </div>
            <div className="flex-1">
              <p className={`font-medium ${doc.concluido ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                {doc.documento}
              </p>
              <p className="text-xs text-slate-600 mt-1">{doc.descricao}</p>
            </div>
            {doc.obrigatorio && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-semibold">
                Obrigatório
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Seletor de Status */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Status Atual do Processo
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="rascunho">Rascunho - Documentos em preparação</option>
          <option value="enviado">Enviado - Documentos enviados à concessionária</option>
          <option value="analise">Em Análise - Concessionária analisando</option>
          <option value="aprovado">Aprovado - Documentos aprovados, aguardando conexão</option>
          <option value="conectado">Conectado à Rede - Sistema ativo e gerando</option>
        </select>
      </div>

      {/* Campo de Observações */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Observações
        </label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Ex: Aguardando retorno da análise. Contato: 85 98765-4321"
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Botões */}
      <div className="flex gap-3">
        <Button
          onClick={salvarChecklist}
          disabled={salvando}
          className="flex-1"
        >
          {salvando ? 'Salvando...' : '💾 Salvar Checklist'}
        </Button>
        <Button
          onClick={obterChecklist}
          variante="secundario"
          className="flex-1"
        >
          ↻ Recarregar
        </Button>
      </div>

      {erro && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {erro}
        </div>
      )}

      {/* Dicas */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2 text-xs text-blue-800">
        <p>
          <strong>💡 Dica:</strong> Prepare os documentos um a um e marque aqui conforme avança.
        </p>
        <p>
          <strong>📧 Próximo passo:</strong> Quando todos os documentos estiverem prontos,
          envie-os à concessionária ${concessionaria || 'N/A'} e atualize o status para "Enviado".
        </p>
      </div>
    </div>
  )
}
