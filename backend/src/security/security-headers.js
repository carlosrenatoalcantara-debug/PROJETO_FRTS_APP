/**
 * Configuração de Headers de Segurança
 * Implementa Helmet.js e CORS seguro
 */

import helmet from 'helmet';
import cors from 'cors';

/**
 * Configuração Helmet.js (Headers de Segurança)
 * @returns {Function} Middleware Helmet configurado
 */
export const configureHelmet = () => {
  return helmet({
    // Content Security Policy (CSP) - Protege contra XSS
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", 'https://api.solar.com'], // APIs externas permitidas
        frameSrc: ["'none'"], // Não permite frames (protege contra clickjacking)
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },

    // X-Frame-Options - Protege contra Clickjacking
    frameguard: {
      action: 'deny', // Não permite em frames
    },

    // X-Content-Type-Options - Evita MIME sniffing
    noSniff: true,

    // X-XSS-Protection - Ativa XSS filter no navegador
    xssFilter: true,

    // Referrer-Policy - Controla informações de referrer
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // Permissions Policy (antigo Feature Policy)
    permissionsPolicy: {
      features: {
        geolocation: ["'self'"],
        camera: ["'none'"],
        microphone: ["'none'"],
        usb: ["'none'"],
      },
    },

    // Strict-Transport-Security (HSTS) - Força HTTPS
    hsts: {
      maxAge: 31536000, // 1 ano
      includeSubDomains: true,
      preload: true,
    },

    // Disable X-Powered-By header
    hidePoweredBy: true,
  });
};

/**
 * Configuração CORS (Cross-Origin Resource Sharing)
 * @param {Object} options - Configurações customizadas
 * @returns {Function} Middleware CORS configurado
 */
export const configureCors = (options = {}) => {
  const defaultOptions = {
    // Origem permitida (por padrão, frontend em produção)
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',

    // Métodos HTTP permitidos
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],

    // Headers permitidos na request
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
    ],

    // Headers expostos na response
    exposedHeaders: ['X-Total-Count', 'X-Page', 'Content-Range'],

    // Credentials (cookies, auth headers)
    credentials: true,

    // Tempo de cache pré-flight em segundos
    maxAge: 3600,

    // Permitir requisições opcionais (preflight)
    preflightContinue: false,

    // Status de resposta bem-sucedida para pré-flight
    optionsSuccessStatus: 200,
  };

  // Mesclar com opções customizadas
  const corsOptions = { ...defaultOptions, ...options };

  return cors(corsOptions);
};

/**
 * Configuração CORS Restritiva (apenas produção)
 * @returns {Function} Middleware CORS restritivo
 */
export const configureRestrictiveCors = () => {
  const whitelist = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      // Requisições sem origin (mesma origem, mobile apps)
      if (!origin) {
        return callback(null, true);
      }

      if (whitelist.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS não permitido para: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  });
};

/**
 * Middleware: Define headers adicionais de segurança
 */
export const securityHeaders = (req, res, next) => {
  // Previne cache de dados sensíveis
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // HTTP Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Evita MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Clickjacking Protection
  res.setHeader('X-Frame-Options', 'DENY');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

  next();
};

/**
 * Middleware: Validação de Content-Type
 * Força application/json para POST/PUT/PATCH
 */
export const enforceJsonContentType = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('content-type') || '';

    // Aceita JSON, multipart (uploads de PDF/imagem) e urlencoded (forms tradicionais)
    const isAccepted =
      contentType.includes('application/json') ||
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded');

    if (!isAccepted) {
      return res.status(415).json({
        success: false,
        error: 'Content-Type não suportado',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        accepted: ['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded'],
      });
    }
  }

  next();
};

/**
 * Middleware: Limitador de tamanho de request
 * Protege contra ataques de negação de serviço
 */
export const requestSizeLimit = (maxSize = '10kb') => {
  return (req, res, next) => {
    const size = parseInt(req.get('content-length') || '0');
    const limit = parseSize(maxSize);

    if (size > limit) {
      return res.status(413).json({
        success: false,
        error: 'Tamanho da requisição excede limite',
        code: 'PAYLOAD_TOO_LARGE',
        limit: maxSize,
      });
    }

    next();
  };
};

/**
 * Utilitário: Converte tamanho em bytes
 */
function parseSize(sizeStr) {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = sizeStr.match(/^(\d+)(b|kb|mb|gb)$/i);

  if (!match) return 10 * 1024; // Default 10KB

  return parseInt(match[1]) * units[match[2].toLowerCase()];
}

/**
 * Middleware: Sanitização de query params
 * Limpa parâmetros suspeitos
 */
export const sanitizeQueryParams = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\.\//, // Directory traversal
    /<[^>]*>/g, // HTML tags
    /['"];.*?(--|;)/g, // SQL injection
  ];

  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          console.warn(`[SECURITY] Parâmetro suspeito detectado: ${key}=${value}`);
          return res.status(400).json({
            success: false,
            error: 'Parâmetro de query inválido',
            code: 'INVALID_QUERY_PARAM',
          });
        }
      }
    }
  }

  next();
};

/**
 * Middleware: Error handling seguro
 * Não expõe detalhes de erros internos
 */
export const secureErrorHandler = (err, req, res, next) => {
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Não expor detalhes de erro em produção
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.statusCode || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Erro interno do servidor',
    code: err.code || 'INTERNAL_SERVER_ERROR',
    ...(isDevelopment && { stack: err.stack }),
  });
};

/**
 * Configura tudo de uma vez
 * @param {Object} app - Express app
 * @param {Object} options - Opções customizadas
 */
export const setupSecurityHeaders = (app, options = {}) => {
  // Helmet
  app.use(configureHelmet());

  // Security headers customizados
  app.use(securityHeaders);

  // ⚠️ CORS NÃO é aplicado aqui — server.js:74 já aplica `cors(corsOptions)` permissivo
  // que aceita Vercel + localhost. Aplicar uma 2ª camada restritiva aqui sobrescreveria
  // a primeira e rejeitaria todos os origins (HTTP 500 sistêmico em produção).
  //
  // Se quiser CORS restritivo (apenas produção), use configureRestrictiveCors() diretamente
  // em server.js NO LUGAR do cors(corsOptions), nunca em adição.

  // Content-Type validation
  app.use(enforceJsonContentType);

  // Request size limit — default 50mb para acomodar uploads de PDFs/imagens
  // (datasheets, faturas, pareceres de acesso). express.json em server.js já limita a 50mb também.
  app.use(requestSizeLimit(options.maxRequestSize || '50mb'));

  // Sanitize query params
  app.use(sanitizeQueryParams);
};

export default {
  configureHelmet,
  configureCors,
  configureRestrictiveCors,
  securityHeaders,
  enforceJsonContentType,
  requestSizeLimit,
  sanitizeQueryParams,
  secureErrorHandler,
  setupSecurityHeaders,
};
