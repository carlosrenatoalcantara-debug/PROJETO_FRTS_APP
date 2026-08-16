import { useState } from 'react'
import { useUnifilar } from '../../providers/UnifilarProvider'
import { useContrato } from '../../providers/ContratoProvider'
import BotaoAcao from '../../componentes/BotaoAcao'

/** Rótulos legíveis dos campos que o servidor nomeia em `proveniencia`/`lacunas`. */
const CAMPO = {
  painel: 'Módulo fotovoltaico',
  inversor: 'Inversor',
  arranjoMPPTs: 'Topologia por MPPT',
  dimensionamento: 'Dimensionamento',
  tipo_ligacao: 'Tipo de ligação',
  tensao: 'Tensão',
  distribuidora: 'Concessionária',
  uf: 'UF (temperatura de projeto)',
  nomeCliente: 'Cliente',
}

/** Ordem de exibição das especificações. Rótulo e unidade — nenhum cálculo. */
const ESPECIFICACOES = [
  ['potencia_cc_kwp', 'Potência CC', 'kWp'],
  ['potencia_ca_kw', 'Potência CA', 'kW'],
  ['num_paineis', 'Módulos', ''],
  ['num_strings', 'Strings', ''],
  ['num_mppts', 'MPPTs', ''],
  ['voc_max_v', 'Voc máx.', 'V'],
  ['isc_total_a', 'Icc total', 'A'],
  ['corrente_ac_a', 'Corrente AC', 'A'],
  ['cabo_dc_mm2', 'Cabo DC', 'mm²'],
  ['cabo_ac_mm2', 'Cabo AC', 'mm²'],
  ['disjuntor_ac_a', 'Disjuntor AC', 'A'],
  ['tensao_ac_v', 'Tensão AC', 'V'],
]

/**
 * EtapaUnifilar — FV-UX-016.
 *
 * Apresenta o unifilar produzido pelo motor canônico (FV-DOM-007B). Este
 * componente NÃO calcula Voc, temperatura, condutor, proteção, MPPT, string,
 * fase, BESS nem topologia, e não remonta o SVG: tudo vem pronto do servidor.
 *
 * A tela faz três coisas que o wizard não fazia:
 *
 *  1. distingue o desenho ATUAL do SNAPSHOT congelado, sem fundi-los (M-2);
 *  2. mostra as LACUNAS que o servidor declarou, em vez de exibir um default
 *     como se fosse dado do projeto;
 *  3. mostra de qual campo do projeto cada informação veio (proveniência, M-3).
 */
