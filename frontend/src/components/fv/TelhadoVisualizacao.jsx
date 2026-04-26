import { useEffect, useRef } from 'react'
import { MapPin, Maximize2 } from 'lucide-react'

const PAINEL_LARGURA = 1.1  // metros
const PAINEL_ALTURA = 2.0   // metros
const ESPACAMENTO = 0.05    // metros entre painéis
const MARGEM_BORDA = 0.5    // metros de borda

export default function TelhadoVisualizacao({
  pontos = [],
  areaTelhado = 0,
  numPaineis = 10,
  inclinacao = 20,
  orientacao = 'N',
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    desenharTelhado()
  }, [pontos, areaTelhado, numPaineis, inclinacao, orientacao])

  function desenharTelhado() {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    const centerX = width / 2
    const centerY = height / 2
    const escala = 30  // pixels por metro

    // Limpar canvas
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, width, height)

    // Grade de fundo
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 0.5
    for (let i = 0; i < width; i += escala) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, height)
      ctx.stroke()
    }
    for (let i = 0; i < height; i += escala) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(width, i)
      ctx.stroke()
    }

    // Desenhar polígono do telhado
    if (pontos.length > 0) {
      const pontosEscalados = pontos.map(p => {
        // Normalizar pontos para caber no canvas
        const x = centerX + (p.lat - pontos[0].lat) * escala * 111000 / 1000
        const y = centerY + (p.lng - pontos[0].lng) * escala * 111000 / 1000
        return { x, y }
      })

      // Desenhar polígono
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
      ctx.strokeStyle = '#1e40af'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(pontosEscalados[0].x, pontosEscalados[0].y)
      pontosEscalados.forEach(p => ctx.lineTo(p.x, p.y))
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Desenhar pontos
      pontosEscalados.forEach((p, i) => {
        ctx.fillStyle = '#1e40af'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // Desenhar distribuição de painéis (simulado no centro)
    desenharPaineis(ctx, centerX, centerY, escala)

    // Desenhar orientação com seta
    desenharOrientacao(ctx, width, height)

    // Desenhar informações de inclinação
    desenharInformacoes(ctx, width, height)
  }

  function desenharPaineis(ctx, centerX, centerY, escala) {
    const painelW = PAINEL_LARGURA * escala
    const painelH = PAINEL_ALTURA * escala
    const espaco = ESPACAMENTO * escala

    const totalPaineis = numPaineis
    let painelsPorLinha = 1
    let numLinhas = totalPaineis

    // Tentar distribuição otimizada
    for (let p = 1; p <= Math.sqrt(totalPaineis); p++) {
      if (totalPaineis % p === 0) {
        painelsPorLinha = p
        numLinhas = totalPaineis / p
      }
    }

    const totalLargura = (painelsPorLinha * painelW) + ((painelsPorLinha - 1) * espaco)
    const totalAltura = (numLinhas * painelH) + ((numLinhas - 1) * espaco)

    const startX = centerX - totalLargura / 2
    const startY = centerY - totalAltura / 2

    // Desenhar painéis
    for (let linha = 0; linha < numLinhas; linha++) {
      for (let col = 0; col < painelsPorLinha; col++) {
        const x = startX + (col * (painelW + espaco))
        const y = startY + (linha * (painelH + espaco))

        // Painel
        ctx.fillStyle = '#1e40af'
        ctx.fillRect(x, y, painelW, painelH)

        // Borda
        ctx.strokeStyle = '#0c2340'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, painelW, painelH)

        // Célula interna (para parecer mais realista)
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 0.5
        const cellW = painelW / 3
        const cellH = painelH / 3
        for (let i = 1; i < 3; i++) {
          ctx.beginPath()
          ctx.moveTo(x + i * cellW, y)
          ctx.lineTo(x + i * cellW, y + painelH)
          ctx.stroke()

          ctx.beginPath()
          ctx.moveTo(x, y + i * cellH)
          ctx.lineTo(x + painelW, y + i * cellH)
          ctx.stroke()
        }
      }
    }

    // Desenhar informação de distribuição
    ctx.fillStyle = '#334155'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillText(`${painelsPorLinha}×${numLinhas} = ${totalPaineis} painéis`, startX, startY - 10)
  }

  function desenharOrientacao(ctx, width, height) {
    const tamanhoSeta = 40
    const x = width - 60
    const y = 50

    // Fundo
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x, y, tamanhoSeta, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Orientações (N, S, L, O)
    ctx.fillStyle = '#1e40af'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const angulos = { 'N': 0, 'L': Math.PI / 2, 'S': Math.PI, 'O': Math.PI * 1.5 }
    for (const [dir, angulo] of Object.entries(angulos)) {
      const px = x + Math.cos(angulo - Math.PI / 2) * (tamanhoSeta - 10)
      const py = y + Math.sin(angulo - Math.PI / 2) * (tamanhoSeta - 10)
      ctx.fillText(dir, px, py)
    }

    // Seta principal (Norte)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y - tamanhoSeta + 10)
    ctx.lineTo(x, y - 5)
    ctx.stroke()

    // Ponta da seta
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.moveTo(x - 4, y - 8)
    ctx.lineTo(x + 4, y - 8)
    ctx.lineTo(x, y - 2)
    ctx.closePath()
    ctx.fill()
  }

  function desenharInformacoes(ctx, width, height) {
    const x = 20
    let y = 20

    ctx.fillStyle = '#334155'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'

    const infos = [
      `Área: ${areaTelhado} m²`,
      `Painéis: ${numPaineis}×`,
      `Inclinação: ${inclinacao}°`,
      `Orientação: ${orientacao}`,
    ]

    infos.forEach(info => {
      ctx.fillText(info, x, y)
      y += 16
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-slate-500" />
          <h4 className="font-semibold text-slate-900">Visualização do Telhado</h4>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <Maximize2 size={14} />
          Clique para expandir
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="w-full h-auto border-b border-slate-100"
        />
      </div>

      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="bg-blue-50 p-2 rounded border border-blue-200">
          <p className="text-xs text-slate-600">Área Total</p>
          <p className="font-bold text-blue-900">{areaTelhado} m²</p>
        </div>
        <div className="bg-indigo-50 p-2 rounded border border-indigo-200">
          <p className="text-xs text-slate-600">Painéis</p>
          <p className="font-bold text-indigo-900">{numPaineis}×</p>
        </div>
        <div className="bg-purple-50 p-2 rounded border border-purple-200">
          <p className="text-xs text-slate-600">Inclinação</p>
          <p className="font-bold text-purple-900">{inclinacao}°</p>
        </div>
        <div className="bg-orange-50 p-2 rounded border border-orange-200">
          <p className="text-xs text-slate-600">Orientação</p>
          <p className="font-bold text-orange-900">{orientacao}</p>
        </div>
      </div>

      <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
        <p><strong>Dimensões do painel:</strong> {PAINEL_LARGURA}m × {PAINEL_ALTURA}m</p>
        <p><strong>Espaçamento:</strong> {ESPACAMENTO}m entre painéis</p>
        <p><strong>Margem de borda:</strong> {MARGEM_BORDA}m</p>
      </div>
    </div>
  )
}
