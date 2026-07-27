/**
 * IAEProvider.js — Contrato de acesso ao AE (Auditor de Equipamentos)
 *
 * PORTA da integração. A Auditoria Rápida depende EXCLUSIVAMENTE deste contrato
 * e nunca da origem física dos dados. Adaptadores possíveis: diretório local,
 * API HTTP, Git, S3, ZIP — nenhum é privilegiado.
 *
 * O AE é a fonte oficial de conhecimento técnico. Este módulo apenas LÊ.
 * Nada aqui escreve no AE, e o AE nunca acessa o banco do Forte Solar.
 *
 * ─── Contrato ──────────────────────────────────────────────────────────────
 *
 *   listarIndice()        → Promise<EntradaIndiceAE[]>
 *   obterDatasheet(ref)   → Promise<DatasheetAE>
 *   descrever()           → DescricaoProvider        (auditoria/log)
 *
 * Um adaptador é qualquer objeto que implemente os três métodos.
 *
 * @typedef {object} EntradaIndiceAE
 * @property {'modulo'|'inversor'|'carregador_ev'|'bateria'} familia
 * @property {string} fabricante
 * @property {string} modelo
 * @property {string|null} knowledgeVersion  versão do Datasheet Técnico AE
 * @property {string} ref                    referência opaca p/ obterDatasheet()
 *
 * @typedef {object} DatasheetAE
 * @property {'AE'} origin
 * @property {string} documentType           'Technical Datasheet'
 * @property {string} fabricante
 * @property {string} modelo
 * @property {'modulo'|'inversor'|'carregador_ev'|'bateria'} familia
 * @property {string|null} knowledgeVersion
 * @property {string|null} lastAudit
 * @property {number|null} confidence
 * @property {object} dados                  conhecimento técnico consolidado
 * @property {string} ref
 *
 * @typedef {object} DescricaoProvider
 * @property {string} tipo                   'local-folder' | 'http' | ...
 * @property {string} origem                 descrição legível da origem
 */

/** Famílias mantidas pelo AE. Materiais de instalação NÃO pertencem ao AE. */
export const FAMILIAS_AE = Object.freeze(['modulo', 'inversor', 'carregador_ev', 'bateria'])

/**
 * Mapeia o nome de pasta/família do AE para o `tipo` canônico do Equipamento.
 * Microinversores pertencem à família Inversores.
 */
const ALIASES_FAMILIA = Object.freeze({
  modulo: 'modulo',
  modulos: 'modulo',
  'modulo_solar': 'modulo',
  inversor: 'inversor',
  inversores: 'inversor',
  microinversor: 'inversor',
  microinversores: 'inversor',
  carregador: 'carregador_ev',
  carregadores: 'carregador_ev',
  'carregador_ev': 'carregador_ev',
  'carregadores_ev': 'carregador_ev',
  bateria: 'bateria',
  baterias: 'bateria',
})

/**
 * Resolve o nome de uma pasta/rótulo de família para o tipo canônico.
 * @param {string} valor
 * @returns {string|null} tipo canônico, ou null se fora do escopo do AE
 */
// Marcas diacríticas combinantes (U+0300–U+036F). Construído a partir de string
// ASCII para que o fonte não dependa de caracteres combinantes invisíveis.
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

export function resolverFamilia(valor) {
  if (!valor) return null
  const chave = String(valor)
    .normalize('NFD').replace(DIACRITICOS, '')
    .toLowerCase().trim().replace(/[\s-]+/g, '_')
  return ALIASES_FAMILIA[chave] || null
}

/**
 * Valida que um objeto cumpre o contrato IAEProvider.
 * Falha cedo e com mensagem clara — o orquestrador não deve descobrir isso tarde.
 *
 * @param {object} provider
 * @returns {object} o próprio provider
 * @throws {Error} se algum método do contrato estiver ausente
 */
export function assertProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new Error('IAEProvider: provider ausente ou inválido.')
  }
  for (const metodo of ['listarIndice', 'obterDatasheet', 'descrever']) {
    if (typeof provider[metodo] !== 'function') {
      throw new Error(`IAEProvider: contrato não cumprido — método "${metodo}" ausente.`)
    }
  }
  return provider
}
