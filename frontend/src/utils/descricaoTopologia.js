/**
 * descricaoTopologia.js — P1-MICRO-DOCS-01
 *
 * Textos/descrições por topologia para os DOCUMENTOS a jusante (memorial, parecer, unifilar,
 * validação) — consome o `topologia` + bloco `micro` persistido pela engenharia elétrica.
 * Não altera SSOT/Atlas/parser. Pura e testável.
 */
import { classificarTopologia } from './topologiaInversor.js'

/**
 * @param {'string'|'micro'|'otimizador'} topologia
 * @param {object} [micro]  bloco persistido { qtd_microinversores, modulos_por_micro, entradas_por_micro, ... }
 */
export function descricaoTopologia(topologia, micro) {
  if (topologia === 'micro') {
    const q = micro?.qtd_microinversores
    const mpm = micro?.modulos_por_micro
    return {
      topologia: 'micro',
      rotulo: '⚡ Sistema Microinversor',
      tipoInversor: 'Microinversor (CA distribuída — conversão módulo a módulo, sem strings CC)',
      protecoes: [
        '• Proteção de sobretemperatura: integrada a cada microinversor',
        '• Anti-ilhamento             : Função integrada a cada microinversor (conforme ABNT NBR 16149)',
        '• Proteção contra surtos (DPS): Prevista no lado CA (quadro de distribuição)',
        '• Lado CC                    : Sem string box — cada módulo conecta diretamente ao microinversor',
        '• Disjuntor CA               : Previsto no quadro de distribuição',
        '• Aterramento                : Conforme ABNT NBR 5410 e ABNT NBR 5419',
      ],
      resumoArranjo: q ? `${q} microinversor(es)${mpm ? ` — ${mpm} módulo(s) por micro` : ''} (sem strings/MPPT)` : 'Microinversores (sem strings/MPPT)',
      usaString: false,
    }
  }
  if (topologia === 'otimizador') {
    return {
      topologia: 'otimizador',
      rotulo: 'Inversor com Otimizadores',
      tipoInversor: 'Inversor string com otimizadores de potência (MPPT por módulo)',
      protecoes: [
        '• Proteção de sobretemperatura: integrada ao inversor',
        '• Anti-ilhamento             : Função integrada ao inversor (conforme ABNT NBR 16149)',
        '• Proteção contra surtos (DPS): Prevista no string box lado CC e no quadro CA',
        '• String box CC              : Com seccionador (otimizadores fazem o MPPT por módulo)',
        '• Disjuntor CA               : Previsto no quadro de distribuição',
        '• Aterramento                : Conforme ABNT NBR 5410 e ABNT NBR 5419',
      ],
      resumoArranjo: 'Strings com otimizador de potência por módulo',
      usaString: true,
    }
  }
  // string (default)
  return {
    topologia: 'string',
    rotulo: 'Inversor String',
    tipoInversor: 'String (on-grid, sem isolamento galvânico)',
    protecoes: [
      '• Proteção de sobretemperatura: integrada ao inversor',
      '• Anti-ilhamento             : Função integrada ao inversor (conforme ABNT NBR 16149)',
      '• Proteção contra surtos (DPS): Prevista no string box lado CC e no quadro CA',
      '• String box CC              : Com fusíveis por string e seccionador',
      '• Disjuntor CA               : Previsto no quadro de distribuição',
      '• Aterramento                : Conforme ABNT NBR 5410 e ABNT NBR 5419',
    ],
    resumoArranjo: 'Strings em série por MPPT',
    usaString: true,
  }
}

/** Resolve a topologia a partir do dado do projeto (campo persistido > classificação por modelo). */
export function topologiaDoProjeto(d) {
  const persistida = d?.topologia ?? d?.engenharia_eletrica?.topologia ?? d?.arranjo?.topologia
  if (persistida) return persistida
  return classificarTopologia(d?.inversor ?? {})
}
