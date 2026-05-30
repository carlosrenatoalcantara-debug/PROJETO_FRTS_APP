import { describe, it, expect } from 'vitest'
import {
  detectarAlertasRT, detectarAlertasCatalogo, detectarAlertasDocumentos,
  detectarAlertasProjetos, detectarAlertasFaturas,
  agregarAlertas, calcularKPIs, filtrarAlertas,
  SEVERIDADES, ORIGENS,
} from '../../../../backend/src/utils/alertcenter/alertDetectors.js'

/**
 * Sprint 8.8 — AlertCenter Operacional Enterprise.
 * Detectores puros e agregador. Sem I/O, sem Mongoose.
 */

const HOJE = new Date('2026-05-30T00:00:00Z')
const dias = (n) => new Date(HOJE.getTime() + n * 24 * 60 * 60 * 1000)

describe('S8.8 — alertas de RT (vencimento)', () => {
  // 1) RT vencido = crítico
  it('RT vencido gera alerta crítico', () => {
    const tecnicos = [{ _id: 't1', nome: 'Eng. João', ativo: true, validade_carteira_profissional: dias(-10) }]
    const alertas = detectarAlertasRT(tecnicos, HOJE)
    expect(alertas).toHaveLength(1)
    expect(alertas[0].severidade).toBe('critico')
    expect(alertas[0].id).toBe('rt_vencido:t1')
    expect(alertas[0].titulo).toMatch(/VENCIDA/)
  })

  // 2) Vence em 30 dias = aviso
  it('RT vence em 30 dias = aviso', () => {
    const alertas = detectarAlertasRT([{ _id: 't2', nome: 'Eng. Ana', ativo: true, validade_carteira_profissional: dias(25) }], HOJE)
    expect(alertas[0].severidade).toBe('aviso')
  })

  // 3) Vence em 90 dias = info
  it('RT vence em 90 dias = info', () => {
    const alertas = detectarAlertasRT([{ _id: 't3', nome: 'Eng. Bia', ativo: true, validade_carteira_profissional: dias(70) }], HOJE)
    expect(alertas[0].severidade).toBe('info')
  })

  // 4) Técnico inativo é ignorado
  it('técnico inativo é ignorado', () => {
    const alertas = detectarAlertasRT([{ _id: 't4', nome: 'Inativo', ativo: false, validade_carteira_profissional: dias(-100) }], HOJE)
    expect(alertas).toHaveLength(0)
  })

  // 5) RT > 90 dias = sem alerta
  it('RT > 90 dias não gera alerta', () => {
    const alertas = detectarAlertasRT([{ _id: 't5', nome: 'OK', ativo: true, validade_carteira_profissional: dias(180) }], HOJE)
    expect(alertas).toHaveLength(0)
  })
})

describe('S8.8 — alertas de catálogo', () => {
  // 6) Equipamento sem datasheet
  it('equipamento sem datasheet → aviso', () => {
    const alertas = detectarAlertasCatalogo([{ _id: 'e1', tipo: 'inversor', fabricante: 'Deye', modelo: 'X' }])
    expect(alertas.some(a => a.id.startsWith('cat_sem_datasheet'))).toBe(true)
  })

  // 7) Bloqueado → erro
  it('equipamento bloqueado → erro', () => {
    const alertas = detectarAlertasCatalogo([{ _id: 'e2', tipo: 'inversor', fabricante: 'X', modelo: 'Y', aprovacao_tecnica: { status: 'bloqueado', motivo: 'teste' } }])
    const blq = alertas.find(a => a.id.startsWith('cat_bloqueado'))
    expect(blq).toBeDefined()
    expect(blq.severidade).toBe('erro')
  })

  // 8) Sem certificação (inversor/módulo) → aviso
  it('inversor sem INMETRO nem IEC → aviso', () => {
    const eq = { _id: 'e3', tipo: 'inversor', fabricante: 'X', modelo: 'Y', datasheet_original: { hash: 'a' }, certificacao: {} }
    const alertas = detectarAlertasCatalogo([eq])
    expect(alertas.some(a => a.id.startsWith('cat_sem_cert'))).toBe(true)
  })

  // 9) Completude < 80% → info (se diagnosticador fornecido)
  it('completude < 80% via diagnosticador → info', () => {
    const diag = () => ({ completude_pct: 50, campos_ausentes: 5 })
    const eq = { _id: 'e4', tipo: 'inversor', fabricante: 'X', modelo: 'Y', datasheet_original: { hash: 'a' }, certificacao: { inmetro: { numero: 'I-1' } } }
    const alertas = detectarAlertasCatalogo([eq], { diagnosticarFicha: diag })
    const inc = alertas.find(a => a.id.startsWith('cat_incompleto'))
    expect(inc).toBeDefined()
    expect(inc.severidade).toBe('info')
  })
})

