import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProjeto } from '../../providers/ProjetoProvider'
import {
  aceitarOpcao, criarOpcao, listarOpcoes, enviarProposta, obterEnvioDaProposta,
  baixarPdfDaProposta,
} from '../../api/agregadosFvApi'

/**
 * EtapaProposta — opções concorrentes da mesma proposta — FV-DOM-032.
 *
 * ── Por que cada opção é um projeto ─────────────────────────────────────────
 * A auditoria da sprint mediu o impedimento: duas opções não cabem num
 * `ProjetoFV` só. Oito campos são únicos no documento — dimensionamento,
 * engenharia_eletrica, unifilar, homologacao entre eles — e os agregados travam
 * por projeto (`unico_aprovado_por_projeto`, `unico_baseline_por_projeto`).
 * Cada opção é, portanto, um ProjetoFV completo, ligado às irmãs por
 * `proposta_grupo_id`. Pares, não pai e filho.
 *
 * ── O que esta tela decide e o que ela não decide ───────────────────────────
 * Ela cria opções e registra o ACEITE — que é ato separado da aprovação do
 * orçamento (regra 3). Não compara preços, não recomenda, não arquiva as
 * perdedoras: elas continuam consultáveis, com Baseline intacta (regras 6 e 7),
 * bloqueadas apenas no Gate (regras 5 e 9).
 *
 * Quem valida o aceite é o servidor — inclusive a unicidade, que tem índice
 * próprio no banco. Aqui a interface só espelha.
 */
