/**
 * microinversores.js — motor canônico de MICROINVERSORES — FV-DOM-031.
 *
 * ── Por que este arquivo existe ──────────────────────────────────────────────
 * Havia DOIS motores de micro, e a auditoria da FV-DOM-031 mediu veredito
 * OPOSTO em 4 dos 13 micros do catálogo sobre a mesma configuração:
 *
 *   dimensionarMicroinversor (só no frontend)  micro mais carregado × `?? 1.25`
 *   validarMicroinversores   (fv-shared)       média nMod/nMicro   × `?? 1.5`
 *
 * Duas fórmulas e dois limites, ambos com default fabricado. As decisões da
 * sprint fecharam a questão:
 *
 *   • decisão 3 — o limite é o DECLARADO PELO CATÁLOGO (`oversizing_max`), e a
 *     verificação usa o MICRO MAIS CARREGADO, não a média. Sem default: sem
 *     limite declarado, não há veredito de oversizing — há lacuna.
 *   • decisão 5 — a topologia é `microinversor → entradas → módulos`. Não há
 *     MPPT, não há string, não há módulos em série.
 *   • decisão 6 — configuração acima do limite REPROVA e explica. Não se força.
 *   • decisão 7 — a quantidade de micros e de módulos é do projetista; o motor
 *     avalia o que foi pedido e, quando reprova, informa o que caberia.
 *
 * ── O que este motor NÃO faz ─────────────────────────────────────────────────
 * Não escolhe micro, não escolhe quantidade, não distribui sozinho o que o
 * projetista autorou (Modelo A, FV-DOM-023/024), não precifica.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */
import {
  calcularTemperaturas, calcularVocMaxString, calcularVmppMinString,
  calcularIscMax, calcularCorrenteAC, selecionarCabo, selecionarDPS, coefParaFracao,
} from './engenhariaNormativa.js'

/** Inteiro ≥ 0 ou `null`. Vazio, texto e negativo são ausência — nunca zero. */
function _int(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
}

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Capacidade física de UM microinversor, em módulos.
 * `entradas × modulos_por_entrada`. Qualquer um ausente ⇒ `null` (não 1).
 */
export function capacidadeDoMicro(micro) {
  const entradas = _int(micro?.entradas)
  const porEntrada = _int(micro?.modulos_por_entrada)
  if (entradas === null || porEntrada === null || entradas < 1 || porEntrada < 1) return null
  return entradas * porEntrada
}

/**
 * Distribuição EQUILIBRADA dos módulos entre unidades de mesma capacidade.
 *
 * FV-DOM-031B: substituiu o "encher e sobrar" herdado do motor do frontend.
 * Aquele produzia `[4,2]` para 6 módulos em 2 micros de 4 entradas; como o
 * veredito de oversizing olha o MAIS CARREGADO (decisão 3 da FV-DOM-031), a
 * distribuição desnecessariamente desigual reprovava arranjos perfeitamente
 * viáveis — e, pior, acrescentar micros não mudava o veredito, porque o
 * primeiro continuava cheio.
 *
 * Agora: `base = ⌊total/n⌋` em todas, e os `total mod n` primeiros levam um a
 * mais. A sobra inevitável fica com a menor diferença possível (7 em 2 → 4+3).
 * Nenhuma unidade passa da capacidade: o excedente é RECUSADO, não empilhado —
 * quem bloqueia por capacidade é `avaliarModeloMicro`.
 *
 * @returns {number[]|null} módulos em cada unidade, na ordem. `null` sem dados.
 */
function _equilibrar(total, unidades, capacidade) {
  const base = Math.floor(total / unidades)
  const resto = total % unidades
  return Array.from({ length: unidades },
    (_, i) => Math.min(capacidade, base + (i < resto ? 1 : 0)))
}

