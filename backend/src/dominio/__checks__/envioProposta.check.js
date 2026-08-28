/**
 * envioProposta.check.js — FV-UX-035
 *
 * Guarda as decisões desta sprint contra regressão silenciosa:
 *
 *   1. o domínio do aceite é ÚNICO — público e interno chamam as mesmas funções;
 *   2. o envio canônico NÃO chama `criarCompartilhamento` do legado, nem aciona
 *      o freeze da governança comercial;
 *   3. a rota legada `/p/:token` e a canônica `/proposta/:token` não se
 *      confundem: uma entrada legada nunca vale como envio de proposta;
 *   4. a regra do aceite não é reimplementada em controller nenhum;
 *   5. totais continuam DERIVADOS (INV-58) — ninguém volta a ler `orc.totais`;
 *   6. o e-mail nunca é afirmado como entregue quando não foi.
 *
 * Domínio puro + leitura de fonte. Sem I/O de banco.
 *
 *   node backend/src/dominio/__checks__/envioProposta.check.js
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  avaliarEnvio, avaliarAceite, ehEnvioCanonico, envioVigente, montarEvidenciaAceite,
  ORIGEM_ENVIO_CANONICO, MOTIVOS_PROPOSTA,
} from '../proposta/index.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(AQUI, '../..')
const ler = (rel) => readFileSync(path.resolve(SRC, rel), 'utf8')
/**
 * Código sem comentário. Um guard que procurasse o nome cru acusaria a própria
 * documentação — "este service NÃO chama `criarCompartilhamento`" contém o
 * nome. O que importa é CHAMADA, não menção.
 */
const codigo = (rel) => ler(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)

console.log('═══ FV-UX-035 — envio e aceite da proposta ═══')

// ═══ 1 · Fronteira com o compartilhamento legado ═══════════════════════════
secao('1 · Uma entrada legada NUNCA vale como envio de proposta')
{
  const grupo = 'aaaaaaaaaaaaaaaaaaaaaaaa'
  const legado = { token: 't', cenario_id: 'C1', snapshot: {} }             // wizard
  const canonicoSemGrupo = { token: 't', origem: ORIGEM_ENVIO_CANONICO }    // marca parcial
  const outroGrupo = { token: 't', origem: ORIGEM_ENVIO_CANONICO, proposta_grupo_id: 'bbbbbbbbbbbbbbbbbbbbbbbb' }
  const bom = { token: 't', origem: ORIGEM_ENVIO_CANONICO, proposta_grupo_id: grupo }

  ok(ehEnvioCanonico(bom, grupo) === true, 'origem + grupo casando = envio canônico')
  ok(ehEnvioCanonico(legado, grupo) === false, 'entrada do wizard legado NÃO é envio')
  ok(ehEnvioCanonico(canonicoSemGrupo, grupo) === false, 'origem sem grupo NÃO basta')
  ok(ehEnvioCanonico(outroGrupo, grupo) === false, 'grupo de OUTRA proposta não vale')

  const e = avaliarEnvio({ grupoId: grupo, compartilhamentos: [legado, outroGrupo] })
  ok(e.enviada === false, 'proposta com só entradas alheias segue NÃO enviada')
}

// ═══ 2 · Vigência ══════════════════════════════════════════════════════════
secao('2 · Envio expirado não sustenta aceite')
{
  const passado = new Date('2020-01-01')
  const futuro = new Date('2099-01-01')
  ok(envioVigente({ validade: futuro }) === true, 'validade no futuro = vigente')
  ok(envioVigente({ validade: passado }) === false, 'validade no passado = vencido')
  ok(envioVigente({ validade: null }) === true, 'sem validade declarada = não expira')
}

