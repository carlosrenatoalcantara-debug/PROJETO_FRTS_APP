import { useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import Button from '../../ui/Button'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

const CREAS_POR_ESTADO = {
  'SP': 'https://www.creasp.org.br',
  'RJ': 'https://www.crea-rj.org.br',
  'MG': 'https://www.crea-mg.org.br',
  'RN': 'https://www.crarn.org.br',
  'CE': 'https://www.cearea.org.br',
  'BA': 'https://www.crea-ba.org.br',
  'PE': 'https://crea-pe.org.br',
  'RS': 'https://www.crea-rs.org.br',
}

export default function DadosART({ projetoId, projeto, estado }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  async function obterDados() {
    setCarregando(true)
    setErro('')

    try {
      const res = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/homologacao/art`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projeto }),
      })

      if (!res.ok) {
        throw new Error('Erro ao obter dados ART')
      }

      const resposta = await res.json()
      setDados(resposta.dados)
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setCarregando(false)
    }
  }

  function copiarTodosDados() {
    const texto = Object.entries(dados)
      .map(([chave, valor]) => {
        if (Array.isArray(valor)) {
          return `${chave}: ${valor.join(', ')}`
        }
        return `${chave}: ${valor}`
      })
      .join('\n')

    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const urlCREA = CREAS_POR_ESTADO[estado] || 'https://www.confea.org.br'

  return (
    <div className="space-y-4">
      {!dados ? (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 space-y-4">
          <p className="text-sm text-slate-700">
            Obtenha todos os dados necessários para preenchimento da ART (Anotação de Responsabilidade Técnica)
            no CREA de sua região. A ART deve ser registrada ANTES de iniciar a instalação.
          </p>
          <Button
            onClick={obterDados}
            disabled={carregando}
            className="w-full"
          >
            {carregando ? 'Carregando...' : 'Obter Dados para ART'}
          </Button>
        </div>
      ) : (
        <>
          {/* Campos da ART */}
          <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-4">
            <h4 className="font-semibold text-slate-900 mb-4">Informações para Preenchimento da ART</h4>

            {Object.entries(dados).map(([chave, valor]) => (
              <div key={chave} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {chave.replace(/_/g, ' ')}
                </p>
                {Array.isArray(valor) ? (
                  <div className="mt-1 space-y-1">
                    {valor.map((item, idx) => (
                      <p key={idx} className="text-sm text-slate-900">
                        • {item}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-slate-900 mt-1">{valor}</p>
                )}
              </div>
            ))}
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3">
            <Button
              onClick={copiarTodosDados}
              variante="secundario"
              icone={Copy}
              className="flex-1"
            >
              {copiado ? '✓ Copiado!' : 'Copiar Todos os Dados'}
            </Button>
            <Button
              as="a"
              href={urlCREA}
              target="_blank"
              rel="noopener noreferrer"
              icone={ExternalLink}
              className="flex-1"
            >
              Ir para CREA {estado}
            </Button>
          </div>

          {/* Botão para Obter Novamente */}
          <button
            onClick={() => setDados(null)}
            className="w-full px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg font-medium text-sm border border-purple-200"
          >
            ↻ Recarregar Dados
          </button>

          {/* Instruções */}
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3 text-xs text-purple-800">
            <p>
              <strong>Como registrar a ART:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Acesse o site do CREA de sua região</li>
              <li>Faça login com seu cadastro profissional</li>
              <li>Selecione "Nova ART" ou "Registrar Atividade"</li>
              <li>Preencha com os dados acima</li>
              <li>Imprima e arquive o comprovante</li>
              <li>Envie à concessionária junto com os demais documentos</li>
            </ol>
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
