import { describe, it, expect } from 'vitest'
import { avaliarEntradaMicro } from '@fortesolar/fv-shared/engenharia/entrada-micro'
import { classificarCampos } from '@fortesolar/fv-shared/ai/campos-equipamento'
import { entradaCcDoMicro } from '../catalogo'
import { entradaDoBloco } from '../microinversores'

/** Pedido de 2026-11-25: micro se confere por potência do módulo, tensão, MPPT e partida — não por CC/CA. */
// HMS-2250DW-4T (manual LA REV1.1): 450-750+ W, 65 V, 16-60 V, 22/60 V.
const MICRO = { modulos_por_entrada: 1, tensao_max_entrada: 65, mppt_min: 16, mppt_max: 60,
  tensao_partida: 22, tensao_partida_max: 60, potencia_modulo_min_w: 450, potencia_modulo_max_w: 750 }
const MODULO = { voc: 48, vmpp: 40, coef_temp_voc: -0.25, temp_noct: 45, potencia_w: 620 }
const av = (modulo = {}, micro = {}, clima = { tMin: 10, tMax: 40 }) =>
  avaliarEntradaMicro({ modulo: { ...MODULO, ...modulo }, micro: { ...MICRO, ...micro }, ...clima })

describe('entrada CC do microinversor', () => {
  it('tudo dentro → ok, com Voc corrigido na mão: 48 × (1 + 0,0025 × 15) = 49,8 V', () => {
    const r = av()
    expect(r.status).toBe('ok')
    expect(r.lacunas).toEqual([])
    expect(r.criterios.tensao_maxima.valor_v).toBeCloseTo(49.8, 2)
    // T célula = 40 + 25 × 1,25 = 71,25 → 48 × (1 − 0,0025 × 46,25) = 42,45
    expect(r.criterios.partida_min.valor_v).toBeCloseTo(42.45, 2)
  })
  it('Voc no frio acima de 65 V reprova, mesmo com Voc STC abaixo', () => {
    const r = av({ voc: 64 })
    expect(r.criterios.tensao_maxima.status).toBe('incompativel')
    expect(r.status).toBe('incompativel')
  })
  it('Vmpp fora da faixa MPPT reprova no frio e no calor', () => {
    expect(av({ vmpp: 59 }).criterios.mppt_max.status).toBe('incompativel')
    expect(av({ vmpp: 17 }).criterios.mppt_min.status).toBe('incompativel')
  })
  it('partida: abaixo da mínima reprova; acima da máxima adverte', () => {
    expect(av({ voc: 24, vmpp: 20 }).criterios.partida_min.status).toBe('incompativel')
    const r = av({ voc: 59, vmpp: 45 })
    expect(r.criterios.partida_max.status).toBe('atencao')
    expect(r.criterios.tensao_maxima.status).not.toBe('incompativel')
  })
  it('potência do módulo fora da faixa adverte, nunca reprova; ausente não é lacuna', () => {
    expect(av({ potencia_w: 760 }).status).toBe('atencao')
    expect(av({ potencia_w: 400 }).criterios.potencia_modulo.status).toBe('atencao')
    expect(av({ potencia_w: 750 }).status).toBe('ok')
    expect(av({}, { potencia_modulo_min_w: null, potencia_modulo_max_w: null }).status).toBe('ok')
  })
  it('dado ausente, zero ou texto inválido nunca aprova', () => {
    for (const [m, i, chave] of [
      [{ voc: null }, {}, 'modulo.voc'], [{ vmpp: 0 }, {}, 'modulo.vmpp'],
      [{ coef_temp_voc: null }, {}, 'modulo.coef_temp_voc'], [{ coef_temp_voc: 0 }, {}, 'modulo.coef_temp_voc'],
      [{}, { tensao_max_entrada: '' }, 'micro.tensao_max_entrada'], [{}, { mppt_min: 'x' }, 'micro.tensao_mppt_min'],
      [{}, { tensao_partida: null }, 'micro.tensao_partida'], [{}, { modulos_por_entrada: 2 }, 'micro.modulos_por_entrada'],
    ]) {
      const r = av(m, i)
      expect(r.lacunas).toContain(chave)
      expect(r.status).toBe('nao_avaliado')
    }
    expect(av({}, {}, { tMin: null, tMax: 40 }).lacunas).toContain('clima')
    expect(avaliarEntradaMicro().status).toBe('nao_avaliado')
    expect(avaliarEntradaMicro({ modulo: null, micro: null }).status).toBe('nao_avaliado')
  })
  it('sem NOCT usa o padrão canônico, não NaN', () => {
    expect(Number.isFinite(av({ temp_noct: null }).criterios.partida_min.valor_v)).toBe(true)
  })
  it('lê os limites do catálogo', () => {
    const eq = { _id: 'h', tipo: 'inversor', fabricante: 'Hoymiles', especificacoes: { subtipo: 'microinversor',
      tensao_max_entrada: 65, tensao_mppt_min: 16, tensao_mppt_max: 60, tensao_partida: 22, tensao_partida_max: 60,
      potencia_modulo_min_w: 450, potencia_modulo_max_w: 750 } }
    expect(entradaCcDoMicro(eq)).toEqual({ tensao_max_entrada: 65, mppt_min: 16, mppt_max: 60, tensao_partida: 22,
      tensao_partida_max: 60, potencia_modulo_min_w: 450, potencia_modulo_max_w: 750 })
    const clima = { temperatura_min_historica_c: 10, temperatura_max_historica_c: 40 }
    expect(entradaDoBloco({ equipamento_id: 'h', modulos_por_entrada: 1 }, [eq], MODULO, clima).status).toBe('ok')
    expect(entradaDoBloco({ equipamento_id: 'outro', modulos_por_entrada: 1 }, [eq], MODULO, clima).status).toBe('nao_avaliado')
  })
  it('cadastro: CC/CA some do micro e os campos do datasheet aparecem só nele', () => {
    const k = (e, micro) => classificarCampos('inversor', e, {}, { micro }).map((c) => c.key)
    expect(k({}, true)).not.toContain('oversizing_max')
    expect(k({ oversizing_max: 1.25 }, true)).toContain('oversizing_max')
    expect(k({}, true)).toEqual(expect.arrayContaining(['tensao_partida_max', 'potencia_modulo_min_w', 'potencia_modulo_max_w']))
    expect(k({}, false)).toContain('oversizing_max')
    expect(k({}, false)).not.toContain('potencia_modulo_max_w')
  })
})
