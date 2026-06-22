// 🔧 POLYFILL BOOTSTRAP — MUST be FIRST, executes before imports
// Minimal polyfills for pdfjs-dist DOM API requirements
if (!globalThis.DOMMatrix) {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() { this.a = this.b = this.c = this.f = 0; this.d = this.e = 1 }
    multiply() { return this }
    inverse() { return this }
    transformPoint() { return { x: 0, y: 0 } }
  }
}
if (!globalThis.ImageData) {
  globalThis.ImageData = class ImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height }
  }
}
if (!globalThis.Path2D) {
  globalThis.Path2D = class Path2D {
    constructor() {}
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
  }
}
if (!globalThis.HTMLCanvasElement) {
  globalThis.HTMLCanvasElement = class HTMLCanvasElement {
    getContext() { return {} }
    toDataURL() { return '' }
  }
}
if (!globalThis.HTMLImageElement) {
  globalThis.HTMLImageElement = class HTMLImageElement {
    constructor() { this.src = ''; this.width = this.height = 0 }
  }
}
if (!globalThis.CanvasRenderingContext2D) {
  globalThis.CanvasRenderingContext2D = class CanvasRenderingContext2D {
    fillRect() {}
    clearRect() {}
    fillText() {}
    drawImage() {}
    createImageData() { return new globalThis.ImageData([], 0, 0) }
    getImageData() { return new globalThis.ImageData([], 0, 0) }
    stroke() {}
    fill() {}
    beginPath() {}
    closePath() {}
    clip() {}
  }
}
// ✅ Polyfills ready

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
// Restart trigger
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from './config/database.js'
import { conectarBD } from './config/database.js'

// 🔐 Security modules
import { setupSecurityHeaders, secureErrorHandler } from './security/security-headers.js'
import { authenticateToken, auditLogger } from './security/auth-middleware.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import { inicializarCRM } from './seeds/crmInitialData.js'
import { agendarTarefasManutencao } from './utils/arquivamentoPolicy.js'
import rotasClientes   from './routes/clientes.js'
import rotasProjetosFV from './routes/projetosFV.js'
import rotasPublico from './routes/publico.js'
import rotasEmpresa from './routes/empresa.js'
import rotasGestao from './routes/gestao.js'
import rotasAtivos from './routes/ativos.js'   // P1-ASSET-CORE-01
import rotasPainel from './routes/painel.js'
import rotasAlertCenter from './routes/alertcenter.js'   // S8.8
import rotasCatalogoDiagnostico from './routes/catalogoDiagnostico.js'  // CAT-P0-UNIFY
import { decodificarUsuario, protegerModulo } from './middleware/rbacMiddleware.js'
import rotasProjetosEV from './routes/projetosEV.js'
import rotasDashboard  from './routes/dashboard.js'
import rotasUpload      from './routes/upload.js'
// ⚠️ Parser routes loaded lazily AFTER polyfills to prevent DOMMatrix ReferenceError
// import rotasEquipamentos from './routes/equipamentos.js'
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
// import rotasDatasheet    from './routes/datasheet.js'
import rotasAdmin        from './routes/admin.js'
import rotasUnifilar     from './routes/unifilar.js'
import rotasIrradiancia  from './routes/irradiancia.js'
import rotasReferencia   from './routes/referencia.js'   // P1-COSERN-REFERENCE-TOPOLOGIES-01
import rotasHomologacao  from './routes/homologacao.js'
import rotasProposta     from './routes/proposta.js'
// import rotasFatura       from './routes/fatura.js'
import rotasBeneficiarias from './routes/beneficiarias.js'
import rotasAuth         from './routes/auth.js'
import rotasCalculadora  from './routes/calculadora.js'
// import rotasCarregadoresEV from './routes/carregadoresEV.js'
// import rotasParecerAcesso from './routes/pareceracesso.js'
import rotasAuthSegura   from './routes/auth-security.js'  // 🔐 Novo sistema de autenticação seguro
import rotasIntegrations from './routes/integrations.js'   // 🔐 Gerenciamento seguro de chaves de API
import rotasDimensionamento from './routes/dimensionamento.js'  // 🌞 Motor de dimensionamento FV (S1)
import rotasAdminCatalogo from './routes/adminCatalogo.js'      // 🧪 Qualidade do catálogo técnico (S2.6.1)
import rotasKitsV1       from './routes/kitsV1.js'              // 🔍 Motor de Recomendação de Kits FV (S2.14)
// import rotasBillIntake   from './routes/billIntakeRoutes.js'   // 📋 Bill intake + parser (S3.1) — BLOCKED by pdfjs-dist
import rotasAuthV2       from './routes/authv2.js'            // 🔐 Auth v2 - S3.7 (Login simplificado)
import errorHandler      from './middleware/errorHandler.js'

