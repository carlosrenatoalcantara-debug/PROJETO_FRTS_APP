import { Router } from 'express'
import multer from 'multer'
import {
  listarAtivosProjeto, buscarAtivo, criarAtivo, atualizarAtivo, gerarAtivosDoProjeto,
  consultarPorQr, renderQrSvg, comissionarPorQr, scanEtiqueta,
  salvarMonitoramento, consultarMonitoramento,
} from '../controllers/ativosController.js'

// P1-ASSET-CORE-01 — rotas do Gêmeo Digital (backend apenas)
const router = Router()
const uploadFoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

// P1-ASSET-QR-CODE-01 / COMMISSIONING-01 / SCAN-01 — por QR (literais antes de /:id)
router.get('/qr/:qr/render.svg', renderQrSvg)
router.post('/qr/:qr/comissionar', comissionarPorQr)
router.post('/scan', uploadFoto.single('foto'), scanEtiqueta)   // QR(texto) ou foto→OCR
router.get('/qr/:qr',            consultarPorQr)

// P1-ASSET-MONITORING-REGISTRY-01 — registro de monitoramento por ativo (segredos criptografados)
router.post('/:id/monitoramento', salvarMonitoramento)
router.get('/:id/monitoramento',  consultarMonitoramento)

router.get('/projeto/:id',     listarAtivosProjeto)
router.post('/gerar/:projetoId', gerarAtivosDoProjeto)
router.get('/:id',             buscarAtivo)
router.post('/',               criarAtivo)
router.put('/:id',             atualizarAtivo)

export default router
