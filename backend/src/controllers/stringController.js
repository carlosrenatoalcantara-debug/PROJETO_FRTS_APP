import { PAINEIS, getPainelById } from '../data/catalogoPaineis.js'
import { INVERSORES, getInversorById } from '../data/catalogoInversores.js'

// ── helpers internos ──────────────────────────────────────────────────────────

/** Voc de um painel corrigido pela temperatura mínima */
function vocPorTemperatura(modulo, tempMin) {
  const coef = modulo.tempCoefVoc ?? -0.28      // %/°C
  const fator = 1 + (coef / 100) * (tempMin - 25)
  return modulo.voc * fator
}

/** Normaliza entrada aceitando formato novo (modulo/modulos) e legado (painel/numPaineis) */
function normalizarEntrada(body) {
  const modulo   = body.modulo   ?? body.painel   ?? (body.painelId   ? getPainelById(body.painelId)   : null)
  const inversor = body.inversor                  ?? (body.inversorId  ? getInversorById(body.inversorId): null)
  const modulos  = Number(body.modulos ?? body.numPaineis ?? 0)
  const tempMin  = Number(body.temperatura?.min ?? body.tempMin ?? -2)
  return { modulo, inversor, modulos, tempMin }
}

// ── engine principal de string ────────────────────────────────────────────────

/**
 * gerarStrings(modulos, modulo, inversor) — assinatura canônica
 * Distribui módulos automaticamente entre MPPTs e valida eletricamente.
 * Retorna { strings: [{mppt, modulos}], valido: bool, ... }
 */
