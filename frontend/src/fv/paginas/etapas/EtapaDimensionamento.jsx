import { useMemo, useState } from 'react'
import { useProjeto } from '../../providers/ProjetoProvider'
import { calcularDimensionamento } from '../../api/agregadosFvApi'

/**
 * EtapaDimensionamento — potência, geração e nº de módulos — FV-UX-020.
 *
 * Terceiro bloqueio da FV-OPS-001. Como nos dois anteriores, nada foi criado no
 * domínio: o motor `dimensionarFV` já existe e já é servido por
 * `POST /api/dimensionamento/calcular`; a gravação continua em `PUT /:id/etapa`.
 *
 * ── O que esta tela NÃO usa da resposta do motor ─────────────────────────────
 * `dimensionarFV` devolve, junto com o resultado técnico, um bloco financeiro
 * próprio — payback, VPL, TIR, economia e custo — calculado com defaults de
 * tarifa, custo por kWp, inflação e taxa que lhe são internos. A FV-DOM-015E
 * mediu esse bloco e o deixou onde estava, fora do fluxo canônico.
 *
 * Aqui ele é descartado por completo. O financeiro do projeto é o contrato V1,
 * e a única coisa que esta etapa lhe entrega é `geracao_anual_kwh`.
 *
 * ── Premissas de engenharia ──────────────────────────────────────────────────
 * HSP, perdas e margem são ENTRADAS do usuário, sem valor sugerido. O motor tem
 * defaults internos (18 % de perdas, 10 % de margem, HSP de fallback por
 * estado); enviá-los sempre explicitamente é o que impede que uma premissa não
 * decidida entre no projeto sem ninguém ter escolhido.
 *
 * ── O que continua sem fonte ─────────────────────────────────────────────────
 * `num_strings` e `num_inversores` não são produzidos por motor algum — o
 * adapter do wizard grava `num_strings: null` desde sempre. Dependem do
 * stringing, que é MPPT, e MPPT está fora desta sprint. Ficam declarados como
 * pendentes em vez de receberem um número inventado.
 */

/** Número finito ou `null`. Campo vazio nunca vira 0. */
function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const texto = (v) => (v === null || v === undefined ? '' : String(v))

/** Premissas informadas pelo usuário. Sem valor inicial — nenhuma é sugerida. */
const PREMISSAS = [
  { chave: 'irradiancia_kwh_m2_dia', rotulo: 'HSP (kWh/m²·dia)',
    ajuda: 'Horas de sol pleno do local. Sem este valor o motor usa uma média por estado.' },
  { chave: 'perdas_pct', rotulo: 'Perdas totais (%)',
    ajuda: 'Cabeamento, sujeira, temperatura, mismatch e inversor.' },
  { chave: 'margem_pct', rotulo: 'Margem de sobredimensionamento (%)' },
]

