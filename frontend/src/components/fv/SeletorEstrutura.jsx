/**
 * SeletorEstrutura.jsx — FV-09: adicionado precoUnitario (por painel) para E8.
 */

const ESTRUTURAS = [
  { id: 'fbco', tipo: 'Fibrocimento',  descricao: 'Estrutura + gancho (fibrocimento)',      garantia: 10, precoUnitario: 120 },
  { id: 'cera', tipo: 'Cerâmico',      descricao: 'Gancho para telha cerâmica',             garantia: 10, precoUnitario: 130 },
  { id: 'meta', tipo: 'Metálico',      descricao: 'Grampo/parafuso para cobertura metálica',garantia: 10, precoUnitario: 110 },
  { id: 'mini', tipo: 'Mini Trilho',   descricao: 'Estrutura com mini trilho',              garantia: 12, precoUnitario: 150 },
  { id: 'laje', tipo: 'Laje',          descricao: 'Estrutura com lastro para laje plana',   garantia: 10, precoUnitario: 160 },
  { id: 'solo', tipo: 'Solo',          descricao: 'Estrutura fixada no solo (ground mount)', garantia: 15, precoUnitario: 250 },
]

export default function SeletorEstrutura({ onSelecionar, selecionado }) {
  return (
    <div className="space-y-4 pt-2">
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
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-slate-500">Garantia: {est.garantia} anos</span>
                  <span className="text-emerald-700 font-medium">≈ R$ {est.precoUnitario}/painel</span>
                </div>
              </div>
              {selecionado?.id === est.id && (
                <div className="text-green-600 font-bold text-lg ml-3 shrink-0">✓</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
