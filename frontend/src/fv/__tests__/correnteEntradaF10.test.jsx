/**
 * F10 — `corrente_max_entrada`: ligar o caminho sem inventar o dado.
 *
 * O motor já tinha o critério `CORRENTE_ENTRADA_TOTAL_EXCEDIDA`, mas a entrada
 * dele nunca chegava ao contrato: o extrator de datasheet GRAVA o campo
 * (`normalizarMulti`), o cadastro EXIBE (`Inversores.jsx`), e o dicionário
 * canônico não o conhecia — `lerInversor` devolvia `undefined`, o adapter não
 * passava nada, e a regra ficava morta por CONSTRUÇÃO, não por falta de dado.
 *
 * A F10 ligou dicionário → `lerInversor` → adapter → contrato. Não preencheu
 * nenhum equipamento: a cobertura no catálogo real é 0/52, e isso é lacuna de
 * CATÁLOGO, não de código. O critério segue `nao_avaliado` até que um datasheet
 * declare o valor — e aí ativa sozinho, sem novo código.
 *
 * Três grandezas DISTINTAS, que este arquivo existe para manter separadas:
 *
 *   corrente_max_por_mppt  limite de OPERAÇÃO, por MPPT
 *   corrente_isc_max       limite de CURTO-CIRCUITO, por MPPT
 *   corrente_max_entrada   limite TOTAL de entrada CC do equipamento
 */
import { describe, it, expect } from 'vitest'
import { lerInversor, paraDimensionamento } from '@fortesolar/fv-shared/inversores'
import { analisarCompatibilidade } from '../../../../backend/src/services/compatibilidadeEletricaService.js'

// Envelope completo, para que o único fator sob teste seja a corrente total.
const INVERSOR_BASE = {
  tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 850,
  corrente_max_mppt: 30, corrente_isc_max_mppt: 40, potencia_ca_kw: 15,
}
const MODULO = {
  potencia_w: 550, voc: 49.5, vmpp: 41.5, isc: 14, impp: 13.2,
  coef_temp_voc_pct_c: -0.25,
}
const arranjo = (modulosPorString, stringsParalelo) => ({
  quantidade_modulos_por_string: modulosPorString,
  quantidade_strings_paralelo: stringsParalelo,
  num_mppt_usados: 2,
})
// O critério sai junto de outros na mesma análise (oversizing, corrente por
// MPPT). Isolar POR CÓDIGO é de propósito: o que está sob teste é só este.
const criterio = (r) =>
  [...(r?.erros ?? []), ...(r?.warnings ?? [])]
    .find((d) => d.codigo === 'CORRENTE_ENTRADA_TOTAL_EXCEDIDA')

describe('F10 · corrente_max_entrada chega ao contrato', () => {
  it('A · campo ausente → critério permanece não avaliado', () => {
    // É o estado de 52 de 52 inversores do catálogo real hoje. O arranjo é o
    // MESMO do caso B2, que dispara o critério: a única variável entre os dois
    // é a presença do campo. Sem isso, o teste não provaria nada sobre ele.
    const r = analisarCompatibilidade({
      dados_eletricos_modulo: MODULO,
      dados_eletricos_inversor: { ...INVERSOR_BASE, corrente_max_entrada: null },
      arranjo_proposto: arranjo(16, 4),
    })
    expect(criterio(r)).toBeUndefined()
  })

  it('B1 · campo presente e corrente total ABAIXO do limite → sem diagnóstico', () => {
    // FIXTURE — valor fictício, existe só neste teste. Nenhum equipamento real
    // foi preenchido: a cobertura no catálogo é 0/52.
    const CORRENTE_MAX_ENTRADA_FIXTURE = 60
    const r = analisarCompatibilidade({
      dados_eletricos_modulo: MODULO,
      dados_eletricos_inversor: { ...INVERSOR_BASE, corrente_max_entrada: CORRENTE_MAX_ENTRADA_FIXTURE },
      arranjo_proposto: arranjo(16, 2),   // Isc total = 14 × 2 = 28 A
    })
    expect(criterio(r)).toBeUndefined()
  })

  it('B2 · campo presente e corrente total ACIMA do limite → critério dispara', () => {
    const CORRENTE_MAX_ENTRADA_FIXTURE = 40   // FIXTURE, não persistido
    const r = analisarCompatibilidade({
      dados_eletricos_modulo: MODULO,
      dados_eletricos_inversor: { ...INVERSOR_BASE, corrente_max_entrada: CORRENTE_MAX_ENTRADA_FIXTURE },
      arranjo_proposto: arranjo(16, 4),   // Isc total = 14 × 4 = 56 A > 40 A
    })
    const d = criterio(r)
    expect(d).toBeDefined()
    expect(d.valores.corrente_max_entrada).toBe(40)
    expect(d.valores.isc_sistema).toBeGreaterThan(40)
  })

  it('C · não é derivada de corrente por MPPT — nem direta nem multiplicada', () => {
    const esp = { tensao_max_entrada: 1000, tensao_mppt_min: 200, tensao_mppt_max: 850,
      corrente_max_por_mppt: 30, n_mppts: 2 }
    const c = lerInversor(esp)
    expect(c.corrente_max_entrada).toBeNull()          // não copia o de MPPT
    const d = paraDimensionamento(esp)
    expect(d.corrente_max_entrada).toBeNull()
    expect(d.corrente_max_entrada).not.toBe(30)        // nem o valor sozinho
    expect(d.corrente_max_entrada).not.toBe(60)        // nem × n_mppts
  })

  it('C2 · quando declarada, é lida pelo próprio nome', () => {
    const c = lerInversor({ corrente_max_entrada: 40, corrente_max_por_mppt: 30 })
    expect(c.corrente_max_entrada).toBe(40)
    expect(c.corrente_max_por_mppt).toBe(30)           // as duas convivem
  })

  it('C3 · ausência dela NÃO vira lacuna que bloqueia montar string', () => {
    // As lacunas da FV-DOM-029 impedem o cálculo; esta só deixa um critério sem
    // avaliar. Se entrasse em `lacunas`, os 52 inversores seriam bloqueados.
    const d = paraDimensionamento({ tensao_max_entrada: 1000, tensao_mppt_min: 200,
      tensao_mppt_max: 850, corrente_isc_max: 40, n_mppts: 2 })
    expect(d.corrente_max_entrada).toBeNull()
    expect(d.lacunas).not.toContain('corrente_max_entrada')
    expect(d.lacunas).toHaveLength(0)
  })

  it('D · regressão F8: o limite de curto continua sem herdar o de trabalho', () => {
    const d = paraDimensionamento({ tensao_max_entrada: 1000, tensao_mppt_min: 200,
      tensao_mppt_max: 850, corrente_max_por_mppt: 30, corrente_max_entrada: 40, n_mppts: 2 })
    expect(d.isc_max_mppt).toBeNull()                  // não virou 30 nem 40
    expect(d.lacunas).toContain('corrente_isc_max')
    // As três grandezas permanecem separadas, cada uma no seu campo.
    expect(d.corrente_max_por_mppt).toBe(30)
    expect(d.corrente_max_entrada).toBe(40)
  })
})
