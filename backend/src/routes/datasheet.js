import { Router } from 'express'
import multer from 'multer'
import {
  extrairDatasheet,
  criarPainelManual,
  criarInversorManual,
  listarFabricantesAprendidos,
  verificarDuplicata,
  diagnosticoIA,
} from '../controllers/datasheetController.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

router.post('/extrair-datasheet',    upload.single('pdf'), extrairDatasheet)
router.post('/painel',               criarPainelManual)
router.post('/inversor',             criarInversorManual)
router.get('/fabricantes-aprendidos', listarFabricantesAprendidos)
router.get('/diagnostico-ia',        diagnosticoIA)
router.get('/verificar-duplicata',   verificarDuplicata)

export default router