const app  = express()
const PORT = process.env.PORT || 5001

// 🔐 S4.3.1: trust proxy — atrás de Vercel/Railway, req.ip passa a refletir o
// IP real do cliente (primeiro item do X-Forwarded-For) em vez do proxy.
// Necessário para a trilha de auditoria de assinaturas comerciais.
app.set('trust proxy', true)

// Configuração CORS com mais detalhes
const corsOptions = {
  origin: (origin, callback) => {
    // Permite localhost em qualquer porta (dev)
    // e também produção se necessário
    if (!origin ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin === 'https://projeto-frts-app.vercel.app') {
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

// 🔐 Security headers (Helmet.js, HSTS, CSP, etc)
setupSecurityHeaders(app)

// Aumentar limite de payload para aceitar PDFs grandes (até 50MB)
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// 🔑 S7.2.1: decodifica usuário (JWT) de forma não-bloqueante → req.auth
app.use(decodificarUsuario)

// 📋 Audit logging for all requests (já enriquecido com req.auth quando presente)
app.use(auditLogger)

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
  // Mongoose readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  // ⚠️ Mapeamento corrigido — versão anterior tinha 1↔2 invertidos (label dizia "conectando" para state CONECTADO)
  const mongoState = ['desconectado', 'conectado', 'conectando', 'desconectando']
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
// 🔐 Usar nova rota de autenticação segura
app.use('/api/auth',         rotasAuthSegura)
// 🔐 Auth v2 - S3.7 (Simplificado para multiuser pilot)
app.use('/api/authv2',       rotasAuthV2)
// 🔐 Gerenciamento seguro de integrações (APIs, chaves)
app.use('/api/integrations', rotasIntegrations)
// 🌞 Motor de dimensionamento FV (Sprint 1 — sem efeito em dados existentes)
app.use('/api/dimensionamento', rotasDimensionamento)
// 🧪 Catálogo técnico — qualidade (S2.6.1 — endpoint admin de leitura)
app.use('/api/admin/catalogo', protegerModulo('catalogo'), rotasAdminCatalogo)
// 🔍 Motor de Recomendação de Kits FV (S2.14 — read-only analítico)
app.use('/api/v1/kits',        rotasKitsV1)
// app.use('/api/auth-legacy', rotasAuth)  // Rota antiga desabilitada
app.use('/api/calculadora',  rotasCalculadora)
// app.use('/api/carregadores-ev', rotasCarregadoresEV)  // ⚠️ DISABLED: pdfjs-dist blocker
app.use('/api/dashboard',    rotasDashboard)
app.use('/api/clientes',     rotasClientes)
app.use('/api/projetos-fv',  protegerModulo('fv'), rotasProjetosFV)
app.use('/api/publico',      rotasPublico)   // S5 — leitura pública (sem RBAC, é público)
app.use('/api/empresa',      protegerModulo('configuracoes'), rotasEmpresa)   // S7.1
app.use('/api/gestao',       protegerModulo('configuracoes'), rotasGestao)    // S7.2
app.use('/api/ativos',       rotasAtivos)    // P1-ASSET-CORE-01 — Gêmeo Digital
app.use('/api/painel',       rotasPainel)    // S7.3 — painel executivo, health, auditoria
app.use('/api/alertcenter',  rotasAlertCenter)  // S8.8 — AlertCenter unificado
app.use('/api/catalogo',     rotasCatalogoDiagnostico)  // CAT-P0-UNIFY — diagnóstico (read-only)
app.use('/api/projetos-ev',  protegerModulo('ev'), rotasProjetosEV)
app.use('/api/upload',       rotasUpload)
app.use('/api/engenharia',   rotasEngenharia)
app.use('/api/string',       rotasString)
app.use('/api/carga',        rotasCarga)
app.use('/api/bess',         rotasBESS)
app.use('/api/financeiro',   protegerModulo('financeiro'), rotasFinanceiro)
app.use('/api/orcamento',    rotasOrcamento)
app.use('/api/crm',          protegerModulo('crm'), rotasCRM)
app.use('/api/projeto',      rotasProjeto)
app.use('/api/recomendacao', rotasRecomendacao)
app.use('/api/decisao',      rotasDecisao)
app.use('/api/admin',        rotasAdmin)
app.use('/api/unifilar',     rotasUnifilar)
app.use('/api/irradiancia',  rotasIrradiancia)
app.use('/api/referencia',   rotasReferencia)   // biblioteca de topologias de referência
app.use('/api/projetos-fv/:projetoId/homologacao', rotasHomologacao)
app.use('/api/projetos-fv/:projetoId/proposta', rotasProposta)
app.use('/api/projetos-fv/:id/beneficiarias', rotasBeneficiarias)
// app.use('/api/fatura', rotasFatura)  // ⚠️ LAZY LOADED after polyfills
// app.use('/api/parecer-acesso', rotasParecerAcesso)  // ⚠️ DISABLED: pdfjs-dist blocker
// app.use('/api/bills', rotasBillIntake)  // ⚠️ DISABLED: pdfjs-dist blocker

// ✅ Servir frontend compilado
const distPath = path.join(__dirname, '../public/dist')
app.use(express.static(distPath))

// Rota catch-all para SPA - serve index.html para rotas não encontradas
// ⚠️ FIX cirúrgico: rotas /api/* registradas via lazy load (equipamentos, datasheet, fatura)
//    são adicionadas DEPOIS deste catch-all. Sem next(), ficavam pendurando.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next()
  }
  return res.sendFile(path.join(distPath, 'index.html'))
})

