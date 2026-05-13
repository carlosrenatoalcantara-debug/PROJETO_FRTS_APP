import 'dotenv/config'
import express from 'express'
import cors from 'cors'
// Restart trigger
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from './config/database.js'
import { conectarBD } from './config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import { inicializarCRM } from './seeds/crmInitialData.js'
import { agendarTarefasManutencao } from './utils/arquivamentoPolicy.js'
import rotasClientes   from './routes/clientes.js'
import rotasProjetosFV from './routes/projetosFV.js'
import rotasProjetosEV from './routes/projetosEV.js'
import rotasDashboard  from './routes/dashboard.js'
import rotasUpload      from './routes/upload.js'
import rotasEquipamentos from './routes/equipamentos.js'
import rotasEngenharia   from './routes/engenharia.js'
import rotasString       from './routes/string.js'
import rotasCarga        from './routes/carga.js'
import rotasBESS         from './routes/bess.js'
import rotasFinanceiro   from './routes/financeiro.js'
import rotasOrcamento    from './routes/orcamento.js'
import rotasCRM          from './routes/crm.js'
import rotasProjeto      from './routes/projeto.js'
import rotasRecomendacao from './routes/recomendacao.js'
import rotasDecisao      from './routes/decisao.js'
import rotasDatasheet    from './routes/datasheet.js'
import rotasAdmin        from './routes/admin.js'
import rotasUnifilar     from './routes/unifilar.js'
import rotasIrradiancia  from './routes/irradiancia.js'
import rotasHomologacao  from './routes/homologacao.js'
import rotasProposta     from './routes/proposta.js'
import rotasFatura       from './routes/fatura.js'
import rotasBeneficiarias from './routes/beneficiarias.js'
import rotasAuth         from './routes/auth.js'
import rotasCalculadora  from './routes/calculadora.js'
import rotasCarregadoresEV from './routes/carregadoresEV.js'
import rotasParecerAcesso from './routes/pareceracesso.js'
import errorHandler      from './middleware/errorHandler.js'

const app  = express()
const PORT = process.env.PORT || 5001

// Configuração CORS com mais detalhes
const corsOptions = {
  origin: (origin, callback) => {
    // Permite localhost em qualquer porta (3000, 3001, 3005, etc.)
    // e também produção se necessário
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://localhost:3006',
      'http://localhost:3007',
      'http://localhost:3008',
      'http://127.0.0.1:3000',
      'https://projeto-frts-app.vercel.app',
    ]

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.warn(`⚠️ CORS: Origem rejeitada: ${origin}`)
      callback(null, false)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))
// Aumentar limite de payload para aceitar PDFs grandes (até 50MB)
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Header CORS explícito como fallback
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin === 'https://projeto-frts-app.vercel.app' || origin?.includes('localhost')) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  }
  next()
})

// Log de requisições para debug
app.use((req, res, next) => {
  console.log(`📍 ${req.method} ${req.path}`)
  next()
})

app.use('/api/health', (_req, res) => {
  const mongoState = ['desconectado', 'conectando', 'conectado', 'desconectando']
  const estado = mongoose.connection.readyState
  res.json({
    status: 'ok',
    servico: 'Forte Solar API',
    mongodb: mongoState[estado] || 'desconhecido',
    mongodbState: estado,
  })
})

app.use('/api/reconectar', async (_req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      return res.json({ status: 'já conectado' })
    }
    await mongoose.disconnect()
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    })
    res.json({ status: 'conectado com sucesso' })
  } catch (erro) {
    res.status(500).json({ status: 'falhou', erro: erro.message })
  }
})
app.use('/api/auth',         rotasAuth)
app.use('/api/calculadora',  rotasCalculadora)
app.use('/api/carregadores-ev', rotasCarregadoresEV)
app.use('/api/dashboard',    rotasDashboard)
app.use('/api/clientes',     rotasClientes)
app.use('/api/projetos-fv',  rotasProjetosFV)
app.use('/api/projetos-ev',  rotasProjetosEV)
app.use('/api/upload',       rotasUpload)
app.use('/api/equipamentos', rotasEquipamentos)
app.use('/api/engenharia',   rotasEngenharia)
app.use('/api/string',       rotasString)
app.use('/api/carga',        rotasCarga)
app.use('/api/bess',         rotasBESS)
app.use('/api/financeiro',   rotasFinanceiro)
app.use('/api/orcamento',    rotasOrcamento)
app.use('/api/crm',          rotasCRM)
app.use('/api/projeto',      rotasProjeto)
app.use('/api/recomendacao', rotasRecomendacao)
app.use('/api/decisao',      rotasDecisao)
app.use('/api/datasheet',    rotasDatasheet)
app.use('/api/admin',        rotasAdmin)
app.use('/api/unifilar',     rotasUnifilar)
app.use('/api/irradiancia',  rotasIrradiancia)
app.use('/api/projetos-fv/:projetoId/homologacao', rotasHomologacao)
app.use('/api/projetos-fv/:projetoId/proposta', rotasProposta)
app.use('/api/projetos-fv/:id/beneficiarias', rotasBeneficiarias)
app.use('/api/fatura', rotasFatura)
app.use('/api/parecer-acesso', rotasParecerAcesso)

// ✅ Servir frontend compilado
const distPath = path.join(__dirname, '../../frontend/dist')
app.use(express.static(distPath))

// Rota catch-all para SPA - serve index.html para rotas não encontradas
app.get('*', (req, res) => {
  // Se não for requisição de API, servir index.html (para roteamento SPA)
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'))
  }
})

app.use(errorHandler)

// Iniciar servidor e conectar ao banco de dados
async function iniciarServidor() {
  const bdConectada = await conectarBD()

  if (!bdConectada) {
    console.warn('⚠️  Continuando sem MongoDB (dados em memória)')
  } else {
    // Inicializar dados padrão do CRM
    try {
      await inicializarCRM()
    } catch (erro) {
      console.error('❌ Erro ao inicializar CRM:', erro.message)
    }

    // Agendar tarefas de manutenção (arquivamento, limpeza, etc)
    try {
      agendarTarefasManutencao()
    } catch (erro) {
      console.error('❌ Erro ao agendar tarefas de manutenção:', erro.message)
    }
  }

  app.listen(PORT, () => {
    console.log(`✅ Forte Solar API rodando em http://localhost:${PORT}`)
  })
}

iniciarServidor()
