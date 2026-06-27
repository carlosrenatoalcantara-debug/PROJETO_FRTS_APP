/**
 * OrcamentoEV.jsx — P0-EV-ORCAMENTO-MATERIAIS-01
 *
 * Apresenta o resultado comercial do projeto EV: equipamentos, materiais (já
 * editados na etapa Engenharia), serviços, margem/desconto e preço final.
 * Inclui workflow comercial (status, aprovação) e gate do unifilar.
 *
 * IMPORTANTE: este componente NÃO recalcula engenharia. Recebe o BOM
 * finalizado via `bomInicial` (editado na etapa Carregador + Engenharia).
 *
 * BUG P6 — perda de foco durante edição:
 *   Causa raiz: `Tabela` declarada DENTRO de OrcamentoEV → React recriava o
 *   componente a cada render → unmount/mount → campo perdia foco.
 *   Fix: `Tabela` declarada no TOPO DO MÓDULO (escopo externo, identidade
 *   estável entre renders).
 */
import { useMemo, useState, useEffect } from 'react'
import { Plus, Trash2, Wrench, Package, DollarSign, CheckCircle2, FileText } from 'lucide-react'
import { calcularOrcamento, subtotalItem, STATUS_ORCAMENTO, STATUS_ORCAMENTO_LABEL } from '../../utils/calcularOrcamento'

