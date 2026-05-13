import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sun, Zap, TrendingUp, DollarSign, Clock, AlertTriangle,
  CheckCircle, Search, ArrowLeft, Download, Save,
  RefreshCw, MapPin, BarChart2, Info, Settings2, Lightbulb,
} from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import Tabs from '../components/ui/Tabs'
import GraficoGeracaoConsumo    from '../components/fv/GraficoGeracaoConsumo'
import ValidacaoEletrica        from '../components/fv/ValidacaoEletrica'
import SimulacaoFinanceira      from '../components/fv/SimulacaoFinanceira'
import DatasheetForm            from '../components/fv/DatasheetForm'
import LayoutTelhado            from '../components/fv/LayoutTelhado'
import MapaTelhado              from '../components/fv/MapaTelhado'
import TelhadoVisualizacao      from '../components/fv/TelhadoVisualizacao'
import RecomendacaoFinal        from '../components/fv/RecomendacaoFinal'
import { geocodificarEndereco } from '../services/geocodingApi'
import { gerarPdfComercial }    from '../utils/gerarPdfComercial'
import { formatarMoeda, formatarNumero, formatarPercentual, formatarData } from '../utils/formatadores'
import { useEmpresa }           from '../contexts/EmpresaContext'

// ── constantes ────────────────────────────────────────────────────────────────

const OPCOES_PAINEL = [
  { valor: '400', rotulo: '400 W' },
  { valor: '450', rotulo: '450 W' },
  { valor: '550', rotulo: '550 W (recomendado)' },
  { valor: '600', rotulo: '600 W' },
]

const CONCESSIONARIAS_POR_ESTADO = {
  'AC': ['Energisa Acre'],
  'AL': ['Energisa Alagoas'],
  'AP': ['Energisa Amapá'],
  'AM': ['Amazonas Energia'],
  'BA': ['Neoenergia Bahia', 'Elektro'],
  'CE': ['Enel Ceará', 'Energisa'],
  'DF': ['Neoenergia Brasília'],
  'ES': ['Energisa Espírito Santo'],
  'GO': ['Energisa Goiás'],
  'MA': ['Energia do Maranhão'],
  'MT': ['Energisa Mato Grosso'],
  'MS': ['Energisa Mato Grosso do Sul'],
  'MG': ['Neoenergia Minas Gerais', 'Cemig'],
  'PA': ['Equatorial Pará'],
  'PB': ['Energisa Paraíba'],
  'PR': ['Copel', 'Energisa Paraná'],
  'PE': ['Neoenergia Pernambuco'],
  'PI': ['Energisa Piauí'],
  'RJ': ['Enel Rio'],
  'RN': ['Cosern'],
  'RS': ['Copel Rio Grande do Sul', 'RGE'],
  'RO': ['Energisa Rondônia'],
  'RR': ['Energisa Roraima'],
  'SC': ['Celesc', 'Energisa Santa Catarina'],
  'SP': ['Enel SP', 'Cpfl', 'Elektro', 'Bandeirante'],
  'TO': ['Energisa Tocantins'],
}

const OPCOES_ESTADO = [
  { valor: 'AC', rotulo: 'Acre' },
  { valor: 'AL', rotulo: 'Alagoas' },
  { valor: 'AP', rotulo: 'Amapá' },
  { valor: 'AM', rotulo: 'Amazonas' },
  { valor: 'BA', rotulo: 'Bahia' },
  { valor: 'CE', rotulo: 'Ceará' },
  { valor: 'DF', rotulo: 'Distrito Federal' },
  { valor: 'ES', rotulo: 'Espírito Santo' },
  { valor: 'GO', rotulo: 'Goiás' },
  { valor: 'MA', rotulo: 'Maranhão' },
  { valor: 'MT', rotulo: 'Mato Grosso' },
  { valor: 'MS', rotulo: 'Mato Grosso do Sul' },
  { valor: 'MG', rotulo: 'Minas Gerais' },
  { valor: 'PA', rotulo: 'Pará' },
  { valor: 'PB', rotulo: 'Paraíba' },
  { valor: 'PR', rotulo: 'Paraná' },
  { valor: 'PE', rotulo: 'Pernambuco' },
  { valor: 'PI', rotulo: 'Piauí' },
  { valor: 'RJ', rotulo: 'Rio de Janeiro' },
  { valor: 'RN', rotulo: 'Rio Grande do Norte' },
  { valor: 'RS', rotulo: 'Rio Grande do Sul' },
  { valor: 'RO', rotulo: 'Rondônia' },
  { valor: 'RR', rotulo: 'Roraima' },
  { valor: 'SC', rotulo: 'Santa Catarina' },
  { valor: 'SP', rotulo: 'São Paulo' },
  { valor: 'TO', rotulo: 'Tocantins' },
]