// ═══ 3 · A regra do aceite ═════════════════════════════════════════════════
secao('3 · Regras do aceite (as duas origens, a mesma decisão)')
{
  const grupo = 'aaaaaaaaaaaaaaaaaaaaaaaa'
  const opcao = { _id: 'o1', proposta_grupo_id: grupo, proposta_aceite: { aceita: false } }
  const enviada = { enviada: true, vigente: true, ultimo: { share_id: 'S1', snapshot_hash: 'h1' } }

  for (const origem of ['cliente', 'interno']) {
    const r = avaliarAceite({ opcao, irmas: [opcao], envio: enviada, origem })
    ok(r.liberado === true, `${origem}: com envio vigente, libera`)
    const semEnvio = avaliarAceite({ opcao, irmas: [opcao],
      envio: { enviada: false, vigente: false }, origem })
    ok(semEnvio.motivo === MOTIVOS_PROPOSTA.PROPOSTA_NAO_ENVIADA,
      `${origem}: sem envio, ${semEnvio.motivo}`)
    const vencido = avaliarAceite({ opcao, irmas: [opcao],
      envio: { enviada: true, vigente: false }, origem })
    ok(vencido.motivo === MOTIVOS_PROPOSTA.ENVIO_EXPIRADO,
      `${origem}: envio vencido, ${vencido.motivo}`)
  }

  ok(avaliarAceite({ opcao, irmas: [], envio: enviada, origem: 'robo' }).motivo
    === MOTIVOS_PROPOSTA.ORIGEM_INVALIDA, 'origem desconhecida é recusada')
  ok(avaliarAceite({ opcao: { _id: 'x', proposta_aceite: {} }, irmas: [], envio: enviada,
    origem: 'interno' }).motivo === MOTIVOS_PROPOSTA.SEM_GRUPO_DE_PROPOSTA,
  'projeto sem grupo não aceita')

  // Regra 8 da FV-DOM-032 continua valendo.
  const irma = { _id: 'o2', proposta_aceite: { aceita: true }, opcao_rotulo: 'Opção 02' }
  ok(avaliarAceite({ opcao, irmas: [opcao, irma], envio: enviada, origem: 'cliente' }).motivo
    === MOTIVOS_PROPOSTA.PROPOSTA_JA_ACEITA, 'uma só opção aceita por grupo')

  // Idempotência — decisão de negócio explícita.
  const jaAceita = { ...opcao, proposta_aceite: { aceita: true } }
  const rep = avaliarAceite({ opcao: jaAceita, irmas: [jaAceita], envio: enviada, origem: 'cliente' })
  ok(rep.liberado === true && rep.repetido === true, 'reaceitar a MESMA opção é idempotente')

  // Não se aceita o que não foi mostrado.
  const envioComOutras = { enviada: true, vigente: true,
    ultimo: { share_id: 'S1', snapshot: { opcoes: [{ projeto_ref: 'o9' }] } } }
  ok(avaliarAceite({ opcao, irmas: [opcao], envio: envioComOutras, origem: 'cliente' }).motivo
    === MOTIVOS_PROPOSTA.OPCAO_FORA_DO_ENVIO, 'opção fora do envio é recusada')
}

// ═══ 4 · Evidência ═════════════════════════════════════════════════════════
secao('4 · A evidência distingue as origens sem inventar dados')
{
  const envio = { ultimo: { share_id: 'S1', snapshot_hash: 'h1' } }
  const cli = montarEvidenciaAceite({ origem: 'cliente', token: 'tok', ip: '1.2.3.4', envio })
  ok(cli.origem === 'cliente' && cli.token_envio === 'tok' && cli.aceita_por === null,
    'aceite do cliente: token registrado, sem usuário interno')
  const int = montarEvidenciaAceite({ origem: 'interno', usuario: 'ana@x', envio })
  ok(int.origem === 'interno' && int.aceita_por === 'ana@x' && int.token_envio === null,
    'aceite interno: usuário registrado, sem token de cliente')
  ok(cli.share_id === 'S1' && cli.snapshot_hash === 'h1',
    'ambas apontam para o snapshot que estava à vista')
  const semEnvio = montarEvidenciaAceite({ origem: 'interno' })
  ok(semEnvio.share_id === null && semEnvio.snapshot_hash === null,
    'sem envio conhecido, a evidência fica NULA — não inventa')
}

