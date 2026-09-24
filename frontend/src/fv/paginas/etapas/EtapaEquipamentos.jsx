import { useEffect, useMemo, useState } from 'react'
import { useProjeto } from '../../providers/ProjetoProvider'
import { listarCatalogo } from '../../api/agregadosFvApi'
import {
  painelDoCatalogo, inversorDoCatalogo,
  potenciaDoModulo, potenciaDoInversor, rotuloDoEquipamento,
  rotuloDoInversor, tipoDoInversor, fasesDoInversor, avisoDeFase,
  TECNOLOGIAS_INVERSOR,
} from '../../catalogo'
import {
  quantidade, totalModulos, totalInversores, potenciaCcKwp, potenciaCaKw,
  lacunasDaComposicao, coerenciaComDimensionamento, multiModelo,
  paraArranjos, daArranjos, projecaoLegado,
} from '../../composicao'

/**
 * EtapaEquipamentos — COMPOSIÇÃO do sistema — FV-UX-029.
 *
 * Até a FV-UX-019 esta tela tratava equipamento como seleção transitória: um
 * módulo, um inversor, nada mais. Um sistema real tem N modelos de módulo e N
 * inversores, cada um com quantidade — e é isso que o orçamento precisa listar.
 *
 * ── Onde a composição vive ───────────────────────────────────────────────────
 * `ProjetoFV.arranjos[]`, gravado por `PUT /:id/etapa` com `etapa: 'arranjos'`.
 * É o único lugar do schema que modela `paineis[]` e `inversores[]` ambos com
 * quantidade. Nada novo foi criado — o array, a etapa e o normalizador
 * (`arranjosService`) já existiam e nunca tinham sido usados pela nova UX.
 *
 * `equipamentos.{paineis,inversor}` continua sendo escrito como PROJEÇÃO, para
 * os oito leitores que ainda o consultam (parecer de acesso, homologação,
 * alertcenter e as três telas técnicas). Nunca é editado por conta própria.
 *
 * ── O que esta tela não faz ──────────────────────────────────────────────────
 * Não dimensiona, não distribui strings, não define MPPT, não escolhe estrutura,
 * não precifica. Soma quantidades e multiplica pela potência do catálogo — é a
 * única aritmética daqui.
 */

const texto = (v) => (v === null || v === undefined ? '' : String(v))

