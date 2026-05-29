import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Check, ExternalLink, ToggleLeft, ToggleRight, Lock, AlertCircle, Loader, Eye, EyeOff, Trash2, Plus, DollarSign } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { useEmpresa, PADRAO_EMPRESA } from '../contexts/EmpresaContext'
import ConfiguracaoGestao from '../components/config/ConfiguracaoGestao'

const API_INTEGRATIONS = [
  {
    id: 'GoogleMaps',
    nome: 'Google Maps',
    descricao: 'Mapa de localização e desenho de telhado',
    docs: 'https://console.cloud.google.com',
    placeholder: 'AIzaSy...',
    categoria: 'Mapas',
    obrigatoria: true,
  },
  {
    id: 'GeminiVision',
    nome: 'Google Gemini',
    descricao: 'IA para análise técnica e respostas de perguntas',
    docs: 'https://ai.google.dev',
    placeholder: 'AIzaSy...',
    categoria: 'Inteligência Artificial',
  },
  {
    id: 'OpenAI',
    nome: 'OpenAI GPT',
    descricao: 'IA avançada para análise de projetos e conferência de dados',
    docs: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
    categoria: 'Inteligência Artificial',
  },
  {
    id: 'Claude',
    nome: 'Anthropic Claude',
    descricao: 'IA para análise técnica e processamento de documentos',
    docs: 'https://console.anthropic.com',
    placeholder: 'sk-ant-...',
    categoria: 'Inteligência Artificial',
  },
]

