import { Router } from 'express'
import multer from 'multer'
import {
  listarEquipamentos,
  buscarEquipamento,
  criarEquipamento,
  atualizarEquipamento,
  excluirEquipamento,
  extrairDatasheet,
} from '../controllers/equipamentosController.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/', listarEquipamentos)
router.get('/:id', buscarEquipamento)
router.post('/', criarEquipamento)
router.put('/:id', atualizarEquipamento)
router.delete('/:id', excluirEquipamento)
router.post('/datasheet/extrair', upload.single('pdf'), extrairDatasheet)

export default router
