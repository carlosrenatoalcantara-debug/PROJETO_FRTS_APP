import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useFases } from '../../providers/FasesProvider'
import {
  obterStatusHomologacao,
  obterChecklistHomologacao,
  atualizarStatusHomologacao,
  atualizarChecklistHomologacao,
  registrarProtocoloHomologacao,
} from '../../api/agregadosFvApi'
// FV-UX-043 — o parecer é da concessionária; mora nesta fase.
import ParecerDeAcesso from '../../componentes/ParecerDeAcesso'

/**
 * EtapaHomologacao — fase paralela — FV-API-001 / FV-UX-034.
 *
 * A LIBERAÇÃO vem do Gate (informação real do domínio).
 *
 * FV-UX-034: a auditoria mediu que a API de homologação já existia inteira
 * (status, checklist, memorial, carta, ART) e que esta tela não expunha nada
 * dela — mostrava só o veredito do Gate. Agora expõe o estado real.
 *
 * O que esta tela NÃO faz:
 *   • não decide se a fase está liberada — quem barra é `exigirGate` no
 *     servidor, que responde 409 com o motivo (SEM_BASELINE,
 *     PROPOSTA_SEM_ACEITE, OPCAO_NAO_ESCOLHIDA). A tela só mostra o motivo;
 *   • não deriva progresso — o servidor devolve `progresso` pronto;
 *   • não inventa a lista de documentos: o checklist exibido é o que o
 *     servidor devolveu. Sem checklist gravado, diz que não há.
 *
 * A CONCLUSÃO da fase continua não rastreável: nenhum agregado registra o
 * encerramento (FV-DOM-006). O `status` abaixo é o estado do processo na
 * concessionária, não o fechamento da fase.
 */

/** Estados aceitos pelo servidor (`statusValidos` em homologacaoController). */
const ESTADOS = [
  ['rascunho', 'Rascunho'],
  ['enviado', 'Enviado'],
  ['analise', 'Em análise'],
  ['aprovado', 'Aprovado'],
  ['conectado', 'Conectado'],
]

/** Extrai a lista de documentos de qualquer um dos formatos que o servidor usa. */
function lerDocumentos(resposta) {
  const bruto = resposta?.checklist ?? resposta?.documentos ?? resposta
  if (Array.isArray(bruto)) return bruto
  if (Array.isArray(bruto?.documentos)) return bruto.documentos
  return []
}

