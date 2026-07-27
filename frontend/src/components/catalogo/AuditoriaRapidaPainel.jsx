/**
 * AuditoriaRapidaPainel — resultado da Auditoria Rápida (AE)
 *
 * Somente leitura nesta fase: apresenta o que MUDARIA. A aplicação das
 * atualizações é da fase seguinte — por isso "Aplicar Atualizações" aparece
 * desabilitado, com o motivo explícito.
 *
 * Este componente não fala com a API: recebe o relatório pronto.
 */

import { useState, useMemo } from 'react'
import { CheckCircle2, AlertTriangle, ShieldCheck, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Button from '../ui/Button'
import { FAMILIAS_AE, aplicarAtualizacoes } from '../../services/aeApi'
import { POLITICA } from '../../services/aeConfig'

function Linha({ rotulo, valor }) {
  const pontos = '.'.repeat(Math.max(2, 18 - rotulo.length))
  return (
    <div className="flex items-baseline gap-2 font-mono text-sm">
      <span className="text-slate-700">{rotulo}</span>
      <span className="text-slate-300">{pontos}</span>
      <span className="font-bold text-slate-900">{valor}</span>
    </div>
  )
}

export default function AuditoriaRapidaPainel({ relatorio, onCancelar, politica = POLITICA.PERGUNTAR, onAplicado }) {
  const [detalhes, setDetalhes] = useState(false)
  // Itens desmarcados pelo usuário: ficam de fora da aplicação.
  const [desmarcados, setDesmarcados] = useState(() => new Set())
  const [aplicando, setAplicando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erroAplicacao, setErroAplicacao] = useState(null)

  const porFamilia = useMemo(() => {
    const mapa = {}
    for (const { chave } of FAMILIAS_AE) mapa[chave] = []
    for (const item of relatorio.atualizacoes || []) {
      if (!mapa[item.familia]) mapa[item.familia] = []
      mapa[item.familia].push(item)
    }
    return mapa
  }, [relatorio])

  const alternar = (id) => {
    setDesmarcados(prev => {
      const proximo = new Set(prev)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  const idsSelecionados = (relatorio.atualizacoes || [])
    .filter(i => !desmarcados.has(i.id))
    .map(i => i.id)
  const selecionados = idsSelecionados.length
  const bloqueados = (relatorio.atualizacoes || []).reduce((n, i) => n + (i.bloqueados?.length || 0), 0)

  const somenteRelatorio = politica === POLITICA.RELATORIO

  const aplicar = async () => {
    setAplicando(true)
    setErroAplicacao(null)
    try {
      const r = await aplicarAtualizacoes({ selecionados: idsSelecionados })
      setResultado(r)
      if (onAplicado) onAplicado(r)
    } catch (err) {
      setErroAplicacao(err.message)
    } finally {
      setAplicando(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-orange-500" />
        <h2 className="font-semibold text-slate-900">Auditoria concluída</h2>
      </CardHeader>
      <CardBody>
        {/* Resumo */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
          <Linha rotulo="Equipamentos analisados" valor={relatorio.analisados} />
          <div className="h-2" />
          <p className="text-xs text-slate-500 uppercase font-semibold">Atualizações encontradas</p>
          {FAMILIAS_AE.map(({ chave, rotulo }) => (
            <Linha key={chave} rotulo={rotulo} valor={relatorio.totais_por_familia?.[chave] ?? 0} />
          ))}
          <div className="border-t border-slate-300 my-2" />
          <Linha rotulo="Total" valor={relatorio.total_atualizacoes} />
        </div>

        {/* Categorias que não são atualização */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          <div className="p-3 rounded-lg border border-green-200 bg-green-50">
            <p className="text-xs text-slate-500 uppercase font-semibold">Já atualizados</p>
            <p className="text-xl font-bold text-green-800">{relatorio.atualizados?.length ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500 uppercase font-semibold">Sem datasheet AE</p>
            <p className="text-xl font-bold text-slate-700">{relatorio.sem_datasheet?.length ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
            <p className="text-xs text-slate-500 uppercase font-semibold">Nunca auditados</p>
            <p className="text-xl font-bold text-blue-800">{relatorio.nunca_auditados?.length ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
            <p className="text-xs text-slate-500 uppercase font-semibold">Revisão</p>
            <p className="text-xl font-bold text-amber-800">{relatorio.revisao?.length ?? 0}</p>
          </div>
        </div>

        {bloqueados > 0 && (
          <p className="mt-3 text-sm text-amber-800 flex items-center gap-2">
            <Lock size={14} />
            {bloqueados} campo(s) bloqueado(s) por proteção manual — não serão alterados.
          </p>
        )}

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <Button
            variante="primario"
            onClick={aplicar}
            carregando={aplicando}
            disabled={somenteRelatorio || selecionados === 0 || Boolean(resultado)}
            title={somenteRelatorio
              ? 'Política atual: apenas gerar relatório.'
              : selecionados === 0 ? 'Nenhum equipamento selecionado.' : 'Aplicar as atualizações selecionadas'}
          >
            Aplicar Atualizações
          </Button>
          <Button variante="secundario" onClick={() => setDetalhes(v => !v)}>
            {detalhes ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Ver Detalhes
          </Button>
          <Button variante="fantasma" onClick={onCancelar}>Cancelar</Button>
        </div>

        {somenteRelatorio && (
          <p className="text-xs text-slate-500 mt-2">
            Política atual: <strong>apenas gerar relatório</strong>. Altere em Configurações para aplicar.
          </p>
        )}
        {!somenteRelatorio && !resultado && (
          <p className="text-xs text-slate-500 mt-2">
            {selecionados} de {relatorio.total_atualizacoes} selecionado(s). Nada foi alterado até aqui.
          </p>
        )}

        {erroAplicacao && (
          <p className="mt-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={14} /> Falha ao aplicar: {erroAplicacao}
          </p>
        )}

        {resultado && (
          <div className="mt-4 p-3 rounded-lg border border-green-200 bg-green-50 text-sm">
            <p className="font-medium text-green-900 flex items-center gap-2">
              <CheckCircle2 size={14} /> {resultado.aplicados} equipamento(s) atualizado(s)
            </p>
            <p className="text-xs text-slate-600 mt-1">
              ignorados: {resultado.ignorados} · alterados desde a auditoria: {resultado.estado_alterado} · erros: {resultado.erros}
            </p>
            {resultado.estado_alterado > 0 && (
              <p className="text-xs text-amber-800 mt-1">
                Alguns equipamentos mudaram após a auditoria e não foram sobrescritos. Execute a Auditoria Rápida novamente.
              </p>
            )}
          </div>
        )}

        {/* Detalhes agrupados por família */}
        {detalhes && (
          <div className="mt-5 space-y-5">
            {FAMILIAS_AE.map(({ chave, rotulo }) => {
              const itens = porFamilia[chave] || []
              if (itens.length === 0) return null
              return (
                <div key={chave}>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{rotulo}</p>
                  <div className="space-y-2">
                    {itens.map(item => (
                      <div key={item.id} className="border border-slate-200 rounded-lg p-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={!desmarcados.has(item.id)}
                            onChange={() => alternar(item.id)}
                          />
                          <span className="flex-1">
                            <span className="font-medium text-slate-800">
                              {item.fabricante} {item.modelo}
                            </span>
                            <span className="text-xs text-slate-500 ml-2 font-mono">
                              {item.versao_catalogo || '—'} → {item.versao_ae}
                            </span>
                          </span>
                        </label>

                        {/* Campos propostos */}
                        <div className="mt-2 ml-6 overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="text-left px-2 py-1 border border-slate-200 text-slate-600">Campo</th>
                                <th className="text-left px-2 py-1 border border-slate-200 text-slate-600">Atual</th>
                                <th className="text-left px-2 py-1 border border-slate-200 text-slate-600">AE</th>
                                <th className="text-left px-2 py-1 border border-slate-200 text-slate-600">Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.campos.map(c => (
                                <tr key={c.campo}>
                                  <td className="px-2 py-1 border border-slate-200 font-mono text-slate-700">{c.campo}</td>
                                  <td className="px-2 py-1 border border-slate-200 text-slate-500">{c.atual ?? '—'}</td>
                                  <td className="px-2 py-1 border border-slate-200 font-semibold text-slate-800">{String(c.proposto)}</td>
                                  <td className="px-2 py-1 border border-slate-200">
                                    {c.status === 'sobrescrita'
                                      ? <span className="text-orange-700">sobrescrever</span>
                                      : <span className="text-blue-700">preencher</span>}
                                  </td>
                                </tr>
                              ))}
                              {item.bloqueados?.map(b => (
                                <tr key={`b-${b.campo}`} className="bg-amber-50">
                                  <td className="px-2 py-1 border border-slate-200 font-mono text-slate-700">{b.campo}</td>
                                  <td className="px-2 py-1 border border-slate-200 text-slate-500">{b.atual ?? '—'}</td>
                                  <td className="px-2 py-1 border border-slate-200 text-slate-500">{String(b.proposto)}</td>
                                  <td className="px-2 py-1 border border-slate-200 text-amber-800 flex items-center gap-1">
                                    <Lock size={11} /> bloqueado por proteção manual
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {relatorio.total_atualizacoes === 0 && (
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green-600" />
                Nenhuma atualização disponível — catálogo alinhado ao AE.
              </p>
            )}

            {relatorio.erros?.length > 0 && (
              <div className="text-sm text-red-700">
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle size={14} /> {relatorio.erros.length} datasheet(s) não puderam ser lidos
                </p>
                <ul className="list-disc ml-6 mt-1 text-xs">
                  {relatorio.erros.slice(0, 5).map((e, i) => (
                    <li key={i}>{e.fabricante} {e.modelo}: {e.erro}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
