/**
 * equipamentos/inversores — P0-INV-SSOT-01
 *
 * Ponto de entrada único do domínio "inversor". Todos os consumidores
 * (qualidade backend/frontend, dimensionamento, ficha, importação assistida)
 * importam daqui — nunca traduzem nomes de campo localmente.
 */

import { CAMPOS_INVERSOR, PESO_IDENTIFICACAO, CAMPOS_COM_PESO, valorCampo, lerInversor, TOPOLOGIA, derivarTopologia, classificarTopologiaInversor, ehMicroinversor, normalizarEntradasPorMppt } from './dicionarioInversor.js'

export { CAMPOS_INVERSOR, PESO_IDENTIFICACAO, CAMPOS_COM_PESO, valorCampo, lerInversor, TOPOLOGIA, derivarTopologia, classificarTopologiaInversor, ehMicroinversor, normalizarEntradasPorMppt }

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Projeção para o DIMENSIONAMENTO (compatibilidadeFV / stringSizing).
 * Lê do MESMO objeto persistido via SSOT — sem aliases locais.
 * Mantém os nomes que o calculador elétrico espera (compatibilidade).
 * @returns {{potencia_kw,tensao_nominal_v,voc_max_dc,mppt_min_v,mppt_max_v,isc_max_mppt,n_mppts}}
 */
export function paraDimensionamento(especificacoes, equipamento = {}) {
  const c = lerInversor(especificacoes, equipamento)
  const entradas = c.entradas_por_mppt

  // FV-DOM-029: os cinco defaults abaixo foram REMOVIDOS.
  //
  //   voc_max_dc   ?? 600      mppt_min_v   ?? 100
  //   mppt_max_v   ?? 550      isc_max_mppt ?? 13
  //   n_mppts      ?? 2
  //
  // Eram limites de SEGURANÇA fabricados: um inversor sem `tensao_max_entrada`
  // no catálogo era validado contra 600 V inventados, e passava. A ausência
  // ficava indistinguível de um dado real — a mesma classe de defeito que a
  // FV-DOM-011B removeu do financeiro e a FV-DOM-025 do elétrico.
  //
  // Agora ausência é `null` e viaja declarada em `lacunas`. Quem consome decide
  // o que fazer com ela; ninguém recebe um número que o catálogo não afirmou.
  const voc_max_dc = _num(c.tensao_max_entrada)
  const mppt_min_v = _num(c.tensao_mppt_min)
  const mppt_max_v = _num(c.tensao_mppt_max)
  // F8: a precedência `corrente_isc_max ?? corrente_max_por_mppt` foi REMOVIDA.
  //
  // Os dois campos eram reais, mas são GRANDEZAS DIFERENTES. `corrente_isc_max`
  // é o limite de CURTO-CIRCUITO da entrada (Isc, IEC 62109-1);
  // `corrente_max_por_mppt` é o limite de CORRENTE DE TRABALHO (Impp). Um
  // inversor de 32 A de trabalho não suporta 32 A de curto — o curto é sempre o
  // limite maior, e substituir um pelo outro produzia uma verificação
  // SISTEMATICAMENTE mais permissiva do que o fabricante declarou, exatamente
  // no ponto em que `montarStrings` decide se a string cabe na entrada.
  //
  // Não há substituto numérico: sem o limite de curto declarado, a verificação
  // não pode ser feita. Ausência vira `null` e viaja em `lacunas`, como a
  // FV-DOM-029 já fazia com os outros cinco. O limite de TRABALHO continua
  // disponível em `corrente_max_por_mppt` — separado, com seu próprio nome.
  const isc_max_mppt = _num(c.corrente_isc_max)
  const n_mppts = _num(c.n_mppts)

  // FV-DOM-031: o lado CC do micro tem lacunas PRÓPRIAS. Ficam num array
  // separado de propósito: `lacunas` é o contrato da FV-DOM-029 para o caminho
  // string, e mexer nele mudaria o veredito de `montarStrings`.
  const lacunas_micro = []
  if (c.tipo_topologia === 'MICRO') {
    if (_num(c.entradas) === null) lacunas_micro.push('entradas')
    if (_num(c.modulos_por_entrada) === null) lacunas_micro.push('modulos_por_entrada')
    if (_num(c.potencia_kw) === null) lacunas_micro.push('potencia_kw')
    if (_num(c.oversizing_max) === null) lacunas_micro.push('oversizing_max')
  }

  const lacunas = []
  if (voc_max_dc === null) lacunas.push('tensao_max_entrada')
  if (mppt_min_v === null) lacunas.push('tensao_mppt_min')
  if (mppt_max_v === null) lacunas.push('tensao_mppt_max')
  if (isc_max_mppt === null) lacunas.push('corrente_isc_max')
  if (n_mppts === null) lacunas.push('n_mppts')

  return {
    // Estes DOIS permanecem como estavam — não entraram no escopo da FV-DOM-029
    // e estão reportados como pendência: `potencia_kw` cai em 0 e
    // `tensao_nominal_v` é derivada das fases (380/220).
    potencia_kw:      _num(c.potencia_kw) ?? _num(equipamento.potencia_kw) ?? 0,
    tensao_nominal_v: _num(c.tensao_ac) ?? (c.fases === 3 ? 380 : 220),
    voc_max_dc,
    mppt_min_v,
    mppt_max_v,
    isc_max_mppt,
    // F8: o limite de TRABALHO, que antes se disfarçava de limite de curto no
    // `??`, agora sai com o próprio nome. Quem precisar dele tem acesso; quem
    // precisar do curto não o recebe por engano.
    corrente_max_por_mppt: _num(c.corrente_max_por_mppt),
    n_mppts,
    // P1-INV-TOPOLOGY-01: limite FÍSICO do equipamento (consumido, não altera regras).
    tipo_topologia:   c.tipo_topologia,
    entradas_por_mppt: entradas,
    max_entradas_total: Array.isArray(entradas) ? entradas.reduce((a, b) => a + b, 0) : null,
    // FV-DOM-031: lado CC do MICROINVERSOR. Sem default — ausência é `null` e
    // vira lacuna quando a topologia é micro (mesma disciplina da FV-DOM-029).
    entradas:            _num(c.entradas),
    modulos_por_entrada: _num(c.modulos_por_entrada),
    oversizing_max:      _num(c.oversizing_max),
    /** Campos que o catálogo não declarou. Vazio = especificação completa. */
    lacunas,
    /** Idem, para o lado CC do microinversor. Sempre vazio fora da topologia MICRO. */
    lacunas_micro,
  }
}
