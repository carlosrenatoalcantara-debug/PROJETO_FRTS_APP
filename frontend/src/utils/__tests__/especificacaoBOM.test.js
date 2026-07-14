import { describe, it, expect } from 'vitest'
import { gerarBOM } from '../bomMateriaisEV'
import { derivarEspecificacaoEV, adaptarProjetoEV } from '../adapterDiagramaEV'

/**
 * BUG-021.2 — NÃO PODE HAVER DIVERGÊNCIA.
 * A Lista de Materiais e o Unifilar são gerados a partir da MESMA especificação
 * executiva. Este teste faz o operador trocar componentes e condutores e exige que
 * BOM e desenho mostrem exatamente o mesmo — nunca o valor antigo do Motor.
 */
const calcMotor = { disjuntor_a: 40, bitola_cabo_mm2: 10, dr_ma: 30, dps_kv: 420 }
const carrTri = { numero_fases: 3, tensao_entrada_v: 380, potencia_kw: 22, tipo: 'AC Trifásico' }

function especEditada() {
  const esp = derivarEspecificacaoEV({ calculos: calcMotor, carregador: carrTri, comprimento_cabo_m: 25 })
  esp.componentes.disjuntor.corrente_a = 63
  esp.componentes.disjuntor.curva = 'D'
  esp.componentes.idr.corrente_a = 63          // corrente do IDR é atributo PRÓPRIO
  esp.componentes.idr.sensibilidade_ma = 300
  esp.componentes.idr.tipo = 'B'
  esp.componentes.dps.tensao_v = 275
  esp.componentes.dps.imax_ka = 65
  esp.condutores.forEach(c => { c.bitola_mm2 = 16; c.comprimento_m = 30 })
  esp.condutores.find(c => c.id === 'PE').bitola_mm2 = 10
  return esp
}

describe('BUG-021.2 — BOM e Unifilar leem a MESMA especificação', () => {
  const esp = especEditada()
  const bom = gerarBOM({ potencia_kw: 22, tipo_carregador: 'AC Trifásico', especificacao: esp })
  const achar = (nome) => bom.find(b => b.item === nome)

  it('o BOM especifica o componente EDITADO, não o dimensionado pelo Motor', () => {
    expect(achar('Disjuntor termomagnético').especificacao).toBe('63A Curva D · 4P')
    expect(achar('Dispositivo DR').especificacao).toBe('63A 300mA Tipo B · 4P')
    expect(achar('DPS (Proteção contra Surtos)').especificacao).toBe('275V Classe II · Imax 65kA · 1P')
  })

  it('DPS: 1 por condutor vivo (tri = 4)', () => {
    expect(achar('DPS (Proteção contra Surtos)').quantidade).toBe(4)
  })

  it('cada condutor entra no BOM com SUA bitola e SEU comprimento (PE = 10mm²)', () => {
    expect(achar('Cabo Fase L1').especificacao).toContain('16mm²')
    expect(achar('Cabo Fase L1').quantidade).toBe(30)
    expect(achar('Cabo Terra (PE)').especificacao).toContain('10mm²')
    expect(achar('Cabo Neutro (N)').especificacao).toContain('16mm²')
  })

  it('o UNIFILAR desenha exatamente o que o BOM comprou', () => {
    const { components } = adaptarProjetoEV({
      calculos: calcMotor, bom, numero_fases: 3, carregador: carrTri, projeto: { fases: 3 }, especificacao: esp,
    })
    const disj = components.find(c => c.id === 'disj')
    const dps = components.filter(c => c.tipo === 'dps')
    // Mesmos números nos dois documentos — é a garantia de "sem divergências".
    expect(achar('Disjuntor termomagnético').especificacao).toContain(`${disj.specs.corrente_a}A`)
    expect(achar('Disjuntor termomagnético').especificacao).toContain(`Curva ${disj.specs.curva}`)
    expect(dps.length).toBe(achar('DPS (Proteção contra Surtos)').quantidade)
    expect(achar('DPS (Proteção contra Surtos)').especificacao).toContain(`${dps[0].specs.imax_ka}kA`)
  })

  it('sem especificação (chamada legada) o BOM ainda funciona pelos args do Motor', () => {
    const legado = gerarBOM({
      potencia_kw: 22, tipo_carregador: 'AC Trifásico', numero_fases: 3,
      bitola_mm2: 10, disjuntor_a: 40, dr_ma: 30, dps_kv: 420, comprimento_m: 25,
    })
    expect(legado.find(b => b.item === 'Disjuntor termomagnético').especificacao).toBe('40A Curva C')
    expect(legado.find(b => b.item === 'Cabo Fase L1').quantidade).toBe(25)
  })
})
