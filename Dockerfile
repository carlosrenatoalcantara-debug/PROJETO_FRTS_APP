# Multi-stage build for frontend + backend
FROM node:18-alpine AS builder

# Force full rebuild - invalidate all cache layers
ENV REBUILD_TIMESTAMP="2026-05-24T16:25:00Z"

WORKDIR /app

# Copy only package files first (small, cacheable layer)
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
# FV-INFRA-059: `backend/package.json` declara dependencias `file:vendor/*.tgz`
# (@fortesolar/fv-shared e @fortesolar/diagram-engine). Sem copiar `vendor/`
# antes do `npm ci`, o build quebra com ENOENT — foi o que derrubou o primeiro
# deploy de QA. Correcao do MECANISMO de deploy; nenhuma logica alterada.
COPY backend/vendor ./backend/vendor

# Install dependencies
WORKDIR /app/frontend
RUN npm ci --production=false

WORKDIR /app/backend
RUN npm ci --production=true

# Change back to /app for copying source files
WORKDIR /app

# Copy only essential source code (node_modules excluded via .dockerignore)
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public
COPY frontend/index.html ./frontend/
COPY frontend/vite.config.js ./frontend/
COPY frontend/aliases.js ./frontend/
# O Vite resolve `@fortesolar/*` e `@diagram-engine` para `packages/` via alias.
COPY packages ./packages
COPY frontend/tailwind.config.js ./frontend/
COPY frontend/postcss.config.js ./frontend/
COPY backend/src ./backend/src

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Final production image
FROM node:18-alpine

WORKDIR /app/backend

# Install only production dependencies
COPY backend/package*.json ./
COPY backend/vendor ./vendor
RUN npm ci --production=true

# Copy frontend build from builder
COPY --from=builder /app/frontend/dist ./public/dist

# Copy backend source code
COPY backend/src ./src

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server (with embedded polyfills)
CMD ["node", "src/server.js"]
# Force rebuild timestamp: Sun May 24 16:24:28     2026