// ═══ 5 · Um domínio só, nenhuma regra reimplementada ═══════════════════════
secao('5 · O aceite não é reimplementado fora do domínio')
{
  const ctrl = ler('controllers/projetosFVController.js')

  // Os DOIS caminhos chamam as MESMAS funções do domínio.
  const interno = ctrl.slice(ctrl.indexOf('export const aceitarOpcaoDaProposta'),
    ctrl.indexOf('export const enviarPropostaFV'))
  const publico = ctrl.slice(ctrl.indexOf('export const aceitarPropostaFVPublica'))
  for (const [rot, trecho] of [['interno', interno], ['público', publico]]) {
    ok(trecho.includes('exigirAceitavel'), `aceite ${rot} chama exigirAceitavel`)
    ok(trecho.includes('montarEvidenciaAceite'), `aceite ${rot} chama montarEvidenciaAceite`)
  }

  // Nenhum dos dois decide por conta própria.
  for (const [rot, trecho] of [['interno', interno], ['público', publico]]) {
    ok(!/proposta_aceite\.aceita'?\s*:\s*true[\s\S]{0,200}?res\.status\(409/.test(trecho),
      `aceite ${rot} não refaz a checagem de "já aceita"`)
    ok(!/aceita:\s*true,\s*\n\s*aceita_em:/.test(trecho),
      `aceite ${rot} não monta a evidência à mão`)
  }
}

// ═══ 6 · O envio canônico não toca o legado ════════════════════════════════
secao('6 · O envio canônico não aciona o freeze legado')
{
  const svc = codigo('services/EnvioPropostaService.js')
  ok(!svc.includes('criarCompartilhamento'),
    'o service NÃO chama `criarCompartilhamento` do legado')
  ok(!/workflow_status|freeze_status|CONGELADOS_COMERCIAL|snapshot_comercial/.test(svc),
    'o service não lê nem escreve o workflow comercial legado')
  ok(svc.includes("$push: { 'governanca.comercial.compartilhamentos'"),
    'mas grava no MESMO array — reuso de token, rota pública e tracking')
  ok(svc.includes('ORIGEM_ENVIO_CANONICO') && svc.includes('proposta_grupo_id: grupoId'),
    'e marca a entrada como canônica e do grupo')

  // A rota legada não foi alterada.
  const rotaLegada = ctrlTrecho('criarCompartilhamento', 'obterPropostaPublica')
  ok(rotaLegada.includes('SEM_SNAPSHOT_CONGELADO'),
    'a rota legada continua exigindo o freeze — intocada')
  ok(!rotaLegada.includes('proposta_grupo_id'),
    'e continua sem conhecer grupo — nada foi enxertado nela')
}
function ctrlTrecho(de, ate) {
  const s = ler('controllers/projetosFVController.js')
  return s.slice(s.indexOf(de), s.indexOf(ate))
}

// ═══ 7 · INV-58 — totais são derivados ═════════════════════════════════════
secao('7 · Totais continuam derivados, nunca lidos de `orc.totais`')
{
  for (const arq of ['services/EnvioPropostaService.js', 'controllers/projetosFVController.js']) {
    ok(!/orc(amento)?\??\.totais\?\./.test(ler(arq)),
      `${arq.split('/').pop()} não lê \`orc.totais\` (que nunca existiu)`)
  }
  ok(ler('services/EnvioPropostaService.js').includes('totaisDeItens('),
    'o envio usa a fórmula canônica `totaisDeItens`')
}

// ═══ 8 · Honestidade sobre o e-mail ════════════════════════════════════════
secao('8 · O e-mail nunca é afirmado sem ter sido enviado')
{
  const svc = ler('services/EnvioPropostaService.js')
  ok(svc.includes('smtp_configurado: smtpConfigurado()'),
    'a resposta declara se o SMTP existe')
  ok(!/enviado:\s*true/.test(svc),
    'o service nunca escreve `enviado: true` por conta própria — quem diz é o transporte')
  ok(/email = \{ enviado: false/.test(svc),
    'sem destinatário, o padrão é `enviado: false` com motivo')
}

console.log(falhas === 0
  ? '\nOK — envio canônico separado do legado; um domínio só para os dois aceites.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
