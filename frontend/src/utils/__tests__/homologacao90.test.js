import { describe, it, expect } from 'vitest'
import {
  gerarChecklist, validarDocumentos, montarPacoteDocumental, STATUS_HOMOLOGACAO,
} from '../../../../backend/src/utils/homologacao/homologacaoAssistida.js'
import { obterRegras, CONCESSIONARIAS_COM_REGRAS } from '../../../../backend/src/utils/homologacao/concessionariaProvider.js'
import { detectarAlertasHomologacao } from '../../../../backend/src/utils/alertcenter/alertDetectors.js'

/**
 * Sprint 9.0 — Homologação Assistida.
 * Helpers puros: checklist, validador, pacote, provider de concessionárias.
 */

// Fixtures
const inversorOk = {
  _id: 'inv1', tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN-30K-G04',
  aprovacao_tecnica: { status: 'aprovado' },
  datasheet_original: { hash: 'h1' },
  certificacao: {
    inmetro: { numero: 'INMETRO-123' },
    normas_iec: [{ norma: 'IEC 62116' }],
  },
}
const moduloOk = {
  _id: 'm1', tipo: 'modulo', fabricante: 'Canadian Solar', modelo: 'CS6W-550MS',
  aprovacao_tecnica: { status: 'aprovado' },
  datasheet_original: { hash: 'h2' },
  certificacao: { inmetro: { numero: 'INMETRO-456' } },
}

describe('S9.0 — concessionariaProvider', () => {
  it('Neoenergia exige IEC 62116 e laudo', () => {
    const r = obterRegras('NEOENERGIA')
    expect(r.normas_obrigatorias.inversor).toContain('iec_62116')
    expect(r.documentos_obrigatorios).toContain('laudo_conformidade')
  })

  it('COSERN é mapeado para grupo NEOENERGIA', () => {
    const r = obterRegras('COSERN')
    expect(r.normas_obrigatorias.inversor).toContain('iec_62116')
  })

  it('Equatorial MA cai no grupo EQUATORIAL', () => {
    const r = obterRegras('EQUATORIAL MA')
    expect(r.observacoes).toMatch(/Equatorial/i)
  })

  it('Concessionária desconhecida → regras padrão', () => {
    const r = obterRegras('XYZ-ENERGIA')
    expect(r.documentos_obrigatorios).toContain('datasheet')
    expect(r.normas_obrigatorias.modulo).toContain('inmetro')
  })

  it('Lista de concessionárias suportadas', () => {
    expect(CONCESSIONARIAS_COM_REGRAS).toEqual(['NEOENERGIA', 'EQUATORIAL', 'ENERGISA', 'CPFL', 'CEMIG', 'COPEL'])
  })

  it('STATUS_HOMOLOGACAO tem 7 estados da spec', () => {
    expect(STATUS_HOMOLOGACAO).toEqual([
      'nao_iniciado', 'em_preparacao', 'pendente_documentacao',
      'pendente_engenharia', 'pendente_concessionaria', 'homologado', 'reprovado'
    ])
  })
})

describe('S9.0 — gerarChecklist', () => {
  it('projeto completo + Neoenergia + checklist legado preenchido → apto para envio', () => {
    const projeto = {
      _id: 'p1', nome: 'Projeto OK',
      tecnico_principal_id: 'rt1',
      homologacao: {
        concessionaria: 'COSERN',
        checklist_documentos: {
          memoria_descritivo: true, carta_concessionaria: true, art: true,
          projeto_execucao: true, laudo_conformidade: true,
        },
      },
    }
    const cl = gerarChecklist({
      projeto, equipamentos: [inversorOk, moduloOk], beneficiarias: [],
      concessionaria: 'COSERN',
    })
    expect(cl.resumo.erros).toBe(0)
    expect(cl.resumo.pendentes).toBe(0)
    expect(cl.resumo.apto_para_envio).toBe(true)
  })

  it('projeto sem RT → erro crítico bloqueante', () => {
    const cl = gerarChecklist({ projeto: { _id: 'p2', nome: 'Sem RT' }, equipamentos: [inversorOk], beneficiarias: [] })
    const rt = cl.itens.find(i => i.chave === 'rt_atribuido')
    expect(rt.status).toBe('erro')
    expect(rt.severidade).toBe('critico')
    expect(cl.resumo.apto_para_envio).toBe(false)
  })

  it('equipamento sem datasheet → erro', () => {
    const sem_ds = { ...inversorOk, datasheet_original: null, documentos_tecnicos: [] }
    const cl = gerarChecklist({
      projeto: { _id: 'p3', tecnico_principal_id: 'rt1' },
      equipamentos: [sem_ds], beneficiarias: [],
    })
    const ds = cl.itens.find(i => i.chave === 'datasheets_presentes')
    expect(ds.status).toBe('erro')
    expect(ds.detalhe).toMatch(/sem datasheet/i)
  })

  it('inversor sem INMETRO + Neoenergia → erro de certificação', () => {
    const semInm = { ...inversorOk, certificacao: { normas_iec: [{ norma: 'IEC 62116' }] } }
    const cl = gerarChecklist({
      projeto: { _id: 'p4', tecnico_principal_id: 'rt1' },
      equipamentos: [semInm], beneficiarias: [], concessionaria: 'COSERN',
    })
    const cert = cl.itens.find(i => i.chave === 'cert_inversor_inmetro')
    expect(cert.status).toBe('erro')
  })

  it('rateio ≠ 100% → erro', () => {
    const cl = gerarChecklist({
      projeto: { _id: 'p5', tecnico_principal_id: 'rt1' },
      equipamentos: [inversorOk], beneficiarias: [
        { tipoRateio: 'percentual', valor: 60, ativa: true },
        { tipoRateio: 'percentual', valor: 30, ativa: true },
      ],
    })
    const r = cl.itens.find(i => i.chave === 'rateio_100')
    expect(r.status).toBe('erro')
    expect(r.detalhe).toMatch(/90/)
  })

  it('status sugerido = pendente_engenharia quando faltam certs/RT', () => {
    const cl = gerarChecklist({
      projeto: { _id: 'p6' }, // sem RT
      equipamentos: [inversorOk], beneficiarias: [],
    })
    expect(cl.resumo.status_sugerido).toBe('pendente_engenharia')
  })

  it('projeto congelado sem snapshot_RT → erro', () => {
    const cl = gerarChecklist({
      projeto: {
        _id: 'p7', tecnico_principal_id: 'rt1',
        governanca: { freeze_status: 'CONGELADO' }, // sem snapshot_responsavel_tecnico
      },
      equipamentos: [inversorOk], beneficiarias: [],
    })
    const snap = cl.itens.find(i => i.chave === 'snapshot_rt')
    expect(snap.status).toBe('erro')
  })
})