function _gerarStrings(modulos, modulo, inversor, tempMin = -2) {
  const alertas = []
  const erros   = []

  // Microinversor: 1 módulo por inversor
  if (inversor.tipoInversor === 'micro') {
    const strings = Array.from({ length: modulos }, (_, i) => ({ mppt: i + 1, modulos: 1 }))
    return {
      strings,
      valido:          true,
      paineisPorString: 1,
      totalStrings:    modulos,
      totalModulos:    modulos,
      distribuicaoMPPT:strings,
      vocFrio:         +(vocPorTemperatura(modulo, tempMin) * 1).toFixed(1),
      vmpString:       +modulo.vmpp.toFixed(1),
      iString:         +modulo.isc.toFixed(2),
      oversizing:      +((modulo.pmpp / (inversor.potenciaKW * 1000)) * 100).toFixed(1),
      potenciaRealKwp: +((modulos * modulo.pmpp) / 1000).toFixed(2),
      alertas, erros,
    }
  }

  const vocFrioUnit = vocPorTemperatura(modulo, tempMin)

  // ── 1. Restrição Voc (segurança de sobretensão)
  const maxPorVoc  = Math.floor(inversor.vocMax / vocFrioUnit)

  // ── 2. Restrição MPPT
  const minPorMPPT = Math.ceil(inversor.mpptMin / modulo.vmpp)
  const maxPorMPPT = Math.floor(inversor.mpptMax / modulo.vmpp)

  const maxPorString = Math.min(maxPorVoc, maxPorMPPT)
  const minPorString = minPorMPPT

  if (maxPorString < minPorString) {
    erros.push(
      `Combinação incompatível: tensão Voc limita a ${maxPorVoc} módulos/string, ` +
      `mas MPPT exige mínimo de ${minPorMPPT}. Escolha inversor com Voc_max maior ou tensão MPPT mais baixa.`
    )
    return { strings: [], valido: false, erros, alertas, paineisPorString: 0, totalStrings: 0 }
  }

  // ── 3. Escolha ótima de módulos por string
  // Critério: minimizar sobra → preferir string maior (menos strings = mais simples)
  let melhorPps = maxPorString, melhorSobra = Infinity
  for (let pps = maxPorString; pps >= minPorString; pps--) {
    const sobra = modulos % pps
    if (sobra < melhorSobra) { melhorSobra = sobra; melhorPps = pps }
  }
  const paineisPorString = melhorPps

  // ── 4. Strings e arredondamento
  const totalStrings = Math.ceil(modulos / paineisPorString)
  const totalModulos  = totalStrings * paineisPorString

  if (totalModulos > modulos) {
    alertas.push(
      `Layout arredondado: ${totalModulos} módulos (${totalModulos - modulos} a mais) ` +
      `para manter strings simétricas de ${paineisPorString} módulos.`
    )
  }

  // ── 5. Limite de corrente por MPPT
  const maxStringsPorI   = Math.floor(inversor.imaxMppt / modulo.isc)
  const maxStringsPorEnt = Math.floor(inversor.nStringsTotal / inversor.nMppts)
  const maxStringsPorMPPT = Math.min(maxStringsPorI, maxStringsPorEnt)

  if (maxStringsPorMPPT < 1) {
    erros.push(
      `Isc do módulo (${modulo.isc.toFixed(1)} A) excede Imax do MPPT (${inversor.imaxMppt} A). ` +
      `Use inversor com maior capacidade de corrente por MPPT.`
    )
    return { strings: [], valido: false, erros, alertas, paineisPorString, totalStrings }
  }

  // ── 6. Distribuição entre MPPTs
  const mpptNecessarios = Math.ceil(totalStrings / maxStringsPorMPPT)
  if (mpptNecessarios > inversor.nMppts) {
    alertas.push(
      `Sistema precisa de ${mpptNecessarios} MPPTs; inversor tem ${inversor.nMppts}. ` +
      `Considere inversor com mais entradas MPPT ou reduza strings paralelas.`
    )
  }

  const distribuicaoMPPT = []
  const stringsArr = []
  let restantes = totalStrings

  for (let m = 1; m <= inversor.nMppts && restantes > 0; m++) {
    const s = Math.min(maxStringsPorMPPT, restantes)
    distribuicaoMPPT.push({ mppt: m, strings: s, paineis: s * paineisPorString })
    for (let k = 0; k < s; k++) {
      stringsArr.push({ mppt: m, modulos: paineisPorString })
    }
    restantes -= s
  }

  // ── 7. Verificações elétricas
  const vocString  = vocFrioUnit * paineisPorString
  const vmpString  = modulo.vmpp * paineisPorString
  const iString    = modulo.isc  * (distribuicaoMPPT[0]?.strings ?? 1)
  const potDC      = totalModulos * modulo.pmpp
  const potAC      = inversor.potenciaKW * 1000
  const oversizing = (potDC / potAC) * 100

  if (vocString > inversor.vocMax)
    erros.push(`Voc em frio (${vocString.toFixed(0)} V) > Voc_max do inversor (${inversor.vocMax} V). Reduza a string.`)

  if (vmpString < inversor.mpptMin)
    alertas.push(`Vmpp da string (${vmpString.toFixed(0)} V) < início do MPPT (${inversor.mpptMin} V). Adicione módulos à string.`)

  if (vmpString > inversor.mpptMax)
    erros.push(`Vmpp da string (${vmpString.toFixed(0)} V) > limite MPPT (${inversor.mpptMax} V). Reduza a string.`)

  if (iString > inversor.imaxMppt)
    erros.push(`Corrente por MPPT (${iString.toFixed(1)} A) > Imax (${inversor.imaxMppt} A). Reduza strings paralelas.`)

  if (oversizing > 135)
    alertas.push(`Oversizing DC/AC: ${oversizing.toFixed(0)}% (> 135% — risco de clipping; verificar temperatura do inversor e local).`)
  else if (oversizing > 130)
    alertas.push(`Oversizing DC/AC: ${oversizing.toFixed(0)}% (acima de 130% — limite máximo permitido; monitorar clipping).`)
  else if (oversizing > 120)
    alertas.push(`Oversizing DC/AC: ${oversizing.toFixed(0)}% (acima de 120% — aceitável em regiões de alta irradiância).`)
  else if (oversizing < 80)
    alertas.push(`Undersizing DC/AC: ${oversizing.toFixed(0)}% (< 80% — inversor superdimensionado para a potência FV).`)

  return {
    strings:          stringsArr,
    valido:           erros.length === 0,
    paineisPorString,
    totalStrings,
    totalModulos,
    distribuicaoMPPT,
    vocFrio:          +vocString.toFixed(1),
    vmpString:        +vmpString.toFixed(1),
    iString:          +iString.toFixed(2),
    oversizing:       +oversizing.toFixed(1),
    potenciaRealKwp:  +(potDC / 1000).toFixed(2),
    alertas,
    erros,
  }
}

