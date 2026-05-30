/**
 * concessionariaProvider.js — Sprint 9.0
 *
 * Provider extensível de regras de homologação por concessionária. Inicialmente
 * cobre Neoenergia / Cosern. Estrutura preparada para Equatorial, Energisa,
 * CPFL, CEMIG, COPEL — sem hardcode espalhado pela aplicação.
 *
 * Cada concessionária declara:
 *   • documentos_obrigatorios: tipos de documento exigidos no pacote
 *   • normas_obrigatorias: certificações que devem estar presentes nos equipamentos
 *   • limites_grupo_b: kWp máx para microgeração / minigeração no Grupo B
 *   • observacoes: notas específicas do operador
 *
 * Reutiliza `concessionariaDetector` (Sprint 8.5) para mapear nomes/aliases.
 */

const REGRAS_PADRAO = {
  documentos_obrigatorios: ['datasheet', 'memorial', 'art', 'carta_concessionaria'],
  normas_obrigatorias: { modulo: ['inmetro'], inversor: ['inmetro'] },
  limites_grupo_b: { microgeracao_kwp: 75, minigeracao_kwp: 5000 },
  observacoes: 'Regras padrão (Lei 14.300/2022 + REN ANEEL 1.000/2021).',
}

const REGRAS_POR_GRUPO = {
  NEOENERGIA: {
    documentos_obrigatorios: ['datasheet', 'memorial', 'art', 'carta_concessionaria', 'projeto_execucao', 'laudo_conformidade'],
    normas_obrigatorias: {
      modulo: ['inmetro'],
      inversor: ['inmetro', 'iec_62116'],   // anti-ilhamento exigido
    },
    limites_grupo_b: { microgeracao_kwp: 75, minigeracao_kwp: 5000 },
    formularios: ['ESS-PEH', 'Anexo III Neoenergia'],
    observacoes: 'Neoenergia exige IEC 62116 (anti-ilhamento) e laudo de conformidade.',
  },
  EQUATORIAL: {
    documentos_obrigatorios: ['datasheet', 'memorial', 'art', 'carta_concessionaria'],
    normas_obrigatorias: { modulo: ['inmetro'], inversor: ['inmetro'] },
    limites_grupo_b: { microgeracao_kwp: 75, minigeracao_kwp: 5000 },
    formularios: ['Formulário Solicitação de Acesso'],
    observacoes: 'Padrão Equatorial conforme REN 1.000.',
  },
  ENERGISA: {
    documentos_obrigatorios: ['datasheet', 'memorial', 'art', 'carta_concessionaria'],
    normas_obrigatorias: { modulo: ['inmetro'], inversor: ['inmetro'] },
    limites_grupo_b: { microgeracao_kwp: 75, minigeracao_kwp: 5000 },
    observacoes: 'Padrão Energisa.',
  },
  CPFL: {
    documentos_obrigatorios: ['datasheet', 'memorial', 'art', 'carta_concessionaria', 'projeto_execucao'],
    normas_obrigatorias: { modulo: ['inmetro'], inversor: ['inmetro', 'iec_62116'] },
    limites_grupo_b: { microgeracao_kwp: 75, minigeracao_kwp: 5000 },
    observacoes: 'CPFL exige projeto de execução.',
  },
  CEMIG: {
    documentos_obrigatorios: ['datasheet', 'memorial', 'art', 'carta_concessionaria'],
    normas_obrigatorias: { modulo: ['inmetro'], inversor: ['inmetro'] },
    limites_grupo_b: { microgeracao_kwp: 75, minigeracao_kwp: 5000 },
    observacoes: 'Padrão CEMIG.',
  },
  COPEL: {
    documentos_obrigatorios: ['datasheet', 'memorial', 'art', 'carta_concessionaria'],
    normas_obrigatorias: { modulo: ['inmetro'], inversor: ['inmetro'] },
    limites_grupo_b: { microgeracao_kwp: 75, minigeracao_kwp: 5000 },
    observacoes: 'Padrão COPEL.',
  },
}

/**
 * Devolve as regras para uma concessionária (por id ou grupo).
 * Aceita: 'COSERN', 'COELBA', 'CELPE' (grupo NEOENERGIA), 'EQUATORIAL MA', etc.
 */
export function obterRegras(concessionariaOuGrupo) {
  if (!concessionariaOuGrupo) return REGRAS_PADRAO
  const c = String(concessionariaOuGrupo).toUpperCase()
  // Match direto por grupo
  if (REGRAS_POR_GRUPO[c]) return REGRAS_POR_GRUPO[c]
  // Match por subsidiária → grupo
  if (['COSERN', 'COELBA', 'CELPE', 'ELEKTRO'].includes(c)) return REGRAS_POR_GRUPO.NEOENERGIA
  if (c.startsWith('EQUATORIAL')) return REGRAS_POR_GRUPO.EQUATORIAL
  if (c.startsWith('ENERGISA')) return REGRAS_POR_GRUPO.ENERGISA
  if (c.startsWith('CPFL') || c === 'RGE') return REGRAS_POR_GRUPO.CPFL
  if (c === 'CEMIG') return REGRAS_POR_GRUPO.CEMIG
  if (c === 'COPEL') return REGRAS_POR_GRUPO.COPEL
  return REGRAS_PADRAO
}

export const CONCESSIONARIAS_COM_REGRAS = Object.keys(REGRAS_POR_GRUPO)
