/**
 * agregadosFvController.js — API canônica dos agregados FV — FV-API-001.
 *
 * Expõe em REST os agregados que o Core já implementa: Cotacao, Orcamento,
 * Baseline e o Gate de bifurcação.
 *
 * ── Princípios desta camada ──────────────────────────────────────────────────
 *  • DELEGACAO PURA (FV-API-002). Cada handler de escrita chama UMA operacao do
 *    dominio e devolve o resultado. Nenhuma regra e reimplementada aqui:
 *    validacao de estado, unicidade do aprovado e congelamento vivem nos
 *    services. O controller resolve posse (M-4), traduz erro em HTTP e serializa.
 *  • SEM ADAPTERS. Nada aqui passa por `obterOrcamentoProjeto` nem projeta a
 *    forma legada. Cada endpoint responde a forma PRÓPRIA do agregado.
 *  • SEM REGRA NOVA. Toda decisão vem dos serviços e do domínio já aprovados
 *    (`OrcamentoService`, `BaselineService`, `dominio/gate`).
 *  • M-4 em toda consulta: o escopo de organização é aplicado antes de qualquer
 *    leitura, e o projeto é verificado dentro do escopo antes de responder.
 */

import mongoose from 'mongoose'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { Cotacao } from '../models/Cotacao.js'
import { Orcamento } from '../models/Orcamento.js'
import { aplicarEscopo, tenantDoReq } from '../dominio/tenancy/index.js'
import { CotacaoService } from '../services/CotacaoService.js'
import { OrcamentoService } from '../services/OrcamentoService.js'
import { BaselineService } from '../services/BaselineService.js'
import { FASES_BIFURCACAO } from '../dominio/gate/index.js'

/** Resolve o projeto dentro do escopo do tenant. `null` = 404. */
async function projetoNoEscopo(req) {
  const { id } = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) return { erro: { status: 400, corpo: { erro: 'ID inválido' } } }
  const projeto = await ProjetoFV
    .findOne(aplicarEscopo({ _id: id }, req, { contexto: 'agregadosFv' }))
    .select('_id empresa_id nome instalacao_ref local_ref')
    .lean()
  if (!projeto) return { erro: { status: 404, corpo: { erro: 'Projeto não encontrado' } } }
  return { projeto, filtro: { projeto_ref: projeto._id, empresa_id: tenantDoReq(req) } }
}

/**
 * Resolve um agregado FILHO garantindo posse: mesmo projeto E mesma organização.
 *
 * Os services recebem `id` puro e NÃO filtram por tenant — a verificação de
 * posse é responsabilidade desta borda. Sem isso, conhecer um `_id` bastaria
 * para operar sobre o recurso de outra organização (M-4).
 */
async function filhoNoEscopo(Model, req, idParam) {
  const base = await projetoNoEscopo(req)
  if (base.erro) return base
  const filhoId = req.params[idParam]
  if (!mongoose.Types.ObjectId.isValid(filhoId)) {
    return { erro: { status: 400, corpo: { erro: `${idParam} inválido` } } }
  }
  const doc = await Model.findOne({
    _id: filhoId,
    projeto_ref: base.projeto._id,
    empresa_id: tenantDoReq(req),
  }).lean()
  if (!doc) return { erro: { status: 404, corpo: { erro: 'Recurso não encontrado neste projeto' } } }
  return { ...base, doc }
}

/** Envelope comum: identifica o projeto e o agregado respondido. */
function envelope(projeto, extra) {
  return { projeto_ref: String(projeto._id), ...extra }
}