export default function EtapaHomologacao() {
  const { id } = useParams()
  const { lista, carregando, erro } = useFases()
  const fase = lista.find((f) => f.chave === 'homologacao')

  const [estado, setEstado] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [carregandoDados, setCarregandoDados] = useState(true)
  const [erroAcao, setErroAcao] = useState(null)
  const [protocolo, setProtocolo] = useState('')
  const [editandoProtocolo, setEditandoProtocolo] = useState(false)

  const recarregar = useCallback(async () => {
    if (!id) return
    setCarregandoDados(true)
    setErroAcao(null)
    try {
      // Consulta continua aberta mesmo para a opção não escolhida (regra 9).
      const [st, ck] = await Promise.all([
        obterStatusHomologacao(id),
        obterChecklistHomologacao(id),
      ])
      setEstado(st?.homologacao ?? null)
      setProtocolo(st?.homologacao?.numero_protocolo ?? '')
      setEditandoProtocolo(false)
      setDocumentos(lerDocumentos(ck))
    } catch (e) {
      setErroAcao(e?.message ?? String(e))
    } finally {
      setCarregandoDados(false)
    }
  }, [id])

  useEffect(() => { recarregar() }, [recarregar])

  /** Avanço operacional — pode ser barrado pelo Gate no servidor. */
  async function mudarEstado(novo) {
    setErroAcao(null)
    try {
      await atualizarStatusHomologacao(id, novo)
      await recarregar()
    } catch (e) {
      setErroAcao(e?.message ?? String(e))
    }
  }

  /**
   * FV-UX-040 — protocolo na concessionária.
   *
   * Avanço operacional: passa pelo Gate no servidor, como o resto desta fase.
   * Enviar vazio LIMPA o protocolo — o endpoint trata `''` como remoção, e o
   * histórico registra a remoção também.
   */
  async function salvarProtocolo() {
    setErroAcao(null)
    try {
      await registrarProtocoloHomologacao(id, protocolo.trim())
      await recarregar()
    } catch (e) {
      setErroAcao(e?.message ?? String(e))
    }
  }

  async function alternarDocumento(indice) {
    setErroAcao(null)
    const proximos = documentos.map((d, i) =>
      i === indice ? { ...d, concluido: !d.concluido } : d)
    try {
      await atualizarChecklistHomologacao(id, proximos)
      await recarregar()
    } catch (e) {
      setErroAcao(e?.message ?? String(e))
    }
  }

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>
  if (!fase) return <p className="p-6 text-sm text-slate-500">Fase não disponível.</p>

  const atual = estado?.status ?? null
  const concluidos = documentos.filter((d) => d.concluido).length

  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Homologação</h2>

      <div className={`mt-4 rounded border p-4 text-sm ${
        fase.liberada ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
        <p className={fase.liberada ? 'font-medium text-emerald-800' : 'font-medium text-slate-700'}>
          {fase.liberada ? 'Liberada pelo Gate' : 'Bloqueada pelo Gate'}
        </p>
        {fase.motivo_bloqueio && (
          <p className="mt-1 text-xs text-slate-500">
            Motivo: <code className="font-mono">{fase.motivo_bloqueio}</code>
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">Fase paralela — corre junto com a outra.</p>
      </div>

      {erroAcao && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {erroAcao}
        </p>
      )}

      <div className="mt-6 rounded border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Processo na concessionária</h3>
        {carregandoDados ? (
          <p className="mt-2 text-xs text-slate-500">Carregando…</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-700">
              Estado atual:{' '}
              {atual
                ? <strong>{ESTADOS.find(([v]) => v === atual)?.[1] ?? atual}</strong>
                : <span className="text-slate-500">nunca registrado</span>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ESTADOS.map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => mudarEstado(valor)}
                  disabled={!fase.liberada || valor === atual}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700
                    hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {rotulo}
                </button>
              ))}
            </div>
            {!fase.liberada && (
              <p className="mt-2 text-xs text-slate-500">
                O Gate bloqueia o avanço. A consulta acima continua disponível.
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-4 rounded border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Protocolo na concessionária</h3>
        {carregandoDados ? (
          <p className="mt-2 text-xs text-slate-500">Carregando…</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={protocolo}
                onChange={(e) => { setProtocolo(e.target.value); setEditandoProtocolo(true) }}
                disabled={!fase.liberada}
                placeholder="Número devolvido pela concessionária"
                className="min-w-[16rem] flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm
                  disabled:bg-slate-50 disabled:text-slate-400"
              />
              <button
                type="button"
                onClick={salvarProtocolo}
                disabled={!fase.liberada || !editandoProtocolo}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white
                  hover:bg-slate-700 disabled:bg-slate-400"
              >
                Registrar
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {estado?.numero_protocolo
                ? `Protocolado como ${estado.numero_protocolo}`
                  + (estado.protocolo_atualizado_em
                    ? ` em ${new Date(estado.protocolo_atualizado_em).toLocaleString('pt-BR')}`
                    : '')
                : 'Ainda não protocolado.'}
              {estado?.protocolo_historico?.length > 1
                && ` · ${estado.protocolo_historico.length} registros no histórico`}
            </p>
          </>
        )}
      </div>

      <ParecerDeAcesso projetoId={id} liberado={fase.liberada} />

      <div className="mt-4 rounded border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Documentos{documentos.length > 0 && (
            <span className="ml-2 font-normal text-slate-500">
              {concluidos}/{documentos.length}
            </span>
          )}
        </h3>
        {carregandoDados ? (
          <p className="mt-2 text-xs text-slate-500">Carregando…</p>
        ) : documentos.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Nenhum checklist gravado para este projeto.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {documentos.map((d, i) => (
              <li key={d.documento ?? d.id ?? i} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!d.concluido}
                  disabled={!fase.liberada}
                  onChange={() => alternarDocumento(i)}
                />
                <span>
                  <span className={d.concluido ? 'text-slate-500 line-through' : 'text-slate-700'}>
                    {/* O servidor nomeia o item em `documento`. */}
                    {d.documento ?? d.nome ?? d.id}
                  </span>
                  {d.obrigatorio && <span className="ml-1 text-xs text-amber-700">obrigatório</span>}
                  {d.descricao && <span className="block text-xs text-slate-500">{d.descricao}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Conclusão da fase não rastreável: nenhum agregado registra o encerramento.
        Previsto para {fase.sprint_responsavel}.
      </p>
    </section>
  )
}
