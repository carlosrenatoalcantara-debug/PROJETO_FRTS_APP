import { useState, useMemo, useCallback } from 'react'
import { Download, Save, CheckCircle, XCircle, Sun, Zap, Layers, BarChart2, ArrowRight, Cloud, FileText, GitBranch, MessageCircle, Mail, Copy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProjetoFV } from '../../../contexts/ProjetoFVContext'
import { useEmpresa }   from '../../../contexts/EmpresaContext'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import { gerarPdfOrcamento } from '../../../utils/gerarPdfOrcamento'
// Portados de NovaProposta.jsx (consolidação do fluxo FV oficial)
import { gerarUnifilarSVG, baixarUnifilarSVG } from '../../../utils/gerarUnifilarSVG'
import { gerarPropostaPDF, abrirOuBaixarProposta } from '../../../utils/gerarPropostaPDF'
import { gerarLinkWhatsAppBR } from '../../../utils/validacaoBR'
import {
  resolverClientePorNome,
  criarProjeto,
  salvarTodosSlices,
} from '../../../services/projetoFVApi'
import GovernancaPainel from '../GovernancaPainel'
import CentroFinanceiroFV from '../CentroFinanceiroFV'
import PropostaEnterprise from '../PropostaEnterprise'
import CrmPainel from '../CrmPainel'
import { construirTodosSnapshots, construirSnapshotTecnico, construirSnapshotGeoespacial } from '../../../utils/engenhariaGovernanca'

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
  // S3.5: governança técnica (snapshots congelados)
  const [governancaProj, setGovernancaProj]   = useState(null)
  // S4: resultado do centro financeiro EPC (alimenta freeze + PDF)
  const [resultadoFinanceiro, setResultadoFinanceiro] = useState(null)
  // S4.2: governança comercial (workflow, assinaturas, cenários)
  const [comercialProj, setComercialProj] = useState(null)

  // ⚠️ Destructuring movido para ANTES dos useState que referenciam painel/inversor/estrutura
  //    para eliminar ReferenceError TDZ (Temporal Dead Zone).
  const { painel, inversor, estrutura } = equipamentos

  // CFG-04: defaults vindos da configuração financeira da empresa
  const fin = empresa?.financeiro || {}

  // FV-09: preços iniciais vêm do catálogo (precoUnitario dos seletores)
  // O usuário pode ajustar livremente — são apenas sugestões de mercado.
  const [precoPainel,    setPrecoPainel]    = useState(painel?.precoUnitario    || 620)
  const [precoInversor,  setPrecoInversor]  = useState(inversor?.precoUnitario  || 4000)
  const [precoEstrutura, setPrecoEstrutura] = useState(estrutura?.precoUnitario || 130)
  const [maoDeTrabaho,   setMaoDeTrabaho]   = useState(fin.precoMaoDeObra     ?? 50)   // R$/painel
  const [cabosProtecao,  setCabosProtecao]  = useState(fin.precoCabosProtecao ?? 1500) // R$ fixo

  const subtotalPaineis    = dim.numPaineis * precoPainel
  const subtotalInversores = dim.numInversores * precoInversor
  const subtotalEstrutura  = dim.numPaineis * precoEstrutura
  const subtotalMaoDeTrabaho = dim.numPaineis * maoDeTrabaho
  const subtotalCabosProtecao = cabosProtecao
  const total              = subtotalPaineis + subtotalInversores + subtotalEstrutura + subtotalMaoDeTrabaho + subtotalCabosProtecao

  // ── S4: snapshot técnico LIVE (engineering lock p/ o módulo financeiro) ──────
  // Calculado de forma determinística pelo mesmo motor que congela em S3.5.
  const snapshotTecnicoLive = useMemo(() => construirSnapshotTecnico({
    painel, inversor,
    arranjoMPPTs: equipamentos.arranjoMPPTs || null,
    dimensionamento: dim,
    dadosConsumo,
    uf: localizacao.uf || null,
    irradiancia,
  }), [painel, inversor, equipamentos.arranjoMPPTs, dim, dadosConsumo, localizacao.uf, irradiancia])

  const tarifaFin = useMemo(() => ({
    tarifaKwh:          Number(dadosConsumo.valorKwh) || fin.tarifaKwhPadrao || 0.95,
    reajusteAnualPct:   fin.reajusteAnualPct ?? 5,
    inflacaoEnergiaPct: fin.inflacaoEnergiaPct ?? 2,
    bandeira:           fin.bandeiraPadrao || 'verde',
  }), [dadosConsumo.valorKwh, fin])

  const custosInicaisFin = useMemo(() => ({
    custo_painel:    subtotalPaineis,
    custo_inversor:  subtotalInversores,
    custo_estrutura: subtotalEstrutura,
    custo_cabos:     subtotalCabosProtecao,
    custo_mao_obra:  subtotalMaoDeTrabaho,
    total,
  }), [subtotalPaineis, subtotalInversores, subtotalEstrutura, subtotalCabosProtecao, subtotalMaoDeTrabaho, total])

  const onResultadoFinanceiro = useCallback((r) => setResultadoFinanceiro(r), [])

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
        // Sprint 2.5: dados para topologia multi-MPPT e temperatura por UF
        arranjoMPPTs: equipamentos.arranjoMPPTs || null,
        uf:           localizacao.uf || null,
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
          nome:        empresa?.nomeEmpresa || empresa?.nomeFantasia || 'Forte Solar',
          razaoSocial: empresa?.razaoSocial || '',
          cnpj:        empresa?.cnpj || '',
          logo:        empresa?.logo || '',
          telefone:    empresa?.telefone || '',
          email:       empresa?.email || '',
          endereco:    [empresa?.endereco, empresa?.cidade, empresa?.estado].filter(Boolean).join(', '),
          responsavelTecnico: empresa?.responsavelTecnico || null,
        },
        // S4: dados do centro financeiro EPC (parcelamento, ROI, economia 25a)
        financeiro:   resultadoFinanceiro || null,
        // S4.2: cenários comerciais comparados
        comercial:    comercialProj || null,
        // S6: layout/telhado (panos, área útil, capacidade)
        geoespacial:  construirSnapshotGeoespacial({ panos: state.area?.panos || [], lat: localizacao.lat, lon: localizacao.lon, painel }),
        validadeDias: fin.validadeProposta || 15,
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
        // P1-01/02: NÃO engolir silenciosamente. Se um slice falhou, o Resumo/
        // Documentos não terão esses dados — avisa o operador para re-salvar.
        const etapas = resultado.falhou.map(f => f.etapa).join(', ')
        setErroSalvar(`Atenção: dados parcialmente salvos. Falharam: ${etapas}. Clique em salvar novamente para completar.`)
      }

      setSalvo(true)
    } catch (e) {
      setErroSalvar(`Erro ao salvar: ${e.message}`)
    } finally {
      setSalvando(false)
    }
  }

  // ── FV-10: Ações de compartilhamento ────────────────────────────────────────
  function abrirWhatsApp() {
    const telefone = dadosCliente.telefone?.replace(/\D/g, '') || ''
    const kWp      = dim.potenciaRealKwp ?? dim.potenciaKwp ?? '?'
    const msgText  =
      `Olá ${dadosCliente.nomeCliente?.split(' ')[0] || 'cliente'}, tudo bem?\n\n` +
      `Segue a proposta do seu sistema fotovoltaico:\n` +
      `• Sistema: *${kWp} kWp*\n` +
      `• Módulos: *${dim.numPaineis} painéis*\n` +
      `• Investimento: *R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n` +
      `Fico à disposição para qualquer dúvida! 🌞`

    const link = gerarLinkWhatsAppBR(telefone, msgText)
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer')
    } else {
      alert('Telefone do cliente não encontrado. Verifique os dados do cliente.')
    }
  }

  function abrirEmail() {
    const kWp     = dim.potenciaRealKwp ?? dim.potenciaKwp ?? '?'
    const assunto = `Proposta Sistema Solar ${kWp} kWp — ${dadosCliente.nomeCliente || 'Cliente'}`
    const corpo   =
      `Olá ${dadosCliente.nomeCliente || 'Cliente'},\n\n` +
      `Conforme combinado, segue a proposta do seu sistema fotovoltaico:\n\n` +
      `  Sistema: ${kWp} kWp\n` +
      `  Módulos: ${dim.numPaineis} painéis (${equipamentos.painel?.marca || ''} ${equipamentos.painel?.modelo || ''})\n` +
      `  Inversor: ${equipamentos.inversor?.marca || ''} ${equipamentos.inversor?.modelo || ''}\n` +
      `  Localização: ${localizacao.cidadeEstado || localizacao.endereco || ''}\n` +
      `  Investimento total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `Fico à disposição para qualquer dúvida.\n\nAtt.,\n${empresa?.nomeEmpresa || 'Forte Solar'}`

    const mailto = `mailto:${dadosCliente.email || ''}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`
    window.open(mailto, '_blank')
  }

  function copiarResumo() {
    const kWp  = dim.potenciaRealKwp ?? dim.potenciaKwp ?? '?'
    const texto =
      `PROPOSTA — ${dadosCliente.nomeCliente || 'Cliente'}\n` +
      `Sistema: ${kWp} kWp | ${dim.numPaineis} módulos | ${dim.numInversores} inversor(es)\n` +
      `Local: ${localizacao.cidadeEstado || localizacao.endereco || ''}\n` +
      `Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      (state.projetoId ? `ID: ${state.projetoId}` : '')
    navigator.clipboard?.writeText(texto).then(() => alert('Resumo copiado!')).catch(() => {})
  }

  // ── S3.5: monta o SVG do unifilar (mesma config do baixarUnifilar) ──────────
  function gerarUnifilarSVGString() {
    try {
      return gerarUnifilarSVG({
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
        arranjoMPPTs:  equipamentos.arranjoMPPTs || null,
        uf:            localizacao.uf || null,
      })
    } catch (e) {
      console.warn('[E8] unifilar para snapshot falhou:', e.message)
      return null
    }
  }

  // ── S3.5: constrói todos os snapshots para congelamento ─────────────────────
  function construirSnapshotsE8() {
    const orcamentoLocal = {
      total, subtotalPaineis, subtotalInversores,
      subtotalEstrutura, subtotalMaoDeTrabaho, subtotalCabosProtecao,
    }
    return construirTodosSnapshots({
      state,
      orcamentoLocal,
      unifilarSVG: (painel && inversor) ? gerarUnifilarSVGString() : null,
      resultadoFinanceiro,
      tarifa: tarifaFin,
      empresa,
    })
  }

  // Tela de sucesso após salvar
  if (salvo) {
    return (
      <div className="py-10 space-y-6 max-w-lg mx-auto text-center">
        <div className="flex justify-center">
          <div className="p-4 bg-emerald-100 rounded-full">
            <CheckCircle size={40} className="text-emerald-600" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Proposta salva!</h2>
          <p className="text-slate-500 mt-1">
            O projeto <strong>{dadosCliente.nomeProjeto || `Sistema FV ${dim.potenciaRealKwp} kWp`}</strong>{' '}
            foi persistido com todos os dados no banco.
          </p>
          {state.projetoId && (
            <p className="text-xs text-slate-400 font-mono mt-1">ID: {state.projetoId}</p>
          )}
        </div>

        {/* FV-10: ações de compartilhamento */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-left">
          <p className="text-sm font-semibold text-slate-700 text-center">Compartilhar proposta</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {dadosCliente.telefone && (
              <button
                onClick={abrirWhatsApp}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <MessageCircle size={18} />
                WhatsApp
              </button>
            )}
            <button
              onClick={abrirEmail}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Mail size={18} />
              E-mail
            </button>
            <button
              onClick={copiarResumo}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Copy size={18} />
              Copiar resumo
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200">
            <Button variante="secundario" icone={Download} onClick={baixarPdf} carregando={gerando} className="w-full justify-center">
              Orçamento PDF
            </Button>
            <Button variante="secundario" icone={GitBranch} onClick={baixarUnifilar} carregando={gerandoUnifilar} disabled={!painel || !inversor} className="w-full justify-center">
              Unifilar SVG
            </Button>
            <Button variante="secundario" icone={FileText} onClick={gerarProposta} carregando={gerandoProposta} className="w-full justify-center sm:col-span-2">
              Abrir Proposta Comercial
            </Button>
          </div>
        </div>

        {/* S3.5: Governança técnica — congelar/homologar snapshots */}
        {state.projetoId && (
          <GovernancaPainel
            projetoId={state.projetoId}
            governanca={governancaProj}
            construirSnapshots={construirSnapshotsE8}
            onAtualizar={setGovernancaProj}
            usuario={empresa?.email || dadosCliente?.email || null}
          />
        )}

        {/* S4.2: Proposta enterprise — multi-cenário, workflow, assinaturas */}
        {state.projetoId && (
          <PropostaEnterprise
            projetoId={state.projetoId}
            snapshotTecnico={snapshotTecnicoLive}
            resultadoFinanceiro={resultadoFinanceiro}
            consumoAnualKwh={(Number(dadosConsumo.consumoMensal) || 0) * 12}
            tipoLigacao={dadosConsumo.tipoLigacao || 'monofasico'}
            config={fin}
            governancaComercial={comercialProj}
            onAtualizar={setComercialProj}
            usuario={empresa?.email || dadosCliente?.email || null}
          />
        )}

        {/* S5: CRM operacional leve + comunicação auditável */}
        {state.projetoId && (
          <CrmPainel
            projetoId={state.projetoId}
            comercial={comercialProj}
            cliente={{ nome: dadosCliente.nomeCliente, email: dadosCliente.email, telefone: dadosCliente.telefone }}
            empresa={empresa}
            resumo={{ potenciaKwp: dim.potenciaRealKwp ?? dim.potenciaKwp, valor: resultadoFinanceiro?.orcamento?.preco_venda ?? total }}
            onAtualizar={setComercialProj}
            usuario={empresa?.email || dadosCliente?.email || null}
          />
        )}

        <div className="flex justify-center gap-3">
          <Button
            icone={ArrowRight}
            iconeDir
            onClick={() => navigate(state.projetoId ? `/projetos-fv/${state.projetoId}` : '/projetos-fv')}
          >
            Ver Projeto
          </Button>
        </div>

        <button
          className="text-sm text-slate-400 hover:text-slate-600"
          onClick={() => {
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

      {/* S4: Centro Financeiro EPC (camada profissional opcional) */}
      <CentroFinanceiroFV
        snapshotTecnico={snapshotTecnicoLive}
        config={fin}
        custosIniciais={custosInicaisFin}
        tarifaInicial={tarifaFin}
        consumoAnualKwh={(Number(dadosConsumo.consumoMensal) || 0) * 12}
        tipoLigacao={dadosConsumo.tipoLigacao || 'monofasico'}
        onResultado={onResultadoFinanceiro}
      />

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

      {/* Entregáveis técnicos/comerciais — FV-10 */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <p className="text-sm font-semibold text-slate-700">Entregáveis</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button variante="secundario" icone={GitBranch} onClick={baixarUnifilar} carregando={gerandoUnifilar} disabled={!painel || !inversor} className="w-full justify-center">
            Baixar Unifilar (SVG)
          </Button>
          <Button variante="secundario" icone={FileText} onClick={gerarProposta} carregando={gerandoProposta} className="w-full justify-center">
            Proposta Comercial
          </Button>
          {dadosCliente.telefone && (
            <button
              onClick={abrirWhatsApp}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors w-full"
            >
              <MessageCircle size={16} />
              Enviar por WhatsApp
            </button>
          )}
          <button
            onClick={abrirEmail}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors w-full"
          >
            <Mail size={16} />
            Enviar por E-mail
          </button>
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
