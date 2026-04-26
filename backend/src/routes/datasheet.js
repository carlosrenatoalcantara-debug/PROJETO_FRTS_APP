import { Router } from 'express'
import multer from 'multer'
import { extrairDatasheet, criarPainelManual, criarInversorManual } from '../controllers/datasheetController.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

router.post('/extrair-datasheet', upload.single('pdf'), extrairDatasheet)
router.post('/painel', criarPainelManual)
router.post('/inversor', criarInversorManual)

export default router
