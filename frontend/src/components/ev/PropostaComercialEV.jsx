/**
 * PropostaComercialEV.jsx — Sprint P2-EV-WORKFLOW-CONSOLIDATION-01
 *
 * ETAPA 3 — COMERCIAL. Proposta pronta, 100% READ-ONLY.
 *   • Não edita lista de materiais.
 *   • Não recalcula engenharia.
 *   • Lê o snapshot do orçamento montado na ETAPA 2 (fonte única da verdade).
 *
 * Para alterar qualquer dado técnico/econômico, o usuário retorna à ETAPA 2.
 *
 * Contém: dados do cliente, carregador, resumo de materiais, resumo de
 * serviços, projeto/ART-CFT/deslocamento, resumo financeiro, valor final,
 * fluxo comercial (status) e ações (Salvar, PDF, WhatsApp, E-mail).
 */
import { useMemo } from 'react'
import { User, Zap, Package, Wrench, DollarSign, Save, FileText, MessageCircle, Mail, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { calcularOrcamento, subtotalItem } from '../../utils/calcularOrcamento'
import { normalizarPolitica, margemDaPolitica, flagsApresentacao, MODO_LABEL, MODOS_APRESENTACAO } from '../../utils/politicaComercial'

const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// FEATURE-008: pipeline comercial ÚNICO — mesmo enum de ProjetoEV.status (fonte única
// de verdade, também usada na página de visualização e no futuro board do CRM). Não
// existe mais orcamento.status paralelo.
export const STATUS_COMERCIAL = ['dimensionado', 'aguardando_cliente', 'aprovado', 'homologacao', 'concluido']
export const STATUS_COMERCIAL_LABEL = {
  dimensionado: 'Dimensionado',
  aguardando_cliente: 'Aguardando cliente',
  aprovado: 'Aprovado',
  homologacao: 'Homologação',
  concluido: 'Concluído',
}

function Bloco({ titulo, icone: Icone, children }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
        <Icone size={15} className="text-blue-500" /> {titulo}
      </h4>
      {children}
    </div>
  )
}

