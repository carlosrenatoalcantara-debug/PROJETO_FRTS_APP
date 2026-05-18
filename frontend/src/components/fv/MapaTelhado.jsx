import { useEffect, useRef, useState } from 'react'
import { Map, AdvancedMarker, useMap, useAdvancedMarkerRef } from '@vis.gl/react-google-maps'
import { Plus, Trash2, Save, ZoomIn, ZoomOut } from 'lucide-react'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

function MapComponent({ center, onMapClick, pontos }) {
  return (
    <Map
      center={center}
      mapId="telhado-map"
      style={{ width: '100%', height: '100%' }}
      defaultCenter={center}
      defaultZoom={15}
    >
      {pontos.length > 0 && (
        pontos.map((ponto, idx) => (
          <AdvancedMarker
            key={idx}
            position={{ lat: ponto.lat, lng: ponto.lng }}
            title={`Ponto ${idx + 1}`}
          >
            <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">
              {idx + 1}
            </div>
          </AdvancedMarker>
        ))
      )}
      {/* Polyline temporariamente desabilitado */}
    </Map>
  )
}

function PolylineComponent({ pontos }) {
  const map = useMap()

  useEffect(() => {
    if (!map || pontos.length < 2) return

    const paths = pontos.map(p => new google.maps.LatLng(p.lat, p.lng))
    paths.push(new google.maps.LatLng(pontos[0].lat, pontos[0].lng))

    const polyline = new google.maps.Polyline({
      path: paths,
      geodesic: true,
      strokeColor: '#3B82F6',
      strokeOpacity: 0.7,
      strokeWeight: 2,
      fillColor: '#3B82F6',
      fillOpacity: 0.2,
      map: map,
    })

    return () => {
      polyline.setMap(null)
    }
  }, [map, pontos])

  return null
}

const COORDENADAS_CIDADES = {
  'SP': { lat: -23.5505, lng: -46.6333 },
  'RJ': { lat: -22.9068, lng: -43.1729 },
  'MG': { lat: -19.9167, lng: -43.9345 },
  'BA': { lat: -12.9714, lng: -38.5014 },
  'PE': { lat: -8.0476, lng: -34.877 },
  'CE': { lat: -3.731, lng: -38.5267 },
  'RN': { lat: -5.795, lng: -35.2094 },
  'PA': { lat: -1.4558, lng: -48.5044 },
  'PR': { lat: -25.4284, lng: -49.2733 },
  'SC': { lat: -27.2423, lng: -49.6439 },
  'RS': { lat: -30.0346, lng: -51.2177 },
  'GO': { lat: -15.827, lng: -48.9278 },
  'DF': { lat: -15.8267, lng: -47.8711 },
  'ES': { lat: -20.3155, lng: -40.3128 },
  'MA': { lat: -2.9141, lng: -44.2170 },
  'PI': { lat: -5.0892, lng: -42.8019 },
  'AL': { lat: -9.6412, lng: -36.6822 },
  'PB': { lat: -7.1219, lng: -34.8450 },
  'AM': { lat: -3.1190, lng: -60.0217 },
  'RO': { lat: -8.7608, lng: -63.9002 },
  'AC': { lat: -9.9757, lng: -67.8250 },
  'AP': { lat: 0.0356, lng: -51.0642 },
  'RR': { lat: 2.8235, lng: -60.6758 },
  'MT': { lat: -15.5994, lng: -56.0974 },
  'MS': { lat: -20.4697, lng: -54.6201 },
  'TO': { lat: -10.2623, lng: -48.2625 },
}

