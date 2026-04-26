import { Router } from 'express'
import { upload } from '../middleware/upload.js'

const router = Router()

router.post('/fatura', upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ mensagem: 'Nenhum arquivo enviado' })
  res.json({
    mensagem:     'Arquivo recebido com sucesso',
    nomeOriginal: req.file.originalname,
    nomeServidor: req.file.filename,
    tamanhoBytes: req.file.size,
    mimetype:     req.file.mimetype,
  })
})

export default router
