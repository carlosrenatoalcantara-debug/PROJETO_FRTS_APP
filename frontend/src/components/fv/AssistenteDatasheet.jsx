import { useState } from 'react'
import { Upload, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

export default function AssistenteDatasheet({ onExtrair, tipo = 'painel' }) {
  const [arquivo, setArquivo] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState(null)

  async function processarPDF(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErro('Por favor, selecione um arquivo PDF válido.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setErro('Arquivo muito grande. Máximo 10MB.')
      return
    }

    setArquivo(file)
    setCarregando(true)
    setErro('')
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('pdf', file)

      const res = await fetch(`${API_URL}/api/datasheet/extrair-datasheet`, {
        method: 'POST',
        body: formData,
      })

      // Lê o corpo uma só vez - pode ser JSON ou HTML (erro de servidor/proxy)
      const texto = await res.text()
      let json
      try {
        json = JSON.parse(texto)
      } catch {
        // Resposta não é JSON (ex: página de erro HTML do Windows/IIS)
        if (!res.ok) throw new Error(`Servidor retornou status ${res.status}. Verifique se o backend está rodando.`)
        throw new Error('Resposta inválida do servidor (não é JSON)')
      }

      if (!res.ok) throw new Error(json.erro || `Erro ${res.status}`)

      const dados = json.dados || json
      setResultado(dados)
      onExtrair(dados)
    } catch (err) {
      setErro(`Erro ao processar PDF: ${err.message}`)
      console.error('Erro ao extrair datasheet:', err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
      <div className="flex items-start gap-3 mb-3">
        <Upload size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-slate-900">Ou fazer upload de datasheet (PDF)</h4>
          <p className="text-xs text-slate-600 mt-1">
            Envie o PDF do equipamento e a IA extrairá os dados técnicos automaticamente.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <input
            type="file"
            accept=".pdf"
            onChange={processarPDF}
            disabled={carregando}
            className="hidden"
            id="pdf-upload"
          />
          <label
            htmlFor="pdf-upload"
            className={`block px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer text-center transition-colors ${
              carregando
                ? 'border-blue-300 bg-blue-100'
                : 'border-blue-300 hover:border-blue-500 hover:bg-blue-100'
            }`}
          >
            {carregando ? (
              <div className="flex items-center justify-center gap-2">
                <Loader size={16} className="animate-spin" />
                <span className="text-sm font-medium text-blue-700">Processando PDF...</span>
              </div>
            ) : arquivo ? (
              <div>
                <p className="text-sm font-medium text-blue-700">✓ {arquivo.name}</p>
                <p className="text-xs text-blue-600 mt-1">Clique para trocar</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-blue-700">Clique para selecionar PDF</p>
                <p className="text-xs text-blue-600 mt-1">ou arraste o arquivo aqui</p>
              </div>
            )}
          </label>
        </div>

        {erro && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {erro}
          </div>
        )}

        {resultado && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <CheckCircle size={16} className="text-green-700 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-green-900">Dados extraídos com sucesso!</p>
            </div>
            <div className="text-xs text-green-800 space-y-1">
              {Object.entries(resultado).map(([chave, valor]) => (
                <div key={chave}>
                  <strong>{chave}:</strong> {String(valor)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
