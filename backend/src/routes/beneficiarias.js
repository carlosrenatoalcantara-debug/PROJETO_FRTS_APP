import express from 'express'
import {
  listarBeneficiarias,
  criarBeneficiaria,
  atualizarBeneficiaria,
  deletarBeneficiaria,
  obterResumo,
  importarLote,            // S8.7
  validarRateioPreview,    // S8.7
} from '../controllers/beneficiariasController.js'

const router = express.Router({ mergeParams: true })

// Rotas originais (preservadas intactas)
router.get('/',                   listarBeneficiarias)
router.get('/resumo',             obterResumo)
router.post('/',                  criarBeneficiaria)
router.put('/:beneficiariaId',    atualizarBeneficiaria)
router.delete('/:beneficiariaId', deletarBeneficiaria)

// S8.7: importação em lote + preview de validação
router.post('/lote',              importarLote)
router.post('/validar-rateio',    validarRateioPreview)

export default router