export default function EtapaProposta() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { projeto, carregando, erro, acoes } = useProjeto()

  const [grupo, setGrupo] = useState(null)
  const [carregandoGrupo, setCarregandoGrupo] = useState(true)
  const [erroAcao, setErroAcao] = useState(null)
  const [ocupado, setOcupado] = useState(null)

  const [envio, setEnvio] = useState(null)

  const recarregarGrupo = useCallback(async () => {
    setCarregandoGrupo(true)
    try {
      // FV-UX-035: o estado do ENVIO decide se o aceite pode sequer ser oferecido.
      const [g, e] = await Promise.all([listarOpcoes(id), obterEnvioDaProposta(id)])
      setGrupo(g)
      setEnvio(e)
    } catch (e) {
      setErroAcao(e.message)
    } finally {
      setCarregandoGrupo(false)
    }
  }, [id])

  useEffect(() => { recarregarGrupo() }, [recarregarGrupo])

  async function nova() {
    setOcupado('criar')
    setErroAcao(null)
    try {
      const r = await criarOpcao(id)
      await recarregarGrupo()
      await acoes.recarregar?.()
      // A opção nasce vazia: leva o operador direto para montá-la.
      if (r?.item?._id) navegar(`/fv/projetos/${r.item._id}/equipamentos`)
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setOcupado(null)
    }
  }

  /** Disponibiliza a proposta inteira ao cliente — um link, todas as opções. */
  async function enviar() {
    setOcupado('enviar')
    setErroAcao(null)
    try {
      await enviarProposta(id, {})
      await recarregarGrupo()
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setOcupado(null)
    }
  }

  /**
   * FV-UX-036 — abre o PDF da opção numa aba.
   *
   * O documento vem PRONTO do backend, que é a autoridade sobre o conteúdo: o
   * frontend não monta nem recalcula potência, quantidade ou valor. Gerar não
   * altera estado nenhum e não conta como envio — pode ser feito à vontade,
   * antes ou depois do aceite.
   */
  async function abrirPdf(opcaoId, rotulo) {
    setOcupado(`pdf:${opcaoId}`)
    setErroAcao(null)
    let url = null
    try {
      const blob = await baixarPdfDaProposta(opcaoId)
      url = URL.createObjectURL(blob)
      const janela = window.open(url, '_blank', 'noopener')
      if (!janela) {
        // Bloqueador de pop-up: cai para download, senão o operador fica sem nada.
        const a = document.createElement('a')
        a.href = url
        a.download = `proposta-${(rotulo ?? 'opcao').toLowerCase().replace(/\s+/g, '-')}.pdf`
        a.click()
      }
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      // Revoga depois de dar tempo à aba/download de consumir o blob.
      if (url) setTimeout(() => URL.revokeObjectURL(url), 60000)
      setOcupado(null)
    }
  }

  async function aceitar(opcaoId) {
    setOcupado(opcaoId)
    setErroAcao(null)
    try {
      await aceitarOpcao(opcaoId)
      await recarregarGrupo()
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setOcupado(null)
    }
  }

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>
  if (!projeto) return <p className="p-6 text-sm text-slate-500">Projeto não encontrado.</p>

  const opcoes = grupo?.opcoes ?? []
  const aceita = grupo?.aceita ?? null

  return (
    <section className="mx-auto max-w-3xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Proposta</h2>
      <p className="mt-1 text-sm text-slate-500">
        Opções técnicas concorrentes para o mesmo cliente. Cada uma tem
        equipamentos, engenharia, orçamento e contrato próprios.
      </p>

      {carregandoGrupo && <p className="mt-4 text-sm text-slate-500">Carregando opções…</p>}

      {!carregandoGrupo && opcoes.length === 0 && (
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            Este projeto ainda não faz parte de uma proposta com opções.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Ao criar a primeira opção, este projeto passa a ser a <strong>Opção 01</strong> e
            a nova nasce como <strong>Opção 02</strong>, vazia — nada técnico é copiado.
          </p>
        </div>
      )}

      {opcoes.length > 0 && (
        <div className={`mt-4 rounded border p-4 ${
          envio?.enviada ? 'border-sky-200 bg-sky-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className="text-sm font-medium text-slate-800">
            {envio?.enviada ? 'Proposta enviada ao cliente' : 'Proposta ainda não enviada'}
          </p>
          {!envio?.enviada && (
            <p className="mt-1 text-xs text-slate-600">
              O aceite só é possível depois que a proposta for disponibilizada ao
              cliente. O link cobre as {opcoes.length} opções de uma vez.
            </p>
          )}
          {envio?.enviada && envio?.ultimo && (
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>
                Link do cliente:{' '}
                <a href={envio.ultimo.url} target="_blank" rel="noreferrer"
                  className="font-mono text-sky-800 underline">{envio.ultimo.url}</a>
              </p>
              <p>
                {envio.ultimo.visualizacoes > 0
                  ? `Aberto ${envio.ultimo.visualizacoes}× — último acesso em `
                    + new Date(envio.ultimo.ultimo_acesso).toLocaleString('pt-BR')
                  : 'Ainda não foi aberto pelo cliente.'}
              </p>
              {!envio.vigente && (
                <p className="font-medium text-amber-800">
                  O link expirou. Envie novamente para permitir o aceite.
                </p>
              )}
            </div>
          )}
          {!aceita && (
            <button
              type="button"
              onClick={enviar}
              disabled={ocupado !== null}
              className="mt-3 rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white
                hover:bg-sky-800 disabled:bg-slate-400"
            >
              {ocupado === 'enviar' ? 'Enviando…'
                : envio?.enviada ? 'Enviar novamente' : 'Enviar ao cliente'}
            </button>
          )}
        </div>
      )}

      {opcoes.length > 0 && (
        <ul className="mt-4 space-y-3">
          {opcoes.map((o) => {
            const ehAtual = String(o._id) === String(id)
            const escolhida = o.proposta_aceite?.aceita === true
            return (
              <li
                key={o._id}
                className={`rounded border p-4 ${
                  escolhida ? 'border-emerald-400 bg-emerald-50'
                    : ehAtual ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    {o.opcao_rotulo ?? o.nome}
                    {ehAtual && <span className="ml-2 text-xs font-normal text-slate-500">(em edição)</span>}
                  </p>
                  {escolhida && (
                    <span className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
                      aceita
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {o.nome}
                  {o.dimensionamento?.potencia_kwp
                    ? ` · ${o.dimensionamento.potencia_kwp} kWp` : ''}
                  {o.status ? ` · ${o.status}` : ''}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!ehAtual && (
                    <button
                      type="button"
                      onClick={() => navegar(`/fv/projetos/${o._id}/proposta`)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Abrir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => abrirPdf(o._id, o.opcao_rotulo ?? o.nome)}
                    disabled={ocupado !== null}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700
                      hover:bg-slate-50 disabled:text-slate-400"
                  >
                    {ocupado === `pdf:${o._id}`
                      ? 'Gerando…'
                      : `${o.opcao_rotulo ?? 'Opção'} — PDF da proposta`}
                  </button>
                  {!aceita && (
                    <button
                      type="button"
                      onClick={() => aceitar(o._id)}
                      disabled={ocupado !== null || !envio?.enviada || !envio?.vigente}
                      title={envio?.enviada
                        ? undefined
                        : 'Envie a proposta ao cliente antes de registrar o aceite.'}
                      className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
                    >
                      {ocupado === o._id ? 'Registrando…' : 'Aceitar esta opção'}
                    </button>
                  )}
                </div>

                {aceita && !escolhida && (
                  <p className="mt-2 text-xs text-slate-500">
                    Não escolhida. Permanece no histórico, consultável, com a Baseline
                    intacta — mas não avança para engenharia nem homologação.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {aceita && (
        <p className="mt-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Proposta aceita na {aceita.opcao_rotulo}. Nenhuma outra opção deste grupo
          pode ser aceita.
        </p>
      )}

      {erroAcao && <p role="alert" className="mt-3 text-xs text-red-600">{erroAcao}</p>}

      <div className="mt-4">
        <button
          type="button" onClick={nova} disabled={ocupado !== null}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
        >
          {ocupado === 'criar' ? 'Criando…' : 'Criar nova opção'}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Aceitar a proposta é ato separado de aprovar o orçamento: uma opção pode ter
        orçamento aprovado e Baseline congelada sem ter sido a escolhida.
      </p>
    </section>
  )
}
