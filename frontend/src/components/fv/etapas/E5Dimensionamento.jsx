import { useEffect, useState } from 'react'
import { Zap, Sun, Grid, RefreshCw, AlertCircle } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import { calcularDimensionamento } from '../../../utils/calcDimensionamento'

function CardResultado({ icone: Icone, titulo, valor, unidade, cor }) {
  return (
    <div className={`p-5 rounded-xl border-2 ${cor} flex items-center gap-4`}>
      <div className="p-3 rounded-lg bg-white/60">
        <Icone size={22} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{titulo}</p>
        <p className="text-2xl font-bold mt-0.5">
          {valor} <span className="text-sm font-normal opacity-70">{unidade}</span>
        </p>
      </div>
    </div>
  )
}

export default function E5Dimensionamento() {
  const { state, dispatch, proxima, anterior } = useProjetoFV()
  const { dadosConsumo, irradiancia, dimensionamento: dim } = state

  const [potenciaW,   setPotenciaW]   = useState(String(dim.potenciaPainelW    || 550))
  const [capInversor, setCapInversor] = useState(String(dim.capacidadeInversorKW || 5))
  const [fatorConservadorismo, setFatorConservadorismo] = useState(0.95) // 95% (Realista)
  const [erro,        setErro]        = useState('')

  const PERFIS = [
    { valor: 1.0, label: 'Otimista', descricao: '100% - Máxima produção' },
    { valor: 0.95, label: 'Realista', descricao: '95% - Sombreamento mínimo' },
    { valor: 0.9, label: 'Conservador', descricao: '90% - Sombreamento e perdas' },
  ]

  function recalcular(pw = potenciaW, ci = capInversor) {
    const consumo = Number(dadosConsumo.consumoMensal)
    const irrad   = irradiancia.mediaAnual

    if (!consumo || !irrad) {
      setErro('Dados de consumo ou irradiância incompletos. Volte e preencha as etapas anteriores.')
      return
    }
    setErro('')

    const resultado = calcularDimensionamento({
      consumoMensal:       consumo * fatorConservadorismo,
      irradianciaMedia:    irrad,
      potenciaPainelW:     Number(pw)  || 550,
      capacidadeInversorKW:Number(ci)  || 5,
    })

    if (resultado) {
      dispatch({
        type: 'SET_DIMENSIONAMENTO',
        payload: {
          ...resultado,
          potenciaPainelW:      Number(pw)  || 550,
          capacidadeInversorKW: Number(ci)  || 5,
        },
      })
    }
  }

  // Recalcula SEMPRE que entrar na etapa ou mudar dados de entrada
  // Remove a guarda "if (!dim.potenciaKwp)" para garantir recálculo
  // quando o usuário volta de E2 ou E4 e altera valores
  useEffect(() => {
    recalcular()
  }, [dadosConsumo.consumoMensal, irradiancia.mediaAnual, fatorConservadorismo])

  const podeAvancar = !!dim.potenciaKwp && !erro

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Pré-Dimensionamento</h2>
        <p className="text-sm text-slate-500 mt-1">
          Calculado para <strong>{dadosConsumo.consumoMensal} kWh/mês</strong> com
          irradiância de{' '}
          <strong>
            {irradiancia.mediaAnual} kWh/m²/dia
            {irradiancia.fonte === 'cresesb' && ' (CRESESB)'}
          </strong>.
        </p>
        <p className="text-xs text-slate-400 mt-2">
          💡 Se houver beneficiárias, o consumo será considerado na etapa anterior
        </p>
      </div>

      {erro && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} />
          {erro}
        </div>
      )}

      {/* Perfil de Geração */}
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Perfil de Geração</p>
        <div className="space-y-2">
          {PERFIS.map((perfil) => (
            <label key={perfil.valor} className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 cursor-pointer transition-all" style={{borderColor: fatorConservadorismo === perfil.valor ? '#3b82f6' : '#e2e8f0'}}>
              <input
                type="radio"
                name="perfil"
                value={perfil.valor}
                checked={fatorConservadorismo === perfil.valor}
                onChange={(e) => setFatorConservadorismo(Number(e.target.value))}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <p className="font-medium text-slate-900">{perfil.label}</p>
                <p className="text-xs text-slate-500">{perfil.descricao}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-600 bg-white p-2 rounded border border-blue-200">
          💡 O fator {fatorConservadorismo * 100}% será aplicado ao dimensionamento para considerar sombreamento, perdas em cabos e conversão.
        </p>
      </div>

      {/* Parâmetros ajustáveis */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Parâmetros (ajuste e recalcule)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              rotulo="Potência do painel (W)"
              type="number"
              min="100"
              max="1000"
              value={potenciaW}
              onChange={e => setPotenciaW(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">Padrão de mercado: 550–610 W</p>
          </div>
          <div>
            <Input
              rotulo="Capacidade do inversor (kW)"
              type="number"
              min="1"
              max="100"
              step="0.5"
              value={capInversor}
              onChange={e => setCapInversor(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">Tamanhos comuns: 3, 5, 8, 10, 15 kW</p>
          </div>
        </div>
        <Button
          variante="secundario"
          icone={RefreshCw}
          tamanho="sm"
          onClick={() => recalcular()}
        >
          Recalcular
        </Button>
      </div>

      {/* Resultados */}
      {dim.potenciaKwp && !erro && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CardResultado
              icone={Zap}
              titulo="Potência do Sistema"
              valor={dim.potenciaRealKwp}
              unidade="kWp"
              cor="border-amber-200 bg-amber-50 text-amber-800"
            />
            <CardResultado
              icone={Sun}
              titulo="Energia Necessária/Dia"
              valor={dim.energiaNecessaria}
              unidade="kWh/dia"
              cor="border-blue-200 bg-blue-50 text-blue-800"
            />
            <CardResultado
              icone={Grid}
              titulo="Número de Painéis"
              valor={dim.numPaineis}
              unidade={`painéis de ${dim.potenciaPainelW} W`}
              cor="border-emerald-200 bg-emerald-50 text-emerald-800"
            />
            <CardResultado
              icone={Zap}
              titulo="Número de Inversores"
              valor={dim.numInversores}
              unidade={`inversor(es) de ${dim.capacidadeInversorKW} kW`}
              cor="border-primary-200 bg-primary-50 text-primary-800"
            />
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-medium">
              Ver detalhes do cálculo
            </summary>
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 font-mono text-xs text-slate-600">
              <p>Energia diária      = {dadosConsumo.consumoMensal} ÷ 30 = <strong>{dim.energiaDiaria} kWh/dia</strong></p>
              <p>Perdas do sistema   = 20%</p>
              <p>Energia necessária  = {dim.energiaDiaria} ÷ 0,80 = <strong>{dim.energiaNecessaria} kWh/dia</strong></p>
              <p>Potência (kWp)      = {dim.energiaNecessaria} ÷ {irradiancia.mediaAnual} = <strong>{dim.potenciaKwp} kWp</strong></p>
              <p>Nº painéis          = ⌈{dim.potenciaKwp} × 1000 ÷ {dim.potenciaPainelW}⌉ = <strong>{dim.numPaineis}</strong></p>
              <p>Potência real       = {dim.numPaineis} × {dim.potenciaPainelW} ÷ 1000 = <strong>{dim.potenciaRealKwp} kWp</strong></p>
              <p>Nº inversores       = ⌈{dim.potenciaRealKwp} ÷ {dim.capacidadeInversorKW}⌉ = <strong>{dim.numInversores}</strong></p>
              <p>Área mínima         = {dim.numPaineis} × 2,0 m² = <strong>{dim.areaMinima} m²</strong></p>
            </div>
          </details>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variante="secundario" onClick={anterior}>← Anterior</Button>
        <Button onClick={proxima} disabled={!podeAvancar}>Próxima →</Button>
      </div>
    </div>
  )
}