export default function MapaTelhado({ projetoId, onSave, endereco: enderecoProps, latitude: latitudeProps, longitude: longitudeProps }) {
  const [endereco, setEndereco] = useState(enderecoProps || '')
  const [latitude, setLatitude] = useState(latitudeProps || -23.5505)
  const [longitude, setLongitude] = useState(longitudeProps || -46.6333)
  const [pontos, setPontos] = useState([])
  const [areaTelhado, setAreaTelhado] = useState(0)
  const [desenhando, setDesenhando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')
  const [areaManual, setAreaManual] = useState('')
  const [usarAreaManual, setUsarAreaManual] = useState(false)
  const [irradiancia, setIrradiancia] = useState(null)
  const [buscandoIrradiancia, setBuscandoIrradiancia] = useState(false)
  const autocompleteRef = useRef(null)

  const center = { lat: latitude, lng: longitude }

  useEffect(() => {
    if (enderecoProps) setEndereco(enderecoProps)
    if (latitudeProps) setLatitude(latitudeProps)
    if (longitudeProps) setLongitude(longitudeProps)
  }, [enderecoProps, latitudeProps, longitudeProps])

  useEffect(() => {
    initializeGoogleMaps()
  }, [])

  async function initializeGoogleMaps() {
    if (typeof google === 'undefined') {
      setErro('Google Maps API não carregada')
      return
    }

    try {
      const { Autocomplete } = await google.maps.importLibrary('places')
      const inputElement = document.getElementById('endereco-input')

      if (inputElement) {
        autocompleteRef.current = new Autocomplete(inputElement, {
          types: ['geocode'],
          componentRestrictions: { country: 'br' },
        })

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current.getPlace()
          if (place.geometry) {
            setLatitude(place.geometry.location.lat())
            setLongitude(place.geometry.location.lng())
            setEndereco(place.formatted_address)
            setPontos([])
            setAreaTelhado(0)
          }
        })
      }
    } catch (err) {
      console.error('Erro ao inicializar Autocomplete:', err)
    }
  }

  const iniciarDesenho = () => {
    setErro('💡 Função de desenho em breve. Use "Usar área manual" para agora.')
  }

  const limparDesenho = () => {
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setMap(null)
    }
    setPontos([])
    setAreaTelhado(0)
    setDesenhando(false)
  }

  const obterCoordenadas = () => {
    return { lat: latitude, lon: longitude }
  }

  const buscarIrradiancia = async (lat, lon) => {
    setBuscandoIrradiancia(true)
    try {
      const res = await fetch(`${API_URL}/api/irradiancia/local?latitude=${lat}&longitude=${lon}`)
      if (!res.ok) throw new Error('Erro ao buscar irradiância')
      const dados = await res.json()
      setIrradiancia(dados)
    } catch (err) {
      console.error('Erro ao buscar irradiância:', err)
      setIrradiancia(null)
    } finally {
      setBuscandoIrradiancia(false)
    }
  }


  const salvarTelhado = async () => {
    if (!usarAreaManual) {
      setErro('⚠️ Por enquanto, use a opção "Usar área manual" para prosseguir')
      return
    }

    if (!areaManual || areaManual <= 0) {
      setErro('❌ Digite uma área válida em m² (maior que 0)')
      return
    }

    if (!endereco || !endereco.trim()) {
      setErro('❌ Preencha o endereço')
      return
    }

    setSalvando(true)
    setErro('')

    try {
      const areaFinal = Number(areaManual)
      const coords = obterCoordenadas()
      const enderecoFinal = endereco
      const dadosTelhado = { endereco: enderecoFinal, latitude: coords.lat, longitude: coords.lon, pontos, area_m2: areaFinal }

      // Se houver projetoId, salvar no backend; senão, apenas chamar callback
      if (projetoId) {
        const res = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/telhado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endereco_completo: enderecoFinal,
            latitude: coords.lat,
            longitude: coords.lon,
            telhado: {
              pontos,
              area_m2: areaFinal,
            },
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          const msgErro = errData.message || `Erro do servidor: ${res.status}`
          throw new Error(msgErro)
        }

        // Buscar irradiância após salvar com sucesso
        await buscarIrradiancia(coords.lat, coords.lon)
      }

      setSalvo(true)
      if (onSave) {
        onSave(dadosTelhado)
      }

      setTimeout(() => setSalvo(false), 3000)
    } catch (err) {
      console.error('Erro ao salvar:', err)
      setErro(`❌ ${err.message || 'Erro ao salvar telhado. Verifique o endereço e a área.'}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-4">Localização e Desenho do Telhado</h3>

        <div className="space-y-4">
          {/* Endereço - Campo único preenchido do cliente */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">
              Endereço do Imóvel
            </label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Endereço do cliente"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Campo preenchido automaticamente com o endereço do cliente</p>
          </div>

          {/* Mapa */}
          <div className="rounded-lg overflow-hidden border border-slate-200 relative" style={{ height: '500px' }}>
            {typeof google !== 'undefined' ? (
              <>
                <MapComponent
                  center={center}
                  onMapClick={(lat, lng) => desenhando && adicionarPonto(lat, lng)}
                  pontos={pontos}
                />

                {/* Zoom: use scroll do mouse ou touchpad */}

                {/* Modo desenho desabilitado por enquanto */}
              </>
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-500">
                Carregando mapa...
              </div>
            )}
          </div>

          {/* Informações de Área */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded border border-slate-200">
              <p className="text-slate-500 text-xs font-semibold">Pontos Desenhados</p>
              <p className="text-2xl font-bold text-slate-900">{pontos.length}</p>
            </div>
            <div className="bg-white p-3 rounded border border-slate-200">
              <p className="text-slate-500 text-xs font-semibold">Área Estimada</p>
              <p className="text-2xl font-bold text-slate-900">{usarAreaManual ? areaManual : areaTelhado} m²</p>
            </div>
          </div>

          {/* Modo de Área */}
          <div className="bg-white border border-slate-200 rounded p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={usarAreaManual}
                onChange={(e) => {
                  setUsarAreaManual(e.target.checked)
                  if (!e.target.checked) setAreaManual('')
                }}
              />
              <span className="text-sm font-medium text-slate-700">
                Usar área manual (sem desenho)
              </span>
            </label>

            {usarAreaManual && (
              <input
                type="number"
                value={areaManual}
                onChange={(e) => setAreaManual(e.target.value)}
                placeholder="Área em m²"
                className="w-full mt-2 px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-2">
            {!usarAreaManual && (
              <button
                onClick={iniciarDesenho}
                className="flex-1 px-4 py-2 bg-slate-400 text-white rounded-lg cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                disabled
                title="Funcionalidade em desenvolvimento"
              >
                <Plus size={18} /> Desenhar Telhado (em breve)
              </button>
            )}

            {pontos.length > 0 && !usarAreaManual && (
              <button
                onClick={limparDesenho}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 font-medium"
              >
                <Trash2 size={18} /> Limpar
              </button>
            )}

            <button
              onClick={salvarTelhado}
              disabled={salvando || !usarAreaManual}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              <Save size={18} /> {salvando ? 'Salvando...' : 'Salvar Telhado'}
            </button>
          </div>

          {/* Feedback */}
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
              ✗ {erro}
            </div>
          )}

          {salvo && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                ✓ Telhado salvo com sucesso! Área: {usarAreaManual ? areaManual : areaTelhado} m²
              </div>

              {buscandoIrradiancia && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800 flex items-center gap-2">
                  <div className="animate-spin">⟳</div>
                  Consultando irradiância local...
                </div>
              )}

              {irradiancia && !buscandoIrradiancia && (
                <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2">
                  <p className="text-sm font-semibold text-blue-900">☀️ Irradiância Local</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <p className="text-blue-600 text-xs font-medium">HSP Diária</p>
                      <p className="text-lg font-bold text-blue-900">{irradiancia.hsp_dia} kWh/m²/dia</p>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <p className="text-blue-600 text-xs font-medium">HSP Anual</p>
                      <p className="text-lg font-bold text-blue-900">{irradiancia.hsp_anual} kWh/m²</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 pt-2">
                    <strong>Localização:</strong> Lat: {irradiancia.latitude.toFixed(4)}, Lon: {irradiancia.longitude.toFixed(4)}
                  </p>
                  <p className="text-xs text-blue-600">
                    Fonte: {irradiancia.fonte === 'nasa-power' ? '🛰️ NASA POWER' : '📊 Padrão'}
                  </p>
                </div>
              )}
            </div>
          )}

          {!usarAreaManual && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
              ℹ️ <strong>Como proceder:</strong> Marque a opção "Usar área manual" abaixo e digite a metragem do telhado em m² para continuar.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
