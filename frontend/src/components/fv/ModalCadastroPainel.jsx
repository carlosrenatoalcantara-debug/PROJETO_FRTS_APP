import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import AssistenteDatasheet from './AssistenteDatasheet'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function ModalCadastroPainel({ onFechado, onSalvo }) {
  const [aba, setAba] = useState('manual') // manual | datasheet
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [painel, setPainel] = useState({
    marca: '',
    modelo: '',
    pmpp: '',
    voc: '',
    vmpp: '',
    isc: '',
    impp: '',
    tempCoefVoc: '-0.28',
    tempCoefPmpp: '-0.35',
    tempCoefIsc: '0.048',
    area: '',
    eficiencia: '',
    garantiaProduto: '12',
    garantiaPerformance: '25',
    percentualPerformance: '80',
  })

  function atualizarCampo(campo, valor) {
    setPainel(prev => ({ ...prev, [campo]: valor }))
    setErro('')
  }

  function atualizarComExtracao(dadosExtraidos) {
    setPainel(prev => ({
      ...prev,
      ...Object.entries(dadosExtraidos).reduce((acc, [k, v]) => {
        const mapa = {
          potenciaW: 'pmpp',
          voc: 'voc',
          vmpp: 'vmpp',
          isc: 'isc',
          impp: 'impp',
          garantia: 'garantiaProduto',
        }
        acc[mapa[k] || k] = v || prev[k] || ''
        return acc
      }, {}),
    }))
    setAba('manual')
  }

  async function salvar() {
    if (!painel.marca || !painel.modelo || !painel.pmpp) {
      setErro('Marca, modelo e potência são obrigatórios.')
      return
    }

    setCarregando(true)
    try {
      const res = await fetch(`${API_URL}/api/datasheet/painel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(painel),
      })

      if (!res.ok) {
        const erroData = await res.json()
        throw new Error(erroData.erro || 'Erro ao salvar painel')
      }

      const dados = await res.json()
      onSalvo(dados.painel)
      onFechado()
    } catch (err) {
      setErro(`Erro: ${err.message}`)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-bold text-slate-900">Cadastrar Painel Fotovoltaico</h2>
          <button
            onClick={onFechado}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex gap-2 p-4 border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setAba('manual')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              aba === 'manual'
                ? 'bg-white border border-blue-300 text-blue-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Preenchimento Manual
          </button>
          <button
            onClick={() => setAba('datasheet')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              aba === 'datasheet'
                ? 'bg-white border border-blue-300 text-blue-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Upload Datasheet
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4">
          {/* Aba Manual */}
          {aba === 'manual' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  rotulo="Fabricante *"
                  value={painel.marca}
                  onChange={e => atualizarCampo('marca', e.target.value)}
                  placeholder="Ex: Canadian Solar"
                />
                <Input
                  rotulo="Modelo *"
                  value={painel.modelo}
                  onChange={e => atualizarCampo('modelo', e.target.value)}
                  placeholder="Ex: CS6W-550MS"
                />
                <Input
                  rotulo="Potência (W) *"
                  type="number"
                  value={painel.pmpp}
                  onChange={e => atualizarCampo('pmpp', e.target.value)}
                  placeholder="550"
                />
                <Input
                  rotulo="Voc (V)"
                  type="number"
                  step="0.1"
                  value={painel.voc}
                  onChange={e => atualizarCampo('voc', e.target.value)}
                  placeholder="49.5"
                />
                <Input
                  rotulo="Vmpp (V)"
                  type="number"
                  step="0.1"
                  value={painel.vmpp}
                  onChange={e => atualizarCampo('vmpp', e.target.value)}
                  placeholder="41.2"
                />
                <Input
                  rotulo="Isc (A)"
                  type="number"
                  step="0.01"
                  value={painel.isc}
                  onChange={e => atualizarCampo('isc', e.target.value)}
                  placeholder="13.90"
                />
                <Input
                  rotulo="Impp (A)"
                  type="number"
                  step="0.01"
                  value={painel.impp}
                  onChange={e => atualizarCampo('impp', e.target.value)}
                  placeholder="13.35"
                />
                <Input
                  rotulo="Área (m²)"
                  type="number"
                  step="0.01"
                  value={painel.area}
                  onChange={e => atualizarCampo('area', e.target.value)}
                  placeholder="2.26"
                />
                <Input
                  rotulo="Eficiência (%)"
                  type="number"
                  step="0.1"
                  value={painel.eficiencia}
                  onChange={e => atualizarCampo('eficiencia', e.target.value)}
                  placeholder="21.4"
                />
                <Input
                  rotulo="Garantia Produto (anos)"
                  type="number"
                  value={painel.garantiaProduto}
                  onChange={e => atualizarCampo('garantiaProduto', e.target.value)}
                />
                <Input
                  rotulo="Garantia Performance (anos)"
                  type="number"
                  value={painel.garantiaPerformance}
                  onChange={e => atualizarCampo('garantiaPerformance', e.target.value)}
                />
                <Input
                  rotulo="Performance aos 25 anos (%)"
                  type="number"
                  step="0.1"
                  value={painel.percentualPerformance}
                  onChange={e => atualizarCampo('percentualPerformance', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Aba Datasheet */}
          {aba === 'datasheet' && (
            <AssistenteDatasheet onExtrair={atualizarComExtracao} tipo="painel" />
          )}

          {erro && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <Button variante="secundario" onClick={onFechado}>Cancelar</Button>
          <Button onClick={salvar} disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar no Catálogo'}
          </Button>
        </div>
      </div>
    </div>
  )
}
