import { Router } from 'express'
import {
  listarAtivosProjeto, buscarAtivo, criarAtivo, atualizarAtivo, gerarAtivosDoProjeto,
  consultarPorQr, renderQrSvg, comissionarPorQr,
} from '../controllers/ativosController.js'

// P1-ASSET-CORE-01 — rotas do Gêmeo Digital (backend apenas)
const router = Router()

// P1-ASSET-QR-CODE-01 / COMMISSIONING-01 — por QR (literais antes de /:id)
router.get('/qr/:qr/render.svg', renderQrSvg)
router.post('/qr/:qr/comissionar', comissionarPorQr)
router.get('/qr/:qr',            consultarPorQr)

router.get('/projeto/:id',     listarAtivosProjeto)
router.post('/gerar/:projetoId', gerarAtivosDoProjeto)
router.get('/:id',             buscarAtivo)
router.post('/',               criarAtivo)
router.put('/:id',             atualizarAtivo)

export default router
