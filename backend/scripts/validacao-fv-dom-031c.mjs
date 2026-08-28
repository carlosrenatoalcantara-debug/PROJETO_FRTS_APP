/**
 * validacao-fv-dom-031c.mjs — FV-DOM-031C
 *
 * Percorre o caminho INTEIRO pela API canônica, num projeto micro e num projeto
 * string, e prova que:
 *   1. o unifilar do micro sai do motor de micro, com `micros[]` como fonte;
 *   2. nenhum MPPT ou string fictício é criado;
 *   3. `arranjoMPPTs` NÃO é lacuna em micro — e CONTINUA sendo em string;
 *   4. o memorial descreve entradas em vez de strings;
 *   5. o unifilar e o memorial de projeto STRING não mudaram;
 *   6. dado ausente vira lacuna nomeada, nunca um módulo genérico.
 *
 * Ambiente isolado (37017).
 *
 *   node backend/scripts/validacao-fv-dom-031c.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'
if (!cred.uri.includes('37017')) { console.error('❌ só no isolado'); process.exit(1) }

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)
const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, { method: metodo, headers: h,
    body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  let json = null
  try { json = await r.json() } catch { /* sem corpo */ }
  return { status: r.status, json }
}
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })
const lerProjeto = async (id) => (await api('GET', `/api/projetos-fv/${id}`)).json?.projeto
  ?? (await api('GET', `/api/projetos-fv/${id}`)).json

console.log('═══ FV-DOM-031C — unifilar e memorial de microinversores ═══')

const inv = (await api('GET', '/api/equipamentos?tipo=inversor&limit=200')).json
const inversores = inv?.equipamentos ?? inv ?? []
const mods = (await api('GET', '/api/equipamentos?tipo=modulo&limit=50')).json
const modulos = mods?.equipamentos ?? mods ?? []
const MICRO_A = inversores.find((e) => e.modelo === 'HMS-2000-4T')
const MICRO_B = inversores.find((e) => e.modelo === 'QS1')
const STRING = inversores.find((e) => e.modelo === 'SG15RT')
const ZN = modulos.find((e) => e.fabricante === 'Znshine')
ok(!!MICRO_A && !!MICRO_B && !!STRING && !!ZN, 'catálogo semeado')
if (!MICRO_A) { console.error('rode o seed antes'); process.exit(1) }

/**
 * FV-UX-034: `POST /homologacao/memorial` passou a exigir o Gate — sem
 * Baseline íntegra o servidor responde 409 SEM_BASELINE. O memorial nunca
 * dependeu do orçamento para o CONTEÚDO; o que mudou foi a permissão para
 * emiti-lo. Aprovar um orçamento aqui só recoloca o projeto na condição em que
 * documento de homologação pode ser emitido — nada do que esta validação mede
 * (topologia, entradas, distribuição, estrutura) vem do orçamento.
 */
