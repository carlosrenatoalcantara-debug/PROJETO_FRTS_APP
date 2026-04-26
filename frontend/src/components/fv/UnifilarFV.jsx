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

      const resposta = await fetch(`/api/projetos-fv/${projeto._id}/unifilar/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!resposta.ok) throw new Error('Erro ao gerar unifilar')

      const { svg } = await resposta.json()
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

  function handleBaixarPDF() {
    if (!unifilar) return
    const blob = new Blob([unifilar], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `unifilar_${projeto._id}.pdf`
    link.click()
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
                onClick={handleBaixarPDF}
                className="flex items-center gap-1"
              >
                <Download size={16} />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="overflow-auto bg-slate-50 rounded-lg border border-slate-200 p-4">
              <svg
                dangerouslySetInnerHTML={{ __html: unifilar }}
                className="mx-auto w-full max-w-4xl"
              />
            </div>
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
