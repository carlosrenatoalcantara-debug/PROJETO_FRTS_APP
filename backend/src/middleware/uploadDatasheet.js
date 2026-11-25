/**
 * Upload em memória com limite (datasheet e conta de energia), com a recusa dita em português.
 *
 * O erro do multer sai como 500 genérico quando ninguém o trata: foi assim que um
 * PDF de 15 MB virou "Erro 500" na tela, sem dizer que o problema era o tamanho.
 */
import multer from 'multer'

export const LIMITE_DATASHEET_MB = 25

const _upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_DATASHEET_MB * 1024 * 1024, files: 1 },
})

export function uploadDatasheet(campo = 'pdf', rotulo = 'PDF') {
  const receber = _upload.single(campo)
  return (req, res, next) => receber(req, res, (err) => {
    if (!err) return next()
    if (!(err instanceof multer.MulterError)) return next(err)
    const grande = err.code === 'LIMIT_FILE_SIZE'
    const erro = grande
      ? `O ${rotulo} passa de ${LIMITE_DATASHEET_MB} MB. Reduza o arquivo e tente de novo.`
      : `Envio inválido: mande um ${rotulo} no campo "${campo}".`
    return res.status(grande ? 413 : 400).json({
      ok: false, sucesso: false, codigo: grande ? 'PDF_GRANDE' : 'ENVIO_INVALIDO', erro, mensagem: erro,
    })
  })
}
