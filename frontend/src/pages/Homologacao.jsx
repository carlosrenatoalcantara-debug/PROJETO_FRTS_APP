import { useState, useEffect } from 'react'
import { ClipboardList, FileText, Mail, Award, CheckSquare, ChevronDown } from 'lucide-react'
import Tabs from '../components/ui/Tabs'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import MemorialCalculo      from '../components/homologacao/MemorialCalculo'
import CartaConcessionaria  from '../components/homologacao/CartaConcessionaria'
import DadosART             from '../components/homologacao/DadosART'
import ChecklistDocumentos  from '../components/homologacao/ChecklistDocumentos'
import { useEmpresa }       from '../contexts/EmpresaContext'
import { UFS_ORDENADAS }    from '../data/regioesBrasil'

const ABAS = [
  { id: 'memorial',   rotulo: 'Memorial',    icone: FileText    },
  { id: 'carta',      rotulo: 'Carta',        icone: Mail        },
  { id: 'art',        rotulo: 'Dados ART',    icone: Award       },
  { id: 'checklist',  rotulo: 'Checklist',    icone: CheckSquare },
]

const TIPOS_LIGACAO = [
  { valor: 'monofasico', rotulo: 'Monofásico' },
  { valor: 'bifasico',   rotulo: 'Bifásico'   },
  { valor: 'trifasico',  rotulo: 'Trifásico'  },
]
const TENSOES = [
  { valor: '127', rotulo: '127 V' },
  { valor: '220', rotulo: '220 V' },
  { valor: '380', rotulo: '380 V' },
]

