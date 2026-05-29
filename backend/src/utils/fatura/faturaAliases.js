/**
 * faturaAliases.js — Sprint 8.5
 * Dicionário PURO de sinônimos por campo + utilitário para casar contra texto.
 * Filosofia herdada do Catálogo Inteligente: não procurar texto fixo, mas alvos
 * semânticos com várias formas de expressão (cada concessionária escreve diferente).
 */

export const ALIASES = {
  numero_uc: [
    'unidade consumidora', 'n° da uc', 'numero da uc', 'codigo do cliente',
    'instalacao', 'nº instalacao', 'codigo de instalacao', 'cod. instalacao',
    'conta contrato', 'conta de contrato', 'unidade consumidora (uc)',
  ],
  cliente_nome: ['nome', 'titular', 'consumidor', 'razao social', 'cliente'],
  cpf_cnpj: ['cpf', 'cnpj', 'cpf/cnpj', 'cic/cnpj'],
  endereco: ['endereco', 'logradouro', 'rua', 'av.', 'avenida'],
  cidade: ['cidade', 'municipio'],
  uf: ['uf', 'estado'],
  cep: ['cep'],
  classe: ['classe', 'classificacao'],
  subgrupo: ['subgrupo', 'sub-grupo', 'sub grupo'],
  grupo: ['grupo', 'grupo tarifario'],
  modalidade_tarifaria: ['modalidade tarifaria', 'tarifa', 'modalidade', 'verde', 'azul', 'branca'],
  tensao_nominal: ['tensao nominal', 'tensao de fornecimento', 'tensao'],
  tipo_ligacao: ['ligacao', 'tipo de ligacao', 'monofasico', 'bifasico', 'trifasico'],

  // Consumo / faturamento
  consumo_kwh: [
    'consumo faturado', 'consumo mensal', 'consumo (kwh)', 'consumo medido',
    'consumo total', 'energia ativa fornecida', 'energia ativa', 'kwh',
  ],
  historico: ['historico', 'historico de consumo', 'historico ultimos', 'consumo dos ultimos'],

  // Grupo A
  demanda_contratada: ['demanda contratada', 'demanda contrat', 'demanda contratual'],
  demanda_medida: ['demanda medida', 'demanda registrada', 'demanda faturada'],
  demanda_ponta: ['demanda ponta', 'demanda hp', 'demanda na ponta'],
  demanda_fora_ponta: ['demanda fora ponta', 'demanda fp', 'demanda fora de ponta'],
  consumo_ponta: ['consumo ponta', 'energia ponta', 'kwh ponta', 'consumo hp'],
  consumo_fora_ponta: ['consumo fora ponta', 'energia fora ponta', 'kwh fora ponta', 'consumo fp'],
  energia_reativa: ['energia reativa', 'reativo excedente', 'eer', 'energia kvarh'],
  fator_potencia: ['fator de potencia', 'fp', 'cos phi'],
  ultrapassagem: ['ultrapassagem', 'demanda de ultrapassagem'],

  // GD / SCEE
  gd: ['scee', 'energia compensada', 'energia injetada', 'saldo de credito',
       'saldo creditos', 'geracao distribuida', 'compensacao de energia',
       'mini e microgeracao', 'mmgd'],
}

// Normalização sem acentos para matching.
export function _normalizar(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

/** Verdadeiro se qualquer alias do campo aparece no texto. */
export function temAlias(texto, campo) {
  const t = _normalizar(texto)
  return (ALIASES[campo] || []).some((a) => t.includes(a))
}

/** Devolve o índice do PRIMEIRO alias encontrado (ou -1) — útil p/ extrair valor próximo. */
export function indiceDoPrimeiroAlias(texto, campo) {
  const t = _normalizar(texto)
  let melhor = -1
  for (const a of ALIASES[campo] || []) {
    const i = t.indexOf(a)
    if (i !== -1 && (melhor === -1 || i < melhor)) melhor = i
  }
  return melhor
}
