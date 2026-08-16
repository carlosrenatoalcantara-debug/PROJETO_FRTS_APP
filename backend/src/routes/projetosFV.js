import { Router } from 'express'
import {
  listarProjetosFV,
  buscarProjetoFV,
  criarProjetoFV,
  atualizarProjetoFV,
  excluirProjetoFV,
  listarProjetosFVPorCliente,
  salvarTelhado,
  obterTelhado,
  gerarUnifilarProjeto,
  salvarEtapaProjetoFV,  // S2.7 — persistência incremental por slice do Wizard v2
  congelarProjetoFV,           // S3.5 — governança
  criarRevisaoProjetoFV,
  alterarStatusGovernanca,
  detectarDivergenciaProjetoFV,
  salvarComercialProjetoFV,    // S4.2 — comercial enterprise
  atualizarWorkflowComercial,
  registrarAssinaturaComercial,
  registrarAprovacaoComercial,
  criarRevisaoComercial,       // S4.3 — revisão comercial
  congelarCenarioComercial,    // S4.3.1 — governança por cenário
  workflowCenarioComercial,
  assinarCenarioComercial,
  revisaoCenarioComercial,
  atualizarCrm,                // S5 — CRM leve + comunicação
  registrarComunicacao,
  criarCompartilhamento,
  duplicarProjetoFV,           // S8.4 — ciclo de vida
  ampliarProjetoFV,            // P1-UX-CORE-EVOLUTION-01 (FASE 4)
  totaisProjetoFV,             // P1-MULTIINVERSOR (FASE 4)
  arquivarProjetoFV,
  restaurarProjetoFV,
  alterarStatusCiclo,
} from '../controllers/projetosFVController.js'
import {
  prepararComFatura,
  finalizarComFatura,
} from '../controllers/projetoFVFunilController.js'
import {
  listarCotacoes,
  obterCotacao,
  listarOrcamentos,
  obterOrcamento,
  obterOrcamentoVigente,
  calcularFinanceiro,
  obterBaseline,
  obterGate,
  listarFases,
  criarCotacao,
  criarOrcamento,
  atualizarOrcamento,
  emitirOrcamento,
  aprovarOrcamento,
  rejeitarOrcamento,
  cancelarOrcamento,
} from '../controllers/agregadosFvController.js'

const router = Router()

// ── DEBUG ────────────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  if (req.path === '/' && req.method === 'POST') {
    console.log(`[ROUTE_DEBUG] POST /api/projetos-fv - Body:`, req.body)
  }
  next()
})

// ── Funil v2 (S2 — endpoints encadeados sem efeito no fluxo legado) ─────────
router.post('/preparar-com-fatura', prepararComFatura)
router.post('/finalizar-com-fatura', finalizarComFatura)

// ── S2.7: Persistência incremental por etapa (Wizard v2) ────────────────────
router.put('/:id/etapa',           salvarEtapaProjetoFV)

// ── S3.5: Governança técnica (snapshots, revisões, divergência) ─────────────
router.post('/:id/governanca/congelar',    congelarProjetoFV)
router.post('/:id/governanca/revisao',      criarRevisaoProjetoFV)
router.put('/:id/governanca/status',        alterarStatusGovernanca)
router.get('/:id/governanca/divergencia',   detectarDivergenciaProjetoFV)

// ── S4.2: Comercial enterprise ──────────────────────────────────────────────
router.post('/:id/governanca/comercial/snapshot',   salvarComercialProjetoFV)
router.put('/:id/governanca/comercial/workflow',     atualizarWorkflowComercial)
router.post('/:id/governanca/comercial/assinatura',  registrarAssinaturaComercial)
router.post('/:id/governanca/comercial/aprovacao',   registrarAprovacaoComercial)
router.post('/:id/governanca/comercial/revisao',     criarRevisaoComercial)

