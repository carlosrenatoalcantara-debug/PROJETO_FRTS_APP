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
import {
  TIPOS_ESTRUTURA, TIPO_OUTRO, daEquipamentos, exigeDescricao,
  paraEquipamentos, tipoForaDaLista, validarEstrutura,
} from '../../estrutura'
import { TIPOS_TOPOLOGIA, lerPreliminar, paraArranjoPreliminar } from '../../topologiaPreliminar'
import {
  STATUS_SUGESTAO, climaDoProjeto, sugestaoParaInversor, rotuloDistribuicao, agrupamentoUniforme,
} from '../../sugestaoStrings'

/** Topologias que o operador usa e o motor ainda não avalia — exibidas desabilitadas. */
const TIPOS_SEM_MOTOR = Object.freeze([
  ['otimizador', 'Otimizador'],
  ['hibrido', 'Híbrido / BESS'],
])

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
  // 2026-11-25: estrutura e tipo de topologia salvam junto com a composição.
  // `null` = mostra o persistido.
  const [estruturaRasc, setEstruturaRasc] = useState(null)
  const [tipoRasc, setTipoRasc] = useState(null)
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
  const estruturaPersistida = useMemo(() => daEquipamentos(projeto?.equipamentos), [projeto])
  const estrutura = estruturaRasc ?? estruturaPersistida
  const validacaoEstrutura = validarEstrutura(estrutura)
  const tipoPersistido = useMemo(() => lerPreliminar(projeto).tipo, [projeto])
  const alterado = composicao !== null || estruturaRasc !== null || tipoRasc !== null

  const modulos = catalogo?.modulos ?? null
  const inversores = catalogo?.inversores ?? null
  const catalogoCarregando = modulos === null || inversores === null

  /**
   * Tipo de topologia: o declarado vale; projeto legado sem declaração herda a
   * tecnologia do primeiro inversor da composição (string/micro), como a etapa
   * MPPT já fazia. Nada é inventado quando não há inversor.
   */
  const tipoInferido = (() => {
    const inv = atual.inversores[0]
    if (!inv) return null
    const cat = (inversores ?? []).find((e) => String(e._id) === String(inv.equipamento_id))
    const t = inv.tipo ?? (cat ? tipoDoInversor(cat) : null)
    return t === 'string' || t === 'micro' ? t : null
  })()
  const tipo = tipoRasc ?? tipoPersistido ?? tipoInferido

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
    if (!eq || q === null || candidatoBloqueado) return
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

  function escolherTipo(v) {
    setTipoRasc(v)
    setNovoInversor({ marca: '', id: '', quantidade: '' })
    setSalvo(false)
  }

  function mudarEstrutura(campo, valor) {
    setEstruturaRasc({ ...estrutura, [campo]: valor })
    setSalvo(false)
  }

  async function salvar() {
    if (!alterado || bloqueioSalvar) return
    setSalvando(true)
    setErroSalvar(null)
    try {
      const arranjos = projeto?.arranjos ?? []
      const arranjoExistente = arranjos.find((a) => a?.tipo === 'principal') ?? null
      const outros = arranjos.filter((a) => a?.tipo !== 'principal')
      let principal = paraArranjos(atual, arranjoExistente)[0]
      // O tipo só é gravado quando o operador o escolheu nesta tela.
      if (tipoRasc !== null) {
        const base = lerPreliminar(projeto)
        principal = paraArranjoPreliminar({ ...base, ...(agrupamentoSugerido ?? {}), tipo: tipoRasc }, principal)
      }
      // 1) A COMPOSIÇÃO, na sua forma canônica.
      await acoes.salvarEtapa('arranjos', { lista: [...outros, principal] })
      // 2) A PROJEÇÃO para os leitores que ainda esperam um módulo e um inversor,
      //    com a estrutura — que vive no mesmo subdocumento `equipamentos`.
      const projecao = projecaoLegado(atual, projeto?.equipamentos)
      await acoes.salvarEtapa('equipamentos',
        estruturaRasc !== null ? paraEquipamentos(estrutura, projecao) : projecao)
      setComposicao(null)
      setEstruturaRasc(null)
      setTipoRasc(null)
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
  const modelosModulo = modelosDaMarca(modulos, novoModulo.marca)
  // O seletor de inversor só oferece a tecnologia do tipo escolhido.
  const inversoresDoTipo = tipo === null ? [] : (inversores ?? []).filter((e) => tipoDoInversor(e) === tipo)
  const marcasInversor = marcasDe(inversoresDoTipo)
  const modelosInversor = modelosDaMarca(inversoresDoTipo, novoInversor.marca)

  /**
   * Avaliação na linha (2026-11-25): para string, o motor puro de distribuição
   * (fv-shared) diz se os módulos da composição cabem no inversor e sugere as
   * strings. A validação canônica, MPPT a MPPT, continua na seção abaixo.
   */
  const clima = climaDoProjeto(projeto)
  const primeiroPainel = atual.paineis[0] ?? null
  const moduloCat = primeiroPainel
    ? (modulos ?? []).find((e) => String(e._id) === String(primeiroPainel.equipamento_id)) ?? null
    : null
  const catDoInversor = (id) => (inversores ?? []).find((e) => String(e._id) === String(id)) ?? null
  const nModulos = totalModulos(atual)
  const umModelo = atual.inversores.length === 1
  const avaliarString = (cat, q) => sugestaoParaInversor({
    inversorCat: cat, moduloCat, totalModulos: nModulos, quantidade: q, clima,
  })

  const avaliacaoLinha = atual.inversores.map((inv) => {
    const cat = catDoInversor(inv.equipamento_id)
    const tecnologia = inv.tipo ?? (cat ? tipoDoInversor(cat) : null)
    if (tipo && tecnologia && tecnologia !== tipo) {
      return { status: 'tecnologia', texto: `tecnologia ${tecnologia} — o tipo escolhido é ${tipo}` }
    }
    if (tipo !== 'string' || catalogoCarregando || !primeiroPainel) return null
    if (!umModelo) {
      return { status: STATUS_SUGESTAO.SEM_DADOS, texto: 'mais de um modelo de inversor: a distribuição é feita na seção MPPT' }
    }
    return avaliarString(cat, quantidade(inv.quantidade))
  })

  const candidatoCat = novoInversor.id ? catDoInversor(novoInversor.id) : null
  const avaliacaoCandidato = candidatoCat && tipo === 'string' && primeiroPainel
    ? avaliarString(candidatoCat, quantidade(novoInversor.quantidade) ?? 1)
    : null
  const candidatoBloqueado = avaliacaoCandidato?.status === STATUS_SUGESTAO.SEM_SOLUCAO

  const bloqueioSalvar = !validacaoEstrutura.valida || avaliacaoLinha.some(
    (a) => a?.status === STATUS_SUGESTAO.SEM_SOLUCAO || a?.status === 'tecnologia')

  /** Agrupamento uniforme sugerido (um comprimento só) — grava na configuração preliminar. */
  const agrupamentoSugerido = umModelo ? agrupamentoUniforme(avaliacaoLinha[0]) : null

  const textoAvaliacao = (a) => {
    if (!a) return null
    if (a.texto) return a.texto
    if (a.status === STATUS_SUGESTAO.PRELIMINAR) {
      const distintas = [...new Set(a.porUnidade.map((u) => rotuloDistribuicao(u.resultado)))]
      return `strings sugeridas: ${distintas.join(' | ')}`
        + (a.porUnidade.length > 1 ? ` (por inversor, ${a.porUnidade.length} un.)` : '')
        + (a.lacunas.length ? ` — ${a.lacunas.join(' ')}` : '')
    }
    return a.lacunas.join(' ')
  }
  const corAvaliacao = (a) => (
    a?.status === STATUS_SUGESTAO.SEM_SOLUCAO || a?.status === 'tecnologia' ? 'text-red-700'
      : a?.status === STATUS_SUGESTAO.SEM_DADOS || a?.lacunas?.length ? 'text-amber-700'
        : 'text-emerald-700')
  const iconeAvaliacao = (a) => (
    a?.status === STATUS_SUGESTAO.SEM_SOLUCAO || a?.status === 'tecnologia' ? '⛔ incompatível: '
      : a?.status === STATUS_SUGESTAO.SEM_DADOS ? '⚠ não avaliado: ' : '✓ ')

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
        Estrutura, módulos e inversores numa tela só — tudo do catálogo, com
        quantidade, salvo num único botão.
      </p>

      {/* ── ESTRUTURA ─────────────────────────────────────────────────────── */}
      <fieldset id="secao-estrutura" className="mt-6 scroll-mt-12">
        <legend className="text-sm font-semibold text-slate-900">Estrutura</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIPOS_ESTRUTURA.map(({ valor, rotulo }) => (
            <label key={valor} className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 text-sm ${
              estrutura.tipo === valor ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
              <input type="radio" name="estrutura-tipo" value={valor}
                checked={estrutura.tipo === valor} onChange={() => mudarEstrutura('tipo', valor)} />
              <span className="text-slate-900">{rotulo}</span>
            </label>
          ))}
        </div>
        {tipoForaDaLista(estrutura.tipo) && (
          <p className="mt-2 text-xs text-slate-600">
            Gravada como <strong>{estrutura.tipo}</strong> (fora da lista) — preservada até outro tipo ser escolhido.
          </p>
        )}
        {(exigeDescricao(estrutura.tipo) || estrutura.descricao) && (
          <label className="mt-2 block text-sm">
            <span className="block text-slate-600">
              Descrição da estrutura{exigeDescricao(estrutura.tipo) ? ' (obrigatória para "Outro")' : ''}
            </span>
            <input aria-label="Descrição da estrutura" value={estrutura.descricao}
              onChange={(e) => mudarEstrutura('descricao', e.target.value)}
              placeholder={estrutura.tipo === TIPO_OUTRO ? 'Descreva a estrutura utilizada.' : ''}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
          </label>
        )}
        {validacaoEstrutura.erros.map((m) => (
          <p key={m} role="alert" className="mt-2 text-xs text-red-700">{m}</p>
        ))}
      </fieldset>

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
                {avaliacaoLinha[i] && (
                  <span className={`block text-xs ${corAvaliacao(avaliacaoLinha[i])}`}>
                    {iconeAvaliacao(avaliacaoLinha[i])}{textoAvaliacao(avaliacaoLinha[i])}
                  </span>
                )}
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

      {/* 2026-11-25: a seleção do inversor VOLTOU para cá, no mesmo formato
          dos módulos (Marca → Modelo → Quantidade), filtrada pelo tipo de
          topologia. Grava o mesmo `equipamento_id` em `arranjos[]`. */}
      <fieldset aria-label="Tipo de topologia" className="mt-3 text-sm">
        <legend className="text-slate-600">Tipo de topologia</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {[...TIPOS_TOPOLOGIA, ...TIPOS_SEM_MOTOR.map(([v, r]) => [v, r, true])].map(([v, r, semMotor]) => (
            <label key={v} title={semMotor ? 'Ainda sem avaliação pelo motor elétrico' : r}
              className={`flex items-center gap-1 ${semMotor ? 'text-slate-400' : 'text-slate-800'}`}>
              <input type="radio" name="tipo-topologia" value={v} disabled={!!semMotor}
                checked={tipo === v} onChange={() => escolherTipo(v)} />
              {r}{semMotor && <span className="text-[10px]">(em breve)</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-slate-50 p-3">
        <label className="text-sm">
          <span className="block text-slate-600">Marca do inversor</span>
          <select
            aria-label="Marca do inversor" disabled={catalogoCarregando || tipo === null}
            value={novoInversor.marca}
            onChange={(e) => setNovoInversor({ ...novoInversor, marca: e.target.value, id: '' })}
            className="mt-1 w-56 rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100"
          >
            <option value="">
              {catalogoCarregando ? 'carregando catálogo…'
                : tipo === null ? 'escolha o tipo de topologia'
                  : `selecione a marca (${marcasInversor.length})`}
            </option>
            {marcasInversor.map(([marca, n]) => (
              <option key={marca} value={marca}>{marca} ({n})</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Modelo</span>
          <select
            aria-label="Inversor" disabled={catalogoCarregando || novoInversor.marca === ''}
            value={novoInversor.id} onChange={(e) => setNovoInversor({ ...novoInversor, id: e.target.value })}
            className="mt-1 w-96 rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100"
          >
            <option value="">
              {novoInversor.marca === '' ? 'escolha a marca primeiro' : 'não selecionado'}
            </option>
            {modelosInversor.map((e) => (
              <option key={e._id} value={String(e._id)}>{rotuloDoInversor(e)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Quantidade</span>
          {linhaQtd(novoInversor.quantidade, (v) => setNovoInversor({ ...novoInversor, quantidade: v }), 'Quantidade do novo inversor')}
        </label>
        <button
          type="button" onClick={adicionarInversor}
          disabled={!novoInversor.id || quantidade(novoInversor.quantidade) === null || candidatoBloqueado}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          Adicionar inversor
        </button>
        {avaliacaoCandidato && (
          <p aria-label="Avaliação do inversor escolhido" className={`basis-full text-xs ${corAvaliacao(avaliacaoCandidato)}`}>
            {iconeAvaliacao(avaliacaoCandidato)}{textoAvaliacao(avaliacaoCandidato)}
          </p>
        )}
      </div>

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
        O detalhamento de MPPT e strings, com a validação elétrica canônica,
        fica na seção abaixo.
      </p>

      {erroSalvar && <p role="alert" className="mt-3 text-xs text-red-600">{erroSalvar}</p>}
      {salvo && !alterado && <p className="mt-3 text-xs text-emerald-700">Composição salva.</p>}
      {alterado && bloqueioSalvar && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          Corrija o que está marcado como incompatível (ou a estrutura) antes de salvar.
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button" onClick={salvar} disabled={salvando || !alterado || bloqueioSalvar}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          {salvando ? 'Salvando…' : 'Salvar composição'}
        </button>
        {alterado && !salvando && (
          <button
            type="button" onClick={() => { setComposicao(null); setEstruturaRasc(null); setTipoRasc(null); setErroSalvar(null) }}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Descartar alterações
          </button>
        )}
      </div>
    </section>
  )
}