/** Distribuição dos módulos entre os micros de UM modelo. */
export function distribuirEntreMicros(totalModulos, quantidadeMicros, capacidadePorMicro) {
  const total = _int(totalModulos)
  const qtd = _int(quantidadeMicros)
  const cap = _int(capacidadePorMicro)
  if (total === null || qtd === null || cap === null || qtd < 1 || cap < 1) return null
  return _equilibrar(total, qtd, cap)
}

/**
 * Distribuição dos módulos de UM micro entre as suas entradas CC.
 * Mesma regra, um nível abaixo — é o que a decisão 5 chama de
 * `microinversor → entradas → módulos`.
 */
export function distribuirEntreEntradas(modulosNoMicro, entradas, modulosPorEntrada) {
  const total = _int(modulosNoMicro)
  const n = _int(entradas)
  const cap = _int(modulosPorEntrada)
  if (total === null || n === null || cap === null || n < 1 || cap < 1) return null
  return _equilibrar(total, n, cap)
}

/**
 * Micros necessários para que o mais carregado fique DENTRO do limite CC/CA.
 * Informativo (decisão 7): é o número que destrava a configuração sem mexer no
 * equipamento. `null` quando o catálogo não declara o limite.
 */
export function microsParaLimite(totalModulos, potenciaCaKw, oversizingMax, potenciaModuloW, capacidadePorMicro) {
  const total = _int(totalModulos)
  const cabem = modulosQueCabem(potenciaCaKw, oversizingMax, potenciaModuloW)
  const cap = _int(capacidadePorMicro)
  if (total === null || cabem === null || cabem < 1 || cap === null) return null
  // Não adianta pedir mais do que a capacidade física permite por micro.
  return Math.ceil(total / Math.min(cabem, cap))
}

/**
 * Micros necessários para acomodar `totalModulos` — informativo (decisão 7).
 * Não altera nada: serve para a mensagem "cabem N micros".
 */
export function microsNecessarios(totalModulos, capacidadePorMicro) {
  const total = _int(totalModulos)
  const cap = _int(capacidadePorMicro)
  if (total === null || cap === null || cap < 1) return null
  return Math.ceil(total / cap)
}

/**
 * Avalia UM modelo de microinversor com a quantidade e os módulos que lhe foram
 * atribuídos. É a unidade: uma composição com dois modelos chama duas vezes.
 *
 * @param {Object} p
 * @param {number} p.modulos            módulos atribuídos a ESTE modelo
 * @param {number} p.quantidade         quantos micros deste modelo
 * @param {Object} p.micro              { entradas, modulos_por_entrada, potencia_kw, oversizing_max }
 * @param {number} [p.potenciaModuloW]  potência do módulo (Wp)
 * @returns {{valido, bloqueios[], avisos[], lacunas[], resumo}}
 */
