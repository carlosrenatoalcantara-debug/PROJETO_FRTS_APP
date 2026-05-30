/**
 * analisadorEnergetico.js — Sprint 8.9
 *
 * Camada PURA de análise energética sobre uma FaturaEnergia já parseada
 * (output de faturaParser.parsearFatura). Não chama IA, não acessa banco.
 *
 * Transforma o "leitor" em "analisador":
 *  1. Grupo A: ultrapassagem de demanda (medida vs contratada + tolerância 5%)
 *  2. Tarifação: split ponta/fora-ponta + modalidade (verde/azul)
 *  3. GD: saldo acumulado, compensação, autossuficiência
 *  4. Histórico: estatísticas + sazonalidade (variação mensal)
 *  5. Consistência: detecta leituras incoerentes (picos, zeros, negativos)
 *  6. Resumo para dashboard energético
 */

const _num = (campoOuValor) => {
  if (campoOuValor == null) return null
  if (typeof campoOuValor === 'object' && 'valor' in campoOuValor) {
    const v = campoOuValor.valor
    return v == null ? null : Number(v)
  }
  const n = Number(campoOuValor)
  return Number.isFinite(n) ? n : null
}

// ── 1. Grupo A: ultrapassagem de demanda ───────────────────────────────────
// Lei: cobrança de ultrapassagem quando demanda medida > 105% da contratada (ANEEL).
export const TOLERANCIA_ULTRAPASSAGEM = 0.05

export function analisarDemanda(grupoA) {
  if (!grupoA) return { aplicavel: false }
  const contratada = _num(grupoA.demanda_contratada)
  const medida = _num(grupoA.demanda_medida)
  if (contratada == null || medida == null) {
    return { aplicavel: true, demanda_contratada: contratada, demanda_medida: medida, calculavel: false }
  }
  const limite = contratada * (1 + TOLERANCIA_ULTRAPASSAGEM)
  const ultrapassou = medida > limite
  const excedente = ultrapassou ? +(medida - contratada).toFixed(2) : 0
  // Folga: quanto ainda cabe antes da multa
  const folga_kw = +(limite - medida).toFixed(2)
  const utilizacao_pct = contratada > 0 ? Math.round((medida / contratada) * 100) : null

  return {
    aplicavel: true,
    calculavel: true,
    demanda_contratada: contratada,
    demanda_medida: medida,
    limite_sem_multa: +limite.toFixed(2),
    ultrapassou,
    excedente_kw: excedente,
    folga_kw,
    utilizacao_pct,
    recomendacao: ultrapassou
      ? `Demanda medida (${medida} kW) excede o limite de ${limite.toFixed(0)} kW. Avalie aumentar a contratada ou reduzir picos.`
      : utilizacao_pct != null && utilizacao_pct < 60
        ? `Demanda subutilizada (${utilizacao_pct}%). Possível redução da demanda contratada.`
        : 'Demanda dentro da faixa adequada.',
  }
}

// ── 2. Tarifação: split ponta / fora-ponta ──────────────────────────────────
export function analisarTarifacao(grupoA, classificacao) {
  const modalidade = grupoA?.modalidade?.valor || grupoA?.modalidade || classificacao?.modalidade_tarifaria?.valor || null
  if (!grupoA) return { modalidade, aplicavel: false }
  const cp = _num(grupoA.consumo_ponta)
  const cfp = _num(grupoA.consumo_fora_ponta)
  const total = (cp || 0) + (cfp || 0)
  return {
    aplicavel: true,
    modalidade,
    consumo_ponta: cp,
    consumo_fora_ponta: cfp,
    consumo_total: total > 0 ? total : null,
    pct_ponta: total > 0 && cp != null ? Math.round((cp / total) * 100) : null,
    pct_fora_ponta: total > 0 && cfp != null ? Math.round((cfp / total) * 100) : null,
  }
}

