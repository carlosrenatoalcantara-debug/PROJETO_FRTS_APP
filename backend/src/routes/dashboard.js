import { Router } from 'express'

const router = Router()

router.get('/resumo', (_req, res) => {
  res.json({
    projetosFVAtivos: 24,
    projetosEVAtivos: 8,
    totalClientes:    137,
    receitaMes:       182000,
  })
})

export default router
