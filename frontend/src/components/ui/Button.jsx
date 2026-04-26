const variantes = {
  primario:   'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-400',
  perigo:     'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  fantasma:   'text-slate-700 hover:bg-slate-100 focus:ring-slate-400',
}

const tamanhos = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export default function Button({
  children,
  variante = 'primario',
  tamanho = 'md',
  icone: Icone,
  iconeDir,
  carregando = false,
  className = '',
  ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center gap-2 font-medium rounded-lg
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantes[variante]}
        ${tamanhos[tamanho]}
        ${className}
      `}
      disabled={carregando || props.disabled}
      {...props}
    >
      {carregando && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      )}
      {!carregando && Icone && !iconeDir && <Icone size={16} />}
      {children}
      {!carregando && Icone && iconeDir && <Icone size={16} />}
    </button>
  )
}
