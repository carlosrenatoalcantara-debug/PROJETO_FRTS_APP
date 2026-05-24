# Multi-stage build for frontend + backend
FROM node:18-alpine AS builder

WORKDIR /app

# Copy only package files first (small, cacheable layer)
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

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
