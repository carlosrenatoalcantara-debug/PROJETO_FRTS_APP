import { useEffect, useRef, useState } from 'react'
import { Map, AdvancedMarker, useApiIsLoaded } from '@vis.gl/react-google-maps'
import { Plus, Trash2, Save, MapPin } from 'lucide-react'
import { geocodificarEndereco } from '../../services/geocodingApi'

const API_URL = '' /* URL relativa forcada - Vercel proxy -> Railway */
const BRASIL_CENTER = { lat: -14, lng: -54 }
const BRASIL_ZOOM = 4
const LOCAL_ZOOM = 15

function temCoordenadasValidas(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
}

function criarMetadata(origem, confianca) {
  return {
    geocoding_origem: origem,
    geocoding_confianca: confianca,
    geocodificado_em: new Date().toISOString(),
  }
}

function extrairLatLng(event) {
  const latLng = event?.detail?.latLng || event?.latLng
  if (!latLng) return null

  const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat
  const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng

  if (!temCoordenadasValidas(lat, lng)) return null
  return { lat: Number(lat), lng: Number(lng) }
}

function MapComponent({ center, zoom, onMapClick, pontos, markerPosition, onMarkerDrag }) {
  return (
    <Map
      center={center}
      zoom={zoom}
      mapId="telhado-map"
      mapTypeId="hybrid"
      gestureHandling="greedy"
      mapTypeControl={true}
      streetViewControl={false}
      fullscreenControl={true}
      zoomControl={true}
      style={{ width: '100%', height: '100%' }}
      defaultCenter={BRASIL_CENTER}
      defaultZoom={BRASIL_ZOOM}
      onClick={(event) => {
        const coords = extrairLatLng(event)
        if (coords) onMapClick(coords.lat, coords.lng)
      }}
    >
      {markerPosition && (
        <AdvancedMarker
          position={markerPosition}
          title="Localizacao do projeto (arraste para ajustar)"
          draggable={true}
          onDragEnd={(event) => {
            const coords = extrairLatLng(event)
            if (coords && onMarkerDrag) onMarkerDrag(coords.lat, coords.lng)
          }}
        >
          <div className="bg-emerald-600 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg ring-2 ring-white">
            <MapPin size={18} />
          </div>
        </AdvancedMarker>
      )}

      {pontos.map((ponto, idx) => (
        <AdvancedMarker
          key={idx}
          position={{ lat: ponto.lat, lng: ponto.lng }}
          title={`Ponto ${idx + 1}`}
        >
          <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">
            {idx + 1}
          </div>
        </AdvancedMarker>
      ))}
    </Map>
  )
}

