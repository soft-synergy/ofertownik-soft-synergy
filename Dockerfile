# ─── Stage 1: Build React frontend ───────────────────────────────────────────
FROM node:20-slim AS react-builder
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci --legacy-peer-deps
COPY client/ ./client/
RUN cd client && npm run build

# ─── Stage 2: Install backend production dependencies ─────────────────────────
FROM node:20-slim AS deps-builder
WORKDIR /app
COPY package*.json ./
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci --only=production

# ─── Stage 3: Production API server ───────────────────────────────────────────
FROM node:20-slim AS production

# Chromium dla Puppeteer (scraping Biznes Polska)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

COPY --from=deps-builder /app/node_modules ./node_modules
COPY server/ ./server/
COPY package.json ./

# Katalogi na pliki (nadpisywane przez volumes w docker-compose)
RUN mkdir -p \
    uploads/portfolio \
    uploads/services \
    uploads/documents \
    uploads/public-orders \
    uploads/monitoring \
    server/generated-offers \
    logs

EXPOSE 5001
CMD ["node", "server/index.js"]

# ─── Stage 4: Nginx z buildem React ───────────────────────────────────────────
FROM nginx:alpine AS static-server
COPY --from=react-builder /app/client/build /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
