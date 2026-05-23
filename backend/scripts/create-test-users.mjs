#!/usr/bin/env node

/**
 * Script: Criar usuários de teste para S3.7 multiuser pilot
 * Execução: node scripts/create-test-users.mjs
 */

import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { memoryStore } from '../src/config/memoryStorage.js'

dotenv.config()

// Usuários a criar
const usuarios = [
  {
    email: 'admin@fortesolar.com.br',
    nome: 'Administrador Forte Solar',
    cpf: '00000000000',
    senha: 'admin@2026',
    perfil: 'admin'
  },
  {
    email: 'teste1@fortesolar.com.br',
    nome: 'João Silva',
    cpf: '11111111111',
    senha: 'teste123!',
    perfil: 'user'
  },
  {
    email: 'teste2@fortesolar.com.br',
    nome: 'Maria Santos',
    cpf: '22222222222',
    senha: 'teste123!',
    perfil: 'user'
  }
]

async function criarUsuarios() {
  console.log('[CREATE-USERS] Iniciando criação de usuários...\n')

  try {
    // Try MongoDB connection
    const mongoAvailable = process.env.MONGODB_URI && !process.env.SKIP_MONGODB_RETRIES

    if (mongoAvailable) {
      console.log('[CREATE-USERS] Tentando conectar ao MongoDB Atlas...')
      try {
        await mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000
        })
        console.log('✓ Conectado ao MongoDB Atlas\n')
      } catch (err) {
        console.log('⚠️  MongoDB não disponível, usando memory storage\n')
      }
    } else {
      console.log('[CREATE-USERS] Usando memory storage (fallback)\n')
    }

    // Dinamicamente importar User apenas se MongoDB conectado
    let User = null
    if (mongoose.connection.readyState === 1) {
      const userModule = await import('../src/models/User.js')
      User = userModule.default
    }

    // Criar usuários
    for (const usuarioData of usuarios) {
      try {
        let usuario

        if (User) {
          // MongoDB
          const existe = await User.findOne({ email: usuarioData.email })
          if (existe) {
            console.log(`⚠️  Usuário já existe: ${usuarioData.email}`)
            continue
          }
          usuario = new User(usuarioData)
          await usuario.save()
          console.log(`✓ Criado no MongoDB: ${usuarioData.email}`)
        } else {
          // Memory storage
          const usuarios_existentes = memoryStore.findAll('usuarios') || []
          if (usuarios_existentes.find(u => u.email === usuarioData.email)) {
            console.log(`⚠️  Usuário já existe: ${usuarioData.email}`)
            continue
          }

          const novoUsuario = {
            id: `user-${Date.now()}-${Math.random()}`,
            ...usuarioData,
            ativo: true,
            criado_em: new Date().toISOString(),
            permissoes: {
              criar_projetos: true,
              editar_projetos: true,
              deletar_projetos: usuarioData.perfil === 'admin',
              visualizar_relatorios: true,
              exportar_dados: usuarioData.perfil === 'admin',
              gerenciar_usuarios: usuarioData.perfil === 'admin'
            }
          }

          memoryStore.create('usuarios', novoUsuario)
          console.log(`✓ Criado em memory storage: ${usuarioData.email}`)
        }
      } catch (err) {
        console.error(`✗ Erro ao criar ${usuarioData.email}:`, err.message)
      }
    }

    console.log('\n[CREATE-USERS] ✅ Usuários criados com sucesso!')
    console.log('\nCredenciais de teste:')
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
    console.log('─────────────────────────────────────────────')

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect()
    }

    process.exit(0)
  } catch (err) {
    console.error('[CREATE-USERS] ✗ Erro crítico:', err.message)
    process.exit(1)
  }
}

// Executar
criarUsuarios()
