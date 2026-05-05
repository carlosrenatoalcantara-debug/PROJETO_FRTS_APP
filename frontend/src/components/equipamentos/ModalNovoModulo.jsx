import { useState } from 'react'
import { X, Upload, CheckCircle, AlertCircle, Plus } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function ModalNovoModulo({ modulo, onClose, onSalvar }) {
  const [modo, setModo] = useState('manual')
  const [carregando, setCarregando] = useState(false)
  const [arquivo, setArquivo] = useState(null)
  const [arrastando, setArrastando] = useState(false)
  const [dadosExtraidos, setDadosExtraidos] = useState(null)
  const [variantes, setVariantes] = useState(null)       // array multi-potência
  const [selecionadas, setSelecionadas] = useState([])   // índices selecionados
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
    setVariantes(null)
    setSelecionadas([])

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

      const dados = json.dados || json

      setDadosExtraidos(dados)

      if (json.variantes && json.variantes.length > 1) {
        // Modo multi-variante: seleciona todas por padrão
        setVariantes(json.variantes)
        setSelecionadas(json.variantes.map((_, i) => i))
        // Preenche fabricante e modelo com os dados compartilhados
        setFormData((prev) => ({
          ...prev,
          fabricante: dados.marca || dados.fabricante || prev.fabricante,
          modelo: dados.modelo || prev.modelo,
        }))
      } else {
        // Modo variante única
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
      }
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

  function toggleVariante(idx) {
    setSelecionadas((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    )
  }

  async function salvarVariante(payload) {
    const res = await fetch(`${API_URL}/api/equipamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Erro ao salvar')
  }

  async function handleSalvar() {
    if (!formData.fabricante || !formData.modelo) {
      alert('Preencha fabricante e modelo')
      return
    }

    setCarregando(true)
    try {
      // Modo multi-variante: cria um módulo por variante selecionada
      if (variantes && selecionadas.length > 0) {
        for (const idx of selecionadas) {
          const v = variantes[idx]
          const payload = {
            ...formData,
            tipo: 'modulo',
            modelo: `${formData.modelo}-${v.potenciaW}W`,
            especificacoes: {
              potencia_wp: v.potenciaW,
              voc: v.voc,
              vmp: v.vmpp,
              isc: v.isc,
              imp: v.impp,
              eficiencia: v.eficiencia,
            },
          }
          await salvarVariante(payload)
        }
        onSalvar()
        return
      }

      // Modo variante única ou manual
      const url = modulo ? `${API_URL}/api/equipamentos/${modulo._id}` : `${API_URL}/api/equipamentos`
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
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
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
                    <div className={`p-4 rounded-full transition-colors ${arrastando ? 'bg-emerald-100' : 'bg-blue-100'}`}>
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

              {/* Multi-variante: seleção de potências */}
              {variantes && variantes.length > 1 && (
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={20} className="text-blue-600" />
                    <p className="font-semibold text-slate-900">
                      Série detectada com {variantes.length} variantes de potência
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Selecione quais potências deseja cadastrar como módulos separados:
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {variantes.map((v, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                          selecionadas.includes(idx)
                            ? 'bg-blue-100 border-blue-500 text-blue-900'
                            : 'bg-white border-slate-300 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selecionadas.includes(idx)}
                          onChange={() => toggleVariante(idx)}
                          className="rounded"
                        />
                        <div className="text-sm">
                          <div className="font-bold">{v.potenciaW} Wp</div>
                          {v.voc && <div className="text-xs opacity-70">Voc {v.voc}V</div>}
                          {v.eficiencia && <div className="text-xs opacity-70">η {v.eficiencia}%</div>}
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelecionadas(variantes.map((_, i) => i))}
                      className="text-xs text-blue-700 underline"
                    >
                      Selecionar todas
                    </button>
                    <span className="text-xs text-slate-400">·</span>
                    <button
                      onClick={() => setSelecionadas([])}
                      className="text-xs text-slate-500 underline"
                    >
                      Limpar
                    </button>
                  </div>

                  {/* Tabela resumo das variantes selecionadas */}
                  {selecionadas.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-blue-200">
                            <th className="px-2 py-1 text-left">Wp</th>
                            <th className="px-2 py-1">Voc</th>
                            <th className="px-2 py-1">Vmpp</th>
                            <th className="px-2 py-1">Isc</th>
                            <th className="px-2 py-1">Impp</th>
                            <th className="px-2 py-1">η%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selecionadas.map(idx => {
                            const v = variantes[idx]
                            return (
                              <tr key={idx} className="border-t border-blue-200">
                                <td className="px-2 py-1 font-bold">{v.potenciaW}</td>
                                <td className="px-2 py-1 text-center">{v.voc ?? '—'}</td>
                                <td className="px-2 py-1 text-center">{v.vmpp ?? '—'}</td>
                                <td className="px-2 py-1 text-center">{v.isc ?? '—'}</td>
                                <td className="px-2 py-1 text-center">{v.impp ?? '—'}</td>
                                <td className="px-2 py-1 text-center">{v.eficiencia ?? '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Variante única extraída */}
              {dadosExtraidos && (!variantes || variantes.length <= 1) && (
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
                  <p className="text-xs text-slate-500 mt-2">Revise e ajuste os valores se necessário.</p>
                </div>
              )}
            </div>
          )}

          {/* Campos manuais: sempre visíveis (em modo multi-variante, apenas fabricante/modelo) */}
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
              placeholder={variantes && variantes.length > 1 ? 'Modelo base (ex: ZXMR-144)' : 'Modelo'}
              value={formData.modelo}
              onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {(!variantes || variantes.length <= 1) && (
              <>
                <input
                  type="number"
                  placeholder="Potência (Wp)"
                  value={formData.especificacoes?.potencia_wp || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      especificacoes: { ...formData.especificacoes, potencia_wp: parseInt(e.target.value) },
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
              </>
            )}
            {variantes && variantes.length > 1 && (
              <input
                type="number"
                placeholder="Preço base por módulo (R$)"
                value={formData.preco_sugerido}
                onChange={(e) => setFormData({ ...formData, preco_sugerido: parseFloat(e.target.value) })}
                className="col-span-2 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button onClick={onClose} variante="secundario">
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={carregando || (variantes && variantes.length > 1 && selecionadas.length === 0)}
            >
              {carregando
                ? 'Salvando...'
                : variantes && variantes.length > 1
                ? `Salvar ${selecionadas.length} módulo${selecionadas.length !== 1 ? 's' : ''}`
                : 'Salvar'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
