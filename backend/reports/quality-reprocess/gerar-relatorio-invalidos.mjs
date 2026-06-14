// READ-ONLY — Relatório FASE 5/6 do sprint P0-QUALITY-REPROCESS-01.
// NÃO reprocessa, NÃO altera regras, NÃO usa motor. Apenas LÊ o snapshot
// qualidade.* já persistido pelo endpoint oficial /reprocessar-todos.
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { Equipamento } from '../../src/models/Equipamento.js'

const CATEGORIAS_ALVO = [
  'SEM_ESPECIFICACOES',
  'TIPO_INVALIDO',
  'IMPP_MAIOR_QUE_ISC',
  'ISC_MPPT_IMPLAUSIVEL',
  'MPPT_FAIXA_IMPLAUSIVEL',
]

await conectarBD()
if (mongoose.connection.readyState !== 1) {
  console.error('DB_OFFLINE'); process.exit(1)
}

const invalidos = await Equipamento.find(
  { 'qualidade.nivel': 'invalido' },
  'tipo fabricante modelo origem qualidade.score_global qualidade.nivel qualidade.alertas.codigo qualidade.alertas.severidade'
).lean()

const ehSolarMarket = (eq) => {
  const o = eq.origem || {}
  const blob = `${o.tipo || ''} ${o.fonte || ''} ${o.arquivo_original_url || ''}`.toLowerCase()
  return o.tipo === 'import_solarmarket' || /solarmarket|solar market/.test(blob)
}

const porTipo = {}
const porCategoria = {}
for (const c of CATEGORIAS_ALVO) porCategoria[c] = 0
porCategoria.outros = 0

const lista = invalidos.map(eq => {
  const codigos = [...new Set((eq.qualidade?.alertas || []).map(a => a.codigo))]
  // categoria "dominante" para classificação primária: primeiro código alvo presente
  const alvoPresente = CATEGORIAS_ALVO.filter(c => codigos.includes(c))
  const categoria_primaria = alvoPresente[0] || 'outros'
  porCategoria[categoria_primaria] = (porCategoria[categoria_primaria] || 0) + 1
  porTipo[eq.tipo || '(sem_tipo)'] = (porTipo[eq.tipo || '(sem_tipo)'] || 0) + 1
  return {
    _id: String(eq._id),
    tipo: eq.tipo,
    fabricante: eq.fabricante,
    modelo: eq.modelo,
    score_global: eq.qualidade?.score_global ?? null,
    origem_tipo: eq.origem?.tipo ?? null,
    origem_fonte: eq.origem?.fonte ?? null,
    solarmarket: ehSolarMarket(eq),
    categoria_primaria,
    codigos_alerta: codigos,
  }
})

// Contagem por categoria contando TODAS as ocorrências (um equip pode ter >1 alerta alvo)
const ocorrenciasPorCategoria = {}
for (const c of [...CATEGORIAS_ALVO]) ocorrenciasPorCategoria[c] = 0
let semCategoriaAlvo = 0
for (const item of lista) {
  const alvos = item.codigos_alerta.filter(c => CATEGORIAS_ALVO.includes(c))
  if (alvos.length === 0) semCategoriaAlvo++
  for (const c of alvos) ocorrenciasPorCategoria[c]++
}

const separadoPorTipo = (t) => lista.filter(i => i.tipo === t)

const relatorio = {
  sprint: 'P0-QUALITY-REPROCESS-01',
  fase: '5-6',
  gerado_em: new Date().toISOString(),
  read_only: true,
  total_invalidos_reais: invalidos.length,
  classificacao_primaria: porCategoria,           // cada equip conta 1x na sua categoria dominante
  ocorrencias_por_categoria: ocorrenciasPorCategoria, // soma de alertas (equip pode contar em várias)
  invalidos_sem_categoria_alvo: semCategoriaAlvo,
  por_tipo: porTipo,
  solarmarket: {
    total: lista.filter(i => i.solarmarket).length,
    modulos: separadoPorTipo('modulo').filter(i => i.solarmarket).length,
    inversores: separadoPorTipo('inversor').filter(i => i.solarmarket).length,
    carregadores_ev: separadoPorTipo('carregador_ev').filter(i => i.solarmarket).length,
  },
  separado: {
    modulos: separadoPorTipo('modulo'),
    inversores: separadoPorTipo('inversor'),
    carregadores_ev: separadoPorTipo('carregador_ev'),
    outros: lista.filter(i => !['modulo','inversor','carregador_ev'].includes(i.tipo)),
  },
}

const fs = await import('fs')
const { fileURLToPath } = await import('url')
const path = fileURLToPath(new URL('./QUALITY_INVALIDOS_REAIS.json', import.meta.url))
fs.writeFileSync(path, JSON.stringify(relatorio, null, 2))
console.log('total_invalidos_reais', relatorio.total_invalidos_reais)
console.log('classificacao_primaria', JSON.stringify(relatorio.classificacao_primaria))
console.log('ocorrencias_por_categoria', JSON.stringify(relatorio.ocorrencias_por_categoria))
console.log('por_tipo', JSON.stringify(relatorio.por_tipo))
console.log('solarmarket', JSON.stringify(relatorio.solarmarket))
console.log('arquivo', path)
await mongoose.connection.close()
process.exit(0)
