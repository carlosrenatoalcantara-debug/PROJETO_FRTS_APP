import { useState } from 'react'
import { Copy, Check, Download, Award, ExternalLink } from 'lucide-react'
import Button from '../ui/Button'
import { gerarDadosART } from '../../data/templatesHomologacao'
import { gerarPdfHomologacao } from '../../utils/gerarPdfHomologacao'

export default function DadosART({ dados }) {
  const [copiado, setCopiado] = useState(false)
  const texto = gerarDadosART(dados)

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  function baixarPdf() {
    const doc = gerarPdfHomologacao({ tipo: 'art', dados, texto })
    doc.save(`dados-art-${Date.now()}.pdf`)
  }

  const rt = dados.empresa?.responsavelTecnico

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award size={18} className="text-slate-600" />
          <div>
            <h3 className="font-semibold text-slate-900">Dados para ART</h3>
            <p className="text-xs text-slate-500">Roteiro para preenchimento no e-CAT CREA</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" tamanho="sm" icone={copiado ? Check : Copy} onClick={copiar}>
            {copiado ? 'Copiado!' : 'Copiar'}
          </Button>
          <Button tamanho="sm" icone={Download} onClick={baixarPdf}>PDF</Button>
        </div>
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <strong>⚠️ Importante:</strong> Somente o profissional habilitado pode emitir e assinar a ART.
          Este documento é apenas um roteiro de preenchimento.
        </div>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>Links úteis:</strong>
          <div className="mt-1 space-y-1">
            <a href="https://ecat.crea.org.br" target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-blue-600 hover:underline">
              <ExternalLink size={11} /> e-CAT CREA
            </a>
            <a href="https://www.cft.org.br" target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-blue-600 hover:underline">
              <ExternalLink size={11} /> Sistema CFT
            </a>
          </div>
        </div>
      </div>

      {/* Dados do RT */}
      {rt?.nome && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Responsável Técnico (das Configurações)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div><span className="text-slate-500">Nome: </span><strong>{rt.nome}</strong></div>
            <div><span className="text-slate-500">Registro: </span><strong>{rt.tipoRegistro} {rt.registro}/{rt.uf}</strong></div>
          </div>
          {(!rt.nome || !rt.registro) && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ Dados incompletos. Complete em Configurações → Identidade Visual.
            </p>
          )}
        </div>
      )}

      <pre className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs font-mono
                      text-slate-800 whitespace-pre-wrap overflow-auto max-h-[480px] leading-relaxed">
        {texto}
      </pre>
    </div>
  )
}
