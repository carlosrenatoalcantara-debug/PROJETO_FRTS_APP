/**
 * lme/ledger.js — Legacy Migration Engine · ADR-022
 *
 * Registro de execução. Toda migração produz um ledger: uma entrada por item,
 * com a etapa onde parou, a decisão tomada e o motivo.
 *
 * Por que existe: migração sem rastro não é auditável nem repetível. O ledger
 * responde "este registro legado virou o quê, por qual critério, quando".
 *
 * NESTA FASE: memória + exportação JSON. Persistência em coleção própria
 * (`MigracaoExecucao`) fica para quando o backfill real rodar (Fase 0.5) —
 * o formato aqui já é o que será gravado.
 *
 * PURO: sem I/O.
 */
import { ACOES } from './contrato.js'

/** @param {{ plano_id: string, alvo: string, dry_run: boolean }} cab */
export function criarLedger(cab) {
  const entradas = []
  const totais = {
    extraidos: 0, descartados: 0, erros: 0,
    [ACOES.CRIAR]: 0, [ACOES.ATUALIZAR]: 0, [ACOES.IGNORAR]: 0, [ACOES.CONFLITO]: 0,
  }

  /**
   * @param {string} ref     identidade do item na origem
   * @param {object} dados   { etapa, acao?, motivo?, destino_id?, hash?, erro? }
   */
  function registrar(ref, dados) {
    const e = { ref, em: new Date().toISOString(), ...dados }
    entradas.push(e)

    if (e.erro)                    totais.erros++
    else if (e.acao in totais)     totais[e.acao]++
    else if (e.etapa !== 'extracao') totais.descartados++

    return e
  }

  const contarExtraido = () => { totais.extraidos++ }

  /** Itens que exigem decisão humana — o que o operador precisa olhar. */
  const conflitos = () => entradas.filter(e => e.acao === ACOES.CONFLITO)

  /** Itens que caíram fora do modelo canônico: o gap real do legado. */
  const descartes = () => entradas.filter(e => !e.erro && !e.acao)

  const paraJSON = () => ({
    ...cab,
    finalizado_em: new Date().toISOString(),
    totais: { ...totais },
    entradas: [...entradas],
  })

  return { registrar, contarExtraido, conflitos, descartes, totais, entradas, paraJSON }
}

export default { criarLedger }
