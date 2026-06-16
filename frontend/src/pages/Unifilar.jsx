// P1-UNIFILAR-INTERATIVO-01 — Unifilar operacional CLICÁVEL (instalação em campo).
// Rota pública /unifilar/:projetoId. Desenha os AtivoEquipamento do projeto agrupados por
// arranjo (multiarranjo preservado); clicar num símbolo abre /ativo/<qr> (mesmo fluxo de
// comissionamento — não cria fluxo paralelo). Lê só /api/ativos/projeto/:id (não toca ProjetoFV/Atlas).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const STATUS_FILL = {
  planejado: '#e2e8f0', instalado: '#bfdbfe', operacional: '#bbf7d0',
  manutencao: '#fde68a', substituido: '#e9d5ff', desativado: '#fecaca',
}
const STATUS_STROKE = {
  planejado: '#64748b', instalado: '#2563eb', operacional: '#16a34a',
  manutencao: '#d97706', substituido: '#9333ea', desativado: '#dc2626',
}
const PREFIXO = { inversor: 'INV', microinversor: 'MIC', bess: 'BESS', otimizador: 'OTIM', carregador: 'CARR', modulo: 'MOD' }

export default function Unifilar() {
  const { projetoId } = useParams()
  const navigate = useNavigate()
  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCarregando(true); setErro(null)
    fetch(`/api/ativos/projeto/${encodeURIComponent(projetoId)}`)
      .then(async (r) => {
        if (!vivo) return
        if (!r.ok) { setErro('Não foi possível carregar os ativos do projeto'); return }
        const j = await r.json()
        setItens(j.itens || [])
      })
      .catch(() => vivo && setErro('Falha de conexão'))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [projetoId])

  // Agrupa por arranjo + numera por tipo (INV-01, MIC-01, BESS-01, MOD-01…)
  const arranjos = useMemo(() => {
    if (!itens) return []
    const cont = {}
    const codigo = (t) => { cont[t] = (cont[t] || 0) + 1; return `${PREFIXO[t] || 'EQP'}-${String(cont[t]).padStart(2, '0')}` }
    const porArr = new Map()
    // ordena para numeração estável (módulos, depois inversores/micro, depois bess)
    const ordem = { modulo: 0, inversor: 1, microinversor: 1, bess: 2, otimizador: 3, carregador: 4 }
    const ordenados = [...itens].sort((a, b) => (ordem[a.tipo] ?? 9) - (ordem[b.tipo] ?? 9))
    for (const it of ordenados) {
      const arr = it.arranjo_id || '(sem arranjo)'
      if (!porArr.has(arr)) porArr.set(arr, { arranjo_id: arr, modulos: [], inversores: [], bess: [] })
      const g = porArr.get(arr)
      const item = { ...it, codigo: codigo(it.tipo) }
      if (it.tipo === 'modulo') g.modulos.push(item)
      else if (it.tipo === 'bess') g.bess.push(item)
      else g.inversores.push(item)
    }
    return [...porArr.values()]
  }, [itens])

  const abrir = (it) => navigate(`/ativo/${encodeURIComponent(it.qr_code)}`)

  function Simbolo({ it, x, y, w = 150, h = 54 }) {
    const fill = STATUS_FILL[it.status] || '#e2e8f0'
    const stroke = STATUS_STROKE[it.status] || '#64748b'
    return (
      <g onClick={() => abrir(it)} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
         onKeyDown={(e) => (e.key === 'Enter') && abrir(it)}>
        {/* alvo de toque amplo (mobile) */}
        <rect x={x} y={y} width={w} height={h} rx={10} fill={fill} stroke={stroke} strokeWidth={2} />
        <text x={x + w / 2} y={y + 20} textAnchor="middle" fontSize="15" fontWeight="700" fill="#0f172a">{it.codigo}</text>
        <text x={x + w / 2} y={y + 38} textAnchor="middle" fontSize="11" fill="#334155">
          {`${it.fabricante || ''} ${it.modelo || ''}`.trim().slice(0, 22)}
        </text>
      </g>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-3">
          <div className="text-xs font-semibold tracking-widest text-emerald-600">FORTE SOLAR · UNIFILAR OPERACIONAL</div>
          <div className="text-slate-500 text-sm">Toque no equipamento para comissionar</div>
        </div>

        {carregando && <div className="text-center text-slate-500 py-10">Carregando…</div>}
        {erro && <div className="bg-white rounded-2xl shadow p-6 text-center text-red-600">{erro}</div>}
        {itens && itens.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-6 text-center text-slate-500">
            Nenhum ativo gerado para este projeto.
          </div>
        )}

        {arranjos.map((g, gi) => {
          const linhas = Math.max(g.modulos.length, 1) + g.inversores.length + g.bess.length
          const alturaSvg = 70 + linhas * 78 + 60
          let y = 16
          return (
            <div key={g.arranjo_id} className="bg-white rounded-2xl shadow p-3 mb-4">
              <div className="text-xs font-semibold text-slate-400 uppercase px-1 mb-1">
                Arranjo {gi + 1} <span className="font-mono text-[10px] text-slate-300">{g.arranjo_id}</span>
              </div>
              <svg viewBox={`0 0 320 ${alturaSvg}`} width="100%" style={{ touchAction: 'manipulation' }}>
                {/* Módulos (topo) */}
                {g.modulos.map((m, i) => { const yy = y + i * 78; return (
                  <g key={m._id}>
                    <Simbolo it={m} x={85} y={yy} />
                    <text x={235} y={yy + 30} fontSize="11" fill="#64748b">×{m.quantidade || 1}</text>
                    <line x1="160" y1={yy + 54} x2="160" y2={yy + 78} stroke="#94a3b8" strokeWidth="2" />
                  </g>
                )})}
                {/* Inversores / micro */}
                {g.inversores.map((inv, i) => { const yy = y + Math.max(g.modulos.length, 1) * 78 + i * 78; return (
                  <g key={inv._id}>
                    <Simbolo it={inv} x={85} y={yy} />
                    <line x1="160" y1={yy + 54} x2="160" y2={yy + 78} stroke="#94a3b8" strokeWidth="2" />
                  </g>
                )})}
                {/* BESS */}
                {g.bess.map((b, i) => { const yy = y + (Math.max(g.modulos.length,1) + g.inversores.length) * 78 + i * 78; return (
                  <g key={b._id}><Simbolo it={b} x={85} y={yy} />
                    <line x1="160" y1={yy + 54} x2="160" y2={yy + 78} stroke="#94a3b8" strokeWidth="2" /></g>
                )})}
                {/* Rede / medidor (base) */}
                {(() => { const yy = y + linhas * 78; return (
                  <g>
                    <rect x={110} y={yy} width={100} height={40} rx={8} fill="#f1f5f9" stroke="#475569" strokeWidth="2" />
                    <text x={160} y={yy + 25} textAnchor="middle" fontSize="13" fontWeight="700" fill="#334155">REDE</text>
                  </g>
                )})()}
              </svg>
            </div>
          )
        })}

        {/* Legenda */}
        {itens && itens.length > 0 && (
          <div className="bg-white rounded-2xl shadow p-3 text-xs text-slate-500 flex flex-wrap gap-2 justify-center">
            {Object.entries(STATUS_STROKE).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded" style={{ background: STATUS_FILL[k], border: `1.5px solid ${c}` }} />{k}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
