import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { criarSchemaInterno, validarSchemaInterno } from '../../../../backend/src/ai/schema.js'
import { calcularQualidade } from '../../../../backend/src/ai/qualityScore.js'
import { CircuitBreaker, ESTADOS } from '../../../../backend/src/ai/circuitBreaker.js'
import { HealthMonitor } from '../../../../backend/src/ai/healthMonitor.js'
import { diagnosticarChaves, mascarar } from '../../../../backend/src/ai/aiKeys.js'
import { ordenarProviders } from '../../../../backend/src/ai/aiConfig.js'
import { AIOrchestrator } from '../../../../backend/src/ai/AIOrchestrator.js'

/** AI-ARCH-01 — arquitetura única de IA. */

describe('schema interno (FASE 4)', () => {
  it('cria schema canônico com chaves garantidas', () => {
    const s = criarSchemaInterno({ fabricante: ' Growatt ', modelo: 'MID25KTL3-X' })
    expect(s).toMatchObject({ fabricante: 'Growatt', modelo: 'MID25KTL3-X', tipo: null })
    expect(s.especificacoes).toEqual({})
  })
  it('valida forma do schema', () => {
    expect(validarSchemaInterno({ fabricante: 'x', modelo: 'y', tipo: 'inversor', especificacoes: {} }).valido).toBe(true)
    expect(validarSchemaInterno({ fabricante: 'x' }).valido).toBe(false)
  })
})

describe('qualityScore (FASE 8)', () => {
  it('aceitar (>=80) quando há identidade + técnicos', () => {
    const r = calcularQualidade({
      fabricante: 'Growatt', modelo: 'MID25KTL3-X', tipo: 'inversor',
      especificacoes: { potencia_kw: 25, n_mppts: 2, tensao_max_entrada: 1100, corrente_max_por_mppt: 16, eficiencia_maxima: 98.6, dimensoes: '1x1', peso_kg: 40, grau_protecao_ip: 'IP66' },
    })
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.decisao).toBe('aceitar')
  })
  it('revisão assistida (50-79)', () => {
    const r = calcularQualidade({ fabricante: 'Growatt', modelo: 'MID25KTL3-X', especificacoes: { potencia_kw: 25, n_mppts: 2 } })
    expect(r.score).toBeGreaterThanOrEqual(50)
    expect(r.score).toBeLessThan(80)
    expect(r.decisao).toBe('revisao_assistida')
  })
  it('solicitar preenchimento (<50) só com identidade', () => {
    const r = calcularQualidade({ fabricante: 'Growatt', modelo: 'MID25KTL3-X', especificacoes: {} })
    expect(r.score).toBeLessThan(50)
    expect(r.decisao).toBe('solicitar_preenchimento')
  })
})

describe('circuitBreaker (FASE 6)', () => {
  it('abre após 3 falhas consecutivas e recupera após cooldown', () => {
    let t = 1000
    const cb = new CircuitBreaker({ limiteFalhas: 3, cooldownMs: 500, now: () => t })
    expect(cb.permite()).toBe(true)
    cb.registrarFalha('e'); cb.registrarFalha('e')
    expect(cb.estado).toBe(ESTADOS.CLOSED)
    cb.registrarFalha('e')
    expect(cb.estado).toBe(ESTADOS.OPEN)
    expect(cb.permite()).toBe(false)
    t += 600 // passa o cooldown
    expect(cb.permite()).toBe(true) // HALF_OPEN
    cb.registrarSucesso()
    expect(cb.estado).toBe(ESTADOS.CLOSED)
  })
  it('falha em HALF_OPEN reabre imediatamente', () => {
    let t = 0
    const cb = new CircuitBreaker({ limiteFalhas: 2, cooldownMs: 100, now: () => t })
    cb.registrarFalha(); cb.registrarFalha()
    expect(cb.estado).toBe(ESTADOS.OPEN)
    t += 200
    expect(cb.permite()).toBe(true)
    cb.registrarFalha()
    expect(cb.estado).toBe(ESTADOS.OPEN)
  })
})

describe('healthMonitor (FASE 7)', () => {
  it('calcula taxa de sucesso e status', () => {
    const h = new HealthMonitor({ now: () => 1 })
    h.setConfigurado('gemini', true)
    h.registrar('gemini', { sucesso: true, latenciaMs: 10 })
    h.registrar('gemini', { sucesso: false, erro: '401' })
    const snap = h.snapshot({ gemini: 'closed' }).find(p => p.provider === 'gemini')
    expect(snap.taxaSucessoPct).toBe(50)
    expect(snap.status).toBe('ERRO')
    expect(snap.ultimoErro).toBe('401')
  })
})