// ── validarSistema ────────────────────────────────────────────────────────────

/**
 * validarSistema(strings, modulo, inversor, temperatura)
 * Valida uma configuração de strings já definida.
 * Aceita: { strings:[{mppt,modulos}], modulo, inversor, temperatura:{min,max,nominal} }
 * Retorna: { valido, alertas, erros, detalhes }
 */
function _validarSistema(strings, modulo, inversor, temperatura = {}) {
  const tempMin = Number(temperatura.min ?? -2)
  const alertas = []
  const erros   = []

  if (!strings?.length) {
    return { valido: false, alertas: [], erros: ['Array "strings" vazio ou não fornecido.'], detalhes: {} }
  }

  // Agrupa strings por MPPT
  const porMPPT = {}
  for (const s of strings) {
    const m = s.mppt ?? 1
    porMPPT[m] = (porMPPT[m] ?? 0) + 1
  }

  const modulosPorString = strings[0]?.modulos ?? 0
  const vocFrioUnit  = vocPorTemperatura(modulo, tempMin)
  const vocString    = vocFrioUnit * modulosPorString
  const vmpString    = modulo.vmpp * modulosPorString
  const potenciaRealKwp = (strings.length * modulosPorString * modulo.pmpp) / 1000
  const oversizing   = (potenciaRealKwp * 1000) / (inversor.potenciaKW * 1000) * 100

  // Voc < Voc_max (NBR 16690 / IEC 60364-7-712)
  if (vocString > inversor.vocMax) {
    erros.push(
      `Voc corrigido pela temperatura: ${vocString.toFixed(1)} V > Voc_max do inversor ${inversor.vocMax} V. ` +
      `(Temperatura mínima: ${tempMin}°C, coef. Voc: ${modulo.tempCoefVoc}%/°C)`
    )
  }

  // Vmpp dentro da faixa MPPT
  if (vmpString < inversor.mpptMin)
    erros.push(`Vmpp da string (${vmpString.toFixed(0)} V) fora da faixa MPPT inferior (${inversor.mpptMin} V).`)
  if (vmpString > inversor.mpptMax)
    erros.push(`Vmpp da string (${vmpString.toFixed(0)} V) acima da faixa MPPT superior (${inversor.mpptMax} V).`)

  // Corrente por MPPT
  for (const [mppt, nStrings] of Object.entries(porMPPT)) {
    const iMPPT = modulo.isc * nStrings
    if (iMPPT > inversor.imaxMppt) {
      erros.push(
        `MPPT ${mppt}: corrente total ${iMPPT.toFixed(1)} A (${nStrings} strings × ${modulo.isc} A) ` +
        `> Imax_MPPT ${inversor.imaxMppt} A.`
      )
    }
    if (nStrings > Math.floor(inversor.nStringsTotal / inversor.nMppts)) {
      alertas.push(`MPPT ${mppt}: ${nStrings} strings excedem a capacidade de entradas deste MPPT.`)
    }
  }

  // Oversizing DC/AC (NBR 16690 — recomenda ≤ 130%)
  if (oversizing > 135)
    alertas.push(`Oversizing DC/AC: ${oversizing.toFixed(0)}% — pode causar clipping. Aceitável em regiões com baixa irradiância de pico.`)
  else if (oversizing > 120)
    alertas.push(`Oversizing DC/AC: ${oversizing.toFixed(0)}% — dentro do aceitável para clima brasileiro.`)
  if (oversizing < 70)
    alertas.push(`Undersizing DC/AC: ${oversizing.toFixed(0)}% — inversor superdimensionado.`)

  // Temperatura nominal de operação (NOCT)
  if (modulo.tempCoefPmpp) {
    const noct = 45  // °C padrão
    const tOper = (temperatura.nominal ?? noct)
    const perda_temp = Math.abs(modulo.tempCoefPmpp) * (tOper - 25)
    if (perda_temp > 8) {
      alertas.push(
        `Perda por temperatura de operação estimada: ${perda_temp.toFixed(1)}% ` +
        `(${tOper}°C de operação, αPmpp ${modulo.tempCoefPmpp}%/°C).`
      )
    }
  }

  return {
    valido: erros.length === 0,
    alertas,
    erros,
    detalhes: {
      vocFrio:         +vocString.toFixed(1),
      vmpString:       +vmpString.toFixed(1),
      oversizing:      +oversizing.toFixed(1),
      potenciaRealKwp: +potenciaRealKwp.toFixed(2),
      tempMin,
    },
  }
}

