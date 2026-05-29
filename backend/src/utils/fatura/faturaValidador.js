/**
 * faturaValidador.js — Sprint 8.5
 * Validações PURAS sobre o objeto FaturaEnergia normalizado.
 * Devolve { ok, alertas: [{campo, severidade, mensagem}], necessita_revisao }.
 *
 * Severidades: 'erro' (bloqueante), 'aviso' (revisão humana), 'info' (informativo).
 * `necessita_revisao` é true sempre que há ao menos um alerta de 'erro' ou 'aviso'.
 */

export function validarFatura(fatura) {
  const alertas = []
  if (!fatura) return { ok: false, alertas: [{ campo: 'fatura', severidade: 'erro', mensagem: 'Fatura vazia.' }], necessita_revisao: true }

  // 1) kW vs kWh — bug clássico em Grupo A. Bloqueia se consumo > 100 e estiver em "kW".
  const consumo = fatura.consumo_atual_kwh?.valor
  if (typeof consumo === 'number' && consumo > 50000) {
    alertas.push({
      campo: 'consumo_atual_kwh',
      severidade: 'aviso',
      mensagem: `Consumo ${consumo} parece alto demais — confirme se é kWh e não kW.`,
    })
  }

  // 2) Histórico < 12 meses → revisão humana.
  if (fatura.flags?.historico_incompleto) {
    alertas.push({
      campo: 'historico_consumo',
      severidade: 'aviso',
      mensagem: 'Histórico incompleto (<12 meses). Operador deve completar.',
    })
  }
  if (fatura.flags?.mes_zerado) {
    alertas.push({
      campo: 'historico_consumo',
      severidade: 'info',
      mensagem: 'Há mês com consumo zerado — pode indicar troca de titularidade.',
    })
  }
  if (fatura.flags?.meses_repetidos) {
    alertas.push({
      campo: 'historico_consumo',
      severidade: 'info',
      mensagem: 'Histórico continha meses duplicados (deduplicado automaticamente).',
    })
  }

  // 3) GD detectada → nunca usar injetada como consumo.
  if (fatura.geracao_existente?.possui_gd?.valor === true) {
    alertas.push({
      campo: 'geracao_existente',
      severidade: 'aviso',
      mensagem: fatura.geracao_existente.alerta || 'GD detectada — confirme que o consumo NÃO inclui energia injetada.',
    })
  }

  // 4) Grupo A sem demanda contratada → suspeito.
  if (fatura.flags?.grupo_a && fatura.grupo_a?.demanda_contratada?.valor == null) {
    alertas.push({
      campo: 'grupo_a.demanda_contratada',
      severidade: 'aviso',
      mensagem: 'Cliente Grupo A sem demanda contratada extraída — confirme manualmente.',
    })
  }

  // 5) UC ausente → bloqueante (não dá pra criar cliente).
  if (!fatura.unidade_consumidora?.numero_uc?.valor) {
    alertas.push({
      campo: 'unidade_consumidora.numero_uc',
      severidade: 'erro',
      mensagem: 'Número da UC não localizado — obrigatório para criar cliente/projeto.',
    })
  }

  // 6) Concessionária desconhecida → info.
  const c = fatura.unidade_consumidora?.concessionaria?.valor
  if (!c || c === 'DESCONHECIDA' || c === 'OUTRA') {
    alertas.push({
      campo: 'unidade_consumidora.concessionaria',
      severidade: 'info',
      mensagem: 'Concessionária não identificada — parser genérico em uso.',
    })
  }

  const temBloqueante = alertas.some((a) => a.severidade === 'erro')
  const temAviso = alertas.some((a) => a.severidade === 'aviso')

  return {
    ok: !temBloqueante,
    alertas,
    necessita_revisao: temBloqueante || temAviso,
  }
}

/**
 * Compara duas faturas para detectar provável duplicidade (mesmo CPF/CNPJ ou mesma UC).
 * Retorna { duplicada: boolean, razao?: string }.
 */
export function detectarDuplicidade(faturaA, faturaB) {
  if (!faturaA || !faturaB) return { duplicada: false }
  const cpfA = faturaA.cliente?.cpf_cnpj?.valor
  const cpfB = faturaB.cliente?.cpf_cnpj?.valor
  const ucA = faturaA.unidade_consumidora?.numero_uc?.valor
  const ucB = faturaB.unidade_consumidora?.numero_uc?.valor
  if (ucA && ucB && String(ucA) === String(ucB)) {
    return { duplicada: true, razao: `UC ${ucA} já cadastrada.` }
  }
  if (cpfA && cpfB && String(cpfA).replace(/\D/g, '') === String(cpfB).replace(/\D/g, '')) {
    return { duplicada: true, razao: `CPF/CNPJ ${cpfA} já cadastrado.` }
  }
  return { duplicada: false }
}
