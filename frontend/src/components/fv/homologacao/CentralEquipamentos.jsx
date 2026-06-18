import { Lock, Cpu, PanelTop, Package } from 'lucide-react'
import { obterEquipamentosEngenharia } from '../../../utils/engenhariaGovernanca'

/**
 * P1-CENTRAL-HOMOLOGACAO-MVP — Aba Equipamentos.
 * Reutiliza obterEquipamentosEngenharia() (não duplica lógica de snapshot/freeze).
 * Quando congelado, exibe "DADOS CONGELADOS DO ORÇAMENTO APROVADO".
 */

// Normaliza equipamento (snapshot ou catálogo vivo) → forma uniforme de exibição
function normEquip(eq) {
  if (!eq) return null
  const esp = eq.especificacoes || {}
  return {
    fabricante: eq.fabricante || eq.marca || '—',
    modelo: eq.modelo || '—',
    potencia: esp.potencia ?? eq.potenciaW ?? eq.potencia_w ?? eq.potencia ?? eq.potencia_kw ?? null,
    quantidade: eq.quantidade ?? null,
  }
}

function LinhaEquip({ rotulo, valor }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{rotulo}</span>
      <span className="text-sm font-medium text-slate-900">{valor ?? '—'}</span>
    </div>
  )
}

function CardEquip({ titulo, icone: Icone, eq, unidadePotencia }) {
  const n = normEquip(eq)
  return (
    <div className="border border-slate-200 rounded-lg bg-white">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50 rounded-t-lg">
        <Icone size={16} className="text-indigo-600" />
        <h4 className="text-sm font-semibold text-slate-800">{titulo}</h4>
      </div>
      <div className="px-4 py-1">
        {!n ? (
          <p className="py-3 text-sm text-slate-400">Não informado.</p>
        ) : (
          <>
            <LinhaEquip rotulo="Fabricante" valor={n.fabricante} />
            <LinhaEquip rotulo="Modelo" valor={n.modelo} />
            <LinhaEquip rotulo="Potência" valor={n.potencia != null ? `${n.potencia} ${unidadePotencia}` : null} />
            <LinhaEquip rotulo="Quantidade" valor={n.quantidade} />
          </>
        )}
      </div>
    </div>
  )
}

export default function CentralEquipamentos({ projeto }) {
  const eng = obterEquipamentosEngenharia(projeto)
  const congelado = eng.origem === 'snapshot'
  const adicionais = Array.isArray(eng.itens_adicionais) ? eng.itens_adicionais : []
  const arranjosExtra = Array.isArray(eng.arranjos_extra) ? eng.arranjos_extra : []

  return (
    <div className="space-y-4">
      {congelado ? (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm font-semibold text-emerald-800">
          <Lock size={16} className="shrink-0" />
          DADOS CONGELADOS DO ORÇAMENTO APROVADO
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Projeto não congelado — equipamentos do catálogo atual (podem mudar até o congelamento).
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardEquip titulo="Módulos" icone={PanelTop} eq={eng.modulo} unidadePotencia="Wp" />
        <CardEquip titulo="Inversores" icone={Cpu} eq={eng.inversor} unidadePotencia="kW" />
      </div>

      {arranjosExtra.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Arranjos adicionais</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {arranjosExtra.map((a, i) => (
              <div key={i} className="space-y-2">
                {a.modulo && <CardEquip titulo={`${a.rotulo || 'Arranjo'} — Módulo`} icone={PanelTop} eq={a.modulo} unidadePotencia="Wp" />}
                {a.inversor && <CardEquip titulo={`${a.rotulo || 'Arranjo'} — Inversor`} icone={Cpu} eq={a.inversor} unidadePotencia="kW" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {adicionais.length > 0 && (
        <div className="border border-slate-200 rounded-lg bg-white">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50 rounded-t-lg">
            <Package size={16} className="text-indigo-600" />
            <h4 className="text-sm font-semibold text-slate-800">Itens adicionais</h4>
          </div>
          <div className="px-4 py-2 divide-y divide-slate-100">
            {adicionais.map((item, i) => (
              <div key={i} className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-700">{item.descricao || '—'}</span>
                <span className="text-slate-500">{item.quantidade ?? '—'}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
