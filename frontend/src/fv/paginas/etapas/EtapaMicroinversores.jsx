import { useMemo, useState } from 'react'
import { useProjeto } from '../../providers/ProjetoProvider'
import {
  avaliar, capacidadeDoBloco, coerenciaComComposicao, configDaComposicao,
  daConfigPersistida, distribuicaoDoBloco, inteiro, microsNecessariosNoBloco,
  modulosAtribuidos, paraArranjoComMicros, totalDeMicros,
} from '../../microinversores'

/**
 * EtapaMicroinversores — topologia de micro — FV-DOM-031.
 *
 * Irmã da `EtapaMppt`, não uma variação dela. O micro não tem MPPT nem string
 * (decisão 5): tem entradas, e cada entrada recebe módulos. Forçar os dois
 * modelos na mesma tela foi exatamente o defeito que a auditoria encontrou —
 * um Hoymiles de 4 entradas aparecia como "4 MPPTs" pedindo módulos em série.
 *
 * ── O que esta tela decide e o que ela não decide ────────────────────────────
 * O operador informa quantos módulos vão para cada MODELO de micro. Quantidade
 * de micros vem da composição (FV-UX-029, decisão 8); envelope vem do catálogo.
 * A distribuição entre as unidades de um mesmo modelo é determinística — encher
 * e sobrar no último — e é mostrada, não escondida.
 *
 * Nenhuma fórmula elétrica vive aqui: o veredito é de
 * `@fortesolar/fv-shared/engenharia/microinversores`, via `avaliar()`.
 *
 * ── Reprovar é resultado válido (decisão 6) ──────────────────────────────────
 * Configuração acima do limite CC/CA do fabricante NÃO é ajustada em silêncio.
 * É reprovada, com o número medido, o limite declarado e quantos módulos
 * caberiam. Salvar continua permitido — o projeto é do projetista; o que não se
 * faz é fingir que passou.
 */
