/**
 * topologiaInversor.js — P0-ARRAY-CONFIG-MICROINVERSOR-01
 *
 * FV-DOM-031 (decisão 4): este arquivo deixou de ter regra própria.
 *
 * Havia três classificadores independentes e a auditoria mediu 10 divergências
 * em 50 modelos — inclusive um microinversor real (Deye SUN-M2000G4) tratado
 * como string por este aqui. A classificação passou a viver em
 * `classificarTopologiaInversor` (dicionário SSOT de inversores). O que resta
 * neste módulo é a TRADUÇÃO para o vocabulário que o wizard já consumia.
 *
 * `HYBRID` mapeia para `'string'` porque este enum não tem híbrido e porque os
 * consumidores daqui (`ConfiguradorArranjoFV`, `UnifilarFV`, `descricaoTopologia`)
 * usam o valor para decidir o LADO CC do desenho — e o híbrido é string do lado
 * CC. Quem precisa distinguir híbrido usa o enum canônico.
 *
 * NÃO altera SSOT/Atlas — apenas LÊ o inversor para classificar.
 */
import { classificarTopologiaInversor, TOPOLOGIA } from '@fortesolar/fv-shared/inversores'

export const TOPOLOGIAS = { STRING: 'string', MICRO: 'micro', OTIMIZADOR: 'otimizador' }

/** Enum canônico → vocabulário histórico do wizard. */
const VOCABULARIO_WIZARD = {
  [TOPOLOGIA.MICRO]: TOPOLOGIAS.MICRO,
  [TOPOLOGIA.OTIMIZADOR]: TOPOLOGIAS.OTIMIZADOR,
  [TOPOLOGIA.HYBRID]: TOPOLOGIAS.STRING,
  [TOPOLOGIA.STRING]: TOPOLOGIAS.STRING,
}

/**
 * @param {object} inversor      equipamento selecionado (fabricante, modelo, id, topologia?, tipo?)
 * @param {object} [eletricoInv] dados elétricos do catálogo (pode ter topologia + entradas)
 * @returns {'string'|'micro'|'otimizador'}
 */
export function classificarTopologia(inversor, eletricoInv) {
  const esp = {
    // O campo explícito continua com prioridade absoluta, e o do catálogo
    // elétrico continua vencendo o do equipamento — mesma ordem de antes.
    tipo_topologia: eletricoInv?.topologia ?? inversor?.topologia ?? inversor?.tipo_topologia,
    tensao_max_entrada: eletricoInv?.tensao_max_entrada ?? inversor?.tensao_max_entrada,
    potencia_kw: eletricoInv?.potencia_ca_kw ?? inversor?.potencia_kw,
    n_mppts: eletricoInv?.n_mppts ?? inversor?.n_mppts,
  }
  // O wizard identifica o equipamento por qualquer um destes campos.
  const ctx = {
    fabricante: inversor?.fabricante ?? inversor?.marca ?? '',
    modelo: `${inversor?.modelo ?? ''} ${inversor?.nome ?? ''} ${inversor?.id ?? ''}`.trim(),
  }
  return VOCABULARIO_WIZARD[classificarTopologiaInversor(esp, ctx)]
}

export const ehMicro = (inv, el) => classificarTopologia(inv, el) === TOPOLOGIAS.MICRO
export const ehOtimizador = (inv, el) => classificarTopologia(inv, el) === TOPOLOGIAS.OTIMIZADOR
export const ehString = (inv, el) => classificarTopologia(inv, el) === TOPOLOGIAS.STRING
