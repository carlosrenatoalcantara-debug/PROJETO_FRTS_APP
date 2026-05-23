/**
 * backend/src/routes/engenharia.js
 *
 * Endpoints existentes (inalterados):
 *   POST /api/engenharia/fv                   — cálculo FV
 *   POST /api/engenharia/compatibilidade-eletrica — análise elétrica (S2.11.1)
 *   POST /api/engenharia/optimizer-arranjo    — otimizador de arranjo (S2.12)
 *
 * Endpoints adicionados — S2.15-B.3A:
 *   GET  /api/engenharia/info                 — versões dos motores (healthcheck)
 *   POST /api/engenharia/validar-equipamento  — matcher 5 camadas + pipeline de datasheet
 *   POST /api/engenharia/normalizar-parecer   — identificação de concessionária + extração de campos
 */

import { Router } from 'express'

// ── Controllers existentes (S2.11.1, S2.12) ───────────────────────────────────
import {
  calcularFV,
  analisarCompatibilidadeEletrica,
  otimizarArranjoHandler,
} from '../controllers/engenhariaController.js'

// ── Serviços S2.15-B.3A ───────────────────────────────────────────────────────
import { EquipamentoMatcherService, VERSAO_MATCHER }      from '../services/equipamentoMatcherService.js'
import { DatasheetPipelineService }                        from '../services/datasheetPipelineService.js'
import { VERSAO_NORMALIZADOR, normalizarParecer, normalizar }
                                                           from '../services/parecerNormalizerService.js'

const router = Router()

// Instâncias singleton por processo — lazy-loading do catálogo ocorre no primeiro match
const matcherService  = new EquipamentoMatcherService()
const pipelineService = new DatasheetPipelineService()

// ─── Helpers de validação ─────────────────────────────────────────────────────

/** Retorna o body parseado ou envia 400 e retorna null. */
function _body(req, res) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({
      erro: "Body ausente ou Content-Type não é application/json.",
      dica: "Adicione o header: Content-Type: application/json",
    })
    return null
  }
  return req.body
}

/** String não-vazia após trim. */
const _ok = val => typeof val === 'string' && val.trim().length > 0

// ══════════════════════════════════════════════════════════════════════════════
// Rotas existentes — NÃO ALTERAR
// ══════════════════════════════════════════════════════════════════════════════

router.post('/fv', calcularFV)
router.post('/compatibilidade-eletrica', analisarCompatibilidadeEletrica)
router.post('/optimizer-arranjo', otimizarArranjoHandler)

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/engenharia/info
// Healthcheck — versões dos motores sem expor estado interno.
// ══════════════════════════════════════════════════════════════════════════════

router.get('/info', (_req, res) => {
  res.json({
    servico:             'Forte Solar — Motor de Engenharia FV',
    versao_matcher:      VERSAO_MATCHER,
    versao_normalizador: VERSAO_NORMALIZADOR,
    endpoints: [
      'POST /api/engenharia/fv',
      'POST /api/engenharia/compatibilidade-eletrica',
      'POST /api/engenharia/optimizer-arranjo',
      'POST /api/engenharia/validar-equipamento',
      'POST /api/engenharia/normalizar-parecer',
    ],
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/engenharia/validar-equipamento
//
// Body: { fabricante?: string, modelo: string, potencia?: number|string }
//
// 200 — pipeline ok (encontrado / ambíguo / datasheet necessário)
// 400 — modelo ausente ou inválido
// 500 — erro de infraestrutura
// ══════════════════════════════════════════════════════════════════════════════

router.post('/validar-equipamento', async (req, res) => {
  const body = _body(req, res)
  if (!body) return

  const { fabricante, modelo, potencia } = body

  if (!_ok(modelo)) {
    return res.status(400).json({
      erro: "Parâmetro 'modelo' ausente ou inválido.",
      dica: "Envie uma string não vazia. Ex.: { \"modelo\": \"CS3W-450MS\" }",
    })
  }

  try {
    const resultadoMatch    = await matcherService.matchEquipamento(
      _ok(fabricante) ? fabricante.trim() : null,
      modelo.trim(),
      potencia ?? null,
    )
    const resultadoPipeline = await pipelineService.processarPipeline(resultadoMatch)
    return res.status(200).json(resultadoPipeline)

  } catch (err) {
    console.error('[engenharia] validar-equipamento:', err)
    return res.status(500).json({
      erro:    'Erro de infraestrutura no pipeline de validação.',
      detalhe: err.message,
    })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/engenharia/normalizar-parecer
//
// Duas formas de entrada (exclusivas, verificadas em ordem):
//
//   Forma A — texto bruto (legado e OCR direto):
//     { texto: string, concessionaria_hint?: string, equipamentos?: object[] }
//
//   Forma B — documento estruturado (DOCUMENT_ENGINE_V1):
//     { documento: { documento_extraido_raw: {...} }, concessionaria_hint?: string, equipamentos?: object[] }
//
// 200 — normalizado com confianca_documento_global
// 400 — nenhuma entrada válida
// 422 — concessionária não identificada (payload ainda retornado — degradação graceful)
// 500 — erro de infraestrutura
// ══════════════════════════════════════════════════════════════════════════════

router.post('/normalizar-parecer', async (req, res) => {
  const body = _body(req, res)
  if (!body) return

  const { texto, documento, concessionaria_hint, equipamentos } = body

  const temTexto     = _ok(texto)
  const temDocumento = documento != null
                       && typeof documento === 'object'
                       && documento.documento_extraido_raw

  if (!temTexto && !temDocumento) {
    return res.status(400).json({
      erro: "Forneça 'texto' (string) ou 'documento' (objeto DOCUMENT_ENGINE_V1).",
      dica: "Forma A: { \"texto\": \"...conteúdo...\" } | " +
            "Forma B: { \"documento\": { \"documento_extraido_raw\": { ... } } }",
    })
  }

  const opcoes = {
    concessionaria_hint: _ok(concessionaria_hint)
      ? concessionaria_hint.trim().toUpperCase()
      : undefined,
    equipamentos_brutos: Array.isArray(equipamentos) ? equipamentos : [],
  }

  try {
    const resultado = temTexto
      ? await normalizar(texto, opcoes)           // Forma A — compat. com legado
      : await normalizarParecer(documento, opcoes) // Forma B — DOCUMENT_ENGINE_V1

    // 422 quando concessionária não identificada e confiança zero
    // O payload é sempre enviado — o frontend decide se exibe aviso ou bloqueia
    const confianca = resultado.concessionaria?.confianca
                   ?? resultado.confianca_concessionaria
                   ?? 0
    const naoIdentificada = !resultado.concessionaria?.id
                         && !resultado.concessionariaId
                         && confianca === 0

    return res.status(naoIdentificada ? 422 : 200).json(resultado)

  } catch (err) {
    console.error('[engenharia] normalizar-parecer:', err)
    return res.status(500).json({
      erro:    'Erro de infraestrutura no pipeline de normalização.',
      detalhe: err.message,
    })
  }
})

export default router