export default function PropostaComercialEV({
  dados = {},
  carregadores = [],
  orcamento,
  status = 'dimensionado',
  onStatusChange,
  onSalvar,
  onOrcamentoChange,
}) {
  const equipamentos = orcamento?.equipamentos || []
  const materiais    = orcamento?.materiais || []
  const servicos     = orcamento?.servicos || []
  const desconto_pct = orcamento?.desconto_pct ?? 0
  // FEATURE-004 — Política Comercial é a fonte da margem/impostos e do modo de apresentação.
  const politica = orcamento?.politica ? normalizarPolitica(orcamento.politica) : null
  const margem_pct   = politica ? politica.margem.materiais_pct : (orcamento?.margem_pct ?? 0)
  const impostos_pct = politica ? politica.impostos_pct : (orcamento?.impostos_pct ?? 0)
  // Modo de apresentação (4 modos). Compat: mostrar_materiais_detalhados=false → resumo.
  const modo = politica?.modo_apresentacao || (orcamento?.mostrar_materiais_detalhados === false ? 'resumo' : 'detalhada_com_precos')
  const ap = flagsApresentacao(modo)
  const setModo = (m) => onOrcamentoChange?.(politica
    ? { politica: { ...politica, modo_apresentacao: m }, politica_herdada: false }
    : { mostrar_materiais_detalhados: m !== 'resumo' && m !== 'valor_final', modo_apresentacao: m })

  const resumo = useMemo(
    () => calcularOrcamento({
      equipamentos, materiais, servicos, desconto_pct,
      ...(politica ? { margem: margemDaPolitica(politica), impostos_pct: politica.impostos_pct } : { margem_pct, impostos_pct }),
    }),
    [equipamentos, materiais, servicos, margem_pct, impostos_pct, desconto_pct, politica]
  )

  // Agrupa materiais por categoria para o resumo (read-only)
  const materiaisPorCategoria = useMemo(() => {
    const m = {}
    materiais.forEach((it) => {
      const cat = it.categoria || 'Outros'
      ;(m[cat] = m[cat] || []).push(it)
    })
    return m
  }, [materiais])

  const carregadorPrincipal = carregadores[0]
  const potenciaTotal = carregadores.reduce((s, c) => s + (Number(c.potencia_kw) || 0) * (Number(c.quantidade) || 1), 0)

  // ── Texto da proposta (WhatsApp / e-mail) — respeita o toggle de detalhamento ──
  const textoProposta = useMemo(() => {
    const linhas = [
      `*Proposta Comercial — ${dados.nome_projeto || 'Carregador EV'}*`,
      `Cliente: ${dados.cliente_nome || '—'}`,
      `Local: ${dados.endereco || '—'}`,
      '',
      `Carregador: ${carregadorPrincipal ? `${carregadorPrincipal.marca || ''} ${carregadorPrincipal.modelo || ''}`.trim() : '—'} (${potenciaTotal}kW)`,
    ]
    // FEATURE-004 — respeita o MODO de apresentação (4 modos)
    if (ap.itens) {
      linhas.push(`Equipamentos: ${brl(resumo.subtotal_equipamentos)}`)
      if (materiais.length) {
        linhas.push('Materiais:')
        materiais.forEach((it) => linhas.push(`  • ${it.descricao} — ${it.quantidade} ${it.unidade || ''}${ap.precos ? ` — ${brl(subtotalItem(it))}` : ''}`))
        if (ap.precos) linhas.push(`  Subtotal materiais: ${brl(resumo.materiais_com_margem)}`)
      }
      linhas.push(`Serviços: ${brl(resumo.subtotal_servicos)}`)
      if (ap.precos && resumo.impostos_valor > 0) linhas.push(`Impostos: ${brl(resumo.impostos_valor)}`)
    } else if (ap.resumo) {
      linhas.push(`Equipamentos: ${brl(resumo.subtotal_equipamentos)}`)
      linhas.push(`Materiais: ${brl(resumo.materiais_com_margem)}`)
      linhas.push(`Serviços: ${brl(resumo.subtotal_servicos)}`)
      if (resumo.impostos_valor > 0) linhas.push(`Impostos: ${brl(resumo.impostos_valor)}`)
    }
    if (ap.final) linhas.push('', `*Valor final: ${brl(resumo.preco_final)}*`)
    linhas.push('', `Resp. técnico: ${dados.tecnico_nome || '—'} (${dados.tecnico_tipo === 'cft' ? `CFT ${dados.tecnico_cft || ''}` : `CREA ${dados.tecnico_crea || ''}`})`)
    return linhas.join('\n')
  }, [dados, carregadorPrincipal, potenciaTotal, resumo, modo, materiais])

  const enviarWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(textoProposta)}`, '_blank', 'noopener')
  }

  const enviarEmail = () => {
    const assunto = `Proposta Comercial — ${dados.nome_projeto || 'Carregador EV'}`
    window.location.href = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(textoProposta.replace(/\*/g, ''))}`
  }

  const gerarPDF = () => {
    // PDF comercial 100% frontend: janela de impressão com o conteúdo da proposta.
    const win = window.open('', '_blank')
    if (!win) { alert('Permita pop-ups para gerar o PDF.'); return }
    const linhaItens = (arr) => arr.map((it) =>
      `<tr><td>${it.descricao}</td><td style="text-align:center">${it.quantidade} ${it.unidade || ''}</td>${ap.precos ? `<td style="text-align:right">${brl(subtotalItem(it))}</td>` : ''}</tr>`
    ).join('')
    win.document.write(`
      <html><head><title>Proposta — ${dados.nome_projeto || 'EV'}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#1e293b;padding:32px;max-width:900px;margin:auto}
        h1{font-size:20px;border-bottom:2px solid #2563eb;padding-bottom:8px}
        h2{font-size:14px;color:#475569;margin-top:24px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
        td,th{border-bottom:1px solid #e2e8f0;padding:6px 4px;text-align:left}
        .total{font-size:18px;font-weight:bold;color:#059669;text-align:right;margin-top:16px}
        .meta{font-size:12px;color:#64748b}
      </style></head><body>
      <h1>Proposta Comercial — ${dados.nome_projeto || 'Carregador EV'}</h1>
      <p class="meta"><b>Cliente:</b> ${dados.cliente_nome || '—'}<br/><b>Local:</b> ${dados.endereco || '—'}<br/>
      <b>Carregador:</b> ${carregadorPrincipal ? `${carregadorPrincipal.marca || ''} ${carregadorPrincipal.modelo || ''}`.trim() : '—'} — ${potenciaTotal}kW</p>
      ${ap.itens ? `
      <h2>Equipamentos</h2><table>${linhaItens(equipamentos)}</table>
      <h2>Materiais</h2><table>${linhaItens(materiais)}</table>
      <h2>Serviços</h2><table>${linhaItens(servicos)}</table>` : ''}
      ${ap.resumo ? `
      <h2>Composição</h2>
      <table>
        <tr><td>Equipamentos</td><td style="text-align:right">${brl(resumo.subtotal_equipamentos)}</td></tr>
        <tr><td>Materiais</td><td style="text-align:right">${brl(resumo.subtotal_materiais)}</td></tr>
        <tr><td>Margem Materiais (${margem_pct}%)</td><td style="text-align:right">+ ${brl(resumo.margem_valor)}</td></tr>
        <tr><td><b>Subtotal Materiais</b></td><td style="text-align:right"><b>${brl(resumo.materiais_com_margem)}</b></td></tr>
        <tr><td>Serviços</td><td style="text-align:right">${brl(resumo.subtotal_servicos)}</td></tr>
        <tr><td>Impostos (${impostos_pct}%)</td><td style="text-align:right">+ ${brl(resumo.impostos_valor)}</td></tr>
        ${desconto_pct > 0 ? `<tr><td>Desconto (${desconto_pct}%)</td><td style="text-align:right">- ${brl(resumo.desconto_valor)}</td></tr>` : ''}
      </table>` : ''}
      ${ap.final ? `<p class="total">Valor Final: ${brl(resumo.preco_final)}</p>` : ''}
      <p class="meta">Resp. técnico: ${dados.tecnico_nome || '—'} —
        ${dados.tecnico_tipo === 'cft' ? `CFT ${dados.tecnico_cft || ''}` : `CREA ${dados.tecnico_crea || ''}`}</p>
      </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  const linhaResumo = (label, valor, bold) => (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold border-t border-slate-300 pt-1' : ''}`}>
      <span className={bold ? 'text-slate-900' : 'text-slate-500'}>{label}</span>
      <span className={`font-mono ${bold ? 'text-emerald-700' : ''}`}>{valor}</span>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Esta etapa é apenas leitura. Para alterar qualquer dado técnico ou econômico, retorne à <strong>Etapa 2 (Carregador + Engenharia)</strong>.
      </div>

      <Bloco titulo="Cliente" icone={User}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm">
          <p><span className="text-slate-400">Projeto:</span> {dados.nome_projeto || '—'}</p>
          <p><span className="text-slate-400">Cliente:</span> {dados.cliente_nome || '—'}</p>
          <p className="md:col-span-2"><span className="text-slate-400">Endereço:</span> {dados.endereco || '—'}</p>
          <p className="md:col-span-2"><span className="text-slate-400">Resp. técnico:</span> {dados.tecnico_nome || '—'} — {dados.tecnico_tipo === 'cft' ? `CFT ${dados.tecnico_cft || ''}` : `CREA ${dados.tecnico_crea || ''}`}</p>
        </div>
      </Bloco>

      <Bloco titulo="Carregador" icone={Zap}>
        {carregadorPrincipal ? (
          <div className="text-sm">
            <p className="font-semibold text-slate-800">{carregadorPrincipal.marca} {carregadorPrincipal.modelo}</p>
            <p className="text-slate-500 text-xs">{carregadorPrincipal.tipo} · {potenciaTotal}kW total · {carregadores.length} ponto(s){carregadorPrincipal.tipo_conector ? ` · ${carregadorPrincipal.tipo_conector}` : ''}</p>
          </div>
        ) : <p className="text-slate-400 text-sm">Nenhum carregador.</p>}
      </Bloco>

      {/* FEATURE-004 — MODO de apresentação (View/PDF/WhatsApp/E-mail; nunca PDF Executivo) */}
      <div className="flex items-center gap-3 flex-wrap text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <span className="font-semibold text-slate-600 inline-flex items-center gap-1"><Eye size={13} /> Apresentação:</span>
        {Object.keys(MODOS_APRESENTACAO).map((m) => (
          <label key={m} className="flex items-center gap-1 cursor-pointer">
            <input type="radio" name="modo-apres" checked={modo === m} onChange={() => setModo(m)} className="accent-blue-600" />
            {MODO_LABEL[m]}
          </label>
        ))}
      </div>

      {ap.itens && (
        <Bloco titulo={`Materiais (${brl(resumo.materiais_com_margem)})`} icone={Package}>
          <div className="space-y-2">
            {Object.entries(materiaisPorCategoria).map(([cat, itens]) => (
              <div key={cat}>
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{cat}</p>
                <ul className="text-xs text-slate-600">
                  {itens.map((it, i) => (
                    <li key={i} className="flex justify-between border-b border-slate-50 py-0.5">
                      <span>{it.descricao}</span>
                      <span className="text-slate-400 font-mono">{it.quantidade} {it.unidade}{ap.precos ? ` · ${brl(subtotalItem(it))}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Bloco>
      )}
      {!ap.itens && ap.resumo && (
        <Bloco titulo="Materiais" icone={Package}>
          <div className="flex justify-between text-sm text-slate-700"><span>Materiais</span><span className="font-mono font-semibold">{brl(resumo.materiais_com_margem)}</span></div>
        </Bloco>
      )}

      {ap.itens && (
        <Bloco titulo={`Serviços (${brl(resumo.subtotal_servicos)})`} icone={Wrench}>
          <ul className="text-sm text-slate-600">
            {servicos.map((it, i) => (
              <li key={i} className="flex justify-between border-b border-slate-50 py-0.5">
                <span>{it.descricao}</span>
                {ap.precos && <span className="font-mono">{brl(subtotalItem(it))}</span>}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {ap.resumo && (
        <Bloco titulo="Resumo financeiro" icone={DollarSign}>
          <div className="space-y-1">
            {linhaResumo('Equipamentos', brl(resumo.subtotal_equipamentos))}
            {linhaResumo('Materiais', brl(resumo.subtotal_materiais))}
            {resumo.margem_valor > 0 && linhaResumo(`Margem Materiais (${margem_pct}%)`, `+ ${brl(resumo.margem_valor)}`)}
            {resumo.margem_equipamentos_valor > 0 && linhaResumo('Margem Equipamentos', `+ ${brl(resumo.margem_equipamentos_valor)}`)}
            {resumo.margem_servicos_valor > 0 && linhaResumo('Margem Serviços', `+ ${brl(resumo.margem_servicos_valor)}`)}
            {linhaResumo('Subtotal Materiais', brl(resumo.materiais_com_margem), true)}
            {linhaResumo('Serviços', brl(resumo.subtotal_servicos))}
            {resumo.impostos_valor > 0 && linhaResumo(`Impostos (${impostos_pct}%)`, `+ ${brl(resumo.impostos_valor)}`)}
            {desconto_pct > 0 && linhaResumo(`Desconto (${desconto_pct}%)`, `− ${brl(resumo.desconto_valor)}`)}
            {ap.final && linhaResumo('Valor Final', brl(resumo.preco_final), true)}
          </div>
        </Bloco>
      )}
      {!ap.resumo && ap.final && (
        <Bloco titulo="Valor Final" icone={DollarSign}>
          <div className="text-2xl font-bold text-emerald-700 text-right font-mono">{brl(resumo.preco_final)}</div>
        </Bloco>
      )}

      {/* Fluxo comercial */}
      <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Status comercial</span>
          <select value={status} onChange={(e) => onStatusChange?.(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white">
            {STATUS_COMERCIAL.map((s) => <option key={s} value={s}>{STATUS_COMERCIAL_LABEL[s]}</option>)}
          </select>
          {(status === 'aprovado' || status === 'homologacao' || status === 'concluido') && (
            <span className="text-[11px] text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> aprovado</span>
          )}
        </div>
      </div>

      {/* Ações comerciais */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={onSalvar}
          className="flex-1 min-w-[140px] text-sm font-medium px-3 py-2 rounded-lg inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700">
          <Save size={15} /> Salvar proposta
        </button>
        <button type="button" onClick={gerarPDF}
          className="flex-1 min-w-[140px] text-sm font-medium px-3 py-2 rounded-lg inline-flex items-center justify-center gap-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300">
          <FileText size={15} /> Gerar PDF comercial
        </button>
        <button type="button" onClick={enviarWhatsApp}
          className="flex-1 min-w-[140px] text-sm font-medium px-3 py-2 rounded-lg inline-flex items-center justify-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
          <MessageCircle size={15} /> Enviar WhatsApp
        </button>
        <button type="button" onClick={enviarEmail}
          className="flex-1 min-w-[140px] text-sm font-medium px-3 py-2 rounded-lg inline-flex items-center justify-center gap-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300">
          <Mail size={15} /> Enviar e-mail
        </button>
      </div>
    </div>
  )
}
