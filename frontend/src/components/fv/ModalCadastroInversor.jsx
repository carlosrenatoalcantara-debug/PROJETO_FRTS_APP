import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import AssistenteDatasheet from './AssistenteDatasheet'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

export default function ModalCadastroInversor({ onFechado, onSalvo }) {
  const [aba, setAba] = useState('manual')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [inversor, setInversor] = useState({
    marca: '',
    modelo: '',
    tipoInversor: 'string',
    faseAC: '1',
    potenciaKW: '',
    nMppts: '2',
    nStringsTotal: '4',
    vocMax: '1000',
    mpptMin: '80',
    mpptMax: '950',
    imaxMppt: '15',
    garantia: '10',
  })

  function atualizarCampo(campo, valor) {
    setInversor(prev => ({ ...prev, [campo]: valor }))
    setErro('')
  }

  function atualizarComExtracao(dadosExtraidos) {
    setInversor(prev => ({
      ...prev,
      ...Object.entries(dadosExtraidos).reduce((acc, [k, v]) => {
        const mapa = {
          potenciaKW: 'potenciaKW',
          vocMax: 'vocMax',
          mpptMin: 'mpptMin',
          mpptMax: 'mpptMax',
          imaxMppt: 'imaxMppt',
          nMppts: 'nMppts',
          garantia: 'garantia',
        }
        acc[mapa[k] || k] = v || prev[k] || ''
        return acc
      }, {}),
    }))
    setAba('manual')
  }

  async function salvar() {
    if (!inversor.marca || !inversor.modelo || !inversor.potenciaKW) {
      setErro('Marca, modelo e potência são obrigatórios.')
      return
    }

    setCarregando(true)
    try {
      const res = await fetch(`${API_URL}/api/datasheet/inversor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inversor),
      })

      if (!res.ok) {
        const erroData = await res.json()
        throw new Error(erroData.erro || 'Erro ao salvar inversor')
      }

      const dados = await res.json()
      onSalvo(dados.inversor)
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
          <h2 className="text-lg font-bold text-slate-900">Cadastrar Inversor</h2>
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
                  value={inversor.marca}
                  onChange={e => atualizarCampo('marca', e.target.value)}
                  placeholder="Ex: Fronius"
                />
                <Input
                  rotulo="Modelo *"
                  value={inversor.modelo}
                  onChange={e => atualizarCampo('modelo', e.target.value)}
                  placeholder="Ex: Primo 5.0-1"
                />
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">Tipo</label>
                  <div className="flex gap-3">
                    {['string', 'micro'].map(tipo => (
                      <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={tipo}
                          checked={inversor.tipoInversor === tipo}
                          onChange={e => atualizarCampo('tipoInversor', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-700 capitalize">
                          {tipo === 'string' ? 'String' : 'Micro'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">Rede</label>
                  <div className="flex gap-3">
                    {['1', '3'].map(fase => (
                      <label key={fase} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={fase}
                          checked={inversor.faseAC === fase}
                          onChange={e => atualizarCampo('faseAC', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-700">
                          {fase === '1' ? 'Monofásico' : 'Trifásico'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <Input
                  rotulo="Potência (kW) *"
                  type="number"
                  step="0.1"
                  value={inversor.potenciaKW}
                  onChange={e => atualizarCampo('potenciaKW', e.target.value)}
                  placeholder="5"
                />
                <Input
                  rotulo="Número de MPPTs"
                  type="number"
                  value={inversor.nMppts}
                  onChange={e => atualizarCampo('nMppts', e.target.value)}
                />
                <Input
                  rotulo="Total de Strings"
                  type="number"
                  value={inversor.nStringsTotal}
                  onChange={e => atualizarCampo('nStringsTotal', e.target.value)}
                />
                <Input
                  rotulo="Voc Máximo (V)"
                  type="number"
                  value={inversor.vocMax}
                  onChange={e => atualizarCampo('vocMax', e.target.value)}
                  placeholder="1000"
                />
                <Input
                  rotulo="MPPT Mínimo (V)"
                  type="number"
                  value={inversor.mpptMin}
                  onChange={e => atualizarCampo('mpptMin', e.target.value)}
                  placeholder="80"
                />
                <Input
                  rotulo="MPPT Máximo (V)"
                  type="number"
                  value={inversor.mpptMax}
                  onChange={e => atualizarCampo('mpptMax', e.target.value)}
                  placeholder="950"
                />
                <Input
                  rotulo="Corrente Máx. MPPT (A)"
                  type="number"
                  step="0.1"
                  value={inversor.imaxMppt}
                  onChange={e => atualizarCampo('imaxMppt', e.target.value)}
                  placeholder="15"
                />
                <Input
                  rotulo="Garantia (anos)"
                  type="number"
                  value={inversor.garantia}
                  onChange={e => atualizarCampo('garantia', e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
          )}

          {/* Aba Datasheet */}
          {aba === 'datasheet' && (
            <AssistenteDatasheet onExtrair={atualizarComExtracao} tipo="inversor" />
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
