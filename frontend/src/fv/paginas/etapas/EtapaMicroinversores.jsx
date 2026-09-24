import { useMemo, useState } from 'react'
import { useProjeto } from '../../providers/ProjetoProvider'
import {
  avaliar, capacidadeDoBloco, coerenciaComComposicao, configDaComposicao,
  correnteDoBloco, daConfigPersistida, distribuicaoDoBloco, inteiro,
  microsNecessariosNoBloco, modulosAtribuidos, obsolescenciaDaComposicao,
  paraArranjoComMicros, planoDaComposicao, procedenciaDaCapacidade,
  totalDeMicros, VEREDITO,
} from '../../microinversores'

/** Como cada procedência de capacidade se apresenta — Sprint E2, §2 e §10. */
const PROCEDENCIA = {
  ssot: { texto: 'do catálogo', classe: 'text-emerald-700' },
  manual: {
    texto: 'informado manualmente — o catálogo não declara',
    classe: 'text-amber-700',
  },
  ajustado: {
    texto: 'ajustado pelo operador sobre o valor do catálogo',
    classe: 'text-amber-700',
  },
}

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
 *
 * ── Sprint E — o nível acima do micro ────────────────────────────────────────
 * Micro 1..N deixaram de ser uma caixa genérica: cada unidade é identificada, e
 * acima delas aparecem os ARRANJOS (ramais CA) e as FASES. Nada disso é decidido
 * aqui — `planoDoBloco` delega ao motor canônico, que aplica a regra do
 * fabricante do modelo selecionado e reparte os ramais entre L1/L2/L3.
 *
 * Sem regra declarada (nem no catálogo, nem na tabela do fabricante) NÃO há
 * arranjos: a lacuna é dita e a tela para ali. Uma distribuição de aparência
 * válida sobre um limite inventado seria pior do que a ausência dela.
 */
