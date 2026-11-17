import { describe, it, expect, beforeEach } from 'vitest'
import { validarArquivoConta, resumoConta, TAMANHO_MAXIMO_CONTA } from '../../../backend/src/dominio/cliente/contaEnergia.js'
import { criarContasClienteController } from '../../../backend/src/controllers/contasClienteController.js'
import { exigeTenant } from '../../../backend/src/dominio/tenancy/index.js'

/**
 * Conta de energia anexada ao cliente. Antes o "Anexar conta" só mexia em estado
 * local (setTimeout) e nada era gravado. Dados fictícios; storage e models falsos.
 */
const EMP_A = 'empA', EMP_B = 'empB'
const casa = (doc, filtro) => Object.entries(filtro).every(([k, v]) => String(doc[k]) === String(v))

function bancoFalso() {
  const clientes = [{ _id: 'c1', empresa_id: EMP_A }, { _id: 'c2', empresa_id: EMP_B }]
  const contas = []
  let seq = 0
  const consulta = (lista) => {
    const q = { select: () => q, sort: () => q, then: (ok, ko) => Promise.resolve(lista()).then(ok, ko) }
    return q
  }
  return {
    contas,
    Cliente: { findOne: async (f) => clientes.find((c) => casa(c, f)) || null },
    ContaEnergiaCliente: {
      create: async (d) => { const doc = { _id: `k${++seq}`, createdAt: new Date(0), ...d }; contas.push(doc); return doc },
      find: (f) => consulta(() => contas.filter((c) => casa(c, f))),
      findOne: (f) => consulta(() => contas.find((c) => casa(c, f)) || null),
      findOneAndDelete: async (f) => {
        const i = contas.findIndex((c) => casa(c, f))
        return i < 0 ? null : contas.splice(i, 1)[0]
      },
    },
  }
}

const storage = {
  salvar: async ({ buffer, mimetype }) => ({ storage_provider: 'local', document_path: '/x', url_storage: `data:${mimetype};base64,${buffer.toString('base64')}` }),
  baixar: async (ref) => ({ buffer: Buffer.from(ref.url_storage.split(',').pop(), 'base64'), mimetype: 'application/pdf' }),
}

function resFalso() {
  const r = { statusCode: 200, headers: {}, body: undefined }
  r.status = (c) => { r.statusCode = c; return r }
  r.json = (b) => { r.body = b; return r }
  r.send = (b) => { r.body = b; return r }
  r.end = () => r
  r.setHeader = (k, v) => { r.headers[k] = v }
  return r
}
const req = (empresa_id, params, file) => ({ auth: { empresa_id, id: 'u1' }, params, file })
const pdf = (conteudo = '%PDF-1.4 conta ficticia') => {
  const buffer = Buffer.from(conteudo)
  return { originalname: 'conta.pdf', mimetype: 'application/pdf', size: buffer.length, buffer }
}

let db, ctl
beforeEach(() => {
  db = bancoFalso()
  ctl = criarContasClienteController({ Cliente: db.Cliente, ContaEnergiaCliente: db.ContaEnergiaCliente, storage })
})

describe('validação do arquivo', () => {
  it('aceita PDF e imagem; recusa outros formatos, vazio e > 10 MB', () => {
    expect(validarArquivoConta(pdf()).ok).toBe(true)
    expect(validarArquivoConta({ ...pdf(), mimetype: 'image/jpeg' }).ok).toBe(true)
    expect(validarArquivoConta({ ...pdf(), mimetype: 'text/plain' })).toMatchObject({ ok: false, status: 415 })
    expect(validarArquivoConta(null)).toMatchObject({ ok: false, status: 400 })
    expect(validarArquivoConta({ ...pdf(), size: TAMANHO_MAXIMO_CONTA + 1 })).toMatchObject({ ok: false, status: 413 })
  })

  it('resumo nunca expõe o conteúdo', () => {
    expect(resumoConta({ _id: 'k', nome: 'a.pdf', url_storage: 'data:...' })).not.toHaveProperty('url_storage')
  })
})

describe('ciclo anexar → listar → baixar → excluir', () => {
  it('grava de verdade, lista sem conteúdo, devolve o mesmo arquivo e exclui', async () => {
    const r1 = resFalso()
    await ctl.anexar(req(EMP_A, { id: 'c1' }, pdf()), r1)
    expect(r1.statusCode).toBe(201)
    expect(db.contas).toHaveLength(1)
    expect(db.contas[0]).toMatchObject({ empresa_id: EMP_A, clienteId: 'c1', tamanho: pdf().size })
    expect(db.contas[0].hash_sha256).toMatch(/^[0-9a-f]{64}$/)

    const r2 = resFalso()
    await ctl.listar(req(EMP_A, { id: 'c1' }), r2)
    expect(r2.body).toHaveLength(1)
    expect(r2.body[0]).not.toHaveProperty('url_storage')

    const r3 = resFalso()
    await ctl.baixarArquivo(req(EMP_A, { id: 'c1', contaId: r1.body._id }), r3)
    expect(r3.body.toString()).toBe('%PDF-1.4 conta ficticia')
    expect(r3.headers['Content-Type']).toBe('application/pdf')

    const r4 = resFalso()
    await ctl.excluir(req(EMP_A, { id: 'c1', contaId: r1.body._id }), r4)
    expect(r4.statusCode).toBe(204)
    expect(db.contas).toHaveLength(0)
  })

  it('formato inválido não grava nada', async () => {
    const r = resFalso()
    await ctl.anexar(req(EMP_A, { id: 'c1' }, { ...pdf(), mimetype: 'application/zip' }), r)
    expect(r.statusCode).toBe(415)
    expect(db.contas).toHaveLength(0)
  })
})

describe('isolamento por empresa (M-4)', () => {
  it('ContaEnergiaCliente é classificada como ESCOPO_TENANT', () => {
    expect(exigeTenant('ContaEnergiaCliente')).toBe(true)
  })

  it('empresa B não anexa, não lista, não baixa e não exclui conta do cliente da empresa A', async () => {
    const r1 = resFalso()
    await ctl.anexar(req(EMP_A, { id: 'c1' }, pdf()), r1)
    const contaId = r1.body._id

    const a = resFalso(); await ctl.anexar(req(EMP_B, { id: 'c1' }, pdf()), a)
    const l = resFalso(); await ctl.listar(req(EMP_B, { id: 'c1' }), l)
    const b = resFalso(); await ctl.baixarArquivo(req(EMP_B, { id: 'c1', contaId }), b)
    const e = resFalso(); await ctl.excluir(req(EMP_B, { id: 'c1', contaId }), e)
    expect([a.statusCode, l.statusCode, b.statusCode, e.statusCode]).toEqual([404, 404, 404, 404])
    expect(db.contas).toHaveLength(1)
  })

  it('sem tenant: 403, nada gravado', async () => {
    const r = resFalso()
    await ctl.anexar({ params: { id: 'c1' }, file: pdf() }, r)
    expect(r.statusCode).toBe(403)
    expect(db.contas).toHaveLength(0)
  })
})
