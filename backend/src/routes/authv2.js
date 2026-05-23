import { Router } from 'express'
import {
  login,
  registrar,
  validarToken,
  logout
} from '../controllers/authController.js'

const router = Router()

/**
 * @route   POST /api/auth/login
 * @desc    Login com email e senha
 * @body    { email, senha }
 * @returns { sucesso, usuario, token }
 */
router.post('/login', login)

/**
 * @route   POST /api/auth/registrar
 * @desc    Registrar novo usuário
 * @body    { email, nome, cpf, senha, perfil }
 * @returns { sucesso, usuario, token }
 */
router.post('/registrar', registrar)

/**
 * @route   GET /api/auth/validate
 * @desc    Validar token JWT
 * @headers Authorization: Bearer <token>
 * @returns { sucesso, usuario }
 */
router.get('/validate', validarToken)

/**
 * @route   POST /api/auth/logout
 * @desc    Logout (remove token no cliente)
 * @returns { sucesso, mensagem }
 */
router.post('/logout', logout)

export default router
