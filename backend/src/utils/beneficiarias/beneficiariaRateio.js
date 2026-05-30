/**
 * beneficiariaRateio.js — Sprint 8.7
 * Helpers PUROS (sem I/O) para beneficiárias GD (Lei 14.300).
 * Testáveis offline sem mongoose, banco ou Express.
 *
 * Cobre:
 *  - Cálculo e validação do rateio (soma = 100%)
 *  - Parser de texto colado do Excel (TSV/CSV com ; ou \t)
 *  - Parser de CSV bruto
 *  - Modalidades GD da Lei 14.300
 */

// ── Modalidades GD (Lei 14.300) ────────────────────────────────────────────
export const MODALIDADES_GD = [
  { id: 'autoconsumo_local',      label: 'Autoconsumo local' },
  { id: 'autoconsumo_remoto',     label: 'Autoconsumo remoto' },
  { id: 'geracao_compartilhada',  label: 'Geração compartilhada' },
  { id: 'condominio',             label: 'Condomínio' },
]

// ── Validação do rateio ────────────────────────────────────────────────────

/**
 * Calcula a soma dos percentuais de uma lista de beneficiárias.
 * Soma apenas entidades com `tipoRateio === 'percentual'` e `ativa !== false`.
 */
export function calcularSomaRateio(beneficiarias) {
  return (beneficiarias || [])
    .filter(b => b.tipoRateio === 'percentual' && b.ativa !== false)
    .reduce((s, b) => s + (Number(b.valor) || 0), 0)
}

/**
 * Valida se o rateio está completo.
 * @returns {{ ok: boolean, soma: number, diferenca: number, status: 'ok'|'incompleto'|'excedido' }}
 */
export function validarRateio(beneficiarias) {
  const soma = calcularSomaRateio(beneficiarias)
  const diferenca = parseFloat((100 - soma).toFixed(4))
  let status = 'ok'
  if (Math.abs(diferenca) > 0.001) {
    status = diferenca > 0 ? 'incompleto' : 'excedido'
  }
  return { ok: status === 'ok', soma, diferenca, status }
}

// ── Parser de texto colado (Excel / LibreOffice) ──────────────────────────

/**
 * Detecta o separador dominante no texto (tab, ; ou ,).
 */
function _detectarSeparador(linha) {
  if ((linha.match(/\t/g) || []).length >= 2) return '\t'
  if ((linha.match(/;/g) || []).length >= 2)  return ';'
  if ((linha.match(/,/g) || []).length >= 2)  return ','
  return ';'
}

/**
 * Mapeia cabeçalhos para chaves canônicas.
 * Aceita vários nomes alternativos por coluna.
 */
const MAPA_CABECALHOS = {
  uc:           ['uc', 'conta', 'contacontrato', 'conta_contrato', 'instalação', 'instalacao', 'uc/conta'],
  titular:      ['titular', 'nome', 'razaosocial', 'razão social', 'razao social', 'cliente'],
  cpf_cnpj:     ['cpf', 'cnpj', 'cpf/cnpj', 'documento', 'doc'],
  concessionaria:['concessionaria', 'concessionária', 'distribuidora', 'dist'],
  percentual:   ['percentual', '%', 'rateio', 'valor', 'quota', 'cota'],
}

function _canonicalizarCabecalho(h) {
  const norm = String(h || '').toLowerCase().trim().replace(/[^a-z0-9/]/g, '')
  for (const [canon, aliases] of Object.entries(MAPA_CABECALHOS)) {
    if (aliases.some(a => norm === a.replace(/[^a-z0-9/]/g, ''))) return canon
  }
  return null
}

/**
 * Parseia texto colado do Excel (TSV) ou CSV separado por ; ou ,
 * Detecta cabeçalho automaticamente e mapeia colunas.
 * Ignora linhas vazias.
 *
 * @param {string} texto  conteúdo colado
 * @returns {{ ok: boolean, linhas: object[], erro?: string, cabecalhos: string[] }}
 */
export function parsearTextoExcel(texto) {
  const linhas = String(texto || '').split('\n').map(l => l.replace(/\r/g, '').trim()).filter(Boolean)
  if (!linhas.length) return { ok: false, erro: 'Texto vazio.', linhas: [], cabecalhos: [] }

  const sep = _detectarSeparador(linhas[0])
  const cabecalhosRaw = linhas[0].split(sep).map(h => h.trim())
  const mapeado = cabecalhosRaw.map(_canonicalizarCabecalho)

  // Pelo menos uc ou percentual mapeados
  const temUc          = mapeado.includes('uc')
  const temPercentual  = mapeado.includes('percentual')

  const dados = []
  const erros = []
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep).map(c => c.trim())
    const obj = {}
    mapeado.forEach((canon, idx) => {
      if (canon) obj[canon] = cols[idx] ?? ''
    })
    // UC: fallback para primeira coluna numérica se não mapeada
    if (!obj.uc && cols[0] && /^\d+/.test(cols[0])) obj.uc = cols[0]
    // Percentual: fallback para última coluna numérica
    if (!obj.percentual) {
      const ultima = cols[cols.length - 1]
      if (ultima && !isNaN(Number(ultima.replace(',', '.')))) obj.percentual = ultima
    }
    const pct = parseFloat(String(obj.percentual || '').replace(',', '.'))
    if (!obj.uc) { erros.push(`Linha ${i + 1}: UC ausente`); continue }
    if (isNaN(pct) || pct <= 0) { erros.push(`Linha ${i + 1}: percentual inválido (${obj.percentual})`); continue }
    dados.push({
      contaContrato: String(obj.uc).trim(),
      titular: String(obj.titular || '').trim() || null,
      cpf_cnpj: String(obj.cpf_cnpj || '').trim() || null,
      concessionaria: String(obj.concessionaria || '').trim() || null,
      tipoRateio: 'percentual',
      valor: pct,
      ativa: true,
    })
  }

  return {
    ok: dados.length > 0,
    linhas: dados,
    erros,
    cabecalhos: mapeado.filter(Boolean),
    separador: sep,
  }
}

/**
 * Parseia CSV completo (mesmo formato de parsearTextoExcel, mas com validação adicional
 * do somatório e normalização de CPF/CNPJ).
 */
export function parsearCSV(texto) {
  const res = parsearTextoExcel(texto)
  if (!res.ok) return res
  // Normaliza CPF/CNPJ removendo pontos/traços/barras
  res.linhas = res.linhas.map(l => ({
    ...l,
    cpf_cnpj: l.cpf_cnpj ? l.cpf_cnpj.replace(/[.\-\/]/g, '') : null,
  }))
  const val = validarRateio(res.linhas)
  return { ...res, rateio: val }
}

/**
 * Normaliza uma lista de beneficiárias ajustando percentuais para fechar exatamente 100%
 * quando a diferença é ≤ 0,5% (arredondamento).
 */
export function normalizarParaCem(beneficiarias) {
  const lista = beneficiarias.filter(b => b.tipoRateio === 'percentual' && b.ativa !== false)
  const soma = lista.reduce((s, b) => s + (Number(b.valor) || 0), 0)
  const diff = 100 - soma
  if (Math.abs(diff) > 0.5 || lista.length === 0) return beneficiarias
  // Ajusta o último item
  const last = lista[lista.length - 1]
  return beneficiarias.map(b =>
    b === last || (b.contaContrato === last.contaContrato && b.tipoRateio === last.tipoRateio)
      ? { ...b, valor: parseFloat((b.valor + diff).toFixed(4)) }
      : b
  )
}