function tratar(res, err, contexto) {
  console.error(`❌ ${contexto}:`, err.message)
  res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/projetos-fv/:id/cotacoes
 * Todas as cotações do projeto. O domínio permite N (FV-DOM-001).
 */
export const listarCotacoes = async (req, res) => {
  try {
    const { erro, projeto, filtro } = await projetoNoEscopo(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    const docs = await CotacaoService.listarPorProjeto(filtro)
    res.json(envelope(projeto, {
      total: docs.length,
      cotacoes: docs.map(serializarCotacao),
    }))
  } catch (err) { tratar(res, err, 'listarCotacoes') }
}

/**
 * GET /api/projetos-fv/:id/orcamentos
 * Todos os orçamentos do projeto — N por projeto, nenhum sobrescreve outro.
 */
export const listarOrcamentos = async (req, res) => {
  try {
    const { erro, projeto, filtro } = await projetoNoEscopo(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    const docs = await OrcamentoService.listarPorProjeto(filtro)
    const aprovado = docs.find((o) => o.estado === 'APROVADO') || null

    res.json(envelope(projeto, {
      total: docs.length,
      aprovado_ref: aprovado ? String(aprovado._id) : null,
      orcamentos: docs.map(serializarOrcamento),
    }))
  } catch (err) { tratar(res, err, 'listarOrcamentos') }
}

/**
 * GET /api/projetos-fv/:id/orcamentos/vigente
 * O orçamento que vale hoje: o aprovado manda; senão, o mais recente em
 * elaboração. Rejeitados e cancelados nunca são vigentes.
 */
export const obterOrcamentoVigente = async (req, res) => {
  try {
    const { erro, projeto, filtro } = await projetoNoEscopo(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    const doc = await OrcamentoService.vigenteDoProjeto(filtro)
    res.json(envelope(projeto, { orcamento: doc ? serializarOrcamento(doc) : null }))
  } catch (err) { tratar(res, err, 'obterOrcamentoVigente') }
}

/**
 * POST /api/projetos-fv/:id/financeiro/calcular — contrato financeiro V1 (FV-DOM-012).
 *
 * Executa EXCLUSIVAMENTE o motor canônico. O corpo da requisição é ignorado por
 * completo: totais, payback ou VPL vindos do cliente não entram no cálculo —
 * o investimento sai do orçamento canônico vigente, e geração/potência do
 * snapshot técnico congelado quando existe (engineering lock).
 *
 * Não persiste (INV-58): o resultado é derivado, não é fato.
 *
 * Decisões vigentes: D1 (payback fracionário oficial + inteiro secundário) e
 * D2 (VPL obrigatório, TMA nominal 10 % a.a. versionada). D3 segue PENDENTE —
 * sem inflação informada no projeto, os indicadores dependentes voltam `null`
 * com a lacuna declarada. Nenhum valor é assumido.
 */
export const calcularFinanceiro = async (req, res) => {
  try {
    const { erro, projeto, filtro } = await projetoNoEscopo(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    // Reler o projeto completo: `projetoNoEscopo` traz só os campos de posse.
    const completo = await ProjetoFV
      .findOne(aplicarEscopo({ _id: projeto._id }, req, { contexto: 'financeiro' }))
      .lean()
    if (!completo) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const orcamento = await OrcamentoService.vigenteDoProjeto(filtro)

    const { calcularFinanceiroDoProjeto } = await import('../dominio/financeiro/index.js')
    const resultado = calcularFinanceiroDoProjeto(completo, { orcamento })

    res.json(envelope(projeto, { financeiro: resultado }))
  } catch (err) { tratar(res, err, 'calcularFinanceiro') }
}

/**
 * GET /api/projetos-fv/:id/baseline
 * A Baseline Contratual congelada (M-2), com o conteúdo autocontido.
 * A integridade é verificada aqui — o cliente não tem como calcular o hash.
 */
export const obterBaseline = async (req, res) => {
  try {
    const { erro, projeto, filtro } = await projetoNoEscopo(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    const bl = await BaselineService.doProjeto(filtro)
    if (!bl) return res.json(envelope(projeto, { baseline: null, integra: null }))

    res.json(envelope(projeto, {
      integra: BaselineService.verificarIntegridade(bl),
      baseline: {
        _id: bl._id,
        orcamento_ref: bl.orcamento_ref,
        cotacao_ref: bl.cotacao_ref,
        conteudo: bl.conteudo,
        hash: bl.hash,
        algoritmo: bl.algoritmo,
        congelado_em: bl.congelado_em,
        congelado_por: bl.congelado_por,
      },
    }))
  } catch (err) { tratar(res, err, 'obterBaseline') }
}

/**
 * GET /api/projetos-fv/:id/gate
 * Decisão AUTORITATIVA do Gate para cada fase da bifurcação.
 *
 * A avaliação é a mesma que `BaselineService.exigirGate` usa para bloquear —
 * este endpoint apenas a expõe em leitura, sem duplicar a regra.
 */
export const obterGate = async (req, res) => {
  try {
    const { erro, projeto, filtro } = await projetoNoEscopo(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    const fases = {}
    for (const fase of FASES_BIFURCACAO) {
      const r = await BaselineService.avaliarGate(fase, filtro)
      fases[fase] = { liberado: r.liberado, motivo: r.motivo ?? null, mensagem: r.mensagem ?? null }
    }
    const baseline = await BaselineService.doProjeto(filtro)

    res.json(envelope(projeto, {
      /** Autoritativo: é a mesma decisão que bloqueia no domínio. */
      autoritativo: true,
      baseline_ref: baseline ? String(baseline._id) : null,
      fases,
    }))
  } catch (err) { tratar(res, err, 'obterGate') }
}

/**
 * GET /api/projetos-fv/:id/fases
 * Estado das fases paralelas Engenharia ∥ Homologação.
 *
 * ── Limite declarado no payload ──────────────────────────────────────────────
 * `liberada` vem do Gate — informação real. `concluida` é sempre `null` porque
 * NÃO existe agregado que registre a conclusão de uma fase (`ProjetoExecutivo` e
 * `fases.*` são da FV-DOM-006). Responder `false` afirmaria que a fase não
 * concluiu; `null` diz que não sabemos — que é a verdade.
 */
export const listarFases = async (req, res) => {
  try {
    const { erro, projeto, filtro } = await projetoNoEscopo(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    const ROTULOS = { engenharia: 'Engenharia', homologacao: 'Homologação' }
    const fases = []
    for (const chave of FASES_BIFURCACAO) {
      const r = await BaselineService.avaliarGate(chave, filtro)
      fases.push({
        chave,
        rotulo: ROTULOS[chave] ?? chave,
        paralela: true,
        liberada: r.liberado,
        motivo_bloqueio: r.liberado ? null : (r.motivo ?? null),
        // Sem agregado que registre conclusão — ver cabeçalho.
        concluida: null,
        agregado: null,
        sprint_responsavel: 'FV-DOM-006',
      })
    }

    res.json(envelope(projeto, {
      total: fases.length,
      // Avançar para Execução exige ambas concluídas; hoje não é determinável.
      ambas_concluidas: null,
      fases,
    }))
  } catch (err) { tratar(res, err, 'listarFases') }
}

// ─────────────────────────────────────────────────────────────────────────────

// ═══ ESCRITA — FV-API-002 ═══════════════════════════════════════════════════
// Cada handler abaixo é uma casca fina sobre UMA operação de domínio.
// O que o controller faz: resolve posse (M-4), chama o service, traduz erro.
// O que o controller NÃO faz: decidir estado, deduzir vigente, congelar nada.

/** `usuario` de proveniência (M-3), a partir da credencial. */
const autorDe = (req) => req.auth?.email ?? req.auth?.userId ?? null

/**
 * POST /api/projetos-fv/:id/cotacoes
 * Cria uma Cotação. O domínio permite N por projeto e impede, por construção,
 * que ela vire venda ou abra Engenharia/Homologação — o agregado não tem
 * nenhum campo nem referência para isso.
 */
export const criarCotacao = async (req, res) => {
  try {
    const { erro, projeto } = await projetoNoEscopo(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    const { rotulo, tecnologia, premissas, composicao, local_ref, instalacao_ref } = req.body || {}
    const doc = await CotacaoService.criar({
      empresa_id: tenantDoReq(req),
      projeto_ref: projeto._id,
      rotulo, tecnologia, premissas, composicao, local_ref, instalacao_ref,
      criado_por: autorDe(req),
    })
    res.status(201).json(envelope(projeto, { cotacao: serializarCotacao(doc) }))
  } catch (err) { tratar(res, err, 'criarCotacao') }
}

/** GET /api/projetos-fv/:id/cotacoes/:cotacaoId */
export const obterCotacao = async (req, res) => {
  try {
    const { erro, projeto, doc } = await filhoNoEscopo(Cotacao, req, 'cotacaoId')
    if (erro) return res.status(erro.status).json(erro.corpo)
    res.json(envelope(projeto, { cotacao: serializarCotacao(doc) }))
  } catch (err) { tratar(res, err, 'obterCotacao') }
}

/**
 * POST /api/projetos-fv/:id/orcamentos
 * Cria um Orçamento A PARTIR de uma Cotação.
 *
 * É aqui que a cotação é "escolhida": não existe — nem deve existir — operação
 * de "selecionar cotação". A escolha É a criação do orçamento com `cotacao_ref`
 * (M-1, derivação unidirecional). O service valida que a cotação pertence ao
 * mesmo projeto e à mesma organização.
 */
export const criarOrcamento = async (req, res) => {
  try {
    const { erro, projeto } = await projetoNoEscopo(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    const { cotacao_ref, numero, itens, condicoes } = req.body || {}
    const doc = await OrcamentoService.criar({
      empresa_id: tenantDoReq(req),
      projeto_ref: projeto._id,
      cotacao_ref, numero, itens, condicoes,
      criado_por: autorDe(req),
    })
    res.status(201).json(envelope(projeto, { orcamento: serializarOrcamento(doc) }))
  } catch (err) { tratar(res, err, 'criarOrcamento') }
}

/** GET /api/projetos-fv/:id/orcamentos/:orcamentoId */
export const obterOrcamento = async (req, res) => {
  try {
    const { erro, projeto, doc } = await filhoNoEscopo(Orcamento, req, 'orcamentoId')
    if (erro) return res.status(erro.status).json(erro.corpo)
    res.json(envelope(projeto, { orcamento: serializarOrcamento(doc) }))
  } catch (err) { tratar(res, err, 'obterOrcamento') }
}

/**
 * PUT /api/projetos-fv/:id/orcamentos/:orcamentoId
 * Edita o CONTEÚDO. O service recusa a partir de EMITIDO (INV-ORC-2) — o
 * controller não replica essa verificação, apenas propaga o 409.
 */
export const atualizarOrcamento = async (req, res) => {
  try {
    const { erro, projeto, doc } = await filhoNoEscopo(Orcamento, req, 'orcamentoId')
    if (erro) return res.status(erro.status).json(erro.corpo)

    const patch = {}
    for (const campo of ['itens', 'condicoes', 'numero']) {
      if (req.body?.[campo] !== undefined) patch[campo] = req.body[campo]
    }
    const atualizado = await OrcamentoService.atualizarConteudo(doc._id, patch)
    res.json(envelope(projeto, { orcamento: serializarOrcamento(atualizado) }))
  } catch (err) { tratar(res, err, 'atualizarOrcamento') }
}

/**
 * Transições de estado que NÃO congelam nada: emitir, rejeitar, cancelar.
 * `OrcamentoService.transicionar` valida contra a máquina de estados canônica.
 */
function transicaoOrcamento(estado, contexto) {
  return async (req, res) => {
    try {
      const { erro, projeto, doc } = await filhoNoEscopo(Orcamento, req, 'orcamentoId')
      if (erro) return res.status(erro.status).json(erro.corpo)

      const atualizado = await OrcamentoService.transicionar(doc._id, estado, {
        por: autorDe(req),
        motivo: req.body?.motivo ?? null,
      })
      res.json(envelope(projeto, { orcamento: serializarOrcamento(atualizado) }))
    } catch (err) { tratar(res, err, contexto) }
  }
}

export const emitirOrcamento   = transicaoOrcamento('EMITIDO',   'emitirOrcamento')
export const rejeitarOrcamento = transicaoOrcamento('REJEITADO', 'rejeitarOrcamento')
export const cancelarOrcamento = transicaoOrcamento('CANCELADO', 'cancelarOrcamento')

/**
 * POST /api/projetos-fv/:id/orcamentos/:orcamentoId/aprovar
 *
 * Delega inteiramente a `OrcamentoService.aprovar`, que já executa os cinco
 * passos exigidos: valida a transição, garante que não há outro aprovado
 * (INV-ORC-3), aprova, congela a Baseline (M-2) e devolve os dois agregados.
 *
 * NADA disso é reimplementado aqui — o controller apenas serializa o resultado.
 */
export const aprovarOrcamento = async (req, res) => {
  try {
    const { erro, projeto, doc } = await filhoNoEscopo(Orcamento, req, 'orcamentoId')
    if (erro) return res.status(erro.status).json(erro.corpo)

    const r = await OrcamentoService.aprovar(doc._id, { por: autorDe(req) })
    if (!r) return res.status(404).json({ erro: 'Orçamento não encontrado' })

    res.json(envelope(projeto, {
      orcamento: serializarOrcamento(r.orcamento),
      baseline: {
        _id: r.baseline._id,
        hash: r.baseline.hash,
        congelado_em: r.baseline.congelado_em,
        congelado_por: r.baseline.congelado_por,
      },
    }))
  } catch (err) { tratar(res, err, 'aprovarOrcamento') }
}

/** Forma canônica da Cotação na API. */
function serializarCotacao(c) {
  return {
    _id: c._id,
    rotulo: c.rotulo,
    tecnologia: c.tecnologia,
    premissas: c.premissas,
    composicao: c.composicao,
    local_ref: c.local_ref,
    instalacao_ref: c.instalacao_ref,
    criado_por: c.criado_por,
    createdAt: c.createdAt,
  }
}

/**
 * Forma canônica do Orçamento na API.
 *
 * `totais` é DERIVADO dos itens a cada leitura (INV-58) — o agregado não os
 * persiste. Calculado aqui, não lido de lugar nenhum.
 */
function serializarOrcamento(o) {
  const itens = o.itens || []
  const total_material_r = somaDe(itens.filter((i) => i.tipo !== 'servico'))
  const total_servicos_r = somaDe(itens.filter((i) => i.tipo === 'servico'))
  return {
    _id: o._id,
    numero: o.numero,
    versao: o.versao,
    estado: o.estado,
    cotacao_ref: o.cotacao_ref,
    baseline_ref: o.baseline_ref,
    itens,
    condicoes: o.condicoes,
    totais: { total_material_r, total_servicos_r, total_venda_r: total_material_r + total_servicos_r },
    emitido_em: o.emitido_em,
    aprovado_em: o.aprovado_em,
    encerrado_em: o.encerrado_em,
    motivo_encerramento: o.motivo_encerramento,
    historico: o.historico,
    createdAt: o.createdAt,
  }
}

/** Soma segura: entrada não numérica vale 0, nunca NaN. */
function somaDe(itens) {
  return itens.reduce((acc, i) => {
    const q = Number(i?.quantidade)
    const v = Number(i?.valor_unitario_r)
    return acc + (Number.isFinite(q) && Number.isFinite(v) ? q * v : 0)
  }, 0)
}
