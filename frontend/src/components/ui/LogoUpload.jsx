import { useRef, useState } from 'react'
import { Upload, X, Image } from 'lucide-react'

const MAX_BYTES = 200 * 1024 // 200 KB recomendado para PDF

export default function LogoUpload({ logo, onLogo, onRemover }) {
  const inputRef = useRef()
  const [erro, setErro] = useState('')

  function processar(file) {
    setErro('')
    if (!file.type.startsWith('image/')) {
      setErro('Use uma imagem (PNG, JPG, SVG, WEBP)')
      return
    }
    if (file.size > 500 * 1024) {
      setErro('Imagem muito grande. Máximo recomendado: 200 KB (para PDFs)')
    }
    const reader = new FileReader()
    reader.onload = e => onLogo(e.target.result) // base64
    reader.readAsDataURL(file)
  }

  if (logo) {
    return (
      <div className="flex items-center gap-4 p-4 border-2 border-emerald-200 rounded-xl bg-emerald-50">
        <img
          src={logo}
          alt="Logo da empresa"
          className="h-16 w-auto max-w-[160px] object-contain rounded border border-slate-200 bg-white p-2"
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-900">Logo carregado</p>
          <p className="text-xs text-slate-500 mt-0.5">Aparecerá na sidebar, PDFs e unifilares</p>
        </div>
        <button
          onClick={onRemover}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current.click()}
        className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center
                   gap-3 hover:border-primary-400 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="p-3 rounded-full bg-slate-100">
          <Image size={24} className="text-slate-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-900">Clique para fazer upload do logo</p>
          <p className="text-xs text-slate-500 mt-1">PNG, JPG, SVG ou WEBP • Recomendado: fundo transparente (PNG)</p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={e => e.target.files[0] && processar(e.target.files[0])}
      />
      {erro && <p className="text-xs text-amber-600 mt-2 flex items-center gap-1"><Upload size={12}/>{erro}</p>}
    </div>
  )
}
