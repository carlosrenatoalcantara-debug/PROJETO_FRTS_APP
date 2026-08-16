/**
 * fluxoCaixa.js — motor de fluxo de caixa do backend — FV-DOM-009.
 *
 * ── Origem ───────────────────────────────────────────────────────────────────
 * Extraído VERBATIM de `backend/src/controllers/engenhariaController.js`
 * (`calcularTIR` e `calcularFluxoCaixa`). Nenhuma fórmula, constante, default,
 * arredondamento ou nome de campo foi alterado — a equivalência é verificada em
 * `financeiroConsolidacao.check.js` contra o `git HEAD`.
 *
 * ── Por que fica separado do `financeiroEngine` ──────────────────────────────
 * Os dois calculam retorno, e DISCORDAM: payback inteiro aqui, fracionário lá;
 * VPL e payback descontado só aqui; taxa de desconto só aqui. A FV-DOM-008A
 * mediu a divergência e registrou como decisões D1 e D2 — **de negócio**.
 *
 * Unificá-los agora mudaria números apresentados a clientes. Esta sprint é de
 * ARQUITETURA: elimina cópias vivas e devolve nome ao que era anônimo dentro de
 * um controller, preservando o comportamento intacto até D1–D5 serem decididas.
 *
 * ── Quem usa ─────────────────────────────────────────────────────────────────
 *   `calcularTIR`        → engenhariaController E projetoController
 *                          (este último tinha uma CÓPIA LITERAL chamada
 *                          `calcularTIRLocal`; verificada idêntica e eliminada)
 *   `calcularFluxoCaixa` → engenhariaController
 *
 * `projetoController.simularFinanceiroLocal` NÃO foi absorvido: apesar de
 * parecido, ele não aplica degradação e usa taxa de desconto de 10 % — é outro
 * cálculo, não outra cópia.
 *
 * Puro: sem I/O, sem Express, sem Mongoose.
 */

/**
 * TIR (IRR) por bisseção.
 *
 * fluxos[0] = investimento negativo, fluxos[1..n] = entradas.
 * Retorna a taxa em FRAÇÃO (0,29 = 29 % a.a.) — quem exibe multiplica por 100.
 *
 * Tolerância |NPV| < 0,5 é ABSOLUTA em reais e o intervalo é [−0,99 ; 10]:
 * preservados como estão. A FV-DOM-008A registrou os dois como observação (R2),
 * e mudá-los alteraria resultados.
 */
export function calcularTIRDetalhado(fluxos) {
  const lo = -0.99, hi = 10.0
  const intervalo_busca = [lo, hi]
  let low = lo, high = hi
  for (let i = 0; i < 300; i++) {
    const mid = (low + high) / 2
    let npv = 0
    for (let t = 0; t < fluxos.length; t++) {
      npv += fluxos[t] / Math.pow(1 + mid, t)
    }
    if (Math.abs(npv) < 0.5) {
      return { valor: mid, convergiu: true, motivo: 'ok', intervalo_busca }
    }
    npv > 0 ? (low = mid) : (high = mid)
  }
  // Esgotadas as 300 iterações, a bisseção converge para uma das pontas quando a
  // raiz está FORA do intervalo — é o caso em que este motor devolvia 10.0 (=
  // 1000 %) como se fosse resultado. O valor segue o mesmo; o estado agora diz
  // que ele é o teto da busca, não a TIR.
  const valor = (low + high) / 2
  const saturou = Math.abs(valor - hi) < 1e-6 || Math.abs(valor - lo) < 1e-6
  return {
    valor,
    convergiu: false,
    motivo: saturou ? 'fora_do_intervalo' : 'iteracoes_esgotadas',
    intervalo_busca,
  }
}

/**
 * Superfície preservada: mesma implementação, sem o estado. Os consumidores
 * atuais (`engenhariaController`, `projetoController`) recebem exatamente o
 * mesmo número de antes.
 */
export function calcularTIR(fluxos) {
  return calcularTIRDetalhado(fluxos).valor
}

/**
 * Fluxo de caixa de 25 anos com VPL, payback simples e descontado.
 *
 * Defaults preservados como estavam (inflação 8 %, desconto 6 %, degradação
 * 0,5 %, 25 anos). São exatamente os "defaults ocultos" que o contrato v1
 * pretende tornar explícitos — mas tornar explícito é FV-DOM-010, não aqui.
 */
export function calcularFluxoCaixa({
  custoTotal, economiaAnualBase, inflacaoEnergia = 0.08,
  taxaDesconto = 0.06, degradacaoAnual = 0.005, anos = 25,
}) {
  const fluxos          = [-custoTotal]
  const fluxoAnual      = []
  let saldoAcum         = -custoTotal
  let saldoDescontado   = -custoTotal
  let paybackSimples    = null
  let paybackDescontado = null

  for (let ano = 1; ano <= anos; ano++) {
    const fatorInflacao   = Math.pow(1 + inflacaoEnergia, ano - 1)
    const fatorDegradacao = Math.pow(1 - degradacaoAnual, ano - 1)
    const economia        = economiaAnualBase * fatorInflacao * fatorDegradacao

    saldoAcum += economia
    if (saldoAcum >= 0 && !paybackSimples) paybackSimples = ano

    const vp = economia / Math.pow(1 + taxaDesconto, ano)
    saldoDescontado += vp
    if (saldoDescontado >= 0 && !paybackDescontado) paybackDescontado = ano

    fluxos.push(economia)
    fluxoAnual.push({
      ano,
      economia:          +economia.toFixed(2),
      saldoAcumulado:    +saldoAcum.toFixed(2),
      valorPresente:     +vp.toFixed(2),
      saldoDescontado:   +saldoDescontado.toFixed(2),
    })
  }

  const tir  = calcularTIR(fluxos)
  const vpl  = saldoDescontado
  const roi25= ((fluxos.slice(1).reduce((a, b) => a + b, 0) - custoTotal) / custoTotal) * 100

  return {
    fluxoAnual,
    tir:              +(tir * 100).toFixed(2),
    vpl:              +vpl.toFixed(2),
    paybackSimples:   paybackSimples ?? `> ${anos}`,
    paybackDescontado:paybackDescontado ?? `> ${anos}`,
    roi25Anos:        +roi25.toFixed(1),
    economiaTotal25:  +fluxos.slice(1).reduce((a, b) => a + b, 0).toFixed(2),
  }
}
