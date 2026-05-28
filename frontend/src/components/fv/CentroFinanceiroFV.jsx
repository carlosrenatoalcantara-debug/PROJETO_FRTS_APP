import { useState, useMemo, useEffect } from 'react'
import { DollarSign, TrendingUp, Eye, EyeOff, CreditCard, Landmark, Package, Layers, Scale, Info } from 'lucide-react'
import { calcularFinanceiroCompleto } from '../../utils/financeiroEngine'
import { calcularRetornoRegulatorio, construirPremissasRegulatorias, GD_MODALIDADES } from '../../utils/financeiroRegulatorioBR'

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
  snapshotTecnico, config = {}, custosIniciais = {}, tarifaInicial = {}, consumoAnualKwh = 0, tipoLigacao = 'monofasico', onResultado,
}) {
  const [modo, setModo] = useState('composicao')
  const [modoCliente, setModoCliente] = useState(false)
  // S4.1: simulação regulatória Lei 14.300
  const [modoAvancado, setModoAvancado] = useState(false)
  const [reg, setReg] = useState(() => ({
    anoInstalacao: new Date().getFullYear(),
    modalidade: 'GD_I',
    fatorCompensacao: 100,        // %
    simultaneidade: 30,           // %
    fioBFracaoTarifa: 28,         // % da tarifa cheia
    consumoAnualKwh: consumoAnualKwh || 0,
  }))
  const setRegC = (k) => (v) => setReg((r) => ({ ...r, [k]: k === 'modalidade' ? v : Number(v) }))

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

  const resultado = useMemo(() => {
    const comum = {
      modo, custos, valorVendaKit, markupPct, descontoPct, snapshotTecnico, tarifa,
      financiamento: usarFinanciamento ? financiamento : null,
      parcelamento: { tipo: parcelTipo, parcelas, taxaMesPct: taxaParcelMes },
    }
    // 1ª passada: obtém o preço de venda
    const base = calcularFinanceiroCompleto(comum)

    if (!modoAvancado) return base

    // 2ª passada: motor regulatório Lei 14.300 (engineering lock via snapshot técnico)
    const premissas = construirPremissasRegulatorias({
      anoInstalacao: reg.anoInstalacao,
      modalidade: reg.modalidade,
      fatorCompensacao: reg.fatorCompensacao / 100,
      simultaneidade: reg.simultaneidade / 100,
      fioBFracaoTarifa: reg.fioBFracaoTarifa / 100,
      tipoLigacao,
      tarifaKwh: tarifa.tarifaKwh,
      reajusteAnualPct: tarifa.reajusteAnualPct,
      inflacaoEnergiaPct: tarifa.inflacaoEnergiaPct,
      degradacaoAnualPct: config.degradacaoAnualPct ?? 0.5,
    })
    const retornoRealista = calcularRetornoRegulatorio({
      geracaoAnualKwh: snapshotTecnico?.geracao_anual_kwh,
      consumoAnualKwh: reg.consumoAnualKwh || snapshotTecnico?.geracao_anual_kwh,
      precoVenda: base.orcamento.preco_venda,
      premissas,
    })
    return calcularFinanceiroCompleto({
      ...comum,
      regulatorio: { ativo: true, retorno_realista: retornoRealista },
    })
  }, [modo, custos, valorVendaKit, markupPct, descontoPct, snapshotTecnico, tarifa, usarFinanciamento, financiamento, parcelTipo, parcelas, taxaParcelMes, modoAvancado, reg, tipoLigacao, config.degradacaoAnualPct])

  useEffect(() => { onResultado?.(resultado) }, [resultado, onResultado])

  const { orcamento, margem, retorno, financiamento: fin, parcelamento: parc, comparacao } = resultado
  // Cenário exibido nos KPIs: realista (Lei 14.300) quando avançado, senão otimista
  const ret = resultado.retorno_realista || retorno
  const det = resultado.retorno_realista?.detalhe_ano1 || null

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      {/* Cabeçalho + toggle cliente */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-emerald-600" />
          <span className="text-sm font-semibold text-slate-800">Centro Financeiro EPC</span>
          {modoAvancado && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700" title="Cenário realista sob a Lei 14.300/2022">
              LEI 14.300
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModoAvancado((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              modoAvancado ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
            title="Alterna entre modelo simples (compensação integral) e realista (Lei 14.300, Fio B, compensação parcial)"
          >
            <Scale size={14} />
            {modoAvancado ? 'Avançado (real)' : 'Simples'}
          </button>
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
      </div>

      {/* Resumo executivo (sempre visível) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CardKPI titulo="Valor final" valor={brl(orcamento.preco_venda)} destaque />
        <CardKPI titulo={modoAvancado ? 'Economia/ano (real)' : 'Economia/ano'} valor={ret.calc_possivel ? brl(ret.economia_anual_1ano) : '—'} />
        <CardKPI titulo="Payback" valor={ret.calc_possivel && ret.payback_anos ? `${ret.payback_anos} anos` : '—'} />
        <CardKPI titulo="ROI 25 anos" valor={ret.calc_possivel ? pctf(ret.roi_pct) : '—'}
          sub={ret.calc_possivel ? `TIR ~${pctf(ret.tir_estimada_aa_pct)} a.a.` : null} />
      </div>

      {/* S4.1: Simulador regulatório (modo avançado) */}
      {modoAvancado && (
        <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
            <Scale size={13} /> Premissas regulatórias (Lei 14.300/2022)
          </p>
          {!modoCliente && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MiniInput label="Ano instalação" value={reg.anoInstalacao} onChange={setRegC('anoInstalacao')} step={1} />
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Modalidade GD</label>
                <select value={reg.modalidade} onChange={(e) => setRegC('modalidade')(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {Object.entries(GD_MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <MiniInput label="Compensação" value={reg.fatorCompensacao} onChange={setRegC('fatorCompensacao')} suffix="%" step={1} />
              <MiniInput label="Simultaneidade" value={reg.simultaneidade} onChange={setRegC('simultaneidade')} suffix="%" step={1} />
              <MiniInput label="Fio B (% tarifa)" value={reg.fioBFracaoTarifa} onChange={setRegC('fioBFracaoTarifa')} suffix="%" step={1} />
              <MiniInput label="Consumo anual" value={reg.consumoAnualKwh} onChange={setRegC('consumoAnualKwh')} suffix="kWh" step={100} />
            </div>
          )}

          {/* Comparação otimista × realista */}
          {comparacao && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-500">Economia 25a (otimista)</p>
                <p className="font-semibold text-slate-400 line-through">{brl(comparacao.economia_25_otimista)}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-emerald-200">
                <p className="text-xs text-slate-500">Economia 25a (realista)</p>
                <p className="font-bold text-emerald-700">{brl(comparacao.economia_25_realista)}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-500">Impacto regulatório</p>
                <p className="font-semibold text-orange-600">{brl(comparacao.diferenca_25_anos)} ({comparacao.diferenca_pct}%)</p>
              </div>
            </div>
          )}

          {/* Breakdown energético do ano 1 */}
          {det && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm pt-1">
              <div title="Energia gerada e consumida no mesmo instante — economiza tarifa cheia.">
                <p className="text-xs text-slate-500 flex items-center gap-0.5">Autoconsumida <Info size={10} /></p>
                <p className="font-semibold text-slate-800">{det.energia_autoconsumida_kwh} kWh</p>
              </div>
              <div title="Energia injetada na rede para compensação futura.">
                <p className="text-xs text-slate-500">Exportada</p>
                <p className="font-semibold text-slate-800">{det.energia_exportada_kwh} kWh</p>
              </div>
              <div title="Energia que efetivamente abateu o consumo (após fator de compensação).">
                <p className="text-xs text-slate-500">Compensada</p>
                <p className="font-semibold text-slate-800">{det.energia_compensada_kwh} kWh</p>
              </div>
              <div title="Custo do Fio B (TUSD) sobre a energia compensada — Lei 14.300.">
                <p className="text-xs text-slate-500 flex items-center gap-0.5">Custo Fio B <Info size={10} /></p>
                <p className="font-semibold text-orange-600">{brl(det.custo_fio_b)} ({Math.round(det.percentual_fio_b * 100)}%)</p>
              </div>
              <div title="Perda de economia vs cenário de compensação integral.">
                <p className="text-xs text-slate-500">Perda regulatória</p>
                <p className="font-semibold text-orange-600">{brl(resultado.retorno_realista.perda_regulatoria_ano1)}/ano</p>
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            Fio B cobrado gradualmente: 2023→15%, 2024→30%… 2029→100%. Sistemas até 2022 têm direito adquirido até 2045.
          </p>
        </div>
      )}

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
