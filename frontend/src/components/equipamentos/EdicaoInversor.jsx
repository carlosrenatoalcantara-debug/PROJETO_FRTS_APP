import { useState } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import CamposAgrupados from './CamposAgrupados'
import { aplicarCampo, classificarCampos, errosDeCampos, STATUS } from '@fortesolar/fv-shared/ai/campos-equipamento'
import { ehMicroinversor } from '@fortesolar/fv-shared/inversores/dicionario'

const COR = { [STATUS.OK]: 'text-emerald-500', [STATUS.AUSENTE]: 'text-amber-500', [STATUS.OBRIGATORIO]: 'text-red-500' }
const marcador = (c) => (c.status === STATUS.OK
  ? <CheckCircle size={13} className={COR[c.status]} />
  : <AlertCircle size={13} className={COR[c.status]} />)

/**
 * Edição de inversor/micro. P1-INV-UI-01: os campos vêm do esquema único
 * (camposEquipamento). Abre na página de Inversores e também dentro da topologia
 * de micros, para corrigir o cadastro sem sair do projeto.
 */
export default function EdicaoInversor({ inversor, onClose, onSalvar }) {
  const [form, setForm] = useState({ ...inversor })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  const espec = form.especificacoes || {}
  const micro = espec.subtipo === 'microinversor' || ehMicroinversor(espec, { fabricante: form.fabricante, modelo: form.modelo })
  const campos = classificarCampos('inversor', espec, {}, { micro })

  async function salvar() {
    if (!form.fabricante || !form.modelo) { setErro('Preencha fabricante e modelo.'); return }
    const invalidos = errosDeCampos(campos)
    if (invalidos.length) { setErro(invalidos.join(' ')); return }
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/equipamentos/${inversor._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) throw new Error(corpo?.erro || `Erro ${res.status} ao salvar.`)
      onSalvar(corpo)
    } catch (e) { setErro(e.message || 'Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  const campoTopo = (rotulo, key) => (
    <div>
      <label htmlFor={`inv-${key}`} className="text-xs font-medium text-slate-600 block mb-1">{rotulo}</label>
      <input id={`inv-${key}`} value={form[key] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
    </div>
  )

  return (
    <div role="dialog" aria-label="Editar Inversor" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <h2 className="font-bold text-slate-900">Editar Inversor</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {campoTopo('Fabricante', 'fabricante')}
            {campoTopo('Modelo', 'modelo')}
          </div>
          <CamposAgrupados tipo="inversor" campos={campos} marcador={marcador}
            aoMudar={(c, v) => setForm((f) => ({ ...f, especificacoes: aplicarCampo(f.especificacoes, c, v) }))} />
        </div>
        {erro && <p role="alert" className="px-5 pt-3 text-sm text-red-600">{erro}</p>}
        <div className="p-5 border-t flex justify-end gap-3 shrink-0">
          <Button onClick={onClose} variante="secundario">Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </Card>
    </div>
  )
}
