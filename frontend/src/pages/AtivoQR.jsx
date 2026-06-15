// P1-ASSET-QR-CODE-01 — Página pública de visualização do Ativo por QR (uso em campo).
// Rota: /ativo/:qr — lê /api/ativos/qr/:qr (somente leitura; não altera projeto/Atlas/arranjos).
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const STATUS_COR = {
  planejado: 'bg-slate-100 text-slate-700',
  instalado: 'bg-blue-100 text-blue-700',
  operacional: 'bg-green-100 text-green-700',
  manutencao: 'bg-amber-100 text-amber-700',
  substituido: 'bg-purple-100 text-purple-700',
  desativado: 'bg-red-100 text-red-700',
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-sm">{rotulo}</span>
      <span className="text-slate-900 text-sm font-medium text-right">{valor ?? '—'}</span>
    </div>
  )
}

export default function AtivoQR() {
  const { qr } = useParams()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCarregando(true); setErro(null)
    fetch(`/api/ativos/qr/${encodeURIComponent(qr)}`)
      .then(async (r) => {
        if (!vivo) return
        if (r.status === 404) { setErro('QR não encontrado'); return }
        if (!r.ok) { setErro('Erro ao consultar o ativo'); return }
        setDados(await r.json())
      })
      .catch(() => vivo && setErro('Falha de conexão'))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [qr])

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <div className="text-xs font-semibold tracking-widest text-emerald-600">FORTE SOLAR · GÊMEO DIGITAL</div>
          <div className="font-mono text-lg font-bold text-slate-800">{qr}</div>
        </div>

        {carregando && <div className="text-center text-slate-500 py-10">Carregando…</div>}
        {erro && (
          <div className="bg-white rounded-2xl shadow p-6 text-center">
            <div className="text-4xl mb-2">🔍</div>
            <div className="text-red-600 font-semibold">{erro}</div>
            <div className="text-slate-500 text-sm mt-1">Verifique o código {qr}.</div>
          </div>
        )}

        {dados && !erro && (
          <div className="space-y-4">
            {/* QR + status */}
            <div className="bg-white rounded-2xl shadow p-5 flex flex-col items-center">
              <img
                src={`/api/ativos/qr/${encodeURIComponent(qr)}/render.svg`}
                alt={`QR ${qr}`} width={200} height={200}
                className="border border-slate-100 rounded-lg"
              />
              <span className={`mt-3 px-3 py-1 rounded-full text-xs font-semibold uppercase ${STATUS_COR[dados.ativo?.status] || 'bg-slate-100 text-slate-600'}`}>
                {dados.ativo?.status || '—'}
              </span>
            </div>

            {/* Equipamento (as-built) */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Equipamento (instalado)</div>
              <div className="text-lg font-bold text-slate-900">{dados.ativo?.fabricante} {dados.ativo?.modelo}</div>
              <div className="mt-2">
                <Linha rotulo="Tipo" valor={dados.ativo?.tipo} />
                <Linha rotulo="Quantidade" valor={dados.ativo?.quantidade} />
                <Linha rotulo="Nº de série" valor={dados.ativo?.numero_serie} />
                <Linha rotulo="Topologia" valor={dados.ativo?.topologia} />
                <Linha rotulo="Garantia até" valor={dados.ativo?.garantia_fim ? new Date(dados.ativo.garantia_fim).toLocaleDateString('pt-BR') : null} />
              </div>
            </div>

            {/* Projeto + Arranjo (multiarranjo preservado) */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Projeto / Arranjo</div>
              <Linha rotulo="Projeto" valor={dados.projeto?.nome} />
              <Linha rotulo="Cliente" valor={dados.projeto?.cliente} />
              <Linha rotulo="Arranjo" valor={dados.arranjo?.rotulo || dados.arranjo?.id} />
              <Linha rotulo="Arranjos no projeto" valor={dados.total_arranjos_projeto || (dados.arranjo ? 1 : 0)} />
            </div>

            {/* Catálogo (as-specified) */}
            {dados.equipamento_catalogo && (
              <div className="bg-white rounded-2xl shadow p-5">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Catálogo (Atlas)</div>
                <Linha rotulo="Modelo" valor={`${dados.equipamento_catalogo.fabricante} ${dados.equipamento_catalogo.modelo}`} />
                <Linha rotulo="Qualidade" valor={dados.equipamento_catalogo.qualidade?.nivel} />
              </div>
            )}

            {/* Histórico */}
            {dados.ativo?.historico?.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-5">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Histórico</div>
                {dados.ativo.historico.map((h, i) => (
                  <div key={i} className="text-sm text-slate-600 py-1 border-b border-slate-100 last:border-0">
                    <span className="font-medium text-slate-800">{h.tipo}</span>
                    {h.descricao ? ` — ${h.descricao}` : ''}
                    <span className="text-slate-400"> · {h.data ? new Date(h.data).toLocaleDateString('pt-BR') : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
