import { useState, useEffect } from 'react'
import { TrendingDown, Info } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Input from '../../ui/Input'
import Select from '../../ui/Select'
import Button from '../../ui/Button'
import { consumoMedioDosMeses } from '../../../utils/calcDimensionamento'

const MESES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// FV-03: lista completa das distribuidoras brasileiras por região
const CONCESSIONARIAS = [
  // ── Norte ────────────────────────────────────────────────────────────────────
  'Amazonas Energia (AM)',
  'Boa Vista Energia (RR)',
  'Eletroacre (AC)',
  'Energisa Rondônia (RO)',
  'Energisa Tocantins (TO)',
  'Equatorial Amapá (AP)',
  'Equatorial Pará (PA)',
  // ── Nordeste ─────────────────────────────────────────────────────────────────
  'CELPE / Neoenergia (PE)',
  'COELBA / Neoenergia (BA)',
  'COSERN / Neoenergia (RN)',
  'Enel Ceará (CE)',
  'Energisa Paraíba (PB)',
  'Energisa Sergipe (SE)',
  'Equatorial Alagoas (AL)',
  'Equatorial Maranhão (MA)',
  'Equatorial Piauí (PI)',
  // ── Centro-Oeste ─────────────────────────────────────────────────────────────
  'CEB Distribuição (DF)',
  'Energisa Mato Grosso (MT)',
  'Energisa Mato Grosso do Sul (MS)',
  'Equatorial Goiás (GO)',
  // ── Sudeste ──────────────────────────────────────────────────────────────────
  'CEMIG (MG)',
  'CPFL Energia (SP/RS)',
  'CPFL Paulista (SP)',
  'CPFL Piratininga (SP)',
  'EDP Bandeirante / EDP SP (SP)',
  'EDP Espírito Santo (ES)',
  'Enel Rio (RJ)',
  'Enel São Paulo (SP)',
  'LIGHT (RJ)',
  'Neoenergia Elektro (SP/MS)',
  // ── Sul ──────────────────────────────────────────────────────────────────────
  'CELESC (SC)',
  'COPEL (PR)',
  'Equatorial RS / CEEE (RS)',
  'Neoenergia Gaúcha / RGE (RS)',
  // ── Genéricos ────────────────────────────────────────────────────────────────
  'ENEL (geral)',
  'ENERGISA (geral)',
  'Outra',
].map(v => ({ valor: v, rotulo: v }))

const TIPOS_LIGACAO = [
  { valor: 'monofasico', rotulo: 'Monofásico' },
  { valor: 'bifasico',   rotulo: 'Bifásico'   },
  { valor: 'trifasico',  rotulo: 'Trifásico'  },
]

const TENSOES = [
  { valor: '127', rotulo: '127 V' },
  { valor: '220', rotulo: '220 V' },
  { valor: '380', rotulo: '380 V' },
]

