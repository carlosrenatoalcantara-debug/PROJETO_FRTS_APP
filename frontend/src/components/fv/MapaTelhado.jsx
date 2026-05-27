/**
 * MapaTelhado.jsx — FV-06 fix completo
 *
 * MUDANÇAS:
 *  - Removido mapId="telhado-map" (não configurado no Google Cloud Console)
 *  - AdvancedMarker → Marker (legacy, não exige mapId)
 *  - Adicionado prop onAreaCalculada para integração com E6Area
 *  - onAreaCalculada é chamado automaticamente quando área manual muda
 *  - Marker draggable extrai coords corretamente do evento do vis.gl
 */
import { useEffect, useRef, useState } from 'react'
import { Map, Marker, useApiIsLoaded } from '@vis.gl/react-google-maps'
import { geocodificarEndereco } from '../../services/geocodingApi'

const API_URL = '' /* URL relativa forcada - Vercel proxy → Railway */
const BRASIL_CENTER = { lat: -14, lng: -54 }
const BRASIL_ZOOM = 4
const LOCAL_ZOOM = 17

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
  // vis.gl Marker onDragEnd entrega event.latLng (objeto google.maps.LatLng)
  // vis.gl Map onClick entrega event.detail.latLng (LatLngLiteral)
  const latLng = event?.detail?.latLng ?? event?.latLng
  if (!latLng) return null

  const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat
  const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng

  if (!temCoordenadasValidas(lat, lng)) return null
  return { lat: Number(lat), lng: Number(lng) }
}