export default function EtapaDimensionamento() {
  const { projeto, carregando, erro, acoes } = useProjeto()

  const [premissas, setPremissas] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [calculando, setCalculando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState(null)
  const [salvo, setSalvo] = useState(false)

  /**
   * Entradas que vêm do que as etapas anteriores já persistiram, com a fonte de
   * cada uma. Nenhuma é editável aqui: alterá-las é voltar à etapa que as grava.
   */
  const entradas = useMemo(() => {
    const consumo = projeto?.fatura_extracao?.consumo_mensal_kwh ?? null
    const potModulo = projeto?.equipamentos?.paineis?.[0]?.potencia_w ?? null
    return [
      { chave: 'consumo_mensal_kwh', rotulo: 'Consumo (kWh/mês)', valor: consumo,
        fonte: consumo == null ? null : 'fatura_extracao.consumo_mensal_kwh',
        etapa: 'Dados técnicos' },
      { chave: 'pot_modulo_w', rotulo: 'Potência do módulo (W)', valor: potModulo,
        fonte: potModulo == null ? null : 'equipamentos.paineis[0].potencia_w',
        etapa: 'Equipamentos' },
      { chave: 'cidade', rotulo: 'Cidade', valor: projeto?.local_resolvido?.cidade ?? null,
        fonte: projeto?.local_resolvido?.cidade ? 'localizacao.cidade' : null, etapa: 'Dados técnicos' },
      { chave: 'estado', rotulo: 'UF', valor: projeto?.local_resolvido?.estado ?? null,
        fonte: projeto?.local_resolvido?.estado ? 'localizacao.estado' : null, etapa: 'Dados técnicos' },
    ]
  }, [projeto])

  const faltando = entradas.filter((e) => e.chave !== 'cidade' && e.chave !== 'estado' && e.valor == null)

  /** HSP já persistido serve de valor inicial — é leitura, não sugestão. */
  const premissasIniciais = useMemo(() => ({
    irradiancia_kwh_m2_dia: texto(projeto?.localizacao?.irradiancia_kwh_kwp_dia),
    perdas_pct: '',
    margem_pct: '',
  }), [projeto])

  const valores = premissas ?? premissasIniciais
  const premissasCompletas = PREMISSAS.every((p) => num(valores[p.chave]) !== null)

  const dim = projeto?.dimensionamento ?? null
  const persistido = [
    ['Potência', dim?.potencia_kwp, 'kWp'],
    ['Geração mensal', dim?.geracao_mensal_kwh, 'kWh'],
    ['Geração anual', dim?.geracao_anual_kwh, 'kWh'],
    ['Módulos', dim?.num_paineis, ''],
    ['Área ocupada', dim?.area_total_m2, 'm²'],
    ['Strings', dim?.num_strings, ''],
    ['Inversores', dim?.num_inversores, ''],
  ]

  function editar(chave, valor) {
    setPremissas({ ...valores, [chave]: valor })
    setResultado(null)
    setSalvo(false)
  }

  async function calcular(ev) {
    ev.preventDefault()
    setCalculando(true)
    setErroAcao(null)
    setSalvo(false)
    try {
      const corpo = {}
      for (const e of entradas) if (e.valor != null) corpo[e.chave] = e.valor
      for (const p of PREMISSAS) corpo[p.chave] = num(valores[p.chave])
      const r = await calcularDimensionamento(corpo)
      setResultado(r)
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setCalculando(false)
    }
  }

  async function salvar() {
    const r = resultado?.resultado
    if (!r) return
    setSalvando(true)
    setErroAcao(null)
    try {
      // A etapa substitui o subdocumento inteiro — parte-se do que o servidor
      // devolveu para não apagar o que este motor não produz.
      await acoes.salvarEtapa('dimensionamento', {
        ...(projeto?.dimensionamento ?? {}),
        potencia_kwp: r.potencia_kwp,
        geracao_mensal_kwh: r.geracao_mensal_kwh,
        geracao_anual_kwh: r.geracao_anual_kwh,
        num_paineis: r.qtd_modulos_estimada,
        area_total_m2: r.area_ocupacao_m2,
        metodo: 'automatico',
        calculado_em: resultado?.metadados?.calculado_em ?? null,
      })
      setResultado(null)
      setPremissas(null)
      setSalvo(true)
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>
  if (!projeto) return <p className="p-6 text-sm text-slate-500">Projeto não encontrado.</p>

  const r = resultado?.resultado ?? null
  const normalizado = resultado?.input_normalizado ?? null

  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Dimensionamento</h2>
      <p className="mt-1 text-sm text-slate-500">
        O cálculo roda no servidor, pelo motor existente. Esta tela informa as
        premissas, mostra o resultado e o grava — nenhuma fórmula vive aqui.
      </p>

      <h3 className="mt-6 text-sm font-semibold text-slate-900">Entradas das etapas anteriores</h3>
      <dl className="mt-2 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
        {entradas.map((e) => (
          <div key={e.chave} className="flex gap-2 px-4 py-2">
            <dt className="w-52 shrink-0 text-slate-500">{e.rotulo}</dt>
            <dd className="flex-1 text-slate-900">
              {e.valor ?? <span className="text-amber-700">não informado — etapa {e.etapa}</span>}
            </dd>
            <dd className="text-xs text-slate-400">{e.fonte ?? '—'}</dd>
          </div>
        ))}
      </dl>

      <form onSubmit={calcular} className="mt-6 rounded border border-slate-300 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Premissas de engenharia</h3>
        <p className="mt-1 text-xs text-slate-500">
          Nenhum valor é sugerido. Informe as três para calcular.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {PREMISSAS.map((p) => (
            <label key={p.chave} className="text-sm">
              <span className="text-slate-600">{p.rotulo}</span>
              <input
                aria-label={p.rotulo}
                type="number" min="0" step="any"
                value={valores[p.chave]}
                onChange={(e) => editar(p.chave, e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
              {p.ajuda && <span className="mt-1 block text-xs text-slate-500">{p.ajuda}</span>}
            </label>
          ))}
        </div>

        {faltando.length > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            Faltam entradas obrigatórias: {faltando.map((f) => f.rotulo).join(', ')}.
          </p>
        )}

        <button
          type="submit"
          disabled={calculando || !premissasCompletas || faltando.length > 0}
          className="mt-4 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          {calculando ? 'Calculando…' : 'Calcular dimensionamento'}
        </button>
      </form>

      {r && (
        <div className="mt-6 rounded border border-slate-300 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Resultado do motor</h3>
          <dl className="mt-2 divide-y divide-slate-200 text-sm">
            {[
              ['Potência', r.potencia_kwp, 'kWp'],
              ['Geração mensal', r.geracao_mensal_kwh, 'kWh'],
              ['Geração anual', r.geracao_anual_kwh, 'kWh'],
              ['Módulos', r.qtd_modulos_estimada, ''],
              ['Área ocupada', r.area_ocupacao_m2, 'm²'],
            ].map(([k, v, u]) => (
              <div key={k} className="flex gap-2 py-1.5">
                <dt className="w-52 shrink-0 text-slate-500">{k}</dt>
                <dd className="text-slate-900">{v == null ? '—' : `${v} ${u}`.trim()}</dd>
              </div>
            ))}
          </dl>

          {normalizado && (
            <p className="mt-3 text-xs text-slate-500">
              Calculado com HSP {normalizado.irradiancia_kwh_m2_dia}, perdas{' '}
              {normalizado.perdas_pct}%, margem {normalizado.margem_pct}% e módulo de{' '}
              {normalizado.pot_modulo_w} W. Motor v{resultado?.metadados?.versao_motor}.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Indicadores financeiros deste motor não são exibidos nem gravados: o
            financeiro do projeto é o contrato V1.
          </p>

          <button
            type="button" onClick={salvar} disabled={salvando}
            className="mt-4 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
          >
            {salvando ? 'Salvando…' : 'Salvar dimensionamento'}
          </button>
        </div>
      )}

      {erroAcao && <p role="alert" className="mt-4 text-sm text-red-600">{erroAcao}</p>}
      {salvo && <p className="mt-4 text-sm text-emerald-700">Dimensionamento salvo.</p>}

      <h3 className="mt-8 text-sm font-semibold text-slate-900">Persistido no projeto</h3>
      <dl className="mt-2 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
        {persistido.map(([k, v, u]) => (
          <div key={k} className="flex gap-2 px-4 py-2">
            <dt className="w-52 shrink-0 text-slate-500">{k}</dt>
            <dd className="text-slate-900">{v == null ? '—' : `${v} ${u}`.trim()}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-slate-500">
        Strings e inversores continuam pendentes: dependem do arranjo por MPPT,
        que nenhuma etapa define ainda.
      </p>
    </section>
  )
}
