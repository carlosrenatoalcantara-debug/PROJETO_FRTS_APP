import { useState } from 'react'
import { Copy, Check, Download, FileText } from 'lucide-react'
import Button from '../ui/Button'
import { gerarMemorialCalculo } from '../../data/templatesHomologacao'
import { gerarPdfHomologacao } from '../../utils/gerarPdfHomologacao'

export default function MemorialCalculo({ dados }) {
  const [copiado, setCopiado] = useState(false)
  const texto = gerarMemorialCalculo(dados)

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  function baixarPdf() {
    const doc = gerarPdfHomologacao({ tipo: 'memorial', dados, texto })
    doc.save(`memorial-calculo-${Date.now()}.pdf`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-slate-600" />
          <div>
            <h3 className="font-semibold text-slate-900">Memorial Descritivo e de Cálculo</h3>
            <p className="text-xs text-slate-500">ABNT NBR 16690:2019 · gerado automaticamente</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" tamanho="sm" icone={copiado ? Check : Copy} onClick={copiar}>
            {copiado ? 'Copiado!' : 'Copiar'}
          </Button>
          <Button tamanho="sm" icone={Download} onClick={baixarPdf}>
            PDF
          </Button>
        </div>
      </div>

      <div className="p-1 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 px-3 py-2">
        ⚠️ Modelo orientativo. Revisar e assinar com CREA ativo antes de submeter à concessionária.
      </div>

      <pre className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs font-mono
                      text-slate-800 whitespace-pre-wrap overflow-auto max-h-[520px] leading-relaxed">
        {texto}
      </pre>
    </div>
  )
}
