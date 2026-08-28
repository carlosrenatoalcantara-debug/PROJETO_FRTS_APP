import { useMemo, useState } from 'react'
import { useProjeto } from '../../providers/ProjetoProvider'
import ResumoOpcao from '../../componentes/ResumoOpcao'
import {
  TIPOS_ESTRUTURA, TIPO_OUTRO, daEquipamentos, exigeDescricao,
  paraEquipamentos, rotuloDaEstrutura, tipoForaDaLista, validarEstrutura,
} from '../../estrutura'

/**
 * EtapaEstrutura — estrutura de fixação da opção — FV-UX-030.
 *
 * Vem logo depois de Equipamentos porque descreve COMO a composição que acabou
 * de ser escolhida se fixa. Grava em `equipamentos.estrutura.{tipo,descricao}`,
 * campos que já existiam no schema e que o wizard legado já usa.
 *
 * ── Vínculo com a opção ──────────────────────────────────────────────────────
 * A estrutura pertence ao mesmo `ProjetoFV` da composição, e hoje um projeto É
 * uma opção — opções concorrentes lado a lado são a FV-DOM-032, ainda em aberto.
 * Por isso o resumo da opção fica visível nesta tela: o operador vê a que
 * composição a estrutura está sendo amarrada.
 *
 * ── O que esta tela não faz ──────────────────────────────────────────────────
 * Não escolhe material, não conta ganchos, não estima preço, não valida o
 * telhado. Um único fato é gravado: qual estrutura, e a descrição quando o tipo
 * não basta.
 */
export default function EtapaEstrutura() {
  const { projeto, carregando, erro, acoes } = useProjeto()

  const [rascunho, setRascunho] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)
  const [salvo, setSalvo] = useState(false)

  const persistida = useMemo(() => daEquipamentos(projeto?.equipamentos), [projeto])

  const atual = rascunho ?? persistida
  const alterado = rascunho !== null

  function mudar(campo, valor) {
    setRascunho({ ...atual, [campo]: valor })
    setSalvo(false)
  }

  const validacao = validarEstrutura(atual)

  async function salvar() {
    if (!alterado || !validacao.valida) return
    setSalvando(true)
    setErroSalvar(null)
    try {
      // A etapa `equipamentos` SUBSTITUI o subdocumento inteiro no servidor.
      // O que o servidor devolveu vai junto, ou a composição seria apagada.
      await acoes.salvarEtapa('equipamentos', paraEquipamentos(atual, projeto?.equipamentos))
      setRascunho(null)
      setSalvo(true)
    } catch (e) {
      setErroSalvar(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>
  if (!projeto) return <p className="p-6 text-sm text-slate-500">Projeto não encontrado.</p>

  const foraDaLista = tipoForaDaLista(atual.tipo)

  return (
    <section className="mx-auto max-w-3xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Estrutura</h2>
      <p className="mt-1 text-sm text-slate-500">
        Como o sistema se fixa. Nenhum material ou preço é definido aqui.
      </p>

      {/* ── A opção a que esta estrutura pertence ─────────────────────────── */}
      <ResumoOpcao estrutura={atual} className="mt-4 block" />

      {/* ── Tipo ──────────────────────────────────────────────────────────── */}
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-slate-900">Tipo de estrutura</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TIPOS_ESTRUTURA.map(({ valor, rotulo }) => (
            <label
              key={valor}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${
                atual.tipo === valor ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
              }`}
            >
              <input
                type="radio" name="estrutura-tipo" value={valor}
                checked={atual.tipo === valor}
                onChange={() => mudar('tipo', valor)}
              />
              <span className="text-slate-900">{rotulo}</span>
            </label>
          ))}
        </div>

        {foraDaLista && (
          <p className="mt-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Estrutura gravada como <strong>{atual.tipo}</strong>, valor que não consta
            da lista acima. Está preservado — só muda se um tipo for escolhido.
          </p>
        )}

        {atual.tipo !== '' && (
          <button
            type="button" onClick={() => { mudar('tipo', ''); }}
            className="mt-2 text-xs text-slate-500 hover:text-red-600"
          >
            Limpar estrutura
          </button>
        )}
      </fieldset>

      {/* ── Descrição ─────────────────────────────────────────────────────── */}
      <label className="mt-6 block text-sm">
        <span className="block font-semibold text-slate-900">
          Descrição complementar
          {exigeDescricao(atual.tipo) ? ' (obrigatória para "Outro")' : ' (opcional)'}
        </span>
        <textarea
          aria-label="Descrição da estrutura" rows={3}
          value={atual.descricao}
          onChange={(e) => mudar('descricao', e.target.value)}
          placeholder={atual.tipo === TIPO_OUTRO
            ? 'Descreva a estrutura utilizada.'
            : 'Detalhe relevante da fixação, quando houver.'}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>

      {/* ── Estado ────────────────────────────────────────────────────────── */}
      {validacao.erros.map((m) => (
        <p key={m} role="alert" className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {m}
        </p>
      ))}
      {validacao.lacunas.length > 0 && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Estrutura não informada. A proposta pode seguir, mas o memorial
          descritivo sairá sem ela.
        </p>
      )}
      {validacao.informada && validacao.valida && (
        <p className="mt-3 text-xs text-slate-600">
          Estrutura: {rotuloDaEstrutura(atual.tipo)}
          {atual.descricao ? ` — ${atual.descricao}` : ''}
        </p>
      )}

      {erroSalvar && <p role="alert" className="mt-3 text-xs text-red-600">{erroSalvar}</p>}
      {salvo && !alterado && <p className="mt-3 text-xs text-emerald-700">Estrutura salva.</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button" onClick={salvar}
          disabled={salvando || !alterado || !validacao.valida}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          {salvando ? 'Salvando…' : 'Salvar estrutura'}
        </button>
        {alterado && !salvando && (
          <button
            type="button" onClick={() => { setRascunho(null); setErroSalvar(null) }}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Descartar alterações
          </button>
        )}
      </div>
    </section>
  )
}
