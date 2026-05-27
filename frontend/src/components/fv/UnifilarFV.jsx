import { useState } from 'react'
import { Download, RefreshCw, Zap } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Button from '../ui/Button'
import { gerarUnifilarSVG, baixarUnifilarSVG } from '@/utils/gerarUnifilarSVG'

export default function UnifilarFV({ projeto }) {
  const [unifilar, setUnifilar] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  async function handleGerarUnifilar() {
    try {
      setCarregando(true)
      setErro(null)

      // Gerador SVG local — não depende de backend (rota antiga
      // /api/projetos-fv/:id/unifilar/gerar não existe). O backend possui
      // /api/unifilar/fv/gerar mas com shape de payload diferente; pode ser
      // exposto futuramente. Por ora, geramos no client.
      const svg = gerarUnifilarSVG(projeto)
      if (!svg) throw new Error('Não foi possível gerar o unifilar com os dados disponíveis')
      setUnifilar(svg)
    } catch (err) {
      setErro(err.message || 'Erro ao gerar unifilar')
    } finally {
      setCarregando(false)
    }
  }

  function handleBaixarSVG() {
    if (!unifilar) return
    baixarUnifilarSVG(unifilar, `unifilar_${projeto._id}.svg`)
  }

  function handleBaixarPNG() {
    if (!unifilar) return
    // Converte SVG para PNG via canvas
    const img = new Image()
    const blob = new Blob([unifilar], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = 1400
      canvas.height = img.naturalHeight || 950
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const link = document.createElement('a')
      link.download = `unifilar_${projeto._id}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Diagrama Unifilar</h2>
          <p className="text-sm text-slate-600 mt-1">Esquema técnico do sistema fotovoltaico</p>
        </div>
        <Zap size={32} className="text-yellow-500" />
      </div>

      {projeto.dimensionamento && (
        <Card>
          <CardHeader>Dados do Sistema</CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-slate-600">Potência</p>
                <p className="text-2xl font-bold text-blue-600">{projeto.dimensionamento.potenciaArredondada} kWp</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600">Painéis</p>
                <p className="text-2xl font-bold text-blue-600">{projeto.dimensionamento.numPaineis}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600">Inversores</p>
                <p className="text-2xl font-bold text-blue-600">{projeto.dimensionamento.numInversores}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600">Strings</p>
                <p className="text-2xl font-bold text-blue-600">{projeto.dimensionamento.numStrings}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleGerarUnifilar}
          disabled={carregando}
          className="flex items-center gap-2"
        >
          <RefreshCw size={18} className={carregando ? 'animate-spin' : ''} />
          {carregando ? 'Gerando...' : 'Gerar Unifilar Automático'}
        </Button>
      </div>

      {erro && (
        <Card className="bg-red-50 border border-red-200">
          <CardBody>
            <p className="text-red-700">⚠️ {erro}</p>
          </CardBody>
        </Card>
      )}

      {unifilar && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <span>Diagrama Técnico</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variante="secundario"
                onClick={handleBaixarSVG}
                className="flex items-center gap-1"
              >
                <Download size={16} />
                SVG
              </Button>
              <Button
                size="sm"
                variante="secundario"
                onClick={handleBaixarPNG}
                className="flex items-center gap-1"
              >
                <Download size={16} />
                PNG
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            {/* FV-08: usar <div> e não <svg> para evitar SVG aninhado */}
            <div
              className="overflow-auto bg-slate-50 rounded-lg border border-slate-200 p-4"
              dangerouslySetInnerHTML={{ __html: unifilar }}
            />
          </CardBody>
        </Card>
      )}

      {!unifilar && !carregando && (
        <Card className="bg-slate-50 border-2 border-dashed border-slate-300">
          <CardBody className="text-center py-12">
            <Zap size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-600">Clique em "Gerar Unifilar Automático" para criar o diagrama técnico</p>
            <p className="text-sm text-slate-500 mt-2">O diagrama mostrará toda a configuração elétrica do sistema</p>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
