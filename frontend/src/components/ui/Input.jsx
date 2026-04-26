export default function Input({
  rotulo,
  erro,
  icone: Icone,
  className = '',
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {rotulo && (
        <label className="text-sm font-medium text-slate-700">
          {rotulo}
        </label>
      )}
      <div className="relative">
        {Icone && (
          <Icone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
        <input
          className={`
            w-full px-3 py-2 text-sm rounded-lg border bg-white
            placeholder:text-slate-400 text-slate-900
            focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
            disabled:bg-slate-50 disabled:text-slate-500
            transition-colors
            ${erro ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'}
            ${Icone ? 'pl-9' : ''}
          `}
          {...props}
        />
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  )
}
