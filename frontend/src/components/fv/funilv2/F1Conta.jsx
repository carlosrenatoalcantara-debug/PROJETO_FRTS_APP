import { useState } from 'react'
import { Upload, Loader, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../../ui/Card'
import Button from '../../ui/Button'
import Dropzone from '../../ui/Dropzone'
import CardResumoSistema from './CardResumoSistema'
import FormDadosExtraidos from './FormDadosExtraidos'
import BadgeLocalizacao from './BadgeLocalizacao'
import { geocodificarEndereco } from '../../../services/geocodingApi'

const API_URL = '' /* URL relativa (Vercel proxy) */

/**
 * Fase 1 do funil v2 — Importação da conta de energia.
 *
 * Sub-passos:
 *   1.1 Upload (drag-drop)
 *   1.2 Loading / extração via Gemini
 *   1.3 Revisão dos dados (editáveis)
 *   1.4 Preview do sistema sugerido + decisão de cliente (se houver candidatos)
 *
 * Props:
 *   onConcluido(payload) — chamado com { faturaDados, decisaoCliente, projeto } após criar
 */
export default function F1Conta({ onConcluido }) {
  const [etapa, setEtapa] = useState('upload')  // upload | revisar | decisao | salvando
  const [arquivo, setArquivo] = useState(null)
  const [extraindo, setExtraindo] = useState(false)
  const [erro, setErro] = useState(null)
  const [dados, setDados] = useState({})
  const [candidatos, setCandidatos] = useState([])
  const [dimPreview, setDimPreview] = useState(null)
  const [decisao, setDecisao] = useState(null)  // null | { tipo, clienteId? }
  const [salvando, setSalvando] = useState(false)

  // ─── 1.1 / 1.2 — Upload + extração ─────────────────────────────────────────
  async function onArquivo(file) {
    setArquivo(file)
    setExtraindo(true)
    setErro(null)

    try {
      const fd = new FormData()
      fd.append('fatura', file)
      const headers = {}
      const gKey = localStorage.getItem('geminiApiKey')
      if (gKey) headers['X-Gemini-Key'] = gKey

      const res = await fetch(`${API_URL}/api/fatura/extrair`, {
        method: 'POST', headers, body: fd,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.erro || `Erro ${res.status} ao extrair`)
      }

      const extraido = await res.json()
      extraido._arquivoOriginal = file.name

      // 2. Geocoding no frontend (reuso do service Nominatim já existente).
      //    Não bloqueia o avanço se falhar — apenas marca como "nao_geocodificado".
      try {
        if (extraido.endereco) {
          const geo = await geocodificarEndereco(extraido.endereco)
          if (geo) {
            extraido.latitude = geo.lat
            extraido.longitude = geo.lon
            extraido.geocoding_origem = geo.geocoding_origem
            extraido.geocoding_confianca = geo.geocoding_confianca
            extraido.geocodificado_em = geo.geocodificado_em
          } else {
            extraido.latitude = null
            extraido.longitude = null
            extraido.geocoding_origem = 'nao_geocodificado'
            extraido.geocoding_confianca = 0
            extraido.geocodificado_em = new Date().toISOString()
          }
        }
      } catch (geoErr) {
        // Geocoding falhou — não bloqueia. Marca como pendente.
        console.warn('[F1Conta] geocoding falhou:', geoErr?.message)
        extraido.latitude = null
        extraido.longitude = null
        extraido.geocoding_origem = 'nao_geocodificado'
        extraido.geocoding_confianca = 0
      }

      setDados(extraido)

      // 3. Chama /preparar-com-fatura para buscar candidatos + calcular dim.
      const respPrep = await fetch(`${API_URL}/api/projetos-fv/preparar-com-fatura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faturaDados: extraido }),
      })
      const prep = await respPrep.json()
      setCandidatos(prep.candidatos_cliente || [])
      setDimPreview(prep.dimensionamento_preview?.resultado || null)

      setEtapa('revisar')
    } catch (e) {
      setErro(e.message)
    } finally {
      setExtraindo(false)
    }
  }

  // ─── 1.3 → 1.4 — Avançar para decisão ──────────────────────────────────────
  function avancarParaDecisao() {
    setErro(null)
    if (!dados.nome || !dados.nome.trim()) {
      setErro('Nome do cliente é obrigatório.')
      return
    }
    setEtapa('decisao')
  }

  // ─── 1.4 — Finalizar (decisão tomada) ──────────────────────────────────────
  async function finalizar() {
    if (!decisao) {
      setErro('Selecione: usar cliente existente OU criar novo cliente.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      const payload = {
        faturaDados: dados,
        decisaoCliente: decisao.tipo === 'usar_existente'
          ? { tipo: 'usar_existente', clienteId: decisao.clienteId }
          : { tipo: 'criar_novo', novosDados: {
              nome: dados.nome,
              email: dados.email,
              telefone: dados.telefone,
              cpf_cnpj: dados.cpfCnpj,
              endereco_completo: dados.endereco,
              cep: dados.cep,
              cidade: dados.cidade,
              estado: dados.estado,
            },
          },
      }

      const res = await fetch(`${API_URL}/api/projetos-fv/finalizar-com-fatura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (!res.ok || !result.sucesso) {
        throw new Error(result.erro || `Erro ${res.status}`)
      }

      onConcluido?.({
        faturaDados: dados,
        decisaoCliente: payload.decisaoCliente,
        projeto: result.projeto,
        clienteCriado: result.cliente_criado,
        dimensionamento: result.dimensionamento,
      })
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  if (etapa === 'upload') {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Fase 1 — Importar conta de energia</h2>
          <p className="text-sm text-slate-500">Upload de PDF ou imagem da fatura. Extraímos automaticamente todos os dados técnicos e comerciais.</p>
        </CardHeader>
        <CardBody>
          {extraindo ? (
            <div className="text-center py-12">
              <Loader size={48} className="mx-auto animate-spin text-blue-600 mb-4" />
              <p className="text-slate-700 font-medium">Extraindo dados da fatura...</p>
              <p className="text-xs text-slate-500 mt-1">Pode levar até 30 segundos</p>
            </div>
          ) : (
            <Dropzone
              arquivo={arquivo}
              nomeArquivo={arquivo?.name}
              onArquivo={onArquivo}
              onRemover={() => setArquivo(null)}
            />
          )}
          {erro && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>{erro}</div>
            </div>
          )}
        </CardBody>
      </Card>
    )
  }

  if (etapa === 'revisar') {
    return (
      <div className="space-y-4">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardBody className="flex items-center gap-3 py-3">
            <CheckCircle size={20} className="text-emerald-600 shrink-0" />
            <div className="text-sm text-emerald-900">
              <strong>Dados extraídos com sucesso.</strong> Revise as informações abaixo e ajuste se necessário antes de avançar.
            </div>
          </CardBody>
        </Card>

        {dimPreview && <CardResumoSistema resultado={dimPreview} />}

        <Card>
          <CardHeader className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold">Dados extraídos da fatura</h3>
            <BadgeLocalizacao
              origem={dados.geocoding_origem}
              confianca={dados.geocoding_confianca}
              latitude={dados.latitude}
              longitude={dados.longitude}
            />
          </CardHeader>
          <CardBody>
            <FormDadosExtraidos dados={dados} onChange={setDados} />
            {erro && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">{erro}</div>
            )}
            <div className="mt-4 flex justify-end">
              <Button onClick={avancarParaDecisao} icone={ArrowRight}>
                Avançar
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (etapa === 'decisao') {
    return (
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Cliente</h3>
          <p className="text-sm text-slate-500">
            {candidatos.length > 0
              ? `Encontramos ${candidatos.length} cliente${candidatos.length > 1 ? 's' : ''} similar${candidatos.length > 1 ? 'es' : ''}. Selecione um ou crie um novo.`
              : 'Não encontramos clientes existentes com dados similares. Será criado um novo cliente.'}
          </p>
        </CardHeader>
        <CardBody>
          {candidatos.length > 0 && (
            <div className="space-y-2 mb-4">
              {candidatos.map(c => (
                <label
                  key={c._id}
                  className={`block p-3 rounded border-2 cursor-pointer transition-colors ${
                    decisao?.tipo === 'usar_existente' && decisao?.clienteId === c._id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="cliente-decisao"
                    className="mr-2"
                    onChange={() => setDecisao({ tipo: 'usar_existente', clienteId: c._id })}
                  />
                  <span className="font-medium">{c.nome}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {c.email && `• ${c.email}`} {c.telefone && `• ${c.telefone}`}
                  </span>
                  <span className="ml-2 px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700">
                    {c.score_match}% match
                  </span>
                  {c.endereco_completo && (
                    <div className="text-xs text-slate-500 mt-1 ml-6">{c.endereco_completo}</div>
                  )}
                </label>
              ))}
            </div>
          )}

          <label className={`block p-3 rounded border-2 cursor-pointer transition-colors ${
            decisao?.tipo === 'criar_novo'
              ? 'border-orange-500 bg-orange-50'
              : 'border-slate-200 hover:border-slate-300'
          }`}>
            <input
              type="radio"
              name="cliente-decisao"
              className="mr-2"
              onChange={() => setDecisao({ tipo: 'criar_novo' })}
            />
            <span className="font-medium">➕ Criar novo cliente</span>
            <span className="ml-2 text-xs text-slate-500">com os dados extraídos da fatura ({dados.nome})</span>
          </label>

          {erro && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">{erro}</div>
          )}

          <div className="mt-4 flex justify-between">
            <Button variante="secundario" onClick={() => setEtapa('revisar')} disabled={salvando}>
              Voltar
            </Button>
            <Button onClick={finalizar} disabled={salvando || !decisao} icone={ArrowRight}>
              {salvando ? 'Criando projeto...' : 'Criar projeto'}
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return null
}
