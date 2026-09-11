import { useState, useEffect } from 'react'
import { apiFetch } from '../../services/http'
import { Link, useNavigate } from 'react-router-dom'
import { Download, ExternalLink, RefreshCw, Zap } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Button from '../ui/Button'
// F-02: só o DOWNLOAD vem daqui. A geração é do domínio, via API — importar o
// motor nesta tela foi o que permitiu chamá-lo com o documento na forma errada.
import { baixarUnifilarSVG } from '@/utils/gerarUnifilarSVG'
import { classificarTopologia } from '../../utils/topologiaInversor'
// F-05: necessidade e composição lado a lado, cada uma com o seu nome.
import ResumoNecessidadeComposicao from './ResumoNecessidadeComposicao'

export default function UnifilarFV({ projeto }) {
  const topologia = projeto?.engenharia_eletrica?.topologia ?? projeto?.topologia
    ?? classificarTopologia(projeto?.equipamentos?.inversor ?? projeto?.dimensionamento?.inversor ?? {})
  const ehMicro = topologia === 'micro'
  const microCfg = projeto?.engenharia_eletrica?.micro ?? projeto?.micro ?? null
  // S8.1.1: origem explícita (sem fallback silencioso). Prioridade: snapshot congelado.
  const svgCongelado = projeto?.governanca?.snapshot_unifilar?.svg || null
  const [unifilar, setUnifilar] = useState(svgCongelado)
  const [origem, setOrigem] = useState(svgCongelado ? 'snapshot' : null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  // F-02: recusa técnica do domínio (FV-DOM-056) e o que ele teve de assumir.
  const [impedimento, setImpedimento] = useState(null)
  const [lacunas, setLacunas] = useState([])
  const navigate = useNavigate()
  const [ativos, setAtivos] = useState([])

  useEffect(() => {
    if (!projeto?._id) return
    apiFetch(`/api/ativos/projeto/${projeto._id}`)
      .then(r => r.ok ? r.json() : { itens: [] })
      .then(data => setAtivos(Array.isArray(data?.itens) ? data.itens : []))
      .catch(() => {})
  }, [projeto?._id])

  /**
   * F-02 — o desenho passa a vir do domínio, não do motor chamado direto aqui.
   *
   * `gerarUnifilarSVG` espera o formato do CONTEXTO do wizard — `projeto.painel`,
   * `projeto.inversor` no topo. O documento persistido tem outra forma:
   * `equipamentos.paineis[]` e `equipamentos.inversor`. Chamado com o documento
   * cru, ele não achava nem módulo nem inversor e caía nos defaults internos:
   * módulo de 550 W, inversor de 5 kW, 6 módulos, 3,3 kWp. Um projeto real de
   * Ronma 585 W + Solplanet 9,1 kW + 14 módulos era desenhado como outro
   * sistema, sem aviso nenhum.
   *
   * `POST /:id/unifilar/gerar` é o caminho canônico e já existia: adapta o
   * documento (`adaptarProjetoParaUnifilar`), hidrata o módulo pelo
   * `equipamento_id`, aplica o portão de integridade da FV-DOM-056 — que RECUSA
   * desenhar em vez de inventar — e devolve proveniência e lacunas junto.
   */
  async function handleGerarUnifilar() {
    try {
      setCarregando(true)
      setErro(null)
      setImpedimento(null)
      // Corpo vazio explícito: sem `Content-Type` o servidor responde 415.
      const resp = await apiFetch(`/api/projetos-fv/${projeto._id}/unifilar/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const dados = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(dados?.erro || 'Erro ao gerar unifilar')

      // Recusa do domínio: não é falha, é o estado do projeto. Sem desenho.
      if (!dados?.svg) {
        setUnifilar(null)
        setImpedimento(dados?.impedimento ?? {
          codigo: 'DADOS_INSUFICIENTES',
          mensagem: 'O projeto não tem dados suficientes para o diagrama.',
        })
        return
      }
      setUnifilar(dados.svg)
      setOrigem(dados.origem ?? 'dados_atuais')
      setLacunas(Array.isArray(dados.lacunas) ? dados.lacunas : [])
    } catch (err) {
      setErro(err.message || 'Erro ao gerar unifilar')
    } finally {
      setCarregando(false)
    }
  }

  function handleBaixarSVG() {
    if (!unifilar) return
    baixarUnifilarSVG(unifilar, `unifilar_${projeto._id}.svg`)
  }

  function handleBaixarPNG() {
    if (!unifilar) return
    // Converte SVG para PNG via canvas
    const img = new Image()
    const blob = new Blob([unifilar], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = 1400
      canvas.height = img.naturalHeight || 950
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const link = document.createElement('a')
      link.download = `unifilar_${projeto._id}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  function handleSVGClick(e) {
    const el = e.target.closest('[data-ativo-id]')
    if (!el) return
    const qr = el.dataset.qr
    if (qr) navigate(`/ativo/${encodeURIComponent(qr)}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Diagrama Unifilar</h2>
          <p className="text-sm text-slate-600 mt-1">Esquema técnico do sistema fotovoltaico</p>
        </div>
        <Zap size={32} className="text-yellow-500" />
      </div>

      {/*
        F-05: o diagrama descreve o sistema CONFIGURADO, e este bloco passou a
        descrever o mesmo. Lia `dimensionamento`, que é a NECESSIDADE: um
        projeto de 14 módulos aparecia como 10 ao lado do desenho de 14.
      */}
      <Card>
        <CardHeader>Dados do Sistema</CardHeader>
        <CardBody>
          <ResumoNecessidadeComposicao projeto={projeto} ehMicro={ehMicro} />
        </CardBody>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleGerarUnifilar}
          disabled={carregando}
          className="flex items-center gap-2"
        >
          <RefreshCw size={18} className={carregando ? 'animate-spin' : ''} />
          {carregando ? 'Gerando...' : (origem === 'snapshot' ? 'Regerar a partir dos dados atuais' : 'Gerar Unifilar Automático')}
        </Button>
        {projeto?._id && (
          <Link
            to={`/unifilar/${projeto._id}`}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            <ExternalLink size={14} />
            Gêmeo Digital (unifilar operacional)
          </Link>
        )}
        {/* S8.1.1: origem explícita (sem fallback silencioso) */}
        {origem === 'snapshot' && <span className="text-xs text-emerald-700">A partir do snapshot congelado ✓</span>}
        {origem === 'dados_atuais' && <span className="text-xs text-amber-700">Gerado dos dados atuais (não é o snapshot congelado)</span>}
        {ativos.length > 0 && <span className="text-xs text-slate-500">{ativos.length} ativo{ativos.length !== 1 ? 's' : ''} vinculado{ativos.length !== 1 ? 's' : ''}</span>}
      </div>

      {erro && (
        <Card className="bg-red-50 border border-red-200">
          <CardBody>
            <p className="text-red-700">⚠️ {erro}</p>
          </CardBody>
        </Card>
      )}

      {/* F-02: recusa declarada em vez de diagrama fictício. */}
      {impedimento && (
        <Card className="bg-amber-50 border border-amber-300">
          <CardBody className="space-y-1">
            <p className="font-semibold text-amber-900">Diagrama não gerado</p>
            <p className="text-sm text-amber-800">{impedimento.mensagem ?? 'Dados insuficientes.'}</p>
            {impedimento.codigo && (
              <p className="text-[11px] font-mono text-amber-700">{impedimento.codigo}</p>
            )}
            <p className="text-xs text-amber-700 pt-1">
              Nenhum equipamento foi assumido no lugar dos que faltam — complete o
              arranjo e gere novamente.
            </p>
          </CardBody>
        </Card>
      )}

      {/* O que o motor teve de assumir, dito por extenso. */}
      {unifilar && lacunas.length > 0 && (
        <Card className="bg-slate-50 border border-slate-300">
          <CardBody>
            <p className="text-xs text-slate-700">
              <span className="font-semibold">Assumido pelo motor:</span>{' '}
              {lacunas.map((l) => (typeof l === 'string' ? l : l?.campo ?? '')).filter(Boolean).join(' · ')}
            </p>
          </CardBody>
        </Card>
      )}

      {unifilar && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <span>Diagrama Técnico</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variante="secundario"
                onClick={handleBaixarSVG}
                className="flex items-center gap-1"
              >
                <Download size={16} />
                SVG
              </Button>
              <Button
                size="sm"
                variante="secundario"
                onClick={handleBaixarPNG}
                className="flex items-center gap-1"
              >
                <Download size={16} />
                PNG
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            {/* FV-08: usar <div> e não <svg> para evitar SVG aninhado */}
            <div
              className="overflow-auto bg-slate-50 rounded-lg border border-slate-200 p-4"
              dangerouslySetInnerHTML={{ __html: unifilar }}
              onClick={handleSVGClick}
            />
          </CardBody>
        </Card>
      )}

      {!unifilar && !carregando && (
        <Card className="bg-slate-50 border-2 border-dashed border-slate-300">
          <CardBody className="text-center py-12">
            <Zap size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-600">Clique em "Gerar Unifilar Automático" para criar o diagrama técnico</p>
            <p className="text-sm text-slate-500 mt-2">O diagrama mostrará toda a configuração elétrica do sistema</p>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
