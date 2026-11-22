import { describe, it, expect, beforeEach } from 'vitest'
import {
  validarArquivoConta, resumoConta, TAMANHO_MAXIMO_CONTA,
  sanitizarDadosConta, jsonDaConta, markdownDaConta,
} from '../../../backend/src/dominio/cliente/contaEnergia.js'
import { criarContasClienteController } from '../../../backend/src/controllers/contasClienteController.js'
import { exigeTenant } from '../../../backend/src/dominio/tenancy/index.js'

/**
 * Conta de energia do cliente = DADOS, nunca o arquivo (decisão do operador):
 * guarda-se o que a conta diz e dele saem um JSON e um Markdown. Dados
 * fictícios; storage e models falsos.
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

// Só serve às contas ANTIGAS (com arquivo); as novas nunca chegam aqui.
const storage = {
  salvar: async () => { throw new Error('conta nova não grava arquivo') },
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
const req = (empresa_id, params, body) => ({ auth: { empresa_id, id: 'u1' }, params, body })

const EXTRACAO = {
  nome: 'FULANO DE TAL TESTE', cpfCnpj: '111.222.333-44', cpfCnpjMascarado: null,
  numeroCliente: '001.234.567-89', codigoInstalacao: '9988', endereco: 'Rua Fictícia, 100', cep: '59000-000',
  cidade: 'Natal', estado: 'rn', distribuidora: 'COSERN', classificacao: 'B1', subgrupo: 'Residencial',
  tipoLigacao: 'Trifásico 380V', consumoKwh: 384, mediaAnual: 397, valorKwh: 0.95, valorR: 412.3,
  grupoTarifario: 'B', fase: 'Trifásico', tensao: '380', irradiancia: 5.7,
  historico12Meses: [{ mes: 'JAN', consumo: 380, indice: 1 }, { mes: 'FEV', consumo: 410, indice: 2 }],
  campoQualquer: 'não deve entrar', telefone: '84999990000',
}

let db, ctl
beforeEach(() => {
  db = bancoFalso()
  ctl = criarContasClienteController({ Cliente: db.Cliente, ContaEnergiaCliente: db.ContaEnergiaCliente, storage })
})

describe('sanitizarDadosConta — lista fechada', () => {
  it('guarda só o que a conta diz, em nomes de arquivo; CPF/CNPJ e o resto ficam de fora', () => {
    const d = sanitizarDadosConta(EXTRACAO)
    expect(d).toMatchObject({
      nome_titular: 'FULANO DE TAL TESTE', numero_cliente: '001.234.567-89', distribuidora: 'COSERN',
      uf: 'RN', tensao_v: 380, consumo_kwh: 384, media_12_meses_kwh: 397, valor_kwh: 0.95, valor_fatura_reais: 412.3,
    })
    expect(d.historico_12_meses).toEqual([{ mes: 'JAN', consumo_kwh: 380 }, { mes: 'FEV', consumo_kwh: 410 }])
    expect(JSON.stringify(d)).not.toMatch(/111\.222\.333|cpf|campoQualquer|telefone|irradiancia/i)
  })

  it('ausente é omitido — nunca 0 nem vazio; UF inválida e histórico lixo caem', () => {
    const d = sanitizarDadosConta({
      distribuidora: ' ', consumoKwh: null, valorKwh: '', estado: 'Rio Grande',
      historico12Meses: [{ mes: '', consumo: 3 }, { mes: 'MAR', consumo: 'x' }],
    })
    expect(d).toEqual({})
  })

  it('histórico limitado a 12 meses; entrada inválida devolve vazio', () => {
    const hist = Array.from({ length: 20 }, (_, i) => ({ mes: `M${i}`, consumo: i + 1 }))
    expect(sanitizarDadosConta({ historico12Meses: hist }).historico_12_meses).toHaveLength(12)
    for (const v of [null, undefined, 'x', 3]) expect(sanitizarDadosConta(v)).toEqual({})
  })
})

describe('validação do arquivo (contas antigas)', () => {
  it('aceita PDF e imagem; recusa outros formatos, vazio e > 10 MB', () => {
    const pdf = { originalname: 'c.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('x') }
    expect(validarArquivoConta(pdf).ok).toBe(true)
    expect(validarArquivoConta({ ...pdf, mimetype: 'text/plain' })).toMatchObject({ ok: false, status: 415 })
    expect(validarArquivoConta(null)).toMatchObject({ ok: false, status: 400 })
    expect(validarArquivoConta({ ...pdf, size: TAMANHO_MAXIMO_CONTA + 1 })).toMatchObject({ ok: false, status: 413 })
  })

  it('resumo nunca expõe o conteúdo e diz se a conta tem dados ou arquivo', () => {
    const r = resumoConta({ _id: 'k', nome: 'a.pdf', url_storage: 'data:...', document_path: '/x' })
    expect(r).not.toHaveProperty('url_storage')
    expect(r).toMatchObject({ tem_arquivo: true, tem_dados: false })
    expect(resumoConta({ _id: 'k', dados: { uf: 'RN' } })).toMatchObject({ tem_arquivo: false, tem_dados: true })
  })
})

describe('anexar conta = guardar DADOS, nunca o arquivo', () => {
  it('grava só os dados; sem arquivo, sem storage, registro minúsculo', async () => {
    const r = resFalso()
    const pedido = req(EMP_A, { id: 'c1' }, { dados: EXTRACAO })
    pedido.file = { buffer: Buffer.from('%PDF'), size: 4, mimetype: 'application/pdf' }   // se vier, é ignorado
    await ctl.anexar(pedido, r)
    expect(r.statusCode).toBe(201)
    expect(db.contas).toHaveLength(1)
    const c = db.contas[0]
    expect(c).toMatchObject({
      empresa_id: EMP_A, clienteId: 'c1', numero_cliente: '001.234.567-89', distribuidora: 'COSERN',
      document_path: null, url_storage: null,
    })
    expect(c.hash_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(c.tamanho).toBeLessThan(2048)
    expect(JSON.stringify(c)).not.toMatch(/%PDF|111\.222\.333/)
  })

  it('mesma conta duas vezes: devolve a já gravada (200), não duplica', async () => {
    const a = resFalso(); await ctl.anexar(req(EMP_A, { id: 'c1' }, { dados: EXTRACAO }), a)
    const b = resFalso(); await ctl.anexar(req(EMP_A, { id: 'c1' }, { dados: EXTRACAO }), b)
    expect([a.statusCode, b.statusCode]).toEqual([201, 200])
    expect(b.body._id).toBe(a.body._id)
    expect(db.contas).toHaveLength(1)
  })

  it('sem dados aproveitáveis: 400 e nada gravado', async () => {
    const r = resFalso()
    await ctl.anexar(req(EMP_A, { id: 'c1' }, { dados: { campoQualquer: 'x', cpfCnpj: '1' } }), r)
    expect(r.statusCode).toBe(400)
    expect(r.body.codigo).toBe('CONTA_SEM_DADOS')
    expect(db.contas).toHaveLength(0)
  })
})

describe('os dois arquivos saem dos mesmos dados', () => {
  async function gravar() {
    const r = resFalso()
    await ctl.anexar(req(EMP_A, { id: 'c1' }, { dados: EXTRACAO }), r)
    return r.body._id
  }

  it('JSON: anexo com o mesmo conteúdo gravado', async () => {
    const contaId = await gravar()
    const r = resFalso()
    await ctl.baixarJson(req(EMP_A, { id: 'c1', contaId }), r)
    const arquivo = JSON.parse(r.body)
    expect(arquivo.dados).toEqual(db.contas[0].dados)
    expect(arquivo).toMatchObject({ versao: 1, origem: 'conta_de_energia_extraida' })
    expect(r.headers['Content-Type']).toMatch(/application\/json/)
    expect(r.headers['Content-Disposition']).toMatch(/attachment; filename="conta-001\.234\.567-89\.json"/)
  })

  it('Markdown: legível, com UC, consumo e a tabela do histórico — e sem CPF', async () => {
    const contaId = await gravar()
    const r = resFalso()
    await ctl.baixarMarkdown(req(EMP_A, { id: 'c1', contaId }), r)
    expect(r.headers['Content-Type']).toMatch(/text\/markdown/)
    expect(r.headers['Content-Disposition']).toMatch(/\.md"/)
    expect(r.body).toMatch(/^# Conta de energia — UC 001\.234\.567-89/)
    expect(r.body).toMatch(/Distribuidora: COSERN/)
    expect(r.body).toMatch(/Média dos últimos 12 meses: 397 kWh/)
    expect(r.body).toMatch(/\| JAN \| 380 \|/)
    expect(r.body).not.toMatch(/111\.222\.333/)
  })

  it('geração é pura: mesma conta, mesmos bytes', () => {
    const conta = { createdAt: new Date(0), dados: sanitizarDadosConta(EXTRACAO) }
    expect(jsonDaConta(conta)).toBe(jsonDaConta(conta))
    expect(markdownDaConta(conta)).toBe(markdownDaConta(conta))
  })
})

describe('contas antigas (com arquivo) convivem com as novas', () => {
  const legado = () => {
    db.contas.push({
      _id: 'old1', empresa_id: EMP_A, clienteId: 'c1', nome: 'conta.pdf', mimetype: 'application/pdf', tamanho: 22,
      hash_sha256: 'h', storage_provider: 'local', document_path: '/x',
      url_storage: `data:application/pdf;base64,${Buffer.from('%PDF-1.4 antiga').toString('base64')}`, createdAt: new Date(0),
    })
  }

  it('arquivo antigo continua abrindo; não há JSON/MD dele', async () => {
    legado()
    const a = resFalso(); await ctl.baixarArquivo(req(EMP_A, { id: 'c1', contaId: 'old1' }), a)
    expect(a.body.toString()).toBe('%PDF-1.4 antiga')
    const j = resFalso(); await ctl.baixarJson(req(EMP_A, { id: 'c1', contaId: 'old1' }), j)
    expect(j.statusCode).toBe(404)
    expect(j.body.codigo).toBe('CONTA_SEM_DADOS')
  })

  it('conta nova não tem arquivo original: 404 claro, sem tentar o storage', async () => {
    const r1 = resFalso(); await ctl.anexar(req(EMP_A, { id: 'c1' }, { dados: EXTRACAO }), r1)
    const r = resFalso(); await ctl.baixarArquivo(req(EMP_A, { id: 'c1', contaId: r1.body._id }), r)
    expect(r.statusCode).toBe(404)
    expect(r.body.codigo).toBe('SEM_ARQUIVO')
  })

  it('listar mostra as duas, sem conteúdo', async () => {
    legado()
    await ctl.anexar(req(EMP_A, { id: 'c1' }, { dados: EXTRACAO }), resFalso())
    const l = resFalso(); await ctl.listar(req(EMP_A, { id: 'c1' }), l)
    expect(l.body).toHaveLength(2)
    expect(l.body.map((c) => [c.tem_arquivo, c.tem_dados]).sort()).toEqual([[false, true], [true, false]])
    for (const c of l.body) expect(c).not.toHaveProperty('url_storage')
  })
})

describe('ciclo anexar → excluir', () => {
  it('exclui a conta de dados', async () => {
    const r1 = resFalso(); await ctl.anexar(req(EMP_A, { id: 'c1' }, { dados: EXTRACAO }), r1)
    const r4 = resFalso(); await ctl.excluir(req(EMP_A, { id: 'c1', contaId: r1.body._id }), r4)
    expect(r4.statusCode).toBe(204)
    expect(db.contas).toHaveLength(0)
  })
})

describe('isolamento por empresa (M-4)', () => {
  it('ContaEnergiaCliente é classificada como ESCOPO_TENANT', () => {
    expect(exigeTenant('ContaEnergiaCliente')).toBe(true)
  })

  it('empresa B não anexa, não lista, não baixa JSON/MD e não exclui conta do cliente da empresa A', async () => {
    const r1 = resFalso()
    await ctl.anexar(req(EMP_A, { id: 'c1' }, { dados: EXTRACAO }), r1)
    const contaId = r1.body._id

    const a = resFalso(); await ctl.anexar(req(EMP_B, { id: 'c1' }, { dados: EXTRACAO }), a)
    const l = resFalso(); await ctl.listar(req(EMP_B, { id: 'c1' }), l)
    const j = resFalso(); await ctl.baixarJson(req(EMP_B, { id: 'c1', contaId }), j)
    const m = resFalso(); await ctl.baixarMarkdown(req(EMP_B, { id: 'c1', contaId }), m)
    const e = resFalso(); await ctl.excluir(req(EMP_B, { id: 'c1', contaId }), e)
    expect([a.statusCode, l.statusCode, j.statusCode, m.statusCode, e.statusCode]).toEqual([404, 404, 404, 404, 404])
    expect(db.contas).toHaveLength(1)
  })

  it('sem tenant: 403, nada gravado', async () => {
    const r = resFalso()
    await ctl.anexar({ params: { id: 'c1' }, body: { dados: EXTRACAO } }, r)
    expect(r.statusCode).toBe(403)
    expect(db.contas).toHaveLength(0)
  })
})
