/**
 * pdfPropostaOpcao.check.js — FV-UX-036
 *
 * Guarda o que a sprint corrigiu no gerador da proposta:
 *
 *   1. o bloco de equipamentos lê o CANÔNICO, com o legado só como fallback;
 *   2. nenhum default fabricado volta para módulo, inversor ou estrutura;
 *   3. a lacuna é declarada em vez de preenchida;
 *   4. o documento identifica a opção;
 *   5. a quantidade de inversores vem de onde ela realmente vive;
 *   6. o gerador não CALCULA nada — só lê e apresenta;
 *   7. o rateio 45/15/25/10/5 % continua intacto (decisão de preservar);
 *   8. o frontend não monta nem recalcula o documento.
 *
 * Domínio puro + leitura de fonte. Sem I/O de banco.
 *
 *   node backend/src/dominio/__checks__/pdfPropostaOpcao.check.js
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(AQUI, '../..')
const RAIZ = path.resolve(SRC, '../..')
const ler = (rel) => { try { return readFileSync(path.resolve(RAIZ, rel), 'utf8') } catch { return '' } }
/** Código sem comentário — a documentação do fix cita os defaults que removeu. */
const codigo = (rel) => ler(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)

const SVC = 'backend/src/services/propostaComercialService.js'
const fonte = codigo(SVC)

console.log('═══ FV-UX-036 — PDF da proposta por opção ═══')

// ═══ 1 · Fonte dos dados ═══════════════════════════════════════════════════
secao('1 · O gerador lê a forma canônica')
{
  for (const [rot, re] of [
    ['`equipamentos` do projeto', /projeto\.equipamentos/],
    ['`dimensionamento.num_paineis`', /dimensionamento\?\.num_paineis/],
  ]) ok(re.test(fonte), `lê ${rot}`)

  /**
   * FV-UX-038 (D1): o gerador NÃO lê mais `arranjos[]` por conta própria — ele
   * delega ao adaptador canônico `composicaoDoProjeto`, que é quem resolve
   * arranjos, legado e contagem de micros. Exigir a leitura direta aqui seria
   * exigir de volta a segunda implementação que a sprint eliminou.
   */
  ok(/composicaoDoProjeto\(projeto\)/.test(fonte),
    'delega a composição ao adaptador canônico')
  ok(!/projeto\.arranjos\?\.\[0\]|arranjo0\?\.inversores/.test(fonte),
    'e não mantém leitura própria de `arranjos[]`')

  // O legado NÃO foi arrancado — o wizard continua produzindo o seu documento.
  for (const [rot, re] of [
    ['`projeto.painel`', /projeto\.painel/],
    ['`projeto.inversor`', /projeto\.inversor/],
    ['`projeto.strings`', /projeto\.strings/],
  ]) ok(re.test(fonte), `mantém o fallback legado ${rot}`)
}

