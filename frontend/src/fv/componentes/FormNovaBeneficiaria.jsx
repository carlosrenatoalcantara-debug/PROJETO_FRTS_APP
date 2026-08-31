import { useState } from 'react'
import { useBeneficiarias } from '../providers/BeneficiariasProvider'

/** Número finito ou undefined — nunca NaN, nunca string vazia virando 0. */
function num(v) {
  if (v === '' || v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/**
 * FormNovaBeneficiaria — cria ou edita uma unidade beneficiária — FV-UX-015.
 *
 * Monta o payload e delega. Nenhuma regra de rateio aqui: o limite de 100%, a
 * soma dos percentuais e as modalidades GD aceitas são validados no servidor
 * (`beneficiariasController` + `beneficiariaRateio`), e a mensagem exibida em
 * caso de recusa é a do servidor, sem reinterpretação.
 *
 * Passar `beneficiaria` coloca o formulário em modo edição.
 */
export default function FormNovaBeneficiaria({ beneficiaria = null, aoConcluir, aoCancelar }) {
  const { acoes, modalidades } = useBeneficiarias()
  const edicao = Boolean(beneficiaria)

  const [aberto, setAberto] = useState(edicao)
  const [campos, setCampos] = useState(() => ({
    contaContrato: beneficiaria?.contaContrato ?? '',
    tipoRateio: beneficiaria?.tipoRateio ?? 'percentual',
    valor: beneficiaria?.valor ?? '',
    titular: beneficiaria?.titular ?? '',
    cpf_cnpj: beneficiaria?.cpf_cnpj ?? '',
    concessionaria: beneficiaria?.concessionaria ?? '',
    modalidade_gd: beneficiaria?.modalidade_gd ?? '',
  }))
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  const set = (k) => (e) => setCampos((c) => ({ ...c, [k]: e.target.value }))

  function fechar() {
    setErro(null)
    if (edicao) aoCancelar?.()
    else setAberto(false)
  }

  async function enviar(ev) {
    ev.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const dados = {
        contaContrato: campos.contaContrato.trim(),
        tipoRateio: campos.tipoRateio,
        valor: num(campos.valor),
        titular: campos.titular.trim() || undefined,
        cpf_cnpj: campos.cpf_cnpj.trim() || undefined,
        concessionaria: campos.concessionaria.trim() || undefined,
        modalidade_gd: campos.modalidade_gd || undefined,
      }
      if (edicao) await acoes.atualizar(beneficiaria._id, dados)
      else await acoes.criar(dados)

      if (edicao) aoConcluir?.()
      else {
        setAberto(false)
        setCampos({
          contaContrato: '', tipoRateio: 'percentual', valor: '',
          titular: '', cpf_cnpj: '', concessionaria: '', modalidade_gd: '',
        })
      }
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
        Nova beneficiária
      </button>
    )
  }

  return (
    <form onSubmit={enviar} className={edicao ? '' : 'mt-4 rounded border border-slate-300 bg-white p-4'}>
      <h3 className="text-sm font-semibold text-slate-900">
        {edicao ? 'Editar beneficiária' : 'Nova beneficiária'}
      </h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-600">Conta contrato *</span>
          <input
            value={campos.contaContrato} onChange={set('contaContrato')} required
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Titular</span>
          <input
            value={campos.titular} onChange={set('titular')}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Tipo de rateio *</span>
          <select
            value={campos.tipoRateio} onChange={set('tipoRateio')}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="percentual">percentual</option>
            <option value="kwh">kWh</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600">
            Valor * {campos.tipoRateio === 'percentual' ? '(%)' : '(kWh)'}
          </span>
          <input
            type="number" min="0" step="any" required
            max={campos.tipoRateio === 'percentual' ? 100 : undefined}
            value={campos.valor} onChange={set('valor')}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">CPF/CNPJ</span>
          <input
            value={campos.cpf_cnpj} onChange={set('cpf_cnpj')}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Concessionária</span>
          <input
            value={campos.concessionaria} onChange={set('concessionaria')}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Modalidade GD</span>
          <select
            value={campos.modalidade_gd} onChange={set('modalidade_gd')}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="">—</option>
            {/* O servidor devolve `{ id, label }` — o id é o valor persistido. */}
            {modalidades.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>

      {erro && <p role="alert" className="mt-3 text-xs text-red-600">{erro}</p>}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={enviando}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400">
          {enviando ? 'Salvando…' : edicao ? 'Salvar' : 'Adicionar'}
        </button>
        <button type="button" onClick={fechar}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}
