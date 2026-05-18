/**
 * Centraliza leitura da chave do Google Maps.
 * Hierarquia (mesma do main.jsx):
 *   1. localStorage.googleMapsApiKey  ← Configurações > Integrações
 *   2. import.meta.env.VITE_GOOGLE_MAPS_API_KEY  ← fallback build-time
 *
 * NÃO coloque placeholders/keys hardcoded — falha graciosa é melhor que key falsa.
 * Reusa infraestrutura existente (não duplica).
 */
export function getGoogleMapsApiKey() {
  if (typeof window !== 'undefined') {
    try {
      const localKey = window.localStorage?.getItem('googleMapsApiKey')
      if (localKey?.trim()) return localKey.trim()
    } catch {
      // Ambientes restritos podem bloquear localStorage; nesse caso usa env.
    }
  }

  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
}

export function temChaveGoogleMaps() {
  return Boolean(getGoogleMapsApiKey())
}
