export default function Select({ rotulo, opcoes, erro, className = '', helpText, helptext, ...props }) {
  const ajuda = helpText ?? helptext   // consumido aqui — não repassar ao <select> nativo
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {rotulo && <label className="text-sm font-medium text-slate-700">{rotulo}</label>}
      <select
        className={`
          w-full px-3 py-2 text-sm rounded-lg border bg-white
          text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-400
          focus:border-transparent disabled:bg-slate-50 transition-colors
          ${erro ? 'border-red-400' : 'border-slate-300'}
        `}
        {...props}
      >
        {opcoes.map((op) => (
          <option key={op.valor} value={op.valor}>{op.rotulo}</option>
        ))}
      </select>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {!erro && ajuda && <p className="text-xs text-slate-400">{ajuda}</p>}
    </div>
  )
}