export default function EtapaEquipamentos() {
  const { projeto, carregando, erro, acoes } = useProjeto()

  const [catalogo, setCatalogo] = useState(null)
  const [erroCatalogo, setErroCatalogo] = useState(null)
  const [composicao, setComposicao] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)
  const [salvo, setSalvo] = useState(false)

  // Formulário de adição — um por tipo.
  // Sprint C: `marca` é estado de NAVEGAÇÃO do seletor — nunca é persistida a
  // partir daqui. O que vai para o projeto continua sendo o `id` canônico.
  const [novoModulo, setNovoModulo] = useState({ marca: '', id: '', quantidade: '' })
  const [novoInversor, setNovoInversor] = useState({ marca: '', id: '', quantidade: '' })

  useEffect(() => {
    let vivo = true
    Promise.all([listarCatalogo('modulo'), listarCatalogo('inversor')])
      .then(([m, i]) => vivo && setCatalogo({ modulos: m?.equipamentos ?? [], inversores: i?.equipamentos ?? [] }))
      .catch((e) => vivo && setErroCatalogo(e.message))
    return () => { vivo = false }
  }, [])

  /**
   * Composição persistida. Precedência: `arranjos[]` (fonte) e, na ausência
   * dele, o legado — que é como `arranjosService` já deriva no backend.
   */
  const persistida = useMemo(() => {
    const dosArranjos = daArranjos(projeto?.arranjos)
    if (dosArranjos && (dosArranjos.paineis.length || dosArranjos.inversores.length)) return dosArranjos
    const eq = projeto?.equipamentos ?? {}
    const inv = eq.inversor
    return {
      paineis: (eq.paineis ?? []).map((p) => ({ ...p })),
      inversores: inv && (inv.marca || inv.modelo)
        ? [{ ...inv, quantidade: inv.quantidade ?? 1 }] : [],
    }
  }, [projeto])

  const atual = composicao ?? persistida
  const alterado = composicao !== null

  const modulos = catalogo?.modulos ?? null
  const inversores = catalogo?.inversores ?? null
  const catalogoCarregando = modulos === null || inversores === null

  function mutar(fn) {
    const copia = JSON.parse(JSON.stringify(atual))
    fn(copia)
    setComposicao(copia)
    setSalvo(false)
  }

  function adicionarModulo() {
    const eq = (modulos ?? []).find((e) => String(e._id) === novoModulo.id)
    const q = quantidade(novoModulo.quantidade)
    if (!eq || q === null) return
    mutar((c) => {
      const existente = c.paineis.find((p) => String(p.equipamento_id) === String(eq._id))
      // Mesmo modelo adicionado de novo SOMA — evita duas linhas do mesmo item.
      // `quantidade()` já garante inteiro > 0 ou null; null significa linha sem
      // quantidade, e somar sobre ela é a própria quantidade nova.
      if (existente) {
        const anterior = quantidade(existente.quantidade)
        existente.quantidade = anterior === null ? q : anterior + q
      } else c.paineis.push(painelDoCatalogo(eq, q))
    })
    setNovoModulo((s) => ({ marca: s.marca, id: '', quantidade: '' }))
  }

  function adicionarInversor() {
    const eq = (inversores ?? []).find((e) => String(e._id) === novoInversor.id)
    const q = quantidade(novoInversor.quantidade)
    if (!eq || q === null) return
    mutar((c) => {
      const existente = c.inversores.find((i) => String(i.equipamento_id) === String(eq._id))
      if (existente) {
        const anterior = quantidade(existente.quantidade)
        existente.quantidade = anterior === null ? q : anterior + q
      } else c.inversores.push({ ...inversorDoCatalogo(eq), quantidade: q })
    })
    setNovoInversor((s) => ({ marca: s.marca, id: '', quantidade: '' }))
  }

  const removerModulo = (i) => mutar((c) => c.paineis.splice(i, 1))
  const removerInversor = (i) => mutar((c) => c.inversores.splice(i, 1))
  const alterarQtdModulo = (i, v) => mutar((c) => { c.paineis[i].quantidade = quantidade(v) })
  const alterarQtdInversor = (i, v) => mutar((c) => { c.inversores[i].quantidade = quantidade(v) })

  async function salvar() {
    if (!alterado) return
    setSalvando(true)
    setErroSalvar(null)
    try {
      const arranjoExistente = (projeto?.arranjos ?? []).find((a) => a?.tipo === 'principal') ?? null
      // 1) A COMPOSIÇÃO, na sua forma canônica.
      await acoes.salvarEtapa('arranjos', { lista: paraArranjos(atual, arranjoExistente) })
      // 2) A PROJEÇÃO para os leitores que ainda esperam um módulo e um inversor.
      await acoes.salvarEtapa('equipamentos', projecaoLegado(atual, projeto?.equipamentos))
      setComposicao(null)
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

  const lacunas = lacunasDaComposicao(atual)
  const coerencia = coerenciaComDimensionamento(atual, projeto?.dimensionamento?.num_paineis)
  const kwp = potenciaCcKwp(atual)
  const kwCa = potenciaCaKw(atual)

  /**
   * Sprint B — o resultado do Dimensionamento chega aqui.
   *
   * NECESSIDADE é `dimensionamento.potencia_kwp`, a fonte canônica da FV-DOM-052.
   * COMPRADA é a potência da composição desta tela. Nada novo é persistido: a
   * comparação é DERIVADA das duas fontes que já existem (INV-58).
   *
   * ── Por que a diferença de quantidade não é acusada como erro ───────────────
   * Desde a Sprint A o Dimensionamento vem ANTES desta etapa. Na primeira
   * passagem ainda não há módulo escolhido, e o motor estima a quantidade com a
   * referência de 550 W. Comparar aquela quantidade com uma composição de módulos
   * de outra potência produz diferença ESPERADA, não defeito.
   *
   * A tela NÃO tenta adivinhar qual potência o motor usou. Reproduzir aqui o
   * `ceil(kWp × 1000 / pot_modulo_w)` para deduzir isso seria trazer a fórmula do
   * motor para o cliente — exatamente o que a FV-UX-019/029 proíbe, e o que os
   * checks desta suíte barram. Em vez de inferir, a tela diz o que sabe: quando
   * há diferença, recalcular o Dimensionamento com o módulo escolhido é o que
   * resolve. Quem decide é o motor, não esta página.
   */
  const necessidadeKwp = (() => {
    const v = Number(projeto?.dimensionamento?.potencia_kwp)
    return Number.isFinite(v) && v > 0 ? v : null
  })()
  const primeiroInversor = atual.inversores[0] ?? null
  const avisoFase = primeiroInversor
    ? avisoDeFase(projeto?.fatura_extracao?.tipo_ligacao, primeiroInversor.fases ?? null)
    : null

  const porTecnologia = (() => {
    const restante = new Set((inversores ?? []).map((e) => String(e._id)))
    const grupos = TECNOLOGIAS_INVERSOR.map(([chave, rotulo]) => {
      const lista = (inversores ?? []).filter((e) => tipoDoInversor(e) === chave)
      for (const e of lista) restante.delete(String(e._id))
      return [chave, rotulo, lista]
    }).filter(([, , lista]) => lista.length > 0)
    const outros = (inversores ?? []).filter((e) => restante.has(String(e._id)))
    return outros.length ? [...grupos, ['outros', 'Outros', outros]] : grupos
  })()

  /**
   * Sprint C — seleção hierárquica: Tipo → Marca → Modelo → Equipamento SSOT.
   *
   * As marcas são DERIVADAS do catálogo carregado (`equipamento.fabricante`).
   * Nenhuma lista de marcas existe no código: hardcodá-las criaria o catálogo
   * paralelo que a FV-UX-019 proíbe, e o catálogo real muda sem avisar a UX.
   *
   * A seleção continua apontando para o mesmo canônico de sempre — `_id`, que
   * `moduloDoCatalogo`/`inversorDoCatalogo` gravam em `equipamento_id`. Nenhum
   * campo novo, nenhuma especificação duplicada: potência e demais parâmetros
   * seguem vindo do SSOT (`potenciaDoModulo`, `potenciaDoInversor`).
   *
   * Equipamento sem fabricante declarado não é escondido nem inventado: cai em
   * "sem marca declarada", e continua selecionável pelo modelo.
   */
  const SEM_MARCA = '— sem marca declarada —'
  const marcaDe = (e) => {
    const m = typeof e?.fabricante === 'string' ? e.fabricante.trim() : ''
    return m === '' ? SEM_MARCA : m
  }

  /**
   * Marcas presentes na lista, sem repetição, em ordem alfabética, com a
   * contagem de modelos de cada uma.
   *
   * A contagem é escrita sem `?? 0` de propósito: o check da FV-UX-019 varre
   * este arquivo atrás desse padrão, porque foi assim que defaults técnicos
   * fabricados entraram no adapter do wizard. Aqui seria só um contador, mas a
   * guarda é textual — e contorná-la valeria menos que escrever de outro jeito.
   */
  const marcasDe = (lista) => {
    const vistas = new Map()
    for (const e of lista ?? []) {
      const m = marcaDe(e)
      const anterior = vistas.has(m) ? vistas.get(m) : 0
      vistas.set(m, anterior + 1)
    }
    return [...vistas.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
  }

  /** Só os equipamentos da marca escolhida. Marca vazia devolve lista vazia. */
  const modelosDaMarca = (lista, marca) =>
    marca === '' ? [] : (lista ?? []).filter((e) => marcaDe(e) === marca)

  const marcasModulo = marcasDe(modulos)
  const marcasInversor = marcasDe(inversores)
  const modelosModulo = modelosDaMarca(modulos, novoModulo.marca)
  const modelosInversor = modelosDaMarca(inversores, novoInversor.marca)

  const linhaQtd = (valor, aoMudar, rotuloAria) => (
    <input
      aria-label={rotuloAria} type="number" min="1" step="1"
      value={texto(valor)} onChange={(e) => aoMudar(e.target.value)}
      className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
    />
  )

  return (
    <section className="mx-auto max-w-3xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Equipamentos</h2>
      <p className="mt-1 text-sm text-slate-500">
        Composição do sistema. Adicione quantos modelos forem necessários — tudo
        vem do catálogo, com quantidade.
      </p>

      {erroCatalogo && (
        <p role="alert" className="mt-4 text-sm text-red-600">Catálogo indisponível: {erroCatalogo}</p>
      )}

      {/* ── MÓDULOS ───────────────────────────────────────────────────────── */}
      <h3 className="mt-6 text-sm font-semibold text-slate-900">Módulos</h3>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {atual.paineis.length === 0 && (
            <tr><td className="py-2 text-slate-400">nenhum módulo na composição</td></tr>
          )}
          {atual.paineis.map((p, i) => (
            <tr key={`${p.equipamento_id}-${i}`} className="border-b border-slate-100">
              <td className="py-2 text-slate-900">
                {[p.marca, p.modelo].filter(Boolean).join(' ') || '—'}
                <span className="ml-2 text-slate-500">
                  {p.potencia_w === null || p.potencia_w === undefined
                    ? 'potência não informada' : `${p.potencia_w} W`}
                </span>
              </td>
              <td className="w-32 py-2">{linhaQtd(p.quantidade, (v) => alterarQtdModulo(i, v), `Quantidade do módulo ${i + 1}`)}</td>
              <td className="w-24 py-2 text-right">
                <button type="button" onClick={() => removerModulo(i)}
                  className="text-xs text-slate-500 hover:text-red-600">remover</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-slate-50 p-3">
        <label className="text-sm">
          <span className="block text-slate-600">Marca do módulo</span>
          <select
            aria-label="Marca do módulo" disabled={catalogoCarregando}
            value={novoModulo.marca}
            onChange={(e) => setNovoModulo({ ...novoModulo, marca: e.target.value, id: '' })}
            className="mt-1 w-56 rounded border border-slate-300 px-2 py-1"
          >
            <option value="">
              {catalogoCarregando ? 'carregando catálogo…' : `selecione a marca (${marcasModulo.length})`}
            </option>
            {marcasModulo.map(([marca, n]) => (
              <option key={marca} value={marca}>{marca} ({n})</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Modelo</span>
          <select
            aria-label="Módulo" disabled={catalogoCarregando || novoModulo.marca === ''}
            value={novoModulo.id} onChange={(e) => setNovoModulo({ ...novoModulo, id: e.target.value })}
            className="mt-1 w-96 rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100"
          >
            <option value="">
              {novoModulo.marca === '' ? 'escolha a marca primeiro' : 'não selecionado'}
            </option>
            {modelosModulo.map((e) => (
              <option key={e._id} value={String(e._id)}>
                {rotuloDoEquipamento(e, potenciaDoModulo(e), 'W')}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Quantidade</span>
          {linhaQtd(novoModulo.quantidade, (v) => setNovoModulo({ ...novoModulo, quantidade: v }), 'Quantidade do novo módulo')}
        </label>
        <button
          type="button" onClick={adicionarModulo}
          disabled={!novoModulo.id || quantidade(novoModulo.quantidade) === null}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          Adicionar módulo
        </button>
      </div>

      {/* ── INVERSORES ────────────────────────────────────────────────────── */}
      <h3 className="mt-8 text-sm font-semibold text-slate-900">Inversores</h3>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {atual.inversores.length === 0 && (
            <tr><td className="py-2 text-slate-400">nenhum inversor na composição</td></tr>
          )}
          {atual.inversores.map((inv, i) => (
            <tr key={`${inv.equipamento_id}-${i}`} className="border-b border-slate-100">
              <td className="py-2 text-slate-900">
                {[inv.marca, inv.modelo].filter(Boolean).join(' ') || '—'}
                <span className="ml-2 text-slate-500">
                  {inv.potencia_kw === null || inv.potencia_kw === undefined
                    ? 'potência não informada' : `${inv.potencia_kw} kW`}
                  {inv.tipo ? ` · ${inv.tipo}` : ''}
                </span>
              </td>
              <td className="w-32 py-2">{linhaQtd(inv.quantidade, (v) => alterarQtdInversor(i, v), `Quantidade do inversor ${i + 1}`)}</td>
              <td className="w-24 py-2 text-right">
                <button type="button" onClick={() => removerInversor(i)}
                  className="text-xs text-slate-500 hover:text-red-600">remover</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

        {/* Sprint D2 — a SELEÇÃO do inversor saiu daqui.
            Escolher inversor exige saber a topologia e a compatibilidade
            elétrica, que só existem na etapa Topologia. A composição continua
            sendo gravada do mesmo jeito, no mesmo `arranjos[]`, com o mesmo
            `equipamento_id` — o que mudou foi ONDE se escolhe, não o dado. */}
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          O inversor é escolhido na etapa <strong>Topologia</strong>, entre os
          modelos que o motor elétrico aprovar para a configuração do projeto.
          Os inversores já gravados aparecem acima e seguem editáveis em quantidade.
        </p>

      {avisoFase && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠ {avisoFase}
        </p>
      )}

      {/* ── TOTAIS ────────────────────────────────────────────────────────── */}
      <dl className="mt-6 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
        {[
          ['Módulos na composição', `${totalModulos(atual)} un.`],
          ['Potência CC', kwp === null ? '—' : `${kwp} kWp`],
          ['Inversores', `${totalInversores(atual)} un.`],
          ['Potência CA instalada', kwCa === null ? '—' : `${kwCa} kW`],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2 px-4 py-2">
            <dt className="w-52 shrink-0 text-slate-500">{k}</dt>
            <dd className="text-slate-900">{v}</dd>
          </div>
        ))}
        {/* Sprint B: a necessidade calculada pelo Dimensionamento chega aqui, ao
            lado do que a composição de fato compra. Duas fontes canônicas
            (FV-DOM-052); a diferença é DERIVADA, nunca persistida (INV-58). */}
        <div className="flex gap-2 px-4 py-2">
          <dt className="w-52 shrink-0 text-slate-500">Necessidade (dimensionamento)</dt>
          <dd className={necessidadeKwp === null ? 'text-amber-700' : 'text-slate-900'}>
            {necessidadeKwp === null
              ? 'não calculada — etapa Dimensionamento'
              : <>
                  {necessidadeKwp} kWp
                  {kwp !== null && (
                    <span className={`ml-2 text-xs ${kwp >= necessidadeKwp ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {kwp >= necessidadeKwp
                        ? `composição atende (+${(kwp - necessidadeKwp).toFixed(2)} kWp)`
                        : `faltam ${(necessidadeKwp - kwp).toFixed(2)} kWp`}
                    </span>
                  )}
                </>}
          </dd>
        </div>
        <div className="flex gap-2 px-4 py-2">
          <dt className="w-52 shrink-0 text-slate-500">Quantidade mínima prevista</dt>
          <dd className={coerencia.diferenca === null ? 'text-amber-700'
            : coerencia.diferenca === 0 ? 'text-emerald-700' : 'text-slate-600'}>
            {coerencia.previsto === null
              ? 'não informada — etapa Dimensionamento'
              : coerencia.diferenca === 0
                ? `${coerencia.previsto} un. — composição confere`
                : `${coerencia.previsto} un. — diferença de ${coerencia.diferenca > 0 ? '+' : ''}${coerencia.diferenca}`}
            {coerencia.diferenca !== null && coerencia.diferenca !== 0 && (
              <span className="block text-xs text-slate-500">
                Diferença esperada quando o Dimensionamento rodou antes de haver
                módulo escolhido — ele usa 550 W de referência. Recalcule o
                Dimensionamento para obter a quantidade do módulo desta composição.
              </span>
            )}
          </dd>
        </div>
      </dl>

      {lacunas.length > 0 && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {lacunas.length} item(ns) sem potência declarada no catálogo: {lacunas.join('; ')}.
          A potência total não os inclui, e nenhum valor foi assumido.
        </p>
      )}

      {multiModelo(atual) && (
        <p className="mt-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          A composição tem {atual.paineis.length} modelos de módulo. As etapas de
          Dimensionamento, Topologia MPPT e Unifilar ainda trabalham com um modelo
          por vez e usarão o primeiro da lista.
        </p>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Arranjo, strings e MPPT não são definidos aqui — continuam na etapa Topologia MPPT.
      </p>

      {erroSalvar && <p role="alert" className="mt-3 text-xs text-red-600">{erroSalvar}</p>}
      {salvo && !alterado && <p className="mt-3 text-xs text-emerald-700">Composição salva.</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button" onClick={salvar} disabled={salvando || !alterado}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          {salvando ? 'Salvando…' : 'Salvar composição'}
        </button>
        {alterado && !salvando && (
          <button
            type="button" onClick={() => { setComposicao(null); setErroSalvar(null) }}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Descartar alterações
          </button>
        )}
      </div>
    </section>
  )
}
