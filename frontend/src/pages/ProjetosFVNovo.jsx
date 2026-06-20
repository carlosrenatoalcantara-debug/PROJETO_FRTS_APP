import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { X, AlertTriangle, Cloud, CloudOff, Check } from 'lucide-react'
import { ProjetoFVProvider, useProjetoFV } from '../contexts/ProjetoFVContext'
import { buscarProjeto, salvarEtapa, criarProjeto, resolverClientePorNome,
         adaptarLocalizacao, adaptarDimensionamento, adaptarFatura,
         adaptarEquipamentos, adaptarLayoutSolar, adaptarWorkflow } from '../services/projetoFVApi'

const LS_KEY = 'forte_solar_wizard_fv_v3'

// Mapa: número da etapa → slice que deve ser salvo AO SAIR dela.
// P1-FV-WIZARD-PERSISTENCE-FIX-01: E2 (consumo) passa a salvar o slice 'fatura'
// assim que o projeto rascunho nasce — antes só era salvo no E8.
const ETAPA_PARA_SLICE = {
  2:   'fatura',
  3:   'localizacao',
  5:   'dimensionamento',
  6:   'layout_solar',
  7:   'equipamentos',
  // 8 / orcamento é salvo pelo próprio E8Orcamento ao criar o projeto
}
import Stepper from '../components/ui/Stepper'
import { progressoGrupos, rotuloEtapa, GRUPOS } from '../config/etapasFunilFV'
import E1Upload          from '../components/fv/etapas/E1Upload'
import E2Consumo         from '../components/fv/etapas/E2Consumo'
import E2BBeneficiarias  from '../components/fv/etapas/E2BBeneficiarias'
import E3Localizacao     from '../components/fv/etapas/E3Localizacao'
import E4Irradiancia     from '../components/fv/etapas/E4Irradiancia'
import E5Dimensionamento from '../components/fv/etapas/E5Dimensionamento'
import E6Area            from '../components/fv/etapas/E6Area'
import E7Equipamentos    from '../components/fv/etapas/E7Equipamentos'
import E8Orcamento       from '../components/fv/etapas/E8Orcamento'

const COMPONENTES = {
  1: E1Upload,
  2: E2Consumo,
  2.5: E2BBeneficiarias,
  3: E3Localizacao,
  4: E4Irradiancia,
  5: E5Dimensionamento,
  6: E6Area,
  7: E7Equipamentos,
  8: E8Orcamento,
}

