import { useState, useEffect } from 'react'
import { Sun, Zap, RefreshCw, AlertCircle, Info } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import { useEmpresa }   from '../../../contexts/EmpresaContext'
import Button from '../../ui/Button'
import { consultarIrradiancia } from '../../../services/nasaPowerApi'
import { getRegiao }            from '../../../data/regioesBrasil'

const MAX_BARRA = 8

export default function E4Irradiancia() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { empresa } = useEmpresa()
  const { localizacao, irradiancia } = state
  const [erro, setErro] = useState('')

  const regiao  = getRegiao(localizacao.uf ?? empresa.estadoPrincipal ?? 'SP')
  const usaFallback = empresa.forcaFallbackIrradiancia

  // Auto-consultar irradiância ao chegar na etapa se houver lat/lon
  useEffect(() => {
    if (localizacao.lat && localizacao.lon && !irradiancia.mensal) {
      consultar()
    }
  }, [localizacao.lat, localizacao.lon])

  function aplicarFallback() {
    const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const media = regiao.irradiancia
    dispatch({
      type: 'SET_IRRADIANCIA',
      payload: {
        mensal:     MESES.map(mes => ({ mes, valor: media })),
        mediaAnual: media,
        carregando: false,
        erro:       null,
        fonte:      'cresesb',
      },
    })
  }

  async function consultar() {
    setErro('')
    dispatch({ type: 'SET_IRRADIANCIA', payload: { carregando: true, erro: null } })
    try {
      const dados = await consultarIrradiancia(localizacao.lat, localizacao.lon)
      dispatch({ type: 'SET_IRRADIANCIA', payload: { ...dados, carregando: false, fonte: 'nasa' } })
    } catch (e) {
      const msg = e.message || 'Erro ao consultar NASA POWER API'
      dispatch({ type: 'SET_IRRADIANCIA', payload: { carregando: false, erro: msg } })
      setErro(msg)
      // Aplica fallback automaticamente se NASA falhar
      aplicarFallback()
    }
  }

  const { mensal, mediaAnual, carregando } = irradiancia

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Irradiância Solar</h2>
        <p className="text-sm text-slate-500 mt-1">
          Dados de irradiância via NASA POWER para{' '}
          <span className="font-medium text-slate-700">
            {localizacao.cidadeEstado || `${localizacao.lat?.toFixed(4)}, ${localizacao.lon?.toFixed(4)}`}
          </span>
        </p>
      </div>

      {/* Aviso fonte */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <span>
          Fonte: <strong>NASA POWER Climatology API</strong> — parâmetro{' '}
          <code className="bg-blue-100 px-1 rounded">ALLSKY_SFC_SW_DWN</code>{' '}
          (média histórica de irradiância global horizontal, kWh/m²/dia).
        </span>
      </div>

      {/* Botão consultar */}
      {!mensal && (
        <div className="flex flex-wrap gap-3">
          <Button
            icone={Sun}
            onClick={usaFallback ? aplicarFallback : consultar}
            carregando={carregando}
            tamanho="lg"
          >
            {carregando ? 'Consultando NASA POWER...' : usaFallback ? 'Usar Média Regional (CRESESB)' : 'Consultar NASA POWER'}
          </Button>
          {!usaFallback && (
            <Button variante="secundario" tamanho="lg" onClick={aplicarFallback}>
              Usar média do estado ({regiao.irradiancia} kWh/m²/dia)
            </Button>
          )}
        </div>
      )}

      {erro && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      {/* Tabela + gráfico de barras */}
      {mensal && (
        <div className="space-y-4">
          {/* Card média anual */}
          <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="p-3 rounded-lg bg-amber-100">
              <Sun size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Irradiância Média Anual</p>
              <p className="text-3xl font-bold text-slate-900">{mediaAnual} <span className="text-base font-normal text-slate-500">kWh/m²/dia</span></p>
            </div>
            <button
              onClick={consultar}
              className="ml-auto p-2 rounded-lg hover:bg-amber-200 text-amber-700 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Gráfico de barras simples */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Irradiância mensal (kWh/m²/dia)
            </p>
            <div className="grid grid-cols-12 gap-1 items-end h-28">
              {mensal.map((m) => {
                const pct = (m.valor / MAX_BARRA) * 100
                const cor = m.valor >= mediaAnual ? 'bg-amber-400' : 'bg-slate-300'
                return (
                  <div key={m.mes} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-mono text-slate-600 leading-none">{m.valor.toFixed(1)}</span>
                    <div
                      className={`w-full rounded-t-sm ${cor} transition-all`}
                      style={{ height: `${pct}%`, minHeight: '4px' }}
                      title={`${m.mes}: ${m.valor} kWh/m²/dia`}
                    />
                    <span className="text-[9px] text-slate-400 leading-none">{m.mes}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Barras em amarelo = acima da média anual
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button
          onClick={proxima}
          disabled={!mensal}
          title={!mensal ? 'Consulte a irradiância antes de continuar' : ''}
        >
          Próxima →
        </Button>
      </div>
    </div>
  )
}
