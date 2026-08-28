/**
 * validacao-fv-dom-031.mjs — FV-DOM-031
 *
 * Prova, pela API canônica, que a topologia de microinversores:
 *   1. persiste em `arranjos[].configuracao_eletrica.micros[]` POR MODELO;
 *   2. guarda quantidade, entradas, módulos por entrada e distribuição;
 *   3. sobrevive a salvar → recarregar → editar;
 *   4. NÃO cria MPPT nem strings para micro (decisão 5);
 *   5. preserva a composição da FV-UX-029 e a estrutura da FV-UX-030;
 *   6. aceita modelos MISTOS no mesmo arranjo;
 *   7. não altera dimensionamento, engenharia elétrica nem financeiro.
 *
 * Ambiente isolado (37017). Não toca produção.
 *
 *   node backend/scripts/validacao-fv-dom-031.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { avaliarModeloMicro } from '@fortesolar/fv-shared/engenharia/microinversores'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))
const TOKEN = readFileSync(path.join(RAIZ, '.token-validacao'), 'utf8').trim()
const API = 'http://127.0.0.1:5001'

if (!cred.uri.includes('37017')) { console.error('❌ só no ambiente isolado'); process.exit(1) }

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)

async function api(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  let json = null
  try { json = await r.json() } catch { /* sem corpo */ }
  return { status: r.status, json }
}
const lerProjeto = async (id) => { const r = await api('GET', `/api/projetos-fv/${id}`); return r.json?.projeto ?? r.json }
const salvar = (id, etapa, dados) => api('PUT', `/api/projetos-fv/${id}/etapa`, { etapa, dados })

console.log('═══ FV-DOM-031 — microinversores pela API canônica ═══')

const criado = await api('POST', '/api/projetos-fv', {
  nome: `FV-DOM-031 micro ${Date.now()}`, clienteId: cred.cliente_id,
})
const P = criado.json?._id ?? criado.json?.projeto?._id
ok(!!P, `projeto criado (HTTP ${criado.status}) ${P}`)
if (!P) { console.error(JSON.stringify(criado.json)); process.exit(1) }

// Catálogo real do ambiente.
const cat = await api('GET', '/api/equipamentos?tipo=inversor&limit=200')
const inversores = cat.json?.equipamentos ?? cat.json ?? []
const acha = (modelo) => inversores.find((e) => e.modelo === modelo) ?? null
const MICRO_A = acha('HMS-2000-4T')
const MICRO_B = acha('QS1')
ok(!!MICRO_A && !!MICRO_B, `micros no catálogo: ${MICRO_A?.modelo} · ${MICRO_B?.modelo}`)
if (!MICRO_A || !MICRO_B) { console.error('rode o seed antes'); process.exit(1) }
ok(MICRO_A.especificacoes.entradas === 4 && MICRO_A.especificacoes.modulos_por_entrada === 1,
  `envelope do catálogo: ${MICRO_A.especificacoes.entradas} entradas × ${MICRO_A.especificacoes.modulos_por_entrada}`)

const PAINEL = { id: 'm1', marca: 'Znshine', modelo: 'ZXM7-UHLD144-650/M', potencia_w: 650, quantidade: 22 }
const invComp = (eq, q) => ({ id: String(eq._id), marca: eq.fabricante, modelo: eq.modelo,
  potencia_kw: eq.especificacoes.potencia, tipo: 'micro', fases: 1, quantidade: q,
  equipamento_id: String(eq._id) })

await salvar(P, 'equipamentos', {
  paineis: [PAINEL], inversor: invComp(MICRO_A, 6),
  estrutura: { tipo: 'Fibrocimento', descricao: 'gancho' },
})
await salvar(P, 'dimensionamento', { num_paineis: 22, potencia_kwp: 14.3 })

