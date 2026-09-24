/**
 * routes/string.js
 *
 * F9: estas quatro rotas estavam PÚBLICAS e `GET /catalogo` devolvia o dataset
 * comercial inteiro — incluindo `precoUnitario` de cada painel e inversor — a
 * qualquer requisição sem autenticação.
 *
 * A auditoria F9 não encontrou nenhum consumidor no frontend para nenhuma das
 * quatro. Exigir token é, portanto, a correção de menor impacto possível:
 * fecha a exposição de preço sem alterar contrato de nenhuma tela existente.
 * Depreciar as rotas seria mudança de contrato de API e ficou fora do escopo.
 *
 * `/api/v1/kits/recomendar` NÃO recebeu o mesmo tratamento: tem consumidor vivo
 * (`BuscaKitsFV.jsx`) que hoje não envia token. Classificada P1 e registrada.
 */
import { Router } from 'express'
import { gerarStrings, validarSistema, recomendarSistema, listarCatalogo } from '../controllers/stringController.js'
import { authenticateToken } from '../security/auth-middleware.js'

const router = Router()

router.get('/catalogo',    authenticateToken, listarCatalogo)
router.post('/strings',    authenticateToken, gerarStrings)
router.post('/validar',    authenticateToken, validarSistema)
router.post('/recomendar', authenticateToken, recomendarSistema)

export default router