export function avaliarModeloMicro({ modulos, quantidade, micro = {}, potenciaModuloW = null } = {}) {
  const bloqueios = []
  const avisos = []
  const lacunas = []

  const nMod = _int(modulos)
  const nMicro = _int(quantidade)
  const entradas = _int(micro.entradas)
  const porEntrada = _int(micro.modulos_por_entrada)
  const potCaKw = _num(micro.potencia_kw)
  const limite = _num(micro.oversizing_max)
  const potModW = _num(potenciaModuloW)

  // ── Lacunas: o que o catálogo não declarou (FV-DOM-029, mesma disciplina) ──
  if (entradas === null) lacunas.push('entradas')
  if (porEntrada === null) lacunas.push('modulos_por_entrada')
  if (potCaKw === null) lacunas.push('potencia_kw')
  if (limite === null) lacunas.push('oversizing_max')

  // ── Sanidade do que o projetista pediu ────────────────────────────────────
  if (nMod === null || nMod < 1) bloqueios.push('Quantidade de módulos inválida (deve ser inteiro ≥ 1).')
  if (nMicro === null || nMicro < 1) bloqueios.push('Quantidade de microinversores inválida (deve ser inteiro ≥ 1).')

  const capacidade = capacidadeDoMicro(micro)
  if (capacidade === null) {
    bloqueios.push(
      'Microinversor sem `entradas` ou `modulos_por_entrada` no catálogo. ' +
      'Nenhuma capacidade é assumida — preencher antes de validar.',
    )
  }

  if (bloqueios.length > 0) {
    return { valido: false, bloqueios, avisos, lacunas, resumo: null }
  }

  const capacidadeTotal = nMicro * capacidade
  const distribuicao = distribuirEntreMicros(nMod, nMicro, capacidade)
  const maisCarregado = Math.max(...distribuicao)
  const ociosos = distribuicao.filter((m) => m === 0).length

  // ── Capacidade física: não há onde plugar o que sobra ─────────────────────
  if (nMod > capacidadeTotal) {
    const faltam = microsNecessarios(nMod, capacidade) - nMicro
    bloqueios.push(
      `${nMod} módulos excedem a capacidade de ${capacidadeTotal} ` +
      `(${nMicro} micro(s) × ${entradas} entrada(s) × ${porEntrada} módulo(s)/entrada). ` +
      `Faltam ${faltam} microinversor(es), ou reduza para ${capacidadeTotal} módulos.`,
    )
  }

  // ── Micro sem nenhum módulo ───────────────────────────────────────────────
  if (ociosos > 0) {
    bloqueios.push(
      `${ociosos} microinversor(es) ficariam sem nenhum módulo conectado. ` +
      `${nMod} módulos ocupam ${microsNecessarios(nMod, capacidade)} micro(s).`,
    )
  }

  // ── Oversizing pelo micro MAIS CARREGADO, contra o limite do catálogo ─────
  let oversizing = null
  if (potModW !== null && potCaKw !== null && potCaKw > 0) {
    oversizing = +((maisCarregado * potModW) / 1000 / potCaKw).toFixed(3)
    if (limite === null) {
      avisos.push(
        `Relação CC/CA do micro mais carregado: ${oversizing.toFixed(2)}×. ` +
        'O catálogo não declara `oversizing_max` para este modelo — sem limite, não há veredito.',
      )
    } else if (oversizing > limite) {
      // Decisão 7: reprovar dizendo o que destrava — quantos módulos cabem por
      // micro e quantos micros bastariam para o total pedido.
      const cabem = modulosQueCabem(potCaKw, limite, potModW)
      const bastam = microsParaLimite(nMod, potCaKw, limite, potModW, capacidade)
      bloqueios.push(
        `Relação CC/CA de ${oversizing.toFixed(2)}× no microinversor mais carregado ` +
        `(${maisCarregado} módulo(s) × ${potModW} W sobre ${potCaKw} kW) excede o limite de ` +
        `${limite.toFixed(2)}× declarado pelo fabricante. ` +
        `Cabem ${cabem} módulo(s) por micro neste limite` +
        (bastam !== null && bastam !== nMicro
          ? `, e ${bastam} microinversor(es) acomodariam os ${nMod} módulos.`
          : '.'),
      )
    }
  }

  // ── Distribuição desigual: informação, não erro ───────────────────────────
  if (new Set(distribuicao).size > 1) {
    avisos.push(
      `Distribuição desigual: ${distribuicao.join(' / ')} módulos por microinversor.`,
    )
  }

  return {
    valido: bloqueios.length === 0,
    bloqueios,
    avisos,
    lacunas,
    resumo: {
      modulos: nMod,
      quantidade: nMicro,
      entradas,
      modulos_por_entrada: porEntrada,
      capacidade_por_micro: capacidade,
      capacidade_total: capacidadeTotal,
      distribuicao,
      // A distribuição EFETIVAMENTE usada, um nível abaixo: módulos por entrada
      // de cada micro. É o que o unifilar e o memorial precisam desenhar.
      entradas_por_micro_usadas: distribuicao.map(
        (m) => distribuirEntreEntradas(m, entradas, porEntrada)),
      modulos_no_mais_carregado: maisCarregado,
      potencia_cc_kwp: potModW === null ? null : +((nMod * potModW) / 1000).toFixed(3),
      potencia_ca_kw: potCaKw === null ? null : +(nMicro * potCaKw).toFixed(3),
      oversizing_mais_carregado: oversizing,
      oversizing_max: limite,
      micros_necessarios: microsNecessarios(nMod, capacidade),
    },
  }
}

