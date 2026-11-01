/**
 * errorHandler — tratador de último recurso.
 *
 * Emite os TRÊS campos que a aplicação usa (`codigo`, `erro`, `mensagem`).
 * Antes só emitia `mensagem`, e as telas que leem `erro`/`error` — o login
 * entre elas — mostravam um texto genérico para qualquer falha, escondendo a
 * causa de quem precisava dela.
 *
 * 4xx é erro do cliente: a mensagem vai inteira, porque é ela que diz o que
 * corrigir. 5xx é falha nossa, não tratada por nenhum controller: a mensagem
 * pode carregar caminho de arquivo, nome de coleção ou trecho de query, então
 * só o `ref` atravessa. O texto completo fica no log do servidor, sob o mesmo
 * `ref`, e é assim que se liga o que o usuário viu ao que de fato aconteceu.
 */
import crypto from 'crypto'

export default function errorHandler(err, req, res, _next) {
  const status = err.status || 500
  const ref = crypto.randomBytes(4).toString('hex')

  console.error(`[erro ${ref}] ${req.method} ${req.originalUrl} → ${status}`)
  console.error(err.stack || err.message || err)

  if (status >= 500) {
    const generica = 'Erro interno do servidor.'
    return res.status(status).json({
      codigo: err.codigo || 'ERRO_INTERNO',
      erro: generica,
      mensagem: generica,
      ref,
    })
  }

  const texto = err.message || 'Requisição inválida.'
  return res.status(status).json({
    codigo: err.codigo || null,
    erro: texto,
    mensagem: texto,
    ref,
  })
}
