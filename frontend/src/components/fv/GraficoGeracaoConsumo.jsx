// Gráfico SVG de barras agrupadas: Consumo vs Geração estimada (12 meses)
export default function GraficoGeracaoConsumo({ dados, corPrimaria = '#f97316' }) {
  if (!dados?.length) return null

  const W   = 580
  const H   = 210
  const PL  = 50   // padding left (eixo Y)
  const PB  = 36   // padding bottom (labels)
  const PT  = 16   // padding top
  const PR  = 12   // padding right
  const cW  = W - PL - PR
  const cH  = H - PB - PT

  const maxVal  = Math.max(...dados.map(d => Math.max(d.gerado, d.consumo))) * 1.18
  const grupoW  = cW / dados.length
  const barW    = Math.max(6, grupoW * 0.36)
  const gap     = 3

  const fy = (v) => PT + cH - (v / maxVal) * cH
  const fh = (v) => Math.max(0, (v / maxVal) * cH)

  // grades horizontais em 4 níveis
  const grades = [0.25, 0.5, 0.75, 1].map(p => ({
    y:   PT + cH * (1 - p),
    val: Math.round(maxVal * p),
  }))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Gráfico de geração vs consumo mensal"
    >
      {/* Grades */}
      {grades.map(({ y, val }) => (
        <g key={val}>
          <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
          <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
            {val}
          </text>
        </g>
      ))}

      {/* Linha do eixo X */}
      <line x1={PL} y1={PT + cH} x2={W - PR} y2={PT + cH} stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Barras */}
      {dados.map((d, i) => {
        const cx   = PL + i * grupoW + grupoW / 2
        const x1   = cx - barW - gap / 2
        const x2   = cx + gap / 2

        const hC   = fh(d.consumo)
        const hG   = fh(d.gerado)
        const excede = d.gerado >= d.consumo

        return (
          <g key={d.mes}>
            {/* Barra consumo */}
            <rect
              x={x1} y={fy(d.consumo)}
              width={barW} height={hC}
              fill="#cbd5e1" rx="2"
            >
              <title>Consumo {d.mes}: {d.consumo} kWh</title>
            </rect>

            {/* Barra geração */}
            <rect
              x={x2} y={fy(d.gerado)}
              width={barW} height={hG}
              fill={excede ? '#10b981' : corPrimaria}
              opacity="0.88"
              rx="2"
            >
              <title>Geração {d.mes}: {d.gerado} kWh</title>
            </rect>

            {/* Label do mês */}
            <text
              x={cx} y={H - PB + 14}
              textAnchor="middle" fontSize="10" fill="#64748b"
            >
              {d.mes}
            </text>
          </g>
        )
      })}

      {/* Legenda */}
      <rect x={PL} y={H - 14} width={10} height={9} fill="#cbd5e1" rx="2" />
      <text x={PL + 14} y={H - 6} fontSize="11" fill="#64748b">Consumo</text>

      <rect x={PL + 85} y={H - 14} width={10} height={9} fill={corPrimaria} rx="2" opacity="0.88" />
      <text x={PL + 99} y={H - 6} fontSize="11" fill="#64748b">Geração estimada</text>

      <rect x={PL + 215} y={H - 14} width={10} height={9} fill="#10b981" rx="2" />
      <text x={PL + 229} y={H - 6} fontSize="11" fill="#64748b">Excede consumo</text>
    </svg>
  )
}
