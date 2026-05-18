import { useState } from 'react'
import { Copy, Download, Loader } from 'lucide-react'
import Button from '../../ui/Button'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

export default function MemorialDescritivo({ projetoId, projeto, cliente }) {
  const [memorial, setMemorial] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  async function gerarMemorial() {
    setCarregando(true)
    setErro('')

    try {
      const res = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/homologacao/memorial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projeto, cliente }),
      })

      if (!res.ok) {
        throw new Error('Erro ao gerar memorial')
      }

      const dados = await res.json()
      setMemorial(dados.conteudo)
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setCarregando(false)
    }
  }

  function copiarTexto() {
    navigator.clipboard.writeText(memorial)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function baixarDocx() {
    // Exportar como DOCX simples (para produção, usar library como docx)
    const element = document.createElement('a')
    element.href = `data:text/plain;charset=utf-8,${encodeURIComponent(memorial)}`
    element.download = `memorial-${projetoId}.txt`
    element.click()
  }

  return (
    <div className="space-y-4">
      {!memorial ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <p className="text-sm text-slate-700">
            Gere automaticamente o memorial descritivo com todos os dados do seu sistema fotovoltaico.
            O documento segue as normas ABNT NBR 16690 e pode ser enviado à concessionária.
          </p>
          <Button
            onClick={gerarMemorial}
            disabled={carregando}
            className="w-full"
          >
            {carregando ? 'Gerando...' : 'Gerar Memorial Descritivo'}
          </Button>
        </div>
      ) : (
        <>
          {/* Texto do Memorial */}
          <div className="border border-slate-200 rounded-lg bg-white p-6 overflow-auto max-h-96 font-mono text-sm text-slate-700">
            <pre className="whitespace-pre-wrap">{memorial}</pre>
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
              onClick={baixarDocx}
              icone={Download}
              className="flex-1"
            >
              Baixar TXT
            </Button>
          </div>

          {/* Botão para Regenerar */}
          <button
            onClick={() => setMemorial(null)}
            className="w-full px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg font-medium text-sm border border-blue-200"
          >
            ↻ Regenerar Memorial
          </button>

          {/* Informação */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <p>
              <strong>Próximo passo:</strong> Revise o memorial, faça ajustes se necessário,
              e copie o texto para usar em seus documentos técnicos.
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