describe('aiKeys (FASE 2 + FASE 9)', () => {
  const orig = { ...process.env }
  afterEach(() => { process.env = { ...orig } })
  it('mascara sem expor o valor', () => {
    expect(mascarar('sk-ant-abcdefghijklmnop')).toMatch(/^sk-a…/)
    expect(mascarar('sk-ant-abcdefghijklmnop')).not.toContain('defghij')
  })
  it('detecta variável órfã ANTROPIC (sem H)', () => {
    process.env.ANTROPIC_API_KEY = 'x'
    const d = diagnosticarChaves()
    expect(d.orfas.join(' ')).toMatch(/ANTROPIC_API_KEY/)
  })
  it('detecta ambiguidade GOOGLE+GEMINI', () => {
    process.env.GOOGLE_API_KEY = 'a'
    process.env.GEMINI_API_KEY = 'b'
    const d = diagnosticarChaves()
    expect(d.ambiguidades.join(' ')).toMatch(/padronizar/i)
  })
})

describe('aiConfig — ordem da cascata (FASE 5)', () => {
  it('gemini→claude→openai→internal', () => {
    const ordem = ordenarProviders().map(p => p.provider)
    expect(ordem).toEqual(['gemini', 'claude', 'openai', 'internal'])
  })
  it('internal sempre incluído por último', () => {
    const ordem = ordenarProviders([{ provider: 'claude', enabled: true, priority: 1 }]).map(p => p.provider)
    expect(ordem[ordem.length - 1]).toBe('internal')
  })
})

// ── Orchestrator com adapters fake (determinístico) ────────────────────────────
class FakeAdapter {
  constructor(nome, b = {}) { this.nome = nome; this.b = b }
  isConfigured() { return this.b.configured !== false }
  async extract() { if (this.b.throw) throw new Error(this.b.throw); return this.b.result }
}

function orch(adapters) {
  return new AIOrchestrator({ adapters, now: () => 0 })
}

describe('AIOrchestrator — cascata (FASE 3 + FASE 5)', () => {
  const ident = (f, m) => ({ fabricante: f, modelo: m, tipo: 'inversor', especificacoes: {}, _meta: {} })

  it('Gemini falha → Claude assume (usuário não percebe)', async () => {
    const o = orch({
      gemini: new FakeAdapter('gemini', { throw: 'boom' }),
      claude: new FakeAdapter('claude', { result: ident('Growatt', 'MID25KTL3-X') }),
      internal: new FakeAdapter('internal', { result: ident(null, null) }),
    })
    const r = await o.extrair({ textoOCR: 'x' })
    expect(r.ok).toBe(true)
    expect(r.provider).toBe('claude')
    expect(r.dados.modelo).toBe('MID25KTL3-X')
  })

  it('todos externos falham → motor interno', async () => {
    const o = orch({
      gemini: new FakeAdapter('gemini', { throw: 'x' }),
      claude: new FakeAdapter('claude', { throw: 'y' }),
      openai: new FakeAdapter('openai', { configured: false }),
      internal: new FakeAdapter('internal', { result: ident('Deye', 'SUN-75K-G') }),
    })
    const r = await o.extrair({ textoOCR: 'Deye SUN-75K-G' })
    expect(r.provider).toBe('internal')
    expect(r.dados.fabricante).toBe('Deye')
  })

  it('ninguém identifica → preenchimento assistido', async () => {
    const o = orch({
      gemini: new FakeAdapter('gemini', { result: ident(null, null) }),
      internal: new FakeAdapter('internal', { result: ident(null, null) }),
    })
    const r = await o.extrair({ textoOCR: '' })
    expect(r.ok).toBe(false)
    expect(r.preenchimentoAssistido).toBe(true)
  })

  it('circuit breaker pula provider após 3 falhas', async () => {
    const o = orch({
      gemini: new FakeAdapter('gemini', { throw: 'boom' }),
      claude: new FakeAdapter('claude', { result: ident('Growatt', 'MID25KTL3-X') }),
      internal: new FakeAdapter('internal', { result: ident(null, null) }),
    })
    await o.extrair({}); await o.extrair({}); await o.extrair({})
    const r = await o.extrair({})
    const tGemini = r.tentativas.find(t => t.provider === 'gemini')
    expect(tGemini.pulado).toBe('circuit_open')
    expect(r.provider).toBe('claude')
  })

  it('anexa quality score ao resultado', async () => {
    const o = orch({
      gemini: new FakeAdapter('gemini', { result: ident('Growatt', 'MID25KTL3-X') }),
      internal: new FakeAdapter('internal', { result: ident(null, null) }),
    })
    const r = await o.extrair({})
    expect(r.qualidade).toHaveProperty('score')
    expect(r.qualidade).toHaveProperty('decisao')
  })
})
