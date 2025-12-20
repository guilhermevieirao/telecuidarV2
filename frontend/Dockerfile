# ========================================
# TeleCuidar Frontend - Dockerfile
# Multi-stage build para Angular 21 SSR
# ========================================

# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Copiar arquivos de dependências primeiro para cache
COPY package*.json ./

# Instalar dependências
RUN npm ci --legacy-peer-deps

# Copiar código fonte
COPY . .

# Criar estrutura de diretórios esperada pelo script generate-env.js
# O script procura ../.env (um nível acima do frontend)
RUN mkdir -p /telecuidar && \
    echo "NODE_ENV=production" > /telecuidar/.env && \
    echo "API_URL=/api" >> /telecuidar/.env && \
    echo "JITSI_ENABLED=true" >> /telecuidar/.env && \
    echo "JITSI_DOMAIN=meet.jit.si" >> /telecuidar/.env

# Mover app para subpasta para manter estrutura relativa
WORKDIR /telecuidar/frontend
RUN cp -r /app/* .

# Build de produção
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app

# Instalar wget para healthcheck
RUN apk add --no-cache wget

# Criar usuário não-root para segurança (sintaxe Alpine)
RUN adduser -D -s /bin/sh appuser

# Instalar apenas dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Copiar build de produção (do novo caminho)
COPY --from=build /telecuidar/frontend/dist ./dist

# Ajustar permissões
RUN chown -R appuser:appuser /app

# Mudar para usuário não-root
USER appuser

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=4000

# Expor porta
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000 || exit 1

# Entrypoint - Rodar o servidor SSR
CMD ["node", "dist/frontend/server/server.mjs"]
