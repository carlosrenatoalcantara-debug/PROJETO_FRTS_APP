import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

/**
 * PropostaFVPublica — FV-UX-035.
 *
 * A página que o CLIENTE abre. Sem login: o token do link é a credencial.
 *
 * Irmã de `PropostaPublica` (`/p/:token`), que serve os compartilhamentos do
 * wizard legado. Esta serve o envio canônico, que é por GRUPO — todas as
 * opções da proposta numa página só, para comparação, e o aceite de UMA delas.
 *
 * Esta tela NÃO calcula nada. Tudo que exibe vem do snapshot congelado no
 * momento do envio: alterar o projeto depois não muda o que o cliente vê. E o
 * aceite passa pelo mesmo domínio do aceite interno — a página não decide se
 * pode, apenas mostra o que o servidor respondeu.
 */

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "8 × Hoymiles HMS-2000-4T" — quantidade só aparece quando é mais de um. */
function descreverEquipamento(e) {
  const identidade = [e?.marca, e?.modelo].filter(Boolean).join(' ')
  if (!identidade) return null
  return e?.quantidade > 1 ? `${e.quantidade} × ${identidade}` : identidade
}

const ROTULO_TOPOLOGIA = {
  micro: 'Microinversores',
  string: 'Inversor string',
}

export default function PropostaFVPublica() {
  const { token } = useParams()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [ocupado, setOcupado] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const r = await fetch(`/api/publico/proposta-fv/${token}`)
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.erro ?? `Não foi possível abrir a proposta (${r.status}).`)
      setDados(j)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  async function aceitar(projeto_ref, rotulo) {
    if (!window.confirm(
      `Confirmar o aceite da ${rotulo}?\n\n`
      + 'Esta escolha identifica a opção que seguirá para execução.')) return
    setOcupado(projeto_ref)
    setErro(null)
    try {
      const r = await fetch(`/api/publico/proposta-fv/${token}/aceitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projeto_ref }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.erro ?? `Não foi possível registrar o aceite (${r.status}).`)
      await carregar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(null)
    }
  }

  if (carregando) {
    return <p className="p-8 text-center text-sm text-slate-500">Carregando proposta…</p>
  }
  if (erro && !dados) {
    return (
      <main className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Proposta indisponível</h1>
        <p className="mt-2 text-sm text-red-700">{erro}</p>
      </main>
    )
  }

  const snap = dados?.snapshot ?? {}
  const opcoes = snap.opcoes ?? []
  const aceita = dados?.aceita ?? null

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="border-b border-slate-200 pb-4">
        {dados?.empresa?.nome && (
          <p className="text-xs uppercase tracking-wide text-slate-500">{dados.empresa.nome}</p>
        )}
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Sua proposta</h1>
        {snap.cliente?.nome && (
          <p className="mt-1 text-sm text-slate-600">{snap.cliente.nome}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          {opcoes.length > 1
            ? `${opcoes.length} opções para comparar. Escolha uma.`
            : 'Confira os detalhes abaixo.'}
          {dados?.validade && ` · Válida até ${new Date(dados.validade).toLocaleDateString('pt-BR')}`}
        </p>
      </header>

      {erro && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>
      )}

      {aceita && (
        <p className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          Você escolheu a <strong>{aceita.opcao_rotulo}</strong>
          {aceita.aceita_em && ` em ${new Date(aceita.aceita_em).toLocaleString('pt-BR')}`}.
        </p>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {opcoes.map((o) => {
          const escolhida = aceita && String(aceita.projeto_ref) === String(o.projeto_ref)
          return (
            <li
              key={o.projeto_ref}
              className={`rounded-lg border p-5 ${
                escolhida ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{o.opcao_rotulo ?? o.nome}</h2>
                {escolhida && (
                  <span className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
                    escolhida
                  </span>
                )}
              </div>

              {typeof o.valor_total_r === 'number' && (
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {MOEDA.format(o.valor_total_r)}
                </p>
              )}

              <dl className="mt-4 space-y-1 text-sm">
                {[
                  ['Potência', o.potencia_kwp ? `${o.potencia_kwp} kWp` : null],
                  ['Módulos', o.modulos?.length
                    ? o.modulos.map((m) => (m.quantidade
                      ? `${m.quantidade} × ${[m.marca, m.modelo].filter(Boolean).join(' ')}`
                      : [m.marca, m.modelo].filter(Boolean).join(' '))).join(' + ')
                    : o.num_paineis],
                  ['Tecnologia', ROTULO_TOPOLOGIA[o.topologia] ?? o.topologia],
                  // FV-UX-038 (D1): o cliente vê QUANTOS e QUAIS. Snapshots
                  // congelados antes desta sprint não têm `inversores[]` — aí
                  // vale o `inversor` resumido, como sempre valeu.
                  [o.inversores?.length > 1 ? 'Inversores' : 'Inversor',
                    o.inversores?.length
                      ? o.inversores.map(descreverEquipamento).join(' + ')
                      : o.inversor],
                  ['Estrutura', o.estrutura],
                ].filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>

              {!aceita && (
                <button
                  type="button"
                  onClick={() => aceitar(o.projeto_ref, o.opcao_rotulo ?? o.nome)}
                  disabled={ocupado !== null}
                  className="mt-5 w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white
                    hover:bg-slate-700 disabled:bg-slate-400"
                >
                  {ocupado === o.projeto_ref ? 'Registrando…' : 'Escolher esta opção'}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
        Proposta emitida em{' '}
        {dados?.criado_em ? new Date(dados.criado_em).toLocaleDateString('pt-BR') : '—'}.
        Documento de referência {dados?.snapshot_hash?.slice(0, 12)}.
      </footer>
    </main>
  )
}
