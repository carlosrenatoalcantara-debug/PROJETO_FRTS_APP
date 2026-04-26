export default function Tabs({ abas, abaAtiva, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 border-b border-slate-200 ${className}`}>
      {abas.map(aba => (
        <button
          key={aba.id}
          onClick={() => onChange(aba.id)}
          className={`
            flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg
            border-b-2 -mb-px transition-colors
            ${abaAtiva === aba.id
              ? 'border-[var(--cor-primaria,#f97316)] text-[var(--cor-primaria,#f97316)] bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }
          `}
        >
          {aba.icone && <aba.icone size={15} />}
          {aba.rotulo}
        </button>
      ))}
    </div>
  )
}