// ── 3. GD: saldo acumulado e compensação ────────────────────────────────────
export function analisarGD(geracao, consumoAtual) {
  const possui = geracao?.possui_gd?.valor === true || geracao?.possui_gd === true
  if (!possui) return { possui_gd: false }
  const injetada = _num(geracao.energia_injetada)
  const creditos = _num(geracao.creditos)
  const compensacao = _num(geracao.compensacao)
  const consumo = _num(consumoAtual)

  // Autossuficiência aproximada: energia compensada / consumo
  let autossuficiencia_pct = null
  if (compensacao != null && consumo != null && consumo > 0) {
    autossuficiencia_pct = Math.round((compensacao / consumo) * 100)
  } else if (injetada != null && consumo != null && consumo > 0) {
    autossuficiencia_pct = Math.round((injetada / consumo) * 100)
  }

  return {
    possui_gd: true,
    energia_injetada: injetada,
    creditos_kwh: creditos,
    compensacao_kwh: compensacao,
    saldo_acumulado_kwh: creditos,
    autossuficiencia_pct,
    alerta: 'Energia injetada NÃO deve ser usada como consumo no dimensionamento.',
  }
}

// ── 4. Histórico: sazonalidade ──────────────────────────────────────────────
export function analisarSazonalidade(historico) {
  const itens = Array.isArray(historico) ? historico.filter(h => Number.isFinite(Number(h.kwh)) && Number(h.kwh) > 0) : []
  if (itens.length < 3) return { calculavel: false, meses: itens.length }

  const valores = itens.map(h => Number(h.kwh))
  const media = valores.reduce((s, v) => s + v, 0) / valores.length
  const maior = Math.max(...valores)
  const menor = Math.min(...valores)
  // Desvio padrão populacional
  const variancia = valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length
  const desvio = Math.sqrt(variancia)
  const coef_variacao = media > 0 ? +(desvio / media).toFixed(3) : 0

  // Identifica mês de maior e menor consumo
  const idxMaior = valores.indexOf(maior)
  const idxMenor = valores.indexOf(menor)
  const amplitude_pct = media > 0 ? Math.round(((maior - menor) / media) * 100) : 0

  return {
    calculavel: true,
    meses: itens.length,
    media: +media.toFixed(1),
    maior, menor,
    mes_maior: itens[idxMaior] ? `${itens[idxMaior].mes}/${itens[idxMaior].ano}` : null,
    mes_menor: itens[idxMenor] ? `${itens[idxMenor].mes}/${itens[idxMenor].ano}` : null,
    coef_variacao,
    amplitude_pct,
    sazonalidade: coef_variacao > 0.25 ? 'alta' : coef_variacao > 0.12 ? 'moderada' : 'baixa',
  }
}

