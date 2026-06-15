import { Router } from 'express'
import {
  listarAtivosProjeto, buscarAtivo, criarAtivo, atualizarAtivo, gerarAtivosDoProjeto,
  consultarPorQr, renderQrSvg,
} from '../controllers/ativosController.js'

// P1-ASSET-CORE-01 — rotas do Gêmeo Digital (backend apenas)
const router = Router()

// P1-ASSET-QR-CODE-01 — consulta/render por QR (literais antes de /:id; somente leitura)
router.get('/qr/:qr/render.svg', renderQrSvg)
router.get('/qr/:qr',            consultarPorQr)

router.get('/projeto/:id',     listarAtivosProjeto)
router.post('/gerar/:projetoId', gerarAtivosDoProjeto)
router.get('/:id',             buscarAtivo)
router.post('/',               criarAtivo)
router.put('/:id',             atualizarAtivo)

export default router