// ═══ 2 · Sem default fabricado ═════════════════════════════════════════════
secao('2 · Nenhum default fabricado de equipamento')
{
  const proibidos = [
    ['quantidade de módulos', /totalModulos\s*\|\|\s*\d+/],
    ['potência do módulo', /pmpp\s*\|\|\s*\d+/],
    ['marca/modelo do módulo', /\|\|\s*'(Marca|Modelo)'/],
    ['potência do inversor', /potenciaKW\s*\|\|\s*\d+/],
    ['fases', /fases\s*\|\|\s*\d+/],
    ['tipo de estrutura', /\|\|\s*'Fibrocimento'/],
    ['garantia', /garantia\w*\s*\|\|\s*\d+/],
  ]
  for (const [rot, re] of proibidos) ok(!re.test(fonte), `não fabrica ${rot}`)

  ok(/Estrutura: \$\{ou\(eq\.estrutura\.garantia/.test(fonte),
    'a garantia da estrutura deixou de ser o literal "10 anos"')
}

// ═══ 3 · Lacuna declarada ══════════════════════════════════════════════════
secao('3 · O que não se sabe é declarado, não preenchido')
{
  ok(/const LACUNA = '—'/.test(fonte), 'existe marca única de lacuna')
  ok(/exibir\s*=\s*\(v, sufixo/.test(fonte),
    'o leitor de equipamentos tem helper próprio (`exibir`)')
  // A colisão que o PDF denunciou: dois `ou` com contratos diferentes.
  const definicoesOu = (fonte.match(/\bconst ou\s*=|\bfunction ou\s*\(/g) ?? []).length
  ok(definicoesOu === 1,
    `um único \`ou\` definido no arquivo (encontrados ${definicoesOu})`)
  ok(!/\$\{ou\([^)]*\(v\) =>/.test(fonte),
    'ninguém passa lambda ao `ou(v, sufixo)` — foi o que imprimiu código no PDF')
}

// ═══ 4 · Identificação da opção ════════════════════════════════════════════
secao('4 · O documento diz de qual opção é')
{
  ok(/function rotuloDaOpcao/.test(fonte), 'existe leitor do rótulo da opção')
  ok(/proposta_grupo_id/.test(fonte), 'o rótulo depende do grupo (FV-DOM-032)')
  ok(/opcao_rotulo/.test(fonte), 'usa `opcao_rotulo` persistido')
  ok(/if \(rotuloOpcao\)/.test(fonte), 'projeto que não é opção NÃO ganha rótulo')
  ok(!/projeto_origem_id/.test(fonte),
    'não usa `projeto_origem_id` para agrupar — proibição explícita da sprint')
}

// ═══ 5 · Quantidade vem de onde ela vive ═══════════════════════════════════
secao('5 · Quantidade de inversores')
{
  // A quantidade vem do adaptador; quem sabe onde ela mora é ELE.
  ok(/qtdInv = invComp\?\.quantidade/.test(fonte),
    'a quantidade vem da composição canônica, não de leitura local')
  const adaptador = codigo('backend/src/services/arranjosService.js')
  ok(/configuracao_eletrica\?\.micros/.test(adaptador),
    'e o adaptador conhece `configuracao_eletrica.micros[]` (FV-DOM-031)')
  ok(/normalizarArranjos\(projeto\)/.test(adaptador),
    'construído sobre `normalizarArranjos` — que já resolve o projeto legado')
  ok(/titulo: ehMicro \? 'Microinversores' : 'Inversor'/.test(fonte),
    'a seção se chama Microinversores quando o projeto é micro')
  ok(/\.\.\.eq\.inversor\.outros/.test(fonte),
    'havendo mais de um modelo, todos são impressos')
}

// ═══ 6 · O gerador não calcula ═════════════════════════════════════════════
secao('6 · O gerador apresenta, não deriva')
{
  const bloco = fonte.slice(fonte.indexOf('function lerEquipamentos'),
    fonte.indexOf('function rotuloDaOpcao'))
  ok(!/\*\s*0\.\d|\/\s*1000|Math\.(pow|round|ceil|floor)/.test(bloco),
    'nenhuma aritmética de engenharia dentro do leitor de equipamentos')
  // Somar UNIDADE não é derivar grandeza de engenharia. São exatamente duas, e
  // as duas contam inversores: a dos `micros[]` e a dos `arranjos[].inversores[]`.
  // Qualquer `reduce` além destes precisa de justificativa — potência, corrente
  // e tensão não se calculam num gerador de PDF.
  // FV-UX-038: as somas saíram daqui junto com a leitura de `arranjos[]` — quem
  // conta agora é o adaptador. O gerador não soma mais nada.
  ok(!/reduce\(/.test(bloco), 'o leitor de equipamentos não soma nada')
  const adaptador2 = codigo('backend/src/services/arranjosService.js')
  ok(!/reduce\([\s\S]{0,80}(tensao|corrente|voc|isc)/i.test(adaptador2),
    'e o adaptador não soma grandeza elétrica — só quantidade')
}

// ═══ 7 · A decisão de preservar o rateio ═══════════════════════════════════
secao('7 · O rateio do investimento continua intacto')
{
  for (const p of ['0.45', '0.15', '0.25', '0.10', '0.05']) {
    ok(fonte.includes(`investimento * ${p}`), `percentual ${p} preservado`)
  }
}

// ═══ 8 · O frontend não recalcula ══════════════════════════════════════════
secao('8 · O frontend só pede e apresenta')
{
  const etapa = codigo('frontend/src/fv/paginas/etapas/EtapaProposta.jsx')
  const clienteApi = codigo('frontend/src/fv/api/agregadosFvApi.js')
  ok(/baixarPdfDaProposta/.test(clienteApi), 'o cliente de API pede o PDF ao backend')
  ok(/proposta\/gerar/.test(clienteApi), 'pelo endpoint que já existia')
  ok(/abrirPdf/.test(etapa), 'a EtapaProposta oferece a ação')
  ok(!/jsPDF|pdfkit|new Blob\(\[.*texto/i.test(etapa),
    'a tela NÃO monta PDF nenhum')
  ok(!/potencia_kwp\s*\*|valor_total_r\s*[*+]/.test(etapa),
    'a tela não recalcula potência nem valor para o documento')
  // Gerar PDF não pode interferir no aceite (regra da FV-UX-035).
  ok(!/abrirPdf[\s\S]{0,400}aceitarOpcao/.test(etapa),
    'gerar o PDF não dispara aceite')
}

console.log(falhas === 0
  ? '\nOK — documento por opção, canônico, sem inventar; rateio e FV-UX-035 intactos.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
