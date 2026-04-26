import { useState } from 'react'

const PALETAS = [
  '#f97316','#ef4444','#8b5cf6','#3b82f6','#06b6d4',
  '#10b981','#eab308','#ec4899','#6366f1','#14b8a6',
  '#0f172a','#1e293b','#374151','#4b5563','#6b7280',
]

export default function ColorPicker({ rotulo, valor, onChange }) {
  const [mostrarPaleta, setMostrarPaleta] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      {rotulo && <label className="text-sm font-medium text-slate-700">{rotulo}</label>}
      <div className="flex items-center gap-3">
        {/* Cor atual + input nativo */}
        <div className="relative">
          <div
            className="w-10 h-10 rounded-lg border-2 border-slate-200 cursor-pointer shadow-sm"
            style={{ backgroundColor: valor }}
            onClick={() => setMostrarPaleta(p => !p)}
          />
          <input
            type="color"
            value={valor}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>

        {/* Hex input */}
        <input
          type="text"
          value={valor}
          onChange={e => {
            const v = e.target.value
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v)
          }}
          maxLength={7}
          className="w-28 px-3 py-2 text-sm font-mono rounded-lg border border-slate-300
                     focus:outline-none focus:ring-2 focus:ring-primary-400"
          placeholder="#f97316"
        />

        {/* Preview */}
        <div
          className="px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm transition-colors"
          style={{ backgroundColor: valor }}
        >
          Exemplo
        </div>
      </div>

      {/* Paleta rápida */}
      <div className="flex flex-wrap gap-2 mt-1">
        {PALETAS.map(cor => (
          <button
            key={cor}
            onClick={() => onChange(cor)}
            className={`w-7 h-7 rounded-md transition-all hover:scale-110 ${
              valor === cor ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
            }`}
            style={{ backgroundColor: cor }}
            title={cor}
          />
        ))}
      </div>
    </div>
  )
}
