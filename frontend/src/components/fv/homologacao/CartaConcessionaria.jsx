import { useState } from 'react'
import { Copy, Download } from 'lucide-react'
import Button from '../../ui/Button'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005'

export default function CartaConcessionaria({ projetoId, projeto, cliente }) {
  const [carta, setCarta] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  async function gerarCarta() {
    setCarregando(true)
    setErro('')

    try {
      const res = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/homologacao/carta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projeto, cliente }),
      })

      if (!res.ok) {
        throw new Error('Erro ao gerar carta')
      }

      const dados = await res.json()
      setCarta(dados.conteudo)
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setCarregando(false)
    }
  }

  function copiarTexto() {
    navigator.clipboard.writeText(carta)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function baixarDocumento() {
    const element = document.createElement('a')
    element.href = `data:text/plain;charset=utf-8,${encodeURIComponent(carta)}`
    element.download = `carta-concessionaria-${projetoId}.txt`
    element.click()
  }

  return (
    <div className="space-y-4">
      {!carta ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
          <p className="text-sm text-slate-700">
            Gere a carta oficial para enviar à concessionária (${projeto?.concessionaria || 'N/A'})
            solicitando a análise técnica do seu sistema fotovoltaico.
          </p>
          <Button
            onClick={gerarCarta}
            disabled={carregando}
            className="w-full"
          >
            {carregando ? 'Gerando...' : 'Gerar Carta à Concessionária'}
          </Button>
        </div>
      ) : (
        <>
          {/* Texto da Carta */}
          <div className="border border-slate-200 rounded-lg bg-white p-6 overflow-auto max-h-96 font-mono text-sm text-slate-700">
            <pre className="whitespace-pre-wrap">{carta}</pre>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3">
            <Button
              onClick={copiarTexto}
              variante="secundario"
              icone={Copy}
              className="flex-1"
            >
              {copiado ? '✓ Copiado!' : 'Copiar Texto'}
            </Button>
            <Button
              onClick={baixarDocumento}
              icone={Download}
              className="flex-1"
            >
              Baixar TXT
            </Button>
          </div>

          {/* Botão para Regenerar */}
          <button
            onClick={() => setCarta(null)}
            className="w-full px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg font-medium text-sm border border-green-200"
          >
            ↻ Regenerar Carta
          </button>

          {/* Informação */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
            <p>
              <strong>Para enviar:</strong> Copie o texto, cole em um documento Word,
              imprima em papel timbrado (ou adicione seu logotipo), assine e envie à
              concessionária ${projeto?.concessionaria || 'N/A'} junto com os anexos mencionados.
            </p>
          </div>
        </>
      )}

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          ✗ {erro}
        </div>
      )}
    </div>
  )
}
