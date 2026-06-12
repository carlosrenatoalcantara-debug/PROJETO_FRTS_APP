import { useState, useEffect } from 'react'
import { Sun, Zap, RefreshCw, AlertCircle, Info } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import { useEmpresa }   from '../../../contexts/EmpresaContext'
import Button from '../../ui/Button'
import { consultarIrradiancia } from '../../../services/nasaPowerApi'
import { getRegiao }            from '../../../data/regioesBrasil'

const MAX_BARRA = 8

// FASE 2 (P1-UX-CORE-EVOLUTION-01): fontes de irradiância selecionáveis
const FONTES = [
  { id: 'nasa',    rotulo: 'NASA POWER',     desc: 'Base global de satélite (fallback universal).' },
  { id: 'cresesb', rotulo: 'INPE / CRESESB', desc: 'Médias territoriais de alta precisão (Brasil).' },
]

export default function E4Irradiancia() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { empresa } = useEmpresa()
  const { localizacao, irradiancia } = state
  const [erro, setErro] = useState('')
  // Fonte escolhida explicitamente pelo usuário (FASE 2)
  const [fonteEscolhida, setFonteEscolhida] = useState(
    irradiancia.fonte || (empresa.forcaFallbackIrradiancia ? 'cresesb' : 'nasa')
  )

  const regiao  = getRegiao(localizacao.uf ?? empresa.estadoPrincipal ?? 'SP')
  const usaFallback = empresa.forcaFallbackIrradiancia

  function consultarFonte() {
    return fonteEscolhida === 'cresesb' ? aplicarFallback() : consultar()
  }

  // Auto-consultar irradiância ao chegar na etapa se houver lat/lon
  useEffect(() => {
    if (localizacao.lat && localizacao.lon && !irradiancia.mensal) {
      consultarFonte()
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
          Dados de irradiância via{' '}
          <span className="font-medium text-slate-700">
            {(irradiancia.fonte || fonteEscolhida) === 'cresesb' ? 'INPE/CRESESB' : 'NASA POWER'}
          </span>{' '}para{' '}
          <span className="font-medium text-slate-700">
            {localizacao.cidadeEstado || `${localizacao.lat?.toFixed(4)}, ${localizacao.lon?.toFixed(4)}`}
          </span>
        </p>
      </div>

      {/* FASE 2: seletor explícito de fonte de irradiância */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fonte de dados</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FONTES.map((f) => {
            const ativo = fonteEscolhida === f.id
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setFonteEscolhida(f.id)}
                className={[
                  'text-left p-3 rounded-xl border transition-all flex items-start gap-3',
                  ativo ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : 'border-slate-200 bg-white hover:border-slate-300',
                ].join(' ')}
              >
                <span className={[
                  'mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                  ativo ? 'border-amber-500' : 'border-slate-300',
                ].join(' ')}>
                  {ativo && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{f.rotulo}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{f.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-start gap-2 mt-2 text-xs text-slate-400">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>
            {fonteEscolhida === 'nasa'
              ? <>NASA POWER — parâmetro <code className="bg-slate-100 px-1 rounded">ALLSKY_SFC_SW_DWN</code> (irradiância global horizontal).</>
              : <>INPE/CRESESB — média territorial do estado ({regiao.irradiancia} kWh/m²/dia).</>}
          </span>
        </div>
      </div>

      {/* Botão consultar (respeita a fonte escolhida) */}
      {!mensal && (
        <div className="flex flex-wrap gap-3">
          <Button icone={Sun} onClick={consultarFonte} carregando={carregando} tamanho="lg">
            {carregando
              ? 'Consultando...'
              : fonteEscolhida === 'nasa' ? 'Consultar NASA POWER' : `Usar média INPE/CRESESB (${regiao.irradiancia} kWh/m²/dia)`}
          </Button>
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
