import express from 'express'
import multer from 'multer'
import { extrairDadosFatura, debugFatura } from '../controllers/faturaController.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/extrair', upload.single('fatura'), extrairDadosFatura)
router.post('/debug', upload.single('fatura'), debugFatura)

export default router