async function liberarGate(P) {
  const c = await api('POST', `/api/projetos-fv/${P}/cotacoes`, { tecnologia: 'fv', premissas: {} })
  const cid = c.json?.cotacao?._id ?? c.json?._id
  const o = await api('POST', `/api/projetos-fv/${P}/orcamentos`, { cotacao_ref: cid,
    itens: [{ descricao: 'kit', quantidade: 1, valor_unitario_r: 50000, valor_total_r: 50000 }] })
  const oid = o.json?.orcamento?._id ?? o.json?._id
  await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/emitir`, {})
  return (await api('POST', `/api/projetos-fv/${P}/orcamentos/${oid}/aprovar`, {})).status
}

async function criar(nome) {
  const r = await api('POST', '/api/projetos-fv', { nome: `${nome} ${Date.now()}`, clienteId: cred.cliente_id })
  return r.json?._id ?? r.json?.projeto?._id
}
const painel = (q) => ({ id: String(ZN._id), marca: 'Znshine', modelo: ZN.modelo,
  potencia_w: 650, quantidade: q, equipamento_id: String(ZN._id) })
const comp = (eq, q, tipo) => ({ id: String(eq._id), marca: eq.fabricante, modelo: eq.modelo,
  potencia_kw: eq.especificacoes.potencia, tipo, fases: eq.especificacoes.fases,
  quantidade: q, equipamento_id: String(eq._id) })

// ── Projeto MICRO ───────────────────────────────────────────────────────────
const PM = await criar('FV-DOM-031C micro')
await salvar(PM, 'dimensionamento', { num_paineis: 22, potencia_kwp: 14.3 })
await salvar(PM, 'equipamentos', { paineis: [painel(22)], inversor: comp(MICRO_A, 4, 'micro'),
  estrutura: { tipo: 'Fibrocimento', descricao: 'gancho' } })
await salvar(PM, 'fatura', { tipo_ligacao: 'Monofásico', tensao_v: 220, concessionaria: 'Neoenergia' })
await salvar(PM, 'localizacao', { estado: 'RN' })
await salvar(PM, 'arranjos', { lista: [{
  id: 'principal', rotulo: 'Arranjo principal', tipo: 'principal', topologia: 'micro',
  paineis: [painel(22)], inversores: [comp(MICRO_A, 4, 'micro'), comp(MICRO_B, 2, 'micro')],
  configuracao_eletrica: { micros: [
    { equipamento_id: String(MICRO_A._id), marca: MICRO_A.fabricante, modelo: MICRO_A.modelo,
      quantidade: 4, entradas_por_micro: 4, modulos_por_entrada: 1, distribuicao: [4, 4, 4, 4] },
    { equipamento_id: String(MICRO_B._id), marca: MICRO_B.fabricante, modelo: MICRO_B.modelo,
      quantidade: 2, entradas_por_micro: 3, modulos_por_entrada: 1, distribuicao: [3, 3] },
  ] },
}] })

secao('1 · Unifilar do projeto MICRO')
const uMicro = (await api('POST', `/api/projetos-fv/${PM}/unifilar/gerar`, {})).json
const svgM = uMicro?.svg ?? ''
{
  ok(svgM.length > 0, `SVG gerado (${svgM.length} bytes)`)
  ok(svgM.includes('MICROINVERSORES'), 'saiu do motor de MICRO, não do de string')
  ok(uMicro?.especificacoes?.topologia === 'micro', `especificacoes.topologia = ${uMicro?.especificacoes?.topologia}`)
  ok(uMicro?.especificacoes?.num_microinversores === 6,
    `6 microinversores (${uMicro?.especificacoes?.num_microinversores})`)
  ok(uMicro?.especificacoes?.num_paineis === 22, `22 módulos (${uMicro?.especificacoes?.num_paineis})`)
  ok(uMicro?.especificacoes?.potencia_ca_kw === 11.2,
    `CA = 4×2,0 + 2×1,6 = ${uMicro?.especificacoes?.potencia_ca_kw} kW`)
  ok(!('num_strings' in (uMicro?.especificacoes ?? {})) && !('num_mppts' in (uMicro?.especificacoes ?? {})),
    'nem `num_strings` nem `num_mppts` nas especificações — não existem nesta topologia')
}

secao('2 · Nenhum MPPT ou string fictício')
{
  ok((svgM.match(/mppt/gi) ?? []).length === 1 && svgM.includes('sem MPPT, sem strings'),
    'MPPT aparece apenas para declarar a ausência')
  const p = await lerProjeto(PM)
  ok(!p?.engenharia_eletrica?.arranjo?.mppts?.length, 'nada foi gravado em `engenharia_eletrica.arranjo`')
  ok(!p?.arranjos?.[0]?.configuracao_eletrica?.mppts, 'nada foi gravado em `configuracao_eletrica.mppts`')
}

secao('3 · Lacunas por topologia (item 3)')
{
  const lac = uMicro?.lacunas ?? []
  ok(!lac.includes('arranjoMPPTs'), `MICRO não exige arranjoMPPTs (${JSON.stringify(lac)})`)
  ok(uMicro?.proveniencia?.topologiaMicro === 'arranjos[].configuracao_eletrica.micros',
    `proveniência própria: ${uMicro?.proveniencia?.topologiaMicro}`)
  ok(!('arranjoMPPTs' in (uMicro?.proveniencia ?? {})), 'a chave nem existe na proveniência do micro')
}

secao('4 · O desenho representa o que a sprint pediu')
for (const [rotulo, esperado] of [
  ['módulos e quantidade', '22 módulos'],
  ['quantidade de micros', '6 microinversores'],
  ['fabricante/modelo', 'Hoymiles HMS-2000-4T'],
  ['segundo modelo', 'APsystems QS1'],
  ['distribuição', '4/4/4/4'],
  ['conexão CA', 'barramento CA'],
  ['estrutura', 'Fibrocimento'],
  ['rede', 'Neoenergia'],
]) {
  ok(svgM.includes(esperado), `${rotulo}: \`${esperado}\``)
}
ok((svgM.match(/MI-\d/g) ?? []).length === 6, 'um símbolo por microinversor')

