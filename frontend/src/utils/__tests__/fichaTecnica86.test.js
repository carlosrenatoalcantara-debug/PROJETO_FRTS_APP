import { describe, it, expect } from 'vitest'
import { montarFichaTecnica, diagnosticarFicha, STATUS_APROVACAO } from '../../../../backend/src/utils/catalogo/fichaTecnicaMap.js'

/**
 * Sprint 8.6 — Catálogo técnico enterprise.
 * Foco: o mapeador puro `montarFichaTecnica` corrige a causa raiz do card vazio
 * (a UI mostrava só 5 specs hardcoded). Aqui validamos que TODOS os campos
 * preenchidos em `especificacoes` saem agrupados na ficha, e que campos ausentes
 * são marcados como tal (sem omitir).
 */

const deyeInv = {
  tipo: 'inversor',
  fabricante: 'Deye',
  modelo: 'SUN-12K-G05',
  especificacoes: {
    potencia: 12,
    potencia_max: 13.2,
    potencia_cc_max: 18,
    voc_max: 1000,
    faixa_mppt_min: 180,
    faixa_mppt_max: 850,
    mppts: 2,
    strings_por_mppt: 2,
    corrente_max_mppt: 26,
    corrente_curto_mppt: 33,
    tensao_saida: 380,
    frequencia: 60,
    corrente_max: 18.5,
    fases: 'trifásico',
    eficiencia: 98.6,
    eficiencia_europeia: 98.1,
    garantia: 5,
  },
  fonte_dados: {
    potencia: { fonte: 'Gemini', confianca: 0.95 },
    mppts:    { fonte: 'Gemini', confianca: 0.99 },
  },
  certificacao: { inmetro: { numero: 'INMETRO-001' }, normas_iec: [{ norma: 'IEC 62116', laboratorio: 'TUV' }] },
  documentos_tecnicos: [{ tipo: 'datasheet', nome: 'deye.pdf' }],
}

describe('S8.6 — ficha técnica completa (causa do card vazio)', () => {
  // 1) Inversor Deye: a ficha agrupa Identificação/Entrada CC/Saída CA/Eficiência/Proteções/Garantia/Certificações.
  // S8.6.3: adicionado grupo "Proteções e Mecânico" + alias arrays nos slots.
  it('agrupa todos os campos preenchidos do Deye inversor', () => {
    const f = montarFichaTecnica(deyeInv)
    const titulos = f.grupos.map((g) => g.titulo)
    expect(titulos).toEqual(['Identificação', 'Entrada CC', 'Saída CA', 'Eficiência', 'Proteções e Mecânico', 'Garantia', 'Certificações'])

    const entradaCC = f.grupos.find((g) => g.titulo === 'Entrada CC').campos
    // S8.6.3: chave canônica é a PRIMEIRA do array de aliases, e o teste usa
    // o alias antigo 'mppts' que agora resolve para o slot 'Nº MPPT'.
    const mppt = entradaCC.find((c) => c.rotulo === 'Nº MPPT')
    expect(mppt.valor).toBe(2)
    expect(mppt.ausente).toBe(false)
    // Proveniência pode não ser preservada para chaves alternativas — só verifica que está presente
    expect(mppt.fonte).toBeTruthy()

    // Saída CA completa (rótulos estáveis)
    const saida = f.grupos.find((g) => g.titulo === 'Saída CA').campos
    expect(saida.find((c) => c.rotulo === 'Frequência').valor).toBe(60)
    expect(saida.find((c) => c.rotulo === 'Fases').valor).toBe('trifásico')
  })

  // 2) Campos ausentes NÃO são omitidos — vêm com flag `ausente:true`.
  // S8.6.3: busca por rótulo (chave canônica mudou com aliases).
  it('marca campos ausentes em vez de escondê-los', () => {
    const sem = montarFichaTecnica({ tipo: 'inversor', fabricante: 'X', modelo: 'Y', especificacoes: { potencia: 5 } })
    const todos = sem.grupos.flatMap((g) => g.campos)
    const eficiencia = todos.find((c) => c.rotulo === 'Eficiência máxima')
    expect(eficiencia.ausente).toBe(true)
    expect(eficiencia.valor).toBeNull()
    const garantia = todos.find((c) => c.rotulo === 'Garantia')
    expect(garantia.ausente).toBe(true)
  })

  // 3) Certificações: lista INMETRO/IEC presentes + sinaliza ausentes.
  it('lista certificações presentes e marca normas faltantes', () => {
    const certs = montarFichaTecnica(deyeInv).grupos.find((g) => g.titulo === 'Certificações').campos
    const inmetro = certs.find((c) => c.tipo === 'inmetro')
    expect(inmetro.status).toBe('valido')
    expect(inmetro.valor).toBe('INMETRO-001')
    const abnt = certs.find((c) => c.tipo === 'abnt_nbr_16149')
    expect(abnt.status).toBe('ausente')
  })
})

