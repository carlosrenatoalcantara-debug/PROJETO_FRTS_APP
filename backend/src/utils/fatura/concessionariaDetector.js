/**
 * concessionariaDetector.js — Sprint 8.5
 * Identifica a concessionária e UF a partir de um trecho de texto da fatura.
 * PURO: sem I/O. Recebe `texto` (string) e devolve { concessionaria, grupo, estado, confianca, layout }.
 * Não trava em casos desconhecidos: devolve `OUTRA` com `confianca: 0.2`.
 */

// Grupos econômicos e suas subsidiárias regionais (matching por palavras-chave).
const GRUPOS = [
  { grupo: 'NEOENERGIA', alvos: [
    { id: 'COSERN',  uf: 'RN', termos: ['cosern', 'companhia energetica do rio grande do norte'] },
    { id: 'COELBA',  uf: 'BA', termos: ['coelba', 'companhia de eletricidade do estado da bahia'] },
    { id: 'CELPE',   uf: 'PE', termos: ['celpe', 'companhia energetica de pernambuco'] },
    { id: 'ELEKTRO', uf: 'SP', termos: ['elektro'] },
    { id: 'NEOENERGIA BRASILIA', uf: 'DF', termos: ['neoenergia brasilia', 'ceb'] },
  ]},
  { grupo: 'EQUATORIAL', alvos: [
    { id: 'EQUATORIAL MA', uf: 'MA', termos: ['equatorial maranhao', 'cemar'] },
    { id: 'EQUATORIAL PA', uf: 'PA', termos: ['equatorial para', 'celpa'] },
    { id: 'EQUATORIAL PI', uf: 'PI', termos: ['equatorial piaui', 'cepisa'] },
    { id: 'EQUATORIAL AL', uf: 'AL', termos: ['equatorial alagoas', 'ceal'] },
    { id: 'EQUATORIAL GO', uf: 'GO', termos: ['equatorial goias', 'celg'] },
    { id: 'EQUATORIAL',    uf: null, termos: ['equatorial'] }, // fallback genérico Equatorial
  ]},
  { grupo: 'ENERGISA', alvos: [
    { id: 'ENERGISA MT', uf: 'MT', termos: ['energisa mato grosso', 'energisa mt'] },
    { id: 'ENERGISA MS', uf: 'MS', termos: ['energisa mato grosso do sul', 'energisa ms'] },
    { id: 'ENERGISA',     uf: null, termos: ['energisa'] },
  ]},
  { grupo: 'ENEL', alvos: [
    { id: 'ENEL CE', uf: 'CE', termos: ['enel ceara', 'coelce'] },
    { id: 'ENEL SP', uf: 'SP', termos: ['enel sao paulo', 'eletropaulo'] },
    { id: 'ENEL GO', uf: 'GO', termos: ['enel goias', 'celg distribuicao'] },
    { id: 'ENEL RJ', uf: 'RJ', termos: ['enel rio', 'ampla'] },
    { id: 'ENEL',     uf: null, termos: ['enel distribuicao', 'enel'] },
  ]},
  { grupo: 'CEMIG',   alvos: [{ id: 'CEMIG',  uf: 'MG', termos: ['cemig'] }] },
  { grupo: 'CPFL',    alvos: [
    { id: 'CPFL PAULISTA', uf: 'SP', termos: ['cpfl paulista'] },
    { id: 'CPFL PIRATININGA', uf: 'SP', termos: ['cpfl piratininga'] },
    { id: 'RGE',           uf: 'RS', termos: ['rge sul', 'rge '] },
    { id: 'CPFL',          uf: null, termos: ['cpfl'] },
  ]},
  { grupo: 'COPEL',   alvos: [{ id: 'COPEL', uf: 'PR', termos: ['copel'] }] },
  { grupo: 'EDP',     alvos: [
    { id: 'EDP SP', uf: 'SP', termos: ['edp sao paulo', 'bandeirante'] },
    { id: 'EDP ES', uf: 'ES', termos: ['edp espirito santo', 'escelsa'] },
    { id: 'EDP',     uf: null, termos: ['edp '] },
  ]},
  { grupo: 'LIGHT',   alvos: [{ id: 'LIGHT', uf: 'RJ', termos: ['light servicos', 'light s.a'] }] },
]

const _normalizar = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')

/**
 * @param {string} texto  texto extraído do PDF/OCR (ou cabeçalho da fatura)
 * @returns {{ concessionaria: string, grupo: string, estado: ?string, confianca: number, layout: string }}
 */
export function detectarConcessionaria(texto) {
  const t = _normalizar(texto)
  if (!t) return { concessionaria: 'DESCONHECIDA', grupo: 'OUTRA', estado: null, confianca: 0, layout: 'generico' }

  for (const g of GRUPOS) {
    for (const alvo of g.alvos) {
      for (const termo of alvo.termos) {
        if (t.includes(termo)) {
          // Confiança maior quando o termo é específico/longo
          const confianca = Math.min(0.99, 0.6 + (termo.length / 60))
          return {
            concessionaria: alvo.id,
            grupo: g.grupo,
            estado: alvo.uf,
            confianca,
            layout: alvo.id.toLowerCase().replace(/\s+/g, '_'),
          }
        }
      }
    }
  }
  return { concessionaria: 'OUTRA', grupo: 'OUTRA', estado: null, confianca: 0.2, layout: 'generico' }
}

// Exporta a lista p/ relatórios/UI.
export const CONCESSIONARIAS_SUPORTADAS = GRUPOS.flatMap((g) => g.alvos.map((a) => ({ id: a.id, grupo: g.grupo, uf: a.uf })))
