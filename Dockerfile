# ===========================================
# STAGE 1: Build
# ===========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências de build
RUN apk add --no-cache python3 make g++

# Copiar package files
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Build do projeto (frontend + backend)
RUN npm run build

# ===========================================
# STAGE 2: Production
# ===========================================
FROM node:20-alpine

WORKDIR /app

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Instalar dependências de runtime
RUN apk add --no-cache curl

# Copiar package files
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar apenas os arquivos buildados do builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/server/healthcheck.js ./server/healthcheck.js
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared

# Criar diretório para uploads
RUN mkdir -p uploads && chown -R nodejs:nodejs uploads

# Mudar para usuário não-root
USER nodejs

# Expor porta
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node server/healthcheck.js || exit 1

# Comando de inicialização (usa o build compilado)
CMD ["npm", "start"]
