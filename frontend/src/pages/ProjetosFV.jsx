import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { Plus, Sun, Filter, Eye, Calculator, Upload, Download, X, Loader } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import DashboardComercial from '../components/fv/DashboardComercial'

const corStatus = {
  'concluido': 'verde',
  'em_execucao': 'azul',
  'aguardando': 'amarelo',
  'proposta': 'cinza',
  'em_simulacao': 'azul',
  'rascunho': 'cinza',
  'default': 'cinza'
}

const statusLabel = {
  'concluido': 'Concluído',
  'em_execucao': 'Em Execução',
  'aguardando': 'Aguardando',
  'proposta': 'Proposta',
  'em_simulacao': 'Em Simulação',
  'rascunho': 'Rascunho',
}

export default function ProjetosFV() {
  const navigate = useNavigate()
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalPotencia, setTotalPotencia] = useState(0)

  // Parecer Upload States
  const [showParecerUpload, setShowParecerUpload] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(null)
  const [resultado, setResultado] = useState(null)
  const fileInputRef = useRef(null)

  // Load projects from API
  useEffect(() => {
    carregarProjetos()
  }, [])

  const carregarProjetos = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/projetos-fv')
      if (!response.ok) throw new Error('Erro ao carregar projetos')

      const dados = await response.json()

      // Filter out test projects (those with fake-test tag)
      const projetosReais = (Array.isArray(dados) ? dados : dados.projetos || []).filter(
        p => !p.tags?.includes('fake-test')
      )

      setProjetos(projetosReais)

      // Calculate total power
      const total = projetosReais.reduce((sum, p) => {
        const potencia = parseFloat(p.potencia_kwp) || 0
        return sum + potencia
      }, 0)
      setTotalPotencia(total)

      setError(null)
    } catch (err) {
      console.error('Erro ao carregar projetos:', err)
      setError(err.message)
      setProjetos([])
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setUploadError('Por favor, selecione um arquivo PDF')
        return
      }
      setFile(selectedFile)
      setUploadError(null)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.classList.add('border-blue-500', 'bg-blue-100')
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0]
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setUploadError('Por favor, selecione um arquivo PDF')
        return
      }
      setFile(selectedFile)
      setUploadError(null)
    }
  }

  const handleUploadParecer = async () => {
    if (!file) {
      setUploadError('Selecione um arquivo PDF')
      return
    }

    try {
      setUploading(true)
      setUploadError(null)

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
      setUploadSuccess(`✅ Parecer processado com sucesso! Projeto "${dados.projeto.nome}" criado.`)
      setFile(null)

      // Reload projects
      setTimeout(() => {
        carregarProjetos()
      }, 1500)
    } catch (err) {
      console.error('Erro:', err)
      setUploadError(err.message)
      setUploadSuccess(null)
    } finally {
      setUploading(false)
    }
  }

  const downloadUnifilar = () => {
    if (!resultado?.svg) return

    const element = document.createElement('a')
    const blob = new Blob([resultado.svg], { type: 'image/svg+xml' })
    element.href = URL.createObjectURL(blob)
    element.download = `unifilar_${resultado.projeto.nome || 'diagrama'}_${new Date().toISOString().split('T')[0]}.svg`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(element.href)
  }

  const formatarPotencia = (kwp) => {
    if (!kwp) return 'N/A'
    return kwp >= 1 ? `${kwp.toFixed(1)} kWp` : `${(kwp * 1000).toFixed(0)} Wp`
  }

  const calcularPaineis = (projeto) => {
    if (projeto.equipamentos?.paineis?.[0]?.quantidade) {
      return projeto.equipamentos.paineis[0].quantidade
    }
    return 'N/A'
  }

  const calcularInversores = (projeto) => {
    if (projeto.equipamentos?.inversor?.marca) {
      return 1
    }
    return 'N/A'
  }

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-100">
            <Sun size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total de potência</p>
            <p className="font-bold text-slate-900">{totalPotencia.toFixed(1)} kWp instalados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" icone={Filter} tamanho="sm">Filtros</Button>
          <Button variante="secundario" icone={Calculator} tamanho="sm" onClick={() => navigate('/projetos-fv/simulacao')}>
            Dimensionar
          </Button>
          <Button icone={Plus} tamanho="sm" onClick={() => navigate('/projetos-fv/novo')}>
            Novo Projeto FV
          </Button>
        </div>
      </div>

      {/* S4.2: Dashboard comercial (aparece quando há propostas com dados comerciais) */}
      <DashboardComercial projetos={projetos} />

      {/* Parecer Upload Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Upload size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Parecer de Acesso</h3>
                <p className="text-sm text-slate-600">Faça upload do parecer em PDF para gerar projeto e diagrama automático</p>
              </div>
            </div>
            {resultado && (
              <button
                onClick={() => setResultado(null)}
                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-600" />
              </button>
            )}
          </div>
        </CardHeader>

        <CardBody className="space-y-4">
          {/* Upload Area */}
          {!resultado ? (
            <>
              {uploadError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  ❌ {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {uploadSuccess}
                </div>
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-100 transition-all"
              >
                <Upload size={40} className="mx-auto text-blue-400 mb-3" />
                <p className="font-semibold text-slate-900 text-lg">Clique para selecionar PDF</p>
                <p className="text-sm text-slate-500 mt-1">ou arraste e solte aqui</p>
                <p className="text-xs text-slate-400 mt-2">Parecer de Acesso para Conexão de Mini e Microgeração</p>
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
                  <p className="text-sm font-semibold text-blue-900">📄 {file.name}</p>
                  <p className="text-xs text-blue-600 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleUploadParecer}
                  disabled={!file || uploading}
                  className="flex-1"
                >
                  {uploading ? (
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
                    setUploadError(null)
                  }}
                  disabled={!file}
                >
                  Limpar
                </Button>
              </div>
            </>
          ) : (
            /* Results Display */
            <div className="space-y-4">
              {/* Project Info */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">📊 Projeto Criado</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-600 text-xs">Nome</p>
                    <p className="font-semibold text-slate-900">{resultado.projeto.nome}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-xs">Cliente</p>
                    <p className="font-semibold text-slate-900">{resultado.cliente.nome}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-xs">Painéis</p>
                    <p className="font-semibold text-slate-900">
                      {resultado.extractedData.equipamento.paineis.marca} {resultado.extractedData.quantidade_paineis}x
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-xs">Inversor</p>
                    <p className="font-semibold text-slate-900">
                      {resultado.extractedData.equipamento.inversor.marca} {resultado.extractedData.equipamento.inversor.potencia_kw}kW
                    </p>
                  </div>
                </div>
              </div>

              {/* Unifilar Diagram */}
              {resultado.svg && resultado.resumo.unifilar_gerado && (
                <div className="border-2 border-blue-200 rounded-lg overflow-hidden bg-white">
                  <div className="bg-blue-50 p-4 border-b border-blue-200">
                    <h4 className="font-semibold text-slate-900">⚡ Diagrama Unifilar</h4>
                  </div>
                  <div className="p-4 overflow-auto max-h-96 bg-white">
                    <div dangerouslySetInnerHTML={{ __html: resultado.svg }} className="flex justify-center" />
                  </div>
                  <div className="p-4 bg-blue-50 border-t border-blue-200">
                    <Button onClick={downloadUnifilar} variante="secundario" icone={Download} className="w-full">
                      Baixar Diagrama (SVG)
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={() => {
                  setResultado(null)
                  setFile(null)
                }}
                variante="secundario"
                className="w-full"
              >
                Processar Outro Parecer
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Projects List */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">
            Projetos Fotovoltaicos{' '}
            <span className="text-slate-400 font-normal text-sm ml-1">({projetos.length})</span>
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          {loading && (
            <div className="p-8 text-center text-slate-500">
              Carregando projetos...
            </div>
          )}

          {error && (
            <div className="p-8 bg-amber-50 border border-amber-200 rounded text-center">
              <div className="text-amber-700 font-medium mb-1">⚠️ Servidor temporariamente indisponível</div>
              <div className="text-slate-500 text-sm mb-3">Os projetos serão exibidos assim que a conexão for restabelecida.</div>
              <button
                onClick={carregarProjetos}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && projetos.length === 0 && !error && (
            <div className="p-8 text-center text-slate-500">
              Nenhum projeto cadastrado. Use o Parecer de Acesso acima para criar um automaticamente.
            </div>
          )}

          {!loading && projetos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Projeto','Cliente','Potência','Painéis','Inversores','Status',''].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {projetos.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{p.nome}</td>
                      <td className="px-6 py-4 text-slate-600">{p.cliente_nome || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{formatarPotencia(p.potencia_kwp)}</td>
                      <td className="px-6 py-4 text-slate-600">{calcularPaineis(p)}</td>
                      <td className="px-6 py-4 text-slate-600">{calcularInversores(p)}</td>
                      <td className="px-6 py-4">
                        <Badge cor={corStatus[p.status] || corStatus.default}>
                          {statusLabel[p.status] || p.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variante="fantasma" tamanho="sm" icone={Eye} onClick={() => navigate(`/projetos-fv/${p._id}`)}>
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
