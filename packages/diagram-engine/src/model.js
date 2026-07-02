/**
 * model.js — Modelo CANÔNICO de componentes elétricos genéricos.
 *
 * NEUTRO: o Engine conhece eletricidade, não conhece EV/FV/BESS.
 * Um "Carregador EV" é apenas um `equipamento` com subtipo 'carregador_ev';
 * um inversor, uma bateria, um ATS, um QGBT são igualmente componentes genéricos.
 *
 * Componente:
 *   { id, tipo, subtipo?, label, specs:{}, polos?, faixa?, ordem? }
 * Conexão:
 *   { id, from, to, papel: 'serie'|'derivacao', condutores:[{papel,cor,bitola_mm2}] }
 *
 * `faixa` (opcional): 'principal' (eixo horizontal) | 'inferior' (derivações).
 * `ordem` (opcional): inteiro para desempate determinístico na mesma coluna.
 */

export const TIPOS = Object.freeze({
  REDE: 'rede',
  QUADRO: 'quadro',
  DISJUNTOR: 'disjuntor',
  DR: 'dr',
  DPS: 'dps',
  BARRAMENTO: 'barramento',
  CABO: 'cabo',
  ELETRODUTO: 'eletroduto',
  EQUIPAMENTO: 'equipamento',
  CARGA: 'carga',
})

export const PAPEL_CONEXAO = Object.freeze({
  SERIE: 'serie',         // fluxo principal da corrente (esquerda → direita)
  DERIVACAO: 'derivacao', // shunt (ex.: DPS/DR pendurados num barramento)
})

// Cores normativas Forte Solar — por papel de condutor
export const CORES_CONDUTOR = Object.freeze({
  fase:    '#d61f1f', // monofásico: Fase = vermelho (padrão Forte Solar / legenda)
  fase_l1: '#1a1a1a', // trifásico L1 = preto
  fase_l2: '#d61f1f', // trifásico L2 = vermelho
  fase_l3: '#ffffff', // trifásico L3 = branco (contornado no SVG)
  neutro:  '#1f6fd6', // azul
  terra:   '#2e9e3f', // verde
  carga:   '#1a1a1a', // retorno/carga = preto
})

/** Fábrica de componente — normaliza campos e aplica defaults. */
export function componente({ id, tipo, subtipo = null, label = '', specs = {}, polos = null, faixa = null, ordem = 0 }) {
  if (!id) throw new Error('componente.id é obrigatório')
  if (!Object.values(TIPOS).includes(tipo)) throw new Error(`tipo inválido: ${tipo}`)
  return { id, tipo, subtipo, label, specs: { ...specs }, polos, faixa, ordem }
}

/** Fábrica de conexão. `specs` guarda propriedades ELÉTRICAS da própria ligação
 *  (bitola_mm2, comprimento_m, observacoes) — o cabo é a edge, não um componente. */
export function conexao({ id, from, to, papel = PAPEL_CONEXAO.SERIE, condutores = [], specs = {} }) {
  if (!id) throw new Error('conexao.id é obrigatório')
  if (!from || !to) throw new Error('conexao requer from e to')
  if (!Object.values(PAPEL_CONEXAO).includes(papel)) throw new Error(`papel inválido: ${papel}`)
  return { id, from, to, papel, condutores: condutores.map(c => ({ ...c })), specs: { ...specs } }
}

export const VERSION = '2.0'
