import { Router } from 'express'
import {
  obterPropostaPublica,
  obterPropostaFVPublica,
  aceitarPropostaFVPublica,
} from '../controllers/projetosFVController.js'

/**
 * Rotas PÚBLICAS (sem auth) — S5.
 * Servem apenas leitura de snapshots congelados via token de compartilhamento.
 * Nunca recalculam nada; nunca expõem dados internos (custos/margem/markup).
 */
const router = Router()

router.get('/proposta/:token', obterPropostaPublica)

/**
 * FV-UX-035 — proposta do fluxo canônico: um link por GRUPO, com todas as
 * opções, e o aceite do cliente na própria página. Rota IRMÃ da de cima, não
 * substituta: aquela continua servindo os compartilhamentos do wizard legado.
 *
 * O aceite aqui grava, mas passa pelo MESMO domínio do aceite interno — a
 * escrita sem autenticação é deliberada e limitada a escolher uma opção da
 * proposta que o próprio token identifica.
 */
router.get('/proposta-fv/:token', obterPropostaFVPublica)
router.post('/proposta-fv/:token/aceitar', aceitarPropostaFVPublica)

export default router
