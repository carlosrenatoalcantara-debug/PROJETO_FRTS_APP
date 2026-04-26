import { Router } from 'express'
import {
  listarFunis, criarFunil, atualizarFunil, deletarFunil,
  listarColunas, criarColuna, atualizarColuna, deletarColuna,
  criarLead, listarLeads, obterLead, atualizarLead, moverLead, deletarLead
} from '../controllers/crmController.js'

const router = Router()

// Funis
router.get('/funis', listarFunis)
router.post('/funis', criarFunil)
router.patch('/funis/:id', atualizarFunil)
router.delete('/funis/:id', deletarFunil)

// Colunas
router.get('/colunas', listarColunas)
router.post('/colunas', criarColuna)
router.patch('/colunas/:id', atualizarColuna)
router.delete('/colunas/:id', deletarColuna)

// Leads
router.post('/leads', criarLead)
router.get('/leads', listarLeads)
router.get('/leads/:id', obterLead)
router.patch('/leads/:id', atualizarLead)
router.patch('/leads/:id/mover', moverLead)
router.delete('/leads/:id', deletarLead)

export default router