secao('5 · Memorial do projeto MICRO')
{
  ok(await liberarGate(PM) === 200, 'orçamento aprovado — Gate liberado')
  const p = await lerProjeto(PM)
  const r = await api('POST', `/api/projetos-fv/${PM}/homologacao/memorial`, {
    projeto: { ...p, potencia_kwp: 14.3, estrutura: p.equipamentos.estrutura,
      inversor: { marca: MICRO_A.fabricante, modelo: MICRO_A.modelo, potenciaKW: 2, fases: 1 },
      painel: { marca: 'Znshine', modelo: ZN.modelo, potenciaW: 650 } },
    cliente: { nome: 'Cliente de Validação' },
  })
  const texto = r.json?.conteudo ?? ''
  ok(r.status === 200 && texto.length > 0, `memorial gerado (HTTP ${r.status}, ${texto.length} bytes)`)
  ok(texto.includes('5. ARRANJO DOS MICROINVERSORES'), 'seção 5 é de microinversores')
  ok(!texto.includes('Strings em paralelo conectadas ao inversor'), 'sem o texto de strings')
  ok(texto.includes('cada módulo conectado a uma entrada independente'), 'descreve entradas')
  ok(texto.includes('Total de Microinversores: 6'), 'total de micros correto')
  ok(texto.includes('Hoymiles HMS-2000-4T: 4 un. × 4 entradas'), 'modelo A descrito')
  ok(texto.includes('APsystems QS1: 2 un. × 3 entradas'), 'modelo B descrito')
  ok(texto.includes('Módulos por microinversor: 4 / 4 / 4 / 4'), 'distribuição no memorial')
  ok(texto.includes('6. COMPONENTES - MICROINVERSORES'), 'seção 6 é de microinversores')
  ok(texto.includes('Entradas CC por Microinversor: 4') && !texto.includes('Número de MPPT'),
    'entradas CC no lugar de MPPT')
  ok(texto.includes('Tipo: Fibrocimento'), 'a estrutura da FV-UX-030 continua no memorial')
}

// ── Projeto STRING — controle ───────────────────────────────────────────────
const PS = await criar('FV-DOM-031C string')
await salvar(PS, 'dimensionamento', { num_paineis: 24, potencia_kwp: 15.6 })
await salvar(PS, 'equipamentos', { paineis: [painel(24)], inversor: comp(STRING, 1, 'string') })
await salvar(PS, 'fatura', { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'Neoenergia' })
await salvar(PS, 'localizacao', { estado: 'RN' })
await salvar(PS, 'arranjos', { lista: [{ id: 'principal', tipo: 'principal',
  paineis: [painel(24)], inversores: [comp(STRING, 1, 'string')] }] })

