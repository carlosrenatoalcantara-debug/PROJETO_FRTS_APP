import { useEffect, useMemo, useState } from 'react'
import { useProjeto } from '../../providers/ProjetoProvider'
import { listarCatalogo, validarCompatibilidadeEletrica } from '../../api/agregadosFvApi'
import { calcularTemperaturas } from '@fortesolar/fv-shared/engenharia/normativa'
import {
  eletricoDoModulo, eletricoDoInversor, nMpptsDoInversor, lacunasEletricas,
} from '../../catalogo'
import {
  topologiaVazia, mpptVazio, inteiro, totalDoMppt, totalDistribuido, naoDistribuidos,
  mpptUtilizado, paraArranjoPersistido, daArranjoPersistido, arranjoParaValidacao,
  topologiaDesigual,
} from '../../topologia'

/**
 * EtapaMppt — topologia do arranjo — FV-UX-026.
 *
 * Última lacuna do unifilar, e a única etapa técnica que NÃO calcula nada: aqui
 * o projetista AUTORA a topologia (Modelo A, FV-DOM-023/024). O sistema valida.
 *
 * ── Por que não há distribuição automática ───────────────────────────────────
 * MPPT desigual, entrada parcialmente ocupada e strings de comprimentos
 * diferentes por sombreamento ou geometria de telhado não são deriváveis sem
 * conhecer o telhado. A FV-UX-021 mediu o que acontece quando se tenta:
 * `/api/dimensionamento/strings` devolve uma configuração uniforme e três
 * módulos órfãos que não pertencem a string alguma.
 *
 * ── De onde vem cada número ──────────────────────────────────────────────────
 * Módulo e inversor: catálogo (FV-UX-019). Quantidade total: dimensionamento
 * (FV-UX-020). Voc, Vmpp, Isc e diagnósticos: validador canônico no servidor.
 * Deste lado só existe soma de módulos digitados.
 */

/** Só estes diagnósticos são por MPPT. Oversizing é do inversor inteiro. */
const CODIGOS_POR_MPPT = new Set([
  'VOC_EXCEDIDA_CRITICA', 'VOC_PROXIMO_LIMITE', 'MPPT_STRING_LONGA',
  'MPPT_STRING_CURTA', 'MPPT_PROXIMO_LIMITE', 'CORRENTE_ISC_EXCEDIDA',
  'CORRENTE_PROXIMA_LIMITE', 'INPUT_INVALIDO', 'CLIMA_FALLBACK_APLICADO',
])

const bloqueante = (d) => d?.severidade === 'critico' || d?.nivel === 'critico'

