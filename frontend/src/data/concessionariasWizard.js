/**
 * Concessionárias oferecidas no wizard (FV-03: distribuidoras brasileiras por região)
 * e o casamento do nome LIDO (fatura / cadastro) com a opção da lista.
 */
export const OPCOES_CONCESSIONARIA = [
  // ── Norte ────────────────────────────────────────────────────────────────────
  'Amazonas Energia (AM)',
  'Boa Vista Energia (RR)',
  'Eletroacre (AC)',
  'Energisa Rondônia (RO)',
  'Energisa Tocantins (TO)',
  'Equatorial Amapá (AP)',
  'Equatorial Pará (PA)',
  // ── Nordeste ─────────────────────────────────────────────────────────────────
  'CELPE / Neoenergia (PE)',
  'COELBA / Neoenergia (BA)',
  'COSERN / Neoenergia (RN)',
  'Enel Ceará (CE)',
  'Energisa Paraíba (PB)',
  'Energisa Sergipe (SE)',
  'Equatorial Alagoas (AL)',
  'Equatorial Maranhão (MA)',
  'Equatorial Piauí (PI)',
  // ── Centro-Oeste ─────────────────────────────────────────────────────────────
  'CEB Distribuição (DF)',
  'Energisa Mato Grosso (MT)',
  'Energisa Mato Grosso do Sul (MS)',
  'Equatorial Goiás (GO)',
  // ── Sudeste ──────────────────────────────────────────────────────────────────
  'CEMIG (MG)',
  'CPFL Energia (SP/RS)',
  'CPFL Paulista (SP)',
  'CPFL Piratininga (SP)',
  'EDP Bandeirante / EDP SP (SP)',
  'EDP Espírito Santo (ES)',
  'Enel Rio (RJ)',
  'Enel São Paulo (SP)',
  'LIGHT (RJ)',
  'Neoenergia Elektro (SP/MS)',
  // ── Sul ──────────────────────────────────────────────────────────────────────
  'CELESC (SC)',
  'COPEL (PR)',
  'Equatorial RS / CEEE (RS)',
  'Neoenergia Gaúcha / RGE (RS)',
  // ── Genéricos ────────────────────────────────────────────────────────────────
  'ENEL (geral)',
  'ENERGISA (geral)',
  'Outra',
]

const GENERICAS = new Set(['Outra', 'ENEL (geral)', 'ENERGISA (geral)'])

const norm = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** "COSERN / Neoenergia (RN)" → marca "COSERN" e UFs ["RN"]. */
function partes(opcao) {
  const marca = norm(opcao.split('(')[0].split('/')[0])
  const ufs = (opcao.match(/\(([^)]*)\)/)?.[1] ?? '').split('/').map((x) => x.trim().toUpperCase()).filter(Boolean)
  return { marca, ufs }
}

const contem = (texto, marca) => ` ${texto} `.includes(` ${marca} `)

/**
 * Opção da lista que o nome lido já identifica — ou `null`. Só devolve quando há
 * UMA possibilidade: "COSERN" → "COSERN / Neoenergia (RN)". Nome ambíguo (ex.:
 * "CPFL" sem UF) ou desconhecido não é chutado; o operador escolhe.
 */
export function casarConcessionaria(nome, uf = null) {
  const texto = norm(nome)
  if (!texto) return null
  const exata = OPCOES_CONCESSIONARIA.find((o) => norm(o) === texto)
  if (exata) return exata
  const opcoes = OPCOES_CONCESSIONARIA.filter((o) => !GENERICAS.has(o))

  // 1) a marca da opção aparece no nome lido (a mais específica vence).
  const achadas = opcoes.filter((o) => contem(texto, partes(o).marca))
  if (achadas.length) {
    const maior = Math.max(...achadas.map((o) => partes(o).marca.length))
    const finais = achadas.filter((o) => partes(o).marca.length === maior)
    return finais.length === 1 ? finais[0] : null
  }
  // 2) o nome lido é só a 1ª palavra da marca ("ENEL", "CPFL"): a UF desempata.
  const sigla = String(uf ?? '').trim().toUpperCase()
  if (!sigla || texto.includes(' ')) return null
  const porUf = opcoes.filter((o) => partes(o).marca.split(' ')[0] === texto && partes(o).ufs.includes(sigla))
  return porUf.length === 1 ? porUf[0] : null
}
