import { useState, useMemo, useEffect } from 'react'
import { DollarSign, TrendingUp, Eye, EyeOff, CreditCard, Landmark, Package, Layers } from 'lucide-react'
import { calcularFinanceiroCompleto } from '../../utils/financeiroEngine'

/**
 * CentroFinanceiroFV — Sprint 4
 *
 * Centro financeiro EPC embutido no E8. Calcula custos, markup, margem,
 * financiamento, parcelamento, ROI e payback consumindo o snapshot técnico
 * (engineering lock). Expõe o resultado via onResultado para congelamento.
 *
 * Não substitui o orçamento simples do E8 — é a camada profissional opcional.
 */

const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pctf = (v) => (v == null ? '—' : `${Number(v).toFixed(1)}%`)

function MiniInput({ label, value, onChange, suffix, step = 1, min = 0 }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number" min={min} step={step} value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {suffix && <span className="text-xs text-slate-400 whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  )
}

function CardKPI({ titulo, valor, sub, destaque }) {
  return (
    <div className={`rounded-xl p-4 border ${destaque ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`text-xl font-bold ${destaque ? 'text-emerald-700' : 'text-slate-900'}`}>{valor}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function CentroFinanceiroFV({
  snapshotTecnico, config = {}, custosIniciais = {}, tarifaInicial = {}, onResultado,
}) {
  const [modo, setModo] = useState('composicao')
  const [modoCliente, setModoCliente] = useState(false)

  const [custos, setCustos] = useState(() => ({
    custo_painel:       custosIniciais.custo_painel ?? 0,
    custo_inversor:     custosIniciais.custo_inversor ?? 0,
    custo_estrutura:    custosIniciais.custo_estrutura ?? 0,
    custo_cabos:        custosIniciais.custo_cabos ?? 0,
    custo_protecao:     0,
    custo_homologacao:  0,
    custo_mao_obra:     custosIniciais.custo_mao_obra ?? 0,
    custo_deslocamento: 0,
    custo_comissao:     0,
    custo_impostos:     0,
    custo_bess:         0,
  }))

  const [valorVendaKit, setValorVendaKit] = useState(custosIniciais.total ?? 0)
  const [markupPct, setMarkupPct]   = useState(config.markupPadraoPct ?? 30)
  const [descontoPct, setDescontoPct] = useState(0)

  const [usarFinanciamento, setUsarFinanciamento] = useState(false)
  const [financiamento, setFinanciamento] = useState({
    entrada: 0,
    parcelas: config.finParcelasPadrao ?? 60,
    taxaJurosMesPct: config.finTaxaJurosMesPct ?? 1.49,
    carenciaMeses: config.finCarenciaMeses ?? 3,
  })

  const [parcelTipo, setParcelTipo] = useState('cartao')
  const [parcelas, setParcelas] = useState(config.parcelasPadraoCartao ?? 12)

  const [tarifa, setTarifa] = useState({
    tarifaKwh: tarifaInicial.tarifaKwh ?? config.tarifaKwhPadrao ?? 0.95,
    reajusteAnualPct: tarifaInicial.reajusteAnualPct ?? config.reajusteAnualPct ?? 5,
    inflacaoEnergiaPct: config.inflacaoEnergiaPct ?? 2,
    bandeira: config.bandeiraPadrao ?? 'verde',
  })

  const setCusto = (k) => (v) => setCustos((c) => ({ ...c, [k]: Number(v) }))
  const setFin = (k) => (v) => setFinanciamento((f) => ({ ...f, [k]: Number(v) }))
  const setTar = (k) => (v) => setTarifa((t) => ({ ...t, [k]: k === 'bandeira' ? v : Number(v) }))

  const taxaParcelMes = parcelTipo === 'cartao' ? (config.cartaoTaxaMesPct ?? 2.99)
    : parcelTipo === 'boleto' ? (config.boletoTaxaMesPct ?? 1.99)
    : (config.proprioTaxaMesPct ?? 0)

  const resultado = useMemo(() => calcularFinanceiroCompleto({
    modo,
    custos,
    valorVendaKit,
    markupPct,
    descontoPct,
    snapshotTecnico,
    tarifa,
    financiamento: usarFinanciamento ? financiamento : null,
    parcelamento: { tipo: parcelTipo, parcelas, taxaMesPct: taxaParcelMes },
  }), [modo, custos, valorVendaKit, markupPct, descontoPct, snapshotTecnico, tarifa, usarFinanciamento, financiamento, parcelTipo, parcelas, taxaParcelMes])

  useEffect(() => { onResultado?.(resultado) }, [resultado, onResultado])

  const { orcamento, margem, retorno, financiamento: fin, parcelamento: parc } = resultado

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      {/* Cabeçalho + toggle cliente */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-emerald-600" />
          <span className="text-sm font-semibold text-slate-800">Centro Financeiro EPC</span>
        </div>
        <button
          onClick={() => setModoCliente((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            modoCliente ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {modoCliente ? <Eye size={14} /> : <EyeOff size={14} />}
          {modoCliente ? 'Visão Cliente' : 'Visão Interna'}
        </button>
      </div>

      {/* Resumo executivo (sempre visível) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CardKPI titulo="Valor final" valor={brl(orcamento.preco_venda)} destaque />
        <CardKPI titulo="Economia/ano" valor={retorno.calc_possivel ? brl(retorno.economia_anual_1ano) : '—'} />
        <CardKPI titulo="Payback" valor={retorno.calc_possivel && retorno.payback_anos ? `${retorno.payback_anos} anos` : '—'} />
        <CardKPI titulo="ROI 25 anos" valor={retorno.calc_possivel ? pctf(retorno.roi_pct) : '—'}
          sub={retorno.calc_possivel ? `TIR ~${pctf(retorno.tir_estimada_aa_pct)} a.a.` : null} />
      </div>

      {!modoCliente && (
        <>
          {/* Modo de orçamento */}
          <div className="flex gap-2">
            <button onClick={() => setModo('composicao')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${modo === 'composicao' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <Layers size={14} /> Composição detalhada
            </button>
            <button onClick={() => setModo('kit_fechado')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${modo === 'kit_fechado' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <Package size={14} /> Kit fechado
            </button>
          </div>

          {modo === 'kit_fechado' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MiniInput label="Valor de venda do kit" value={valorVendaKit} onChange={(v) => setValorVendaKit(Number(v))} suffix="R$" step={100} />
              <div className="grid grid-cols-2 gap-3">
                <MiniInput label="Custo painel" value={custos.custo_painel} onChange={setCusto('custo_painel')} suffix="R$" step={100} />
                <MiniInput label="Custo inversor" value={custos.custo_inversor} onChange={setCusto('custo_inversor')} suffix="R$" step={100} />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Custos internos</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <MiniInput label="Painel" value={custos.custo_painel} onChange={setCusto('custo_painel')} suffix="R$" step={100} />
                <MiniInput label="Inversor" value={custos.custo_inversor} onChange={setCusto('custo_inversor')} suffix="R$" step={100} />
                <MiniInput label="Estrutura" value={custos.custo_estrutura} onChange={setCusto('custo_estrutura')} suffix="R$" step={50} />
                <MiniInput label="Cabos" value={custos.custo_cabos} onChange={setCusto('custo_cabos')} suffix="R$" step={50} />
                <MiniInput label="Proteção" value={custos.custo_protecao} onChange={setCusto('custo_protecao')} suffix="R$" step={50} />
                <MiniInput label="Homologação" value={custos.custo_homologacao} onChange={setCusto('custo_homologacao')} suffix="R$" step={50} />
                <MiniInput label="Mão de obra" value={custos.custo_mao_obra} onChange={setCusto('custo_mao_obra')} suffix="R$" step={50} />
                <MiniInput label="Deslocamento" value={custos.custo_deslocamento} onChange={setCusto('custo_deslocamento')} suffix="R$" step={50} />
                <MiniInput label="Comissão" value={custos.custo_comissao} onChange={setCusto('custo_comissao')} suffix="R$" step={50} />
                <MiniInput label="Impostos" value={custos.custo_impostos} onChange={setCusto('custo_impostos')} suffix="R$" step={50} />
                <MiniInput label="BESS" value={custos.custo_bess} onChange={setCusto('custo_bess')} suffix="R$" step={100} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
                <MiniInput label="Markup sobre CMV" value={markupPct} onChange={(v) => setMarkupPct(Number(v))} suffix="%" step={0.5} />
                <MiniInput label="Desconto" value={descontoPct} onChange={(v) => setDescontoPct(Number(v))} suffix="%" step={0.5} min={0} />
              </div>
            </div>
          )}

          {/* Margem e rentabilidade (interno) */}
          <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
            <div><p className="text-xs text-slate-500">Custo total</p><p className="font-semibold text-slate-800">{brl(margem.custo_total)}</p></div>
            <div><p className="text-xs text-slate-500">Margem bruta</p><p className="font-semibold text-slate-800">{pctf(margem.margem_bruta_pct)}</p></div>
            <div><p className="text-xs text-slate-500">Margem líquida</p><p className="font-semibold text-slate-800">{pctf(margem.margem_liquida_pct)}</p></div>
            <div><p className="text-xs text-slate-500">Lucro total</p><p className="font-semibold text-emerald-700">{brl(margem.lucro_total)}</p></div>
            <div><p className="text-xs text-slate-500">Lucro/Wp</p><p className="font-semibold text-slate-800">{margem.lucro_por_wp != null ? brl(margem.lucro_por_wp) : '—'}</p></div>
            <div><p className="text-xs text-slate-500">Ticket médio</p><p className="font-semibold text-slate-800">{brl(margem.ticket_medio)}</p></div>
          </div>
        </>
      )}

      {/* Tarifa */}
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1"><TrendingUp size={13} /> Energia & projeção</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MiniInput label="Tarifa kWh" value={tarifa.tarifaKwh} onChange={setTar('tarifaKwh')} suffix="R$" step={0.01} />
          <MiniInput label="Reajuste a.a." value={tarifa.reajusteAnualPct} onChange={setTar('reajusteAnualPct')} suffix="%" step={0.5} />
          <MiniInput label="Inflação energia" value={tarifa.inflacaoEnergiaPct} onChange={setTar('inflacaoEnergiaPct')} suffix="%" step={0.5} />
        </div>
        {snapshotTecnico?.geracao_anual_kwh && (
          <p className="text-xs text-slate-400 mt-1">
            Geração congelada: {Number(snapshotTecnico.geracao_anual_kwh).toLocaleString('pt-BR')} kWh/ano ·
            {' '}{snapshotTecnico.sistema?.potenciaCC} kWp
          </p>
        )}
      </div>

      {/* Financiamento + Parcelamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded-lg p-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-2">
            <input type="checkbox" checked={usarFinanciamento} onChange={(e) => setUsarFinanciamento(e.target.checked)} />
            <Landmark size={13} /> Financiamento (Price)
          </label>
          {usarFinanciamento && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <MiniInput label="Entrada" value={financiamento.entrada} onChange={setFin('entrada')} suffix="R$" step={100} />
                <MiniInput label="Parcelas" value={financiamento.parcelas} onChange={setFin('parcelas')} suffix="x" step={1} />
                <MiniInput label="Juros" value={financiamento.taxaJurosMesPct} onChange={setFin('taxaJurosMesPct')} suffix="% a.m." step={0.01} />
                <MiniInput label="Carência" value={financiamento.carenciaMeses} onChange={setFin('carenciaMeses')} suffix="meses" step={1} />
              </div>
              {fin && (
                <p className="text-sm font-semibold text-slate-800 mt-2">
                  {fin.parcelas}× {brl(fin.parcela)}
                  <span className="text-xs font-normal text-slate-400 ml-2">CET ~{pctf(fin.cet_aa_pct)} a.a.</span>
                </p>
              )}
            </>
          )}
        </div>

        <div className="border border-slate-200 rounded-lg p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-2"><CreditCard size={13} /> Parcelamento</p>
          <div className="flex gap-1.5 mb-2">
            {['cartao', 'boleto', 'proprio'].map((t) => (
              <button key={t} onClick={() => setParcelTipo(t)}
                className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${parcelTipo === t ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {t === 'proprio' ? 'Próprio' : t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniInput label="Parcelas" value={parcelas} onChange={(v) => setParcelas(Number(v))} suffix="x" step={1} min={1} />
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Taxa</label>
              <p className="px-2 py-1.5 text-sm bg-slate-50 rounded text-slate-600">{taxaParcelMes}% a.m.</p>
            </div>
          </div>
          {parc && (
            <p className="text-sm font-semibold text-slate-800 mt-2">
              {parc.parcelas}× {brl(parc.parcela)}
              <span className="text-xs font-normal text-slate-400 ml-2">
                {parc.juros > 0 ? `+${brl(parc.juros)} juros` : 'sem juros'}
              </span>
            </p>
          )}
        </div>
      </div>

      {modoCliente && (
        <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1.5">
          Visão Cliente ativa — custos internos, margem, markup e comissão estão ocultos.
        </p>
      )}
    </div>
  )
}
