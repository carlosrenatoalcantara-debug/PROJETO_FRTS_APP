import { useState, useEffect, useRef } from 'react'
import { GoogleMap, LoadScript, Polygon, Marker, StandaloneSearchBox } from '@react-google-maps/api'
import { Plus, Trash2 } from 'lucide-react'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC8iIwq-W8qMPfQ3X-3D5Z-4Q-Q-Q-Q' // Usar .env.local
const mapContainerStyle = { width: '100%', height: '500px' }
const defaultCenter = { lat: -23.5505, lng: -46.6333 }

export default function LayoutTelhado({ projetoId, onSave }) {
  const [endereco, setEndereco] = useState('')
  const [center, setCenter] = useState(defaultCenter)
  const [pontos, setPontos] = useState([])
  const [desenhando, setDesenhando] = useState(false)
  const [areaTelhado, setAreaTelhado] = useState(0)
  const [salvo, setSalvo] = useState(false)
  const mapRef = useRef(null)
  const searchBoxRef = useRef(null)

  const calcularArea = (pontos) => {
    if (pontos.length < 3) return 0

    const earth = (p1, p2) => {
      const R = 6371000
      const φ1 = (p1.lat * Math.PI) / 180
      const φ2 = (p2.lat * Math.PI) / 180
      const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180
      const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

      return R * c
    }

    let area = 0
    for (let i = 0; i < pontos.length; i++) {
      const p1 = pontos[i]
      const p2 = pontos[(i + 1) % pontos.length]
      const d = earth(p1, p2)
      area += d
    }

    area = Math.abs(area / 2)
    return Math.round(area)
  }

  const handleMapClick = (e) => {
    if (!desenhando) return

    const novosPontos = [...pontos, { lat: e.latLng.lat(), lng: e.latLng.lng() }]
    setPontos(novosPontos)
    setAreaTelhado(calcularArea(novosPontos))
  }

  const handlePlacesChanged = () => {
    if (searchBoxRef.current) {
      const places = searchBoxRef.current.getPlaces()
      if (places.length > 0) {
        const place = places[0]
        const novoCenter = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        }
        setCenter(novoCenter)
        setEndereco(place.formatted_address)
      }
    }
  }

  const finalizarDesenho = async () => {
    if (pontos.length < 3) {
      alert('Desenhe pelo menos 3 pontos para formar um polígono')
      return
    }

    setDesenhando(false)

    try {
      const res = await fetch(`/api/projetos-fv/${projetoId}/telhado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endereco_completo: endereco,
          latitude: center.lat,
          longitude: center.lng,
          telhado: {
            pontos: pontos,
            area_m2: areaTelhado
          }
        })
      })

      if (res.ok) {
        setSalvo(true)
        if (onSave) onSave({ endereco, pontos, areaTelhado })
      }
    } catch (err) {
      console.error('Erro ao salvar telhado:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Localização e Desenho do Telhado</h3>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">Endereço</label>
            <LoadScript googleMapsApiKey={API_KEY} libraries={['places']}>
              <StandaloneSearchBox
                onLoad={ref => (searchBoxRef.current = ref)}
                onPlacesChanged={handlePlacesChanged}
              >
                <input
                  type="text"
                  placeholder="Digite o endereço completo"
                  value={endereco}
                  onChange={e => setEndereco(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </StandaloneSearchBox>
            </LoadScript>
          </div>

          <LoadScript googleMapsApiKey={API_KEY}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={18}
              onClick={handleMapClick}
              ref={mapRef}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
              }}
            >
              {pontos.length > 0 && (
                <Polygon
                  paths={pontos}
                  options={{
                    fillColor: '#3b82f6',
                    fillOpacity: 0.35,
                    strokeColor: '#1e40af',
                    strokeWeight: 2,
                  }}
                />
              )}

              {pontos.map((ponto, idx) => (
                <Marker
                  key={idx}
                  position={ponto}
                  label={String(idx + 1)}
                  title={`Ponto ${idx + 1}`}
                />
              ))}
            </GoogleMap>
          </LoadScript>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white p-3 rounded border border-slate-200">
              <p className="text-slate-500">Pontos desenhados</p>
              <p className="text-xl font-bold text-slate-900">{pontos.length}</p>
            </div>
            <div className="bg-white p-3 rounded border border-slate-200">
              <p className="text-slate-500">Área estimada</p>
              <p className="text-xl font-bold text-slate-900">{areaTelhado} m²</p>
            </div>
          </div>

          <div className="flex gap-2">
            {!desenhando ? (
              <>
                <button
                  onClick={() => setDesenhando(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium"
                >
                  <Plus size={18} /> Iniciar Desenho
                </button>
                {pontos.length > 0 && (
                  <button
                    onClick={() => setPontos([])}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                  >
                    <Trash2 size={18} /> Limpar
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={finalizarDesenho}
                  disabled={pontos.length < 3}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 font-medium"
                >
                  Finalizar Desenho
                </button>
                <button
                  onClick={() => {
                    setDesenhando(false)
                    setPontos([])
                  }}
                  className="px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>

          {salvo && (
            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
              ✓ Telhado salvo com sucesso! Área: {areaTelhado} m²
            </div>
          )}

          {desenhando && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
              ⓘ Clique no mapa para adicionar pontos. Use no mínimo 3 pontos para delimitar o telhado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
