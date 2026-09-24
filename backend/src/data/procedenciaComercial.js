/**
 * procedenciaComercial.js — F9.
 *
 * Fronteira explícita entre o DATASET COMERCIAL e o SSOT de engenharia.
 *
 * ── O que a auditoria F9 mediu ──────────────────────────────────────────────
 * `catalogoInversores.js` (41 registros) e `catalogoPaineis.js` (38) foram
 * cruzados contra os 52 inversores do SSOT Mongo. Resultado:
 *
 *   correspondência com o SSOT ...... 0 de 41
 *   fabricantes em comum ............ 10 de 14
 *   modelos em comum ................ 0
 *
 * Os dois conjuntos são disjuntos. O dataset comercial descreve equipamento
 * residencial de demonstração (Fronius Primo 5.0-1, Sungrow SG5.0RS, Deye
 * SUN-5K-SG01LP1); o SSOT descreve o estoque real (Kehua SPI, SolaX X3-ULT,
 * SAJ DE). Não há nada a migrar, e nada a reconciliar: os 14 "conflitos"
 * apontados pela F7-AUDIT eram entre `catalogoEletrico.js` (LEGACY, isolado na
 * F3) e esta tabela — duas fontes de demonstração, nenhuma delas o SSOT.
 *
 * ── A regra ─────────────────────────────────────────────────────────────────
 * Este dataset pode alimentar RANKING e CANDIDATURA comercial. Não pode
 * alimentar decisão de engenharia, e nenhum valor seu pode ser apresentado
 * como especificação validada.
 *
 * Compatibilidade elétrica real tem exatamente um caminho:
 *
 *     SSOT (`especificacoes`) → adapter → contrato canônico → motor
 *
 * Estes rótulos existem para que a fronteira viaje COM o dado, em vez de
 * depender de quem lê saber de onde ele veio.
 */

/** Origem do dado: dataset comercial, nunca o SSOT de engenharia. */
export const FONTE_COMERCIAL = 'catalogo_comercial'

/**
 * Veredito elétrico desta camada. É sempre este valor — a camada comercial não
 * tem competência para emitir outro. `ok`/`incompativel` só saem do motor
 * canônico, que lê o SSOT.
 */
export const COMPAT_NAO_AVALIADA = 'nao_avaliado'
