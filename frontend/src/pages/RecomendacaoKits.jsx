/**
 * RecomendacaoKits.jsx — S2.14 Passo 6
 *
 * Página do Motor de Recomendação de Kits FV.
 * Wrapper de layout para o componente BuscaKitsFV.
 */

import BuscaKitsFV from '../components/fv/BuscaKitsFV'
import { Sun, Info } from 'lucide-react'

export default function RecomendacaoKits() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-blue-100 rounded-2xl flex-shrink-0">
          <Sun className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recomendação de Kits FV</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Análise determinística de {'{'}paineis{'}'}  × inversores do catálogo técnico.
            Pontuação matemática auditável — sem IA, sem LLM.
          </p>
        </div>
      </div>

      {/* Aviso metodológico */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
        <span>
          <strong>Análise read-only.</strong> Os kits recomendados são calculados em memória
          a partir do catálogo local. Nenhum dado é persistido.
          A pontuação é baseada em 4 critérios ponderados: técnico (35%), comercial (35%),
          semântico (20%) e engenharia (10%).
        </span>
      </div>

      {/* Motor de busca */}
      <BuscaKitsFV />
    </div>
  )
}