// ── cálculo de sombreamento ───────────────────────────────────────────────────

/**
 * Calcula perda percentual por sombreamento entre fileiras.
 * Entrada: { altura, distancia, latitude?, inclinacao? }
 * Saída:   { perda_percentual, distanciaMinima, ... }
 */
function _calcularSombreamento({ altura, distancia, latitude = -15, inclinacao = 20 }) {
  const h   = Number(altura)
  const d   = Number(distancia)
  const lat = Math.abs(Number(latitude) || 15)
  const inc = Number(inclinacao) || 20

  if (h <= 0 || d <= 0) throw new Error('Altura e distância devem ser maiores que zero.')

  // Declinação solar no solstício de inverno (hemisfério sul = junho 21)
  const declinacao = 23.45           // graus
  const elevNoonDeg = 90 - lat - declinacao
  const elevNoonRad = Math.max(0.01, elevNoonDeg) * Math.PI / 180

  // Ângulo de sombra crítico: atan(h/d)
  const anguloSombraDeg = Math.atan2(h, d) * 180 / Math.PI

  // Distância mínima para evitar sombra ao meio-dia solar no pior dia
  const distanciaMinima = h / Math.tan(elevNoonRad)

  // Nenhuma sombra ao meio-dia
  if (d >= distanciaMinima) {
    // Pequena perda por sombra nas horas extremas do dia
    const fator = Math.max(0, anguloSombraDeg / (elevNoonDeg || 1))
    const perdaResidual = Math.min(2.5, fator * 3)
    return {
      perda_percentual:       +perdaResidual.toFixed(1),
      distanciaMinima:        +distanciaMinima.toFixed(2),
      distanciaAtual:         +d.toFixed(2),
      anguloSombra:           +anguloSombraDeg.toFixed(1),
      elevacaoMinimaSimulada: +elevNoonDeg.toFixed(1),
      sem_sombra_ao_meio_dia: true,
      classificacao:          'adequada',
      descricao:              `Distância entre fileiras adequada. Sem sombreamento ao meio-dia solar no solstício de inverno (latitude ${lat}°).`,
      recomendacao:           null,
    }
  }

  // Sombra ocorre ao meio-dia
  const deficite = distanciaMinima - d
  const fracao   = deficite / distanciaMinima

  // Modelo de perda anual — sombreamento parcial / efeito de bypass
  // Baseado em: Dunn et al. (IEA PVPS) e experiência empírica BR
  const perdaBase = fracao * 18        // até 18% por deficite proporcional
  const fatorString = 1.25             // strings sombreadas perdem mais do que a sombra física (bypass diode effect)
  const perda = Math.min(32, perdaBase * fatorString)

  let classificacao, descricao
  if (fracao < 0.2) {
    classificacao = 'atencao'
    descricao     = `Sombreamento leve próximo ao meio-dia no inverno. Perda anual estimada: ${perda.toFixed(1)}%.`
  } else if (fracao < 0.5) {
    classificacao = 'problema'
    descricao     = `Sombreamento significativo ao meio-dia no inverno. Perda estimada: ${perda.toFixed(1)}%. Use diodos de bypass ou microinversores.`
  } else {
    classificacao = 'critico'
    descricao     = `Sombreamento crítico — distância muito reduzida. Perda estimada: ${perda.toFixed(1)}%. Necessário reposicionamento das fileiras.`
  }

  return {
    perda_percentual:       +perda.toFixed(1),
    distanciaMinima:        +distanciaMinima.toFixed(2),
    distanciaAtual:         +d.toFixed(2),
    anguloSombra:           +anguloSombraDeg.toFixed(1),
    elevacaoMinimaSimulada: +elevNoonDeg.toFixed(1),
    fracaoDeficite:         +fracao.toFixed(2),
    sem_sombra_ao_meio_dia: false,
    classificacao,
    descricao,
    recomendacao: `Aumentar distância para pelo menos ${Math.ceil(distanciaMinima * 10) / 10} m para eliminar o sombreamento ao meio-dia.`,
  }
}

