const ESTRUTURAS = [
  { id: 'fbco', tipo: 'Fibrocimento', descricao: 'Estrutura + gancho (fibrocimento)', garantia: 10 },
  { id: 'cera', tipo: 'Cerâmico', descricao: 'Gancho para telha cerâmica', garantia: 10 },
  { id: 'meta', tipo: 'Metálico', descricao: 'Grampo/parafuso para metal', garantia: 10 },
  { id: 'mini', tipo: 'Mini Trilho', descricao: 'Estrutura com mini trilho', garantia: 12 },
  { id: 'solo', tipo: 'Solo', descricao: 'Estrutura fixa no solo', garantia: 15 },
]

export default function SeletorEstrutura({ onSelecionar, selecionado }) {
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-slate-900">Tipo de Estrutura</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ESTRUTURAS.map(est => (
          <div
            key={est.id}
            onClick={() => onSelecionar(est)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selecionado?.id === est.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{est.tipo}</p>
                <p className="text-xs text-slate-600 mt-1">{est.descricao}</p>
                <p className="text-xs text-slate-500 mt-2">Garantia: {est.garantia} anos</p>
              </div>
              {selecionado?.id === est.id && (
                <div className="text-green-600 font-bold text-lg">✓</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