function WizardInterno() {
  const navigate    = useNavigate()
  const [params, setParams] = useSearchParams()
  const { state, irParaEtapa, dispatch, resetar, ETAPAS } = useProjetoFV()
  const EtapaAtual  = COMPONENTES[state.etapa]
  const etapaAnteriorRef = useRef(state.etapa)
  // P1-FV-WIZARD-PERSISTENCE-FIX-01: guarda contra criação concorrente de rascunho
  const criandoRascunhoRef = useRef(false)

  // ── FV-11 (fix): regra arquitetural de hidratação na montagem ───────────────
  // - ?id=        → retomada de projeto existente: busca no banco e hidrata
  // - ?clienteId= → novo projeto pré-preenchido: reset total + busca cliente
  // - sem nada    → novo projeto em branco: reset total (Context + LocalStorage)
  // NUNCA restaurar de localStorage sem ?id= explícito — isso causava
  // contaminação entre projetos de clientes diferentes.
  useEffect(() => {
    const idParam        = params.get('id')
    const clienteIdParam = params.get('clienteId')

    if (idParam) {
      // Retomada via ?id=: carregar projeto do banco e hidratar todos os slices
      buscarProjeto(idParam)
        .then(p => {
          // FV-01: hidratação completa (fatura, localização, dimensionamento, área, equipamentos)
          const fe  = p.fatura_extracao  || {}
          const loc = p.localizacao      || {}
          const dim = p.dimensionamento  || {}
          const ls  = p.layout_solar     || {}
          const eq  = p.equipamentos     || {}

          // Normaliza tipo_ligacao: "Monofásico" → "monofasico"
          const normalizarFase = (tipo) => {
            if (!tipo) return 'monofasico'
            const t = tipo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            if (t.includes('trifas')) return 'trifasico'
            if (t.includes('bifas')) return 'bifasico'
            return 'monofasico'
          }

          // Painel: paineis[0] → formato Context
          const painelDB = eq.paineis?.[0] || null
          const painel   = painelDB ? {
            _id:       painelDB.equipamento_id || painelDB.id || null,
            marca:     painelDB.marca          || '',
            modelo:    painelDB.modelo         || '',
            potenciaW: painelDB.potencia_w     || null,
            quantidade: painelDB.quantidade    || null,
          } : null

          // Inversor
          const invDB   = eq.inversor || null
          const inversor = invDB ? {
            marca:      invDB.marca       || '',
            modelo:     invDB.modelo      || '',
            potenciaKW: invDB.potencia_kw || null,
            tipo:       invDB.tipo        || null,
            fases:      invDB.fases       || null,
          } : null

          // Estrutura
          const estDB    = eq.estrutura || null
          const estrutura = estDB ? {
            tipo:      estDB.tipo      || null,
            descricao: estDB.descricao || null,
          } : null

          dispatch({
            type: 'HIDRATAR',
            payload: {
              projetoId: String(p._id),
              clienteId: p.clienteId?._id ? String(p.clienteId._id) : null,
              etapa:     p.workflow?.etapa_atual ?? 1,

              // Dados do cliente
              dadosCliente: {
                nomeCliente: p.clienteId?.nome     || '',
                nomeProjeto: p.nome                || '',
                telefone:    p.clienteId?.telefone || '',
                email:       p.clienteId?.email    || '',
              },

              // Localização (v3 subdoc primeiro, fallback para campos flat)
              localizacao: {
                endereco:            loc.endereco_completo || p.endereco_completo || '',
                lat:                 loc.latitude          ?? p.latitude  ?? null,
                lon:                 loc.longitude         ?? p.longitude ?? null,
                cidadeEstado:        [loc.cidade, loc.estado].filter(Boolean).join(', '),
                uf:                  loc.estado            || null,
                geocoding_origem:    loc.geocoding_origem  || null,
                geocoding_confianca: loc.geocoding_confianca ?? null,
                geocodificado_em:    loc.geocodificado_em  || null,
              },

              // Consumo (fatura_extracao)
              dadosConsumo: {
                consumoMensal:  String(fe.consumo_mensal_kwh || ''),
                concessionaria: fe.concessionaria || '',
                distribuidora:  fe.concessionaria || '',
                tipoLigacao:    normalizarFase(fe.tipo_ligacao),
                // P1-TENSAO-380V-PARSER-01: fallback derivado do tipo quando tensao_v ausente
                tensao:         fe.tensao_v ? String(fe.tensao_v)
                                : normalizarFase(fe.tipo_ligacao) === 'trifasico' ? '380' : '220',
                valorKwh:       String(fe.valor_kwh || ''),
                grupoTarifario: fe.grupo_tarifario || '',
                fase:           fe.tipo_ligacao    || '',
                usarMeses:      (fe.historico_12meses?.length || 0) > 0,
                consumosMensais: fe.historico_12meses?.length > 0
                  ? fe.historico_12meses.map(h => String(h.consumo ?? ''))
                  : Array(12).fill(''),
                mediaAnual:     fe.media_anual_kwh || null,
                historico12Meses: fe.historico_12meses || null,
              },

              // Irradiância
              irradiancia: {
                mediaAnual: loc.irradiancia_kwh_kwp_dia ?? null,
                mensal:     null,
                carregando: false,
                erro:       null,
                fonte:      loc.fonte_irradiancia
                  ? (loc.fonte_irradiancia === 'nasa_power' ? 'nasa' : 'cresesb')
                  : null,
              },

              // Dimensionamento (v3 subdoc) — omitir chave em vez de undefined
              // para não sobrescrever estadoInicial.dimensionamento com undefined
              ...(dim.potencia_kwp && {
                dimensionamento: {
                  potenciaKwp:          dim.potencia_kwp    ?? null,
                  potenciaRealKwp:      dim.potencia_kwp    ?? null,
                  numPaineis:           dim.num_paineis     ?? null,
                  numInversores:        dim.num_inversores  ?? null,
                  areaMinima:           dim.area_total_m2   ?? null,
                  potenciaPainelW:      painelDB?.potencia_w ?? 550,
                  capacidadeInversorKW: invDB?.potencia_kw  ?? 5,
                  energiaDiaria:        null,
                  energiaNecessaria:    null,
                },
              }),

              // Área / layout solar — omitir chave em vez de undefined
              // para não sobrescrever estadoInicial.area com undefined
              ...(ls.area_util_m2 && {
                area: {
                  areaDisponivel: String(ls.area_util_m2),
                  orientacao:     ls.orientacao              || 'Norte',
                  inclinacao:     String(ls.inclinacao_graus ?? 15),
                  suficiente:     null,
                  panos:          Array.isArray(ls.roof_planes) ? ls.roof_planes : [],
                },
              }),

              // Equipamentos
              equipamentos: { painel, inversor, estrutura },
            },
          })
        })
        .catch(err => console.warn('[Wizard] Falha ao carregar projeto:', err.message))

      // P1-FV-WIZARD-PERSISTENCE-FIX-01: hidrata beneficiárias persistidas (E2.5)
      // para que F5/reabertura preserve o que foi salvo no banco.
      fetch(`/api/projetos-fv/${idParam}/beneficiarias`)
        .then(r => (r.ok ? r.json() : []))
        .then(bens => {
          if (Array.isArray(bens) && bens.length > 0) {
            dispatch({ type: 'SET_BENEFICIARIAS', payload: bens })
          }
        })
        .catch(() => {})
      return
    }

    // Sem ?id=: NOVO projeto — reset completo (LocalStorage + Context)
    if (typeof resetar === 'function') resetar()
    else {
      try { localStorage.removeItem(LS_KEY) } catch { /* noop */ }
      dispatch({ type: 'RESETAR' })
    }

    // Se veio ?clienteId=, pré-preencher SÓ dados básicos do cliente
    // (sem restaurar projeto anterior — reset já foi feito acima)
    if (clienteIdParam) {
      fetch(`/api/clientes/${clienteIdParam}`)
        .then(r => r.ok ? r.json() : null)
        .then(cliente => {
          if (!cliente || !cliente._id) return
          dispatch({ type: 'SET_CLIENTE_ID', payload: String(cliente._id) })
          dispatch({
            type: 'SET_CLIENTE',
            payload: {
              nomeCliente: cliente.nome     || '',
              telefone:    cliente.telefone || '',
              email:       cliente.email    || '',
            },
          })
          // Endereço básico do cadastro (geocoding real acontece na etapa 3)
          if (cliente.endereco_completo || cliente.cidade || cliente.estado) {
            dispatch({
              type: 'SET_LOCALIZACAO',
              payload: {
                endereco:     cliente.endereco_completo || '',
                cidadeEstado: [cliente.cidade, cliente.estado].filter(Boolean).join(', '),
                uf:           cliente.estado || null,
              },
            })
          }
          // Concessionária / UC / classificação / consumo (dados de cadastro)
          if (cliente.distribuidora || cliente.tipo_ligacao || cliente.consumo_kwh || cliente.numero_cliente) {
            const normFase = (t) => {
              if (!t) return 'monofasico'
              const s = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
              if (s.includes('trifas')) return 'trifasico'
              if (s.includes('bifas'))  return 'bifasico'
              return 'monofasico'
            }
            dispatch({
              type: 'SET_CONSUMO',
              payload: {
                concessionaria:   cliente.distribuidora  || '',
                distribuidora:    cliente.distribuidora  || '',
                tipoLigacao:      normFase(cliente.tipo_ligacao),
                consumoMensal:    cliente.consumo_kwh   ? String(cliente.consumo_kwh)  : '',
                valorKwh:         cliente.valor_kwh     ? String(cliente.valor_kwh)    : '',
                classificacao:    cliente.classificacao  || '',
                subgrupo:         cliente.subgrupo       || '',
                codigoInstalacao: cliente.codigo_instalacao || '',
                numeroCliente:    cliente.numero_cliente || '',
              },
            })
          }
          // Se o cliente já tem fatura processada, pular direto para E2 (evita upload duplo)
          if (cliente.consumo_kwh) {
            dispatch({ type: 'IR_ETAPA', payload: 2 })
          }
          // Pré-adicionar a própria UC do cliente como beneficiária (usuário só define Rateio)
          if (cliente.codigo_instalacao || cliente.numero_cliente) {
            dispatch({
              type: 'SET_BENEFICIARIAS',
              payload: [{
                localId:       `local_${cliente._id}`,
                contaContrato: cliente.codigo_instalacao || cliente.numero_cliente || '',
                titular:       cliente.nome || '',
                consumoKwh:    cliente.consumo_kwh || null,
                tipoRateio:    'percentual',
                valor:         100,
              }],
            })
          }
        })
        .catch(err => console.warn('[Wizard] Falha ao pré-preencher cliente:', err.message))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── P1-FV-WIZARD-PERSISTENCE-FIX-01: nascimento antecipado do projeto ────────
  // Cria o ProjetoFV como rascunho assim que houver dados mínimos (cliente
  // resolvível + consumo na etapa 2), ancora o id na URL (?id=) para que F5 /
  // reabertura hidratem do banco, e ativa o autosave por slice já existente.
  // Sem cliente cadastrado → retorna null e mantém o comportamento anterior
  // (sem regressão): o projeto nasce no E8 como antes.
  async function garantirProjetoRascunho() {
    if (state.projetoId) return state.projetoId
    if (criandoRascunhoRef.current) return null
    criandoRascunhoRef.current = true
    try {
      let clienteId = state.clienteId
      if (!clienteId) {
        const cliente = await resolverClientePorNome(state.dadosCliente?.nomeCliente)
        clienteId = cliente?._id || null
      }
      if (!clienteId) return null   // cliente ainda não cadastrado → adia para o E8

      const nome = state.dadosCliente?.nomeProjeto?.trim()
        || `Sistema FV ${state.dimensionamento?.potenciaRealKwp ?? state.dimensionamento?.potenciaKwp ?? 'novo'} kWp`

      const projeto = await criarProjeto({
        clienteId,
        nome,
        status:            'rascunho',
        endereco_completo: state.localizacao?.cidadeEstado || state.localizacao?.endereco || '',
        latitude:          state.localizacao?.lat ?? null,
        longitude:         state.localizacao?.lon ?? null,
      })
      const pid = String(projeto._id)
      dispatch({ type: 'SET_PROJETO_ID', payload: pid })
      dispatch({ type: 'SET_CLIENTE_ID', payload: String(clienteId) })
      // Âncora de retomada: F5 / reabrir passam a hidratar do banco via ?id=
      setParams(prev => {
        const p = new URLSearchParams(prev)
        p.set('id', pid)
        return p
      }, { replace: true })
      console.info(`[Wizard] ✓ rascunho criado no banco: ${pid}`)
      return pid
    } catch (err) {
      console.warn('[Wizard] criação de rascunho falhou:', err.message)
      return null
    } finally {
      criandoRascunhoRef.current = false
    }
  }

  // ── Autosave de slice ao avançar etapa (com nascimento antecipado) ───────────
  useEffect(() => {
    const etapaAnterior = etapaAnteriorRef.current
    const etapaAtual    = state.etapa
    etapaAnteriorRef.current = etapaAtual

    // Só salva quando avança (não na volta)
    if (etapaAtual <= etapaAnterior) return

    ;(async () => {
      let pid = state.projetoId
      // A partir de E2 (consumo concluído), garante o rascunho no banco.
      if (!pid && etapaAnterior >= 2) {
        pid = await garantirProjetoRascunho()
      }
      if (!pid) return  // sem projeto (cliente não cadastrado) → comportamento anterior

      const sliceNome = ETAPA_PARA_SLICE[etapaAnterior]
      if (sliceNome) {
        const dados = buildSliceDados(sliceNome, state)
        if (dados) {
          salvarEtapa(pid, sliceNome, dados)
            .then(() => console.info(`[Wizard] ✓ slice "${sliceNome}" salvo`))
            .catch(err => console.warn(`[Wizard] slice "${sliceNome}" falhou:`, err.message))
        }
      }
      // Sempre atualiza workflow
      salvarEtapa(pid, 'workflow', adaptarWorkflow(etapaAtual, []))
        .catch(() => {/* silencioso */})
    })()
  }, [state.etapa]) // eslint-disable-line react-hooks/exhaustive-deps

  function fechar() {
    const confirmar = state.etapa > 1
      ? window.confirm('Tem certeza que deseja sair? Os dados foram salvos no navegador.')
      : true
    if (confirmar) navigate('/projetos-fv')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Projeto Fotovoltaico</h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
            <span>
              <strong>{GRUPOS.find(g => g.chave === progressoGrupos(state.etapa).find(x => x.status === 'ativo')?.chave)?.rotulo || rotuloEtapa(state.etapa)}</strong>
              {' · '}{rotuloEtapa(state.etapa)}
            </span>
            {state.dadosCliente?.nomeCliente && (
              <span className="text-slate-400">· {state.dadosCliente.nomeCliente}</span>
            )}
            {/* S2.8: indicador de persistência */}
            {state.projetoId
              ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <Cloud size={11} /> Salvo
                </span>
              : <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <CloudOff size={11} /> Não salvo
                </span>
            }
          </p>
        </div>
        <button
          onClick={fechar}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          title="Cancelar e voltar"
        >
          <X size={20} />
        </button>
      </div>

      {/* FASE 1: progresso por macro-etapa (4) — funil enxuto, mapeamento centralizado */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-4 shadow-sm overflow-x-auto">
        <nav className="flex items-center gap-0" aria-label="Progresso">
          {progressoGrupos(state.etapa).map((g, idx, arr) => {
            const clicavel = g.status === 'concluido'
            return (
              <div key={g.chave} className="flex items-center min-w-0 flex-1">
                <div className="flex flex-col items-center gap-1 min-w-[64px] flex-1">
                  <button
                    onClick={clicavel ? () => irParaEtapa(g.primeiraEtapa) : undefined}
                    disabled={!clicavel && g.status !== 'ativo'}
                    title={g.descricao}
                    className={[
                      'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-150',
                      g.status === 'concluido' ? 'bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600 hover:scale-105' : '',
                      g.status === 'ativo'     ? 'text-white ring-2 ring-offset-2' : '',
                      g.status === 'futuro'    ? 'bg-slate-200 text-slate-400 cursor-default' : '',
                    ].filter(Boolean).join(' ')}
                    style={g.status === 'ativo' ? { backgroundColor: 'var(--cor-primaria, #f97316)', '--tw-ring-color': 'var(--cor-primaria, #f97316)' } : undefined}
                  >
                    {g.status === 'concluido' ? <Check size={16} /> : idx + 1}
                  </button>
                  <span
                    className={[
                      'text-[11px] font-medium whitespace-nowrap text-center leading-tight',
                      g.status === 'ativo'     ? 'font-semibold' : '',
                      g.status === 'concluido' ? 'text-emerald-600' : '',
                      g.status === 'futuro'    ? 'text-slate-400' : '',
                    ].filter(Boolean).join(' ')}
                    style={g.status === 'ativo' ? { color: 'var(--cor-primaria, #f97316)' } : undefined}
                  >
                    {g.rotulo}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div
                    className="h-0.5 flex-1 min-w-[12px] shrink mx-1 mb-5 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: g.status === 'concluido' ? 'var(--cor-primaria, #f97316)' : '#e2e8f0' }}
                  />
                )}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Conteúdo da etapa */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <EtapaAtual />
      </div>

      {/* P1-FV-WIZARD-PERSISTENCE-FIX-01: aviso HONESTO de persistência.
          Com projetoId, cada etapa é salva no banco automaticamente; sem ele,
          o rascunho ainda não foi criado (cliente não cadastrado) e os dados
          NÃO estão protegidos contra F5/fechamento. */}
      {state.etapa > 1 && (
        <div className="flex items-center gap-2 text-xs px-1">
          <AlertTriangle size={12} className={state.projetoId ? 'text-emerald-500' : 'text-amber-500'} />
          {state.projetoId
            ? <span className="text-emerald-600">Projeto salvo no banco automaticamente a cada etapa. ID: {state.projetoId}</span>
            : <span className="text-amber-600">Rascunho ainda não salvo no servidor — conclua a Etapa 2 (consumo) com um cliente cadastrado para ativar o salvamento automático. Até lá, evite atualizar a página.</span>
          }
        </div>
      )}
    </div>
  )
}

/**
 * Monta o payload de dados para um slice específico a partir do estado do contexto.
 * Usado pelo autosave hook no WizardInterno.
 */
function buildSliceDados(sliceNome, state) {
  switch (sliceNome) {
    case 'fatura':
      return adaptarFatura(state.dadosConsumo)
    case 'localizacao':
      return adaptarLocalizacao(state.localizacao, state.irradiancia)
    case 'dimensionamento':
      return adaptarDimensionamento(state.dimensionamento, state.irradiancia)
    case 'equipamentos':
      return adaptarEquipamentos(state.equipamentos, state.dimensionamento)
    case 'layout_solar':
      return adaptarLayoutSolar(state.area)
    default:
      return null
  }
}

export default function ProjetosFVNovo() {
  return (
    <ProjetoFVProvider>
      <WizardInterno />
    </ProjetoFVProvider>
  )
}
