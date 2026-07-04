/**
 * OrcamentoEV.jsx — Sprint P2-EV-WORKFLOW-CONSOLIDATION-01
 *
 * EDITOR DE CUSTOS da ETAPA 2 (Carregador + Engenharia).
 * Componente 100% CONTROLADO: todo o estado vive no pai (NovaPropostaEV),
 * que é a ÚNICA fonte da verdade. Aqui só renderizamos e emitimos onChange.
 *
 * Edita: Equipamentos · Materiais · Serviços · Margem · Desconto.
 * Mostra: custo direto · lucro (margem) · valor sugerido · valor final.
 *
 * NÃO contém mais workflow comercial / aprovação / gate de unifilar —
 * isso migrou para a ETAPA 3 (PropostaComercialEV), que é read-only.
 *
 * BUG P6 — perda de foco: `Tabela` declarada NO TOPO DO MÓDULO
 *   (identidade estável entre re-renders do pai). Nunca mover para dentro.
 */
import { useMemo, useState } from 'react'
import { Plus, Trash2, Wrench, Package, DollarSign, AlertTriangle } from 'lucide-react'
import { calcularOrcamento, subtotalItem } from '../../utils/calcularOrcamento'
import MaterialAutocomplete, { materialParaLinha } from './MaterialAutocomplete'
import ModalNovoMaterial from './ModalNovoMaterial'
import { normalizarPolitica, margemDaPolitica } from '../../utils/politicaComercial'

const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const numInput = 'w-20 text-right border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// Serviços padrão da instalação EV (custos exigidos pela sprint na etapa 2)
export const DEFAULT_SERVICOS_EV = [
  { descricao: 'Mão de obra (instalação)', quantidade: 1, unidade: 'serviço', preco_unitario: 0 },
  { descricao: 'Projeto elétrico',          quantidade: 1, unidade: 'serviço', preco_unitario: 0 },
  { descricao: 'ART/CFT',                    quantidade: 1, unidade: 'serviço', preco_unitario: 0 },
  { descricao: 'Deslocamento',              quantidade: 1, unidade: 'serviço', preco_unitario: 0 },
  { descricao: 'Comissionamento / testes',  quantidade: 1, unidade: 'serviço', preco_unitario: 0 },
]

// Converte o BOM de engenharia (item/especificacao/quantidade) em linhas de custo.
export function bomParaMateriais(bom = []) {
  return bom.map((b) => ({
    descricao: b.descricao || `${b.item || ''}${b.especificacao ? ` (${b.especificacao})` : ''}`.trim(),
    quantidade: Number(b.quantidade) || 0,
    unidade: b.unidade || 'un',
    preco_unitario: Number(b.preco_unitario) || 0,
    observacao: b.observacao || '',
    categoria: b.categoria || '',
  }))
}

// Equipamentos derivados dos carregadores selecionados (+ preço do catálogo, se houver).
export function carregadoresParaEquipamentos(carregadores = []) {
  return (carregadores || []).map((c) => ({
    descricao: `Carregador ${c.marca || ''} ${c.modelo || ''} ${c.potencia_kw || ''}kW`.trim(),
    quantidade: Number(c.quantidade) || 1,
    unidade: 'un',
    preco_unitario: Number(c.preco_unitario || c.preco) || 0,
  }))
}

