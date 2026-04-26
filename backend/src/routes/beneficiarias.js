import express from 'express'
import {
  listarBeneficiarias,
  criarBeneficiaria,
  atualizarBeneficiaria,
  deletarBeneficiaria,
  obterResumo,
} from '../controllers/beneficiariasController.js'

const router = express.Router({ mergeParams: true })

router.get('/', listarBeneficiarias)
router.post('/', criarBeneficiaria)
router.put('/:beneficiariaId', atualizarBeneficiaria)
router.delete('/:beneficiariaId', deletarBeneficiaria)
router.get('/resumo', obterResumo)

export default router
