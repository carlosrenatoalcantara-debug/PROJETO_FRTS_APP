import { useState } from 'react'
import { useCotacoes } from '../providers/CotacoesProvider'

/** Tecnologias que o domínio já reconhece (`TECNOLOGIAS_COTACAO`). Lista aberta. */
const TECNOLOGIAS = ['string', 'micro', 'hibrido', 'bess', 'otimizador']

/** Número finito ou undefined — nunca NaN, nunca string vazia virando 0. */
function num(v) {
  if (v === '' || v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/**
 * FormNovaCotacao — cria uma cotação — FV-UX-012.
 *
 * Só monta o payload e delega. Nenhuma validação de domínio acontece aqui: se a
 * tecnologia faltar ou o projeto não pertencer à organização, quem recusa é o
 * `CotacaoService`, e a mensagem exibida é a do servidor.
 *
 * O único tratamento local é de TIPO: campo vazio vira `undefined` em vez de 0,
 * para não afirmar uma premissa que o usuário não informou.
 */
export default function FormNovaCotacao({ aoCriar }) {
  const { acoes } = useCotacoes()
  const [aberto, setAberto] = useState(false)
  const [rotulo, setRotulo] = useState('')
  const [tecnologia, setTecnologia] = useState('string')
  const [consumo, setConsumo] = useState('')
  const [tarifa, setTarifa] = useState('')
  const [hsp, setHsp] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  async function enviar(ev) {
    ev.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const nova = await acoes.criar({
        rotulo: rotulo.trim() || null,
        tecnologia,
        premissas: {
          consumo_kwh_mes: num(consumo),
          tarifa_kwh: num(tarifa),
          hsp_kwh_m2_dia: num(hsp),
        },
      })
      setAberto(false)
      setRotulo(''); setConsumo(''); setTarifa(''); setHsp('')
      aoCriar?.(nova?.cotacao?._id ?? null)
    } catch (e) {
      setErro(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
      >
        Nova cotação
      </button>
    )
  }

  return (
    <form onSubmit={enviar} className="rounded border border-slate-300 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Nova cotação</h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-600">Rótulo</span>
          <input
            value={rotulo} onChange={(e) => setRotulo(e.target.value)}
            placeholder="Cenário A — string"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Tecnologia</span>
          <select
            value={tecnologia} onChange={(e) => setTecnologia(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          >
            {TECNOLOGIAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Consumo (kWh/mês)</span>
          <input type="number" min="0" step="any" value={consumo} onChange={(e) => setConsumo(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Tarifa (R$/kWh)</span>
          <input type="number" min="0" step="any" value={tarifa} onChange={(e) => setTarifa(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">HSP (kWh/m²·dia)</span>
          <input type="number" min="0" step="any" value={hsp} onChange={(e) => setHsp(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
        </label>
      </div>

      {erro && <p role="alert" className="mt-3 text-xs text-red-600">{erro}</p>}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={enviando}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400">
          {enviando ? 'Criando…' : 'Criar cotação'}
        </button>
        <button type="button" onClick={() => { setAberto(false); setErro(null) }}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}
