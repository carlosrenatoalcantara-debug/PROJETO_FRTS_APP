/**
 * PoliticaComercialConfig.jsx — FEATURE-004.
 * Configuração da POLÍTICA COMERCIAL EV da empresa (padrão + perfis).
 * Margem por categoria · Impostos · Apresentação · Perfis. Não toca projetos.
 */
import { useEffect, useState } from 'react'
import { DollarSign, Save, Plus, Trash2, Check } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Button from '../ui/Button'
import { buscarPoliticaComercialEmpresa, salvarPoliticaComercialEmpresa } from '../../services/politicaComercialApi'
import { POLITICA_PADRAO, normalizarPolitica, MODO_LABEL, MODOS_APRESENTACAO, PERFIS_SUGERIDOS } from '../../utils/politicaComercial'

const APRESENTACAO_CAMPOS = [
  ['mostrar_equipamentos', 'Mostrar equipamentos'], ['mostrar_materiais', 'Mostrar materiais'],
  ['mostrar_servicos', 'Mostrar serviços'], ['mostrar_precos_unitarios', 'Mostrar preços unitários'],
  ['mostrar_quantidades', 'Mostrar quantidades'], ['mostrar_subtotais', 'Mostrar subtotais'],
  ['mostrar_total_equipamentos', 'Mostrar total equipamentos'], ['mostrar_total_materiais', 'Mostrar total materiais'],
  ['mostrar_total_servicos', 'Mostrar total serviços'], ['mostrar_valor_final', 'Mostrar valor final'],
]

export default function PoliticaComercialConfig() {
  const [perfis, setPerfis] = useState([])         // [{política}]
  const [idx, setIdx] = useState(0)                // perfil em edição
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    buscarPoliticaComercialEmpresa()
      .then((pc) => {
        const lista = Array.isArray(pc?.perfis) && pc.perfis.length
          ? pc.perfis.map(normalizarPolitica)
          : [normalizarPolitica(pc?.padrao || POLITICA_PADRAO)]
        setPerfis(lista); setIdx(0)
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  const p = perfis[idx] || normalizarPolitica(POLITICA_PADRAO)
  const patch = (chg) => setPerfis((prev) => prev.map((x, i) => (i === idx ? { ...x, ...chg } : x)))
  const patchMargem = (chg) => patch({ margem: { ...p.margem, ...chg } })
  const patchApres = (chg) => patch({ apresentacao: { ...p.apresentacao, ...chg } })

  const novoPerfil = () => {
    const usados = perfis.map((x) => x.nome)
    const nome = PERFIS_SUGERIDOS.find((n) => !usados.includes(n)) || `Perfil ${perfis.length + 1}`
    setPerfis((prev) => [...prev, normalizarPolitica({ ...POLITICA_PADRAO, nome })]); setIdx(perfis.length)
  }
  const removerPerfil = () => {
    if (perfis.length <= 1) return
    setPerfis((prev) => prev.filter((_, i) => i !== idx)); setIdx(0)
  }

  const salvar = async () => {
    try {
      setSalvando(true); setErro(null)
      // padrão = primeiro perfil "Padrão Empresa" (ou o primeiro da lista)
      const padrao = perfis.find((x) => /padr[ãa]o/i.test(x.nome)) || perfis[0]
      await salvarPoliticaComercialEmpresa({ padrao, perfis })
      setSalvo(true); setTimeout(() => setSalvo(false), 2500)
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  const chk = (checked, onChange, label) => (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="accent-blue-600" />{label}
    </label>
  )
  const pct = (label, val, onChange) => (
    <div><label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type="number" value={val} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-right" /></div>
  )

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <DollarSign size={18} className="text-emerald-600" />
        <h2 className="font-semibold text-slate-900">Política Comercial EV</h2>
      </CardHeader>
      <CardBody className="space-y-5">
        {carregando ? <p className="text-sm text-slate-500">Carregando…</p> : (<>
          {/* Perfis */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Perfis</span>
            {perfis.map((x, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`text-xs px-2.5 py-1 rounded-full border ${i === idx ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                {x.nome}
              </button>
            ))}
            <button onClick={novoPerfil} className="text-xs text-emerald-700 inline-flex items-center gap-1"><Plus size={12} /> Novo perfil</button>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Nome do perfil</label>
            <input value={p.nome} onChange={(e) => patch({ nome: e.target.value })}
              className="w-full max-w-xs border border-slate-300 rounded px-3 py-1.5 text-sm" />
          </div>

          {/* MARGEM por categoria */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Margem</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                {chk(p.margem.aplicar_materiais, (v) => patchMargem({ aplicar_materiais: v }), 'Aplicar em Materiais')}
                {pct('% Materiais', p.margem.materiais_pct, (v) => patchMargem({ materiais_pct: v }))}
              </div>
              <div className="space-y-2">
                {chk(p.margem.aplicar_equipamentos, (v) => patchMargem({ aplicar_equipamentos: v }), 'Aplicar em Equipamentos')}
                {pct('% Equipamentos', p.margem.equipamentos_pct, (v) => patchMargem({ equipamentos_pct: v }))}
              </div>
              <div className="space-y-2">
                {chk(p.margem.aplicar_servicos, (v) => patchMargem({ aplicar_servicos: v }), 'Aplicar em Serviços')}
                {pct('% Serviços', p.margem.servicos_pct, (v) => patchMargem({ servicos_pct: v }))}
              </div>
            </div>
          </div>

          {/* IMPOSTOS */}
          <div className="max-w-xs">
            <p className="text-sm font-semibold text-slate-700 mb-2">Impostos</p>
            {pct('Percentual padrão (%)', p.impostos_pct, (v) => patch({ impostos_pct: v }))}
          </div>

          {/* APRESENTAÇÃO */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Apresentação</p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Modo padrão da proposta</label>
              <select value={p.modo_apresentacao} onChange={(e) => patch({ modo_apresentacao: e.target.value })}
                className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white mb-3">
                {Object.keys(MODOS_APRESENTACAO).map((m) => <option key={m} value={m}>{MODO_LABEL[m]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              {APRESENTACAO_CAMPOS.map(([k, label]) => (
                <div key={k}>{chk(p.apresentacao[k], (v) => patchApres({ [k]: v }), label)}</div>
              ))}
            </div>
          </div>

          {erro && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{erro}</p>}

          <div className="flex items-center gap-2">
            <Button icone={Save} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar política'}</Button>
            {perfis.length > 1 && <Button variante="secundario" icone={Trash2} onClick={removerPerfil} className="text-red-600">Remover perfil</Button>}
            {salvo && <span className="text-emerald-700 text-sm inline-flex items-center gap-1"><Check size={14} /> Salvo</span>}
          </div>
        </>)}
      </CardBody>
    </Card>
  )
}