export default function EtapaMppt() {
  const { projeto, carregando, erro, acoes } = useProjeto()

  const [catalogo, setCatalogo] = useState(null)
  const [erroCatalogo, setErroCatalogo] = useState(null)
  const [topologia, setTopologia] = useState(null)
  const [resultados, setResultados] = useState(null)
  const [validando, setValidando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState(null)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([listarCatalogo('modulo'), listarCatalogo('inversor')])
      .then(([m, i]) => vivo && setCatalogo({ modulos: m?.equipamentos ?? [], inversores: i?.equipamentos ?? [] }))
      .catch((e) => vivo && setErroCatalogo(e.message))
    return () => { vivo = false }
  }, [])

  const equip = projeto?.equipamentos ?? {}
  const painelSel = equip.paineis?.[0] ?? null
  const inversorSel = equip.inversor ?? null

  const moduloCat = useMemo(() => (catalogo?.modulos ?? [])
    .find((e) => String(e._id) === String(painelSel?.equipamento_id ?? painelSel?.id)) ?? null,
  [catalogo, painelSel])
  const inversorCat = useMemo(() => (catalogo?.inversores ?? [])
    .find((e) => String(e._id) === String(inversorSel?.equipamento_id ?? inversorSel?.id)) ?? null,
  [catalogo, inversorSel])

  const eletricoMod = useMemo(() => (moduloCat ? eletricoDoModulo(moduloCat) : null), [moduloCat])
  const eletricoInv = useMemo(() => (inversorCat ? eletricoDoInversor(inversorCat) : null), [inversorCat])
  const nMppts = inversorCat ? nMpptsDoInversor(inversorCat) : null
  const lacunas = useMemo(
    () => (eletricoMod && eletricoInv ? lacunasEletricas(eletricoMod, eletricoInv) : []),
    [eletricoMod, eletricoInv])

  const totalModulos = inteiro(projeto?.dimensionamento?.num_paineis ?? painelSel?.quantidade)

  /**
   * Clima de projeto — A2 (FV-UX-028).
   *
   * A auditoria FV-UX-027 encontrou a etapa Dados Técnicos prometendo que a UF
   * "decide Tmin/Tmax", enquanto esta tela mandava dois `null` e o motor caía
   * no fallback nacional de 10/40 °C. A UF informada não tinha efeito algum.
   *
   * Precedência, sem tabela nova e sem fórmula copiada:
   *   1. Tmin/Tmax persistidos em `localizacao` — o que o projeto mediu;
   *   2. `calcularTemperaturas(uf)` — a tabela canônica de `fv-shared`;
   *   3. nada — o motor aplica o fallback dele e DECLARA o warning.
   */
  const clima = useMemo(() => {
    const loc = projeto?.localizacao ?? {}
    const tmin = loc.temperatura_min_historica_c ?? null
    const tmax = loc.temperatura_max_historica_c ?? null
    const uf = projeto?.local_resolvido?.estado ?? loc.estado ?? null
    if (tmin !== null && tmax !== null) {
      return { temperatura_min_historica_c: tmin, temperatura_max_historica_c: tmax, uf, fonte: 'localizacao' }
    }
    if (uf) {
      const t = calcularTemperaturas(uf)
      return {
        temperatura_min_historica_c: t.tmin, temperatura_max_historica_c: t.tmax,
        uf, fonte: 'uf',
      }
    }
    return { temperatura_min_historica_c: tmin, temperatura_max_historica_c: tmax, uf, fonte: null }
  }, [projeto])

  // Topologia persistida; na ausência dela, MPPTs VAZIOS — nada é sugerido.
  const persistida = useMemo(
    () => daArranjoPersistido(projeto?.engenharia_eletrica?.arranjo), [projeto])
  useEffect(() => {
    if (topologia !== null) return
    if (persistida) setTopologia(persistida)
    else if (nMppts !== null) setTopologia(topologiaVazia(nMppts))
  }, [persistida, nMppts, topologia])

  const distribuido = totalDistribuido(topologia)
  const restantes = naoDistribuidos(topologia, totalModulos)
  const desigual = topologiaDesigual(topologia)

  function mutar(fn) {
    setTopologia((prev) => {
      const copia = JSON.parse(JSON.stringify(prev ?? []))
      fn(copia)
      return copia
    })
    setResultados(null)
    setSalvo(false)
  }

  const addMppt = () => mutar((t) => t.push(mpptVazio()))
  const removerMppt = (i) => mutar((t) => t.splice(i, 1))
  const addEntrada = (i) => mutar((t) => t[i].entradas.push({ strings: [] }))
  const removerEntrada = (i, ei) => mutar((t) => t[i].entradas.splice(ei, 1))
  const addString = (i, ei) => mutar((t) => t[i].entradas[ei].strings.push({ modulos: '' }))
  const removerString = (i, ei, si) => mutar((t) => t[i].entradas[ei].strings.splice(si, 1))
  const setModulos = (i, ei, si, v) => mutar((t) => { t[i].entradas[ei].strings[si].modulos = v })

  async function validar() {
    if (!eletricoMod || !eletricoInv) return
    setValidando(true)
    setErroAcao(null)
    try {
      // Uma chamada por MPPT: Voc, Vmpp e Isc são grandezas por MPPT.
      const saidas = await Promise.all((topologia ?? []).map(async (m) => {
        const arranjo = arranjoParaValidacao(m)
        if (!arranjo) return null
        return validarCompatibilidadeEletrica({
          dados_eletricos_modulo: eletricoMod,
          dados_eletricos_inversor: eletricoInv,
          arranjo_proposto: arranjo,
          dados_climaticos_regiao: clima,
        })
      }))
      setResultados(saidas)
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setValidando(false)
    }
  }

  const diagnosticos = (r) => [...(r?.erros ?? []), ...(r?.warnings ?? [])]
    .filter((d) => CODIGOS_POR_MPPT.has(d.codigo))
  const temBloqueio = (resultados ?? []).some((r) => diagnosticos(r).some(bloqueante))
  const validado = Array.isArray(resultados) && resultados.some(Boolean)

  async function salvar() {
    if (!validado || temBloqueio) return
    setSalvando(true)
    setErroAcao(null)
    try {
      const primeiro = (resultados ?? []).find(Boolean)
      await acoes.salvarEtapa('engenharia_eletrica', {
        arranjo: paraArranjoPersistido(topologia, nMppts),
        clima_utilizado: {
          cidade: projeto?.local_resolvido?.cidade ?? null,
          uf: clima.uf,
          temperatura_min_historica_c: primeiro?.clima_utilizado?.temperatura_min_historica_c ?? null,
          temperatura_max_historica_c: primeiro?.clima_utilizado?.temperatura_max_historica_c ?? null,
          // A2: registra DE ONDE vieram as temperaturas — `localizacao` (medidas)
          // ou `uf` (tabela canônica). Sem isso, o histórico não distingue as duas.
          fonte: primeiro?.clima_utilizado?.fonte ?? clima.fonte ?? null,
          usou_fallback: primeiro?.clima_utilizado?.usou_fallback ?? null,
        },
        compatibilidade: {
          versao_motor: 'canonico-fv-dom-025',
          compativel: !temBloqueio,
          diagnosticos: (resultados ?? []).flatMap((r, i) =>
            diagnosticos(r).map((d) => ({ ...d, mppt: i + 1 }))),
          calculos_principais: primeiro?.calculos ?? null,
          analisado_em: new Date().toISOString(),
        },
      })
      setSalvo(true)
      setResultados(null)
      setTopologia(null)
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>
  if (!projeto) return <p className="p-6 text-sm text-slate-500">Projeto não encontrado.</p>

  const faltaEquip = !painelSel || !inversorSel

  return (
    <section className="mx-auto max-w-3xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Topologia MPPT</h2>
      <p className="mt-1 text-sm text-slate-500">
        A distribuição das strings é sua. O sistema valida contra os limites do
        inversor — não decide o arranjo.
      </p>

      {erroCatalogo && <p role="alert" className="mt-4 text-sm text-red-600">Catálogo indisponível: {erroCatalogo}</p>}

      <dl className="mt-6 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
        {[
          ['Módulo', painelSel ? `${painelSel.marca ?? '—'} ${painelSel.modelo ?? ''}` : null, 'Equipamentos'],
          ['Inversor', inversorSel?.modelo ? `${inversorSel.marca ?? '—'} ${inversorSel.modelo}` : null, 'Equipamentos'],
          ['Módulos no projeto', totalModulos, 'Dimensionamento'],
          ['MPPTs do inversor', nMppts, 'Catálogo'],
          ['Tmin / Tmax de projeto',
            clima.temperatura_min_historica_c === null ? null
              : `${clima.temperatura_min_historica_c} / ${clima.temperatura_max_historica_c} °C` +
                (clima.fonte === 'uf' ? ` — tabela ${clima.uf}` : ' — medidos no local'),
            'Dados técnicos'],
        ].map(([k, v, origem]) => (
          <div key={k} className="flex gap-2 px-4 py-2">
            <dt className="w-48 shrink-0 text-slate-500">{k}</dt>
            <dd className="flex-1 text-slate-900">
              {v ?? <span className="text-amber-700">não informado — etapa {origem}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {lacunas.length > 0 && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          O catálogo não declara {lacunas.length} dado(s) elétrico(s) — {lacunas.join(', ')}.
          A validação não pode ser feita sem eles, e nenhum valor será assumido.
        </p>
      )}

      {faltaEquip ? (
        <p className="mt-6 text-sm text-amber-700">
          Selecione módulo e inversor na etapa Equipamentos antes de montar a topologia.
        </p>
      ) : (
        <>
          <div className="mt-6 space-y-4">
            {(topologia ?? []).map((mppt, i) => {
              const r = resultados?.[i] ?? null
              const diags = diagnosticos(r)
              const erroMppt = diags.some(bloqueante)
              return (
                <div key={i} className={`rounded border-2 bg-white p-4 ${
                  erroMppt ? 'border-red-300' : mpptUtilizado(mppt) ? 'border-slate-300' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    {/* A1: o separador não é decoração. Sem ele, "MPPT 1" seguido
                        de "12 módulo(s)" é lido como "MPPT 112" — só a margem CSS
                        separava os dois números. */}
                    <h3 className="text-sm font-semibold text-slate-900">
                      MPPT {i + 1}
                      <span className="ml-2 font-normal text-slate-500">
                        {' · '}{totalDoMppt(mppt)} módulo(s)
                        {!mpptUtilizado(mppt) && ' — livre'}
                      </span>
                    </h3>
                    <button type="button" onClick={() => removerMppt(i)}
                      className="text-xs text-slate-500 hover:text-red-600">remover MPPT</button>
                  </div>

                  {(mppt.entradas ?? []).map((entrada, ei) => (
                    <div key={ei} className="mt-3 rounded bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">Entrada {ei + 1}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => addString(i, ei)}
                            className="text-xs text-slate-700 underline">+ string</button>
                          <button type="button" onClick={() => removerEntrada(i, ei)}
                            className="text-xs text-slate-500 hover:text-red-600">remover entrada</button>
                        </div>
                      </div>
                      {(entrada.strings ?? []).length === 0 && (
                        <p className="mt-2 text-xs text-slate-400">nenhuma string nesta entrada</p>
                      )}
                      {(entrada.strings ?? []).map((s, si) => (
                        <div key={si} className="mt-2 flex items-center gap-2">
                          <label className="text-xs text-slate-600">
                            String {si + 1} — módulos
                            <input
                              aria-label={`MPPT ${i + 1} entrada ${ei + 1} string ${si + 1} módulos`}
                              type="number" min="0" step="1" value={s.modulos}
                              onChange={(ev) => setModulos(i, ei, si, ev.target.value)}
                              className="ml-2 w-24 rounded border border-slate-300 px-2 py-1"
                            />
                          </label>
                          <button type="button" onClick={() => removerString(i, ei, si)}
                            className="text-xs text-slate-500 hover:text-red-600">remover</button>
                        </div>
                      ))}
                    </div>
                  ))}

                  <button type="button" onClick={() => addEntrada(i)}
                    className="mt-3 text-xs text-slate-700 underline">+ entrada física</button>

                  {diags.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {diags.map((d, k) => (
                        <li key={k} className={`text-xs ${bloqueante(d) ? 'text-red-700' : 'text-amber-700'}`}>
                          {bloqueante(d) ? '⛔' : '⚠'} {d.mensagem}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>

          <button type="button" onClick={addMppt}
            className="mt-4 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            + MPPT
          </button>

          <dl className="mt-6 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
            <div className="flex gap-2 px-4 py-2">
              <dt className="w-48 shrink-0 text-slate-500">Total distribuído</dt>
              <dd className="text-slate-900">{distribuido} módulo(s)</dd>
            </div>
            <div className="flex gap-2 px-4 py-2">
              <dt className="w-48 shrink-0 text-slate-500">Não distribuídos</dt>
              <dd className={restantes === null ? 'text-amber-700' : restantes === 0 ? 'text-emerald-700' : 'text-amber-700'}>
                {restantes === null
                  ? 'quantidade total não informada — etapa Dimensionamento'
                  : `${restantes} módulo(s)`}
              </dd>
            </div>
          </dl>

          {desigual && (
            <p className="mt-3 text-xs text-slate-500">
              MPPTs com configurações diferentes. Cada um é validado por si; o
              oversizing CC/CA do inversor inteiro não é avaliado pelo validador
              canônico nesse caso e permanece pendente.
            </p>
          )}

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button" onClick={validar}
              disabled={validando || lacunas.length > 0 || distribuido === 0}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
            >
              {validando ? 'Validando…' : 'Validar arranjo'}
            </button>
            <button
              type="button" onClick={salvar}
              disabled={salvando || !validado || temBloqueio}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
            >
              {salvando ? 'Salvando…' : 'Salvar topologia'}
            </button>
            {temBloqueio && (
              <span className="text-xs text-red-700">
                Corrija os erros elétricos antes de salvar.
              </span>
            )}
          </div>
        </>
      )}

      {erroAcao && <p role="alert" className="mt-4 text-sm text-red-600">{erroAcao}</p>}
      {salvo && <p className="mt-4 text-sm text-emerald-700">Topologia salva.</p>}
    </section>
  )
}
