export default function errorHandler(err, _req, res, _next) {
  console.error(err.stack)
  res.status(err.status || 500).json({
    mensagem: err.message || 'Erro interno do servidor',
  })
}
