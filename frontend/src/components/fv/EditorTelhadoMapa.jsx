import { useEffect, useRef, useState } from 'react'
import { Map, Marker, useApiIsLoaded, useMap } from '@vis.gl/react-google-maps'
import { MousePointer, Pencil, Move, Trash2, Check } from 'lucide-react'
import { areaPoligonoGeodesica } from '../../utils/geoEngine'

/**
 * EditorTelhadoMapa — Sprint 6.1
 *
 * Desenho real de polígonos no satélite (leve, sem CAD). Vértices são Markers
 * arrastáveis (padrão já validado em MapaTelhado); o preenchimento do polígono
 * é um overlay google.maps.Polygon (somente visual). A área é calculada pelo
 * geoEngine — fonte única. Respeita freeze (bloqueado = somente leitura).
 *
 * @param {Array}    panos
 * @param {function} onChange (panos) => void
 * @param {object}   center  { lat, lng }
 * @param {boolean}  bloqueado
 */
const CORES = ['#10b981', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6']

// Camada de preenchimento dos polígonos (overlay nativo)
function CamadaPoligonos({ panos, ativo }) {
  const map = useMap()
  const ref = useRef([])
  useEffect(() => {
    if (!map || !window.google?.maps) return
    ref.current.forEach((p) => p.setMap(null))
    ref.current = []
    panos.forEach((pano, idx) => {
      const pts = Array.isArray(pano.poligono) ? pano.poligono : []
      if (pts.length < 2) return
      const cor = CORES[idx % CORES.length]
      try {
        const poly = new window.google.maps.Polygon({
          paths: pts.map((pt) => ({ lat: Number(pt.lat), lng: Number(pt.lng) })),
          fillColor: cor, fillOpacity: idx === ativo ? 0.30 : 0.18,
          strokeColor: cor, strokeWeight: idx === ativo ? 3 : 2,
          clickable: false, map,
        })
        ref.current.push(poly)
      } catch { /* ignore */ }
    })
    return () => { ref.current.forEach((p) => p.setMap(null)); ref.current = [] }
  }, [map, panos, ativo])
  return null
}

export default function EditorTelhadoMapa({ panos = [], onChange, center, bloqueado = false }) {
  const apiLoaded = useApiIsLoaded()
  const [modo, setModo] = useState('navegar') // navegar | desenhar | editar
  const [ativo, setAtivo] = useState(0)

  const mapCenter = center?.lat != null ? { lat: Number(center.lat), lng: Number(center.lng) } : { lat: -14, lng: -54 }
  const zoom = center?.lat != null ? 19 : 4

  function setPoligono(idx, pts) {
    const novo = panos.map((p, i) => i === idx
      ? { ...p, poligono: pts, area_bruta: pts.length >= 3 ? +areaPoligonoGeodesica(pts.map((q) => [q.lat, q.lng])).toFixed(1) : p.area_bruta }
      : p)
    onChange(novo)
  }

  function onMapClick(lat, lng) {
    if (bloqueado || modo !== 'desenhar') return
    if (!panos[ativo]) return
    const pts = [...(panos[ativo].poligono || []), { lat, lng }]
    setPoligono(ativo, pts)
  }

  function moverVertice(idx, vIdx, lat, lng) {
    if (bloqueado) return
    const pts = (panos[idx].poligono || []).map((p, i) => i === vIdx ? { lat, lng } : p)
    setPoligono(idx, pts)
  }

  function limparPoligono(idx) {
    if (bloqueado) return
    setPoligono(idx, [])
  }

  const panoAtivo = panos[ativo]

  if (!apiLoaded) {
    return (
      <div className="w-full bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 text-sm" style={{ height: 380 }}>
        Carregando Google Maps…
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Toolbar leve */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <BotaoModo ativo={modo === 'navegar'} onClick={() => setModo('navegar')} icone={MousePointer} label="Navegar" />
          <BotaoModo ativo={modo === 'desenhar'} onClick={() => setModo('desenhar')} icone={Pencil} label="Desenhar" disabled={bloqueado} />
          <BotaoModo ativo={modo === 'editar'} onClick={() => setModo('editar')} icone={Move} label="Editar" disabled={bloqueado} />
        </div>
        {/* Seleção do pano ativo */}
        <select value={ativo} onChange={(e) => setAtivo(Number(e.target.value))}
          className="text-xs border border-slate-300 rounded-lg px-2 py-1.5">
          {panos.map((p, i) => <option key={p.id || i} value={i}>{p.nome || `Pano ${i + 1}`}</option>)}
        </select>
        {modo === 'desenhar' && !bloqueado && (
          <span className="text-xs text-emerald-700">Clique no telhado para adicionar vértices do <strong>{panoAtivo?.nome}</strong>.</span>
        )}
        {!bloqueado && panoAtivo?.poligono?.length > 0 && (
          <button onClick={() => limparPoligono(ativo)} className="text-xs text-red-600 hover:underline flex items-center gap-1">
            <Trash2 size={12} /> Limpar pano
          </button>
        )}
        {panoAtivo?.poligono?.length >= 3 && (
          <span className="text-xs text-slate-500 flex items-center gap-1"><Check size={12} className="text-emerald-500" /> {panoAtivo.poligono.length} vértices · {panoAtivo.area_bruta} m²</span>
        )}
      </div>

      <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 380 }}>
        <Map
          defaultCenter={mapCenter}
          defaultZoom={zoom}
          mapTypeId="satellite"
          gestureHandling={modo === 'navegar' ? 'greedy' : 'cooperative'}
          tilt={0}
          disableDefaultUI={false}
          mapTypeControl={true}
          style={{ width: '100%', height: '100%' }}
          onClick={(e) => {
            const ll = e?.detail?.latLng
            if (ll) onMapClick(ll.lat, ll.lng)
          }}
        >
          <CamadaPoligonos panos={panos} ativo={ativo} />
          {/* Vértices arrastáveis (apenas do pano ativo em modo editar/desenhar) */}
          {!bloqueado && modo !== 'navegar' && (panoAtivo?.poligono || []).map((pt, vIdx) => (
            <Marker
              key={`${ativo}-${vIdx}`}
              position={{ lat: Number(pt.lat), lng: Number(pt.lng) }}
              draggable={modo === 'editar'}
              onDragEnd={(e) => {
                const ll = e?.latLng
                if (ll) moverVertice(ativo, vIdx, typeof ll.lat === 'function' ? ll.lat() : ll.lat, typeof ll.lng === 'function' ? ll.lng() : ll.lng)
              }}
            />
          ))}
        </Map>
      </div>
      <p className="text-[11px] text-slate-400">
        Desenhe cada pano clicando os cantos do telhado. Em "Editar", arraste os vértices. A área é recalculada automaticamente.
      </p>
    </div>
  )
}

function BotaoModo({ ativo, onClick, icone: Icone, label, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 ${
        ativo ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}>
      <Icone size={13} /> {label}
    </button>
  )
}
