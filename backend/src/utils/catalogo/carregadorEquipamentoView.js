/**
 * carregadorEquipamentoView.js — P0-EV-CATALOG-SINGLE-SOURCE-OF-TRUTH-01
 *
 * FONTE ÚNICA DE VERDADE dos carregadores EV = `CarregadorEV`.
 * O catálogo unificado / motor de qualidade (que falam o "formato Equipamento")
 * passam a DERIVAR a visão do carregador a partir do CarregadorEV NO MOMENTO DA
 * LEITURA — projeção COMPLETA (sem perda), NUNCA armazenada, NUNCA sincronizada.
 *
 * Isto elimina o antigo mirror parcial `Equipamento(carregador_ev)` (projeção lossy
 * que descartava qtd_conectores, ocpp, peso, dimensoes, DC, frequencia, fator_potencia,
 * tempo_carga, eficiencia, proteções).
 *
 * NÃO altera o motor de score: apenas alimenta `processarEquipamento` com o doc derivado.
 */

/**
 * Converte um doc CarregadorEV no formato Equipamento (COMPLETO — todos os campos).
 * @param {object} cg  documento CarregadorEV (Mongoose doc ou POJO)
 * @returns {object}   doc no formato Equipamento (não persistido)
 */
export function carregadorParaEquipamento(cg) {
  if (!cg) return null
  const c = typeof cg.toObject === 'function' ? cg.toObject() : cg
  return {
    _id: c._id,
    tipo: 'carregador_ev',
    fabricante: c.marca,
    modelo: c.modelo,
    // Proveniência: preserva a do CarregadorEV se houver. Default = 'import_legado' para
    // manter PARIDADE DE SCORE com o antigo mirror (esta sprint é só persistência — NÃO
    // altera score). Corrigir a proveniência (→ score maior) é um one-liner p/ sprint futura.
    origem: c.origem || { tipo: 'import_legado', fonte: 'catalogo_ev', em: c.createdAt || new Date() },
    especificacoes: {
      // identificação de fase / tipo
      tipo_carregador: c.tipo,
      // engenharia elétrica (entrada AC)
      potencia_kw: c.potencia_kw,
      tensao_entrada_v: c.tensao_entrada_v,
      corrente_entrada_a: c.corrente_entrada_a,
      numero_fases: c.numero_fases,
      frequencia_hz: c.frequencia_hz,
      fator_potencia: c.fator_potencia,
      // saída DC (carregadores DC)
      tensao_saida_dc_v: c.tensao_saida_dc_v,
      corrente_saida_dc_a: c.corrente_saida_dc_a,
      eficiencia_pct: c.eficiencia_pct,
      tempo_carga_rapida_min: c.tempo_carga_rapida_min,
      // conector / comunicação
      tipo_conector: c.tipo_conector,
      qtd_conectores: c.qtd_conectores,
      protocolo_carregamento: c.protocolo_carregamento,
      tipo_carregamento: c.tipo_carregamento,
      comunicacao: c.comunicacao,
      ocpp: c.ocpp,
      // proteção / ambiente / físico
      grau_protecao_ip: c.grau_protecao_ip,
      temperatura_operacao: c.temperatura_operacao,
      peso_kg: c.peso_kg,
      dimensoes_mm: c.dimensoes_mm,
      // recomendações elétricas (quando presentes)
      disjuntor_recomendado_a: c.disjuntor_recomendado_a,
      dr_recomendado_ma: c.dr_recomendado_ma,
      bitola_cabo_minima_mm2: c.bitola_cabo_minima_mm2,
      // rastreabilidade p/ a fonte única
      carregadorEV_id: c._id,
    },
    garantia_produto: c.garantia_anos ? { value: c.garantia_anos, unit: 'anos' } : undefined,
    datasheet_url: c.datasheet_url,
    ativo: c.ativo !== false,
    _origem: 'CarregadorEV',   // marca: derivado (frontend sabe qual coleção excluir/editar)
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

/**
 * Converte e ANEXA a qualidade calculada (reusa o motor de score — não o altera).
 * @param {object} cg                   doc CarregadorEV
 * @param {function} processarEquipamento  injetado p/ evitar ciclo de import
 */
export function carregadorParaEquipamentoComQualidade(cg, processarEquipamento) {
  const doc = carregadorParaEquipamento(cg)
  if (!doc || typeof processarEquipamento !== 'function') return doc
  try {
    const r = processarEquipamento(doc)
    doc.qualidade = r.qualidade
    doc.status_operacional = r.status_operacional
    if (r.specs_canonicas) doc.specs_canonicas = r.specs_canonicas
    doc.utilizavel_em_projeto = r.utilizavel_em_projeto !== false
  } catch { /* qualidade é best-effort; nunca derruba a leitura */ }
  return doc
}