export default function E2Consumo() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const d = state.dadosConsumo
  const [erros, setErros] = useState({})

  // Auto-populate from extracted bill data on component mount
  useEffect(() => {
    if (d.grupoTarifario && !d.concessionaria) {
      // Tentaremos popular concessionária a partir de outros dados se necessário
    }
  }, [])

  function set(campo, valor) {
    dispatch({ type: 'SET_CONSUMO', payload: { [campo]: valor } })
  }

  function setMes(idx, valor) {
    const novos = [...d.consumosMensais]
    novos[idx] = valor
    dispatch({ type: 'SET_CONSUMO', payload: { consumosMensais: novos } })
  }

  function validar() {
    const e = {}
    const consumo = d.usarMeses
      ? consumoMedioDosMeses(d.consumosMensais)
      : Number(d.consumoMensal)

    if (!consumo || consumo <= 0)
      e.consumo = 'Informe o consumo mensal (kWh)'
    if (!d.concessionaria)
      e.concessionaria = 'Informe a concessionária'
    setErros(e)
    return !Object.keys(e).length
  }

  function avancar() {
    if (!validar()) return
    if (d.usarMeses) {
      const media = consumoMedioDosMeses(d.consumosMensais)
      dispatch({ type: 'SET_CONSUMO', payload: { consumoMensal: String(media) } })
    }
    proxima()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Dados de Consumo</h2>
        <p className="text-sm text-slate-500 mt-1">Preencha os dados da fatura de energia do cliente.</p>
      </div>

      {/* Modo de entrada */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <button
          onClick={() => set('usarMeses', false)}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            !d.usarMeses ? 'bg-white shadow text-primary-600 border border-primary-200' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Média Mensal
        </button>
        <button
          onClick={() => set('usarMeses', true)}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            d.usarMeses ? 'bg-white shadow text-primary-600 border border-primary-200' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Por Mês (12 meses)
        </button>
      </div>

      {/* Gráfico de histórico se disponível */}
      {d.historico12Meses && d.historico12Meses.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown size={18} className="text-blue-600" />
            <p className="text-sm font-semibold text-slate-700">Histórico dos últimos {d.historico12Meses.length} meses</p>
          </div>
          {d.mediaAnual && (
            <div className="p-3 bg-white border border-blue-300 rounded-lg">
              <p className="text-sm text-slate-600">Média calculada:</p>
              <p className="text-2xl font-bold text-blue-600">{d.mediaAnual} kWh/mês</p>
            </div>
          )}
          <div className="flex gap-1 items-end h-24">
            {d.historico12Meses.map((m) => (
              <div
                key={m.mes}
                className="flex-1 flex flex-col items-center gap-1"
                title={`${m.mes}: ${m.consumo} kWh`}
              >
                <span className="text-[10px] text-slate-600 font-mono">{m.consumo}</span>
                <div
                  className="w-full bg-blue-400 rounded-t-sm transition-all"
                  style={{ height: `${(m.consumo / (d.mediaAnual * 1.3)) * 100}%`, minHeight: '4px' }}
                />
                <span className="text-[9px] text-slate-500 font-semibold">{m.mes}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campo de consumo */}
      {!d.usarMeses ? (
        <Input
          rotulo="Consumo médio mensal (kWh)"
          type="number"
          min="0"
          placeholder="Ex: 350"
          value={d.consumoMensal}
          onChange={e => set('consumoMensal', e.target.value)}
          erro={erros.consumo}
          helpText={d.mediaAnual ? `Média extraída do PDF: ${d.mediaAnual} kWh` : undefined}
        />
      ) : (
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-3">
            Consumo por mês (kWh)
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {MESES_LABELS.map((mes, i) => (
              <div key={mes}>
                <label className="text-xs text-slate-500 block mb-1">{mes}</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={d.consumosMensais[i]}
                  onChange={e => setMes(i, e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            ))}
          </div>
          {d.usarMeses && consumoMedioDosMeses(d.consumosMensais) > 0 && (
            <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg mt-3">
              Média calculada: <strong>{consumoMedioDosMeses(d.consumosMensais)} kWh/mês</strong>
            </p>
          )}
          {erros.consumo && <p className="text-xs text-red-600 mt-1">{erros.consumo}</p>}
        </div>
      )}

      {/* Dados da fatura extraída (se disponível) */}
      {(d.grupoTarifario || d.irradiancia) && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <Info size={18} className="text-blue-600" />
            <p className="text-sm font-semibold text-slate-700">Dados extraídos da fatura</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {d.grupoTarifario && (
              <div className="p-3 bg-white rounded-lg border border-blue-100">
                <p className="text-xs text-slate-500 mb-1">Grupo Tarifário</p>
                <p className="text-sm font-medium text-slate-900">{d.grupoTarifario}</p>
              </div>
            )}
            {d.fase && (
              <div className="p-3 bg-white rounded-lg border border-blue-100">
                <p className="text-xs text-slate-500 mb-1">Fase</p>
                <p className="text-sm font-medium text-slate-900">{d.fase}</p>
              </div>
            )}
            {d.valorKwh && (
              <div className="p-3 bg-white rounded-lg border border-blue-100">
                <p className="text-xs text-slate-500 mb-1">Tarifa (R$/kWh)</p>
                <p className="text-sm font-medium text-slate-900">R$ {parseFloat(d.valorKwh).toFixed(5)}</p>
              </div>
            )}
            {d.irradiancia && (
              <div className="p-3 bg-white rounded-lg border border-blue-100">
                <p className="text-xs text-slate-500 mb-1">Irradiância da cidade</p>
                <p className="text-sm font-medium text-slate-900">{d.irradiancia.toFixed(2)} kWh/m²/dia</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Outros campos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select
          rotulo="Concessionária"
          opcoes={[{ valor: '', rotulo: 'Selecione...' }, ...CONCESSIONARIAS]}
          value={d.concessionaria}
          onChange={e => set('concessionaria', e.target.value)}
          erro={erros.concessionaria}
          helpText={d.distribuidora ? `Extraída: ${d.distribuidora}` : undefined}
        />
        <Select
          rotulo="Tipo de ligação"
          opcoes={TIPOS_LIGACAO}
          value={d.tipoLigacao}
          onChange={e => set('tipoLigacao', e.target.value)}
        />
        <Select
          rotulo="Tensão"
          opcoes={TENSOES}
          value={d.tensao}
          onChange={e => set('tensao', e.target.value)}
        />
      </div>

      <div className="flex justify-between pt-2">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={avancar}>Próxima →</Button>
      </div>
    </div>
  )
}