export default function EtapaMicroinversores({ catalogoInversores, arranjoPrincipal, totalModulos, potenciaModuloW, fases = null, iscModuloA = null, imppModuloA = null }) {
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
      const lista = [...outros, paraArranjoComMicros(arranjoPrincipal, atual, fases)]
      await acoes.salvarEtapa('arranjos', { lista })
      setConfig(null)
      setSalvo(true)
    } catch (e) {
      setErroSalvar(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setSalvando(false)
    }
  }

  // Sprint E2 — um plano para a composição inteira, e a obsolescência medida
  // contra ele. Calculados uma vez por render, não por bloco.
  const composicao = useMemo(() => planoDaComposicao(atual, fases), [atual, fases])
  const obsolescencias = useMemo(() => obsolescenciaDaComposicao(atual, fases), [atual, fases])

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
        // Sprint E2 — o plano é o da COMPOSIÇÃO: as fases de um modelo dependem
        // dos arranjos dos outros. Ver `planejarComposicaoMicro`.
        const plano = composicao.por_modelo[i] ?? null
        const obsoleto = obsolescencias[i] ?? { obsoleto: false, motivos: [] }
        const corrente = plano ? correnteDoBloco(b, { isc: iscModuloA, impp: imppModuloA }, plano) : null
        const proc = procedenciaDaCapacidade(b)
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

            {/* ── Cadastro inconsistente (Sprint E3, §3 e §9) ───────────────── */}
            {(b._conflitos ?? []).filter((c) => c.tipo !== 'so_em_specs_canonicas').length > 0 && (
              <div
                role="alert" aria-label={`Cadastro inconsistente ${i + 1}`}
                className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
              >
                <p className="font-medium">Cadastro inconsistente — revisão necessária.</p>
                {b._conflitos
                  .filter((c) => c.tipo !== 'so_em_specs_canonicas')
                  .map((c) => <p key={c.campo + c.tipo} className="mt-1">{c.mensagem}</p>)}
                <p className="mt-1">
                  Enquanto o conflito existir, nenhum dos valores é usado no cálculo —
                  escolher um deles em silêncio esconderia o problema.
                </p>
              </div>
            )}
            {(b._conflitos ?? []).filter((c) => c.tipo === 'so_em_specs_canonicas').length > 0 && (
              <div
                aria-label={`Dado fora do alcance ${i + 1}`}
                className="mt-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600"
              >
                {b._conflitos
                  .filter((c) => c.tipo === 'so_em_specs_canonicas')
                  .map((c) => <p key={c.campo}>{c.mensagem}</p>)}
              </div>
            )}

            {/* ── Procedência da capacidade (Sprint E2, §2) ─────────────────── */}
            <p
              aria-label={`Procedência da capacidade ${i + 1}`}
              className={`mt-2 text-xs ${proc === null ? 'text-amber-700' : PROCEDENCIA[proc].classe}`}
            >
              {proc === null
                ? 'Capacidade não determinada — faltam entradas / módulos por entrada. '
                  + 'Nenhuma capacidade é assumida e a distribuição automática não roda.'
                : proc === 'ssot'
                  ? `Capacidade ${capacidade} módulo(s) por micro — calculada pelo SSOT.`
                  : `Capacidade ${capacidade} módulo(s) por micro — ${PROCEDENCIA[proc].texto}.`}
            </p>

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

            {necessarios !== null && inteiro(b.quantidade) !== necessarios && (
              <p className="mt-2 text-xs text-slate-600">
                <button
                  type="button" onClick={() => mudar(i, 'quantidade', necessarios)}
                  className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                >
                  Usar {necessarios} microinversor(es)
                </button>
                <span className="ml-2 text-slate-500">
                  é o que os {b.modulos ?? '—'} módulo(s) ocupam nesta capacidade.
                </span>
              </p>
            )}

            {/* ── Micro 1..N — identificação explícita (Sprint E, §3) ──────── */}
            {distribuicao && plano && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-600">Microinversores</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {distribuicao.map((mods, k) => {
                    const entradas = plano.entradas_por_micro_usadas?.[k] ?? null
                    const arranjoDoMicro = (plano.arranjos ?? []).find((a) => a.micros.includes(k + 1)) ?? null
                    return (
                      <li
                        key={k}
                        aria-label={`Micro ${k + 1}`}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                      >
                        <span className="font-medium">Micro {k + 1}</span>
                        <span className="text-slate-500"> · {mods} módulo(s)</span>
                        {entradas && <span className="text-slate-400"> · entradas {entradas.join('/')}</span>}
                        {arranjoDoMicro && (
                          <span className="text-slate-500">
                            {' '}· Arranjo {arranjoDoMicro.indice}
                            {arranjoDoMicro.fase ? ` · ${arranjoDoMicro.fase}` : ''}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* ── Arranjos (ramais CA) e a regra que os formou ─────────────── */}
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-600">Arranjos</p>
              {!plano || plano.arranjos === null ? (
                <p className="mt-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Regra de arranjo não declarada no SSOT — limite de microinversores por ramal ausente
                  {b._fabricante ? ` para ${b._fabricante}` : ''} — nem no catálogo deste
                  modelo, nem como regra de fabricante. Nenhum agrupamento foi proposto:
                  a regra de outro fabricante não se aplica aqui.
                </p>
              ) : (
                <>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {plano.arranjos.map((a) => (
                      <li
                        key={a.indice}
                        aria-label={`Arranjo ${a.indice}`}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        <span className="font-medium">Arranjo {a.indice}</span>
                        <span className="text-slate-500">
                          {' '}· {a.micros.length} micro(s) ({a.micros.map((n) => `Micro ${n}`).join(', ')})
                        </span>
                        {a.modulos !== null && <span className="text-slate-400"> · {a.modulos} módulo(s)</span>}
                        {a.fase && <span className="font-medium text-slate-700"> · {a.fase}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-slate-500">
                    Máximo de {plano.regra.max_por_cabo_tronco} microinversor(es) por
                    arranjo — {plano.regra.fonte === 'catalogo'
                      ? 'declarado no catálogo deste modelo'
                      : `regra do fabricante ${plano.regra.fabricante}`}.
                    {plano.regra.procedencia ? ` ${plano.regra.procedencia}` : ''}
                  </p>
                </>
              )}
            </div>

            {/* ── Corrente (Sprint E2, §3) — motor separado, veredito próprio ── */}
            <div className="mt-3" aria-label={`Corrente ${i + 1}`}>
              <p className="text-xs font-medium text-slate-600">Corrente</p>
              {!corrente ? (
                <p className="mt-1 text-xs text-slate-500">
                  Sem plano de arranjos, não há corrente de ramal a informar.
                </p>
              ) : (
                <dl className="mt-1 space-y-1 text-xs">
                  {/* Operação e curto-circuito são critérios DIFERENTES, com
                      pesos diferentes: um adverte, o outro impede. */}
                  <div aria-label={`Corrente de operação ${i + 1}`}>
                    <dt className="inline text-slate-500">Corrente de operação (Impp): </dt>
                    <dd className={`inline ${
                      corrente.entrada.operacao.status === VEREDITO.ATENCAO ? 'text-amber-700'
                        : corrente.entrada.operacao.status === VEREDITO.OK ? 'text-emerald-700'
                          : 'text-slate-500'}`}
                    >
                      {corrente.entrada.operacao.corrente_a === null
                        ? 'não avaliada'
                        : `${corrente.entrada.operacao.corrente_a} A`}
                      {corrente.entrada.operacao.limite_a === null
                        ? ' · limite de trabalho não cadastrado'
                        : ` · limite de trabalho ${corrente.entrada.operacao.limite_a} A`}
                      {corrente.entrada.operacao.motivo ? ` — ${corrente.entrada.operacao.motivo}` : ''}
                    </dd>
                  </div>
                  <div aria-label={`Corrente de curto-circuito ${i + 1}`}>
                    <dt className="inline text-slate-500">Corrente de curto-circuito (Isc): </dt>
                    <dd className={`inline ${
                      corrente.entrada.curto_circuito.status === VEREDITO.EXCEDIDA ? 'text-red-700'
                        : corrente.entrada.curto_circuito.status === VEREDITO.OK ? 'text-emerald-700'
                          : 'text-slate-500'}`}
                    >
                      {corrente.entrada.curto_circuito.corrente_a === null
                        ? 'não avaliada'
                        : `${corrente.entrada.curto_circuito.corrente_a} A`}
                      {corrente.entrada.curto_circuito.limite_a === null
                        ? ' · limite de curto não cadastrado'
                        : ` · limite ${corrente.entrada.curto_circuito.limite_a} A`}
                      {corrente.entrada.curto_circuito.motivo ? ` — ${corrente.entrada.curto_circuito.motivo}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Corrente de projeto (NBR 16690 §5.2): </dt>
                    <dd className="inline text-slate-500">
                      {corrente.entrada.projeto_normativa.corrente_a === null
                        ? 'não calculada'
                        : `${corrente.entrada.projeto_normativa.corrente_a} A = Isc × ` +
                          `${corrente.entrada.projeto_normativa.fator}`}
                      {corrente.entrada.projeto_normativa.acima_do_trabalho
                        ? ' · acima da corrente de trabalho — dimensiona cabo e proteção, '
                          + 'não decide compatibilidade'
                        : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Saída CA de cada micro: </dt>
                    <dd className="inline text-slate-700">
                      {corrente.micro.corrente_a === null
                        ? `não avaliada — ${corrente.micro.motivo}`
                        : `${corrente.micro.corrente_a} A`}
                    </dd>
                  </div>
                  {(corrente.ramais ?? []).map((ra) => (
                    <div key={ra.arranjo}>
                      <dt className="inline text-slate-500">Ramal do arranjo {ra.arranjo}: </dt>
                      <dd className="inline text-amber-700">
                        {ra.corrente_a === null
                          ? 'não avaliada — limite do ramal não cadastrado'
                          : `${ra.corrente_a} A (${ra.micros} micros) — ` +
                            'não avaliada: limite do ramal não cadastrado'}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {obsoleto.obsoleto && (
              <p role="alert" className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                O agrupamento salvo não descreve mais esta configuração: {obsoleto.motivos.join('; ')}.
                A tela mostra o plano recalculado — salve para substituir o que está gravado.
              </p>
            )}

            {(plano?.avisos ?? []).map((m) => (
              <p key={m} className="mt-2 text-xs text-slate-500">{m}</p>
            ))}

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

      {/* ── Fases da COMPOSIÇÃO (Sprint E2, §5 e §6) ──────────────────────── */}
      {atual.length > 0 && (
        <section className="mt-6 rounded border border-slate-200 bg-white p-4" aria-label="Fases da composição">
          <h3 className="text-sm font-semibold text-slate-900">Fases</h3>
          <p className="mt-1 text-xs text-slate-500">
            O balanceamento olha os arranjos de <strong>todos</strong> os modelos de uma vez.
            Repartir cada modelo em separado empilharia todos em L1 e cada um se
            declararia equilibrado.
          </p>

          {!composicao.fases ? (
            <p className="mt-2 text-xs text-amber-700">
              Fases da instalação não informadas — etapa Projeto.
            </p>
          ) : composicao.fases.fases === null ? (
            <p className="mt-2 text-xs text-slate-500">
              {composicao.fases.rotulo}: uma única fase viva. Não há balanceamento a
              definir e nenhum foi fabricado.
            </p>
          ) : (
            <>
              <ul className="mt-2 flex flex-wrap gap-2">
                {composicao.fases.fases.map((f) => (
                  <li
                    key={f}
                    aria-label={`Fase ${f}`}
                    className={`rounded border px-2 py-1 text-xs ${
                      composicao.fases.por_fase[f] === 0
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-slate-300 bg-white text-slate-700'}`}
                  >
                    <span className="font-medium">{f}</span>
                    <span> · {composicao.fases.por_fase[f]} micro(s)</span>
                  </li>
                ))}
              </ul>
              <p className={`mt-2 text-xs ${composicao.fases.equilibrado ? 'text-emerald-700' : 'text-amber-700'}`}>
                {composicao.fases.equilibrado
                  ? `${composicao.fases.rotulo}: fases equilibradas.`
                  : `${composicao.fases.rotulo}: diferença de ${composicao.fases.desequilibrio} microinversor(es) entre a fase mais e a menos carregada.`}
              </p>
              {composicao.fases.fases_sem_arranjo?.length > 0 && (
                <p role="alert" aria-label="Fase sem arranjo"
                  className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {composicao.fases.fases_sem_arranjo.join(' e ')} sem nenhum
                  microinversor. São {composicao.total_arranjos} arranjo(s) para{' '}
                  {composicao.fases.n} fases, pela política <strong>{composicao.politica.rotulo}</strong>:
                  {' '}{composicao.politica.descricao} Dividir os mesmos micros em mais
                  arranjos ocuparia todas as fases ao custo de um ramal a mais —{' '}
                  {composicao.politica.alternativa_nao_implementada.motivo}
                </p>
              )}
            </>
          )}

          {!composicao.homogenea && (
            <p className="mt-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Composição com modelos diferentes: capacidade e regra de arranjo são
              avaliadas por modelo, nunca uniformizadas.
            </p>
          )}
          {composicao.avisos.map((m) => (
            <p key={m} className="mt-2 text-xs text-slate-500">{m}</p>
          ))}
        </section>
      )}

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