// ── handlers HTTP ─────────────────────────────────────────────────────────────

export function gerarStrings(req, res) {
  try {
    const { modulo, inversor, modulos, tempMin } = normalizarEntrada(req.body)

    if (!modulo)   return res.status(400).json({ erro: 'Especificações do módulo não fornecidas. Use "modulo" (objeto) ou "painelId".' })
    if (!inversor) return res.status(400).json({ erro: 'Especificações do inversor não fornecidas. Use "inversor" (objeto) ou "inversorId".' })
    if (!modulos || modulos <= 0) return res.status(400).json({ erro: 'Campo "modulos" (número de módulos) é obrigatório e deve ser > 0.' })

    const resultado = _gerarStrings(modulos, modulo, inversor, tempMin)
    res.json({ modulo, inversor, tempMin, ...resultado })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}

export function validarSistema(req, res) {
  try {
    // Aceita formato novo: { strings, modulo, inversor, temperatura }
    // e formato legado:    { painelId/painel, inversorId/inversor, paineisPorString, stringsParalelas, tempMin }
    let strings, modulo, inversor, temperatura

    if (req.body.strings?.length) {
      // Formato novo
      strings     = req.body.strings
      modulo      = req.body.modulo ?? req.body.painel ?? getPainelById(req.body.painelId)
      inversor    = req.body.inversor ?? getInversorById(req.body.inversorId)
      temperatura = req.body.temperatura ?? { min: req.body.tempMin ?? -2 }
    } else {
      // Formato legado → converte para o novo
      modulo      = req.body.painel ?? getPainelById(req.body.painelId)
      inversor    = req.body.inversor ?? getInversorById(req.body.inversorId)
      temperatura = { min: Number(req.body.tempMin ?? -2) }
      const pps   = Number(req.body.paineisPorString ?? 0)
      const sp    = Number(req.body.stringsParalelas ?? 1)
      strings     = Array.from({ length: sp }, (_, i) => ({ mppt: Math.floor(i / 2) + 1, modulos: pps }))
    }

    if (!modulo)   return res.status(400).json({ erro: 'Módulo não encontrado.' })
    if (!inversor) return res.status(400).json({ erro: 'Inversor não encontrado.' })

    const resultado = _validarSistema(strings, modulo, inversor, temperatura)
    res.json(resultado)
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}

export function calcularSombreamento(req, res) {
  try {
    const { altura, distancia, latitude, inclinacao } = req.body
    if (!altura || !distancia) return res.status(400).json({ erro: 'Campos "altura" e "distancia" são obrigatórios.' })
    const resultado = _calcularSombreamento({ altura, distancia, latitude, inclinacao })
    res.json(resultado)
  } catch (e) {
    res.status(422).json({ erro: e.message })
  }
}

export function recomendarSistema(req, res) {
  try {
    const { potenciaKwp, tempMin = -2, tipoSistema = 'string' } = req.body
    if (!potenciaKwp) return res.status(400).json({ erro: 'potenciaKwp é obrigatório.' })

    const potW      = Number(potenciaKwp) * 1000
    const recos     = []
    const paineis   = PAINEIS.filter(p => tipoSistema === 'micro' ? true : p.pmpp >= 400)
    const inversores = INVERSORES.filter(i =>
      tipoSistema === 'micro' ? i.tipoInversor === 'micro' : i.tipoInversor === 'string'
    )

    for (const modulo of paineis.slice(0, 5)) {
      const numModulos = Math.ceil(potW / modulo.pmpp)
      for (const inv of inversores) {
        const potInv = inv.potenciaKW * 1000
        if (potInv < potW * 0.6 || potInv > potW * 1.3) continue

        const cfg = _gerarStrings(numModulos, modulo, inv, Number(tempMin))
        if (!cfg.valido) continue

        let numInv = 1
        if (tipoSistema === 'micro') {
          numInv = numModulos
        } else {
          const maxPotenciaComOversizing = inv.potenciaKW * 1.3 * 1000
          numInv = Math.ceil(cfg.potenciaRealKwp * 1000 / maxPotenciaComOversizing)
        }

        const custo   = cfg.totalModulos * modulo.precoUnitario + numInv * inv.precoUnitario
        const score   = _pontuar(modulo, inv, cfg, custo, potW, numInv)

        recos.push({
          modulo:   { id: modulo.id, marca: modulo.marca, modelo: modulo.modelo, pmpp: modulo.pmpp },
          inversor: { id: inv.id,    marca: inv.marca,    modelo: inv.modelo,    potenciaKW: inv.potenciaKW },
          config: {
            numModulos:       cfg.totalModulos,
            potenciaRealKwp:  cfg.potenciaRealKwp,
            modulosPorString: cfg.paineisPorString,
            totalStrings:     cfg.totalStrings,
            numInversores:    numInv,
            oversizing:       cfg.oversizing,
          },
          custo, score,
          alertas:       cfg.alertas,
          justificativa: _justificar(modulo, inv, cfg, numInv),
        })
      }
    }

    const top = recos.sort((a, b) => b.score - a.score).slice(0, 3)
    if (!top.length) return res.status(422).json({ erro: 'Nenhuma combinação válida encontrada. Tente ajustar os parâmetros.' })
    res.json({ recomendacoes: top, potenciaAlvo: potenciaKwp })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}

export function listarCatalogo(req, res) {
  const { tipo } = req.query
  if (tipo === 'paineis')    return res.json(PAINEIS)
  if (tipo === 'inversores') return res.json(INVERSORES)
  res.json({ paineis: PAINEIS, inversores: INVERSORES })
}

// ── auxiliares pontuação/justificativa ────────────────────────────────────────

function _pontuar(modulo, inv, cfg, custo, potW, numInv = 1) {
  let score = 100
  const over = cfg.oversizing
  if (over >= 100 && over <= 120) score += 12
  else if (over > 130)             score -= 15
  else if (over < 80)              score -= 10
  const sobra = cfg.totalModulos - Math.ceil(potW / modulo.pmpp)
  score -= sobra * 2
  const custoPorKwp = custo / (cfg.potenciaRealKwp || 1)
  if (custoPorKwp < 3000)       score += 15
  else if (custoPorKwp > 5000)  score -= 10
  if (modulo.garantiaProduto >= 15) score += 5
  if (inv.garantia >= 10)           score += 5
  if (numInv === 1) score += 8
  else if (numInv === 2) score -= 3
  else score -= 10
  score -= cfg.alertas.length * 8
  return score
}

function _justificar(modulo, inv, cfg, numInv) {
  const pts = []
  pts.push(`${cfg.totalModulos} módulos de ${modulo.pmpp} W em ${cfg.totalStrings} string(s) de ${cfg.paineisPorString} módulos.`)
  pts.push(`Oversizing DC/AC: ${cfg.oversizing}% — ${cfg.oversizing <= 120 ? 'ótimo para o clima brasileiro' : 'acima do ideal, monitorar temperatura'}.`)
  if (modulo.garantiaProduto >= 15) pts.push(`Garantia do módulo: ${modulo.garantiaProduto} anos.`)
  if (inv.garantia >= 10)           pts.push(`Inversor ${inv.marca} com ${inv.garantia} anos de garantia.`)
  if (cfg.alertas.length)           pts.push(`Atenção: ${cfg.alertas[0]}`)
  return pts.join(' ')
}
