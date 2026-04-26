import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pastaUploads = path.join(__dirname, '../../uploads')

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, pastaUploads),
  filename:    (_req, file, cb) => {
    const ext    = path.extname(file.originalname)
    const base   = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_')
    const unique = `${Date.now()}-${base}${ext}`
    cb(null, unique)
  },
})

const filtroArquivos = (_req, file, cb) => {
  const tiposAceitos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (tiposAceitos.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WEBP.'))
  }
}

export const upload = multer({
  storage,
  fileFilter: filtroArquivos,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
})
