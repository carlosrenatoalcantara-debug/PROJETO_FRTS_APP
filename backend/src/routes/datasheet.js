import { Router } from 'express'
import { uploadDatasheet } from '../middleware/uploadDatasheet.js'
import {
  extrairDatasheet,
  criarPainelManual,
  criarInversorManual,
  listarFabricantesAprendidos,
  verificarDuplicata,
  diagnosticoIA,
} from '../controllers/datasheetController.js'
import { extrairDatasheetMulti } from '../controllers/datasheetMultiController.js'  // P0-INV-01C

const router = Router()

router.post('/extrair-datasheet',    uploadDatasheet(), extrairDatasheet)
router.post('/extrair-multi',        uploadDatasheet(), extrairDatasheetMulti)  // P0-INV-01C
router.post('/painel',               criarPainelManual)
router.post('/inversor',             criarInversorManual)
router.get('/fabricantes-aprendidos', listarFabricantesAprendidos)
router.get('/diagnostico-ia',        diagnosticoIA)
router.get('/verificar-duplicata',   verificarDuplicata)

export default router