// 🔐 Secure error handler (não expõe stack traces em produção)
app.use(secureErrorHandler)

// Fallback do error handler padrão
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

    // CAT-KB-01: Base de Conhecimento (semeia se vazio + carrega em cache).
    // Não-fatal: se falhar, o parser usa o conhecimento hardcoded (fallback).
    try {
      const { inicializarConhecimento } = await import('./ai/conhecimentoCatalogo.js')
      const estado = await inicializarConhecimento()
      console.log(`📚 Base de Conhecimento: origem=${estado.origem} aliases=${estado.total_aliases} fabricantes=${estado.fabricantes}`)
    } catch (erro) {
      console.error('⚠️  Base de Conhecimento indisponível (usando parser hardcoded):', erro.message)
    }
  }

  // 🔄 Lazy load parser routes AFTER polyfills + DB + all async initialization
  // This prevents DOMMatrix ReferenceError when pdfjs-dist loads
  try {
    const { default: rotasEquipamentos } = await import('./routes/equipamentos.js')
    const { default: rotasDatasheet } = await import('./routes/datasheet.js')
    const { default: rotasFatura } = await import('./routes/fatura.js')
    // S8.5 — Inteligência de fatura (camada normalizada com revisão humana)
    const { default: rotasFaturasInteligente } = await import('./routes/faturasInteligente.js')
    // EV-ALIGN-01: carregadores EV via lazy load (mesma estratégia da fatura — pdf-parse após polyfills)
    const { default: rotasCarregadoresEV } = await import('./routes/carregadoresEV.js')
    // AI-ARCH-01: diagnóstico centralizado da camada de IA
    const { default: rotasAI } = await import('./routes/ai.js')

    app.use('/api/equipamentos', rotasEquipamentos)
    app.use('/api/datasheet',    rotasDatasheet)
    app.use('/api/fatura',       rotasFatura)
    app.use('/api/faturas',      rotasFaturasInteligente)
    app.use('/api/carregadores-ev', rotasCarregadoresEV)
    app.use('/api/ai',           rotasAI)

    console.log('✅ Parser routes loaded successfully before server start')
  } catch (err) {
    console.error('⚠️  Failed to load parser routes:', err.message)
    console.log('ℹ️  Continuing without parser routes (non-critical)')
  }

  app.listen(PORT, () => {
    console.log(`✅ Forte Solar API rodando em http://localhost:${PORT}`)
  })
}

iniciarServidor()
