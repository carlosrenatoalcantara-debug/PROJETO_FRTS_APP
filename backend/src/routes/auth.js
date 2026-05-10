import express from 'express'
import jwt from 'jsonwebtoken'
import Usuario from '../models/Usuario.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-super-secreta-aqui'

// Modelo de usuário (se não existir)
const usuarioPadraoDemo = {
  email: 'demo@fortesolar.com.br',
  senha: 'demo123',
  nome: 'Usuário Demo',
  empresa: 'Forte Solar'
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body

    // Validação básica
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' })
    }

    // Para demo, aceitar credenciais padrão
    if (email === usuarioPadraoDemo.email && senha === usuarioPadraoDemo.senha) {
      const token = jwt.sign(
        { email: usuarioPadraoDemo.email, nome: usuarioPadraoDemo.nome },
        JWT_SECRET,
        { expiresIn: '30d' }
      )

      return res.json({
        sucesso: true,
        token,
        usuario: {
          email: usuarioPadraoDemo.email,
          nome: usuarioPadraoDemo.nome,
          empresa: usuarioPadraoDemo.empresa,
        }
      })
    }

    // Procurar no banco (futura implementação)
    // const usuario = await Usuario.findOne({ email })
    // if (!usuario || usuario.senha !== senha) {
    //   return res.status(401).json({ erro: 'Email ou senha incorretos' })
    // }

    res.status(401).json({ erro: 'Email ou senha incorretos' })
  } catch (err) {
    console.error('Erro ao fazer login:', err)
    res.status(500).json({ erro: 'Erro ao processar login' })
  }
})

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ sucesso: true, mensagem: 'Deslogado com sucesso' })
})

// GET /api/auth/verify
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({ erro: 'Sem token' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    res.json({ valido: true, usuario: decoded })
  } catch (err) {
    res.status(401).json({ erro: 'Token inválido' })
  }
})

export default router
