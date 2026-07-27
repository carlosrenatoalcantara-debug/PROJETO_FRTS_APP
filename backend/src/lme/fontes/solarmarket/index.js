/**
 * lme/fontes/solarmarket — Legacy Migration Engine · ADR-022
 *
 * Plano de migração do catálogo SolarMarket. É um ADAPTADOR: o ETL de
 * `integracoes/solarmarket/` continua sendo a implementação real; aqui ele
 * apenas passa a falar o contrato do LME (ledger, dry-run e relatório únicos).
 *
 * Nada do ETL foi reescrito — reescrever significaria duplicar 2.782 linhas
 * já homologadas. O adaptador é fino e é o único ponto que conhece o formato SM.
 *
 * Destino: `Equipamento` — GLOBAL (ADR-021 A-8). Por isso NÃO exige empresa_id.
 *
 * Imports são dinâmicos de propósito: o contrato do LME é verificável sem
 * mongoose nem chave de API. Só quem executa carrega o ETL.
 *
 *   import { planoCatalogoSolarMarket } from './fontes/solarmarket/index.js'
 *   await executarMigracao(planoCatalogoSolarMarket, { dryRun: true, limite: 10 })
 */
import { ACOES } from '../../contrato.js'

const etl = () => import('../../../integracoes/solarmarket/index.js')

export const planoCatalogoSolarMarket = {
  id:        'LME-CATALOGO-SM-01',
  descricao: 'Catálogo de equipamentos do SolarMarket → agregado Equipamento',
  alvo:      'Equipamento',

  fonte: {
    /**
     * `extrairEquipamentos` devolve o lote inteiro; o LME consome item a item.
     * `ref` = identidade estável na origem para permitir idempotência.
     */
    async *extrair(ctx) {
      const { extrairEquipamentos } = await etl()
      const { lineItems = [], produtos = [] } = await extrairEquipamentos({
        limitePropostas: ctx.limitePropostas ?? 0,
        incluirProdutos: ctx.incluirProdutos ?? false,
      })

      for (const item of [...lineItems, ...produtos]) {
        yield { ref: refDoItem(item), dados: item }
      }
    },
  },

  validador: {
    async bruto({ dados }) {
      const { validarItemBruto } = await etl()
      const r = validarItemBruto(dados)
      return { ok: r.erros.length === 0, motivo: r.erros.join('; ') }
    },
    async canonico(canonico) {
      const { validarNormalizado } = await etl()
      const r = validarNormalizado(canonico)
      return { ok: r.erros.length === 0, motivo: r.erros.join('; ') }
    },
  },

  normalizador: {
    /** `normalizar` devolve null quando o item não pertence ao catálogo. */
    async normalizar({ dados }) {
      const { normalizar } = await etl()
      const n = normalizar(dados)
      if (!n) return { ok: false, motivo: 'fora do escopo do catálogo (serviço/desconto/sem fabricante)' }
      // `hash` no topo: o ledger o usa como chave de idempotência.
      return { ok: true, canonico: { ...n, hash: n.meta?.hash_unico ?? null } }
    },
  },

  matcher: {
    async encontrar(canonico) {
      const { encontrarMatch } = await etl()
      const m = await encontrarMatch(canonico)
      return { alvo: m?.encontrado ? m.equipamento : null, criterio: m?.estrategia, confianca: m?.confianca }
    },
  },

  reconciliador: {
    /** Traduz a decisão do deduplicator para o vocabulário fechado do LME. */
    async decidir(canonico, match, ctx) {
      const { decidirAcao } = await etl()
      const d = decidirAcao(
        canonico,
        { encontrado: !!match.alvo, equipamento: match.alvo, confianca: match.confianca ?? 0 },
        { confiancaMinimaUpdate: ctx.confiancaMinimaUpdate ?? 0.70 },
      )
      return {
        acao:   d.acao in ACOES_SM ? ACOES_SM[d.acao] : ACOES.CONFLITO,
        motivo: d.motivo,
        campos: d.campos_alterados,
        _sm:    d,   // payload original, consumido só pelo aplicador abaixo
      }
    },
  },

  aplicador: {
    async aplicar(decisao, ctx) {
      const { executarAcao } = await etl()
      const r = await executarAcao(decisao._sm, ctx.dryRun)
      return { ok: !r.erro, destino_id: r.id ?? null, erro: r.erro }
    },
  },
}

const ACOES_SM = { criar: ACOES.CRIAR, atualizar: ACOES.ATUALIZAR, ignorar: ACOES.IGNORAR }

/** Identidade na origem: o SM não expõe id estável por line item — deriva-se. */
function refDoItem(item) {
  return item?.id
      ?? item?.produto_id
      ?? `sm:${[item?.marca, item?.modelo, item?.nome].filter(Boolean).join('|') || 'desconhecido'}`
}

export default planoCatalogoSolarMarket