describe('S8.8 — alertas documentais', () => {
  // 10) Certificado vencido → crítico
  it('documento vencido → crítico', () => {
    const docs = [{ _id: 'd1', tipo: 'inmetro', nome: 'X', validade: dias(-30), hash: 'h' }]
    const alertas = detectarAlertasDocumentos(docs, HOJE)
    expect(alertas[0].severidade).toBe('critico')
  })

  // 11) Documento físico ausente → erro
  it('documento sem hash/base64/path → erro físico ausente', () => {
    const docs = [{ _id: 'd2', tipo: 'datasheet', nome: 'X' }]
    const alertas = detectarAlertasDocumentos(docs, HOJE)
    expect(alertas.some(a => a.id.startsWith('doc_ausente') && a.severidade === 'erro')).toBe(true)
  })
})

describe('S8.8 — alertas de projetos', () => {
  // 12) Projeto sem RT → aviso
  it('projeto sem RT → aviso', () => {
    const projetos = [{ _id: 'p1', nome: 'Projeto X' }]
    const alertas = detectarAlertasProjetos(projetos)
    expect(alertas.some(a => a.id === 'proj_sem_rt:p1' && a.severidade === 'aviso')).toBe(true)
  })

  // 13) Projeto legacy
  it('projeto legacy=true → info', () => {
    const alertas = detectarAlertasProjetos([{ _id: 'p2', nome: 'Legado', tecnico_principal_id: 'rt', legacy: true }])
    expect(alertas.some(a => a.id.startsWith('proj_legacy'))).toBe(true)
  })

  // 14) Congelado sem snapshot RT
  it('congelado sem snapshot_responsavel_tecnico → aviso', () => {
    const projetos = [{
      _id: 'p3', nome: 'C', tecnico_principal_id: 'rt',
      governanca: { freeze_status: 'CONGELADO' }
    }]
    const alertas = detectarAlertasProjetos(projetos)
    expect(alertas.some(a => a.id.startsWith('proj_sem_snap_rt'))).toBe(true)
  })

  // 15) Rateio inválido
  it('rateio ≠ 100% → aviso', () => {
    const projetos = [{ _id: 'p4', nome: 'R', tecnico_principal_id: 'rt' }]
    const benefs = new Map([['p4', [
      { tipoRateio: 'percentual', valor: 60, ativa: true },
      { tipoRateio: 'percentual', valor: 30, ativa: true },
    ]]])
    const alertas = detectarAlertasProjetos(projetos, benefs)
    const r = alertas.find(a => a.id.startsWith('proj_rateio'))
    expect(r).toBeDefined()
    expect(r.contexto.soma).toBe(90)
  })

  // 16) Projeto excluído é ignorado
  it('projeto excluído não gera alerta', () => {
    expect(detectarAlertasProjetos([{ _id: 'p5', excluido: true }])).toHaveLength(0)
  })
})

describe('S8.8 — alertas de faturas', () => {
  // 17) OCR falhou
  it('PDF processado sem UC → erro OCR', () => {
    const faturas = [{ _id: 'f1', origem: { tipo: 'PDF', arquivo_nome: 'cosern.pdf' }, unidade_consumidora: {} }]
    const alertas = detectarAlertasFaturas(faturas)
    expect(alertas.some(a => a.id.startsWith('fat_ocr') && a.severidade === 'erro')).toBe(true)
  })

  // 18) Histórico incompleto
  it('flag historico_incompleto → aviso', () => {
    const faturas = [{ _id: 'f2', unidade_consumidora: { numero_uc: { valor: '12345' } }, flags: { historico_incompleto: true }, historico_consumo: [] }]
    const alertas = detectarAlertasFaturas(faturas)
    expect(alertas.some(a => a.id.startsWith('fat_hist'))).toBe(true)
  })

  // 19) Grupo A sem demanda
  it('Grupo A sem demanda contratada → aviso', () => {
    const faturas = [{ _id: 'f3', unidade_consumidora: { numero_uc: { valor: '999' } }, flags: { grupo_a: true }, grupo_a: {} }]
    const alertas = detectarAlertasFaturas(faturas)
    expect(alertas.some(a => a.id.startsWith('fat_demanda'))).toBe(true)
  })
})

