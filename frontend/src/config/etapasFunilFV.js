/**
 * etapasFunilFV.js — P1-UX-CORE-EVOLUTION-01 (FASE 1)
 *
 * Fonte única de verdade do funil de projeto FV. Centraliza os passos e o
 * AGRUPAMENTO em macro-etapas afins (inspirado na organização enxuta do SolarMarket),
 * reduzindo a percepção de 9 passos para 4 macro-etapas. Ajustes futuros de fluxo
 * (reordenar, agrupar, renomear) acontecem só aqui.
 */

// Passos canônicos, em ordem. `grupo` referencia uma macro-etapa de GRUPOS.
export const ETAPAS = [
  { num: 1,   chave: 'fatura',          rotulo: 'Fatura',          grupo: 'consumo'  },
  { num: 2,   chave: 'consumo',         rotulo: 'Consumo',         grupo: 'consumo'  },
  { num: 2.5, chave: 'beneficiarias',   rotulo: 'Beneficiárias',   grupo: 'consumo'  },
  { num: 3,   chave: 'localizacao',     rotulo: 'Localização',     grupo: 'local'    },
  { num: 4,   chave: 'irradiancia',     rotulo: 'Irradiância',     grupo: 'local'    },
  { num: 5,   chave: 'dimensionamento', rotulo: 'Dimensionamento', grupo: 'projeto'  },
  { num: 6,   chave: 'area',            rotulo: 'Área',            grupo: 'projeto'  },
  { num: 7,   chave: 'equipamentos',    rotulo: 'Equipamentos',    grupo: 'projeto'  },
  { num: 8,   chave: 'orcamento',       rotulo: 'Orçamento',       grupo: 'proposta' },
]

// Macro-etapas afins (4). Cada uma agrupa um ou mais passos.
export const GRUPOS = [
  { chave: 'consumo',  rotulo: 'Consumo',       descricao: 'Fatura, consumo e beneficiárias' },
  { chave: 'local',    rotulo: 'Local & Clima', descricao: 'Localização e irradiância'       },
  { chave: 'projeto',  rotulo: 'Projeto',       descricao: 'Dimensionamento, área e equipamentos' },
  { chave: 'proposta', rotulo: 'Proposta',      descricao: 'Orçamento e fechamento'          },
]

/** Passo canônico para um número de etapa. */
export function etapaPorNum(num) {
  return ETAPAS.find(e => e.num === num) || null
}

/** Chave do grupo ativo para a etapa atual. */
export function grupoAtivo(etapaNum) {
  return etapaPorNum(etapaNum)?.grupo || GRUPOS[0].chave
}

/** Rótulo curto do passo atual (sub-etapa dentro do grupo). */
export function rotuloEtapa(etapaNum) {
  return etapaPorNum(etapaNum)?.rotulo || ''
}

/**
 * Progresso por macro-etapa: cada grupo recebe status concluído/ativo/futuro
 * e a primeira etapa navegável do grupo.
 * @param {number} etapaNum  etapa atual
 * @returns {Array<{chave,rotulo,descricao,status,primeiraEtapa}>}
 */
export function progressoGrupos(etapaNum) {
  const grupoAtual = grupoAtivo(etapaNum)
  const idxAtual = GRUPOS.findIndex(g => g.chave === grupoAtual)
  return GRUPOS.map((g, idx) => ({
    ...g,
    status: idx < idxAtual ? 'concluido' : idx === idxAtual ? 'ativo' : 'futuro',
    primeiraEtapa: ETAPAS.find(e => e.grupo === g.chave)?.num ?? 1,
  }))
}
