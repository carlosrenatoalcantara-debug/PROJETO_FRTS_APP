/**
 * faturaDoCliente — o que do CADASTRO do cliente já é fato da fatura do projeto.
 *
 * Ao criar um projeto FV, o operador não deve redigitar o que o cadastro do
 * cliente já tem (concessionária, ligação, consumo, tarifa, UC). Esta função
 * devolve só campos PRESENTES no cliente, no formato de `fatura_extracao`.
 *
 * Regras:
 *  - Ausente, vazio ou 0 no cliente ⇒ campo OMITIDO (fica `null` no schema).
 *    Nunca default: o schema do Cliente usa 0 e '' como "não informado".
 *  - NÃO grava tensão. Ela é derivada (ligação + concessionária) e valor
 *    derivado não é persistido; a tela a deriva ao exibir.
 *  - Não marca `confirmado_pelo_usuario` nem `metodo`: nada aqui foi extraído
 *    de documento neste projeto.
 */
const texto = (v) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}
const positivo = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function faturaDoCliente(cliente) {
  if (!cliente || typeof cliente !== 'object') return {}
  const campos = {
    numero_cliente: texto(cliente.numero_cliente),
    codigo_instalacao: texto(cliente.codigo_instalacao),
    concessionaria: texto(cliente.distribuidora),
    tipo_ligacao: texto(cliente.tipo_ligacao),
    classificacao: texto(cliente.classificacao),
    subgrupo: texto(cliente.subgrupo),
    consumo_mensal_kwh: positivo(cliente.consumo_kwh),
    valor_kwh: positivo(cliente.valor_kwh),
  }
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== null))
}