secao('1 · Composição de micro, com dois modelos (decisões 1 e 8)')
{
  const r = await salvar(P, 'arranjos', {
    lista: [{
      id: 'principal', rotulo: 'Arranjo principal', tipo: 'principal', topologia: 'micro',
      paineis: [PAINEL],
      inversores: [invComp(MICRO_A, 4), invComp(MICRO_B, 2)],
      configuracao_eletrica: {
        micros: [
          { equipamento_id: String(MICRO_A._id), marca: MICRO_A.fabricante, modelo: MICRO_A.modelo,
            quantidade: 4, entradas_por_micro: 4, modulos_por_entrada: 1, distribuicao: [4, 4, 4, 4] },
          { equipamento_id: String(MICRO_B._id), marca: MICRO_B.fabricante, modelo: MICRO_B.modelo,
            quantidade: 2, entradas_por_micro: 3, modulos_por_entrada: 1, distribuicao: [3, 3] },
        ],
      },
    }],
  })
  ok(r.status === 200, `HTTP ${r.status}`)
  const p = await lerProjeto(P)
  const micros = p?.arranjos?.[0]?.configuracao_eletrica?.micros ?? []
  ok(micros.length === 2, `2 modelos persistidos (${micros.length})`)
  ok(micros[0].modelo === 'HMS-2000-4T' && micros[0].quantidade === 4,
    `modelo A: ${micros[0]?.modelo} × ${micros[0]?.quantidade}`)
  ok(micros[1].modelo === 'QS1' && micros[1].quantidade === 2,
    `modelo B: ${micros[1]?.modelo} × ${micros[1]?.quantidade}`)
  ok(micros[0].entradas_por_micro === 4 && micros[1].entradas_por_micro === 3,
    `entradas por modelo: ${micros[0]?.entradas_por_micro} e ${micros[1]?.entradas_por_micro}`)
  ok(JSON.stringify(micros[0].distribuicao) === '[4,4,4,4]',
    `distribuição A: ${JSON.stringify(micros[0]?.distribuicao)}`)
  ok(JSON.stringify(micros[1].distribuicao) === '[3,3]',
    `distribuição B: ${JSON.stringify(micros[1]?.distribuicao)}`)
  const soma = [...micros[0].distribuicao, ...micros[1].distribuicao].reduce((a, b) => a + b, 0)
  ok(soma === 22, `os módulos fecham com a composição: ${soma} de 22`)
}

secao('2 · Nenhum MPPT foi criado para micro (decisão 5)')
{
  const p = await lerProjeto(P)
  const ce = p?.arranjos?.[0]?.configuracao_eletrica ?? {}
  ok(ce.mppts === undefined || ce.mppts === null || ce.mppts.length === 0,
    `configuracao_eletrica.mppts vazio (${JSON.stringify(ce.mppts)})`)
  ok(!p?.engenharia_eletrica?.arranjo?.mppts?.length,
    'engenharia_eletrica.arranjo.mppts continua vazio')
  ok(p?.arranjos?.[0]?.topologia === 'micro', `topologia do arranjo: ${p?.arranjos?.[0]?.topologia}`)
}

secao('3 · Composição e estrutura preservadas (decisões 8 e 9)')
{
  const p = await lerProjeto(P)
  const a = p?.arranjos?.[0]
  ok(a?.paineis?.[0]?.quantidade === 22, `módulos na composição: ${a?.paineis?.[0]?.quantidade}`)
  ok(a?.inversores?.length === 2, `2 modelos de inversor na composição (${a?.inversores?.length})`)
  ok(a?.inversores?.[0]?.quantidade === 4 && a?.inversores?.[1]?.quantidade === 2,
    'quantidades da composição intactas')
  ok(p?.equipamentos?.estrutura?.tipo === 'Fibrocimento',
    `estrutura preservada: ${p?.equipamentos?.estrutura?.tipo}`)
  ok(p?.equipamentos?.estrutura?.descricao === 'gancho', 'descrição da estrutura preservada')
}