export default function EtapaUnifilar() {
  const {
    svg, origem, proveniencia, lacunas, especificacoes,
    snapshot, temSnapshot, carregando, erro, gerar,
  } = useUnifilar()
  // A liberação da fase é decisão do servidor — nenhum booleano local de
  // "congelado" é construído aqui (FV-UX-004 / FV-UX-011).
  const { liberadaPara, motivoDe } = useContrato()
  const liberada = liberadaPara('engenharia')
  const motivo = motivoDe('engenharia')

  const [exibindo, setExibindo] = useState('atual')
  const [detalhes, setDetalhes] = useState(false)

  const mostrandoSnapshot = exibindo === 'snapshot' && temSnapshot
  const svgExibido = mostrandoSnapshot ? snapshot.svg : svg

  return (
    <section className="mx-auto max-w-5xl p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Diagrama Unifilar</h2>
          <p className="text-sm text-slate-500">
            Gerado pelo motor canônico a partir dos dados do projeto.
          </p>
        </div>
        <BotaoAcao onAcao={gerar}>Regerar</BotaoAcao>
      </header>

      {/* ── Fonte exibida: atual × snapshot ─────────────────────────────────── */}
      {temSnapshot && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white p-3">
          <span className="text-sm text-slate-600">Exibindo:</span>
          {[
            ['atual', 'Dados atuais'],
            ['snapshot', 'Snapshot congelado'],
          ].map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setExibindo(chave)}
              className={`rounded px-3 py-1 text-sm ${
                exibindo === chave
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              {rotulo}
            </button>
          ))}
          <span className="text-xs text-slate-500">
            {mostrandoSnapshot
              ? `Congelado em ${snapshot.criado_em ? new Date(snapshot.criado_em).toLocaleDateString('pt-BR') : '—'}${snapshot.versao ? ` · versão ${snapshot.versao}` : ''}`
              : 'O snapshot pode divergir dos dados atuais — são fatos diferentes.'}
          </span>
        </div>
      )}

      {/* ── Estado da fase, segundo o servidor ──────────────────────────────── */}
      {liberada === false && (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Engenharia ainda não liberada pelo Gate{motivo ? `: ${motivo}` : '.'} O diagrama abaixo
          reflete os dados atuais e não substitui o desenho contratado.
        </p>
      )}

      {/* ── Lacunas declaradas pelo servidor ────────────────────────────────── */}
      {!mostrandoSnapshot && lacunas.length > 0 && (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">
            {lacunas.length} dado(s) ausente(s) no projeto
          </p>
          <p className="mt-1 text-xs text-amber-800">
            O motor usou valores padrão para desenhar. Os itens abaixo NÃO descrevem
            este projeto — preencha-os antes de usar o diagrama para homologação.
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

      {erro && (
        <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      {/* ── Especificações (números do servidor, sem recálculo) ─────────────── */}
      {!mostrandoSnapshot && especificacoes && (
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded border border-slate-200 bg-slate-200 sm:grid-cols-4">
          {ESPECIFICACOES.map(([chave, rotulo, unidade]) => (
            <div key={chave} className="bg-white p-3">
              <p className="text-xs text-slate-500">{rotulo}</p>
              <p className="text-sm font-semibold text-slate-900">
                {especificacoes[chave] ?? '—'}{unidade && ` ${unidade}`}
              </p>
            </div>
          ))}
          {especificacoes.dps && (
            <div className="bg-white p-3 sm:col-span-2">
              <p className="text-xs text-slate-500">DPS DC</p>
              <p className="text-sm font-semibold text-slate-900">
                {especificacoes.dps.modelo} · {especificacoes.dps.nivel}
              </p>
            </div>
          )}
          <div className="bg-white p-3 sm:col-span-2">
            <p className="text-xs text-slate-500">Fases</p>
            <p className="text-sm font-semibold text-slate-900">
              {especificacoes.fases ? `${especificacoes.fases}Ø` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* ── Diagrama ────────────────────────────────────────────────────────── */}
      {carregando && !svgExibido && (
        <p className="mt-6 text-sm text-slate-500">Gerando diagrama…</p>
      )}

      {!carregando && !svgExibido && !erro && (
        <div className="mt-6 rounded border-2 border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-600">Nenhum diagrama disponível.</p>
          <p className="mt-1 text-xs text-slate-500">
            Use “Regerar” para solicitar o desenho ao servidor.
          </p>
        </div>
      )}

      {svgExibido && (
        <figure className="mt-6">
          <div
            className="overflow-auto rounded border border-slate-200 bg-slate-50 p-4"
            // O SVG vem do domínio, não de entrada de usuário. Renderizar como
            // marcação é o que permite o clique nos ativos (gêmeo digital).
            dangerouslySetInnerHTML={{ __html: svgExibido }}
          />
          <figcaption className="mt-2 text-xs text-slate-500">
            {mostrandoSnapshot
              ? 'Snapshot congelado — não reflete alterações posteriores do projeto.'
              : `Origem: ${origem ?? '—'} · desenhado com os dados atuais do projeto.`}
          </figcaption>
        </figure>
      )}

      {/* ── Proveniência ────────────────────────────────────────────────────── */}
      {!mostrandoSnapshot && proveniencia && (
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
                      {fonte ?? <span className="text-amber-700">ausente — valor padrão do motor</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}
