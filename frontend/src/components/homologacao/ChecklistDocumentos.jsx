import { useState, useEffect } from 'react'
import { CheckCircle, Clock, XCircle, Download } from 'lucide-react'
import Select from '../ui/Select'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { NOMES_CONCESSIONARIAS, getChecklist } from '../../data/checklistsHomologacao'

const STATUS = {
  pendente:    { rotulo: 'Pendente',    cor: 'cinza',    icone: XCircle,      cls: 'text-slate-400' },
  andamento:   { rotulo: 'Em andamento',cor: 'amarelo',  icone: Clock,        cls: 'text-amber-500' },
  concluido:   { rotulo: 'Concluído',   cor: 'verde',    icone: CheckCircle,  cls: 'text-emerald-500' },
}

const OPCOES_CONC = NOMES_CONCESSIONARIAS.map(n => ({ valor: n, rotulo: n }))

export default function ChecklistDocumentos({ projetoId, concessionariaInicial }) {
  const CHAVE_LS = `checklist_${projetoId ?? 'novo'}`

  const [concessionaria, setConcessionaria] = useState(concessionariaInicial ?? 'Genérico')
  const [statusItens, setStatusItens] = useState({})
  const [notas, setNotas] = useState({})

  const info = getChecklist(concessionaria)

  // Carrega estado salvo do localStorage
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_LS)
      if (salvo) {
        const { status, notas: n } = JSON.parse(salvo)
        setStatusItens(status ?? {})
        setNotas(n ?? {})
      }
    } catch {}
  }, [CHAVE_LS])

  // Salva automaticamente
  useEffect(() => {
    localStorage.setItem(CHAVE_LS, JSON.stringify({ status: statusItens, notas }))
  }, [statusItens, notas, CHAVE_LS])

  function ciclarStatus(id) {
    const atual  = statusItens[id] ?? 'pendente'
    const ciclo  = { pendente: 'andamento', andamento: 'concluido', concluido: 'pendente' }
    setStatusItens(prev => ({ ...prev, [id]: ciclo[atual] }))
  }

  function setNota(id, valor) {
    setNotas(prev => ({ ...prev, [id]: valor }))
  }

  // Estatísticas
  const total     = info.docs.length
  const concluidos = info.docs.filter(d => statusItens[d.id] === 'concluido').length
  const andamento  = info.docs.filter(d => statusItens[d.id] === 'andamento').length
  const pct        = total ? Math.round((concluidos / total) * 100) : 0

  // Agrupar por categoria
  const categorias = [...new Set(info.docs.map(d => d.cat))]

  function exportarResumo() {
    const linhas = [`CHECKLIST DE HOMOLOGAÇÃO - ${concessionaria}`,
      `Progresso: ${concluidos}/${total} (${pct}%)`, '',
    ]
    info.docs.forEach(d => {
      const s = statusItens[d.id] ?? 'pendente'
      const icon = s === 'concluido' ? '✅' : s === 'andamento' ? '⏳' : '❌'
      linhas.push(`${icon} [${d.cat}] ${d.texto}${notas[d.id] ? ` — ${notas[d.id]}` : ''}`)
    })
    const blob = new Blob([linhas.join('\n')], { type: 'text/plain;charset=utf-8' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `checklist-${concessionaria.replace(/\s/g, '-')}.txt`
    a.click()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <Select
          rotulo="Concessionária"
          opcoes={OPCOES_CONC}
          value={concessionaria}
          onChange={e => setConcessionaria(e.target.value)}
          className="sm:w-72"
        />
        <Button variante="secundario" tamanho="sm" icone={Download} onClick={exportarResumo} className="sm:mb-0.5">
          Exportar
        </Button>
      </div>

      {/* Barra de progresso */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-900">Progresso geral</span>
          <div className="flex gap-3 text-xs text-slate-500">
            <span className="text-emerald-600 font-medium">{concluidos} concluídos</span>
            <span className="text-amber-600 font-medium">{andamento} em andamento</span>
            <span>{total - concluidos - andamento} pendentes</span>
          </div>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: 'var(--cor-primaria,#f97316)' }}
          />
        </div>
        <p className="text-xs text-slate-500">{pct}% completo · {info.prazo}</p>
      </div>

      {/* Itens por categoria */}
      {categorias.map(cat => (
        <div key={cat}>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{cat}</h4>
          <div className="space-y-2">
            {info.docs.filter(d => d.cat === cat).map(doc => {
              const st     = statusItens[doc.id] ?? 'pendente'
              const { icone: Icone, cls } = STATUS[st]
              return (
                <div key={doc.id} className={`
                  rounded-xl border p-4 transition-colors
                  ${st === 'concluido' ? 'bg-emerald-50 border-emerald-200' :
                    st === 'andamento' ? 'bg-amber-50 border-amber-200' :
                    'bg-white border-slate-200'}
                `}>
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => ciclarStatus(doc.id)}
                      className={`mt-0.5 shrink-0 transition-transform hover:scale-110 ${cls}`}
                      title="Clique para avançar status"
                    >
                      <Icone size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-slate-900">{doc.texto}</span>
                        <div className="flex gap-1 shrink-0">
                          {doc.obrigatorio && <Badge cor="vermelho">Obrig.</Badge>}
                          <Badge cor={STATUS[st].cor}>{STATUS[st].rotulo}</Badge>
                        </div>
                      </div>
                      {/* Nota */}
                      <input
                        type="text"
                        placeholder="Adicionar nota..."
                        value={notas[doc.id] ?? ''}
                        onChange={e => setNota(doc.id, e.target.value)}
                        className="mt-2 w-full text-xs px-2 py-1 rounded border border-slate-200
                                   bg-white/70 focus:outline-none focus:border-slate-400 placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
