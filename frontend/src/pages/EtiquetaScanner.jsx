// P1-COMMISSIONING-SCAN-01 — Scanner de etiqueta (câmera): QR → OCR → manual.
// Captura serial/SSID/senha/MAC e devolve via onCapture(campos). NÃO grava nada (o salvar
// é o /comissionar). Reutiliza o endpoint /api/ativos/scan.
import { useEffect, useRef, useState } from 'react'

export default function EtiquetaScanner({ fabricante, onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [estado, setEstado] = useState('iniciando') // iniciando | pronto | processando | sem_camera
  const [msg, setMsg] = useState(null)
  const [paste, setPaste] = useState('')
  const temBarcode = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    let cancelado = false
    let detector = null, loopId = null
    async function iniciar() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
        setEstado('pronto')
        // QR automático (Android/Chrome). iOS Safari cai no "Capturar foto" (OCR).
        if (temBarcode) {
          detector = new window.BarcodeDetector({ formats: ['qr_code', 'data_matrix'] })
          const tick = async () => {
            if (cancelado || !videoRef.current) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes && codes.length) { await enviar({ texto: codes[0].rawValue }); return }
            } catch { /* frame não pronto */ }
            loopId = requestAnimationFrame(tick)
          }
          loopId = requestAnimationFrame(tick)
        }
      } catch {
        setEstado('sem_camera')
        setMsg('Câmera indisponível — cole o conteúdo do QR ou digite manualmente.')
      }
    }
    iniciar()
    return () => { cancelado = true; if (loopId) cancelAnimationFrame(loopId); parar() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function parar() {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }

  async function enviar({ texto, foto }) {
    setEstado('processando'); setMsg(null)
    try {
      let r
      if (foto) {
        const fd = new FormData(); fd.append('foto', foto, 'etiqueta.jpg'); if (fabricante) fd.append('fabricante', fabricante)
        r = await fetch('/api/ativos/scan', { method: 'POST', body: fd })
      } else {
        r = await fetch('/api/ativos/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, fabricante }) })
      }
      const j = await r.json()
      if (!r.ok) { setMsg(j.erro || 'Falha ao ler'); setEstado('pronto'); return }
      const n = Object.keys(j.campos || {}).length
      if (n === 0) { setMsg('Nada reconhecido — aproxime a etiqueta ou use OCR/foto.'); setEstado('pronto'); return }
      parar()
      onCapture(j.campos, j.fonte)   // devolve para o formulário (usuário confirma)
    } catch { setMsg('Falha de conexão'); setEstado('pronto') }
  }

  async function tirarFoto() {
    const v = videoRef.current; if (!v) return
    const cv = document.createElement('canvas')
    cv.width = v.videoWidth || 720; cv.height = v.videoHeight || 1280
    cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height)
    cv.toBlob((b) => b && enviar({ foto: b }), 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden">
        <div className="p-3 flex items-center justify-between border-b">
          <span className="font-semibold text-slate-800">Escanear etiqueta</span>
          <button onClick={() => { parar(); onClose() }} className="text-slate-400 text-xl leading-none px-2">✕</button>
        </div>

        {estado !== 'sem_camera' && (
          <div className="relative bg-black">
            <video ref={videoRef} playsInline muted className="w-full max-h-[55vh] object-contain" />
            <div className="absolute inset-0 pointer-events-none border-[3px] border-emerald-400/70 m-8 rounded-xl" />
            {estado === 'processando' && <div className="absolute inset-0 flex items-center justify-center text-white">Lendo…</div>}
          </div>
        )}

        <div className="p-4 space-y-3">
          {msg && <div className="text-sm text-amber-700 bg-amber-50 rounded-lg p-2">{msg}</div>}
          <div className="text-xs text-slate-500 text-center">
            {temBarcode ? 'QR é lido automaticamente. ' : ''}Sem QR? Use a foto (OCR) ou cole o texto.
          </div>

          {estado !== 'sem_camera' && (
            <button onClick={tirarFoto} disabled={estado === 'processando'}
              className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50">
              📷 Capturar foto (OCR)
            </button>
          )}

          {/* Fallback universal: colar conteúdo do QR / texto da etiqueta */}
          <div>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={2}
              placeholder="Ou cole aqui o conteúdo do QR / texto da etiqueta"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <button onClick={() => paste.trim() && enviar({ texto: paste })}
              className="mt-2 w-full border border-emerald-600 text-emerald-700 font-semibold py-2 rounded-xl">
              Ler texto colado
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