// ─── Tabela declarada NO TOPO DO MÓDULO (identidade estável — BUG P6) ─────────
function Tabela({ titulo, icone: Icone, itens, onSet, onDel, onAdd, onCadastrar }) {
  const naoCadastrados = itens.filter(it => it.nao_cadastrado).length
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icone size={15} className="text-blue-500" /> {titulo}
          {naoCadastrados > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-normal text-[11px]">
              <AlertTriangle size={11} /> {naoCadastrados} sem preço no catálogo
            </span>
          )}
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
              <tr key={i} className={`border-t ${it.nao_cadastrado ? 'border-amber-100 bg-amber-50/40' : 'border-slate-100'}`}>
                <td className="py-1 pr-2">
                  <input
                    value={it.descricao}
                    onChange={(e) => onSet(i, { descricao: e.target.value })}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  {it.nao_cadastrado && onCadastrar && (
                    <button type="button" onClick={() => onCadastrar(it)}
                      className="mt-0.5 text-[10px] text-amber-700 hover:text-amber-900 inline-flex items-center gap-1 font-medium">
                      <AlertTriangle size={10} /> Não cadastrado — Cadastrar no catálogo
                    </button>
                  )}
                  {!it.nao_cadastrado && it.observacao !== undefined && (
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

// ─── Tabela de MATERIAIS — catálogo obrigatório (FEATURE-002 ITEM 4) ──────────
// Sem digitação livre: descrição vem SEMPRE de uma seleção do Cadastro de Materiais.
function TabelaMateriais({ itens, catalogo, onSet, onDel, onAdd, onCadastrarNovo }) {
  const naoCadastrados = itens.filter((it) => it.descricao && !it.material_id).length
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Wrench size={15} className="text-blue-500" /> Materiais
          <span className="text-[10px] text-slate-400 font-normal">(somente do catálogo)</span>
          {naoCadastrados > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-normal text-[11px]">
              <AlertTriangle size={11} /> {naoCadastrados} fora do catálogo
            </span>
          )}
        </h4>
        <button type="button" onClick={onAdd}
          className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1">
          <Plus size={12} /> Adicionar do catálogo
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 text-left">
              <th className="py-1 pr-2">Material (catálogo)</th>
              <th className="py-1 px-1 w-16">Qtd</th>
              <th className="py-1 px-1 w-16">Un.</th>
              <th className="py-1 px-1 w-28 text-right">Preço un.</th>
              <th className="py-1 px-1 w-28 text-right">Subtotal</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={6} className="text-slate-400 italic py-2">Nenhum material. Use “Adicionar do catálogo”.</td></tr>
            )}
            {itens.map((it, i) => (
              <tr key={i} className={`border-t ${it.descricao && !it.material_id ? 'border-amber-100 bg-amber-50/40' : 'border-slate-100'}`}>
                <td className="py-1 pr-2 min-w-[220px]">
                  <MaterialAutocomplete
                    catalogo={catalogo}
                    value={it}
                    onSelecionar={(mat) => onSet(i, mat)}
                    onCadastrarNovo={(desc) => onCadastrarNovo(i, desc)}
                  />
                </td>
                <td className="px-1">
                  <input type="number" value={it.quantidade}
                    onChange={(e) => onSet(i, { quantidade: Number(e.target.value) || 0 })}
                    className={numInput.replace('w-20', 'w-14')} />
                </td>
                <td className="px-1 text-slate-500">{it.unidade || 'un'}</td>
                <td className="px-1 text-right">
                  <input type="number" step="0.01" value={it.preco_unitario}
                    onChange={(e) => onSet(i, { preco_unitario: Number(e.target.value) || 0 })}
                    className={numInput} />
                </td>
                <td className="px-1 text-right font-mono font-semibold text-slate-700">{brl(subtotalItem(it))}</td>
                <td>
                  <button type="button" onClick={() => onDel(i)} className="text-slate-300 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Componente principal (controlado pelo pai) ───────────────────────────────

export default function OrcamentoEV({ value, onChange, catalogo = [], onCatalogoAdd }) {
  const equipamentos = value?.equipamentos || []
  const materiais    = value?.materiais || []
  const servicos     = value?.servicos || []
  const desconto_pct = value?.desconto_pct ?? 0
  // FEATURE-004: a Política Comercial é a fonte da margem/impostos. Sem política → compat FEATURE-002.
  const politica = value?.politica ? normalizarPolitica(value.politica) : null
  const margem_pct   = politica ? politica.margem.materiais_pct : (value?.margem_pct ?? 20)
  const impostos_pct = politica ? politica.impostos_pct : (value?.impostos_pct ?? 0)

  const [modalMaterial, setModalMaterial] = useState(null) // { rowIndex, descricao } | null

  const resumo = useMemo(
    () => calcularOrcamento({
      equipamentos, materiais, servicos, desconto_pct,
      ...(politica ? { margem: margemDaPolitica(politica), impostos_pct: politica.impostos_pct } : { margem_pct, impostos_pct }),
    }),
    [equipamentos, materiais, servicos, margem_pct, impostos_pct, desconto_pct, politica]
  )

  const patch = (p) => onChange?.({ ...value, ...p })
  // Edita a política DO PROJETO (personaliza) — nunca a empresa.
  const patchMargemMateriais = (pct) => politica
    ? patch({ politica: { ...politica, margem: { ...politica.margem, materiais_pct: pct } }, politica_herdada: false })
    : patch({ margem_pct: pct })
  const patchImpostos = (pct) => politica
    ? patch({ politica: { ...politica, impostos_pct: pct }, politica_herdada: false })
    : patch({ impostos_pct: pct })
  const setLinha = (chave) => (i, p) => patch({ [chave]: value[chave].map((it, k) => (k === i ? { ...it, ...p } : it)) })
  const delLinha = (chave) => (i) => patch({ [chave]: value[chave].filter((_, k) => k !== i) })
  const addLinha = (chave, base) => () => patch({ [chave]: [...(value[chave] || []), { ...base }] })

  // ITEM 5 — cadastro de material inexistente: grava no catálogo (SSOT) e seleciona.
  const onMaterialCriado = (novo) => {
    if (!novo) { setModalMaterial(null); return }
    onCatalogoAdd?.(novo)                              // adiciona ao catálogo do pai
    const linha = materialParaLinha(novo)
    const idx = modalMaterial?.rowIndex
    if (idx != null && materiais[idx]) setLinha('materiais')(idx, linha)
    else patch({ materiais: [...materiais, { ...linha, quantidade: 1 }] })
    setModalMaterial(null)
  }

  return (
    <div className="space-y-6">
      <Tabela titulo="Equipamentos" icone={Package} itens={equipamentos}
        onSet={setLinha('equipamentos')}
        onAdd={addLinha('equipamentos', { descricao: '', quantidade: 1, unidade: 'un', preco_unitario: 0 })}
        onDel={delLinha('equipamentos')} />
      <TabelaMateriais itens={materiais} catalogo={catalogo}
        onSet={setLinha('materiais')}
        onDel={delLinha('materiais')}
        onAdd={addLinha('materiais', { descricao: '', quantidade: 1, unidade: 'un', preco_unitario: 0, material_id: null })}
        onCadastrarNovo={(rowIndex, descricao) => setModalMaterial({ rowIndex, descricao })} />
      <Tabela titulo="Serviços" icone={Wrench} itens={servicos}
        onSet={setLinha('servicos')}
        onDel={delLinha('servicos')}
        onAdd={addLinha('servicos', { descricao: 'Outros', quantidade: 1, unidade: 'serviço', preco_unitario: 0 })} />

      {/* Resumo financeiro profissional — ITEM 6 (composição clara) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <DollarSign size={15} className="text-emerald-600" /> Resumo financeiro
        </h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span className="text-slate-500">Equipamentos</span>
          <span className="text-right font-mono">{brl(resumo.subtotal_equipamentos)}</span>

          <span className="text-slate-500">Materiais</span>
          <span className="text-right font-mono">{brl(resumo.subtotal_materiais)}</span>
          <span className="text-slate-500 flex items-center gap-1">
            Margem Materiais
            <input type="number" value={margem_pct}
              onChange={(e) => patchMargemMateriais(Number(e.target.value) || 0)}
              className="w-14 border border-slate-300 rounded px-1 py-0.5 text-xs text-right" />%
          </span>
          <span className="text-right font-mono text-emerald-700">+ {brl(resumo.margem_valor)}</span>
          <span className="text-slate-700 font-semibold border-t border-slate-200 pt-1">Subtotal Materiais</span>
          <span className="text-right font-mono font-semibold border-t border-slate-200 pt-1">{brl(resumo.materiais_com_margem)}</span>

          <span className="text-slate-500">Serviços</span>
          <span className="text-right font-mono">{brl(resumo.subtotal_servicos)}</span>
          <span className="text-slate-500 flex items-center gap-1">
            Impostos
            <input type="number" value={impostos_pct}
              onChange={(e) => patchImpostos(Number(e.target.value) || 0)}
              className="w-14 border border-slate-300 rounded px-1 py-0.5 text-xs text-right" />%
          </span>
          <span className="text-right font-mono text-slate-600">+ {brl(resumo.impostos_valor)}</span>

          {desconto_pct > 0 && (<>
            <span className="text-slate-500 flex items-center gap-1">
              Desconto
              <input type="number" value={desconto_pct}
                onChange={(e) => patch({ desconto_pct: Number(e.target.value) || 0 })}
                className="w-14 border border-slate-300 rounded px-1 py-0.5 text-xs text-right" />%
            </span>
            <span className="text-right font-mono text-red-600">− {brl(resumo.desconto_valor)}</span>
          </>)}
          {desconto_pct === 0 && (<>
            <span className="text-slate-400 text-[11px] flex items-center gap-1">
              Desconto (opcional)
              <input type="number" value={desconto_pct}
                onChange={(e) => patch({ desconto_pct: Number(e.target.value) || 0 })}
                className="w-14 border border-slate-200 rounded px-1 py-0.5 text-xs text-right" />%
            </span>
            <span />
          </>)}

          <span className="text-base font-bold text-slate-900 border-t border-slate-300 pt-1">Valor Final</span>
          <span className="text-right text-base font-bold text-emerald-700 font-mono border-t border-slate-300 pt-1">
            {brl(resumo.preco_final)}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 pt-1">
          Margem incide apenas sobre materiais. Impostos incidem sobre (materiais com margem + serviços).
        </p>
      </div>

      {modalMaterial && (
        <ModalNovoMaterial
          descricaoInicial={modalMaterial.descricao || ''}
          onClose={() => setModalMaterial(null)}
          onCriado={onMaterialCriado}
        />
      )}
    </div>
  )
}
