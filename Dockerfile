# Node 24 is required by the startup scripts and PGlite runtime.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# tsx and Vite are currently imported at runtime; retain dev dependencies.
RUN npm ci --include=dev
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server.ts ./
RUN npm run build
 
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 DATA_DIR=/var/lib/melktak
WORKDIR /app
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server.ts ./
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /var/lib/melktak && chown node:node /var/lib/melktak
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server.ts"]
 