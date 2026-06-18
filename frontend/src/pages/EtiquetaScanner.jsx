// P1-COMMISSIONING-SCAN-01 — Scanner de etiqueta (câmera): QR → OCR → manual.
// P1-SCANNER-GALLERY-01 — upload de galeria: <input type="file"> → OCR (mesmo endpoint).
// P1-SCANNER-IOS-QR-01 — fallback jsQR para iOS/Safari (sem BarcodeDetector): lê QR ao vivo,
//   na foto e na galeria, mantendo OCR como segundo nível. NÃO altera parser/backend/endpoint.
// Captura serial/SSID/senha/MAC e devolve via onCapture(campos). NÃO grava nada (o salvar
// é o /comissionar). Reutiliza o endpoint /api/ativos/scan.
import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

// ── Decodificação QR (pura) ───────────────────────────────────────────────
// jsQR opera sobre ImageData (canvas). Usado quando BarcodeDetector não existe
// (iOS Safari) e como QR-first na foto/galeria antes de cair no OCR.
function lerQRDeContexto(ctx, w, h) {
  try {
    const img = ctx.getImageData(0, 0, w, h)
    const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
    return res?.data || null
  } catch { return null }
}

// Frame do vídeo → canvas reduzido (máx 640px) → QR. Reduzir mantém o loop fluido no iPhone.
function lerQRDoVideo(video, canvas) {
  const w = video.videoWidth, h = video.videoHeight
  if (!w || !h) return null
  const escala = Math.min(1, 640 / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * escala)), ch = Math.max(1, Math.round(h * escala))
  canvas.width = cw; canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(video, 0, 0, cw, ch)
  return lerQRDeContexto(ctx, cw, ch)
}

// Carrega um File/Blob de imagem num HTMLImageElement (para decodificar QR da galeria).
function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => { URL.revokeObjectURL(url); resolve(im) }
    im.onerror = (err) => { URL.revokeObjectURL(url); reject(err) }
    im.src = url
  })
}

export default function EtiquetaScanner({ fabricante, onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const galleryRef = useRef(null)
  const [estado, setEstado] = useState('iniciando') // iniciando | pronto | processando | sem_camera
  const [msg, setMsg] = useState(null)
  const [paste, setPaste] = useState('')
  const temBarcode = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    let cancelado = false
    let detector = null, loopId = null, timerId = null
    async function iniciar() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
        setEstado('pronto')
        // QR automático ao vivo. Android/Chrome usa BarcodeDetector; iOS Safari usa jsQR.
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
        } else {
          // P1-SCANNER-IOS-QR-01: fallback iOS — decodifica QR via jsQR sobre o frame do vídeo.
          const cv = document.createElement('canvas')
          const tick = () => {
            if (cancelado || !videoRef.current) return
            const texto = lerQRDoVideo(videoRef.current, cv)
            if (texto) { enviar({ texto }); return }
            // throttle ~200ms para não saturar a CPU do iPhone com jsQR
            timerId = setTimeout(() => { loopId = requestAnimationFrame(tick) }, 200)
          }
          loopId = requestAnimationFrame(tick)
        }
      } catch {
        setEstado('sem_camera')
        setMsg('Câmera indisponível — cole o conteúdo do QR ou digite manualmente.')
      }
    }
    iniciar()
    return () => {
      cancelado = true
      if (loopId) cancelAnimationFrame(loopId)
      if (timerId) clearTimeout(timerId)
      parar()
    }
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

  // Galeria: tenta QR (jsQR) na imagem; se não houver QR, mantém o OCR (comportamento original).
  async function onGalleryChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // permite re-selecionar o mesmo arquivo
    try {
      const im = await carregarImagem(file)
      const cv = document.createElement('canvas')
      const escala = Math.min(1, 1280 / Math.max(im.width || 1, im.height || 1))
      cv.width = Math.max(1, Math.round((im.width || 1) * escala))
      cv.height = Math.max(1, Math.round((im.height || 1) * escala))
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(im, 0, 0, cv.width, cv.height)
      const texto = lerQRDeContexto(ctx, cv.width, cv.height)
      if (texto) { await enviar({ texto }); return }
    } catch { /* falha ao decodificar QR → cai no OCR abaixo */ }
    await enviar({ foto: file }) // File extends Blob — FormData.append idêntico ao canvas.toBlob
  }

  async function tirarFoto() {
    const v = videoRef.current; if (!v) return
    const cv = document.createElement('canvas')
    cv.width = v.videoWidth || 720; cv.height = v.videoHeight || 1280
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(v, 0, 0, cv.width, cv.height)
    // QR-first: se a foto contém um QR, lê direto; senão envia para OCR (comportamento original).
    const texto = lerQRDeContexto(ctx, cv.width, cv.height)
    if (texto) { enviar({ texto }); return }
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
            QR é lido automaticamente. Sem QR? Use a foto (OCR) ou cole o texto.
          </div>

          {estado !== 'sem_camera' && (
            <button onClick={tirarFoto} disabled={estado === 'processando'}
              className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50">
              📷 Capturar foto (QR/OCR)
            </button>
          )}

          {/* Galeria — Android: abre seletor (galeria ou câmera). iOS: abre Fotos. */}
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onGalleryChange} />
          <button
            onClick={() => galleryRef.current?.click()}
            disabled={estado === 'processando'}
            className="w-full border border-indigo-500 text-indigo-700 font-semibold py-3 rounded-xl disabled:opacity-50"
          >
            🖼️ Selecionar da galeria (QR/OCR)
          </button>

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
