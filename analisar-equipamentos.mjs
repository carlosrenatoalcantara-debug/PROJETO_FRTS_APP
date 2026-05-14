import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const memoryFile = path.join(__dirname, 'backend/data/memory-storage.json')

let data = { collections: { projetos_ev: [], clientes: [], projetos_fv: [] } }

if (fs.existsSync(memoryFile)) {
  const raw = fs.readFileSync(memoryFile, 'utf-8')
  data = JSON.parse(raw)
  console.log('📂 Dados carregados do memory-storage.json\n')
} else {
  console.log('⚠️ Arquivo memory-storage.json não encontrado')
}

// Buscar equipamentos mencionados nos projetos
console.log('=== EQUIPAMENTOS ENCONTRADOS NOS PROJETOS ===\n')

if (data.collections.projetos_ev && data.collections.projetos_ev.length > 0) {
  console.log('📡 PROJETOS EV (Carregadores):\n')
  data.collections.projetos_ev.forEach((proj, i) => {
    console.log(`${i + 1}. Projeto: ${proj.nome}`)
    if (proj.carregadores && Array.isArray(proj.carregadores)) {
      proj.carregadores.forEach((car, j) => {
        console.log(`   [${j + 1}] ${car.marca || 'Desconhecido'} - ${car.modelo || 'Sem modelo'}`)
        console.log(`       Potência: ${car.potencia_kw}kW, Tipo: ${car.tipo}`)
      })
    }
    console.log('')
  })
}

if (data.collections.projetos_fv && data.collections.projetos_fv.length > 0) {
  console.log('☀️ PROJETOS FV (Solares):\n')
  data.collections.projetos_fv.forEach((proj, i) => {
    console.log(`${i + 1}. Projeto: ${proj.nome}`)
    if (proj.paineis) {
      console.log(`   Paineis: ${proj.paineis}`)
    }
    if (proj.inversor) {
      console.log(`   Inversor: ${proj.inversor}`)
    }
    console.log('')
  })
}

console.log('\n📊 RESUMO:')
console.log(`- Projetos EV: ${data.collections.projetos_ev.length}`)
console.log(`- Projetos FV: ${data.collections.projetos_fv.length}`)
console.log(`- Clientes: ${data.collections.clientes.length}`)
