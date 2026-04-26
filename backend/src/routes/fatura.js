import express from 'express'
import multer from 'multer'
import { extrairDadosFatura } from '../controllers/faturaController.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/extrair', upload.single('fatura'), extrairDadosFatura)

export default router
