import { useState, useEffect, useCallback } from 'react'
import { User, MapPin, Zap, Plug, Building2, Copy, Check } from 'lucide-react'
import { SecaoDados } from './CampoCopiavel'
import { obterEquipamentosEngenharia } from '../../../utils/engenhariaGovernanca'

const API_URL = '' /* URL relativa forçada — Vercel proxy → Railway */

const STATUS_S9_LABEL = {
  nao_iniciado: 'Não iniciado',
  em_preparacao: 'Em preparação',
  pendente_documentacao: 'Pendente documentação',
  pendente_engenharia: 'Pendente engenharia',
  pendente_concessionaria: 'Pendente concessionária',
  homologado: 'Homologado',
  reprovado: 'Reprovado',
}
const STATUS_LEGADO_LABEL = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  analise: 'Em Análise',
  aprovado: 'Aprovado',
  conectado: 'Conectado à Rede',
}

const TIPO_LIGACAO_LABEL = {
  monofasico: 'Monofásico',
  bifasico: 'Bifásico',
  trifasico: 'Trifásico',
}

// Normaliza um equipamento (snapshot ou catálogo vivo) para { fabricante, modelo, potencia, quantidade }
function normEquip(eq) {
  if (!eq) return null
  const esp = eq.especificacoes || {}
  return {
    fabricante: eq.fabricante || eq.marca || null,
    modelo: eq.modelo || null,
    potencia: esp.potencia ?? eq.potenciaW ?? eq.potencia_w ?? eq.potencia ?? eq.potencia_kw ?? null,
    quantidade: eq.quantidade ?? null,
  }
}

export default function CentralDados({ projeto, cliente }) {
  const projetoId = projeto?._id
  const [beneficiarias, setBeneficiarias] = useState([])
  const [copiadoTudo, setCopiadoTudo] = useState(false)

  const carregarBeneficiarias = useCallback(async () => {
    if (!projetoId) return
    try {
      const r = await fetch(`${API_URL}/api/projetos-fv/${projetoId}/beneficiarias/resumo`)
      const d = await r.json()
      setBeneficiarias(d.beneficiarias || [])
    } catch { /* offline ok */ }
  }, [projetoId])

  useEffect(() => { carregarBeneficiarias() }, [carregarBeneficiarias])

  const loc = projeto?.localizacao || {}
  const dim = projeto?.dimensionamento || {}
  const homol = projeto?.homologacao || {}

  const eng = obterEquipamentosEngenharia(projeto)
  const inv = normEquip(eng.inversor)
  const potInversores = inv?.potencia != null && inv?.quantidade != null
    ? `${inv.potencia} × ${inv.quantidade}`
    : (inv?.potencia != null ? `${inv.potencia}` : null)

  const concessionaria = homol.concessionaria || projeto?.concessionaria
    || beneficiarias.find((b) => b.concessionaria)?.concessionaria || null
  const cidade = loc.cidade || projeto?.cidade || null
  const estado = loc.estado || projeto?.estado || null
  const potenciaKwp = dim.potencia_kwp ?? projeto?.potencia_kwp ?? dim.potenciaArredondada ?? null
  const tipoLigacaoRaw = projeto?.tipo_ligacao || projeto?.consumoEnergetico?.tipoLigacao || null
  const tipoLigacao = tipoLigacaoRaw ? (TIPO_LIGACAO_LABEL[tipoLigacaoRaw] || tipoLigacaoRaw) : null
  const statusAtual = homol.status_homologacao
    ? STATUS_S9_LABEL[homol.status_homologacao]
    : (homol.status ? STATUS_LEGADO_LABEL[homol.status] : null)

  const cpfCnpj = cliente?.cpf_cnpj || cliente?.cnpj || cliente?.cpf
    || beneficiarias.find((b) => b.cpf_cnpj)?.cpf_cnpj || null
  const ucs = beneficiarias.map((b) => b.contaContrato).filter(Boolean)

  const secaoCliente = [
    { rotulo: 'Cliente', valor: cliente?.nome || projeto?.nome },
    { rotulo: 'CPF/CNPJ', valor: cpfCnpj },
    { rotulo: 'UC / Conta Contrato', valor: ucs.length ? ucs.join(', ') : null },
  ]
  const secaoConcessionaria = [
    { rotulo: 'Concessionária', valor: concessionaria },
    { rotulo: 'Status Atual', valor: statusAtual },
    { rotulo: 'Protocolo', valor: homol.numero_protocolo },
  ]
  const secaoLocalizacao = [
    { rotulo: 'Município', valor: cidade },
    { rotulo: 'Estado', valor: estado },
    { rotulo: 'Latitude', valor: loc.latitude },
    { rotulo: 'Longitude', valor: loc.longitude },
    { rotulo: 'Endereço', valor: loc.endereco_completo },
  ]
  const secaoSistema = [
    { rotulo: 'Potência Instalada (kWp)', valor: potenciaKwp },
    { rotulo: 'Potência Inversores (kW × qtd)', valor: potInversores },
    { rotulo: 'Tipo de Conexão', valor: tipoLigacao },
  ]

  const todasSecoes = [
    ['CLIENTE', secaoCliente],
    ['CONCESSIONÁRIA', secaoConcessionaria],
    ['LOCALIZAÇÃO', secaoLocalizacao],
    ['SISTEMA FV', secaoSistema],
  ]

  function copiarTudo() {
    const blocos = todasSecoes.map(([titulo, campos]) => {
      const linhas = campos
        .filter((c) => c.valor != null && c.valor !== '')
        .map((c) => `${c.rotulo}: ${c.valor}`)
      return linhas.length ? `${titulo}\n${linhas.join('\n')}` : null
    }).filter(Boolean)
    if (!blocos.length) return
    navigator.clipboard?.writeText(blocos.join('\n\n'))
    setCopiadoTudo(true)
    setTimeout(() => setCopiadoTudo(false), 1500)
  }

  const temCoord = loc.latitude != null && loc.longitude != null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-600">
          Dados consolidados para preenchimento manual do portal da concessionária.
        </p>
        <button
          onClick={copiarTudo}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium"
        >
          {copiadoTudo ? <Check size={15} /> : <Copy size={15} />}
          {copiadoTudo ? 'Copiado!' : 'Copiar tudo'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SecaoDados titulo="Cliente" icone={User} campos={secaoCliente} />
        <SecaoDados titulo="Concessionária" icone={Building2} campos={secaoConcessionaria} />
        <div className="space-y-2">
          <SecaoDados titulo="Localização" icone={MapPin} campos={secaoLocalizacao} />
          {temCoord && (
            <a
              href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline px-1"
            >
              <MapPin size={13} /> Abrir no Google Maps
            </a>
          )}
        </div>
        <SecaoDados titulo="Sistema FV" icone={Zap} campos={secaoSistema} />
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <Plug size={14} className="mt-0.5 shrink-0" />
        <span>
          As UCs e o rateio detalhado ficam na aba <strong>Beneficiárias</strong>. Os equipamentos
          completos estão na aba <strong>Equipamentos</strong>.
        </span>
      </div>
    </div>
  )
}
