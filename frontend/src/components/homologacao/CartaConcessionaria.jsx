import { useState } from 'react'
import { Copy, Check, Download, Mail, ExternalLink } from 'lucide-react'
import Button from '../ui/Button'
import Select from '../ui/Select'
import { gerarCartaConcessionaria } from '../../data/templatesHomologacao'
import { gerarPdfHomologacao } from '../../utils/gerarPdfHomologacao'
import { NOMES_CONCESSIONARIAS, getChecklist } from '../../data/checklistsHomologacao'

const OPCOES_CONC = NOMES_CONCESSIONARIAS.map(n => ({ valor: n, rotulo: n }))

export default function CartaConcessionaria({ dados }) {
  const [concessionaria, setConcessionaria] = useState(
    dados.consumo?.concessionaria ?? 'Genérico'
  )
  const [copiado, setCopiado] = useState(false)

  const info    = getChecklist(concessionaria)
  const dadosFull = { ...dados, concessionaria }
  const texto   = gerarCartaConcessionaria(dadosFull)

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  function baixarPdf() {
    const doc = gerarPdfHomologacao({ tipo: 'carta', dados: dadosFull, texto })
    doc.save(`carta-concessionaria-${Date.now()}.pdf`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <Select
          rotulo="Selecionar concessionária"
          opcoes={OPCOES_CONC}
          value={concessionaria}
          onChange={e => setConcessionaria(e.target.value)}
          className="sm:w-72"
        />
        {info.link && (
          <a
            href={info.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline pb-1"
          >
            <ExternalLink size={13} /> Portal da concessionária
          </a>
        )}
      </div>

      {/* Info da concessionária */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div><span className="text-slate-500">Sistema: </span><strong>{info.sistema}</strong></div>
        <div><span className="text-slate-500">Prazo: </span><strong>{info.prazo}</strong></div>
        <div><span className="text-slate-500 block">Obs: </span><span className="text-slate-700">{info.obs}</span></div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-slate-600" />
          <h3 className="font-semibold text-slate-900">Carta de Solicitação de Acesso</h3>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" tamanho="sm" icone={copiado ? Check : Copy} onClick={copiar}>
            {copiado ? 'Copiado!' : 'Copiar'}
          </Button>
          <Button tamanho="sm" icone={Download} onClick={baixarPdf}>PDF</Button>
        </div>
      </div>

      <pre className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs font-mono
                      text-slate-800 whitespace-pre-wrap overflow-auto max-h-[520px] leading-relaxed">
        {texto}
      </pre>
    </div>
  )
}