describe('S8.8 — agregador, KPIs e filtros', () => {
  // 20) Combina detectores + KPIs
  it('agregarAlertas combina todas as origens', () => {
    const ag = agregarAlertas({
      tecnicos: [{ _id: 'rt1', nome: 'Vencido', ativo: true, validade_carteira_profissional: dias(-10) }],
      equipamentos: [{ _id: 'e1', tipo: 'inversor', fabricante: 'X', modelo: 'Y', aprovacao_tecnica: { status: 'pendente' } }],
      projetos: [{ _id: 'p1', nome: 'Sem RT' }],
      faturas: [{ _id: 'f1', origem: { tipo: 'PDF' }, unidade_consumidora: {} }],
      hoje: HOJE,
    })
    const origens = new Set(ag.map(a => a.origem))
    expect(origens.has('rt')).toBe(true)
    expect(origens.has('catalogo')).toBe(true)
    expect(origens.has('projeto')).toBe(true)
    expect(origens.has('fatura')).toBe(true)
  })

  // 21) KPIs por severidade
  it('calcularKPIs conta por severidade e origem', () => {
    const alertas = [
      { id: 'a', origem: 'rt', severidade: 'critico' },
      { id: 'b', origem: 'catalogo', severidade: 'aviso' },
      { id: 'c', origem: 'projeto', severidade: 'aviso' },
    ]
    const k = calcularKPIs(alertas)
    expect(k.total_ativos).toBe(3)
    expect(k.por_severidade.critico).toBe(1)
    expect(k.por_severidade.aviso).toBe(2)
    expect(k.por_origem.rt).toBe(1)
    expect(k.por_origem.projeto).toBe(1)
  })

  // 22) Status map remove resolvidos do KPI
  it('alertas resolvidos não contam nos KPIs ativos', () => {
    const alertas = [{ id: 'a', origem: 'rt', severidade: 'critico' }, { id: 'b', origem: 'rt', severidade: 'aviso' }]
    const status = new Map([['a', { status: 'resolvido' }]])
    const k = calcularKPIs(alertas, status)
    expect(k.total_ativos).toBe(1)
    expect(k.por_severidade.critico).toBe(0)
  })

  // 23) Filtros: severidade + texto livre
  it('filtrarAlertas: severidade + texto livre + status', () => {
    const alertas = [
      { id: 'a', titulo: 'RT VENCIDO', descricao: 'Eng. João', origem: 'rt', severidade: 'critico', data: HOJE.toISOString() },
      { id: 'b', titulo: 'Catálogo', descricao: 'sem cert', origem: 'catalogo', severidade: 'aviso', data: HOJE.toISOString() },
    ]
    expect(filtrarAlertas(alertas, { severidade: 'critico' }, new Map(), HOJE)).toHaveLength(1)
    expect(filtrarAlertas(alertas, { texto: 'joão' }, new Map(), HOJE)).toHaveLength(1)
    const statusMap = new Map([['a', { status: 'resolvido' }]])
    expect(filtrarAlertas(alertas, { status: 'aberto' }, statusMap, HOJE)).toHaveLength(1)
    expect(filtrarAlertas(alertas, { status: 'resolvido' }, statusMap, HOJE)).toHaveLength(1)
  })

  // 24) Severidades e origens exportadas
  it('exporta enums', () => {
    expect(SEVERIDADES).toEqual(['info', 'aviso', 'erro', 'critico'])
    // S9.0 adicionou 'homologacao' como origem
    expect(ORIGENS).toEqual(['rt', 'catalogo', 'documento', 'projeto', 'fatura', 'homologacao'])
  })
})
