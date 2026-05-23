import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '../../data/memory-storage.json')

// Usuários a adicionar
const usuarios = [
  {
    id: 'user-admin-001',
    email: 'admin@fortesolar.com.br',
    nome: 'Administrador',
    cpf: '00000000000',
    senha: 'admin@2026',
    perfil: 'admin',
    ativo: true,
    criado_em: new Date().toISOString()
  },
  {
    id: 'user-teste-001',
    email: 'teste1@fortesolar.com.br',
    nome: 'João Silva',
    cpf: '11111111111',
    senha: 'teste123!',
    perfil: 'user',
    ativo: true,
    criado_em: new Date().toISOString()
  },
  {
    id: 'user-teste-002',
    email: 'teste2@fortesolar.com.br',
    nome: 'Maria Santos',
    cpf: '22222222222',
    senha: 'teste123!',
    perfil: 'user',
    ativo: true,
    criado_em: new Date().toISOString()
  }
]

try {
  console.log('[ADD-USERS] Adicionando usuários de teste...\n')

  // Ler arquivo atual
  let data = { collections: {}, idCounters: {} }
  if (fs.existsSync(DATA_FILE)) {
    const content = fs.readFileSync(DATA_FILE, 'utf-8')
    data = JSON.parse(content)
  }

  // Adicionar coleção de usuários se não existir
  if (!data.collections.usuarios) {
    data.collections.usuarios = []
  }

  // Adicionar usuários
  for (const usuario of usuarios) {
    const existe = data.collections.usuarios.find(u => u.email === usuario.email)
    if (existe) {
      console.log(`⚠️  Usuário já existe: ${usuario.email}`)
    } else {
      data.collections.usuarios.push(usuario)
      console.log(`✓ Adicionado: ${usuario.email}`)
    }
  }

  // Salvar arquivo
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
  console.log('\n✅ Usuários adicionados com sucesso!\n')

  console.log('Credenciais de teste:')
  console.log('─────────────────────────────────────────────')
  console.log('Admin:')
  console.log('  Email: admin@fortesolar.com.br')
  console.log('  Senha: admin@2026')
  console.log('\nTestador 1:')
  console.log('  Email: teste1@fortesolar.com.br')
  console.log('  Senha: teste123!')
  console.log('\nTestador 2:')
  console.log('  Email: teste2@fortesolar.com.br')
  console.log('  Senha: teste123!')
  console.log('─────────────────────────────────────────────\n')

  process.exit(0)
} catch (err) {
  console.error('✗ Erro:', err.message)
  process.exit(1)
}
