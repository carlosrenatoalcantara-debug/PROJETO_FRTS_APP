import { useState, useRef } from 'react'
import { GoogleMap, LoadScript, Polygon, Marker, StandaloneSearchBox } from '@react-google-maps/api'
import { Plus, Trash2 } from 'lucide-react'
import { geocodificarEndereco } from '../../services/geocodingApi'
import { getGoogleMapsApiKey } from '../../utils/googleMapsKey'

const API_KEY = getGoogleMapsApiKey()
const mapContainerStyle = { width: '100%', height: '500px' }
const BRASIL_CENTER = { lat: -14, lng: -54 }
const BRASIL_ZOOM = 4
const LOCAL_ZOOM = 18

function temCoordenadasValidas(coords) {
  return Number.isFinite(Number(coords?.lat)) && Number.isFinite(Number(coords?.lng))
}

function criarMetadata(origem, confianca) {
  return {
    geocoding_origem: origem,
    geocoding_confianca: confianca,
    geocodificado_em: new Date().toISOString(),
  }
}

export default function LayoutTelhado({ projetoId, onSave }) {
  const [endereco, setEndereco] = useState('')
  const [center, setCenter] = useState(null)
  const [pontos, setPontos] = useState([])
  const [desenhando, setDesenhando] = useState(false)
  const [areaTelhado, setAreaTelhado] = useState(0)
  const [salvo, setSalvo] = useState(false)
  const [geocodificando, setGeocodificando] = useState(false)
  const [avisoGeocoding, setAvisoGeocoding] = useState('')
  const [geocodingMeta, setGeocodingMeta] = useState({
    geocoding_origem: null,
    geocoding_confianca: null,
    geocodificado_em: null,
  })
  const mapRef = useRef(null)
  const searchBoxRef = useRef(null)

  const localizacaoDefinida = temCoordenadasValidas(center)
  const mapCenter = localizacaoDefinida ? center : BRASIL_CENTER
  const mapZoom = localizacaoDefinida ? LOCAL_ZOOM : BRASIL_ZOOM

  const calcularArea = (pontos) => {
    if (pontos.length < 3) return 0

    const earth = (p1, p2) => {
      const R = 6371000
      const phi1 = (p1.lat * Math.PI) / 180
      const phi2 = (p2.lat * Math.PI) / 180
      const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180
      const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180

      const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
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
    const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() }

    if (!desenhando) {
      setCenter(coords)
      setGeocodingMeta(criarMetadata('manual_mapa', 1))
      setAvisoGeocoding('')
      return
    }

    const novosPontos = [...pontos, coords]
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
        setGeocodingMeta(criarMetadata('google_places', 0.95))
        setAvisoGeocoding('')
      }
    }
  }

  const regeocodificarEndereco = async () => {
    if (!endereco?.trim()) {
      setAvisoGeocoding('Informe um endereco para buscar a localizacao.')
      return
    }

    setGeocodificando(true)
    setAvisoGeocoding('')

    try {
      const resultado = await geocodificarEndereco(endereco)
      setCenter({ lat: resultado.lat, lng: resultado.lon })
      setEndereco(resultado.enderecoFormatado || endereco)
      setGeocodingMeta({
        geocoding_origem: resultado.geocoding_origem || 'nominatim',
        geocoding_confianca: resultado.geocoding_confianca ?? null,
        geocodificado_em: resultado.geocodificado_em || new Date().toISOString(),
      })
    } catch (err) {
      console.error('Erro ao geocodificar endereco:', err)
      setCenter(null)
      setGeocodingMeta({
        geocoding_origem: 'nao_encontrado',
        geocoding_confianca: 0,
        geocodificado_em: new Date().toISOString(),
      })
      setAvisoGeocoding('Localizacao nao encontrada. Voce pode continuar e selecionar manualmente no mapa.')
    } finally {
      setGeocodificando(false)
    }
  }

  const finalizarDesenho = async () => {
    if (pontos.length < 3) {
      alert('Desenhe pelo menos 3 pontos para formar um poligono')
      return
    }

    setDesenhando(false)

    try {
      const res = await fetch(`/api/projetos-fv/${projetoId}/telhado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endereco_completo: endereco,
          latitude: localizacaoDefinida ? center.lat : null,
          longitude: localizacaoDefinida ? center.lng : null,
          geocoding_origem: geocodingMeta.geocoding_origem,
          geocoding_confianca: geocodingMeta.geocoding_confianca,
          geocodificado_em: geocodingMeta.geocodificado_em,
          telhado: {
            pontos,
            area_m2: areaTelhado,
          },
        }),
      })

      if (res.ok) {
        setSalvo(true)
        if (onSave) {
          onSave({
            endereco,
            latitude: localizacaoDefinida ? center.lat : null,
            longitude: localizacaoDefinida ? center.lng : null,
            pontos,
            areaTelhado,
            ...geocodingMeta,
          })
        }
      }
    } catch (err) {
      console.error('Erro ao salvar telhado:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Localizacao e Desenho do Telhado</h3>

        <LoadScript googleMapsApiKey={API_KEY} libraries={['places']}>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Endereco</label>
              <div className="flex gap-2">
                <StandaloneSearchBox
                  onLoad={ref => (searchBoxRef.current = ref)}
                  onPlacesChanged={handlePlacesChanged}
                >
                  <input
                    type="text"
                    placeholder="Digite o endereco completo"
                    value={endereco}
                    onChange={e => {
                      setEndereco(e.target.value)
                      setAvisoGeocoding('')
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </StandaloneSearchBox>
                <button
                  type="button"
                  onClick={regeocodificarEndereco}
                  disabled={geocodificando}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 text-sm font-medium whitespace-nowrap"
                >
                  {geocodificando ? 'Buscando...' : 'Regeocodificar'}
                </button>
              </div>
            </div>

            {!localizacaoDefinida && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
                Localizacao nao definida automaticamente
              </div>
            )}

            {avisoGeocoding && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-900">
                {avisoGeocoding}
              </div>
            )}

            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={mapZoom}
              onClick={handleMapClick}
              ref={mapRef}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
              }}
            >
              {localizacaoDefinida && (
                <Marker position={center} title="Localizacao do projeto" />
              )}

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

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white p-3 rounded border border-slate-200">
                <p className="text-slate-500">Pontos desenhados</p>
                <p className="text-xl font-bold text-slate-900">{pontos.length}</p>
              </div>
              <div className="bg-white p-3 rounded border border-slate-200">
                <p className="text-slate-500">Area estimada</p>
                <p className="text-xl font-bold text-slate-900">{areaTelhado} m2</p>
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
                Telhado salvo com sucesso! Area: {areaTelhado} m2
              </div>
            )}

            {desenhando && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                Clique no mapa para adicionar pontos. Use no minimo 3 pontos para delimitar o telhado.
              </div>
            )}
          </div>
        </LoadScript>
      </div>
    </div>
  )
}
