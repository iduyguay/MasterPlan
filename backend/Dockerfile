FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
RUN useradd -r -u 10001 -m operative
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js ./
COPY src ./src
RUN mkdir -p /app/data && chown -R operative:operative /app
USER operative
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
