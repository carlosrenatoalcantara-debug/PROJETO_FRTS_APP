import { useState } from 'react'
import { Download, Eye, Loader, Send } from 'lucide-react'
import Button from '../ui/Button'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

export default function Proposta({ projetoId, projeto, cliente, financeiro }) {
  const [gerando, setGerando] = useState(false)
  const [visualizando, setVisualizando] = useState(false)
  const [pdfBase64, setPdfBase64] = useState(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function gerarProposta() {
    setGerando(true)
    setErro('')
    setSucesso('')

    try {
      const res = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/proposta/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projeto, cliente, financeiro }),
      })

      if (!res.ok) {
        throw new Error('Erro ao gerar proposta')
      }

      // Blob para download direto
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `proposta_${projetoId}.pdf`
      link.click()
      URL.revokeObjectURL(url)

      setSucesso('✓ Proposta gerada e baixada com sucesso!')
      setTimeout(() => setSucesso(''), 3000)
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setGerando(false)
    }
  }

  async function visualizarProposta() {
    setVisualizando(true)
    setErro('')

    try {
      const res = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/proposta/visualizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projeto, cliente, financeiro }),
      })

      if (!res.ok) {
        throw new Error('Erro ao visualizar proposta')
      }

      const dados = await res.json()
      setPdfBase64(dados.pdf_base64)
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setVisualizando(false)
    }
  }

  function fecharVisualizacao() {
    setPdfBase64(null)
  }

  return (
    <div className="space-y-4">
      {/* Informações da Proposta */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Gerador de Proposta Comercial</h3>
        <p className="text-sm text-slate-700 mb-4">
          Crie uma proposta profissional em PDF com 10 páginas, incluindo análise técnica, financeira
          e condições comerciais personalizadas para o cliente.
        </p>

        {/* Cards de Informações */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white p-3 rounded border border-slate-200">
            <p className="text-xs text-slate-600">Potência</p>
            <p className="text-lg font-bold text-slate-900">{projeto?.potencia_kwp || 0} kWp</p>
          </div>
          <div className="bg-white p-3 rounded border border-slate-200">
            <p className="text-xs text-slate-600">Cliente</p>
            <p className="text-sm font-bold text-slate-900 truncate">{cliente?.nome || 'N/A'}</p>
          </div>
          <div className="bg-white p-3 rounded border border-slate-200">
            <p className="text-xs text-slate-600">Investimento</p>
            <p className="text-lg font-bold text-slate-900">
              R$ {(financeiro?.investimento_total || 0).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="bg-white p-3 rounded border border-slate-200">
            <p className="text-xs text-slate-600">Payback</p>
            <p className="text-lg font-bold text-slate-900">
              {financeiro?.payback || ((financeiro?.investimento_total || 25000) / ((projeto?.potencia_kwp || 5) * 131.44 * 0.80 * 12)).toFixed(1)} anos
            </p>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={gerarProposta}
            disabled={gerando || !projeto || !cliente}
            icone={gerando ? undefined : Download}
            className="flex-1 min-w-[200px]"
          >
            {gerando ? 'Gerando...' : '📥 Gerar e Baixar PDF'}
          </Button>
          <Button
            onClick={visualizarProposta}
            disabled={visualizando || !projeto || !cliente}
            variante="secundario"
            icone={visualizando ? undefined : Eye}
            className="flex-1 min-w-[200px]"
          >
            {visualizando ? 'Carregando...' : '👁️ Visualizar'}
          </Button>
          <Button
            disabled={true}
            variante="desabilitado"
            icone={Send}
            className="flex-1 min-w-[200px]"
            title="Funcionalidade em desenvolvimento"
          >
            📧 Enviar por Email
          </Button>
        </div>
      </div>

      {/* Mensagens de Feedback */}
      {sucesso && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          {sucesso}
        </div>
      )}

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          ✗ {erro}
        </div>
      )}

      {/* Visualização de PDF em Modal */}
      {pdfBase64 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-96 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Visualizar Proposta</h3>
              <button
                onClick={fecharVisualizacao}
                className="text-slate-500 hover:text-slate-700 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              <iframe
                src={pdfBase64}
                className="w-full h-full border-0"
                title="Proposta Comercial"
              />
            </div>

            <div className="p-4 border-t border-slate-200 flex gap-3">
              <Button
                onClick={gerarProposta}
                icone={Download}
                className="flex-1"
              >
                📥 Baixar PDF
              </Button>
              <Button
                onClick={fecharVisualizacao}
                variante="secundario"
                className="flex-1"
              >
                ✕ Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Informações sobre as páginas */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">📄 Conteúdo da Proposta (10 páginas):</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-blue-800">
          <div>✓ Página 1: Capa Profissional</div>
          <div>✓ Página 2: Resumo Executivo</div>
          <div>✓ Página 3: Antes vs Depois</div>
          <div>✓ Página 4: Especificação Técnica</div>
          <div>✓ Página 5: Análise Financeira</div>
          <div>✓ Página 6: Geração Mensal</div>
          <div>✓ Página 7: Garantias e Benefícios</div>
          <div>✓ Página 8: Detalhamento de Investimento</div>
          <div>✓ Página 9: Cronograma de Execução</div>
          <div>✓ Página 10: Termo de Aceite</div>
        </div>
      </div>

      {/* Dicas */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <p>
          <strong>💡 Dica:</strong> Preencha todos os dados do projeto e do cliente antes de gerar a proposta.
          Os valores são extraídos automaticamente e aparecem no PDF personalizado para cada cliente.
        </p>
      </div>
    </div>
  )
}
