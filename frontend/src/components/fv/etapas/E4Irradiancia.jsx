import { useState, useEffect } from 'react'
import { Sun, Zap, RefreshCw, AlertCircle, Info } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import { useEmpresa }   from '../../../contexts/EmpresaContext'
import Button from '../../ui/Button'
import { consultarIrradiancia } from '../../../services/nasaPowerApi'
import { getRegiao }            from '../../../data/regioesBrasil'
import { resolverCresesb, temSerieMensal } from '../../../utils/irradianciaCresesb'

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
  // Fonte que o usuário MARCOU. A fonte APLICADA é `irradiancia.fonte` — o
  // cabeçalho e o card leem só ela, para nunca mostrar uma fonte e um valor
  // de outra.
  const [fonteEscolhida, setFonteEscolhida] = useState(
    irradiancia.fonte || (empresa.forcaFallbackIrradiancia ? 'cresesb' : 'nasa')
  )

  const regiao  = getRegiao(localizacao.uf ?? empresa.estadoPrincipal ?? 'SP')
  const cidade  = (localizacao.cidadeEstado || '').split(/[,\-]/)[0].trim()
  const uf      = localizacao.uf || regiao.uf
  // O valor CRESESB que seria (ou foi) aplicado — mesma função para o texto do
  // seletor, o card e o estado.
  const cresesb = resolverCresesb({ cidade, uf, mediaEstado: regiao.irradiancia })

  /** Aplica a fonte pedida AGORA: marcar o rádio sem reaplicar só trocava o rótulo. */
  function aplicarFonte(id) {
    return id === 'cresesb' ? aplicarCresesb() : consultar()
  }

  function escolherFonte(id) {
    setFonteEscolhida(id)
    setErro('')
    return aplicarFonte(id)
  }

  // Auto-consultar ao chegar na etapa se ainda não há média aplicada
  useEffect(() => {
    if (irradiancia.mediaAnual == null && (localizacao.lat && localizacao.lon || fonteEscolhida === 'cresesb')) {
      aplicarFonte(fonteEscolhida)
    }
  }, [localizacao.lat, localizacao.lon])

  /**
   * INPE/CRESESB: só há MÉDIA anual (cidade ou estado). Série mensal não existe
   * nesta base — `mensal: null`, nunca 12 meses iguais fingindo série.
   */
  function aplicarCresesb() {
    if (cresesb.valor === null) {
      setErro('Sem dado INPE/CRESESB para este local. Use a NASA POWER ou defina a localização.')
      return
    }
    dispatch({
      type: 'SET_IRRADIANCIA',
      payload: { mensal: null, mediaAnual: cresesb.valor, carregando: false, erro: null, fonte: 'cresesb' },
    })
  }

  async function consultar() {
    setErro('')
    if (!localizacao.lat || !localizacao.lon) {
      setErro('Localização sem coordenadas — defina o local na etapa anterior para consultar a NASA POWER.')
      return
    }
    dispatch({ type: 'SET_IRRADIANCIA', payload: { carregando: true, erro: null } })
    try {
      const dados = await consultarIrradiancia(localizacao.lat, localizacao.lon)
      dispatch({ type: 'SET_IRRADIANCIA', payload: { ...dados, carregando: false, erro: null, fonte: 'nasa' } })
    } catch (e) {
      const msg = e.message || 'Erro ao consultar NASA POWER API'
      dispatch({ type: 'SET_IRRADIANCIA', payload: { carregando: false, erro: msg } })
      // NASA falhou: aplica a média CRESESB e DIZ que mudou de fonte (rádio incluso).
      setFonteEscolhida('cresesb')
      aplicarCresesb()
      setErro(`${msg}. Aplicada a média INPE/CRESESB no lugar.`)
    }
  }

  const { mensal, mediaAnual, carregando } = irradiancia

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Irradiância Solar</h2>
        <p className="text-sm text-slate-500 mt-1">
          {mediaAnual == null
            ? 'Nenhuma fonte aplicada ainda'
            : <>Dados de irradiância via{' '}
                <span className="font-medium text-slate-700" data-testid="fonte-aplicada">
                  {irradiancia.fonte === 'cresesb' ? 'INPE/CRESESB'
                    : irradiancia.fonte === 'nasa' ? 'NASA POWER' : 'fonte não registrada'}
                </span></>}{' '}para{' '}
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
                onClick={() => escolherFonte(f.id)}
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
              : cresesb.valor === null
                ? <>INPE/CRESESB — sem dado para este local.</>
                : <>INPE/CRESESB — {cresesb.rotulo}: {cresesb.valor} kWh/m²/dia (só média anual, sem série mensal).</>}
          </span>
        </div>
      </div>

      {/* Botão consultar (respeita a fonte escolhida) */}
      {mediaAnual == null && (
        <div className="flex flex-wrap gap-3">
          <Button icone={Sun} onClick={() => aplicarFonte(fonteEscolhida)} carregando={carregando} tamanho="lg">
            {carregando
              ? 'Consultando...'
              : fonteEscolhida === 'nasa' ? 'Consultar NASA POWER'
                : cresesb.valor === null ? 'INPE/CRESESB indisponível para este local'
                  : `Usar média INPE/CRESESB (${cresesb.valor} kWh/m²/dia)`}
          </Button>
        </div>
      )}

      {erro && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      {/* Tabela + gráfico de barras */}
      {mediaAnual != null && (
        <div className="space-y-4">
          {/* Card média anual */}
          <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="p-3 rounded-lg bg-amber-100">
              <Sun size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Irradiância Média Anual</p>
              <p className="text-3xl font-bold text-slate-900">{mediaAnual} <span className="text-base font-normal text-slate-500">kWh/m²/dia</span></p>
              <p className="text-xs text-slate-500 mt-0.5" data-testid="origem-irradiancia">
                {irradiancia.fonte === 'nasa'
                  ? 'NASA POWER — satélite, pelas coordenadas do projeto'
                  : irradiancia.fonte === 'cresesb'
                    ? `INPE/CRESESB — ${cresesb.rotulo}`
                    : 'Origem não registrada neste projeto'}
              </p>
            </div>
            <button
              onClick={() => aplicarFonte(irradiancia.fonte || fonteEscolhida)}
              className="ml-auto p-2 rounded-lg hover:bg-amber-200 text-amber-700 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Série mensal: só quando existe de verdade (NASA). */}
          {temSerieMensal(mensal) ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Irradiância mensal (kWh/m²/dia)
              </p>
              {/* Altura DEFINIDA na coluna: `height: %` num filho flex sem altura
                  definida cai em minHeight e o gráfico sai achatado. */}
              <div className="grid grid-cols-12 gap-1 h-32" data-testid="grafico-mensal">
                {mensal.map((m) => {
                  const pct = Math.max(2, Math.min(100, (m.valor / MAX_BARRA) * 100))
                  const cor = m.valor >= mediaAnual ? 'bg-amber-400' : 'bg-slate-300'
                  return (
                    <div key={m.mes} className="flex flex-col items-center justify-end gap-1 h-full min-h-0">
                      <span className="text-[9px] font-mono text-slate-600 leading-none">{m.valor.toFixed(1)}</span>
                      <div className="w-full flex-1 min-h-0 flex items-end">
                        <div
                          data-testid="barra-mensal"
                          className={`w-full rounded-t-sm ${cor} transition-all`}
                          style={{ height: `${pct}%` }}
                          title={`${m.mes}: ${m.valor} kWh/m²/dia`}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 leading-none">{m.mes}</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                Barras em amarelo = acima da média anual
              </p>
            </div>
          ) : (
            <p data-testid="sem-serie-mensal" className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
              Sem série mensal: a fonte aplicada fornece só a média anual. A série mês a mês
              está disponível na NASA POWER.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button
          onClick={proxima}
          disabled={mediaAnual == null}
          title={mediaAnual == null ? 'Consulte a irradiância antes de continuar' : ''}
        >
          Próxima →
        </Button>
      </div>
    </div>
  )
}
