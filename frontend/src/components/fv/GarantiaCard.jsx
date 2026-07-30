// P5-GARANTIA-SIMPLES-01 — card de garantia do ativo (leitura; sem chamados, sem workflow)
// Exibe: fabricante, datas, status, contato de suporte e portal do fabricante.

const DIA_MS = 24 * 60 * 60 * 1000

function diasRestantes(garantia_fim) {
  if (!garantia_fim) return null
  return Math.floor((new Date(garantia_fim).getTime() - Date.now()) / DIA_MS)
}

function statusGarantia(dias) {
  if (dias === null) return null
  if (dias <= 0)  return { label: 'VENCIDA',                cor: 'bg-red-100 text-red-700',   borda: 'border-red-200' }
  if (dias <= 90) return { label: 'PRÓXIMA DO VENCIMENTO',  cor: 'bg-amber-100 text-amber-700', borda: 'border-amber-200' }
  return               { label: 'ATIVA',                    cor: 'bg-green-100 text-green-700', borda: 'border-green-200' }
}

function LinkSuporte({ href, children }) {
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-blue-600 underline text-sm break-all">{children}</a>
  )
}

function Linha({ rotulo, valor }) {
  if (!valor) return null
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-sm shrink-0">{rotulo}</span>
      <span className="text-slate-900 text-sm font-medium text-right break-all">{valor}</span>
    </div>
  )
}

export default function GarantiaCard({ ativo, equipamento }) {
  const fim  = ativo?.garantia_fim
  const ini  = ativo?.garantia_inicio
  const dias = diasRestantes(fim)
  const st   = statusGarantia(dias)

  const suporte = equipamento?.suporte || null
  const temContato = suporte?.telefone || suporte?.email || suporte?.site || suporte?.portal_garantia

  // Se não há nenhuma informação de garantia nem contato, não renderiza o card
  const temGarantia = fim || ini
  if (!temGarantia && !temContato) return null

  return (
    <div className={`bg-white rounded-2xl shadow p-5 border ${st?.borda || 'border-transparent'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-slate-400 uppercase">Garantia</div>
        {st && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st.cor}`}>{st.label}</span>
        )}
      </div>

      {/* Datas */}
      {(ini || fim) && (
        <div className="mb-3">
          <Linha rotulo="Início" valor={ini ? new Date(ini).toLocaleDateString('pt-BR') : null} />
          <Linha rotulo="Vencimento" valor={fim ? new Date(fim).toLocaleDateString('pt-BR') : null} />
          {dias !== null && (
            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <span className="text-slate-500 text-sm">Dias restantes</span>
              <span className={`text-sm font-bold ${dias <= 0 ? 'text-red-600' : dias <= 90 ? 'text-amber-600' : 'text-green-700'}`}>
                {dias <= 0 ? `Vencida há ${Math.abs(dias)} dia(s)` : `${dias} dia(s)`}
              </span>
            </div>
          )}
          {ativo?.origem_garantia === 'auto_catalogo' && (
            <div className="text-xs text-slate-400 mt-1">Calculada automaticamente pelo catálogo</div>
          )}
        </div>
      )}

      {/* Contato de suporte */}
      {temContato && (
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Suporte fabricante</div>
          {suporte?.telefone && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 text-sm shrink-0">Telefone</span>
              <a href={`tel:${suporte.telefone}`} className="text-blue-600 text-sm font-medium">{suporte.telefone}</a>
            </div>
          )}
          {suporte?.email && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 text-sm shrink-0">E-mail</span>
              <a href={`mailto:${suporte.email}`} className="text-blue-600 text-sm break-all">{suporte.email}</a>
            </div>
          )}
          {suporte?.site && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 text-sm shrink-0">Site</span>
              <LinkSuporte href={suporte.site}>{suporte.site.replace(/^https?:\/\//, '')}</LinkSuporte>
            </div>
          )}
          {suporte?.portal_garantia && (
            <a href={suporte.portal_garantia} target="_blank" rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 font-semibold py-2.5 rounded-xl text-sm">
              🛡 Abrir Portal de Garantia
            </a>
          )}
        </div>
      )}
    </div>
  )
}
