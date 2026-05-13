import { useState, useRef } from 'react'
import { X, Upload, Download, Loader } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'

export default function UploadParecerModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [resultado, setResultado] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setError('Por favor, selecione um arquivo PDF')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Selecione um arquivo PDF')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const formData = new FormData()
      formData.append('pdf', file)

      const response = await fetch('/api/parecer-acesso/extrair', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const erro = await response.json()
        throw new Error(erro.erro || 'Erro ao processar Parecer')
      }

      const dados = await response.json()
      setResultado(dados)
      setSuccess(`Parecer processado com sucesso! Projeto "${dados.projeto.nome}" criado.`)
      setFile(null)

      // Callback after 2 seconds to allow user to see the message
      setTimeout(() => {
        onSuccess?.(dados.projeto)
      }, 2000)
    } catch (err) {
      console.error('Erro:', err)
      setError(err.message)
      setSuccess(null)
    } finally {
      setLoading(false)
    }
  }

  const downloadUnifilar = () => {
    if (!resultado?.svg) return

    // Create SVG file download
    const element = document.createElement('a')
    const file = new Blob([resultado.svg], { type: 'image/svg+xml' })
    element.href = URL.createObjectURL(file)
    element.download = `unifilar_${resultado.projeto.nome || 'diagrama'}_${new Date().toISOString().split('T')[0]}.svg`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(element.href)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Upload Parecer de Acesso</h2>
              <p className="text-sm text-slate-500 mt-1">
                Selecione um Parecer PDF da Cosern para criar projeto automaticamente
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-600" />
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              ❌ {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              ✅ {success}
            </div>
          )}

          {/* Upload Area */}
          {!resultado && (
            <div className="space-y-4 mb-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="font-semibold text-slate-900">Clique para selecionar PDF</p>
                <p className="text-sm text-slate-500 mt-1">ou arraste e solte aqui</p>
                <p className="text-xs text-slate-400 mt-2">
                  Suporta: PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO (PDF)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {file && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900">Arquivo selecionado:</p>
                  <p className="text-sm text-blue-700 break-words">{file.name}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Processar Parecer
                    </>
                  )}
                </Button>
                <Button
                  variante="secundario"
                  onClick={() => {
                    setFile(null)
                    setError(null)
                  }}
                  disabled={!file}
                >
                  Limpar
                </Button>
              </div>
            </div>
          )}

          {/* Results */}
          {resultado && (
            <div className="space-y-6">
              {/* Project Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Projeto Criado</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">Nome</p>
                    <p className="font-semibold text-slate-900">{resultado.projeto.nome}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Cliente</p>
                    <p className="font-semibold text-slate-900">{resultado.cliente.nome}</p>
                  </div>
                  {resultado.cliente.novo && (
                    <div className="col-span-2 bg-blue-50 text-blue-700 p-2 rounded">
                      ✨ Novo cliente criado automaticamente
                    </div>
                  )}
                </div>
              </div>

              {/* Extracted Equipment */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Equipamentos Extraídos</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-slate-600">Painéis Solares</p>
                    <p className="font-semibold text-slate-900">
                      {resultado.extractedData.equipamento.paineis.marca || 'Não identificado'} -{' '}
                      {resultado.extractedData.equipamento.paineis.modelo || 'N/A'} (
                      {resultado.extractedData.equipamento.paineis.potencia_w || 'N/A'}W x{
                        resultado.extractedData.quantidade_paineis || 1
                      })
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Inversor</p>
                    <p className="font-semibold text-slate-900">
                      {resultado.extractedData.equipamento.inversor.marca || 'Não identificado'} -{' '}
                      {resultado.extractedData.equipamento.inversor.modelo || 'N/A'} (
                      {resultado.extractedData.equipamento.inversor.potencia_kw || 'N/A'}kW)
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Rede</p>
                    <p className="font-semibold text-slate-900">
                      {resultado.extractedData.instalacao.fase_tensao || 'N/A'} -{' '}
                      {resultado.extractedData.instalacao.distribuidora || 'Cosern'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Database Status */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Status de Busca em BD</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${resultado.resumo.painel_encontrado_db ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                    <span>Painel na base de dados: {resultado.resumo.painel_encontrado_db ? '✓ Encontrado' : '⚠️ Não encontrado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${resultado.resumo.inversor_encontrado_db ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                    <span>Inversor na base de dados: {resultado.resumo.inversor_encontrado_db ? '✓ Encontrado' : '⚠️ Não encontrado'}</span>
                  </div>
                </div>
              </div>

              {/* Unifilar Diagram */}
              {resultado.svg && resultado.resumo.unifilar_gerado && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <h3 className="font-semibold text-slate-900 p-4 bg-slate-50 border-b">
                    Diagrama Unifilar
                  </h3>
                  <div className="p-4 bg-white overflow-auto max-h-96">
                    <div dangerouslySetInnerHTML={{ __html: resultado.svg }} />
                  </div>
                  <div className="p-4 bg-slate-50 border-t flex gap-2">
                    <Button onClick={downloadUnifilar} icone={Download} variante="secundario">
                      Baixar SVG
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={onClose} className="flex-1">
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