// ─── Componente interno do mapa (sem mapId) ────────────────────────────────────
function MapComponent({ center, zoom, onMapClick, markerPosition, onMarkerDrag }) {
  return (
    <Map
      center={center}
      zoom={zoom}
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
        <Marker
          position={markerPosition}
          title="Localização do projeto (arraste para ajustar)"
          draggable={true}
          onDragEnd={(event) => {
            const coords = extrairLatLng(event)
            if (coords && onMarkerDrag) onMarkerDrag(coords.lat, coords.lng)
          }}
        />
      )}
    </Map>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function MapaTelhado({
  projetoId,
  onSave,
  onAreaCalculada,          // ← prop usado por E6Area para receber área
  endereco: enderecoProps,
  latitude: latitudeProps,
  longitude: longitudeProps,
}) {
  const [endereco, setEndereco]         = useState(enderecoProps || '')
  const [latitude, setLatitude]         = useState(latitudeProps ?? null)
  const [longitude, setLongitude]       = useState(longitudeProps ?? null)
  const [areaManual, setAreaManual]     = useState('')
  const [usarAreaManual, setUsarAreaManual] = useState(false)
  const [salvando, setSalvando]         = useState(false)
  const [salvo, setSalvo]               = useState(false)
  const [erro, setErro]                 = useState('')
  const [avisoGeocoding, setAvisoGeocoding] = useState('')
  const [geocodificando, setGeocodificando] = useState(false)
  const [irradiancia, setIrradiancia]   = useState(null)
  const [buscandoIrradiancia, setBuscandoIrradiancia] = useState(false)
  const [geocodingMeta, setGeocodingMeta] = useState({
    geocoding_origem: null,
    geocoding_confianca: null,
    geocodificado_em: null,
  })
  const autocompleteRef = useRef(null)
  const apiLoaded = useApiIsLoaded()

  const localizacaoDefinida = temCoordenadasValidas(latitude, longitude)
  const markerPosition = localizacaoDefinida
    ? { lat: Number(latitude), lng: Number(longitude) }
    : null
  const center = markerPosition || BRASIL_CENTER
  const zoom   = localizacaoDefinida ? LOCAL_ZOOM : BRASIL_ZOOM

  // Sincroniza props externas (vem do Context via E6Area)
  useEffect(() => {
    if (enderecoProps !== undefined) setEndereco(enderecoProps || '')
    if (latitudeProps  !== undefined) setLatitude(latitudeProps   ?? null)
    if (longitudeProps !== undefined) setLongitude(longitudeProps  ?? null)
  }, [enderecoProps, latitudeProps, longitudeProps])

  // Inicializa Google Places Autocomplete
  useEffect(() => {
    if (!apiLoaded) return
    initializeAutocomplete()
  }, [apiLoaded])

  async function initializeAutocomplete() {
    try {
      const { Autocomplete } = await window.google.maps.importLibrary('places')
      const inputEl = document.getElementById('mapa-endereco-input')
      if (!inputEl) return

      autocompleteRef.current = new Autocomplete(inputEl, {
        types: ['geocode'],
        componentRestrictions: { country: 'br' },
      })

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace()
        if (place?.geometry) {
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          setLatitude(lat)
          setLongitude(lng)
          setEndereco(place.formatted_address || inputEl.value)
          setGeocodingMeta(criarMetadata('google_places', 0.95))
          setAvisoGeocoding('')
        }
      })
    } catch (err) {
      console.error('[MapaTelhado] Erro ao inicializar Autocomplete:', err)
    }
  }

  // Quando área manual muda → notifica E6Area via onAreaCalculada
  useEffect(() => {
    if (!usarAreaManual || !areaManual) return
    const valor = Number(areaManual)
    if (valor > 0 && onAreaCalculada) onAreaCalculada(valor)
  }, [areaManual, usarAreaManual]) // eslint-disable-line react-hooks/exhaustive-deps

  const selecionarLocalizacaoManual = (lat, lng) => {
    setLatitude(lat)
    setLongitude(lng)
    setGeocodingMeta(criarMetadata('manual_mapa', 1))
    setAvisoGeocoding('')
    setErro('')
  }

  const regeocodificarEndereco = async () => {
    if (!endereco?.trim()) {
      setAvisoGeocoding('Informe um endereço para buscar a localização.')
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
        geocoding_origem:    resultado.geocoding_origem    || 'nominatim',
        geocoding_confianca: resultado.geocoding_confianca ?? null,
        geocodificado_em:    resultado.geocodificado_em    || new Date().toISOString(),
      })
    } catch {
      setLatitude(null)
      setLongitude(null)
      setAvisoGeocoding('Localização não encontrada. Você pode clicar no mapa para posicionar.')
    } finally {
      setGeocodificando(false)
    }
  }

  const buscarIrradiancia = async (lat, lon) => {
    if (!temCoordenadasValidas(lat, lon)) return
    setBuscandoIrradiancia(true)
    try {
      const res = await fetch(`${API_URL}/api/irradiancia/local?latitude=${lat}&longitude=${lon}`)
      if (!res.ok) throw new Error()
      setIrradiancia(await res.json())
    } catch {
      setIrradiancia(null)
    } finally {
      setBuscandoIrradiancia(false)
    }
  }

  const salvarTelhado = async () => {
    if (!usarAreaManual || !areaManual || Number(areaManual) <= 0) {
      setErro('Marque "Usar área manual" e informe uma área válida em m².')
      return
    }

    setSalvando(true)
    setErro('')

    try {
      const areaFinal    = Number(areaManual)
      const dadosTelhado = {
        endereco:     endereco,
        latitude:     localizacaoDefinida ? Number(latitude)  : null,
        longitude:    localizacaoDefinida ? Number(longitude) : null,
        area_m2:      areaFinal,
        ...geocodingMeta,
      }

      if (projetoId) {
        const res = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/telhado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endereco_completo:   endereco,
            latitude:            dadosTelhado.latitude,
            longitude:           dadosTelhado.longitude,
            geocoding_origem:    geocodingMeta.geocoding_origem,
            geocoding_confianca: geocodingMeta.geocoding_confianca,
            geocodificado_em:    geocodingMeta.geocodificado_em,
            telhado: { area_m2: areaFinal },
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || `HTTP ${res.status}`)
        }
        await buscarIrradiancia(dadosTelhado.latitude, dadosTelhado.longitude)
      }

      // Notifica pai (E6Area usa onAreaCalculada; standalone usa onSave)
      if (onAreaCalculada) onAreaCalculada(areaFinal)
      if (onSave)          onSave(dadosTelhado)

      setSalvo(true)
      setTimeout(() => setSalvo(false), 3000)
    } catch (err) {
      setErro(err.message || 'Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Campo de endereço */}
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1">
          Endereço do imóvel
        </label>
        <div className="flex gap-2">
          <input
            id="mapa-endereco-input"
            type="text"
            value={endereco}
            onChange={(e) => { setEndereco(e.target.value); setAvisoGeocoding('') }}
            placeholder="Endereço do cliente"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={regeocodificarEndereco}
            disabled={geocodificando}
            className="px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
          >
            {geocodificando ? 'Buscando...' : 'Localizar'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Clique no mapa ou arraste o marcador para ajustar a posição.
        </p>
      </div>

      {avisoGeocoding && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          {avisoGeocoding}
        </div>
      )}

      {!localizacaoDefinida && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-500">
          Localização não definida — posicione o marcador clicando no mapa.
        </div>
      )}

      {/* Mapa */}
      <div
        className="rounded-xl overflow-hidden border border-slate-200 shadow-sm"
        style={{ height: '420px' }}
      >
        {apiLoaded ? (
          <MapComponent
            center={center}
            zoom={zoom}
            onMapClick={selecionarLocalizacaoManual}
            onMarkerDrag={selecionarLocalizacaoManual}
            markerPosition={markerPosition}
          />
        ) : (
          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-2 text-slate-500">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Carregando Google Maps...</span>
          </div>
        )}
      </div>

      {/* Área manual */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={usarAreaManual}
            onChange={(e) => {
              setUsarAreaManual(e.target.checked)
              if (!e.target.checked) setAreaManual('')
            }}
            className="accent-emerald-600"
          />
          <span className="text-sm font-medium text-slate-700">
            Informar área manualmente (sem desenho)
          </span>
        </label>

        {usarAreaManual && (
          <div className="mt-2 flex gap-2 items-center">
            <input
              type="number"
              value={areaManual}
              onChange={(e) => setAreaManual(e.target.value)}
              placeholder="Área em m²"
              min="0"
              step="0.5"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-500 whitespace-nowrap">m²</span>
          </div>
        )}
      </div>

      {/* Coordenadas atuais */}
      {localizacaoDefinida && (
        <div className="text-xs text-slate-400 flex gap-4">
          <span>Lat: <strong className="text-slate-600">{Number(latitude).toFixed(5)}</strong></span>
          <span>Lng: <strong className="text-slate-600">{Number(longitude).toFixed(5)}</strong></span>
          <span className="text-emerald-600">✓ Localização definida</span>
        </div>
      )}

      {/* Botão Salvar — só aparece em uso standalone (projetoId presente) */}
      {projetoId && (
        <button
          onClick={salvarTelhado}
          disabled={salvando || !usarAreaManual}
          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-sm font-medium"
        >
          {salvando ? 'Salvando...' : 'Salvar Telhado'}
        </button>
      )}

      {/* Em modo embutido (E6Area), botão de confirmar área */}
      {!projetoId && usarAreaManual && areaManual && Number(areaManual) > 0 && (
        <p className="text-xs text-emerald-600 text-center">
          ✓ Área de <strong>{areaManual} m²</strong> sincronizada com o campo acima
        </p>
      )}

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {erro}
        </div>
      )}

      {salvo && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
          ✓ Telhado salvo! Área: {areaManual} m²
          {buscandoIrradiancia && <span className="ml-2 text-slate-500">Buscando irradiância...</span>}
        </div>
      )}

      {irradiancia && !buscandoIrradiancia && salvo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <strong>Irradiância local:</strong> {irradiancia.hsp_dia} kWh/m²/dia
          (HSP anual: {irradiancia.hsp_anual} kWh/m²) · Fonte: {irradiancia.fonte === 'nasa-power' ? 'NASA POWER' : 'Padrão'}
        </div>
      )}
    </div>
  )
}