secao('6 · Projeto STRING — nada mudou')
{
  const u = (await api('POST', `/api/projetos-fv/${PS}/unifilar/gerar`, {})).json
  ok(!(u?.svg ?? '').includes('MICROINVERSORES'), 'saiu do motor de STRING')
  ok((u?.lacunas ?? []).includes('arranjoMPPTs'),
    `STRING sem topologia MPPT CONTINUA exigindo arranjoMPPTs (${JSON.stringify(u?.lacunas)})`)
  ok(u?.especificacoes?.num_strings !== undefined && u?.especificacoes?.num_mppts !== undefined,
    'as especificações de string continuam presentes')
  ok(u?.especificacoes?.topologia === undefined, 'o caminho string não ganhou campo novo')

  // Com topologia MPPT, a lacuna some — como sempre foi.
  await salvar(PS, 'engenharia_eletrica', { arranjo: { num_mppts_usados: 2,
    mppts: [{ mppt: 1, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 },
      { mppt: 2, strings_paralelo: 1, modulos_por_string: 12, total_modulos: 12 }] } })
  const u2 = (await api('POST', `/api/projetos-fv/${PS}/unifilar/gerar`, {})).json
  ok(!(u2?.lacunas ?? []).includes('arranjoMPPTs'), 'com MPPT gravado, a lacuna some')
  ok((u2?.svg ?? '').includes('MPPT'), 'o desenho de string continua desenhando MPPT')

  ok(await liberarGate(PS) === 200, 'orçamento aprovado — Gate liberado')
  const p = await lerProjeto(PS)
  const r = await api('POST', `/api/projetos-fv/${PS}/homologacao/memorial`, {
    projeto: { ...p, potencia_kwp: 15.6, strings: { totalStrings: 2, modulosPorString: 12, totalModulos: 24 },
      inversor: { marca: STRING.fabricante, modelo: STRING.modelo, potenciaKW: 15, fases: 3, nMppts: 3 },
      painel: { marca: 'Znshine', modelo: ZN.modelo, potenciaW: 650 } },
    cliente: { nome: 'Cliente de Validação' },
  })
  const texto = r.json?.conteudo ?? ''
  ok(texto.includes('5. ARRANJO DAS STRINGS'), 'memorial de string intacto')
  ok(texto.includes('Configuração DC: Strings em paralelo conectadas ao inversor'), 'texto original preservado')
  ok(texto.includes('Número de MPPT: 3'), 'MPPT continua no memorial de string')
  ok(!texto.includes('MICROINVERSORES'), 'sem contaminação de micro')
}

secao('7 · Elétricos do módulo vêm do catálogo pela SSOT (FV-DOM-031D)')
{
  // Na FV-DOM-031C estes quatro eram LACUNA: o adapter não tinha como alcançar
  // `Equipamento.especificacoes`. A FV-DOM-031D promoveu o leitor de módulo para
  // `fv-shared/modulos` e o controller passa o equipamento — os valores agora
  // chegam, e a lacuna some por ter sido RESOLVIDA, não por ter sido escondida.
  const lac = uMicro?.lacunas ?? []
  const doModulo = lac.filter((l) => l.startsWith('modulo.'))
  ok(doModulo.length === 0, `sem lacunas de módulo (${JSON.stringify(doModulo)})`)
  ok(!/49\.5|41\.2|13\.9/.test(svgM), 'o desenho NÃO usou os genéricos 49,5 / 41,2 / 13,9')
  const e = uMicro?.especificacoes ?? {}
  ok(e.voc_entrada_v !== null && e.voc_entrada_v > 45 && e.voc_entrada_v < 55,
    `Voc por entrada (1 módulo de 45,5 V): ${e.voc_entrada_v} V`)
  ok(e.isc_entrada_a !== null && Math.abs(e.isc_entrada_a - 18.35 * 1.25) < 0.01,
    `Isc por entrada = Isc_stc × 1,25: ${e.isc_entrada_a} A`)
  ok(e.dps !== null, `DPS dimensionado pelo Voc real: ${e.dps?.modelo}`)
}

console.log(falhas === 0
  ? `\nOK — micro desenhado e descrito por entradas; string intacto.\n   micro: ${PM}\n   string: ${PS}`
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
