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
  const [novoModulo, setNovoModulo] = useState({ id: '', quantidade: '' })
  const [novoInversor, setNovoInversor] = useState({ id: '', quantidade: '' })

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
    setNovoModulo({ id: '', quantidade: '' })
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
    setNovoInversor({ id: '', quantidade: '' })
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
          <span className="block text-slate-600">Módulo do catálogo</span>
          <select
            aria-label="Módulo" disabled={catalogoCarregando}
            value={novoModulo.id} onChange={(e) => setNovoModulo({ ...novoModulo, id: e.target.value })}
            className="mt-1 w-96 rounded border border-slate-300 px-2 py-1"
          >
            <option value="">{catalogoCarregando ? 'carregando catálogo…' : 'não selecionado'}</option>
            {(modulos ?? []).map((e) => (
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

      <div className="mt-3 flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-slate-50 p-3">
        <label className="text-sm">
          <span className="block text-slate-600">Inversor do catálogo</span>
          <select
            aria-label="Inversor" disabled={catalogoCarregando}
            value={novoInversor.id} onChange={(e) => setNovoInversor({ ...novoInversor, id: e.target.value })}
            className="mt-1 w-96 rounded border border-slate-300 px-2 py-1"
          >
            <option value="">{catalogoCarregando ? 'carregando catálogo…' : 'não selecionado'}</option>
            {porTecnologia.map(([chave, rotulo, lista]) => (
              <optgroup key={chave} label={`${rotulo} (${lista.length})`}>
                {lista.map((e) => (
                  <option key={e._id} value={String(e._id)}>{rotuloDoInversor(e)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Quantidade</span>
          {linhaQtd(novoInversor.quantidade, (v) => setNovoInversor({ ...novoInversor, quantidade: v }), 'Quantidade do novo inversor')}
        </label>
        <button
          type="button" onClick={adicionarInversor}
          disabled={!novoInversor.id || quantidade(novoInversor.quantidade) === null}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          Adicionar inversor
        </button>
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
        <div className="flex gap-2 px-4 py-2">
          <dt className="w-52 shrink-0 text-slate-500">Previsto no dimensionamento</dt>
          <dd className={coerencia.diferenca === null ? 'text-amber-700'
            : coerencia.diferenca === 0 ? 'text-emerald-700' : 'text-amber-700'}>
            {coerencia.previsto === null
              ? 'não informado — etapa Dimensionamento'
              : coerencia.diferenca === 0
                ? `${coerencia.previsto} un. — composição confere`
                : `${coerencia.previsto} un. — diferença de ${coerencia.diferenca > 0 ? '+' : ''}${coerencia.diferenca}`}
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
