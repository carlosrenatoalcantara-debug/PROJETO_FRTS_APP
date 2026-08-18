import { useMemo, useState } from 'react'
import { useProjeto } from '../../providers/ProjetoProvider'

/**
 * EtapaProjeto — identificação + DADOS TÉCNICOS do projeto — FV-UX-018.
 *
 * ── Por que esta tela passou a gravar ────────────────────────────────────────
 * A FV-OPS-001 mediu o fluxo inteiro pela API canônica e encontrou um único
 * ponto de fuga: para informar consumo, ligação, tensão, concessionária e UF o
 * usuário precisava sair da nova UX e abrir o wizard legado. Não faltava
 * domínio nem endpoint — faltava tela.
 *
 * ── O que ela usa ────────────────────────────────────────────────────────────
 * `PUT /api/projetos-fv/:id/etapa`, que já existia, com duas etapas da lista
 * fechada do servidor:
 *
 *   `fatura`      → fatura_extracao.{concessionaria, tipo_ligacao, tensao_v,
 *                   consumo_mensal_kwh, valor_kwh}   — merge por campo
 *   `localizacao` → localizacao.estado (a UF)        — SUBSTITUI o subdocumento
 *
 * Nenhum campo novo, nenhum agregado novo, nenhuma rota nova.
 *
 * ── Substituição vs. merge ───────────────────────────────────────────────────
 * O handler de `fatura` grava por dot-notation, campo a campo. O de
 * `localizacao` faz `$set.localizacao = dados` — objeto inteiro. Por isso a UF
 * é enviada sobre uma CÓPIA do que o servidor devolveu: mandar só `{estado}`
 * apagaria coordenadas, geocodificação e a fundação climática (Tmin/Tmax), que
 * é exatamente o que decide a Voc_max das strings.
 *
 * ── Ausência não é zero ──────────────────────────────────────────────────────
 * O estado do formulário é sempre string. Campo em branco vira `null` (o
 * servidor grava ausência); `0` digitado chega como zero. Nenhum valor é
 * sugerido, calculado ou completado aqui — a tela coleta e exibe, nada mais.
 */

/** Valores que o schema declara para o tipo de ligação. Lista fechada. */
const LIGACOES = ['Monofásico', 'Bifásico', 'Trifásico']

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]

/**
 * Campos técnicos, com a etapa do servidor que grava cada um.
 * `tipo: 'numero'` só descreve o input — nenhuma conversão de unidade acontece.
 */
const CAMPOS = [
  { chave: 'consumo_mensal_kwh', etapa: 'fatura', rotulo: 'Consumo (kWh/mês)', tipo: 'numero' },
  { chave: 'valor_kwh', etapa: 'fatura', rotulo: 'Tarifa da fatura (R$/kWh)', tipo: 'numero',
    ajuda: 'Tarifa lida na fatura. A tarifa usada no cálculo financeiro é a premissa da Cotação.' },
  { chave: 'tipo_ligacao', etapa: 'fatura', rotulo: 'Tipo de ligação', tipo: 'opcoes', opcoes: LIGACOES },
  { chave: 'tensao_v', etapa: 'fatura', rotulo: 'Tensão (V)', tipo: 'numero' },
  { chave: 'concessionaria', etapa: 'fatura', rotulo: 'Concessionária', tipo: 'texto' },
  { chave: 'estado', etapa: 'localizacao', rotulo: 'UF', tipo: 'opcoes', opcoes: UFS,
    ajuda: 'Decide Tmin/Tmax de projeto — entra no dimensionamento elétrico das strings.' },
]

/** Documento → texto do input. `null`/ausente vira '', e `0` continua "0". */
const texto = (v) => (v === null || v === undefined ? '' : String(v))

/** Valores persistidos, na forma que o formulário edita. */
function persistidos(projeto) {
  const fatura = projeto?.fatura_extracao ?? {}
  return {
    consumo_mensal_kwh: texto(fatura.consumo_mensal_kwh),
    valor_kwh: texto(fatura.valor_kwh),
    tipo_ligacao: texto(fatura.tipo_ligacao),
    tensao_v: texto(fatura.tensao_v),
    concessionaria: texto(fatura.concessionaria),
    estado: texto(projeto?.localizacao?.estado),
  }
}

/**
 * Texto do input → valor a enviar.
 * Vazio é AUSÊNCIA (`null`), não zero. Número inválido também é ausência: o
 * campo fica vazio na próxima leitura em vez de gravar NaN.
 */