// ── 5. Consistência: detecta leituras incoerentes ───────────────────────────
export function detectarInconsistencias(fatura) {
  const problemas = []
  const hist = Array.isArray(fatura.historico_consumo) ? fatura.historico_consumo : []
  const valores = hist.map(h => Number(h.kwh)).filter(Number.isFinite)

  // a) Valores negativos
  for (const h of hist) {
    if (Number(h.kwh) < 0) problemas.push({ tipo: 'consumo_negativo', severidade: 'erro', detalhe: `${h.mes}/${h.ano}: ${h.kwh} kWh` })
  }

  // b) Zeros suspeitos no meio do histórico (não no início — pode ser instalação nova)
  const idxZeros = hist.map((h, i) => (Number(h.kwh) === 0 ? i : -1)).filter(i => i > 0 && i < hist.length - 1)
  if (idxZeros.length > 0) {
    problemas.push({ tipo: 'mes_zerado_intermediario', severidade: 'aviso', detalhe: `${idxZeros.length} mês(es) zerado(s) no meio do histórico (possível troca de titularidade ou erro de leitura).` })
  }

  // c) Picos anômalos: valor > 3x a mediana
  if (valores.length >= 4) {
    const ordenados = [...valores].sort((a, b) => a - b)
    const mediana = ordenados[Math.floor(ordenados.length / 2)]
    if (mediana > 0) {
      for (const h of hist) {
        const v = Number(h.kwh)
        if (Number.isFinite(v) && v > mediana * 3) {
          problemas.push({ tipo: 'pico_anomalo', severidade: 'aviso', detalhe: `${h.mes}/${h.ano}: ${v} kWh (>3× a mediana de ${mediana}).` })
        }
      }
    }
  }

  // d) Grupo A: medida ≫ contratada (provável kW/kWh trocado ou erro)
  if (fatura.grupo_a) {
    const dc = _num(fatura.grupo_a.demanda_contratada)
    const dm = _num(fatura.grupo_a.demanda_medida)
    if (dc != null && dm != null && dm > dc * 2) {
      problemas.push({ tipo: 'demanda_incoerente', severidade: 'aviso', detalhe: `Demanda medida (${dm}) é mais que o dobro da contratada (${dc}). Confirme as unidades (kW vs kWh).` })
    }
  }

  // e) GD com energia injetada igual ao consumo (suspeito de leitura trocada)
  if (fatura.geracao_existente?.possui_gd?.valor) {
    const inj = _num(fatura.geracao_existente.energia_injetada)
    const cons = _num(fatura.consumo_atual_kwh)
    if (inj != null && cons != null && cons > 0 && Math.abs(inj - cons) / cons < 0.02) {
      problemas.push({ tipo: 'gd_injetada_igual_consumo', severidade: 'aviso', detalhe: 'Energia injetada ≈ consumo. Verifique se a leitura não está trocada.' })
    }
  }

  return {
    consistente: problemas.filter(p => p.severidade === 'erro').length === 0,
    total_problemas: problemas.length,
    problemas,
  }
}

// ── 6. Resumo para dashboard energético ─────────────────────────────────────
export function gerarDashboardEnergetico(fatura) {
  if (!fatura) return null

  const demanda = analisarDemanda(fatura.grupo_a)
  const tarifacao = analisarTarifacao(fatura.grupo_a, fatura.classificacao)
  const gd = analisarGD(fatura.geracao_existente, fatura.consumo_atual_kwh)
  const sazonalidade = analisarSazonalidade(fatura.historico_consumo)
  const consistencia = detectarInconsistencias(fatura)

  const grupo = fatura.classificacao?.grupo?.valor || (fatura.grupo_a ? 'A' : 'B')
  const consumoMedio = sazonalidade.calculavel ? sazonalidade.media : _num(fatura.consumo_atual_kwh)

  // Estimativa de potência FV necessária (regra de bolso BR: ~140 kWh/kWp/mês)
  const KWH_POR_KWP_MES = 140
  const potencia_fv_estimada_kwp = consumoMedio != null
    ? +(consumoMedio / KWH_POR_KWP_MES).toFixed(2)
    : null

  return {
    grupo,
    modalidade: tarifacao.modalidade,
    consumo_medio_kwh: consumoMedio,
    demanda,
    tarifacao,
    gd,
    sazonalidade,
    consistencia,
    dimensionamento_sugerido: {
      potencia_fv_estimada_kwp,
      base: `${KWH_POR_KWP_MES} kWh/kWp/mês (regra de bolso — refine com irradiância local)`,
      considera_gd_existente: gd.possui_gd,
    },
    // Score de prontidão para proposta (0-100)
    prontidao_proposta: calcularProntidao({ consumoMedio, sazonalidade, consistencia, demanda }),
  }
}

function calcularProntidao({ consumoMedio, sazonalidade, consistencia, demanda }) {
  let score = 0
  if (consumoMedio != null) score += 30
  if (sazonalidade.calculavel && sazonalidade.meses >= 12) score += 30
  else if (sazonalidade.calculavel) score += 15
  if (consistencia.consistente) score += 25
  if (!demanda.aplicavel || demanda.calculavel) score += 15
  return Math.min(100, score)
}