describe('S9.0 — validarDocumentos', () => {
  it('detecta INMETRO ausente em inversor Neoenergia', () => {
    const semInm = { ...inversorOk, certificacao: { normas_iec: [{ norma: 'IEC 62116' }] } }
    const v = validarDocumentos({ projeto: {}, equipamentos: [semInm], concessionaria: 'COSERN' })
    expect(v.pendencias.some(p => p.tipo === 'inmetro_ausente')).toBe(true)
    expect(v.bloqueantes).toBeGreaterThan(0)
  })

  it('detecta IEC 62116 ausente em Neoenergia', () => {
    const semIec = { ...inversorOk, certificacao: { inmetro: { numero: 'X' }, normas_iec: [] } }
    const v = validarDocumentos({ projeto: {}, equipamentos: [semIec], concessionaria: 'COSERN' })
    expect(v.pendencias.some(p => p.tipo === 'iec_62116_ausente')).toBe(true)
  })

  it('detecta documento vencido', () => {
    const vencido = {
      ...inversorOk,
      documentos_tecnicos: [{ tipo: 'inmetro', validade: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }],
    }
    const v = validarDocumentos({ projeto: {}, equipamentos: [vencido] })
    expect(v.pendencias.some(p => p.tipo === 'documento_vencido')).toBe(true)
  })

  it('projeto limpo + concessionária padrão → 0 pendências', () => {
    const v = validarDocumentos({ projeto: {}, equipamentos: [inversorOk, moduloOk] })
    expect(v.bloqueantes).toBe(0)
  })
})

describe('S9.0 — montarPacoteDocumental (referências, sem cópia)', () => {
  it('pacote inclui referências dos equipamentos com aprovação e certs', () => {
    const pacote = montarPacoteDocumental({
      projeto: { _id: 'p1', nome: 'X', homologacao: { status_homologacao: 'em_preparacao' } },
      equipamentos: [inversorOk, moduloOk], beneficiarias: [], concessionaria: 'COSERN',
    })
    expect(pacote.equipamentos).toHaveLength(2)
    expect(pacote.equipamentos[0].tem_datasheet).toBe(true)
    expect(pacote.equipamentos[0].certificacoes.inmetro).toBe('INMETRO-123')
    expect(pacote.documentos_obrigatorios).toContain('laudo_conformidade')
  })

  it('pacote não duplica documentos — só ids/refs', () => {
    const pacote = montarPacoteDocumental({
      projeto: { _id: 'p2' }, equipamentos: [inversorOk], beneficiarias: [],
    })
    // Não deve haver campo `conteudo_base64` ou similar nos refs
    for (const eq of pacote.equipamentos) {
      expect(eq).not.toHaveProperty('conteudo_base64')
      expect(eq.datasheet_ref).toBe('h1')
    }
  })
})

describe('S9.0 — detectarAlertasHomologacao (AlertCenter)', () => {
  it('projeto apto gera alerta INFO motivacional', () => {
    const projetos = [{ _id: 'p1', nome: 'Apto' }]
    const checklistsPorProjeto = new Map([['p1', {
      resumo: { ok: 5, total: 5, erros: 0, pendentes: 0, apto_para_envio: true, status_atual: 'em_preparacao', status_sugerido: 'em_preparacao' },
      itens: [],
    }]])
    const alertas = detectarAlertasHomologacao(projetos, checklistsPorProjeto)
    expect(alertas.some(a => a.id.startsWith('homolog_apto') && a.severidade === 'info')).toBe(true)
  })

  it('certificação ausente gera alerta ERRO', () => {
    const projetos = [{ _id: 'p2', nome: 'Sem cert' }]
    const checklistsPorProjeto = new Map([['p2', {
      resumo: { ok: 3, total: 5, erros: 1, pendentes: 0, apto_para_envio: false, status_atual: 'em_preparacao', status_sugerido: 'pendente_engenharia' },
      itens: [{ chave: 'cert_inversor_inmetro', titulo: 'Inv. com INMETRO', status: 'erro', detalhe: '1 sem INMETRO' }],
    }]])
    const alertas = detectarAlertasHomologacao(projetos, checklistsPorProjeto)
    expect(alertas.some(a => a.id.startsWith('homolog_cert') && a.severidade === 'erro')).toBe(true)
  })

  it('projeto sem checklist gerado é ignorado', () => {
    const alertas = detectarAlertasHomologacao([{ _id: 'p3' }], new Map())
    expect(alertas).toHaveLength(0)
  })
})
