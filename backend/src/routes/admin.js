import { Router } from 'express'
import {
  importarSolarMarket,
  statusImportacao,
  executarManutencao,
  arquivarLeads,
  compactarDados,
  relatorio,
  removerDuplicatas,
} from '../controllers/adminController.js'
import {
  limparDesconhecidos,
  statusLimpeza,
} from '../controllers/limpezaDesconhecidosController.js'

const router = Router()

// Importação SolarMarket
router.post('/importar-solarmarket', importarSolarMarket)
router.get('/status-importacao', statusImportacao)

// Manutenção do Sistema
router.post('/manutencao', executarManutencao)
router.post('/arquivar-leads', arquivarLeads)
router.post('/compactar-dados', compactarDados)
router.get('/relatorio-win-rate', relatorio)

// Limpeza de Duplicatas
router.post('/remover-duplicatas', removerDuplicatas)

// Limpeza de "Desconhecido"
router.post('/limpar-desconhecidos', limparDesconhecidos)
router.get('/status-limpeza', statusLimpeza)

export default router
