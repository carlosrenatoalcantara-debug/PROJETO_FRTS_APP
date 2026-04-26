import { Router } from 'express'
import { gerarStrings, validarSistema, recomendarSistema, listarCatalogo } from '../controllers/stringController.js'

const router = Router()

router.get('/catalogo',    listarCatalogo)
router.post('/strings',    gerarStrings)
router.post('/validar',    validarSistema)
router.post('/recomendar', recomendarSistema)

export default router
