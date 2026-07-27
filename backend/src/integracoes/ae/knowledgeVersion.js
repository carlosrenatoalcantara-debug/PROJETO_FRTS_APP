/**
 * knowledgeVersion.js — Ordem total sobre KnowledgeVersion
 *
 * A KnowledgeVersion é a ÚNICA autoridade para decidir se o conhecimento
 * técnico do AE substitui o do catálogo. `origem.tipo` (manual, Gemini,
 * SolarMarket) NÃO confere prioridade.
 *
 * Regras:
 *   - detecção de divergência  → versões diferentes
 *   - autorização de escrita   → versão do AE ESTRITAMENTE SUPERIOR
 *   - não comparáveis          → não aplica (vai para revisão)
 *
 * O formato ainda não foi fixado pelo AE. Suporta-se numérico pontuado
 * (1.2.3, 2026.07.1, v3) com sufixo opcional; qualquer outro formato cai em
 * comparação por igualdade apenas — nunca em suposição de ordem.
 */

/** Resultado quando duas versões não admitem ordenação confiável. */
export const NAO_COMPARAVEL = Symbol('knowledge-version-nao-comparavel')

const NUMERICA_RE = /^v?(\d+(?:\.\d+)*)(?:[-+._]?(.*))?$/i

/**
 * @param {*} valor
 * @returns {{partes:number[], sufixo:string}|null}
 */
function analisar(valor) {
  if (valor === null || valor === undefined) return null
  const texto = String(valor).trim()
  if (!texto) return null
  const m = NUMERICA_RE.exec(texto)
  if (!m) return null
  const partes = m[1].split('.').map(n => Number.parseInt(n, 10))
  if (partes.some(n => !Number.isFinite(n))) return null
  return { partes, sufixo: (m[2] || '').toLowerCase() }
}

/** Normaliza para comparação de igualdade (tolera espaços e caixa). */
function canonico(valor) {
  if (valor === null || valor === undefined) return null
  const texto = String(valor).trim()
  return texto ? texto.toLowerCase() : null
}

/**
 * Duas versões representam o mesmo conhecimento?
 * Usado no passo 1 da Auditoria Rápida: se iguais, o arquivo NÃO é aberto.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function mesmaVersao(a, b) {
  const ca = canonico(a)
  const cb = canonico(b)
  if (ca === null || cb === null) return false
  if (ca === cb) return true
  const pa = analisar(ca)
  const pb = analisar(cb)
  if (!pa || !pb) return false
  // 1.2 e 1.2.0 são o mesmo conhecimento.
  if (pa.sufixo !== pb.sufixo) return false
  const n = Math.max(pa.partes.length, pb.partes.length)
  for (let i = 0; i < n; i++) {
    if ((pa.partes[i] ?? 0) !== (pb.partes[i] ?? 0)) return false
  }
  return true
}

/**
 * Compara duas KnowledgeVersions.
 *
 * @param {*} a
 * @param {*} b
 * @returns {number|symbol} <0 se a<b, 0 se equivalentes, >0 se a>b,
 *                          NAO_COMPARAVEL quando a ordem não é confiável.
 */
export function compararVersao(a, b) {
  if (mesmaVersao(a, b)) return 0
  const pa = analisar(a)
  const pb = analisar(b)
  if (!pa || !pb) return NAO_COMPARAVEL
  const n = Math.max(pa.partes.length, pb.partes.length)
  for (let i = 0; i < n; i++) {
    const va = pa.partes[i] ?? 0
    const vb = pb.partes[i] ?? 0
    if (va !== vb) return va - vb
  }
  // Núcleo numérico idêntico e sufixos diferentes (ex.: 1.0-beta vs 1.0-rc):
  // não há ordem defensável entre rótulos arbitrários.
  return NAO_COMPARAVEL
}

/**
 * O Datasheet Técnico AE autoriza sobrescrita dos campos técnicos?
 * Exige superioridade estrita. Protege contra regressão de versão no AE.
 *
 * @param {*} versaoAE        KnowledgeVersion do Datasheet Técnico AE
 * @param {*} versaoCatalogo  origem.knowledge_version do equipamento
 * @returns {{autoriza:boolean, situacao:string}}
 *   situacao ∈ nunca_auditado | atualizado | superior | inferior | nao_comparavel | sem_versao_ae
 */
export function avaliarAtualizacao(versaoAE, versaoCatalogo) {
  if (canonico(versaoAE) === null) {
    return { autoriza: false, situacao: 'sem_versao_ae' }
  }
  if (canonico(versaoCatalogo) === null) {
    // Nunca auditado pelo AE: não é "atualização", é primeira auditoria.
    return { autoriza: false, situacao: 'nunca_auditado' }
  }
  const cmp = compararVersao(versaoAE, versaoCatalogo)
  if (cmp === NAO_COMPARAVEL) return { autoriza: false, situacao: 'nao_comparavel' }
  if (cmp === 0) return { autoriza: false, situacao: 'atualizado' }
  if (cmp < 0) return { autoriza: false, situacao: 'inferior' }
  return { autoriza: true, situacao: 'superior' }
}