function paraEnvio(campo, valor) {
  const s = String(valor ?? '').trim()
  if (s === '') return null
  if (campo.tipo !== 'numero') return s
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export default function EtapaProjeto() {
  const { projeto, carregando, erro, acoes } = useProjeto()

  const original = useMemo(() => persistidos(projeto), [projeto])
  const [rascunho, setRascunho] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)
  const [salvo, setSalvo] = useState(false)

  const valores = rascunho ?? original
  const alterados = CAMPOS.filter((c) => valores[c.chave] !== original[c.chave])

  function editar(chave, valor) {
    setRascunho({ ...valores, [chave]: valor })
    setSalvo(false)
  }

  async function salvar(ev) {
    ev.preventDefault()
    if (alterados.length === 0) return
    setSalvando(true)
    setErroSalvar(null)
    try {
      // Só os campos alterados, agrupados pela etapa que os grava.
      const dadosFatura = {}
      for (const c of alterados.filter((c) => c.etapa === 'fatura')) {
        dadosFatura[c.chave] = paraEnvio(c, valores[c.chave])
      }
      if (Object.keys(dadosFatura).length > 0) {
        await acoes.salvarEtapa('fatura', dadosFatura)
      }

      const ufAlterada = alterados.some((c) => c.etapa === 'localizacao')
      if (ufAlterada) {
        // `localizacao` é substituída inteira pelo servidor — vai sobre a cópia
        // do que ele devolveu, não sobre um objeto montado do zero.
        await acoes.salvarEtapa('localizacao', {
          ...(projeto?.localizacao ?? {}),
          estado: paraEnvio({ tipo: 'texto' }, valores.estado),
        })
      }

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

  const local = projeto.local_resolvido ?? {}
  const identificacao = [
    ['Nome', projeto.nome],
    ['Cliente', projeto.clienteId?.nome ?? '—'],
    ['Cidade / UF', [local.cidade, local.estado].filter(Boolean).join(' / ') || '—'],
    ['Tipo', projeto.tipo_projeto ?? '—'],
    ['Instalação (topologia)', projeto.instalacao_ref ? 'vinculada' : 'não vinculada'],
  ]

  // Projetos importados do SolarMarket têm `distribuidora` na raiz, e o adapter
  // do unifilar dá precedência a ela. Editar a concessionária da fatura nesses
  // projetos não muda o diagrama — a tela avisa em vez de fingir que mudou.
  const distribuidoraRaiz = projeto.distribuidora ?? null

  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Projeto</h2>
      <dl className="mt-4 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
        {identificacao.map(([k, v]) => (
          <div key={k} className="flex gap-2 px-4 py-2">
            <dt className="w-48 shrink-0 text-slate-500">{k}</dt>
            <dd className="text-slate-900">{v || '—'}</dd>
          </div>
        ))}
      </dl>

      <form onSubmit={salvar} className="mt-8 rounded border border-slate-300 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Dados técnicos</h3>
        <p className="mt-1 text-xs text-slate-500">
          Campo em branco significa não informado — nenhum valor é assumido.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {CAMPOS.map((campo) => (
            <label key={campo.chave} className="text-sm">
              <span className="text-slate-600">{campo.rotulo}</span>
              {campo.tipo === 'opcoes' ? (
                <select
                  aria-label={campo.rotulo}
                  value={valores[campo.chave]}
                  onChange={(e) => editar(campo.chave, e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                >
                  <option value="">não informado</option>
                  {campo.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  aria-label={campo.rotulo}
                  type={campo.tipo === 'numero' ? 'number' : 'text'}
                  {...(campo.tipo === 'numero' ? { min: '0', step: 'any' } : {})}
                  value={valores[campo.chave]}
                  onChange={(e) => editar(campo.chave, e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                />
              )}
              {campo.ajuda && (
                <span className="mt-1 block text-xs text-slate-500">{campo.ajuda}</span>
              )}
            </label>
          ))}
        </div>

        {distribuidoraRaiz && (
          <p className="mt-3 text-xs text-amber-700">
            Este projeto tem a distribuidora “{distribuidoraRaiz}” gravada na importação,
            e ela tem precedência sobre a concessionária da fatura no unifilar.
          </p>
        )}

        {erroSalvar && <p role="alert" className="mt-3 text-xs text-red-600">{erroSalvar}</p>}
        {salvo && alterados.length === 0 && (
          <p className="mt-3 text-xs text-emerald-700">Dados técnicos salvos.</p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={salvando || alterados.length === 0}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
          >
            {salvando ? 'Salvando…' : 'Salvar dados técnicos'}
          </button>
          {alterados.length > 0 && !salvando && (
            <button
              type="button"
              onClick={() => { setRascunho(null); setErroSalvar(null) }}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Descartar alterações
            </button>
          )}
          {alterados.length > 0 && (
            <span className="text-xs text-slate-500">
              {alterados.length} campo(s) alterado(s)
            </span>
          )}
        </div>
      </form>
    </section>
  )
}
