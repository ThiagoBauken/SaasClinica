# ===========================================
# STAGE 1: Dependencies
# ===========================================
FROM node:20-alpine AS deps

WORKDIR /app

# Instalar dependências de build para bcrypt
RUN apk add --no-cache python3 make g++ libc6-compat

# Copiar package files
COPY package*.json ./

# Instalar TODAS as dependências (incluindo devDependencies para build)
RUN npm ci --legacy-peer-deps

# ===========================================
# STAGE 2: Builder
# ===========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências de build
RUN apk add --no-cache python3 make g++ libc6-compat

# Copiar dependências do stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Copiar arquivos de configuração
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY drizzle.config.ts ./
COPY components.json ./

# Copiar código fonte
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY modules ./modules
COPY config ./config

# Build do projeto (frontend + backend)
RUN npm run build

# ===========================================
# STAGE 3: Production
# ===========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Instalar dependências de runtime
RUN apk add --no-cache curl libc6-compat

# Copiar package files
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --omit=dev --legacy-peer-deps && \
    npm cache clean --force

# Copiar arquivos buildados
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copiar arquivos necessários
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared
COPY --from=builder --chown=nodejs:nodejs /app/server/migrations ./server/migrations
COPY --chown=nodejs:nodejs server/healthcheck.js ./server/healthcheck.js

# Copiar config para credenciais (opcional)
COPY --from=builder --chown=nodejs:nodejs /app/config ./config

# Criar diretórios necessários
RUN mkdir -p uploads processed && \
    chown -R nodejs:nodejs uploads processed

# Mudar para usuário não-root
USER nodejs

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=5000

# Expor porta
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node server/healthcheck.js || exit 1

# Comando de inicialização
CMD ["npm", "start"]
