import { useRef, useState } from 'react'
import { Upload, FileText, Image, X } from 'lucide-react'

const ACEITOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const LEGENDA  = 'PDF, JPG, PNG ou WEBP • máx. 10 MB'

export default function Dropzone({ arquivo, nomeArquivo, onArquivo, onRemover }) {
  const [arrastando, setArrastando] = useState(false)
  const [erro, setErro] = useState('')
  const inputRef = useRef()

  function validarEDefinir(file) {
    setErro('')
    if (!ACEITOS.includes(file.type)) {
      setErro('Tipo de arquivo não suportado. Use PDF, JPG, PNG ou WEBP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErro('Arquivo muito grande. Máximo 10 MB.')
      return
    }
    onArquivo(file, file.name)
  }

  const onDragOver  = (e) => { e.preventDefault(); setArrastando(true)  }
  const onDragLeave = ()  => setArrastando(false)
  const onDrop      = (e) => { e.preventDefault(); setArrastando(false); validarEDefinir(e.dataTransfer.files[0]) }
  const onChange    = (e) => { if (e.target.files[0]) validarEDefinir(e.target.files[0]) }

  const isPdf   = arquivo?.type === 'application/pdf'
  const isImagem = arquivo?.type?.startsWith('image/')

  if (arquivo) {
    return (
      <div className="border-2 border-emerald-300 rounded-xl p-6 bg-emerald-50 flex items-center gap-4">
        <div className="p-3 rounded-lg bg-emerald-100">
          {isPdf ? <FileText size={28} className="text-emerald-600" /> : <Image size={28} className="text-emerald-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 truncate">{nomeArquivo}</p>
          <p className="text-sm text-slate-500">{isPdf ? 'Documento PDF' : 'Imagem'} • {(arquivo.size / 1024).toFixed(0)} KB</p>
          {isImagem && (
            <img
              src={URL.createObjectURL(arquivo)}
              alt="preview"
              className="mt-3 max-h-40 rounded-lg border border-slate-200 object-contain"
            />
          )}
        </div>
        <button
          onClick={onRemover}
          className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current.click()}
        className={`
          border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer
          transition-colors select-none
          ${arrastando
            ? 'border-primary-400 bg-primary-50'
            : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
          }
        `}
      >
        <div className={`p-4 rounded-full transition-colors ${arrastando ? 'bg-primary-100' : 'bg-slate-100'}`}>
          <Upload size={28} className={arrastando ? 'text-primary-600' : 'text-slate-400'} />
        </div>
        <div className="text-center">
          <p className="font-medium text-slate-900">
            {arrastando ? 'Solte o arquivo aqui' : 'Arraste o arquivo ou clique para selecionar'}
          </p>
          <p className="text-sm text-slate-500 mt-1">{LEGENDA}</p>
        </div>
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={onChange} />
      </div>
      {erro && <p className="text-sm text-red-600 mt-2">{erro}</p>}
    </div>
  )
}
