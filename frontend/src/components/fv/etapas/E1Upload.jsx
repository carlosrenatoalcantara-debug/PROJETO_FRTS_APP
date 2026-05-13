import { useState } from 'react'
import { FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import Dropzone from '../../ui/Dropzone'
import Button from '../../ui/Button'
import Input from '../../ui/Input'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005'

export default function E1Upload() {
  const { state, dispatch, proxima } = useProjetoFV()
  const { dadosCliente } = state
  const [extraindo, setExtraindo] = useState(false)
  const [extraidoComSucesso, setExtraidoComSucesso] = useState(false)
  const [erroExtracao, setErroExtracao] = useState('')

  function setCliente(campo, valor) {
    dispatch({ type: 'SET_CLIENTE', payload: { [campo]: valor } })
  }

  async function onArquivo(file, nome) {
    dispatch({ type: 'SET_ARQUIVO', payload: { arquivo: file, nome } })
    setExtraindo(true)
    setErroExtracao('')
    setExtraidoComSucesso(false)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 segundo timeout

    try {
      const formData = new FormData()
      formData.append('fatura', file)

      const res = await fetch(`${API_URL}/api/fatura/extrair`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.erro || `HTTP ${res.status}`)
      }

      const dados = await res.json()

      if (dados.consumoKwh || dados.valorR || dados.distribuidora || dados.endereco) {
        dispatch({
          type: 'SET_CONSUMO',
          payload: {
            consumoMensal: dados.consumoKwh || '',
            distribuidora: dados.distribuidora || '',
            historico12Meses: dados.historico12Meses || null,
            mediaAnual: dados.mediaAnual || null,
            tipoLigacao: dados.tipoLigacao || '',
            tensao: dados.tensao || '220',
            grupoTarifario: dados.grupoTarifario || '',
            fase: dados.fase || '',
            valorKwh: dados.valorKwh || '',
            irradiancia: dados.irradiancia || '',
          },
        })

        if (dados.endereco) {
          dispatch({
            type: 'SET_LOCALIZACAO',
            payload: {
              endereco: dados.endereco,
            },
          })
        }

        setExtraidoComSucesso(true)
      } else {
        setErroExtracao('Fatura processada, mas nenhum dado foi extraído. Preencha manualmente.')
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setErroExtracao('Timeout: Processamento demorou muito. Preencha os dados manualmente.')
      } else {
        console.error('Erro ao extrair PDF:', err)
        setErroExtracao(`Não foi possível processar: ${err.message}. Você pode preencher manualmente.`)
      }
    } finally {
      clearTimeout(timeoutId)
      setExtraindo(false)
    }
  }

  function onRemover() {
    dispatch({ type: 'SET_ARQUIVO', payload: { arquivo: null, nome: null } })
    setExtraidoComSucesso(false)
    setErroExtracao('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Dados do Projeto</h2>
        <p className="text-sm text-slate-500 mt-1">
          Identifique o projeto e, opcionalmente, anexe a fatura de energia para referência.
        </p>
      </div>

      {/* Dados do cliente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          rotulo="Nome do cliente *"
          placeholder="Ex: João Silva"
          value={dadosCliente.nomeCliente}
          onChange={e => setCliente('nomeCliente', e.target.value)}
        />
        <Input
          rotulo="Nome do projeto"
          placeholder="Ex: Residência Silva - FV"
          value={dadosCliente.nomeProjeto}
          onChange={e => setCliente('nomeProjeto', e.target.value)}
        />
        <Input
          rotulo="Telefone"
          placeholder="(00) 9 0000-0000"
          value={dadosCliente.telefone}
          onChange={e => setCliente('telefone', e.target.value)}
        />
        <Input
          rotulo="E-mail"
          type="email"
          placeholder="cliente@email.com"
          value={dadosCliente.email}
          onChange={e => setCliente('email', e.target.value)}
        />
      </div>

      {/* Upload da fatura */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">
          Fatura de energia <span className="text-slate-400 font-normal">(opcional)</span>
        </p>
        <Dropzone
          arquivo={state.arquivo}
          nomeArquivo={state.nomeArquivo}
          onArquivo={onArquivo}
          onRemover={onRemover}
          carregando={extraindo}
        />
      </div>

      {extraindo && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="animate-spin">
            <FileText size={18} className="text-blue-600" />
          </div>
          <p className="text-sm text-blue-800">Processando fatura...</p>
        </div>
      )}

      {extraidoComSucesso && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-900">Fatura processada com sucesso!</p>
            <p className="text-xs text-emerald-800 mt-1">Dados extraídos: consumo e distribuidora</p>
          </div>
        </div>
      )}

      {erroExtracao && (
        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertCircle size={18} className="text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-900">Não foi possível extrair dados automaticamente</p>
            <p className="text-xs text-orange-800 mt-1">{erroExtracao}</p>
            <p className="text-xs text-orange-700 mt-2">💡 Você pode preencher os dados manualmente na próxima etapa.</p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <FileText size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          {extraidoComSucesso
            ? 'Os dados foram extraídos automaticamente. Você pode ajustá-los na próxima etapa.'
            : 'Anexe uma fatura para extrair dados automaticamente ou insira manualmente na próxima etapa.'}
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={proxima}
          disabled={!dadosCliente.nomeCliente.trim()}
        >
          Próxima →
        </Button>
      </div>
    </div>
  )
}
