import express from 'express'
import { uploadDatasheet } from '../middleware/uploadDatasheet.js'
import { extrairDadosFatura, debugFatura } from '../controllers/faturaController.js'

const router = express.Router()
// Conta chega em PDF ou foto; o limite é o mesmo do datasheet.
const receberFatura = uploadDatasheet('fatura', 'arquivo')

router.post('/extrair', receberFatura, extrairDadosFatura)
router.post('/debug', receberFatura, debugFatura)

export default router