/** Quantos módulos cabem em um micro dentro do limite declarado (decisão 7). */
export function modulosQueCabem(potenciaCaKw, oversizingMax, potenciaModuloW) {
  const pca = _num(potenciaCaKw)
  const lim = _num(oversizingMax)
  const pmod = _num(potenciaModuloW)
  if (pca === null || lim === null || pmod === null || pmod <= 0) return null
  return Math.floor((pca * 1000 * lim) / pmod)
}

/**
 * Avalia a composição INTEIRA — vários modelos de micro no mesmo arranjo.
 * Cada modelo é avaliado com os módulos que lhe foram atribuídos.
 *
 * @param {Object} p
 * @param {Array}  p.modelos  [{ modulos, quantidade, micro, rotulo }]
 * @param {number} p.totalModulos      total de módulos da composição
 * @param {number} [p.potenciaModuloW]
 */
export function avaliarComposicaoMicro({ modelos = [], totalModulos = null, potenciaModuloW = null } = {}) {
  const porModelo = modelos.map((m) => ({
    rotulo: m.rotulo ?? m.micro?.modelo ?? '—',
    ...avaliarModeloMicro({
      modulos: m.modulos, quantidade: m.quantidade,
      micro: m.micro, potenciaModuloW,
    }),
  }))

  const bloqueios = []
  const avisos = []
  // Os módulos atribuídos aos modelos têm de fechar com o total da composição.
  const atribuidos = modelos
    .map((m) => _int(m.modulos))
    .filter((n) => n !== null)
    .reduce((s, n) => s + n, 0)
  const total = _int(totalModulos)
  if (total !== null && atribuidos !== total) {
    const d = atribuidos - total
    bloqueios.push(
      `${atribuidos} módulo(s) distribuído(s) entre os microinversores, ` +
      `mas a composição tem ${total}. ${d > 0 ? `Sobram ${d}` : `Faltam ${-d}`}.`,
    )
  }

  return {
    valido: bloqueios.length === 0 && porModelo.every((r) => r.valido),
    bloqueios,
    avisos,
    por_modelo: porModelo,
    lacunas: [...new Set(porModelo.flatMap((r) => r.lacunas))],
    resumo: {
      modulos_atribuidos: atribuidos,
      total_modulos: total,
      quantidade_micros: modelos
        .map((m) => _int(m.quantidade)).filter((n) => n !== null)
        .reduce((s, n) => s + n, 0),
      potencia_ca_kw: +porModelo
        .map((r) => r.resumo?.potencia_ca_kw ?? 0)
        .reduce((s, n) => s + n, 0).toFixed(3),
    },
  }
}

// ─── Modelo elétrico do sistema com microinversores — FV-DOM-031C ────────────

