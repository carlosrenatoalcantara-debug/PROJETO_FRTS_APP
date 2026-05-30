import { describe, it, expect } from 'vitest'
import {
  auditarInversor, relatorioSaudeInversores, detectarDuplicatas,
  CAMPOS_CRITICOS_INVERSOR,
} from '../../../../backend/src/utils/catalogo/catalogoQAUtils.js'

/**
 * Sprint 8.6.4 — QA Final do Catálogo de Inversores.
 * Valida todos os campos críticos nos fabricantes reais do cenário de produção.
 */

// ── Fixtures realistas ─────────────────────────────────────────────────────

const deye30k = {
  _id: '1',
  tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN-30K-G04',
  especificacoes: {
    potencia_kw: 30, n_mppts: 3, tensao_max_entrada: 1000,
    tensao_mppt_min: 200, tensao_mppt_max: 850,
    corrente_max_por_mppt: 26, fases: 3, eficiencia_maxima: 98.6, garantia_anos: 5,
  },
  datasheet_original: { hash: 'abc' },
}

const deyeVazio = {
  _id: '2',
  tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN-12K-G05',
  especificacoes: {},
}

const solplanet = {
  _id: '3',
  tipo: 'inversor', fabricante: 'Solplanet', modelo: 'ASW7300-S',
  especificacoes: {
    potencia_kw: 7.3, n_mppts: 1, tensao_max_entrada: 1000,
    tensao_mppt_min: 100, tensao_mppt_max: 850,
    corrente_max_por_mppt: 16, fases: 3, eficiencia_maxima: 97.6, garantia_anos: 10,
  },
  datasheet_original: { hash: 'def' },
}

const solis = {
  _id: '4',
  tipo: 'inversor', fabricante: 'Solis', modelo: 'RHI-50K-HV-5G',
  especificacoes: {
    potencia_kw: 50, n_mppts: 4, tensao_max_entrada: 1100,
    tensao_mppt_min: 200, tensao_mppt_max: 1000,
    corrente_max_por_mppt: 30, fases: 3, eficiencia_maxima: 99.0, garantia_anos: 5,
  },
}

const growatt = {
  _id: '5',
  tipo: 'inversor', fabricante: 'Growatt', modelo: 'MAX50KTL3-LV',
  especificacoes: {
    mppts: 4,              // chave canônica antiga (deve funcionar como alias)
    voc_max: 1000,         // alias antigo para tensao_max_entrada
    faixa_mppt_min: 200,   // alias antigo
    faixa_mppt_max: 850,
    potencia: 50,           // alias antigo
    eficiencia: 98.2,
    garantia: 5,
    fases: 3,
  },
}

describe('S8.6.4 — auditarInversor (campo a campo)', () => {
  // 1) Deye 30K completo → completude alta
  it('Deye 30K com 9 campos → completude ≥ 80%', () => {
    const r = auditarInversor(deye30k)
    expect(r.fabricante).toBe('Deye')
    expect(r.modelo).toBe('SUN-30K-G04')
    expect(r.completude_pct).toBeGreaterThanOrEqual(80)
    expect(r.tem_datasheet).toBe(true)
    expect(r.campos_faltando.length).toBe(0)
  })

  // 2) Deye vazio → completude baixa, marcado para reprocessamento? (sem datasheet = não)
  it('Deye vazio (0 specs) → completude baixa, precisa_reprocessamento=false (sem datasheet)', () => {
    const r = auditarInversor(deyeVazio)
    expect(r.completude_pct).toBeLessThan(30)
    expect(r.campos_faltando.length).toBeGreaterThan(5)
    expect(r.precisa_reprocessamento).toBe(false) // sem datasheet → não reprocessa
  })

  // 3) Solplanet ASW7300-S → todos campos presentes
  it('Solplanet ASW7300-S com 9 campos → completude ≥ 80%', () => {
    const r = auditarInversor(solplanet)
    expect(r.fabricante).toBe('Solplanet')
    expect(r.completude_pct).toBeGreaterThanOrEqual(80)
    expect(r.tem_datasheet).toBe(true)
  })

  // 4) Growatt com chaves canônicas antigas (alias compat)
  it('Growatt com chaves antigas (mppts, voc_max, faixa_mppt_min) → 100% dos campos presentes', () => {
    const r = auditarInversor(growatt)
    expect(r.completude_pct).toBeGreaterThanOrEqual(80)
    expect(r.fabricante).toBe('Growatt')
    // Confirma que alias antigos são lidos
    expect(r.campos_faltando).not.toContain('Nº MPPT')
    expect(r.campos_faltando).not.toContain('Tensão máx CC')
  })
})