// ── S4.3.1: Governança individual por cenário ───────────────────────────────
router.post('/:id/governanca/comercial/cenario/freeze',      congelarCenarioComercial)
router.put('/:id/governanca/comercial/cenario/workflow',      workflowCenarioComercial)
router.post('/:id/governanca/comercial/cenario/assinatura',   assinarCenarioComercial)
router.post('/:id/governanca/comercial/cenario/revisao',      revisaoCenarioComercial)

// ── S5: CRM operacional leve + comunicação auditável ────────────────────────
router.put('/:id/governanca/comercial/crm',           atualizarCrm)
router.post('/:id/governanca/comercial/comunicacao',  registrarComunicacao)
router.post('/:id/governanca/comercial/compartilhar', criarCompartilhamento)

// ── FV-API-001 · API canônica dos agregados (SOMENTE LEITURA) ───────────────
// Respondem direto por Cotacao/Orcamento/Baseline/Gate, sem adapters e sem
// tocar no subdocumento legado. Nenhuma rota existente foi alterada.
// `/orcamentos/vigente` vem antes de `/orcamentos` por clareza — os padrões têm
// contagens de segmento diferentes, então não há ambiguidade de roteamento.
// Leitura
router.get('/:id/cotacoes',                 listarCotacoes)
router.get('/:id/cotacoes/:cotacaoId',      obterCotacao)
// `/vigente` ANTES de `/:orcamentoId` — senao o parametro captura a palavra.
router.get('/:id/orcamentos/vigente',       obterOrcamentoVigente)
router.get('/:id/orcamentos',               listarOrcamentos)
router.get('/:id/orcamentos/:orcamentoId',  obterOrcamento)
router.get('/:id/baseline',                 obterBaseline)
router.get('/:id/gate',                     obterGate)
router.get('/:id/fases',                    listarFases)

// ── FV-API-002 · Escrita do fluxo comercial ─────────────────────────────────
// Cada rota delega a UMA operacao de dominio. A Baseline NAO tem rota de
// escrita: ela nasce exclusivamente de `/orcamentos/:id/aprovar` e e imutavel
// (M-2) — nao existe PUT, PATCH nem DELETE para ela.
router.post('/:id/cotacoes',                          criarCotacao)
router.post('/:id/orcamentos',                        criarOrcamento)
router.put('/:id/orcamentos/:orcamentoId',            atualizarOrcamento)
router.post('/:id/orcamentos/:orcamentoId/emitir',    emitirOrcamento)
router.post('/:id/orcamentos/:orcamentoId/aprovar',   aprovarOrcamento)
router.post('/:id/orcamentos/:orcamentoId/rejeitar',  rejeitarOrcamento)
router.post('/:id/orcamentos/:orcamentoId/cancelar',  cancelarOrcamento)

// ── CRUD existente (preservado) ─────────────────────────────────────────────
router.get('/',                    listarProjetosFV)
router.get('/:id',                 buscarProjetoFV)
router.get('/:id/totais',          totaisProjetoFV)
router.get('/:id/telhado',         obterTelhado)
router.get('/cliente/:clienteId',  listarProjetosFVPorCliente)
router.post('/',                   criarProjetoFV)
router.post('/:id/telhado',        salvarTelhado)
router.post('/:id/unifilar/gerar', gerarUnifilarProjeto)
router.put('/:id',                 atualizarProjetoFV)
router.patch('/:id',               atualizarProjetoFV)  // alias para consistência com EV
router.delete('/:id',              excluirProjetoFV)

// ── S8.4: Ciclo de vida ─────────────────────────────────────────────────────
router.post('/:id/duplicar',  duplicarProjetoFV)
router.post('/:id/ampliar',   ampliarProjetoFV)
router.post('/:id/arquivar',  arquivarProjetoFV)
router.post('/:id/restaurar', restaurarProjetoFV)
router.put('/:id/status',     alterarStatusCiclo)

// FV-DOM-012 — contrato financeiro V1. POST porque executa o motor; não grava.
router.post('/:id/financeiro/calcular', calcularFinanceiro)

export default router
