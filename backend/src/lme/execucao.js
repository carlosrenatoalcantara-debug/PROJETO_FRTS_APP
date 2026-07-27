/**
 * lme/execucao.js — Legacy Migration Engine · ADR-022
 *
 * ORQUESTRADOR ÚNICO. Percorre o pipeline do contrato para qualquer plano.
 * Nenhum plano implementa laço próprio, contagem própria ou dry-run próprio.
 *
 * Garantias:
 *  1. DRY-RUN É O PADRÃO. Escrever exige `{ dryRun: false }` explícito.
 *  2. Falha de item NÃO derruba a execução — vira entrada de erro no ledger.
 *     Falha de CONTRATO (plano inválido, tenant ausente) derruba antes de começar.
 *  3. Toda saída de um item é registrada: nenhum item some em silêncio.
 */
import { validarPlano, prepararContexto, temValidacao, ACOES } from './contrato.js'
import { criarLedger } from './ledger.js'

/**
 * @param {object} plano     conforme `contrato.js`
 * @param {object} [opcoes]  { dryRun=true, limite=Infinity, empresa_id, aoProgredir, ...ctx }
 * @returns {Promise<object>} relatório + ledger
 */
export async function executarMigracao(plano, opcoes = {}) {
  const { dryRun = true, limite = Infinity, aoProgredir, ...ctxExtra } = opcoes

  validarPlano(plano)
  const ctx = prepararContexto(plano, { dryRun, ...ctxExtra })

  const ledger = criarLedger({ plano_id: plano.id, alvo: plano.alvo, dry_run: dryRun })
  const t0 = Date.now()
  let processados = 0

  const fluxo = await plano.fonte.extrair(ctx)

  for await (const bruto of fluxo) {
    if (processados >= limite) break
    processados++
    ledger.contarExtraido()

    const ref = bruto?.ref ?? `<sem-ref:${processados}>`
    try {
      await processarItem({ plano, ctx, ledger, ref, bruto })
    } catch (err) {
      // Erro do item: registra e segue. O legado é sujo por definição.
      ledger.registrar(ref, { etapa: err.etapa || 'aplicacao', erro: err.message })
    }

    if (aoProgredir) aoProgredir({ processados, ref, totais: ledger.totais })
  }

  return {
    plano_id:      plano.id,
    alvo:          plano.alvo,
    dry_run:       dryRun,
    iniciado_em:   ctx.iniciado_em.toISOString(),
    finalizado_em: new Date().toISOString(),
    duracao_ms:    Date.now() - t0,
    totais:        { ...ledger.totais },
    ledger,
  }
}

/** Um item pelo pipeline inteiro. Cada saída antecipada é registrada. */
async function processarItem({ plano, ctx, ledger, ref, bruto }) {
  // 1. Barreira bruta (opcional) — descarta ruído antes de gastar normalização.
  if (temValidacao(plano, 'bruto')) {
    const v = await plano.validador.bruto(bruto, ctx)
    if (!v?.ok) return ledger.registrar(ref, { etapa: 'validacao_bruta', motivo: v?.motivo || 'rejeitado' })
  }

  // 2. Normalização — ÚNICO lugar onde o formato legado é resolvido.
  //    Se o dado não couber no canônico, o descarte é aqui. O Core não afrouxa.
  const n = await plano.normalizador.normalizar(bruto, ctx)
  if (!n?.ok) return ledger.registrar(ref, { etapa: 'normalizacao', motivo: n?.motivo || 'não normalizável' })
  const canonico = n.canonico

  // 3. Barreira canônica (opcional).
  if (temValidacao(plano, 'canonico')) {
    const v = await plano.validador.canonico(canonico, ctx)
    if (!v?.ok) return ledger.registrar(ref, { etapa: 'validacao_canonica', motivo: v?.motivo || 'rejeitado' })
  }

  // 4. Matching — o registro já existe no destino?
  const match = (await plano.matcher.encontrar(canonico, ctx)) || { alvo: null }

  // 5. Reconciliação — decide, não escreve.
  const decisao = await plano.reconciliador.decidir(canonico, match, ctx)
  const acao = decisao?.acao
  if (!Object.values(ACOES).includes(acao)) {
    return ledger.registrar(ref, { etapa: 'reconciliacao', erro: `ação desconhecida: ${acao}` })
  }

  const base = { acao, motivo: decisao.motivo, criterio: match.criterio, hash: canonico?.hash }

  // Ignorar e conflito não chegam ao aplicador: conflito NUNCA sobrescreve.
  if (acao === ACOES.IGNORAR || acao === ACOES.CONFLITO) {
    return ledger.registrar(ref, { etapa: 'reconciliacao', ...base, destino_id: match.alvo?._id ?? null })
  }

  // 6. Aplicação — o aplicador recebe `ctx.dryRun` e é o único a tocar o destino.
  const r = await plano.aplicador.aplicar({ ...decisao, canonico, match }, ctx)
  if (!r?.ok) return ledger.registrar(ref, { etapa: 'aplicacao', ...base, erro: r?.erro || 'aplicação falhou' })

  return ledger.registrar(ref, { etapa: 'aplicacao', ...base, destino_id: r.destino_id ?? null })
}

export default { executarMigracao }
