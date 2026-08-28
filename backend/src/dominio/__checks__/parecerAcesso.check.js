/**
 * parecerAcesso.check.js — FV-DOM-042
 *
 * Guarda as sete decisões contra regressão silenciosa. Domínio puro + leitura
 * de fonte, sem I/O de banco.
 *
 *   node backend/src/dominio/__checks__/parecerAcesso.check.js
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  normalizarExtracao, validarExtracao, compararComCanonico, montarEnvelope,
  confirmar, envelopeVazio, normalizarModalidadeGD,
  METODOS_EXTRACAO, ESTADOS_PARECER, MODALIDADES_GD_ACEITAS,
  TENSOES_V, TIPOS_LIGACAO, ErroParecer, MOTIVOS_PARECER,
} from '../parecer/index.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
const ler = (rel) => { try { return readFileSync(path.resolve(RAIZ, rel), 'utf8') } catch { return '' } }
const codigo = (rel) => ler(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)

const DOMINIO = 'backend/src/dominio/parecer/index.js'
const SCHEMA = 'backend/src/models/ProjetoFV.js'
const CTRL = 'backend/src/controllers/projetosFVController.js'

const BASE = {
  cliente: { cpf_cnpj: '123.456.789-10', nome: 'FULANO' },
  uc: { numero_cliente: '999', tipo_ligacao: 'Monofásico', tensao_v: 220 },
  geracao: {
    modulos: [{ marca: 'Znshine', modelo: 'ZXM7', potencia_w: 650, quantidade: 24 }],
    inversores: [{ marca: 'Hoymiles', modelo: 'HMS-2000-4T', potencia_kw: 2, quantidade: 8 }],
  },
}

console.log('═══ FV-DOM-042 — Parecer de Acesso ═══')

// ═══ Normalização sem default ══════════════════════════════════════════════
secao('1 · Ausência vira null — nunca valor plausível')
{
  const d = normalizarExtracao({ cliente: { cpf_cnpj: '1' } })
  for (const [caminho, valor] of [
    ['uc.tipo_ligacao', d.uc.tipo_ligacao],
    ['uc.tensao_v', d.uc.tensao_v],
    ['uc.modalidade_gd', d.uc.modalidade_gd],
    ['cliente.email', d.cliente.email],
    ['documento.numero_parecer', d.documento.numero_parecer],
  ]) ok(valor === null, `${caminho} ausente → null`)

  const fonte = codigo(DOMINIO)
  for (const proibido of ["|| 'Monofásico'", '|| 220', "|| 'GD II'", "?? 'Monofásico'"]) {
    ok(!fonte.includes(proibido), `sem default \`${proibido}\``)
  }
  ok(Array.isArray(d.geracao.modulos) && Array.isArray(d.geracao.inversores),
    'geração é sempre LISTA, mesmo vazia')

  // Forma legada (objeto único + quantidade_paineis) é aceita e vira lista.
  const legado = normalizarExtracao({
    cliente: { cpf_cnpj: '1' },
    equipamento: { paineis: { marca: 'Z', modelo: 'M', potencia_w: 650 },
      inversor: { marca: 'H', modelo: 'HMS', potencia_kw: 2, quantidade: 8 },
      quantidade_paineis: 24 },
  })
  ok(legado.geracao.modulos[0]?.quantidade === 24, 'forma legada: quantidade de módulos migra')
  ok(legado.geracao.inversores[0]?.quantidade === 8,
    'e a quantidade de INVERSOR sobrevive — o legado perdia isso')
}

// ═══ Validação ═════════════════════════════════════════════════════════════
secao('2 · Validação em três níveis')
{
  const v = validarExtracao(normalizarExtracao(BASE))
  ok(v.aproveitavel && v.confirmavel, 'extração completa é confirmável')
  ok(v.taxa_completude === undefined, 'sem "taxa de completude"')

  const semId = validarExtracao(normalizarExtracao({ geracao: BASE.geracao }))
  ok(!semId.aproveitavel && semId.impeditivos.length === 1,
    `sem identificação → impeditivo: ${semId.impeditivos[0]}`)

  const semGer = validarExtracao(normalizarExtracao({ cliente: { cpf_cnpj: '1' } }))
  ok(!semGer.aproveitavel, 'sem geração → impeditivo')

  const cpfMau = validarExtracao(normalizarExtracao({ ...BASE, cliente: { cpf_cnpj: '12345678910' } }))
  ok(cpfMau.aproveitavel && !cpfMau.confirmavel, 'CPF sem formatação: bloqueia confirmação')

  const tensaoMa = validarExtracao(normalizarExtracao({ ...BASE,
    uc: { ...BASE.uc, tensao_v: 240 } }))
  ok(!tensaoMa.confirmavel, `tensão fora de ${TENSOES_V.join('/')} bloqueia`)

  const semQtd = validarExtracao(normalizarExtracao({ ...BASE,
    geracao: { modulos: [{ marca: 'Z', modelo: 'M', potencia_w: 650 }], inversores: [] } }))
  ok(!semQtd.confirmavel, 'quantidade ausente bloqueia')
  const qtdZero = validarExtracao(normalizarExtracao({ ...BASE,
    geracao: { modulos: [{ marca: 'Z', modelo: 'M', potencia_w: 650, quantidade: 0 }], inversores: [] } }))
  ok(!qtdZero.confirmavel, 'quantidade zero não é quantidade')

  // Coerência interna.
  const incoerente = validarExtracao(normalizarExtracao({ ...BASE,
    geracao: { ...BASE.geracao, potencia_instalada_kwp: 30 } }))
  ok(incoerente.bloqueios.some((b) => /diverge/.test(b)), 'potência incoerente bloqueia')
  const coerente = validarExtracao(normalizarExtracao({ ...BASE,
    geracao: { ...BASE.geracao, potencia_instalada_kwp: 15.6 } }))
  ok(coerente.confirmavel, '15,6 kWp para 24 × 650 W passa')

  ok(v.lacunas.some((l) => /estrutura/.test(l)),
    'estrutura é sempre lacuna — o parecer não a informa (FV-DOM-039)')
}

// ═══ D3 · GD I ═════════════════════════════════════════════════════════════
secao('3 · D3 — GD I preservado, nunca convertido')
{
  const gd1 = normalizarModalidadeGD('GD I')
  ok(gd1.valor === 'GD I', 'valor preservado')
  ok(gd1.aceita_pelo_dominio === false, 'marcado fora do domínio')
  ok(!!gd1.lacuna, 'com lacuna nomeada')
  const gd2 = normalizarModalidadeGD('GD II')
  ok(gd2.aceita_pelo_dominio === true && gd2.lacuna === null, 'GD II é aceita')
  ok(MODALIDADES_GD_ACEITAS.length === 2, 'o vocabulário aceito não foi ampliado aqui')
  ok(/enum: \['GD II', 'GD III'\]/.test(ler(SCHEMA)), 'nem o enum do schema')

  const v = validarExtracao(normalizarExtracao({ ...BASE,
    uc: { ...BASE.uc, modalidade_gd: 'GD I' } }))
  ok(v.confirmavel, 'GD I não bloqueia a confirmação — é fato do documento')
}

// ═══ D4 · Conflito ═════════════════════════════════════════════════════════
secao('4 · D4 — conflito é declarado, nunca resolvido')
{
  const p = normalizarExtracao(BASE)
  const c = compararComCanonico(p, {
    cliente: { nome: 'OUTRO NOME', cpf_cnpj: null },
    uc: { numero_cliente: '999', tipo_ligacao: 'Trifásico', tensao_v: 380 },
    concessionaria: null,
  })
  ok(c.tem_conflito === true, 'divergência vira conflito')
  const campos = c.conflitos.map((x) => x.campo)
  ok(campos.includes('cliente.nome'), '  ↳ nome divergente')
  ok(campos.includes('uc.tipo_ligacao'), '  ↳ ligação divergente')
  ok(c.iguais.some((x) => x.campo === 'uc.numero_cliente'), 'igual é classificado como igual')
  ok(c.novos.some((x) => x.campo === 'cliente.cpf_cnpj'), 'ausente no projeto vira "novo"')

  // A função não devolve vencedor.
  const fonte = codigo(DOMINIO)
  ok(!/vencedor|prevalece|sobrescrev/i.test(fonte), 'o domínio não elege vencedor')

  // E o controller não escreve fora do envelope.
  const ctrl = codigo(CTRL)
  const bloco = ctrl.slice(ctrl.indexOf('registrarParecerFV'), ctrl.indexOf('obterParecerFV'))
  ok(!/\$set|projeto\.equipamentos\s*=|projeto\.arranjos\s*=|projeto\.fatura_extracao\s*=/.test(bloco),
    'registrar parecer não escreve em equipamentos, arranjos nem fatura')
  ok(/projeto\.parecer_extracao = envelope/.test(bloco), 'escreve SÓ no próprio envelope')
}

// ═══ D5 · Provedor externo ═════════════════════════════════════════════════
secao('5 · D5 — nenhum provedor sem configuração explícita')
{
  let erro = null
  try { montarEnvelope({ bruto: BASE, metodo: 'llm_externo', provedorConfigurado: false }) }
  catch (e) { erro = e }
  ok(erro instanceof ErroParecer && erro.codigo === MOTIVOS_PARECER.PROVEDOR_NAO_CONFIGURADO,
    `llm_externo sem provedor → ${erro?.codigo}`)
  ok(erro?.status === 501, `status ${erro?.status}`)

  let erro2 = null
  try { montarEnvelope({ bruto: BASE, metodo: 'gemini_vision' }) } catch (e) { erro2 = e }
  ok(erro2?.codigo === MOTIVOS_PARECER.METODO_INVALIDO, 'método fora da lista é recusado')

  const fonte = codigo(DOMINIO)
  ok(!/process\.env/.test(fonte), 'o domínio não lê env')
  ok(!/GoogleGenerativeAI|GOOGLE_API_KEY|fetch\(/.test(fonte),
    'não conhece provedor, chave nem faz chamada de rede')
  ok(METODOS_EXTRACAO.includes('manual'), '`manual` é sempre possível, sem provedor')

  // A capacidade é DECLARADA pelo ambiente, não descoberta.
  const ctrl = codigo(CTRL)
  ok(/PARECER_PROVEDOR_EXTERNO === 'habilitado'/.test(ctrl),
    'o controller exige flag explícita, não presença de chave')
  ok(!/GOOGLE_API_KEY/.test(ctrl), 'e não procura credencial alguma')
}

// ═══ D6 · Treino ═══════════════════════════════════════════════════════════
secao('6 · D6 — nenhuma coleta para treino')
{
  for (const [rot, rel] of [['domínio', DOMINIO], ['controller', CTRL]]) {
    ok(!/trainingDataCollector|adicionarExemploTreinamento|training-data/.test(codigo(rel)),
      `${rot} não coleta`)
  }
  ok(!existsSync(path.resolve(RAIZ, 'backend/data/training-data')),
    'nenhum diretório de treino existe')
  ok(/^\s*\/\/\s*app\.use\('\/api\/parecer-acesso'/m.test(ler('backend/src/server.js')),
    'a rota legada continua comentada')
}

// ═══ D7 · Envelope ═════════════════════════════════════════════════════════
secao('7 · D7 — envelope próprio')
{
  const env = envelopeVazio()
  for (const campo of ['metodo', 'confianca', 'confirmado_pelo_usuario', 'estado',
    'numero_parecer', 'emitido_em', 'dados', 'validacao']) {
    ok(campo in env, `envelope tem \`${campo}\``)
  }
  ok(env.confirmado_pelo_usuario === false, 'nasce NÃO confirmado')

  const schema = ler(SCHEMA)
  ok(/parecer_extracao:\s*\{/.test(schema), '`parecer_extracao` no schema')
  ok(/fatura_extracao:\s*\{/.test(schema), '`fatura_extracao` preservada')
  const ctrl = codigo(CTRL)
  ok(!/fatura_extracao\s*=/.test(ctrl.slice(ctrl.indexOf('registrarParecerFV'),
    ctrl.indexOf('confirmarParecerFV'))), 'o parecer nunca escreve na fatura')
}

// ═══ D1 · Estado ═══════════════════════════════════════════════════════════
secao('8 · D1 — identidade e estado')
{
  const env = montarEnvelope({ bruto: { ...BASE, numero_parecer: 'P-1',
    emitido_em: '2026-01-15' }, metodo: 'manual' })
  ok(env.numero_parecer === 'P-1', 'numero_parecer promovido para o topo')
  ok(env.emitido_em instanceof Date, 'emitido_em é Date')
  ok(env.estado === 'extraido', 'nasce `extraido`')
  ok(ESTADOS_PARECER.length === 2, 'dois estados: documento × confirmado')

  const conf = confirmar(env, { usuario: 'ana@x' })
  ok(conf.estado === 'confirmado' && conf.confirmado_pelo_usuario === true, 'confirma')
  ok(conf.confirmado_por === 'ana@x' && conf.confirmado_em instanceof Date, 'registra quem e quando')

  let e2 = null
  try { confirmar(conf) } catch (e) { e2 = e }
  ok(e2?.codigo === MOTIVOS_PARECER.JA_CONFIRMADO, 'não confirma duas vezes')

  let e3 = null
  try { confirmar(envelopeVazio()) } catch (e) { e3 = e }
  ok(e3?.codigo === MOTIVOS_PARECER.SEM_EXTRACAO, 'não confirma envelope vazio')

  // Bloqueio impede confirmar.
  const comBloqueio = montarEnvelope({
    bruto: { ...BASE, uc: { ...BASE.uc, tensao_v: 240 } }, metodo: 'manual' })
  let e4 = null
  try { confirmar(comBloqueio) } catch (e) { e4 = e }
  ok(e4?.codigo === MOTIVOS_PARECER.EXTRACAO_INVALIDA,
    'extração com bloqueio não é confirmável')

  // Estados de deferimento NÃO foram inventados (a FV-UX-040 mediu que não há regra).
  ok(!ESTADOS_PARECER.some((s) => /deferid|aprovad|reprovad/i.test(s)),
    'nenhum estado de deferimento foi inventado')
}

console.log(falhas === 0
  ? '\nOK — sete decisões guardadas; o parecer informa e não decide sozinho.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
