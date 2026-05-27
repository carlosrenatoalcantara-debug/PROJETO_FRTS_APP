import { useState } from 'react'
import { Download, Save, CheckCircle, XCircle, Sun, Zap, Layers, BarChart2, ArrowRight, Cloud, FileText, GitBranch } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import { useEmpresa }   from '../../../contexts/EmpresaContext'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import { gerarPdfOrcamento } from '../../../utils/gerarPdfOrcamento'
// Portados de NovaProposta.jsx (consolidação do fluxo FV oficial)
import { gerarUnifilarSVG, baixarUnifilarSVG } from '../../../utils/gerarUnifilarSVG'
import { gerarPropostaPDF, abrirOuBaixarProposta } from '../../../utils/gerarPropostaPDF'
import {
  resolverClientePorNome,
  criarProjeto,
  salvarTodosSlices,
} from '../../../services/projetoFVApi'

function LinhaResumo({ rotulo, valor }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500">{rotulo}</span>
      <span className="font-semibold text-slate-900">{valor ?? '—'}</span>
    </div>
  )
}

function CardEquipSelecionado({ icone: Icone, titulo, item, qtd, precoUnitario, setPrecoUnitario, total }) {
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <Icone size={15} className="text-primary-600" style={{ color: 'var(--cor-primaria)' }} />
        <span className="text-xs font-semibold text-slate-500 uppercase">{titulo}</span>
      </div>
      <p className="font-semibold text-slate-900">{item.marca} {item.modelo}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-slate-500">Quantidade</p>
          <p className="font-medium text-slate-900">{qtd} unid.</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Preço unitário</p>
          <input
            type="number"
            value={precoUnitario}
            onChange={(e) => setPrecoUnitario(Number(e.target.value))}
            placeholder="0.00"
            className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            step="0.01"
            min="0"
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-500">Subtotal</span>
        <Badge cor="verde">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Badge>
      </div>
    </div>
  )
}