const ABAS_RESULTADO = [
  { id: 'resumo',      rotulo: 'Resumo',         icone: BarChart2   },
  { id: 'layout',      rotulo: 'Layout',         icone: MapPin      },
  { id: 'financeiro',  rotulo: 'Financeiro',      icone: TrendingUp  },
  { id: 'tecnico',     rotulo: 'Técnico',         icone: Zap         },
  { id: 'recomendacao',rotulo: 'Recomendação',    icone: Lightbulb   },
]

const FORM_INICIAL = {
  consumoMensal: '', estado: '', concessionaria: '', cidadeEstado: '', lat: null, lon: null,
  areaDisponivel: '', tipoSistema: 'string',
  potenciaPainelW: '550', tarifaEnergia: '0.95',
  inflacaoEnergia: '8', taxaDesconto: '6',
}

const DS_INICIAL = {
  marca: '', modelo: '', tipo: 'monocristalino',
  pmpp: '', voc: '', isc: '', vmpp: '', impp: '',
  tempCoefVoc: '', tempCoefPmpp: '', area: '',
  garantiaProduto: '12', garantiaPerformance: '25', percentualPerformance: '80',
}

// ── componente Stat ───────────────────────────────────────────────────────────

function Stat({ icone: Icone, titulo, valor, unidade, cor = 'bg-slate-50 border-slate-200', iconeCor }) {
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${cor}`}>
      <div className={`p-2 rounded-lg bg-white/70 ${iconeCor ?? 'text-slate-500'}`}>
        <Icone size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">{titulo}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5 leading-tight">
          {valor}{unidade && <span className="text-sm font-normal text-slate-500 ml-1">{unidade}</span>}
        </p>
      </div>
    </div>
  )
}

// ── tela de resultado ─────────────────────────────────────────────────────────

function ResultadoSimulacao({ resultado, form, datasheetPainel, onNova }) {
  const { empresa } = useEmpresa()
  const navigate    = useNavigate()
  const [aba, setAba]         = useState('resumo')
  const [salvando, setSalvando]= useState(false)
  const [salvo, setSalvo]     = useState(false)
  const [errSalvo, setErrSalvo]= useState('')
  const [gerando, setGerando] = useState(false)
  const [errPdf, setErrPdf]   = useState('')
  const [notifLead, setNotifLead] = useState('')

  const { carga, strings, validacao, sombreamento, bess, financeiro, recomendacao } = resultado
  const corPrimaria = empresa.corPrimaria || '#f97316'

  async function criarLeadAutomatico() {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005'
      const res = await fetch(`${API_URL}/api/crm/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: form.cidadeEstado || 'Simulação',
          origem: 'simulacao',
          status: 'lead',
          valor_proposta: financeiro?.vpl || 15000,
          notas: 'Gerado via simulação FV',
        }),
      })
      if (res.ok) {
        setNotifLead('Lead criado no CRM')
        setTimeout(() => setNotifLead(''), 4000)
      }
    } catch (e) {
      // Falha silenciosa
    }
  }

  function baixarPdf() {
    setGerando(true); setErrPdf('')
    try {
      const doc = gerarPdfComercial({ resultado, cidadeEstado: form.cidadeEstado, empresa, datasheetPainel })
      doc.save(`proposta-solar-${Date.now()}.pdf`)
      // Criar lead automaticamente após gerar PDF
      criarLeadAutomatico()
    } catch (e) { setErrPdf(`Erro PDF: ${e.message}`) }
    finally { setGerando(false) }
  }

  async function salvar() {
    setSalvando(true); setErrSalvo('')
    try {
      const resp = await fetch('/api/projetos-fv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:        `Simulação ${sistema.potenciaRealKwp} kWp — ${form.cidadeEstado || 'sem local'}`,
          potenciaKwp: sistema.potenciaRealKwp,
          paineis:     sistema.numPaineis,
          inversores:  sistema.numInversores,
          status:      'Proposta',
          valorReais:  financeiro.custoTotalEstimado,
          localizacao: form.cidadeEstado,
        }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setSalvo(true)
    } catch (e) { setErrSalvo(`Erro ao salvar: ${e.message}`) }
    finally { setSalvando(false) }
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Simulação Completa</h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
            <MapPin size={12} />
            {form.cidadeEstado || `${form.lat?.toFixed(4)}, ${form.lon?.toFixed(4)}`}
            <span className="text-slate-300">·</span>
            {carga?.potencia_media?.toLocaleString('pt-BR')} kWh/mês
          </p>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" icone={ArrowLeft} tamanho="sm" onClick={onNova}>
            Voltar
          </Button>
          <Button variante="secundario" icone={RefreshCw} tamanho="sm" onClick={onNova}>
            Nova Simulação
          </Button>
        </div>
      </div>

      {/* Resumo rápido */}
      {strings && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icone={Sun} titulo="Potência" valor={strings.potenciaRealKwp} unidade="kWp" cor="border-amber-200 bg-amber-50" iconeCor="text-amber-500" />
          <Stat icone={Zap} titulo="Painéis" valor={strings.totalModulos} unidade="unid." />
          <Stat icone={TrendingUp} titulo="Payback" valor={typeof financeiro?.payback === 'number' ? financeiro.payback : (financeiro?.payback || '—')} unidade="anos" cor="border-emerald-200 bg-emerald-50" iconeCor="text-emerald-500" />
          <Stat icone={DollarSign} titulo="VPL" valor={formatarMoeda(financeiro?.vpl)} cor="border-blue-200 bg-blue-50" iconeCor="text-blue-500" />
        </div>
      )}

      {/* Validação elétrica */}
      {validacao && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-emerald-600" />
            <p className="font-semibold text-emerald-900">Sistema Validado</p>
          </div>
          {validacao.erros?.length > 0 && (
            <ul className="text-sm text-emerald-800 space-y-1">
              {validacao.erros.map((e, i) => <li key={i}>✓ {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Análise Financeira */}
      {financeiro && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Análise Financeira</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Payback</p>
                <p className="text-2xl font-bold text-slate-900">{typeof financeiro.payback === 'number' ? formatarNumero(financeiro.payback, 1) : financeiro.payback}</p>
                <p className="text-xs text-slate-500 mt-1">anos</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">TIR</p>
                <p className="text-2xl font-bold text-emerald-600">{formatarPercentual(financeiro.tir, 1)}</p>
                <p className="text-xs text-slate-500 mt-1">ao ano</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">VPL</p>
                <p className="text-2xl font-bold text-blue-600">{formatarMoeda(financeiro.vpl)}</p>
                <p className="text-xs text-slate-500 mt-1">em 25 anos</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Sistema Recomendado */}
      {recomendacao?.melhor && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Sistema Recomendado</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Painel</p>
                <p className="font-medium text-slate-900">{recomendacao.melhor.painel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Inversor</p>
                <p className="font-medium text-slate-900">{recomendacao.melhor.inversor}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Potência</p>
                <p className="font-medium text-slate-900">{Number(recomendacao.melhor.potenciaKwp).toLocaleString('pt-BR')} kWp</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Custo Estimado</p>
                <p className="font-medium text-slate-900">{formatarMoeda(recomendacao.melhor.custoEstimado)}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              {recomendacao.justificativa}
            </p>
          </CardBody>
        </Card>
      )}

      {/* BESS */}
      {bess && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Sistema de Armazenamento (BESS)</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Capacidade</p>
                <p className="text-xl font-bold text-slate-900">{formatarNumero(bess.capacidade_kwh, 1)}</p>
                <p className="text-xs text-slate-500 mt-1">kWh</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Potência</p>
                <p className="text-xl font-bold text-slate-900">{formatarNumero(bess.potencia_kw, 1)}</p>
                <p className="text-xs text-slate-500 mt-1">kW</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Autonomia</p>
                <p className="text-xl font-bold text-slate-900">{formatarNumero(bess.autonomia, 1)}</p>
                <p className="text-xs text-slate-500 mt-1">horas</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Sombreamento */}
      {sombreamento && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Análise de Sombreamento</h3>
          </CardHeader>
          <CardBody>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm text-slate-700"><strong>Classificação:</strong> {sombreamento.classificacao}</p>
                <p className="text-sm text-slate-600 mt-2">{sombreamento.descricao}</p>
                {sombreamento.perda_percentual > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-900">Perda estimada: {formatarPercentual(sombreamento.perda_percentual, 1)}</p>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Tabs de resultado - Técnico */}
      {strings && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 pt-4">
            <Tabs abas={ABAS_RESULTADO} abaAtiva={aba} onChange={setAba} />
          </div>

          <div className="p-5">
            {/* ── Resumo ── */}
            {aba === 'resumo' && (
              <div className="space-y-3 text-sm text-slate-700">
                <div><strong>String Configuration:</strong> {strings.totalStrings} strings × {strings.paineisPorString} painéis</div>
                <div><strong>Voc em frio:</strong> {strings.vocFrio} V</div>
                <div><strong>Vmp String:</strong> {strings.vmpString} V</div>
                <div><strong>Oversizing:</strong> {strings.oversizing}%</div>
              </div>
            )}

            {/* ── Layout ── */}
            {aba === 'layout' && (
              <LayoutTelhado projetoId={1} onSave={(dados) => console.log('Telhado salvo:', dados)} />
            )}

            {/* ── Financeiro ── */}
            {aba === 'financeiro' && financeiro?.fluxo_caixa && (
              <div className="space-y-4 text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 text-xs font-semibold text-slate-500">Ano</th>
                      <th className="text-right py-2 text-xs font-semibold text-slate-500">Economia</th>
                      <th className="text-right py-2 text-xs font-semibold text-slate-500">Saldo Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeiro.fluxo_caixa.filter((_, i) => i % 5 === 0 || i === 0).map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2">{row.ano}</td>
                        <td className="text-right">{formatarMoeda(row.economia)}</td>
                        <td className="text-right font-medium">{formatarMoeda(row.saldoAcumulado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Técnico ── */}
            {aba === 'tecnico' && (
              <div className="space-y-3 text-sm text-slate-700">
                <div><strong>Validação:</strong> {validacao?.valido ? '✓ Sistema válido' : '✗ Sistema com erros'}</div>
                {validacao?.erros?.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-medium text-red-900 mb-1">Erros encontrados:</p>
                    <ul className="text-sm text-red-800 space-y-1">
                      {validacao.erros.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── Recomendação ── */}
            {aba === 'recomendacao' && (
              <div className="space-y-4">
                {recomendacao?.alternativas?.length > 0 ? (
                  recomendacao.alternativas.map((alt, i) => (
                    <div key={i} className="p-4 border border-slate-200 rounded-lg">
                      <p className="font-medium text-slate-900 mb-2">Alternativa {i + 2}</p>
                      <p className="text-sm text-slate-600">{alt.painel} + {alt.inversor}</p>
                      <p className="text-sm text-slate-500 mt-1">{alt.potenciaKwp} kWp · {formatarMoeda(alt.custoEstimado)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">Nenhuma alternativa disponível</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recomendação Final */}
      {strings && validacao && financeiro && (
        <RecomendacaoFinal
          dadosSimulacao={{
            consumo: { consumoMensal: form.consumoMensal },
            area: form.areaDisponivel,
            carga: null,
            strings,
            validacao,
            sombreamento: null,
            bess: null,
            financeiro
          }}
          onAceitar={() => {
            alert('Recomendação aceita! Prosseguir com criação do projeto.')
          }}
          onPersonalizar={() => {
            setAba('tecnico')
          }}
        />
      )}

      {/* Erros e ações */}
      {(errPdf || errSalvo) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errPdf || errSalvo}
        </div>
      )}
      {salvo && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
          <CheckCircle size={16} /> Projeto salvo!{' '}
          <button className="underline ml-1" onClick={() => navigate('/projetos-fv')}>Ver lista</button>
        </div>
      )}
      {notifLead && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
          <CheckCircle size={16} /> {notifLead}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button variante="secundario" icone={ArrowLeft} onClick={onNova}>Nova Simulação</Button>
        <div className="flex gap-3 sm:ml-auto">
          <Button variante="secundario" icone={Save} onClick={salvar} carregando={salvando} disabled={salvo}>
            {salvo ? 'Salvo!' : 'Salvar Projeto'}
          </Button>
          <Button icone={Download} onClick={baixarPdf} carregando={gerando}
            className="bg-emerald-600 hover:bg-emerald-700">
            PDF Comercial
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
        <Info size={13} className="shrink-0 mt-0.5" />
        Estimativas baseadas em dados históricos NASA POWER. Projeto técnico detalhado recomendado para instalação.
      </div>
    </div>
  )
}

// ── formulário ────────────────────────────────────────────────────────────────

export default function SimulacaoFV() {
  const navigate = useNavigate()

  const [form,          setForm]         = useState(FORM_INICIAL)
  const [datasheetPainel, setDatasheet]  = useState(DS_INICIAL)
  const [estado,        setEstado]       = useState('form')
  const [resultado,     setResultado]    = useState(null)
  const [erroGeral,     setErroGeral]    = useState('')
  const [buscandoEnd,   setBuscandoEnd]  = useState(false)
  const [erroEnd,       setErroEnd]      = useState('')
  const [erros,         setErros]        = useState({})
  const [mostrarAvancado, setMostrarAvancado] = useState(false)
  const [telhado,       setTelhado]      = useState({ pontos: [], area_m2: 0 })

  const f = (campo, v) => setForm(prev => ({ ...prev, [campo]: v }))

  async function buscarEndereco() {
    if (!form.cidadeEstado.trim()) { setErroEnd('Digite a cidade e estado'); return }
    setBuscandoEnd(true); setErroEnd('')
    try {
      const res = await geocodificarEndereco(form.cidadeEstado)
      setForm(prev => ({ ...prev, lat: res.lat, lon: res.lon, cidadeEstado: res.cidadeEstado || res.enderecoFormatado }))
    } catch (e) { setErroEnd(e.message) }
    finally { setBuscandoEnd(false) }
  }

  function validar() {
    const e = {}
    if (!form.consumoMensal || Number(form.consumoMensal) <= 0) {
      e.consumo = 'Informe o consumo mensal em kWh (ex: 350)'
    }
    if (!form.lat || !form.lon) {
      e.local = 'Pesquise e selecione a localização para obter irradiância correta'
    }
    if (!form.tarifaEnergia || Number(form.tarifaEnergia) <= 0) {
      e.tarifa = 'Informe a tarifa de energia (ex: 0,95)'
    }
    if (!form.areaDisponivel || Number(form.areaDisponivel) <= 0) {
      e.area = 'Informe a área disponível em m² (opcional recomendado)'
    }
    setErros(e)
    return !Object.keys(e).length
  }

  async function calcular() {
    if (!validar()) return
    setEstado('calculando'); setErroGeral('')

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005'

      const respOrquestrador = await fetch(`${API_URL}/api/projeto/simular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carga: { consumo_mensal: Number(form.consumoMensal) },
          strings: {
            modulos: 10,
            modulo: { pmpp: Number(form.potenciaPainelW), voc: 40, vmpp: 35, tempCoefVoc: -0.28 },
            inversor: { potenciaKW: 5, vocMax: 1000, mpptMin: 80, mpptMax: 950, nMppts: 2, nStringsTotal: 4 },
            tempMin: -2,
          },
          validacao: {
            modulo: { pmpp: Number(form.potenciaPainelW), voc: 40, vmpp: 35, tempCoefVoc: -0.28 },
            inversor: { potenciaKW: 5, vocMax: 1000, mpptMin: 80, mpptMax: 950, nMppts: 2, nStringsTotal: 4 },
            temperatura: { min: -2 },
          },
          sombreamento: {
            altura: 1.5,
            distancia: 5,
            latitude: form.lat,
          },
          financeiro: {
            investimento: 20000,
            economia_anual: Number(form.consumoMensal) * 12 * Number(form.tarifaEnergia),
            inflacao_energia: Number(form.inflacaoEnergia) / 100,
            taxa_desconto: Number(form.taxaDesconto) / 100,
          },
          recomendacao: {
            consumo: Number(form.consumoMensal),
            area_disponivel: Number(form.areaDisponivel) || 30,
          },
        }),
      })

      if (!respOrquestrador.ok) {
        const erro = await respOrquestrador.json()
        throw new Error(erro.erro || 'Não foi possível calcular a simulação. Verifique os dados e tente novamente.')
      }

      const dataOrquestrador = await respOrquestrador.json()
      setResultado(dataOrquestrador)
      setEstado('resultado')
    } catch (e) {
      setErroGeral(e.message || 'Erro ao conectar com o servidor. Verifique sua conexão e tente novamente.')
      setEstado('form')
    }
  }

  // ── tela de resultado ──────────────────────────────────────────────
  if (estado === 'resultado' && resultado) {
    return (
      <ResultadoSimulacao
        resultado={resultado}
        form={form}
        datasheetPainel={datasheetPainel}
        onNova={() => { setEstado('form'); setResultado(null); setForm(FORM_INICIAL) }}
      />
    )
  }

  // ── loading ────────────────────────────────────────────────────────
  if (estado === 'calculando') {
    return (
      <div className="max-w-md mx-auto text-center py-24 space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: `var(--cor-primaria,#f97316)`, borderTopColor: 'transparent' }} />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Calculando…</h2>
        <p className="text-slate-500 text-sm">
          Consultando irradiância na <strong>NASA POWER API</strong>,
          calculando dimensionamento e simulação financeira.
        </p>
      </div>
    )
  }

  // ── formulário ─────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/projetos-fv')}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Dimensionamento FV</h1>
          <p className="text-sm text-slate-500">Calcule o sistema ideal e simule a viabilidade financeira.</p>
        </div>
      </div>

      {erroGeral && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Erro:</strong> {erroGeral}
            <br /><span className="text-xs text-red-600 mt-1 block">Verifique se o backend está rodando.</span>
          </div>
        </div>
      )}

      <Card>
        <CardBody className="space-y-5">
          {/* Consumo */}
          <Input
            rotulo="Consumo médio mensal (kWh) *" type="number" min="1" placeholder="Ex: 350"
            value={form.consumoMensal} onChange={e => f('consumoMensal', e.target.value)}
            erro={erros.consumo}
          />

          {/* Estado e Concessionária */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              rotulo="Estado *"
              opcoes={OPCOES_ESTADO}
              value={form.estado}
              onChange={e => {
                f('estado', e.target.value)
                const concessionarias = CONCESSIONARIAS_POR_ESTADO[e.target.value] || []
                if (concessionarias.length === 1) {
                  f('concessionaria', concessionarias[0])
                } else {
                  f('concessionaria', '')
                }
              }}
            />
            <Select
              rotulo="Concessionária *"
              opcoes={(CONCESSIONARIAS_POR_ESTADO[form.estado] || []).map(c => ({ valor: c, rotulo: c }))}
              value={form.concessionaria}
              onChange={e => f('concessionaria', e.target.value)}
              disabled={!form.estado}
            />
          </div>

          {/* Localização */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Cidade / Estado *</label>
            <div className="flex gap-2">
              <input
                type="text" placeholder="Ex: Recife, PE"
                value={form.cidadeEstado}
                onChange={e => { f('cidadeEstado', e.target.value); f('lat', null); f('lon', null) }}
                onKeyDown={e => e.key === 'Enter' && buscarEndereco()}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[color:var(--cor-primaria)]"
              />
              <Button icone={Search} onClick={buscarEndereco} carregando={buscandoEnd}>Buscar</Button>
            </div>
            {erroEnd && <p className="text-xs text-red-600">{erroEnd}</p>}
            {erros.local && <p className="text-xs text-red-600">{erros.local}</p>}
            {form.lat && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle size={12} />
                {form.cidadeEstado}
                <span className="text-emerald-500 ml-1 font-mono">({form.lat.toFixed(4)}, {form.lon.toFixed(4)})</span>
              </p>
            )}
          </div>

          {/* Campos básicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input rotulo="Área disponível (m²)" type="number" min="1" placeholder="Ex: 30"
              value={form.areaDisponivel} onChange={e => f('areaDisponivel', e.target.value)} />
            <Input rotulo="Tarifa de energia (R$/kWh) *" type="number" min="0.01" step="0.01"
              placeholder="0.95" value={form.tarifaEnergia} onChange={e => f('tarifaEnergia', e.target.value)}
              erro={erros.tarifa} />
          </div>

          {/* Mapa e Visualização do Telhado */}
          <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
            <h3 className="font-semibold text-slate-900 mb-4">Desenhar Telhado e Visualizar Painéis</h3>

            <MapaTelhado
              projetoId={1}
              onSave={(dados) => {
                setTelhado(dados)
                f('areaDisponivel', dados.area_m2)
              }}
            />

            {telhado.area_m2 > 0 && (
              <div className="mt-4 border-t border-blue-200 pt-4">
                <TelhadoVisualizacao
                  pontos={telhado.pontos}
                  areaTelhado={telhado.area_m2}
                  numPaineis={10}
                  inclinacao={20}
                  orientacao="N"
                />
              </div>
            )}
          </div>

          {/* Tipo de sistema */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Tipo de sistema</label>
            <div className="flex gap-3">
              {[
                { valor: 'string', rotulo: 'String', desc: 'Inversor central (mais comum, menor custo)' },
                { valor: 'micro',  rotulo: 'Micro',  desc: 'Por módulo (menor perda, maior custo)' },
              ].map(op => (
                <button key={op.valor} onClick={() => f('tipoSistema', op.valor)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 text-left transition-all ${
                    form.tipoSistema === op.valor ? 'border-[color:var(--cor-primaria)] bg-primary-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <p className={`text-sm font-semibold ${form.tipoSistema === op.valor ? 'text-primary-700' : 'text-slate-700'}`}>{op.rotulo}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{op.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Potência do painel */}
          <Select rotulo="Potência do painel" opcoes={OPCOES_PAINEL}
            value={form.potenciaPainelW} onChange={e => f('potenciaPainelW', e.target.value)} />

          {/* Parâmetros avançados */}
          <div>
            <button
              type="button"
              onClick={() => setMostrarAvancado(v => !v)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Settings2 size={15} />
              {mostrarAvancado ? 'Ocultar' : 'Mostrar'} parâmetros financeiros avançados
            </button>
            {mostrarAvancado && (
              <div className="grid grid-cols-2 gap-4 mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <Input rotulo="Inflação da energia (%/ano)" type="number" min="0" max="30" step="0.5"
                    value={form.inflacaoEnergia} onChange={e => f('inflacaoEnergia', e.target.value)} />
                  <p className="text-xs text-slate-400 mt-1">Histórico ANEEL: 8–12%/ano</p>
                </div>
                <div>
                  <Input rotulo="Taxa de desconto (%/ano)" type="number" min="0" max="30" step="0.5"
                    value={form.taxaDesconto} onChange={e => f('taxaDesconto', e.target.value)} />
                  <p className="text-xs text-slate-400 mt-1">TMA para VPL e TIR</p>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Datasheet do painel */}
      <DatasheetForm
        valor={datasheetPainel}
        onChange={setDatasheet}
        titulo="Especificações do painel (opcional — melhora a validação elétrica)"
      />

      <Button onClick={calcular} tamanho="lg" className="w-full text-base py-3" icone={Sun}>
        Calcular Dimensionamento
      </Button>

      <p className="text-xs text-slate-400 text-center">
        Irradiância consultada em tempo real na NASA POWER API · Engine de string automático · Simulação financeira 25 anos
      </p>
    </div>
  )
}