const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const numInput = 'w-20 text-right border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ─── Tabela declarada NO TOPO DO MÓDULO ──────────────────────────────────────
// Identidade estável entre re-renders do pai. Nunca mover para dentro de
// OrcamentoEV — causaria perda de foco a cada keystroke (BUG P6).
function Tabela({ titulo, icone: Icone, itens, onSet, onDel, onAdd }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icone size={15} className="text-blue-500" /> {titulo}
        </h4>
        {onAdd && (
          <button type="button" onClick={onAdd}
            className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1">
            <Plus size={12} /> Adicionar
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 text-left">
              <th className="py-1 pr-2">Descrição</th>
              <th className="py-1 px-1 w-16">Qtd</th>
              <th className="py-1 px-1 w-16">Un.</th>
              <th className="py-1 px-1 w-28 text-right">Preço un.</th>
              <th className="py-1 px-1 w-28 text-right">Subtotal</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={6} className="text-slate-400 italic py-2">Nenhum item.</td></tr>
            )}
            {itens.map((it, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1 pr-2">
                  <input
                    value={it.descricao}
                    onChange={(e) => onSet(i, { descricao: e.target.value })}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  {it.observacao !== undefined && (
                    <input
                      value={it.observacao || ''}
                      onChange={(e) => onSet(i, { observacao: e.target.value })}
                      placeholder="observação"
                      className="w-full mt-0.5 border border-dashed border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-500"
                    />
                  )}
                </td>
                <td className="px-1">
                  <input type="number" value={it.quantidade}
                    onChange={(e) => onSet(i, { quantidade: Number(e.target.value) || 0 })}
                    className={numInput.replace('w-20', 'w-14')} />
                </td>
                <td className="px-1">
                  <input value={it.unidade || ''}
                    onChange={(e) => onSet(i, { unidade: e.target.value })}
                    className="w-12 border border-slate-300 rounded px-1 py-1 text-xs" />
                </td>
                <td className="px-1 text-right">
                  <input type="number" step="0.01" value={it.preco_unitario}
                    onChange={(e) => onSet(i, { preco_unitario: Number(e.target.value) || 0 })}
                    className={numInput} />
                </td>
                <td className="px-1 text-right font-mono font-semibold text-slate-700">
                  {brl(subtotalItem(it))}
                </td>
                <td>
                  {onDel && (
                    <button type="button" onClick={() => onDel(i)}
                      className="text-slate-300 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bomParaMateriais(bom = []) {
  return bom.map((b) => ({
    descricao: b.descricao || `${b.item || ''}${b.especificacao ? ` (${b.especificacao})` : ''}`.trim(),
    quantidade: Number(b.quantidade) || 0,
    unidade: b.unidade || 'un',
    preco_unitario: Number(b.preco_unitario) || 0,
    observacao: b.observacao || '',
  }))
}

const SERVICOS_PRESET = [
  { descricao: 'Mão de obra (instalação)', quantidade: 1, unidade: 'serviço', preco_unitario: 0 },
  { descricao: 'Deslocamento',             quantidade: 1, unidade: 'serviço', preco_unitario: 0 },
  { descricao: 'Comissionamento / testes', quantidade: 1, unidade: 'serviço', preco_unitario: 0 },
]

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OrcamentoEV({
  bomInicial = [],
  carregadores = [],
  onChange,
  onAprovar,
  onGerarUnifilar,
  permitirUnifilarAntesAprovacao = false,
  onTogglePermitirUnifilar,
}) {
  const [materiais, setMateriais] = useState(() => bomParaMateriais(bomInicial))
  const [equipamentos, setEquipamentos] = useState(() =>
    (carregadores || []).map((c) => ({
      descricao: `Carregador ${c.marca || ''} ${c.modelo || ''} ${c.potencia_kw || ''}kW`.trim(),
      quantidade: Number(c.quantidade) || 1,
      unidade: 'un',
      preco_unitario: Number(c.preco_unitario || c.preco) || 0,
    }))
  )
  const [servicos, setServicos] = useState(SERVICOS_PRESET)
  const [margem_pct, setMargem] = useState(20)
  const [desconto_pct, setDesconto] = useState(0)
  const [status, setStatus] = useState('rascunho')

  const resumo = useMemo(
    () => calcularOrcamento({ equipamentos, materiais, servicos, margem_pct, desconto_pct }),
    [equipamentos, materiais, servicos, margem_pct, desconto_pct]
  )

  useEffect(() => {
    onChange?.({ equipamentos, materiais, servicos, margem_pct, desconto_pct, status, resumo })
  }, [equipamentos, materiais, servicos, margem_pct, desconto_pct, status, resumo]) // eslint-disable-line

  // Helpers de edição genéricos
  const setLista = (setter) => (i, patch) => setter((l) => l.map((it, k) => (k === i ? { ...it, ...patch } : it)))
  const delLinha = (setter) => (i) => setter((l) => l.filter((_, k) => k !== i))
  const addLinha = (setter, base) => () => setter((l) => [...l, { ...base }])

  const setMat  = setLista(setMateriais),   delMat  = delLinha(setMateriais)
  const setEq   = setLista(setEquipamentos)
  const setServ = setLista(setServicos),    delServ = delLinha(setServicos)

  const aprovado    = status === 'aprovado' || status === 'instalacao' || status === 'concluido'
  const podeUnifilar = aprovado || permitirUnifilarAntesAprovacao

  function aprovar() {
    setStatus('aprovado')
    onAprovar?.({ equipamentos, materiais, servicos, margem_pct, desconto_pct, resumo })
  }

  return (
    <div className="space-y-6">
      <Tabela titulo="Equipamentos" icone={Package} itens={equipamentos} onSet={setEq} />
      <Tabela
        titulo="Materiais"
        icone={Wrench}
        itens={materiais}
        onSet={setMat}
        onDel={delMat}
        onAdd={addLinha(setMateriais, { descricao: '', quantidade: 1, unidade: 'un', preco_unitario: 0, observacao: '' })}
      />
      <Tabela
        titulo="Serviços"
        icone={Wrench}
        itens={servicos}
        onSet={setServ}
        onDel={delServ}
        onAdd={addLinha(setServicos, { descricao: 'Outros', quantidade: 1, unidade: 'serviço', preco_unitario: 0 })}
      />

      {/* Resumo financeiro */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <DollarSign size={15} className="text-emerald-600" /> Resumo financeiro
        </h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span className="text-slate-500">Equipamentos</span>
          <span className="text-right font-mono">{brl(resumo.subtotal_equipamentos)}</span>
          <span className="text-slate-500">Materiais</span>
          <span className="text-right font-mono">{brl(resumo.subtotal_materiais)}</span>
          <span className="text-slate-500">Serviços</span>
          <span className="text-right font-mono">{brl(resumo.subtotal_servicos)}</span>
          <span className="text-slate-700 font-semibold border-t border-slate-200 pt-1">Custo (subtotal)</span>
          <span className="text-right font-mono font-semibold border-t border-slate-200 pt-1">{brl(resumo.custo)}</span>
          <span className="text-slate-500 flex items-center gap-1">
            Margem
            <input type="number" value={margem_pct}
              onChange={(e) => setMargem(Number(e.target.value) || 0)}
              className="w-14 border border-slate-300 rounded px-1 py-0.5 text-xs text-right" />%
          </span>
          <span className="text-right font-mono text-emerald-700">+ {brl(resumo.margem_valor)}</span>
          <span className="text-slate-500 flex items-center gap-1">
            Desconto
            <input type="number" value={desconto_pct}
              onChange={(e) => setDesconto(Number(e.target.value) || 0)}
              className="w-14 border border-slate-300 rounded px-1 py-0.5 text-xs text-right" />%
          </span>
          <span className="text-right font-mono text-red-600">− {brl(resumo.desconto_valor)}</span>
          <span className="text-base font-bold text-slate-900 border-t border-slate-300 pt-1">Preço final</span>
          <span className="text-right text-base font-bold text-emerald-700 font-mono border-t border-slate-300 pt-1">
            {brl(resumo.preco_final)}
          </span>
        </div>
      </div>

      {/* Workflow comercial + aprovação */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Status comercial</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1 bg-white">
              {STATUS_ORCAMENTO.map((s) => (
                <option key={s} value={s}>{STATUS_ORCAMENTO_LABEL[s]}</option>
              ))}
            </select>
            {aprovado && (
              <span className="text-[11px] text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle2 size={12} /> aprovado
              </span>
            )}
          </div>
          <button type="button" onClick={aprovar} disabled={aprovado}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${
              aprovado
                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}>
            <CheckCircle2 size={15} /> {aprovado ? 'Aprovado' : 'Aprovar orçamento'}
          </button>
        </div>

        {/* Gate do unifilar */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-t border-slate-100 pt-3">
          <label className="text-xs text-slate-500 inline-flex items-center gap-1.5">
            <input type="checkbox" checked={permitirUnifilarAntesAprovacao}
              onChange={(e) => onTogglePermitirUnifilar?.(e.target.checked)}
              className="accent-blue-600" />
            Permitir gerar unifilar antes da aprovação
          </label>
          <button type="button" onClick={() => onGerarUnifilar?.()} disabled={!podeUnifilar}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${
              podeUnifilar
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}>
            <FileText size={15} /> Gerar unifilar →
          </button>
        </div>
        {!podeUnifilar && (
          <p className="text-[11px] text-amber-600">
            Aprove o orçamento para liberar o unifilar (ou marque a opção acima).
          </p>
        )}
      </div>
    </div>
  )
}
