import { useState } from 'react'
import { Download, RefreshCw, AlertCircle } from 'lucide-react'
import Button from '../ui/Button'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

export default function UnifilarEV({ dadosSimulacao, projetoId }) {
  const [svg, setSvg] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function gerarUnifilar() {
    setCarregando(true)
    setErro('')

    try {
      const payload = {
        potencia_carregador: dadosSimulacao?.potencia_carregador || 7,
        tensao: dadosSimulacao?.tensao || 'trifasico',
        cabo: {
          bitola: dadosSimulacao?.bitola_cabo || '6mm²',
          comprimento: dadosSimulacao?.comprimento_cabo || '10m',
        },
        disjuntor: {
          corrente: dadosSimulacao?.corrente_disjuntor || '32A',
        },
        dr: '30mA',
      }

      const res = await fetch(`${API_URL}/api/unifilar/ev/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const erroData = await res.json()
        throw new Error(erroData.erro || 'Erro ao gerar unifilar')
      }

      const dados = await res.json()
      setSvg(dados.svg)
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setCarregando(false)
    }
  }

  function downloadPNG() {
    if (!svg) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `unifilar-ev-${projetoId || 'projeto'}.png`
      link.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(svg)
  }

  function downloadPDF() {
    if (!svg) return

    const link = document.createElement('a')
    link.href = 'data:application/octet-stream;base64,' + btoa(svg)
    link.download = `unifilar-ev-${projetoId || 'projeto'}.svg`
    link.click()
  }

  return (
    <div className="space-y-4">
      {!svg ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
          <p className="text-sm text-slate-700">
            Clique em "Gerar Unifilar" para criar um diagrama técnico do circuito elétrico de carregamento
            com all os componentes de proteção e distribuição.
          </p>
          <Button
            onClick={gerarUnifilar}
            disabled={carregando}
            className="w-full"
            icone={carregando ? undefined : Download}
          >
            {carregando ? 'Gerando diagrama...' : 'Gerar Unifilar Automaticamente'}
          </Button>
        </div>
      ) : (
        <>
          {/* SVG Container */}
          <div className="border border-slate-200 rounded-lg overflow-auto bg-white">
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3">
            <Button variante="secundario" onClick={gerarUnifilar} icone={RefreshCw}>
              Regenerar
            </Button>
            <Button onClick={downloadPNG} icone={Download}>
              Baixar PNG
            </Button>
            <Button onClick={downloadPDF} icone={Download}>
              Baixar SVG
            </Button>
          </div>

          {/* Especificações */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-3">Especificações do Diagrama</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-600">Potência Carregador</p>
                <p className="font-bold text-slate-900">{dadosSimulacao?.potencia_carregador || 0} kW</p>
              </div>
              <div>
                <p className="text-slate-600">Tensão</p>
                <p className="font-bold text-slate-900">{dadosSimulacao?.tensao === 'monofasico' ? '127V' : '220/380V'}</p>
              </div>
              <div>
                <p className="text-slate-600">Bitola Cabo</p>
                <p className="font-bold text-slate-900">{dadosSimulacao?.bitola_cabo || '6mm²'}</p>
              </div>
              <div>
                <p className="text-slate-600">Comprimento</p>
                <p className="font-bold text-slate-900">{dadosSimulacao?.comprimento_cabo || '10m'}</p>
              </div>
              <div>
                <p className="text-slate-600">Disjuntor</p>
                <p className="font-bold text-slate-900">{dadosSimulacao?.corrente_disjuntor || '32A'}</p>
              </div>
              <div>
                <p className="text-slate-600">DR</p>
                <p className="font-bold text-slate-900">30mA</p>
              </div>
            </div>
          </div>
        </>
      )}

      {erro && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {erro}
        </div>
      )}

      {/* Informação */}
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
        <p>
          <strong>Conformidade NBR:</strong> O diagrama segue normas de segurança (NBR 16690, NBR IEC 61936)
          com proteção diferencial 30mA, disjuntor dimensionado e cabo adequado para a corrente.
        </p>
      </div>
    </div>
  )
}