/**
 * Modelo elétrico de um sistema de MICROINVERSORES.
 *
 * Irmão de `montarModeloEletrico`, não uma variação dele. Aquele monta
 * `MPPT → strings → módulos` e, na ausência do arranjo, INVENTA um
 * (`numStrings ?? 1`, `numPaineis ?? 6`, `invNMPPT || 1`) — o que num projeto
 * micro produziria MPPTs e strings que não existem. Este monta o que a decisão
 * 5 da FV-DOM-031 definiu: `microinversor → entradas → módulos`.
 *
 * ── O que é REUSADO, não reescrito ───────────────────────────────────────────
 * Toda a física vem das primitivas canônicas da FV-DOM-025:
 * `calcularTemperaturas`, `calcularVocMaxString`, `calcularVmppMinString`,
 * `calcularIscMax`, `calcularCorrenteAC`, `selecionarCabo`, `selecionarDPS`.
 * A única diferença é o número de módulos em SÉRIE: numa string são vários; numa
 * entrada de micro são `modulos_por_entrada` — quase sempre 1.
 *
 * ── Sem defaults (decisão 3) ─────────────────────────────────────────────────
 * O que o catálogo não declarou vira LACUNA nomeada. Nada é assumido: sem Voc do
 * módulo não há tensão de projeto, e isso é dito.
 *
 * @param {Object} p
 * @param {Object} p.painel       { marca, modelo, potenciaW, voc, vmpp, isc, coef_temp_voc, temp_noct }
 * @param {Array}  p.micros       `configuracao_eletrica.micros[]`
 * @param {Object} [p.dadosConsumo] { tipoLigacao, tensao }
 * @param {string} [p.uf]
 */
