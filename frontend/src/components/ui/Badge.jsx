const cores = {
  verde:    'bg-emerald-100 text-emerald-700',
  amarelo:  'bg-amber-100 text-amber-700',
  vermelho: 'bg-red-100 text-red-700',
  azul:     'bg-blue-100 text-blue-700',
  cinza:    'bg-slate-100 text-slate-600',
  laranja:  'bg-orange-100 text-orange-700',
}

export default function Badge({ children, cor = 'cinza', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cores[cor]} ${className}`}>
      {children}
    </span>
  )
}
