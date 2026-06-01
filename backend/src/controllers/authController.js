import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { memoryStore } from '../config/memoryStorage.js'
import mongoose from 'mongoose'
import { requireSecret } from '../security/requireSecret.js'

// P0-SEC-HARDENING-FINAL: fail-closed. Sem JWT_SECRET → app não inicia.
const JWT_SECRET = requireSecret('JWT_SECRET')
const JWT_EXPIRY = '7d'

/**
 * Login com email + senha
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, senha } = req.body

    if (!email || !senha) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Email e senha obrigatórios'
      })
    }

    // Try MongoDB first, fallback to memory storage
    let usuario

    if (mongoose.connection.readyState === 1) {
      usuario = await User.findOne({ email })
    } else {
      // Memory storage fallback
      usuario = memoryStore.findUsuarioByEmail(email)
    }

    if (!usuario) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Usuário ou senha inválidos'
      })
    }

    // Compare password
    let senhaValida = false
    if (mongoose.connection.readyState === 1) {
      senhaValida = await usuario.compararSenha(senha)
    } else {
      // Memory storage: simple comparison (should be hashed in production)
      senhaValida = usuario.senha === senha || usuario.senha_hash === senha
    }

    if (!senhaValida) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Usuário ou senha inválidos'
      })
    }

    // Update last login
    if (mongoose.connection.readyState === 1) {
      usuario.ultimo_login = new Date()
      await usuario.save()
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: usuario._id || usuario.id,
        email: usuario.email,
        perfil: usuario.perfil
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    )

    // Return user data (without password)
    const usuarioData = mongoose.connection.readyState === 1
      ? usuario.toJSON()
      : { ...usuario, senha: undefined, senha_hash: undefined }

    res.json({
      sucesso: true,
      usuario: usuarioData,
      token
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao realizar login'
    })
  }
}

/**
 * Registrar novo usuário
 * POST /api/auth/registrar
 */
export async function registrar(req, res) {
  try {
    const { email, nome, cpf, senha, perfil = 'user' } = req.body

    if (!email || !nome || !senha) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Email, nome e senha obrigatórios'
      })
    }

    // Check if user exists
    let usuarioExistente
    if (mongoose.connection.readyState === 1) {
      usuarioExistente = await User.findOne({ email })
    } else {
      usuarioExistente = memoryStore.findUsuarioByEmail(email)
    }

    if (usuarioExistente) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Email já registrado'
      })
    }

    // Create new user
    let usuario
    if (mongoose.connection.readyState === 1) {
      usuario = new User({
        email,
        nome,
        cpf,
        senha_hash: senha,
        perfil
      })
      await usuario.save()
    } else {
      // Memory storage
      usuario = memoryStore.createUsuario({
        email,
        nome,
        cpf,
        senha, // In production, should be hashed
        perfil,
        ativo: true,
        permissoes: {
          criar_projetos: true,
          editar_projetos: true,
          deletar_projetos: false,
          visualizar_relatorios: true,
          exportar_dados: false,
          gerenciar_usuarios: false
        }
      })
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: usuario._id || usuario.id,
        email: usuario.email,
        perfil: usuario.perfil
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    )

    const usuarioData = mongoose.connection.readyState === 1
      ? usuario.toJSON()
      : { ...usuario, senha: undefined, senha_hash: undefined }

    res.status(201).json({
      sucesso: true,
      usuario: usuarioData,
      token
    })
  } catch (err) {
    console.error('Registration error:', err)
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao registrar usuário'
    })
  }
}

/**
 * Validar token JWT
 * GET /api/auth/validate
 */
export function validarToken(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Token não fornecido'
      })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    res.json({
      sucesso: true,
      usuario: decoded
    })
  } catch (err) {
    res.status(401).json({
      sucesso: false,
      erro: 'Token inválido ou expirado'
    })
  }
}

/**
 * Logout (client-side removes token)
 * POST /api/auth/logout
 */
export function logout(req, res) {
  res.json({
    sucesso: true,
    mensagem: 'Logout realizado (remova o token do localStorage)'
  })
}
