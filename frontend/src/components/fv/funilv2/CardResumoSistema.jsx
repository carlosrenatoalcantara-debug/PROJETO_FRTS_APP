import { Sun, Zap, TrendingUp, Calendar, Maximize2, DollarSign } from 'lucide-react'

/**
 * Card de resumo do sistema sugerido (dimensionamento invisível).
 * Recebe o objeto `resultado` do motor de dimensionamento.
 */
export default function CardResumoSistema({ resultado }) {
  if (!resultado) return null

  const itens = [
    { icone: Sun,        rotulo: 'Potência',       valor: `${resultado.potencia_kwp} kWp`, cor: 'text-amber-600 bg-amber-50' },
    { icone: Zap,        rotulo: 'Módulos',        valor: `${resultado.qtd_modulos_estimada}`, sub: '550W ref.', cor: 'text-blue-600 bg-blue-50' },
    { icone: Maximize2,  rotulo: 'Área ocupada',   valor: `${resultado.area_ocupacao_m2} m²`, cor: 'text-slate-600 bg-slate-100' },
    { icone: TrendingUp, rotulo: 'Geração anual',  valor: `${(resultado.geracao_anual_kwh/1000).toFixed(1)} MWh`, cor: 'text-emerald-600 bg-emerald-50' },
    { icone: DollarSign, rotulo: 'Economia/ano',   valor: `R$ ${resultado.economia_anual_r?.toLocaleString('pt-BR')}`, cor: 'text-green-600 bg-green-50' },
    { icone: Calendar,   rotulo: 'Payback',        valor: `${resultado.payback_anos} anos`, sub: `TIR ${(resultado.tir_aa * 100).toFixed(1)}%`, cor: 'text-purple-600 bg-purple-50' },
  ]

  return (
    <div className="bg-gradient-to-br from-blue-50 to-orange-50 border-2 border-blue-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Sistema sugerido pelo dimensionamento automático</h3>
          <p className="text-sm text-slate-500">Cálculo baseado em irradiância local e consumo médio. Ajustes técnicos serão feitos nas próximas etapas.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {itens.map((it, i) => {
          const Icon = it.icone
          return (
            <div key={i} className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded ${it.cor}`}>
                  <Icon size={16} />
                </div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">{it.rotulo}</span>
              </div>
              <div className="font-bold text-slate-900 text-xl">{it.valor}</div>
              {it.sub && <div className="text-xs text-slate-400 mt-0.5">{it.sub}</div>}
            </div>
          )
        })}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-slate-600 hover:text-slate-900 font-medium">⚙️ Detalhes técnicos avançados</summary>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-white/50 p-3 rounded">
          <div><span className="text-slate-500">Geração 25 anos:</span> <span className="font-medium">{(resultado.geracao_25anos_kwh / 1000).toFixed(0)} MWh</span></div>
          <div><span className="text-slate-500">Economia 25 anos:</span> <span className="font-medium">R$ {resultado.economia_25anos_r?.toLocaleString('pt-BR')}</span></div>
          <div><span className="text-slate-500">Custo estimado:</span> <span className="font-medium">R$ {resultado.custo_total_r?.toLocaleString('pt-BR')}</span></div>
          <div><span className="text-slate-500">VPL:</span> <span className="font-medium">R$ {resultado.vpl_r?.toLocaleString('pt-BR')}</span></div>
        </div>
      </details>
    </div>
  )
}
