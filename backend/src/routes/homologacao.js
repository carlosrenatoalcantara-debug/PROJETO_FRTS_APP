import { Router } from 'express'
import {
  gerarMemorial,
  gerarCarta,
  obterDadosART,
  obterChecklist,
  atualizarChecklist,
  atualizarStatusHomologacao,
  obterStatusHomologacao,
  testarFreezimento,
} from '../controllers/homologacaoController.js'

const router = Router({ mergeParams: true })

// POST para gerar memorial descritivo
router.post('/memorial', gerarMemorial)

// POST para gerar carta à concessionária
router.post('/carta', gerarCarta)

// GET para obter dados para preenchimento de ART
router.get('/art', obterDadosART)

// GET para obter checklist de documentos
router.get('/checklist', obterChecklist)

// PATCH para atualizar checklist
router.patch('/checklist', atualizarChecklist)

// PATCH para atualizar status da homologação
router.patch('/status', atualizarStatusHomologacao)

// GET para obter status atual
router.get('/status', obterStatusHomologacao)

// POST para testar freezimento e ataques
router.post('/test-freeze', testarFreezimento)

export default router
