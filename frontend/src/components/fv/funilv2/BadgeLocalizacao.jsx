import { MapPin, AlertTriangle, CheckCircle, Edit2 } from 'lucide-react'

/**
 * Badge visual indicando origem e confiança da localização.
 * NÃO bloqueia avanço — apenas avisa.
 */
export default function BadgeLocalizacao({ origem, confianca, latitude, longitude }) {
  const semCoords = latitude == null || longitude == null

  // Mapeamento origem → estilo
  const estilos = {
    gemini_vision:       { Icone: CheckCircle, cor: 'emerald', rotulo: 'Coordenadas da fatura' },
    nominatim_completo:  { Icone: CheckCircle, cor: 'emerald', rotulo: 'Localização encontrada' },
    nominatim_parcial:   { Icone: AlertTriangle, cor: 'amber', rotulo: 'Localização aproximada' },
    cidade_estado:       { Icone: AlertTriangle, cor: 'amber', rotulo: 'Apenas cidade/estado' },
    usuario_manual:      { Icone: Edit2, cor: 'blue', rotulo: 'Definida manualmente' },
    nao_geocodificado:   { Icone: AlertTriangle, cor: 'red', rotulo: 'Endereço não localizado' },
  }

  if (semCoords) {
    const e = estilos.nao_geocodificado
    const C = e.Icone
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-sm">
        <C size={14} />
        <span className="font-medium">⚠ Localização pendente</span>
        <span className="text-xs text-red-600">— marque manualmente no mapa</span>
      </div>
    )
  }

  const e = estilos[origem] || estilos.nominatim_completo
  const C = e.Icone
  const cores = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    blue:    'bg-blue-50 text-blue-700 border-blue-200',
    red:     'bg-red-50 text-red-700 border-red-200',
  }
  const pct = typeof confianca === 'number' ? Math.round(confianca * 100) : null

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${cores[e.cor]}`}>
      <C size={14} />
      <span className="font-medium">{e.rotulo}</span>
      {pct != null && <span className="text-xs opacity-75">— {pct}% confiança</span>}
      <MapPin size={12} className="opacity-60" />
      <span className="text-xs opacity-60 font-mono">
        {Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)}
      </span>
    </div>
  )
}