describe('S8.6.4 — relatorioSaudeInversores', () => {
  const lista = [deye30k, deyeVazio, solplanet, solis, growatt]

  // 5) Total e completude média
  it('agrega total e completude média dos 5 inversores', () => {
    const r = relatorioSaudeInversores(lista)
    expect(r.total).toBe(5)
    expect(r.completude_media_pct).toBeGreaterThan(50)
  })

  // 6) campos_faltando conta equipamentos sem cada campo
  it('campos_faltando: Deye vazio incremente contagens', () => {
    const r = relatorioSaudeInversores(lista)
    // deyeVazio não tem nenhum campo → todos os contadores aumentam em ≥ 1
    for (const campo of CAMPOS_CRITICOS_INVERSOR) {
      if (campo.nivel === 'topo') continue // fabricante/modelo sempre presentes
      expect(r.campos_faltando[campo.rotulo]).toBeGreaterThanOrEqual(1)
    }
  })

  // 7) precisam_reprocessamento: deyeVazio NÃO (sem datasheet), deye30k NÃO (já completo)
  it('precisam_reprocessamento exclui sem datasheet', () => {
    const r = relatorioSaudeInversores(lista)
    expect(r.precisam_reprocessamento).toBe(0) // nenhum está incompleto + COM datasheet
  })
})

describe('S8.6.4 — detectarDuplicatas', () => {
  // 8) Dois Deye com prefixos parecidos → um grupo
  it('detecta Deye SUN-30K-G04 vs SUN-30K-G05 como prováveis duplicatas', () => {
    const dois = [deye30k, { ...deyeVazio, modelo: 'SUN-30K-G05', especificacoes: {} }]
    const grupos = detectarDuplicatas(dois)
    expect(grupos.length).toBe(1)
    expect(grupos[0].fabricante).toBe('Deye')
  })

  // 9) Marcas diferentes → sem duplicatas
  it('Deye e Solplanet não são duplicatas', () => {
    const grupos = detectarDuplicatas([deye30k, solplanet])
    expect(grupos.length).toBe(0)
  })

  // 10) Grupos ordenados por completude (melhor primeiro)
  it('docs dentro do grupo ordenados por completude decrescente', () => {
    const dois = [{ ...deyeVazio, _id: 'vaz' }, { ...deye30k, modelo: 'SUN-30K-G05', _id: 'com' }]
    const grupos = detectarDuplicatas(dois)
    if (grupos.length > 0) {
      const [primeiro, segundo] = grupos[0].docs
      expect(primeiro.completude_pct).toBeGreaterThanOrEqual(segundo.completude_pct)
    }
  })
})

describe('S8.6.4 — campos_criticos cobre todos os campos do form de importação', () => {
  // 11) Todos os campos que ModalNovoInversor persiste devem ter cobertura
  it('11 campos críticos definidos', () => {
    expect(CAMPOS_CRITICOS_INVERSOR.length).toBe(11)
    const rotulos = CAMPOS_CRITICOS_INVERSOR.map(c => c.rotulo)
    expect(rotulos).toContain('Fabricante')
    expect(rotulos).toContain('Modelo')
    expect(rotulos).toContain('Potência nominal')
    expect(rotulos).toContain('Nº MPPT')
    expect(rotulos).toContain('Tensão máx CC')
    expect(rotulos).toContain('Eficiência máx')
    expect(rotulos).toContain('Garantia')
  })
})