export default function EtapaMicroinversores({ catalogoInversores, arranjoPrincipal, totalModulos, potenciaModuloW }) {
  const { projeto, acoes } = useProjeto()

  const [config, setConfig] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)
  const [salvo, setSalvo] = useState(false)

  const persistida = useMemo(
    () => daConfigPersistida(arranjoPrincipal?.configuracao_eletrica?.micros, catalogoInversores),
    [arranjoPrincipal, catalogoInversores])

  const inicial = useMemo(
    () => configDaComposicao(arranjoPrincipal?.inversores, catalogoInversores, totalModulos),
    [arranjoPrincipal, catalogoInversores, totalModulos])

  /**
   * `config === null` significa "o operador ainda não editou" — a tela mostra o
   * que veio do projeto. NÃO há efeito que copie o inicial para o estado: a
   * primeira versão fazia isso e travava uma lista VAZIA quando o catálogo ainda
   * não tinha chegado, porque o efeito só rodava uma vez. Derivar em vez de
   * copiar elimina a janela inteira.
   */
  const atual = config ?? persistida ?? inicial
  const alterado = config !== null

  const veredito = useMemo(
    () => avaliar(atual, potenciaModuloW, totalModulos),
    [atual, potenciaModuloW, totalModulos])

  function mudar(i, campo, valor) {
    // `atual` é o estado editado OU o do projeto — a primeira edição copia.
    const copia = atual.map((b) => ({ ...b }))
    copia[i][campo] = inteiro(valor)
    setConfig(copia)
    setSalvo(false)
  }

  async function salvar() {
    setSalvando(true)
    setErroSalvar(null)
    try {
      const outros = (projeto?.arranjos ?? []).filter((a) => a !== arranjoPrincipal)
      const lista = [...outros, paraArranjoComMicros(arranjoPrincipal, atual)]
      await acoes.salvarEtapa('arranjos', { lista })
      setConfig(null)
      setSalvo(true)
    } catch (e) {
      setErroSalvar(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setSalvando(false)
    }
  }

  const coerencia = coerenciaComComposicao(atual, arranjoPrincipal?.inversores)
  const atribuidos = modulosAtribuidos(atual)
  const faltam = totalModulos === null ? null : totalModulos - atribuidos

  const campo = (valor, aoMudar, rotulo, editavel = true) => (
    <input
      aria-label={rotulo} type="number" min="1" step="1" readOnly={!editavel}
      value={valor === null || valor === undefined ? '' : String(valor)}
      onChange={(e) => aoMudar(e.target.value)}
      className={`w-20 rounded border px-2 py-1 text-sm ${
        editavel ? 'border-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
    />
  )

  return (
    <section className="mx-auto max-w-3xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Topologia — microinversores</h2>
      <p className="mt-1 text-sm text-slate-500">
        Microinversor não tem MPPT nem string: tem entradas, e cada entrada
        recebe módulos. Informe quantos módulos vão para cada modelo.
      </p>

      {atual.length === 0 && (
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nenhum microinversor na composição. Selecione-os na etapa Equipamentos.
        </p>
      )}

      {/* ── Um bloco por MODELO ───────────────────────────────────────────── */}
      {atual.map((b, i) => {
        const distribuicao = distribuicaoDoBloco(b)
        const capacidade = capacidadeDoBloco(b)
        const necessarios = microsNecessariosNoBloco(b)
        const r = veredito.por_modelo[i] ?? null
        return (
          <article key={b.equipamento_id ?? i} className="mt-4 rounded border border-slate-200 bg-white p-4">
            <header className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {[b.marca, b.modelo].filter(Boolean).join(' ') || '—'}
              </h3>
              <span className="text-xs text-slate-500">
                {b._potencia_kw === null ? 'potência não declarada' : `${b._potencia_kw} kW CA`}
                {b._oversizing_max === null ? ' · sem limite CC/CA declarado' : ` · CC/CA máx. ${b._oversizing_max}×`}
              </span>
            </header>

            <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
              <label>
                <span className="block text-slate-600">Microinversores</span>
                {campo(b.quantidade, (v) => mudar(i, 'quantidade', v), `Quantidade de microinversores ${i + 1}`)}
              </label>
              <label>
                <span className="block text-slate-600">Entradas por micro</span>
                {campo(b.entradas_por_micro, (v) => mudar(i, 'entradas_por_micro', v), `Entradas por micro ${i + 1}`)}
              </label>
              <label>
                <span className="block text-slate-600">Módulos por entrada</span>
                {campo(b.modulos_por_entrada, (v) => mudar(i, 'modulos_por_entrada', v), `Módulos por entrada ${i + 1}`)}
              </label>
              <label>
                <span className="block text-slate-600">Módulos neste modelo</span>
                {campo(b.modulos, (v) => mudar(i, 'modulos', v), `Módulos do modelo ${i + 1}`)}
              </label>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
              <div><dt className="inline text-slate-500">Capacidade: </dt>
                <dd className="inline">{capacidade === null ? '—' : `${capacidade} módulos`}</dd></div>
              <div><dt className="inline text-slate-500">Micros necessários: </dt>
                <dd className="inline">{necessarios === null ? '—' : necessarios}</dd></div>
              <div><dt className="inline text-slate-500">CC/CA no mais carregado: </dt>
                <dd className="inline">
                  {r?.resumo?.oversizing_mais_carregado === null || r?.resumo?.oversizing_mais_carregado === undefined
                    ? '—' : `${r.resumo.oversizing_mais_carregado.toFixed(2)}×`}
                </dd></div>
            </dl>

            {distribuicao && (
              <p className="mt-2 text-xs text-slate-500">
                Distribuição: {distribuicao.join(' · ')} módulo(s) por microinversor.
              </p>
            )}

            {r?.lacunas?.length > 0 && (
              <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                O catálogo não declara: {r.lacunas.join(', ')}. Nenhum valor foi assumido.
              </p>
            )}
            {r?.bloqueios?.map((m) => (
              <p key={m} role="alert" className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                {m}
              </p>
            ))}
            {r?.avisos?.map((m) => (
              <p key={m} className="mt-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {m}
              </p>
            ))}
          </article>
        )
      })}

      {/* ── Fechamento com a composição ───────────────────────────────────── */}
      <dl className="mt-6 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
        {[
          ['Microinversores', `${totalDeMicros(atual)} un.`],
          ['Módulos atribuídos', `${atribuidos} de ${totalModulos === null ? '—' : totalModulos}`],
          ['Potência CA', veredito.resumo.potencia_ca_kw ? `${veredito.resumo.potencia_ca_kw} kW` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2 px-4 py-2">
            <dt className="w-52 shrink-0 text-slate-500">{k}</dt>
            <dd className="text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      {faltam !== null && faltam !== 0 && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {faltam > 0
            ? `${faltam} módulo(s) ainda não atribuído(s) a nenhum microinversor.`
            : `${-faltam} módulo(s) a mais do que a composição tem.`}
        </p>
      )}

      {coerencia.map((c) => (
        <p key={c.rotulo} className="mt-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {c.rotulo}: a topologia usa {c.naTopologia} microinversor(es) e a
          composição tem {c.previsto}. A composição é a fonte da opção — ajuste
          uma das duas na etapa Equipamentos ou aqui.
        </p>
      ))}

      {veredito.bloqueios.map((m) => (
        <p key={m} role="alert" className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {m}
        </p>
      ))}

      {veredito.valido && atual.length > 0 && (
        <p className="mt-3 text-xs text-emerald-700">
          Configuração válida dentro dos limites declarados pelo fabricante.
        </p>
      )}

      {erroSalvar && <p role="alert" className="mt-3 text-xs text-red-600">{erroSalvar}</p>}
      {salvo && !alterado && <p className="mt-3 text-xs text-emerald-700">Topologia salva.</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button" onClick={salvar} disabled={salvando || atual.length === 0}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          {salvando ? 'Salvando…' : 'Salvar topologia'}
        </button>
        {alterado && !salvando && (
          <button
            type="button" onClick={() => { setConfig(null); setErroSalvar(null) }}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Descartar alterações
          </button>
        )}
      </div>
      {!veredito.valido && atual.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Salvar é permitido mesmo com reprovação — o registro é do projetista.
          O que não acontece é a reprovação sumir.
        </p>
      )}
    </section>
  )
}
