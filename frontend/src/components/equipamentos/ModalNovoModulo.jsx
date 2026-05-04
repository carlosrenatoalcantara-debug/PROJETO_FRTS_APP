import { useState } from 'react'
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function ModalNovoModulo({ modulo, onClose, onSalvar }) {
  const [modo, setModo] = useState('manual')
  const [carregando, setCarregando] = useState(false)
  const [arquivo, setArquivo] = useState(null)
  const [arrastando, setArrastando] = useState(false)
  const [dadosExtraidos, setDadosExtraidos] = useState(null)
  const [erroExtracao, setErroExtracao] = useState(null)
  const [formData, setFormData] = useState(
    modulo || {
      tipo: 'modulo',
      fabricante: '',
      modelo: '',
      especificacoes: {},
      preco_sugerido: 0,
      garantia_produto: { value: 25, unit: 'anos' },
    }
  )

  async function processarDatasheet(file) {
    if (!file.type.includes('pdf')) {
      setErroExtracao('Por favor, selecione um arquivo PDF')
      return
    }

    setCarregando(true)
    setArquivo(file.name)
    setErroExtracao(null)
    setDadosExtraidos(null)

    try {
      const formDataFile = new FormData()
      formDataFile.append('pdf', file)

      const res = await fetch(`${API_URL}/api/datasheet/extrair-datasheet`, {
        method: 'POST',
        body: formDataFile,
      })

      const texto = await res.text()
      let json
      try { json = JSON.parse(texto) } catch {
        throw new Error(`Servidor retornou status ${res.status}. Verifique se o backend está acessível.`)
      }
      if (!res.ok) throw new Error(json.erro || `Erro ${res.status}`)

      // Normaliza campos (datasheetController retorna camelCase, antigo retornava snake_case)
      const dados = json.dados || json

      setDadosExtraidos(dados)
      setFormData((prev) => ({
        ...prev,
        fabricante: dados.marca || dados.fabricante || prev.fabricante,
        modelo: dados.modelo || prev.modelo,
        especificacoes: {
          ...prev.especificacoes,
          potencia_wp: dados.potenciaW || dados.potencia_wp || prev.especificacoes.potencia_wp,
          voc: dados.voc || prev.especificacoes.voc,
          vmp: dados.vmpp || dados.vmp || prev.especificacoes.vmp,
          isc: dados.isc || prev.especificacoes.isc,
          imp: dados.impp || dados.imp || prev.especificacoes.imp,
          eficiencia: dados.eficiencia || prev.especificacoes.eficiencia,
        },
      }))
    } catch (err) {
      console.error('Erro ao extrair datasheet:', err)
      setErroExtracao(err.message)
    } finally {
      setCarregando(false)
    }
  }

  function handleUploadDatasheet(e) {
    const file = e.target.files[0]
    if (file) processarDatasheet(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    setArrastando(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setArrastando(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setArrastando(false)
    const file = e.dataTransfer.files[0]
    if (file) processarDatasheet(file)
  }

  async function handleSalvar() {
    if (!formData.fabricante || !formData.modelo) {
      alert('Preencha fabricante e modelo')
      return
    }

    setCarregando(true)
    try {
      const url = modulo ? `/api/equipamentos/${modulo._id}` : '/api/equipamentos'
      const method = modulo ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        onSalvar()
      } else {
        alert('Erro ao salvar módulo')
      }
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert('Erro ao salvar módulo')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-slate-900">
            {modulo ? 'Editar Módulo' : 'Novo Módulo'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!modulo && (
            <div className="flex gap-2">
              <Button
                onClick={() => setModo('manual')}
                variante={modo === 'manual' ? 'primario' : 'secundario'}
              >
                Preencher Manualmente
              </Button>
              <Button
                onClick={() => setModo('datasheet')}
                variante={modo === 'datasheet' ? 'primario' : 'secundario'}
                className="flex items-center gap-2"
              >
                <Upload size={16} />
                Upload Datasheet
              </Button>
            </div>
          )}

          {modo === 'datasheet' && !modulo && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                  arrastando
                    ? 'border-emerald-500 bg-emerald-50 scale-105'
                    : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
                } ${carregando ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <label className="cursor-pointer block">
                  <div className="flex justify-center mb-4">
                    <div className={`p-4 rounded-full transition-colors ${
                      arrastando
                        ? 'bg-emerald-100'
                        : 'bg-blue-100'
                    }`}>
                      <Upload size={40} className={arrastando ? 'text-emerald-600' : 'text-blue-600'} />
                    </div>
                  </div>
                  {carregando ? (
                    <>
                      <p className="font-semibold text-slate-600 mb-1">Processando datasheet...</p>
                      <p className="text-sm text-slate-500">Extraindo dados do PDF</p>
                    </>
                  ) : arquivo ? (
                    <>
                      <p className="font-semibold text-emerald-600 mb-1">✓ {arquivo}</p>
                      <p className="text-sm text-slate-600">Carregado com sucesso!</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-blue-600 mb-2">
                        {arrastando ? '⬇️ Solte o datasheet aqui' : '📄 Arraste o datasheet para aqui'}
                      </p>
                      <p className="text-sm text-slate-600">ou clique para selecionar</p>
                      <p className="text-xs text-slate-500 mt-2">Formatos aceitos: PDF</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleUploadDatasheet}
                    className="hidden"
                    disabled={carregando}
                  />
                </label>
              </div>

              {erroExtracao && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex gap-3">
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Erro na extração</p>
                    <p className="text-sm text-red-700">{erroExtracao}</p>
                    <p className="text-xs text-red-600 mt-2">Preencha os dados manualmente ou tente outro PDF</p>
                  </div>
                </div>
              )}

              {dadosExtraidos && (
                <div className={`border rounded-lg p-4 ${dadosExtraidos._debug?.campos_encontrados > 2 ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={20} className={dadosExtraidos._debug?.campos_encontrados > 2 ? 'text-emerald-600' : 'text-amber-600'} />
                    <p className="font-semibold text-slate-900">
                      {dadosExtraidos._debug?.campos_encontrados || 0} campos extraídos
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {(dadosExtraidos.marca || dadosExtraidos.fabricante) && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-600">Marca:</span>
                        <span className="font-semibold">{dadosExtraidos.marca || dadosExtraidos.fabricante}</span>
                      </div>
                    )}
                    {dadosExtraidos.modelo && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-600">Modelo:</span>
                        <span className="font-semibold">{dadosExtraidos.modelo}</span>
                      </div>
                    )}
                    {(dadosExtraidos.potenciaW || dadosExtraidos.potencia_wp) && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-600">Potência:</span>
                        <span className="font-semibold">{dadosExtraidos.potenciaW || dadosExtraidos.potencia_wp} Wp</span>
                      </div>
                    )}
                    {dadosExtraidos.voc && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-600">Voc:</span>
                        <span className="font-semibold">{dadosExtraidos.voc} V</span>
                      </div>
                    )}
                    {(dadosExtraidos.vmpp || dadosExtraidos.vmp) && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-600">Vmpp:</span>
                        <span className="font-semibold">{dadosExtraidos.vmpp || dadosExtraidos.vmp} V</span>
                      </div>
                    )}
                    {dadosExtraidos.isc && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-600">Isc:</span>
                        <span className="font-semibold">{dadosExtraidos.isc} A</span>
                      </div>
                    )}
                    {(dadosExtraidos.impp || dadosExtraidos.imp) && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-600">Impp:</span>
                        <span className="font-semibold">{dadosExtraidos.impp || dadosExtraidos.imp} A</span>
                      </div>
                    )}
                    {dadosExtraidos.eficiencia && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-600">Eficiência:</span>
                        <span className="font-semibold">{dadosExtraidos.eficiencia}%</span>
                      </div>
                    )}
                  </div>
                  {dadosExtraidos._debug?.campos_encontrados === 0 && (
                    <p className="text-xs text-amber-700 mt-2">Nenhum campo extraído automaticamente. Preencha manualmente abaixo.</p>
                  )}
                  {dadosExtraidos._debug?.campos_encontrados > 0 && (
                    <p className="text-xs text-slate-500 mt-2">Revise e ajuste os valores se necessário.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Fabricante"
              value={formData.fabricante}
              onChange={(e) => setFormData({ ...formData, fabricante: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Modelo"
              value={formData.modelo}
              onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Potência (Wp)"
              value={formData.especificacoes?.potencia_wp || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  especificacoes: {
                    ...formData.especificacoes,
                    potencia_wp: parseInt(e.target.value),
                  },
                })
              }
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Preço (R$)"
              value={formData.preco_sugerido}
              onChange={(e) => setFormData({ ...formData, preco_sugerido: parseFloat(e.target.value) })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Voc (V)"
              step="0.01"
              value={formData.especificacoes?.voc || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  especificacoes: { ...formData.especificacoes, voc: parseFloat(e.target.value) },
                })
              }
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Vmp (V)"
              step="0.01"
              value={formData.especificacoes?.vmp || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  especificacoes: { ...formData.especificacoes, vmp: parseFloat(e.target.value) },
                })
              }
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button onClick={onClose} variante="secundario">
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