export default function Homologacao() {
  const { empresa } = useEmpresa()
  const [aba,   setAba]   = useState('memorial')
  const [proj,  setProj]  = useState([])
  const [projSel, setProjSel] = useState(null)
  const [expandForm, setExpandForm] = useState(true)

  // Formulário de dados do projeto
  const [form, setForm] = useState({
    // Projeto
    nome: '', numeroUC: '', valorReais: '',
    // Cliente
    clienteNome: '', clienteCPF: '', clienteTipoPessoa: 'PF',
    // Localização
    locEndereco: '', locCidadeEstado: '', locCEP: '', locLat: '', locLon: '',
    // Consumo
    consumoMensal: '', concessionaria: '', tipoLigacao: 'monofasico', tensao: '220',
    // Irradiância
    irradianciaMedia: '',
    // Dimensionamento
    potenciaRealKwp: '', numPaineis: '', numInversores: '', areaMinima: '', areaDisponivel: '',
    potenciaPainelW: '550', capacidadeInversorKW: '5',
    // Equipamentos
    painelMarca: '', painelModelo: '', inversorMarca: '', inversorModelo: '',
    estruturaTipo: '', orientacao: 'Norte', inclinacao: '15',
  })

  function f(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  // Busca projetos salvos
  useEffect(() => {
    fetch('/api/projetos-fv')
      .then(r => r.json())
      .then(setProjSel)
      .catch(() => {})
  }, [])

  function aplicarProjeto(p) {
    if (!p) return
    setForm(prev => ({
      ...prev,
      nome:           p.nome ?? '',
      potenciaRealKwp:p.potenciaKwp ?? '',
      numPaineis:     p.paineis ?? '',
      numInversores:  p.inversores ?? '',
      valorReais:     p.valorReais ?? '',
      locCidadeEstado:p.localizacao ?? '',
    }))
    setExpandForm(true)
  }

  // Monta objeto de dados para os templates
  const dados = {
    empresa,
    projeto: {
      nome:       form.nome,
      numeroUC:   form.numeroUC,
      valorReais: Number(form.valorReais),
      equipamentos: {
        painel:    form.painelMarca  ? { marca: form.painelMarca,  modelo: form.painelModelo,  potenciaW: Number(form.potenciaPainelW) } : null,
        inversor:  form.inversorMarca? { marca: form.inversorMarca, modelo: form.inversorModelo, potenciaKW: Number(form.capacidadeInversorKW) } : null,
        estrutura: form.estruturaTipo? { tipo: form.estruturaTipo } : null,
      },
    },
    cliente: {
      nome:        form.clienteNome,
      cpf:         form.clienteCPF,
      tipoPessoa:  form.clienteTipoPessoa,
    },
    localizacao: {
      endereco:     form.locEndereco,
      cidadeEstado: form.locCidadeEstado,
      cep:          form.locCEP,
      lat:          form.locLat ? Number(form.locLat) : null,
      lon:          form.locLon ? Number(form.locLon) : null,
    },
    consumo: {
      consumoMensal:   Number(form.consumoMensal),
      concessionaria:  form.concessionaria,
      tipoLigacao:     form.tipoLigacao,
      tensao:          form.tensao,
    },
    irradiancia: {
      mediaAnual: form.irradianciaMedia ? Number(form.irradianciaMedia) : null,
      mensal: null,
    },
    dimensionamento: {
      potenciaRealKwp:  Number(form.potenciaRealKwp),
      potenciaKwp:      Number(form.potenciaRealKwp),
      numPaineis:       Number(form.numPaineis),
      numInversores:    Number(form.numInversores),
      areaMinima:       Number(form.areaMinima),
      energiaDiaria:    form.consumoMensal ? (Number(form.consumoMensal) / 30).toFixed(2) : null,
      energiaNecessaria:form.consumoMensal ? (Number(form.consumoMensal) / 30 / 0.8).toFixed(2) : null,
      potenciaPainelW:  Number(form.potenciaPainelW),
      capacidadeInversorKW: Number(form.capacidadeInversorKW),
    },
    area: {
      areaDisponivel: form.areaDisponivel,
      orientacao:     form.orientacao,
      inclinacao:     form.inclinacao,
    },
    equipamentos: {
      painel:    form.painelMarca  ? { marca: form.painelMarca,  modelo: form.painelModelo,  potenciaW: Number(form.potenciaPainelW) } : null,
      inversor:  form.inversorMarca? { marca: form.inversorMarca, modelo: form.inversorModelo, potenciaKW: Number(form.capacidadeInversorKW) } : null,
      estrutura: form.estruturaTipo? { tipo: form.estruturaTipo } : null,
    },
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100">
          <ClipboardList size={20} className="text-blue-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Homologação</h1>
          <p className="text-sm text-slate-500">Documentos para conexão à rede · Lei 14.300/2022</p>
        </div>
      </div>

      {/* Seletor de projeto salvo */}
      {Array.isArray(proj) && proj.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm text-slate-700 shrink-0">Carregar projeto salvo:</span>
          <select
            onChange={e => aplicarProjeto(proj.find(p => String(p.id) === e.target.value))}
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">Selecione um projeto...</option>
            {proj.map(p => (
              <option key={p.id} value={p.id}>{p.nome} — {p.status}</option>
            ))}
          </select>
        </div>
      )}

      {/* Formulário de dados */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpandForm(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
        >
          <span className="font-semibold text-slate-900">Dados do Projeto</span>
          <ChevronDown size={18} className={`text-slate-400 transition-transform ${expandForm ? 'rotate-180' : ''}`} />
        </button>

        {expandForm && (
          <div className="px-6 pb-6 space-y-5 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
              <Input rotulo="Nome do projeto"  value={form.nome}      onChange={e => f('nome', e.target.value)}      placeholder="Ex: Residência Silva" />
              <Input rotulo="Número da UC"     value={form.numeroUC}  onChange={e => f('numeroUC', e.target.value)}  placeholder="Nº da unidade consumidora" />
              <Input rotulo="Valor total (R$)" value={form.valorReais} onChange={e => f('valorReais', e.target.value)} type="number" placeholder="0" />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Cliente</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input rotulo="Nome completo"     value={form.clienteNome} onChange={e => f('clienteNome', e.target.value)} />
                <Input rotulo="CPF / CNPJ"        value={form.clienteCPF}  onChange={e => f('clienteCPF',  e.target.value)} />
                <Select rotulo="Tipo" opcoes={[{valor:'PF',rotulo:'Pessoa Física'},{valor:'PJ',rotulo:'Pessoa Jurídica'}]}
                  value={form.clienteTipoPessoa} onChange={e => f('clienteTipoPessoa', e.target.value)} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Localização</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input rotulo="Endereço completo" value={form.locEndereco}     onChange={e => f('locEndereco', e.target.value)}    className="sm:col-span-2" />
                <Input rotulo="Cidade - UF"       value={form.locCidadeEstado} onChange={e => f('locCidadeEstado', e.target.value)} />
                <Input rotulo="CEP"               value={form.locCEP}          onChange={e => f('locCEP', e.target.value)}          />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Consumo e Rede</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input   rotulo="Consumo mensal (kWh)" type="number" value={form.consumoMensal}  onChange={e => f('consumoMensal', e.target.value)} />
                <Input   rotulo="Concessionária"       value={form.concessionaria}               onChange={e => f('concessionaria', e.target.value)} />
                <Select  rotulo="Tipo de ligação"      opcoes={TIPOS_LIGACAO}  value={form.tipoLigacao} onChange={e => f('tipoLigacao', e.target.value)} />
                <Select  rotulo="Tensão"               opcoes={TENSOES}        value={form.tensao}      onChange={e => f('tensao', e.target.value)} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Dimensionamento</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <Input rotulo="Potência (kWp)"    type="number" value={form.potenciaRealKwp}   onChange={e => f('potenciaRealKwp', e.target.value)} />
                <Input rotulo="Nº painéis"        type="number" value={form.numPaineis}         onChange={e => f('numPaineis', e.target.value)} />
                <Input rotulo="Nº inversores"     type="number" value={form.numInversores}      onChange={e => f('numInversores', e.target.value)} />
                <Input rotulo="Irradiância média" type="number" value={form.irradianciaMedia}   onChange={e => f('irradianciaMedia', e.target.value)} placeholder="kWh/m²/dia" />
                <Input rotulo="Área necessária m²" type="number" value={form.areaMinima}        onChange={e => f('areaMinima', e.target.value)} />
                <Input rotulo="Área disponível m²" type="number" value={form.areaDisponivel}    onChange={e => f('areaDisponivel', e.target.value)} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Equipamentos</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <Input rotulo="Painel - Marca"    value={form.painelMarca}    onChange={e => f('painelMarca', e.target.value)} />
                <Input rotulo="Painel - Modelo"   value={form.painelModelo}   onChange={e => f('painelModelo', e.target.value)} />
                <Input rotulo="Painel - Pot. (W)" type="number" value={form.potenciaPainelW} onChange={e => f('potenciaPainelW', e.target.value)} />
                <Input rotulo="Inversor - Marca"  value={form.inversorMarca}  onChange={e => f('inversorMarca', e.target.value)} />
                <Input rotulo="Inversor - Modelo" value={form.inversorModelo} onChange={e => f('inversorModelo', e.target.value)} />
                <Input rotulo="Inv. Cap. (kW)"    type="number" value={form.capacidadeInversorKW} onChange={e => f('capacidadeInversorKW', e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs dos documentos */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 pt-4">
          <Tabs abas={ABAS} abaAtiva={aba} onChange={setAba} />
        </div>
        <div className="p-6">
          {aba === 'memorial'  && <MemorialCalculo     dados={dados} />}
          {aba === 'carta'     && <CartaConcessionaria dados={dados} />}
          {aba === 'art'       && <DadosART            dados={dados} />}
          {aba === 'checklist' && <ChecklistDocumentos dados={dados} concessionariaInicial={form.concessionaria || 'Genérico'} projetoId={form.nome || 'novo'} />}
        </div>
      </div>
    </div>
  )
}