// ─── S7.1: leitura de arquivo → base64 ─────────────────────────────────────────
function lerArquivoBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// ─── S7.1: Configuração institucional (Empresa + RT + Identidade Visual) ───────
function ConfiguracaoEmpresa() {
  const { empresa, salvarEmpresa, salvarRT, salvarBranding, salvarUploads } = useEmpresa()
  const [form, setForm] = useState({
    razaoSocial: empresa.razaoSocial || '', nomeFantasia: empresa.nomeFantasia || empresa.nomeEmpresa || '',
    cnpj: empresa.cnpj || '', ie: empresa.ie || '', endereco: empresa.endereco || '',
    cidade: empresa.cidade || '', estado: empresa.estado || '', cep: empresa.cep || '',
    telefone: empresa.telefone || '', whatsapp: empresa.whatsapp || '', email: empresa.email || '', site: empresa.site || '',
  })
  const [rt, setRt] = useState({ ...PADRAO_EMPRESA.responsavelTecnico, ...empresa.responsavelTecnico })
  const [salvo, setSalvo] = useState('')

  const up = { ...PADRAO_EMPRESA.uploads, ...empresa.uploads }

  function setF(k, v) { setForm(p => ({ ...p, [k]: v })) }
  function setR(k, v) { setRt(p => ({ ...p, [k]: v })) }
  function flash(msg) { setSalvo(msg); setTimeout(() => setSalvo(''), 2500) }

  function salvarTudo(e) {
    e.preventDefault()
    salvarEmpresa(form)
    salvarRT(rt)
    flash('Dados institucionais salvos!')
  }

  async function onUpload(campo, file) {
    if (!file) return
    const dados = await lerArquivoBase64(file)
    if (campo === 'logo' || campo === 'logoReduzida') salvarBranding({ [campo]: dados })
    else if (campo === 'documentos') {
      salvarUploads({ documentos: [...(up.documentos || []), { nome: file.name, dados }] })
    } else salvarUploads({ [campo]: dados })
    flash('Arquivo carregado!')
  }

  const inp = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
  const lab = 'text-sm font-medium text-slate-700 block mb-1'

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <DollarSign size={18} className="text-blue-600" />
        <h3 className="font-semibold text-slate-900">Empresa & Responsável Técnico (S7.1)</h3>
      </CardHeader>
      <CardBody>
        <form onSubmit={salvarTudo} className="space-y-5">
          {/* Empresa */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Dados da Empresa</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lab}>Razão Social</label><input className={inp} value={form.razaoSocial} onChange={e => setF('razaoSocial', e.target.value)} /></div>
              <div><label className={lab}>Nome Fantasia</label><input className={inp} value={form.nomeFantasia} onChange={e => setF('nomeFantasia', e.target.value)} /></div>
              <div><label className={lab}>CNPJ</label><input className={inp} value={form.cnpj} onChange={e => setF('cnpj', e.target.value)} /></div>
              <div><label className={lab}>Inscrição Estadual</label><input className={inp} value={form.ie} onChange={e => setF('ie', e.target.value)} /></div>
              <div className="sm:col-span-2"><label className={lab}>Endereço</label><input className={inp} value={form.endereco} onChange={e => setF('endereco', e.target.value)} /></div>
              <div><label className={lab}>Cidade</label><input className={inp} value={form.cidade} onChange={e => setF('cidade', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lab}>UF</label><input className={inp} maxLength={2} value={form.estado} onChange={e => setF('estado', e.target.value.toUpperCase())} /></div>
                <div><label className={lab}>CEP</label><input className={inp} value={form.cep} onChange={e => setF('cep', e.target.value)} /></div>
              </div>
              <div><label className={lab}>Telefone</label><input className={inp} value={form.telefone} onChange={e => setF('telefone', e.target.value)} /></div>
              <div><label className={lab}>WhatsApp</label><input className={inp} value={form.whatsapp} onChange={e => setF('whatsapp', e.target.value)} /></div>
              <div><label className={lab}>Email</label><input className={inp} type="email" value={form.email} onChange={e => setF('email', e.target.value)} /></div>
              <div><label className={lab}>Website</label><input className={inp} value={form.site} onChange={e => setF('site', e.target.value)} /></div>
            </div>
          </div>

          {/* Responsável Técnico */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700 mb-2">Responsável Técnico</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lab}>Nome</label><input className={inp} value={rt.nome} onChange={e => setR('nome', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lab}>Registro</label><input className={inp} value={rt.tipoRegistro} onChange={e => setR('tipoRegistro', e.target.value)} placeholder="CREA/CFT" /></div>
                <div><label className={lab}>Nº</label><input className={inp} value={rt.registro} onChange={e => setR('registro', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lab}>UF do registro</label><input className={inp} maxLength={2} value={rt.uf} onChange={e => setR('uf', e.target.value.toUpperCase())} /></div>
                <div><label className={lab}>Modalidade</label><input className={inp} value={rt.modalidade} onChange={e => setR('modalidade', e.target.value)} placeholder="Eletrotécnica" /></div>
              </div>
              <div><label className={lab}>Cargo</label><input className={inp} value={rt.cargo} onChange={e => setR('cargo', e.target.value)} /></div>
              <div><label className={lab}>Telefone</label><input className={inp} value={rt.telefone} onChange={e => setR('telefone', e.target.value)} /></div>
              <div><label className={lab}>Email</label><input className={inp} type="email" value={rt.email} onChange={e => setR('email', e.target.value)} /></div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"><Save size={16} /> Salvar dados</button>
            {salvo && <span className="flex items-center gap-1 text-sm text-emerald-700 font-medium"><Check size={16} /> {salvo}</span>}
          </div>
        </form>

        {/* Identidade Visual + Uploads */}
        <div className="pt-5 mt-5 border-t border-slate-100">
          <p className="text-sm font-semibold text-slate-700 mb-2">Identidade Visual & Documentos</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UploadCampo label="Logomarca" valor={empresa.logo} onFile={f => onUpload('logo', f)} accept="image/*" />
            <UploadCampo label="Logomarca reduzida" valor={empresa.logoReduzida} onFile={f => onUpload('logoReduzida', f)} accept="image/*" />
            <div className="flex items-center gap-3">
              <div><label className={lab}>Cor principal</label><input type="color" value={empresa.corPrimaria} onChange={e => salvarBranding({ corPrimaria: e.target.value })} className="h-9 w-16 rounded border border-slate-300" /></div>
              <div><label className={lab}>Cor secundária</label><input type="color" value={empresa.corSecundaria} onChange={e => salvarBranding({ corSecundaria: e.target.value })} className="h-9 w-16 rounded border border-slate-300" /></div>
            </div>
            <UploadCampo label="Assinatura digital" valor={up.assinatura} onFile={f => onUpload('assinatura', f)} accept="image/*" />
            <UploadCampo label="Carimbo técnico" valor={up.carimbo} onFile={f => onUpload('carimbo', f)} accept="image/*" />
            <UploadCampo label="ART padrão" valor={up.artPadrao} onFile={f => onUpload('artPadrao', f)} accept="application/pdf,image/*" arquivo />
            <UploadCampo label="Documento técnico (+)" onFile={f => onUpload('documentos', f)} accept="application/pdf,image/*" arquivo />
          </div>
          {up.documentos?.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">{up.documentos.length} documento(s) técnico(s) anexado(s).</p>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function UploadCampo({ label, valor, onFile, accept, arquivo }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {valor && !arquivo && <img src={valor} alt={label} className="h-9 w-9 object-contain rounded border border-slate-200 bg-white" />}
        {valor && arquivo && <span className="text-xs text-emerald-600">✓ enviado</span>}
        <input type="file" accept={accept} onChange={e => onFile(e.target.files?.[0])}
          className="text-xs file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-slate-100 file:text-slate-600" />
      </div>
    </div>
  )
}

// ─── CFG-04: Painel de configuração financeira ────────────────────────────────
function ConfiguracaoFinanceira() {
  const { empresa, salvarFinanceiro } = useEmpresa()
  const fin = { ...PADRAO_EMPRESA.financeiro, ...empresa.financeiro }

  const [form, setForm] = useState(fin)
  const [salvo, setSalvo] = useState(false)

  function set(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: Number(valor) }))
  }

  function salvar(e) {
    e.preventDefault()
    salvarFinanceiro(form)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  const campo = (label, campo, suffix = '', min = 0, step = 1, helpText = '') => (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          step={step}
          value={form[campo]}
          onChange={e => set(campo, e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {suffix && <span className="text-sm text-slate-500 whitespace-nowrap">{suffix}</span>}
      </div>
      {helpText && <p className="text-xs text-slate-400 mt-1">{helpText}</p>}
    </div>
  )

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <DollarSign size={18} className="text-emerald-600" />
        <h3 className="font-semibold text-slate-900">Configurações Financeiras (CFG-04)</h3>
      </CardHeader>
      <CardBody>
        <form onSubmit={salvar} className="space-y-4">
          <p className="text-sm text-slate-500">
            Parâmetros padrão usados na etapa de Orçamento (E8). Podem ser ajustados por proposta.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {campo('Mão de obra por painel',   'precoMaoDeObra',     'R$/painel', 0, 0.5, 'Custo de instalação por módulo')}
            {campo('Cabos e proteções (fixo)',  'precoCabosProtecao', 'R$',        0, 50,  'Custo fixo de cabeamento e DPS')}
            {campo('Markup equipamentos',        'markupPct',         '%',          0, 0.5, 'Margem aplicada sobre custo de equipamentos')}
            {campo('Validade da proposta',       'validadeProposta',  'dias',      7,  1,   'Prazo de validade para o cliente aceitar')}
            {campo('Reajuste anual da tarifa',   'reajusteAnualPct',  '% a.a.',    0, 0.5, 'Para cálculo do payback descontado')}
            {campo('Tarifa kWh padrão',          'tarifaKwhPadrao',   'R$/kWh',    0, 0.01,'Usada quando não extraída da fatura')}
          </div>

          {/* S4: Módulo financeiro EPC */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700 mb-3">Markup & Rentabilidade (EPC)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campo('Markup padrão (composição)', 'markupPadraoPct',   '%',     0, 0.5, 'Aplicado sobre o CMV no modo composição')}
              {campo('Lucro desejado',             'lucroDesejadoPct',  '%',     0, 0.5, 'Meta de lucro de referência')}
              {campo('Desconto máximo',            'descontoMaximoPct', '%',     0, 0.5, 'Limite de desconto autorizado')}
              {campo('Impostos sobre venda',       'impostosPct',       '%',     0, 0.1, 'Simples/ISS médio')}
              {campo('Comissão de venda',          'comissaoPct',       '%',     0, 0.1, 'Comissão do vendedor')}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700 mb-3">Financiamento & Parcelamento</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campo('Juros financiamento',  'finTaxaJurosMesPct', '% a.m.',  0, 0.01, 'Tabela Price')}
              {campo('Parcelas padrão',       'finParcelasPadrao',  'x',       1, 1,    'Nº de parcelas do financiamento')}
              {campo('Carência',              'finCarenciaMeses',   'meses',   0, 1,    'Carência antes da 1ª parcela')}
              {campo('Taxa cartão',           'cartaoTaxaMesPct',   '% a.m.',  0, 0.01, 'Parcelamento no cartão')}
              {campo('Taxa boleto',           'boletoTaxaMesPct',   '% a.m.',  0, 0.01, 'Parcelamento via boleto')}
              {campo('Parcelas cartão',       'parcelasPadraoCartao','x',      1, 1,    'Nº padrão de parcelas no cartão')}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700 mb-3">Energia & Projeção</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campo('Inflação energética',  'inflacaoEnergiaPct', '% a.a.', 0, 0.1, 'Adicional ao reajuste tarifário')}
              {campo('Degradação módulos',    'degradacaoAnualPct', '% a.a.', 0, 0.1, 'Perda de geração anual')}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Save size={16} />
              Salvar configurações
            </button>
            {salvo && (
              <span className="flex items-center gap-1 text-sm text-emerald-700 font-medium">
                <Check size={16} />
                Salvo!
              </span>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

export default function Configuracoes() {
  const navigate = useNavigate()
  const { token } = useAuth()

  // Estado de chaves seguras do backend
  const [chavesSeguras, setChavesSeguras] = useState([])
  const [carregandoChaves, setCarregandoChaves] = useState(true)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(false)

  // Estado do formulário para adicionar nova chave
  const [telaFormulario, setTelaFormulario] = useState(false)
  const [novaChave, setNovaChave] = useState({
    integrationName: '',
    apiKey: '',
    description: '',
  })
  const [enviandoChave, setEnviandoChave] = useState(false)
  const [backendOffline, setBackendOffline] = useState(false)

  // Map integration names to legacy localStorage keys
  const integrationToLocalStorageKey = {
    'GeminiVision': 'geminiApiKey',
    'OpenAI': 'openaiApiKey',
    'Claude': 'claudeApiKey',
    'GoogleMaps': 'googleMapsApiKey',
  }

  function carregarChavesDoLocalStorage() {
    const keys = []
    Object.entries(integrationToLocalStorageKey).forEach(([integrationName, lsKey]) => {
      const valor = localStorage.getItem(lsKey)
      if (valor && valor.trim()) {
        keys.push({
          keyId: `local-${lsKey}`,
          integrationName,
          description: 'Armazenada localmente (backend offline)',
          maskedKey: '****' + valor.slice(-4),
          createdAt: new Date().toISOString(),
          lastUsed: null,
          isActive: true,
          rotationDueAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilRotation: 90,
          isLocal: true,
        })
      }
    })
    return keys
  }

  useEffect(() => {
    carregarChaves()
  }, [token])

  async function migrarChavesLegadas(chavesExistentes) {
    if (!token) return

    // Map legacy localStorage keys to backend integration names
    const legacyKeyMap = [
      { localStorageKey: 'geminiApiKey', integrationName: 'GeminiVision' },
      { localStorageKey: 'openaiApiKey', integrationName: 'OpenAI' },
      { localStorageKey: 'claudeApiKey', integrationName: 'Claude' },
      { localStorageKey: 'googleMapsApiKey', integrationName: 'GoogleMaps' },
    ]

    const nomesExistentes = new Set(chavesExistentes.map(c => c.integrationName))

    for (const { localStorageKey, integrationName } of legacyKeyMap) {
      const valor = localStorage.getItem(localStorageKey)
      if (!valor || !valor.trim()) continue
      if (nomesExistentes.has(integrationName)) continue

      try {
        const response = await fetch('/api/integrations/add-key', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            integrationName,
            apiKey: valor.trim(),
            description: 'Migrada automaticamente do armazenamento local',
          }),
        })

        if (response.ok) {
          console.log(`✅ Chave ${integrationName} migrada com sucesso`)
          // Remove legacy key after successful migration
          localStorage.removeItem(localStorageKey)
          localStorage.removeItem(`${localStorageKey}_ativo`)
        }
      } catch (err) {
        console.warn(`⚠️ Falha ao migrar ${integrationName}:`, err.message)
      }
    }
  }

  async function carregarChaves() {
    try {
      setCarregandoChaves(true)
      setErro(null)

      // Always try backend first
      let backendOk = false
      try {
        const response = await fetch('/api/integrations/keys', {
          headers: token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          } : { 'Content-Type': 'application/json' },
        })

        if (response.ok) {
          backendOk = true
          setBackendOffline(false)
          const data = await response.json()
          const chaves = data.keys || []

          // Auto-migrate any legacy keys from localStorage
          if (token) {
            await migrarChavesLegadas(chaves)
            const respPos = await fetch('/api/integrations/keys', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            })
            if (respPos.ok) {
              const dp = await respPos.json()
              setChavesSeguras(dp.keys || [])
            } else {
              setChavesSeguras(chaves)
            }
          } else {
            setChavesSeguras(chaves)
          }
        }
      } catch (err) {
        console.warn('[Configuracoes] Backend unreachable, using localStorage:', err.message)
      }

      // If backend failed/unavailable, load from localStorage
      if (!backendOk) {
        setBackendOffline(true)
        const localKeys = carregarChavesDoLocalStorage()
        setChavesSeguras(localKeys)
      }
    } catch (erro) {
      console.error('[Configuracoes] Erro:', erro)
      // Final fallback: show local keys
      setBackendOffline(true)
      setChavesSeguras(carregarChavesDoLocalStorage())
    } finally {
      setCarregandoChaves(false)
    }
  }

  async function adicionarChave(e) {
    e.preventDefault()

    if (!novaChave.integrationName) {
      setErro('Selecione uma integração')
      return
    }

    if (!novaChave.apiKey.trim()) {
      setErro('A chave de API não pode estar vazia')
      return
    }

    try {
      setEnviandoChave(true)
      setErro(null)

      // Try backend first
      let backendSucesso = false
      try {
        const response = await fetch('/api/integrations/add-key', {
          method: 'POST',
          headers: token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          } : { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            integrationName: novaChave.integrationName,
            apiKey: novaChave.apiKey,
            description: novaChave.description,
          }),
        })

        if (response.ok) {
          backendSucesso = true
          setBackendOffline(false)
        }
      } catch (err) {
        console.warn('[Configuracoes] Backend unreachable for save:', err.message)
      }

      // If backend failed, save to localStorage as fallback
      if (!backendSucesso) {
        const lsKey = integrationToLocalStorageKey[novaChave.integrationName]
        if (lsKey) {
          localStorage.setItem(lsKey, novaChave.apiKey.trim())
          localStorage.setItem(`${lsKey}_ativo`, 'true')
          setBackendOffline(true)
          console.log(`✅ Chave ${novaChave.integrationName} salva em localStorage (fallback)`)
        } else {
          throw new Error('Integração não suportada para armazenamento local')
        }
      }

      // Success - reload and reset form
      setSucesso(true)
      setNovaChave({ integrationName: '', apiKey: '', description: '' })
      setTelaFormulario(false)
      await carregarChaves()
      setTimeout(() => setSucesso(false), 3000)
      return
    } catch (erro) {
      console.error('Erro ao adicionar chave:', erro)
      // Last resort: try localStorage
      const lsKey = integrationToLocalStorageKey[novaChave.integrationName]
      if (lsKey && novaChave.apiKey.trim()) {
        try {
          localStorage.setItem(lsKey, novaChave.apiKey.trim())
          localStorage.setItem(`${lsKey}_ativo`, 'true')
          setBackendOffline(true)
          setSucesso(true)
          setNovaChave({ integrationName: '', apiKey: '', description: '' })
          setTelaFormulario(false)
          await carregarChaves()
          setTimeout(() => setSucesso(false), 3000)
          return
        } catch (e) {
          setErro('Erro ao salvar a chave')
        }
      } else {
        setErro('Erro ao adicionar chave')
      }
    } finally {
      setEnviandoChave(false)
    }
  }

  async function revogarChave(keyId, integrationName) {
    if (!window.confirm(`Tem certeza que deseja revogar a chave de ${integrationName}?`)) {
      return
    }

    // Handle local-only keys (when backend is offline)
    if (keyId && keyId.startsWith('local-')) {
      const lsKey = integrationToLocalStorageKey[integrationName]
      if (lsKey) {
        localStorage.removeItem(lsKey)
        localStorage.removeItem(`${lsKey}_ativo`)
        setSucesso(true)
        await carregarChaves()
        setTimeout(() => setSucesso(false), 3000)
        return
      }
    }

    try {
      const response = await fetch(`/api/integrations/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setSucesso(true)
        await carregarChaves()
        setTimeout(() => setSucesso(false), 3000)
      } else {
        setErro('Erro ao revogar chave')
      }
    } catch (erro) {
      console.error('Erro ao revogar chave:', erro)
      setErro('Erro ao revogar chave')
    }
  }

  async function rotacionarChave(keyId) {
    const novaChaveValor = prompt('Digite a nova chave de API:')
    if (!novaChaveValor?.trim()) return

    try {
      const response = await fetch(`/api/integrations/keys/${keyId}/rotate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newApiKey: novaChaveValor }),
      })

      if (response.ok) {
        setSucesso(true)
        await carregarChaves()
        setTimeout(() => setSucesso(false), 3000)
      } else {
        setErro('Erro ao rotacionar chave')
      }
    } catch (erro) {
      console.error('Erro ao rotacionar chave:', erro)
      setErro('Erro ao rotacionar chave')
    }
  }

  const getIntegrationInfo = (name) => {
    return API_INTEGRATIONS.find(api => api.id === name) || {}
  }

  const chavasAgrupadasPorCategoria = API_INTEGRATIONS.reduce((acc, api) => {
    if (!acc[api.categoria]) acc[api.categoria] = []
    acc[api.categoria].push(api)
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configurações</h1>
          <p className="text-sm text-slate-600">Gerenciar chaves de API com segurança</p>
        </div>
      </div>

      {/* Alertas */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Erro</p>
            <p className="text-red-700 text-sm">{erro}</p>
          </div>
        </div>
      )}

      {sucesso && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <Check size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 font-medium">Operação realizada com sucesso</p>
        </div>
      )}

      {/* Aviso de Modo Offline */}
      {backendOffline && (
        <Card className="border-amber-300 bg-amber-50">
          <CardBody className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">⚠️ Modo Offline - Armazenamento Local Ativado</p>
              <p className="text-sm text-amber-800 mt-1">
                O servidor de armazenamento seguro está temporariamente indisponível. Suas chaves estão sendo salvas localmente no navegador. Quando o servidor voltar, elas serão migradas automaticamente.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Aviso de Segurança */}
      <Card className="border-blue-200 bg-blue-50">
        <CardBody className="flex items-start gap-3">
          <Lock size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">🔐 Suas chaves estão seguras</p>
            <p className="text-sm text-blue-800 mt-1">
              {backendOffline
                ? 'As chaves estão armazenadas localmente no seu navegador enquanto o servidor seguro está offline. Migração automática quando o servidor voltar.'
                : 'As chaves de API são armazenadas com criptografia AES-256-GCM no servidor. Nunca são transmitidas em texto plano e não são armazenadas no seu navegador.'}
            </p>
            <ul className="text-sm text-blue-800 mt-2 space-y-1">
              <li>✅ {backendOffline ? 'Armazenamento local' : 'Criptografia de ponta a ponta'}</li>
              <li>✅ Rotação automática a cada 90 dias</li>
              <li>✅ Auditoria de acesso completa</li>
              <li>✅ Proteção contra XSS e injeção</li>
            </ul>
          </div>
        </CardBody>
      </Card>

      {/* Chaves Armazenadas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Chaves de API Ativas</h2>
              <p className="text-sm text-slate-600 mt-1">Gerenciar suas credenciais de integração</p>
            </div>
            <button
              onClick={() => setTelaFormulario(!telaFormulario)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={18} />
              {telaFormulario ? 'Cancelar' : 'Adicionar Chave'}
            </button>
          </div>
        </CardHeader>
        <CardBody>
          {carregandoChaves ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={20} className="animate-spin text-slate-400" />
              <span className="ml-2 text-slate-600">Carregando...</span>
            </div>
          ) : chavesSeguras.length === 0 && !telaFormulario ? (
            <div className="py-8 text-center">
              <Lock size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-600">Nenhuma chave de API configurada ainda</p>
              <p className="text-sm text-slate-500 mt-1">Adicione as primeiras credenciais para começar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chavesSeguras.map(chave => {
                const info = getIntegrationInfo(chave.integrationName)
                return (
                  <div key={chave.keyId} className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-slate-900">{info.nome || chave.integrationName}</h3>
                        {chave.description && (
                          <p className="text-sm text-slate-600 mt-1">{chave.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => rotacionarChave(chave.keyId)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded transition"
                          title="Rotacionar chave"
                        >
                          <ToggleRight size={18} />
                        </button>
                        <button
                          onClick={() => revogarChave(chave.keyId, info.nome || chave.integrationName)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                          title="Revogar chave"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Info da Chave */}
                    <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Chave:</span>
                        <span className="font-mono text-sm text-slate-900">{chave.maskedKey}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Criada:</span>
                        <span className="text-sm text-slate-600">{new Date(chave.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {chave.lastUsed && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">Último uso:</span>
                          <span className="text-sm text-slate-600">{new Date(chave.lastUsed).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}

                      {/* Status de Rotação */}
                      <div className={`flex items-center justify-between p-2 rounded ${
                        chave.daysUntilRotation <= 7 ? 'bg-red-100' : 'bg-green-100'
                      }`}>
                        <span className="text-sm font-medium text-slate-700">Rotação:</span>
                        <span className={`text-sm font-medium ${
                          chave.daysUntilRotation <= 7 ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {chave.daysUntilRotation > 0
                            ? `${chave.daysUntilRotation} dias`
                            : '⚠️ Vencida - rotacione agora'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Formulário para Adicionar Chave */}
      {telaFormulario && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Adicionar Nova Chave de API</h3>
          </CardHeader>
          <CardBody>
            <form onSubmit={adicionarChave} className="space-y-4">
              {/* Seleção de Integração */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Integração *
                </label>
                <select
                  value={novaChave.integrationName}
                  onChange={(e) => setNovaChave({ ...novaChave, integrationName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione uma integração</option>
                  {API_INTEGRATIONS.map(api => (
                    <option key={api.id} value={api.id}>
                      {api.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Campo de Chave */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Chave de API *
                </label>
                <input
                  type="password"
                  value={novaChave.apiKey}
                  onChange={(e) => setNovaChave({ ...novaChave, apiKey: e.target.value })}
                  placeholder={API_INTEGRATIONS[0]?.placeholder || 'Cole aqui sua chave de API'}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
              </div>

              {/* Campo de Descrição */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={novaChave.description}
                  onChange={(e) => setNovaChave({ ...novaChave, description: e.target.value })}
                  placeholder="Ex: Chave para produção, Chave de desenvolvimento..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={enviandoChave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {enviandoChave ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Salvar Chave
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTelaFormulario(false)
                    setNovaChave({ integrationName: '', apiKey: '', description: '' })
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* CFG-04: Configurações financeiras */}
      <ConfiguracaoEmpresa />

      <ConfiguracaoGestao />

      <ConfiguracaoFinanceira />

      {/* Guia de Integração */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">Como Obter suas Chaves de API</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-6">
            {Object.entries(chavasAgrupadasPorCategoria).map(([categoria, apis]) => (
              <div key={categoria}>
                <h4 className="font-medium text-slate-900 mb-3">{categoria}</h4>
                <div className="space-y-3">
                  {apis.map(api => (
                    <div key={api.id} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-slate-900">{api.nome}</p>
                        <a
                          href={api.docs}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
                        >
                          Acessar
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      <p className="text-sm text-slate-600">{api.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