export default function MapaTelhado({ projetoId, onSave, endereco: enderecoProps, latitude: latitudeProps, longitude: longitudeProps }) {
  const [endereco, setEndereco] = useState(enderecoProps || '')
  const [latitude, setLatitude] = useState(latitudeProps ?? null)
  const [longitude, setLongitude] = useState(longitudeProps ?? null)
  const [pontos, setPontos] = useState([])
  const [areaTelhado, setAreaTelhado] = useState(0)
  const [desenhando, setDesenhando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')
  const [avisoGeocoding, setAvisoGeocoding] = useState('')
  const [geocodificando, setGeocodificando] = useState(false)
  const [areaManual, setAreaManual] = useState('')
  const [usarAreaManual, setUsarAreaManual] = useState(false)
  const [irradiancia, setIrradiancia] = useState(null)
  const [buscandoIrradiancia, setBuscandoIrradiancia] = useState(false)
  const [geocodingMeta, setGeocodingMeta] = useState({
    geocoding_origem: null,
    geocoding_confianca: null,
    geocodificado_em: null,
  })
  const autocompleteRef = useRef(null)
  const apiLoaded = useApiIsLoaded()

  const localizacaoDefinida = temCoordenadasValidas(latitude, longitude)
  const markerPosition = localizacaoDefinida ? { lat: Number(latitude), lng: Number(longitude) } : null
  const center = markerPosition || BRASIL_CENTER
  const zoom = localizacaoDefinida ? LOCAL_ZOOM : BRASIL_ZOOM

  useEffect(() => {
    if (enderecoProps !== undefined) setEndereco(enderecoProps || '')
    if (latitudeProps !== undefined) setLatitude(latitudeProps ?? null)
    if (longitudeProps !== undefined) setLongitude(longitudeProps ?? null)
  }, [enderecoProps, latitudeProps, longitudeProps])

  useEffect(() => {
    initializeGoogleMaps()
  }, [])

  async function initializeGoogleMaps() {
    if (typeof google === 'undefined') {
      setErro('Google Maps API nao carregada')
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
            setEndereco(place.formatted_address || inputElement.value)
            setGeocodingMeta(criarMetadata('google_places', 0.95))
            setAvisoGeocoding('')
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
    setErro('Funcao de desenho em breve. Use "Usar area manual" para agora.')
  }

  const limparDesenho = () => {
    setPontos([])
    setAreaTelhado(0)
    setDesenhando(false)
  }

  const adicionarPonto = (lat, lng) => {
    setPontos(prev => [...prev, { lat, lng }])
  }

  const selecionarLocalizacaoManual = (lat, lng) => {
    if (desenhando) {
      adicionarPonto(lat, lng)
      return
    }

    setLatitude(lat)
    setLongitude(lng)
    setGeocodingMeta(criarMetadata('manual_mapa', 1))
    setAvisoGeocoding('')
    setErro('')
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
      setLatitude(resultado.lat)
      setLongitude(resultado.lon)
      setEndereco(resultado.enderecoFormatado || endereco)
      setGeocodingMeta({
        geocoding_origem: resultado.geocoding_origem || 'nominatim',
        geocoding_confianca: resultado.geocoding_confianca ?? null,
        geocodificado_em: resultado.geocodificado_em || new Date().toISOString(),
      })
      setPontos([])
      setAreaTelhado(0)
    } catch (err) {
      console.error('Erro ao geocodificar endereco:', err)
      setLatitude(null)
      setLongitude(null)
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

  const buscarIrradiancia = async (lat, lon) => {
    if (!temCoordenadasValidas(lat, lon)) return

    setBuscandoIrradiancia(true)
    try {
      const res = await fetch(`${API_URL}/api/irradiancia/local?latitude=${lat}&longitude=${lon}`)
      if (!res.ok) throw new Error('Erro ao buscar irradiancia')
      const dados = await res.json()
      setIrradiancia(dados)
    } catch (err) {
      console.error('Erro ao buscar irradiancia:', err)
      setIrradiancia(null)
    } finally {
      setBuscandoIrradiancia(false)
    }
  }

  const salvarTelhado = async () => {
    if (!usarAreaManual) {
      setErro('Por enquanto, use a opcao "Usar area manual" para prosseguir')
      return
    }

    if (!areaManual || areaManual <= 0) {
      setErro('Digite uma area valida em m2 (maior que 0)')
      return
    }

    if (!endereco || !endereco.trim()) {
      setErro('Preencha o endereco')
      return
    }

    setSalvando(true)
    setErro('')

    try {
      const areaFinal = Number(areaManual)
      const enderecoFinal = endereco
      const dadosTelhado = {
        endereco: enderecoFinal,
        latitude: localizacaoDefinida ? Number(latitude) : null,
        longitude: localizacaoDefinida ? Number(longitude) : null,
        pontos,
        area_m2: areaFinal,
        ...geocodingMeta,
      }

      if (projetoId) {
        const res = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/telhado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endereco_completo: enderecoFinal,
            latitude: dadosTelhado.latitude,
            longitude: dadosTelhado.longitude,
            geocoding_origem: geocodingMeta.geocoding_origem,
            geocoding_confianca: geocodingMeta.geocoding_confianca,
            geocodificado_em: geocodingMeta.geocodificado_em,
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

        await buscarIrradiancia(dadosTelhado.latitude, dadosTelhado.longitude)
      }

      setSalvo(true)
      if (onSave) {
        onSave(dadosTelhado)
      }

      setTimeout(() => setSalvo(false), 3000)
    } catch (err) {
      console.error('Erro ao salvar:', err)
      setErro(`${err.message || 'Erro ao salvar telhado. Verifique o endereco e a area.'}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-4">Localizacao e Desenho do Telhado</h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">
              Endereco do Imovel
            </label>
            <div className="flex gap-2">
              <input
                id="endereco-input"
                type="text"
                value={endereco}
                onChange={(e) => {
                  setEndereco(e.target.value)
                  setAvisoGeocoding('')
                }}
                placeholder="Endereco do cliente"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={regeocodificarEndereco}
                disabled={geocodificando}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 text-sm font-medium whitespace-nowrap"
              >
                {geocodificando ? 'Buscando...' : 'Regeocodificar'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Edite o endereco ou clique no mapa para ajustar a localizacao.</p>
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

          <div className="rounded-lg overflow-hidden border border-slate-200 relative" style={{ height: '500px' }}>
            {apiLoaded ? (
              <MapComponent
                center={center}
                zoom={zoom}
                onMapClick={selecionarLocalizacaoManual}
                onMarkerDrag={selecionarLocalizacaoManual}
                pontos={pontos}
                markerPosition={markerPosition}
              />
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-500">
                Carregando Google Maps...
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded border border-slate-200">
              <p className="text-slate-500 text-xs font-semibold">Pontos Desenhados</p>
              <p className="text-2xl font-bold text-slate-900">{pontos.length}</p>
            </div>
            <div className="bg-white p-3 rounded border border-slate-200">
              <p className="text-slate-500 text-xs font-semibold">Area Estimada</p>
              <p className="text-2xl font-bold text-slate-900">{usarAreaManual ? areaManual : areaTelhado} m2</p>
            </div>
          </div>

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
                Usar area manual (sem desenho)
              </span>
            </label>

            {usarAreaManual && (
              <input
                type="number"
                value={areaManual}
                onChange={(e) => setAreaManual(e.target.value)}
                placeholder="Area em m2"
                className="w-full mt-2 px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

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

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
              {erro}
            </div>
          )}

          {salvo && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                Telhado salvo com sucesso! Area: {usarAreaManual ? areaManual : areaTelhado} m2
              </div>

              {buscandoIrradiancia && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800 flex items-center gap-2">
                  <div className="animate-spin">...</div>
                  Consultando irradiancia local...
                </div>
              )}

              {irradiancia && !buscandoIrradiancia && (
                <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2">
                  <p className="text-sm font-semibold text-blue-900">Irradiancia Local</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <p className="text-blue-600 text-xs font-medium">HSP Diaria</p>
                      <p className="text-lg font-bold text-blue-900">{irradiancia.hsp_dia} kWh/m2/dia</p>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <p className="text-blue-600 text-xs font-medium">HSP Anual</p>
                      <p className="text-lg font-bold text-blue-900">{irradiancia.hsp_anual} kWh/m2</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 pt-2">
                    <strong>Localizacao:</strong> Lat: {irradiancia.latitude.toFixed(4)}, Lon: {irradiancia.longitude.toFixed(4)}
                  </p>
                  <p className="text-xs text-blue-600">
                    Fonte: {irradiancia.fonte === 'nasa-power' ? 'NASA POWER' : 'Padrao'}
                  </p>
                </div>
              )}
            </div>
          )}

          {!usarAreaManual && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
              Marque a opcao "Usar area manual" abaixo e digite a metragem do telhado em m2 para continuar.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