export default function E8Orcamento() {
  const navigate = useNavigate()
  const { state, dispatch, anterior, resetar } = useProjetoFV()
  const { empresa } = useEmpresa()

  const {
    dadosCliente, dadosConsumo, localizacao,
    irradiancia, dimensionamento: dim, area, equipamentos,
  } = state

  const [gerando,    setGerando]    = useState(false)
  const [salvando,   setSalvando]   = useState(false)
  const [salvo,      setSalvo]      = useState(false)
  const [erroPdf,    setErroPdf]    = useState('')
  const [erroSalvar, setErroSalvar] = useState('')
  // Portados: estados para Unifilar SVG + Proposta HTML
  const [gerandoUnifilar, setGerandoUnifilar] = useState(false)
  const [gerandoProposta, setGerandoProposta] = useState(false)
  const [erroUnifilar,    setErroUnifilar]    = useState('')
  const [erroProposta,    setErroProposta]    = useState('')

  // ⚠️ Destructuring movido para ANTES dos useState que referenciam painel/inversor/estrutura
  //    para eliminar ReferenceError TDZ (Temporal Dead Zone).
  const { painel, inversor, estrutura } = equipamentos

  // Preços editáveis
  const [precoPainel,    setPrecoPainel]    = useState(painel?.precoUnitario || 2500)
  const [precoInversor,  setPrecoInversor]  = useState(inversor?.precoUnitario || 4000)
  const [precoEstrutura, setPrecoEstrutura] = useState(estrutura?.precoUnitario || 1200)
  const [maoDeTrabaho,   setMaoDeTrabaho]   = useState(50) // R$ por painel
  const [cabosProtecao,  setCabosProtecao]  = useState(1500) // R$ subtotal

  const subtotalPaineis    = dim.numPaineis * precoPainel
  const subtotalInversores = dim.numInversores * precoInversor
  const subtotalEstrutura  = dim.numPaineis * precoEstrutura
  const subtotalMaoDeTrabaho = dim.numPaineis * maoDeTrabaho
  const subtotalCabosProtecao = cabosProtecao
  const total              = subtotalPaineis + subtotalInversores + subtotalEstrutura + subtotalMaoDeTrabaho + subtotalCabosProtecao

  function baixarPdf() {
    setGerando(true)
    setErroPdf('')
    try {
      const doc = gerarPdfOrcamento({
        cliente:         dadosCliente,
        consumo:         dadosConsumo,
        localizacao,
        dimensionamento: dim,
        area,
        equipamentos,
        irradiancia,
        empresa,
      })
      const nomeArq = `orcamento-${(dadosCliente.nomeCliente || 'projeto').replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`
      doc.save(nomeArq)
    } catch (e) {
      console.error('Erro ao gerar PDF:', e)
      setErroPdf(`Erro ao gerar PDF: ${e.message ?? 'tente novamente'}`)
    } finally {
      setGerando(false)
    }
  }

  // ── Portado: gera Unifilar SVG e baixa ─────────────────────────────────────
  function baixarUnifilar() {
    setGerandoUnifilar(true)
    setErroUnifilar('')
    try {
      const svg = gerarUnifilarSVG({
        nome:         dadosCliente.nomeProjeto || `Sistema FV ${dim.potenciaRealKwp ?? '?'} kWp`,
        nomeCliente:  dadosCliente.nomeCliente || 'Cliente',
        dimensionamento: {
          numPaineis:          dim.numPaineis ?? 0,
          numStrings:          dim.numStrings ?? 1,
          potenciaArredondada: dim.potenciaRealKwp ?? dim.potenciaKwp ?? 0,
        },
        tipo_ligacao:  dadosConsumo.tipoLigacao || 'monofasico',
        tensao:        dadosConsumo.tensao || '220',
        distribuidora: dadosConsumo.concessionaria || dadosConsumo.distribuidora || 'Concessionária',
        painel:        painel || null,
        inversor:      inversor || null,
      })
      const nomeArq = `unifilar-${(dadosCliente.nomeCliente || 'projeto').replace(/\s+/g, '-').toLowerCase()}`
      baixarUnifilarSVG(svg, nomeArq)
    } catch (e) {
      console.error('Erro ao gerar Unifilar:', e)
      setErroUnifilar(`Erro ao gerar unifilar: ${e.message ?? 'tente novamente'}`)
    } finally {
      setGerandoUnifilar(false)
    }
  }

  // ── Portado: gera Proposta HTML e abre em nova aba ─────────────────────────
  function gerarProposta() {
    setGerandoProposta(true)
    setErroProposta('')
    try {
      // Estimativa simples de payback (anos) — pode ser refinada depois
      const consumoMensalKwh = Number(dadosConsumo.consumoMensal) || 0
      const valorKwh         = Number(dadosConsumo.valorKwh) || 0.95
      const economiaAnual    = consumoMensalKwh * 12 * valorKwh
      const payback          = economiaAnual > 0 ? +(total / economiaAnual).toFixed(1) : null
      const precoWp          = dim.potenciaRealKwp > 0 ? +(total / (dim.potenciaRealKwp * 1000)).toFixed(2) : null

      const htmlProposta = gerarPropostaPDF({
        cliente: {
          nome:     dadosCliente.nomeCliente,
          email:    dadosCliente.email,
          telefone: dadosCliente.telefone,
          endereco: localizacao.endereco || localizacao.cidadeEstado || '',
        },
        sistema: {
          potenciakWp:   dim.potenciaRealKwp ?? dim.potenciaKwp,
          numPaineis:    dim.numPaineis,
          numInversores: dim.numInversores,
          economiaAnual,
          payback,
        },
        orcamento: {
          total,
          precoWp,
          itens: [
            { descricao: `Módulos FV (${dim.numPaineis} × ${painel?.marca || ''} ${painel?.modelo || ''})`, valor: subtotalPaineis    },
            { descricao: `Inversor(es) (${dim.numInversores} × ${inversor?.marca || ''} ${inversor?.modelo || ''})`, valor: subtotalInversores },
            { descricao: `Estrutura de fixação`,        valor: subtotalEstrutura },
            { descricao: `Mão de obra`,                 valor: subtotalMaoDeTrabaho },
            { descricao: `Cabos e proteções`,           valor: subtotalCabosProtecao },
          ],
        },
        empresa: {
          nome:     empresa?.nomeEmpresa || 'Forte Solar',
          logo:     empresa?.logo        || '',
          telefone: empresa?.telefone    || '',
          email:    empresa?.email       || '',
        },
      })
      abrirOuBaixarProposta(htmlProposta)
    } catch (e) {
      console.error('Erro ao gerar Proposta:', e)
      setErroProposta(`Erro ao gerar proposta: ${e.message ?? 'tente novamente'}`)
    } finally {
      setGerandoProposta(false)
    }
  }

  async function salvarProposta() {
    setSalvando(true)
    setErroSalvar('')
    try {
      let projetoIdAtual = state.projetoId  // pode já existir de sessão anterior

      // ── 1. Criar projeto (se ainda não existe) ─────────────────────────────
      if (!projetoIdAtual) {
        const cliente = await resolverClientePorNome(dadosCliente.nomeCliente)
        if (!cliente) {
          setErroSalvar('Cliente não encontrado. Cadastre o cliente antes de salvar.')
          setSalvando(false)
          return
        }

        const nomeProjeto = dadosCliente.nomeProjeto?.trim()
          || `Sistema FV ${dim.potenciaRealKwp ?? '?'} kWp`

        const projeto = await criarProjeto({
          clienteId:         cliente._id,
          nome:              nomeProjeto,
          status:            'proposta',
          endereco_completo: localizacao.cidadeEstado || localizacao.endereco || '',
          latitude:          localizacao.lat  ?? null,
          longitude:         localizacao.lon  ?? null,
        })

        projetoIdAtual = String(projeto._id)

        // Persiste projetoId no contexto (futuros autosaves usarão este ID)
        dispatch({ type: 'SET_PROJETO_ID',  payload: projetoIdAtual })
        dispatch({ type: 'SET_CLIENTE_ID',  payload: String(cliente._id) })
      }

      // ── 2. Salvar todos os slices acumulados ───────────────────────────────
      const orcamentoLocal = {
        total:                 total,
        subtotalPaineis,
        subtotalInversores,
        subtotalEstrutura,
        subtotalMaoDeTrabaho,
        subtotalCabosProtecao,
      }

      const resultado = await salvarTodosSlices(projetoIdAtual, state, orcamentoLocal)

      if (resultado.falhou.length > 0) {
        console.warn('[E8] Slices com falha:', resultado.falhou)
        // Não bloqueia o sucesso — projeto já foi criado; slices podem ser re-salvos
      }

      setSalvo(true)
    } catch (e) {
      setErroSalvar(`Erro ao salvar: ${e.message}`)
    } finally {
      setSalvando(false)
    }
  }

  // Tela de sucesso após salvar
  if (salvo) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="flex justify-center">
          <div className="p-4 bg-emerald-100 rounded-full">
            <CheckCircle size={40} className="text-emerald-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Proposta salva!</h2>
        <p className="text-slate-500">
          O projeto <strong>{dadosCliente.nomeProjeto || `Sistema FV ${dim.potenciaRealKwp} kWp`}</strong> foi
          persistido com todos os slices no banco.
        </p>
        {state.projetoId && (
          <p className="text-xs text-slate-400 font-mono">ID: {state.projetoId}</p>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <Button
            variante="secundario"
            icone={Download}
            onClick={baixarPdf}
            carregando={gerando}
          >
            Baixar PDF
          </Button>
          <Button icone={ArrowRight} iconeDir
            onClick={() => navigate(state.projetoId ? `/projetos-fv/${state.projetoId}` : '/projetos-fv')}
          >
            Ver Projeto
          </Button>
        </div>
        <button
          className="text-sm text-slate-400 hover:text-slate-600 mt-4 block mx-auto"
          onClick={() => {
            // S2.8: usa resetar do contexto (limpa localStorage também)
            if (typeof resetar === 'function') resetar()
            else dispatch({ type: 'RESETAR' })
          }}
        >
          Criar novo projeto
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Orçamento</h2>
        <p className="text-sm text-slate-500 mt-1">
          Resumo completo do sistema para{' '}
          <strong>{dadosCliente.nomeCliente || '—'}</strong>.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Dados Técnicos</p>
          <LinhaResumo rotulo="Cliente"              valor={dadosCliente.nomeCliente} />
          <LinhaResumo rotulo="Projeto"              valor={dadosCliente.nomeProjeto || `Sistema FV ${dim.potenciaRealKwp} kWp`} />
          <LinhaResumo rotulo="Localização"          valor={localizacao.cidadeEstado || localizacao.endereco} />
          <LinhaResumo rotulo="Concessionária"       valor={dadosConsumo.concessionaria} />
          <LinhaResumo rotulo="Consumo mensal"       valor={`${dadosConsumo.consumoMensal} kWh/mês`} />
          <LinhaResumo rotulo="Tipo de ligação"      valor={dadosConsumo.tipoLigacao === 'monofasico' ? 'Monofásico' : dadosConsumo.tipoLigacao === 'bifasico' ? 'Bifásico' : 'Trifásico'} />
          <LinhaResumo rotulo="Tensão"               valor={`${dadosConsumo.tensao} V`} />
          <LinhaResumo rotulo="Irradiância média"    valor={`${irradiancia.mediaAnual} kWh/m²/dia${irradiancia.fonte === 'cresesb' ? ' (CRESESB)' : ''}`} />
          <LinhaResumo rotulo="Potência do sistema"  valor={`${dim.potenciaRealKwp} kWp`} />
          <LinhaResumo rotulo="Número de painéis"    valor={`${dim.numPaineis} painéis`} />
          <LinhaResumo rotulo="Número de inversores" valor={`${dim.numInversores} inversor(es)`} />
          <LinhaResumo rotulo="Área necessária"      valor={`${dim.areaMinima} m²`} />
          <LinhaResumo rotulo="Área disponível"      valor={area.areaDisponivel ? `${area.areaDisponivel} m²` : null} />
          <LinhaResumo rotulo="Orientação"           valor={`${area.orientacao} / ${area.inclinacao}°`} />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase">Equipamentos</p>
          {painel && (
            <CardEquipSelecionado
              icone={Sun} titulo="Módulo FV" item={painel}
              qtd={dim.numPaineis}
              precoUnitario={precoPainel}
              setPrecoUnitario={setPrecoPainel}
              total={subtotalPaineis}
            />
          )}
          {inversor && (
            <CardEquipSelecionado
              icone={Zap} titulo="Inversor" item={inversor}
              qtd={dim.numInversores}
              precoUnitario={precoInversor}
              setPrecoUnitario={setPrecoInversor}
              total={subtotalInversores}
            />
          )}
          {estrutura && (
            <CardEquipSelecionado
              icone={Layers} titulo="Estrutura" item={estrutura}
              qtd={dim.numPaineis}
              precoUnitario={precoEstrutura}
              setPrecoUnitario={setPrecoEstrutura}
              total={subtotalEstrutura}
            />
          )}
        </div>
      </div>

      {/* Campos editáveis - Mão de obra e Cabos */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <p className="text-sm font-semibold text-slate-700">Custos Adicionais</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Mão de obra por painel (R$)</label>
            <input
              type="number"
              value={maoDeTrabaho}
              onChange={(e) => setMaoDeTrabaho(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
              min="0"
            />
            <p className="text-xs text-slate-500 mt-1">Total: R$ {subtotalMaoDeTrabaho.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Cabos e proteções (R$)</label>
            <input
              type="number"
              value={cabosProtecao}
              onChange={(e) => setCabosProtecao(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="bg-slate-900 text-white rounded-xl p-6 space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>{dim.numPaineis} painéis × R$ {precoPainel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span>R$ {subtotalPaineis.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>{dim.numInversores} inversor(es) × R$ {precoInversor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span>R$ {subtotalInversores.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Estrutura ({dim.numPaineis} un × R$ {precoEstrutura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span>
            <span>R$ {subtotalEstrutura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Mão de obra ({dim.numPaineis} painéis × R$ {maoDeTrabaho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span>
            <span>R$ {subtotalMaoDeTrabaho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Cabos e proteções</span>
            <span>R$ {subtotalCabosProtecao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4 flex items-center justify-between">
          <span className="font-semibold">TOTAL DO INVESTIMENTO</span>
          <span
            className="text-3xl font-bold"
            style={{ color: 'var(--cor-primaria, #f97316)' }}
          >
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          * Não inclui projeto elétrico, ART, homologação na concessionária e outros serviços.
        </p>
      </div>

      {/* Erros */}
      {erroPdf && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle size={16} /> {erroPdf}
        </div>
      )}
      {erroSalvar && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle size={16} /> {erroSalvar}
        </div>
      )}
      {erroUnifilar && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle size={16} /> {erroUnifilar}
        </div>
      )}
      {erroProposta && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle size={16} /> {erroProposta}
        </div>
      )}

      {/* Entregáveis técnicos/comerciais */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <p className="text-sm font-semibold text-slate-700">Entregáveis</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variante="secundario"
            icone={GitBranch}
            onClick={baixarUnifilar}
            carregando={gerandoUnifilar}
            disabled={!painel || !inversor}
            className="w-full justify-center"
          >
            Baixar Unifilar (SVG)
          </Button>
          <Button
            variante="secundario"
            icone={FileText}
            onClick={gerarProposta}
            carregando={gerandoProposta}
            className="w-full justify-center"
          >
            Abrir Proposta Comercial
          </Button>
        </div>
        {(!painel || !inversor) && (
          <p className="text-xs text-slate-500">
            ⚠️ Selecione painel e inversor na etapa anterior para habilitar o unifilar.
          </p>
        )}
      </div>

      {/* Ações principais */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button variante="secundario" onClick={anterior} className="sm:mr-auto">
          ← Anterior
        </Button>
        <Button
          variante="secundario"
          icone={Save}
          onClick={salvarProposta}
          carregando={salvando}
        >
          Salvar Proposta
        </Button>
        <Button
          icone={Download}
          onClick={baixarPdf}
          carregando={gerando}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          Baixar Orçamento (PDF)
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <BarChart2 size={13} />
        Orçamento via jsPDF · Unifilar SVG conforme NBR 16274/5410 · Proposta válida por 15 dias
      </div>
    </div>
  )
}
