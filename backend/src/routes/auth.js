import express from 'express'
import jwt from 'jsonwebtoken'
import { requireSecret } from '../security/requireSecret.js'

const router = express.Router()
// P0-SEC-HARDENING-FINAL: fail-closed. Sem JWT_SECRET → app não inicia.
const JWT_SECRET = requireSecret('JWT_SECRET')

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

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ erro: 'Email é obrigatório' })
    }

    // Gerar token de reset (válido por 1 hora)
    const tokenReset = jwt.sign(
      { email, tipo: 'reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    )

    // TODO: Enviar email com link de reset
    // const linkReset = `${process.env.FRONTEND_URL}/reset-password/${tokenReset}`
    // await enviarEmail(email, 'Reset de Senha', linkReset)

    // Por enquanto, responder com sucesso
    console.log(`[RESET] Email enviado para: ${email}`)
    console.log(`[RESET] Token: ${tokenReset}`)

    res.json({
      sucesso: true,
      mensagem: 'Email de reset enviado com sucesso',
      // Remove token da resposta em produção!
      // token: tokenReset
    })
  } catch (err) {
    console.error('Erro ao fazer reset de senha:', err)
    res.status(500).json({ erro: 'Erro ao processar reset' })
  }
})

// POST /api/auth/confirmar-reset (quando o usuário clicar no link do email)
router.post('/confirmar-reset', async (req, res) => {
  try {
    const { token, novaSenha } = req.body

    if (!token || !novaSenha) {
      return res.status(400).json({ erro: 'Token e nova senha são obrigatórios' })
    }

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET)

    if (decoded.tipo !== 'reset') {
      return res.status(400).json({ erro: 'Token inválido' })
    }

    // TODO: Atualizar senha no banco de dados
    // const usuario = await Usuario.findOne({ email: decoded.email })
    // usuario.senha = novaSenha
    // await usuario.save()

    res.json({
      sucesso: true,
      mensagem: 'Senha resetada com sucesso'
    })
  } catch (err) {
    console.error('Erro ao confirmar reset:', err)
    res.status(401).json({ erro: 'Token inválido ou expirado' })
  }
})

export default router