secao('4 · Reload → edição → reload mantém a integridade')
{
  const antes = await lerProjeto(P)
  const arranjo = antes.arranjos[0]
  const micros = arranjo.configuracao_eletrica.micros.map((m) => ({ ...m }))
  micros[0].quantidade = 5
  micros[0].distribuicao = [4, 4, 4, 4, 0]
  await salvar(P, 'arranjos', {
    lista: [{ ...arranjo, configuracao_eletrica: { ...arranjo.configuracao_eletrica, micros } }],
  })
  const p = await lerProjeto(P)
  const m = p.arranjos[0].configuracao_eletrica.micros
  ok(m[0].quantidade === 5, `edição gravada: ${m[0].quantidade}`)
  ok(JSON.stringify(m[0].distribuicao) === '[4,4,4,4,0]', `distribuição: ${JSON.stringify(m[0].distribuicao)}`)
  ok(m[1].modelo === 'QS1' && m[1].quantidade === 2, 'o outro modelo não foi tocado')
  ok(p.equipamentos.estrutura.tipo === 'Fibrocimento', 'estrutura ainda intacta')
}

secao('5 · O veredito do motor bate com o dado persistido (decisões 3 e 6)')
{
  const p = await lerProjeto(P)
  const m = p.arranjos[0].configuracao_eletrica.micros[0]
  const esp = MICRO_A.especificacoes
  const r = avaliarModeloMicro({
    modulos: m.distribuicao.reduce((a, b) => a + b, 0), quantidade: m.quantidade,
    micro: { entradas: m.entradas_por_micro, modulos_por_entrada: m.modulos_por_entrada,
      potencia_kw: esp.potencia, oversizing_max: esp.oversizing_max },
    potenciaModuloW: 650,
  })
  // FV-DOM-031B: com distribuição EQUILIBRADA, 16 módulos em 5 micros dão
  // [4,3,3,3,3] — nenhum ocioso, ao contrário do "encher e sobrar", que dava
  // [4,4,4,4,0]. A reprovação passou a ser por oversizing, que é o motivo real.
  ok(JSON.stringify(r.resumo.distribuicao) === '[4,3,3,3,3]',
    `distribuição equilibrada: ${JSON.stringify(r.resumo.distribuicao)}`)
  ok(!r.bloqueios.join(' ').includes('sem nenhum módulo'), 'nenhum micro ficou ocioso')
  ok(r.valido === false, 'reprova pelo micro mais carregado, não por ociosidade')
  ok(r.bloqueios.join(' ').includes('excede o limite'), `motivo: ${r.bloqueios[0]?.slice(0, 70)}`)

  // E o exemplo do enunciado, com o limite do catálogo:
  const enunciado = avaliarModeloMicro({
    modulos: 24, quantidade: 6,
    micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: esp.potencia, oversizing_max: esp.oversizing_max },
    potenciaModuloW: 650,
  })
  ok(enunciado.valido === false, '24 × 650 W em 6 × HMS-2000-4T: REPROVA')
  ok(enunciado.resumo.oversizing_mais_carregado === 1.3 && enunciado.resumo.oversizing_max === 1.25,
    `1,30× contra o limite ${enunciado.resumo.oversizing_max}× do CATÁLOGO`)
}

secao('6 · Nada de dimensionamento, engenharia elétrica ou financeiro mudou')
{
  const p = await lerProjeto(P)
  ok(p?.dimensionamento?.num_paineis === 22, `dimensionamento intacto (${p?.dimensionamento?.num_paineis})`)
  ok(p?.dimensionamento?.potencia_kwp === 14.3, `potência intacta (${p?.dimensionamento?.potencia_kwp})`)
  ok(!p?.engenharia_eletrica?.arranjo?.quantidade_modulos_por_string,
    'nenhuma string foi inventada para o micro')
  ok(JSON.stringify(p?.financeiro ?? {}) === '{}' || p?.financeiro?.payback_anos === undefined,
    'financeiro não foi tocado')
}

console.log(falhas === 0
  ? `\nOK — micro por modelo, com entradas e distribuição, sem MPPT e sem tocar o resto.\n   projeto: ${P}`
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
