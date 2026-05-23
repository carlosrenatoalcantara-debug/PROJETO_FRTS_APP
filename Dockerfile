# Multi-stage build for frontend + backend
FROM node:18-alpine AS builder

WORKDIR /app

# Copy both frontend and backend
COPY frontend ./frontend
COPY backend ./backend
COPY package.json .

# Build frontend
WORKDIR /app/frontend
RUN npm install && npm run build

# Prepare backend
WORKDIR /app/backend
RUN npm install

# Final production image
FROM node:18-alpine

WORKDIR /app/backend

# Copy frontend build
COPY --from=builder /app/frontend/dist ./public/dist

# Copy backend
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend ./

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "src/server.js"]