export function montarModeloMicro({ painel = null, micros = [], dadosConsumo = {}, uf = null } = {}) {
  const lacunas = []
  const { tmin, tmax } = calcularTemperaturas(uf)

  // ── Módulo — sem default: ausência é lacuna ───────────────────────────────
  const voc = _num(painel?.voc)
  const vmpp = _num(painel?.vmpp)
  const isc = _num(painel?.isc)
  const pmpp = _num(painel?.potenciaW ?? painel?.pmpp)
  /**
   * Q4 (FV-DOM-024/025): o catálogo `Equipamento` guarda o coeficiente em
   * `%/°C`; as fórmulas normativas esperam FRAÇÃO por Kelvin. `coefParaFracao`
   * é o ÚNICO ponto de conversão do sistema, e é aqui que fica a fronteira
   * deste caminho. Sem ela o Voc de uma entrada com 1 módulo de 45,5 V saía
   * 170,6 V — a inflação de ~100× que a FV-DOM-023 já tinha medido no wizard.
   */
  const coefAbs = painel?.coef_temp_voc === null || painel?.coef_temp_voc === undefined
    ? null : coefParaFracao(painel.coef_temp_voc)
  const noct = _num(painel?.temp_noct)
  if (voc === null) lacunas.push('modulo.voc')
  if (vmpp === null) lacunas.push('modulo.vmpp')
  if (isc === null) lacunas.push('modulo.isc')
  if (pmpp === null) lacunas.push('modulo.potencia_w')
  if (coefAbs === null) lacunas.push('modulo.coef_temp_voc')

  // ── Fase e tensão CA — mesma leitura de `montarModeloEletrico` ────────────
  const tipoLig = String(dadosConsumo?.tipoLigacao ?? '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const fasesAC = tipoLig.includes('trifas') ? 3 : tipoLig.includes('bifas') ? 2 : 1
  const tensaoBase = parseInt(dadosConsumo?.tensao, 10)
  const tensaoAC = fasesAC === 3 ? 380 : (Number.isFinite(tensaoBase) ? tensaoBase : null)
  if (tensaoAC === null) lacunas.push('tensao_ac')

  // ── Um bloco por MODELO de micro (decisão 1) ─────────────────────────────
  const modelos = (micros ?? []).map((m) => {
    const quantidade = _int(m?.quantidade)
    const entradas = _int(m?.entradas_por_micro)
    const porEntrada = _int(m?.modulos_por_entrada)
    const distribuicao = Array.isArray(m?.distribuicao)
      ? m.distribuicao.map((n) => _int(n)).filter((n) => n !== null)
      : []
    const modulos = distribuicao.reduce((s, n) => s + n, 0)

    const faltando = []
    if (quantidade === null) faltando.push('quantidade')
    if (entradas === null) faltando.push('entradas_por_micro')
    if (porEntrada === null) faltando.push('modulos_por_entrada')
    if (distribuicao.length === 0) faltando.push('distribuicao')

    // Tensão de uma ENTRADA: `modulos_por_entrada` módulos em série.
    const vocEntrada = voc !== null && coefAbs !== null && porEntrada !== null
      ? calcularVocMaxString(voc, porEntrada, coefAbs, tmin) : null
    const vmppEntrada = vmpp !== null && coefAbs !== null && porEntrada !== null && noct !== null
      ? calcularVmppMinString(vmpp, porEntrada, coefAbs, tmax, noct)
      : (vmpp !== null && coefAbs !== null && porEntrada !== null
          ? calcularVmppMinString(vmpp, porEntrada, coefAbs, tmax) : null)
    const iscEntrada = isc !== null ? calcularIscMax(isc) : null

    return {
      marca: m?.marca ?? null,
      modelo: m?.modelo ?? null,
      quantidade, entradas_por_micro: entradas, modulos_por_entrada: porEntrada,
      distribuicao,
      // Módulos por micro, e por ENTRADA de cada micro (decisão 5).
      entradas_usadas: distribuicao.map((n) => distribuirEntreEntradas(n, entradas, porEntrada)),
      modulos,
      potencia_cc_kwp: pmpp === null ? null : +((modulos * pmpp) / 1000).toFixed(3),
      // Tensão e corrente que CADA ENTRADA vê — é o envelope elétrico do micro.
      voc_entrada_frio: vocEntrada,
      vmpp_entrada_quente: vmppEntrada,
      isc_entrada: iscEntrada,
      lacunas: faltando,
    }
  })

  for (const m of modelos) {
    for (const f of m.lacunas) lacunas.push(`micro[${m.modelo ?? '—'}].${f}`)
  }
  if (modelos.length === 0) lacunas.push('configuracao_eletrica.micros')

  // ── Sistema ───────────────────────────────────────────────────────────────
  const numMicros = modelos.map((m) => m.quantidade ?? 0).reduce((a, b) => a + b, 0)
  const numModulos = modelos.map((m) => m.modulos).reduce((a, b) => a + b, 0)
  const potenciaCC = pmpp === null ? null : +((numModulos * pmpp) / 1000).toFixed(3)

  // Potência CA = Σ quantidade × potência do micro. `potencia_kw` de cada
  // modelo vem do CATÁLOGO e é resolvido por quem chama (o adapter). Se algum
  // modelo não a declarou, o total é `null` — somar com zero seria inventar.
  const potenciasCA = (micros ?? []).map((m, i) => {
    const p = _num(m?.potencia_kw)
    const q = modelos[i]?.quantidade
    return p === null || q === null ? null : +(p * q).toFixed(3)
  })
  const potenciaCA = potenciasCA.some((v) => v === null) || potenciasCA.length === 0
    ? null
    : +potenciasCA.reduce((a, b) => a + b, 0).toFixed(3)
  if (potenciaCA === null) lacunas.push('micro.potencia_kw')
  modelos.forEach((m, i) => { m.potencia_ca_kw = potenciasCA[i] })

  const iac = potenciaCA !== null && tensaoAC !== null
    ? calcularCorrenteAC(potenciaCA, fasesAC, tensaoAC) : null

  return {
    topologia: 'micro',
    temperatura: { tmin, tmax },
    modulo: { marca: painel?.marca ?? null, modelo: painel?.modelo ?? null, potenciaW: pmpp, voc, vmpp, isc },
    modelos,
    sistema: {
      numModulos, numMicros,
      potenciaCC, potenciaCA,
      fasesAC, tensaoAC,
      fasesLabel: fasesAC === 3 ? 'Trifásico' : fasesAC === 2 ? 'Bifásico' : 'Monofásico',
      iac,
    },
    // Proteção CA — as MESMAS funções canônicas que o caminho string usa.
    cabos: iac === null ? null : { ca: selecionarCabo(iac, { tipo: 'ca' }) },
    protecoes: modelos[0]?.voc_entrada_frio == null
      ? null : { dps_cc: selecionarDPS(modelos[0].voc_entrada_frio) },
    lacunas,
  }
}
