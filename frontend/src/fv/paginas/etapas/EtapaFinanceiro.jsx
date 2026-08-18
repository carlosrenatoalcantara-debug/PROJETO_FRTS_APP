import { useState } from 'react'
import { useFinanceiro } from '../../providers/FinanceiroProvider'
import BotaoAcao from '../../componentes/BotaoAcao'

/** Rótulos das lacunas que o servidor nomeia. */
const CAMPO = {
  investimento_r: 'Investimento (orçamento aprovado)',
  geracao_anual_kwh: 'Geração anual',
  tarifa_kwh: 'Tarifa de energia',
  inflacao_energia_aa_pct: 'Inflação energética',
  reajuste_tarifa_aa_pct: 'Reajuste tarifário',
  potencia_wp: 'Potência',
  consumo_anual_kwh: 'Consumo anual',
}

/** Formatação — apresentação apenas. Ausente é "—"; zero é zero. */
const moeda = (v) => (v == null ? '—'
  : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }))
const numero = (v, sufixo = '') => (v == null ? '—' : `${v}${sufixo}`)

function Indicador({ titulo, valor, sub, destaque }) {
  return (
    <div className={`rounded border p-4 ${destaque ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-1 text-xl font-semibold ${valor === '—' ? 'text-slate-400' : 'text-slate-900'}`}>{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

/**
 * EtapaFinanceiro — FV-UX-017.
 *
 * Cliente do contrato financeiro V1. Esta tela **não calcula nada**: payback,
 * TIR, VPL, fluxo de caixa, economia, inflação, degradação e TMA chegam prontos
 * de `POST /:id/financeiro/calcular`.
 *
 * Três comportamentos que a tela precisa acertar, e por quê:
 *
 *  • **Lacunas** — quando uma premissa obrigatória não veio do projeto, o
 *    indicador aparece como "—" E a lacuna é nomeada. A alternativa histórica
 *    era preencher com um número plausível, que foi o defeito da FV-DOM-011B.
 *  • **TIR** — só é exibida quando `convergiu`. Um valor que saturou no teto da
 *    busca não é resultado, e o servidor diz isso em `motivo`.
 *  • **Estado atual** — o contrato calcula sobre os dados de HOJE. Não existe
 *    resultado histórico neste endpoint, e a tela declara isso em vez de
 *    sugerir que o número está congelado.
 */
export default function EtapaFinanceiro() {
  const {
    payback, paybackDescontado, vpl, tir, economia, fluxoCaixa,
    premissas, entradas, proveniencia, lacunas, regulatorio,
    contratoVersao, premissasVersao, calculadoEm,
    carregando, erro, calcular, contrato,
  } = useFinanceiro()

  const [detalhes, setDetalhes] = useState(false)
  const [verFluxo, setVerFluxo] = useState(false)

  if (carregando && !contrato) {
    return <p className="p-6 text-sm text-slate-500">Calculando…</p>
  }

  return (
    <section className="mx-auto max-w-5xl p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Financeiro</h2>
          <p className="text-sm text-slate-500">
            Contrato financeiro canônico — calculado sobre os dados atuais do projeto.
          </p>
        </div>
        <BotaoAcao onAcao={calcular}>Recalcular</BotaoAcao>
      </header>

      {erro && (
        <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      {/* ── Lacunas ─────────────────────────────────────────────────────────── */}
      {lacunas.length > 0 && (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">
            {lacunas.length} dado(s) ausente(s) no projeto
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Os indicadores que dependem deles aparecem como “—”. Nenhum valor foi assumido.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {lacunas.map((c) => (
              <li key={c} className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                {CAMPO[c] ?? c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Indicadores ─────────────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          destaque
          titulo="Payback"
          valor={numero(payback?.anos, ' anos')}
          sub={payback?.anos_inteiro == null
            ? (payback?.dentro_horizonte === false ? 'não se paga no horizonte' : null)
            : `${payback.anos_inteiro}º ano · convenção ${payback.convencao}`}
        />
        <Indicador
          titulo="Payback descontado"
          valor={numero(paybackDescontado?.anos, ' anos')}
          sub={vpl?.taxa_aa_pct == null ? null : `à TMA de ${vpl.taxa_aa_pct}% a.a.`}
        />
        <Indicador
          titulo="VPL"
          valor={moeda(vpl?.valor_r)}
          sub={vpl?.taxa_aa_pct == null ? null : `TMA ${vpl.taxa_aa_pct}% a.a. nominal`}
        />
        <Indicador
          titulo="TIR"
          // Só é resultado quando convergiu — o servidor decide, não a tela.
          valor={tir?.convergiu ? numero(tir.valor_aa_pct, '% a.a.') : '—'}
          sub={tir?.convergiu === false ? `não convergiu: ${tir.motivo}` : null}
        />
      </div>

      {economia && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Indicador titulo="Economia ano 1" valor={moeda(economia.anual_1ano_r)} />
          <Indicador
            titulo={`Economia em ${premissas?.horizonte_anos ?? '—'} anos`}
            valor={moeda(economia.horizonte_r)}
          />
          <Indicador titulo="ROI" valor={numero(economia.roi_pct, '%')} />
        </div>
      )}

      {/* ── Estado atual, não congelado ─────────────────────────────────────── */}
      <p className="mt-4 text-xs text-slate-500">
        Resultado do <strong>estado atual</strong> do projeto. Este endpoint não devolve
        valores congelados — a baseline contratual é outro fato, exibido na etapa Baseline.
      </p>

      {/* ── Premissas e versões ─────────────────────────────────────────────── */}
      {premissas && (
        <div className="mt-6 rounded border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Premissas usadas</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ['Taxa de desconto (TMA)', premissas.taxa_desconto_aa_pct == null ? '—'
                : `${premissas.taxa_desconto_aa_pct}% a.a. ${premissas.natureza_taxa ?? ''}`.trim()],
              ['Inflação energética', premissas.inflacao_energia_aa_pct == null
                ? 'não informada' : `${premissas.inflacao_energia_aa_pct}% a.a.`],
              ['Reajuste tarifário', premissas.reajuste_tarifa_aa_pct == null
                ? 'não informado' : `${premissas.reajuste_tarifa_aa_pct}% a.a.`],
              ['Degradação', numero(premissas.degradacao_aa_pct, '% a.a.')],
              ['Horizonte', numero(premissas.horizonte_anos, ' anos')],
              ['Tarifa', premissas.tarifa_kwh == null ? '—' : `R$ ${premissas.tarifa_kwh}/kWh`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-1">
                <dt className="text-slate-600">{k}</dt>
                <dd className={`font-medium ${v === '—' || String(v).startsWith('não') ? 'text-slate-400' : 'text-slate-900'}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Contrato {contratoVersao ?? '—'} · premissas {premissasVersao ?? '—'}
            {calculadoEm && ` · calculado em ${new Date(calculadoEm).toLocaleString('pt-BR')}`}
          </p>
        </div>
      )}

      {/* ── Regulatório (D5 pendente) ───────────────────────────────────────── */}
      {regulatorio && regulatorio.aplicavel === false && (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Cenário regulatório (Lei 14.300) não aplicado: <code>{regulatorio.motivo}</code>.
          O contrato não escolhe cenário oficial enquanto a decisão não existir.
        </p>
      )}

      {/* ── Proveniência ────────────────────────────────────────────────────── */}
      {proveniencia && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setDetalhes((v) => !v)}
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            {detalhes ? 'Ocultar' : 'Ver'} de onde veio cada dado
          </button>
          {detalhes && (
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2">Dado</th>
                  <th className="py-2">Campo de origem</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(proveniencia).map(([campo, fonte]) => (
                  <tr key={campo} className="border-b border-slate-100">
                    <td className="py-2 text-slate-700">{CAMPO[campo] ?? campo}</td>
                    <td className="py-2 font-mono text-xs text-slate-600">
                      {fonte ?? <span className="text-amber-700">ausente</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Fluxo de caixa ──────────────────────────────────────────────────── */}
      {fluxoCaixa.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setVerFluxo((v) => !v)}
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            {verFluxo ? 'Ocultar' : 'Ver'} fluxo de caixa ({fluxoCaixa.length} anos)
          </button>
          {verFluxo && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-2">Ano</th>
                    <th className="py-2 text-right">Economia</th>
                    <th className="py-2 text-right">Valor presente</th>
                  </tr>
                </thead>
                <tbody>
                  {fluxoCaixa.map((l) => (
                    <tr key={l.ano} className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-700">{l.ano}</td>
                      <td className="py-1.5 text-right text-slate-900">{moeda(l.economia_r)}</td>
                      <td className="py-1.5 text-right text-slate-600">{moeda(l.valor_presente_r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {entradas && (
        <p className="mt-6 text-xs text-slate-500">
          Entradas: investimento {moeda(entradas.investimento_r)} ·
          geração {numero(entradas.geracao_anual_kwh, ' kWh/ano')} ·
          potência {numero(entradas.potencia_wp, ' Wp')}
        </p>
      )}
    </section>
  )
}
