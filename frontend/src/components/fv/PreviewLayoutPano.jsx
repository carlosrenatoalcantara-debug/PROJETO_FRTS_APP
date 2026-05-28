/**
 * PreviewLayoutPano — Sprint 6.1
 *
 * Preview visual LEVE da distribuição de módulos num pano (SVG schematic).
 * Não é renderização pesada nem layout elétrico — apenas fileiras × colunas
 * para comunicar ocupação/orientação. Lê o layout_preview do geoEngine.
 */
export default function PreviewLayoutPano({ pano, compacto = false }) {
  const lp = pano?.layout_preview
  if (!lp || !lp.colunas || !lp.fileiras) {
    return <div className="text-xs text-slate-400">Sem preview (defina área e orientação).</div>
  }

  const cols = Math.min(lp.colunas, 40)
  const rows = Math.min(lp.fileiras, 30)
  const retrato = (pano.orientacao_modulo || 'retrato') !== 'paisagem'
  // Dimensões do "módulo" no desenho (retrato = mais alto que largo)
  const mw = retrato ? 10 : 16
  const mh = retrato ? 16 : 10
  const gap = 2
  const W = cols * (mw + gap) + gap
  const H = rows * (mh + gap) + gap
  const cor = '#2563eb'

  const rects = []
  let restante = lp.modulos
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (restante <= 0) break
      rects.push(
        <rect key={`${r}-${c}`} x={gap + c * (mw + gap)} y={gap + r * (mh + gap)}
          width={mw} height={mh} rx={1.5} fill={cor} fillOpacity={0.85} stroke="#1e40af" strokeWidth={0.5} />
      )
      restante--
    }
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={compacto ? 70 : 110}
        preserveAspectRatio="xMidYMid meet" style={{ background: '#eef2ff', borderRadius: 6 }}>
        {rects}
      </svg>
      <p className="text-[11px] text-slate-500 mt-1">
        {lp.fileiras} fileira(s) × {lp.colunas} módulo(s) · {lp.modulos} módulos ({pano.orientacao_modulo || 'retrato'})
      </p>
    </div>
  )
}