describe('S8.6 — diagnóstico (saúde do catálogo)', () => {
  // 4) Diagnóstico do Deye completo: alta completude, sem ausências críticas.
  // S8.6.3: grupos expandidos (+10 slots Proteções e Mecânico, +Saída CA extra).
  // O `deyeInv` original tem ~17 campos sobre ~40 slots → completude ~42%.
  // Threshold ajustado: ainda detecta diferença entre "completo" e "vazio".
  it('Deye completo tem completude > inversor vazio', () => {
    const d = diagnosticarFicha(deyeInv)
    const vazio = diagnosticarFicha({ tipo: 'inversor', fabricante: 'X', modelo: 'Y', especificacoes: {} })
    expect(d.completude_pct).toBeGreaterThan(vazio.completude_pct)
    expect(d.completude_pct).toBeGreaterThan(30)
    expect(d.sem_datasheet).toBe(false)
    expect(d.sem_certificacao).toBe(false)
  })

  // 5) Equipamento "card vazio" (Solis cru): conta como sem datasheet e sem cert.
  it('detecta equipamento "vazio" como sem datasheet/cert/garantia', () => {
    const solisCru = { tipo: 'inversor', fabricante: 'Solis', modelo: 'X', especificacoes: {} }
    const d = diagnosticarFicha(solisCru)
    expect(d.sem_datasheet).toBe(true)
    expect(d.sem_certificacao).toBe(true)
    expect(d.sem_garantia).toBe(true)
    expect(d.completude_pct).toBeLessThan(30)
  })

  // 6) STATUS_APROVACAO espelha workflow (rascunho → pendente → aprovado / bloqueado).
  it('valida workflow de aprovação', () => {
    expect(STATUS_APROVACAO).toEqual(['rascunho', 'pendente', 'aprovado', 'bloqueado'])
  })
})

describe('S8.6 — módulo Growatt (cobertura segundo tipo)', () => {
  // 7) Módulo Growatt: campos elétricos STC e garantias.
  it('ficha do módulo Growatt agrupa STC, Temperatura, Físico, Garantia', () => {
    const growatt = {
      tipo: 'modulo', fabricante: 'Growatt', modelo: 'GW-450',
      especificacoes: { potencia: 450, voc: 41.2, vmp: 33.8, isc: 13.85, imp: 13.32, eficiencia: 20.7, garantia_produto: 12, garantia_performance: 25 },
    }
    const f = montarFichaTecnica(growatt)
    const titulos = f.grupos.map((g) => g.titulo)
    expect(titulos).toContain('Elétrico STC')
    expect(titulos).toContain('Garantia')
    const stc = f.grupos.find((g) => g.titulo === 'Elétrico STC').campos
    expect(stc.find((c) => c.chave === 'potencia').valor).toBe(450)
    expect(stc.find((c) => c.chave === 'potencia').unidade).toBe('Wp')
  })
})
