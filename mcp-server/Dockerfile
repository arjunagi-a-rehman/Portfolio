# ---- Build stage ----
FROM oven/bun:1.2-alpine AS build

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY . .

# ---- Runtime stage ----
FROM oven/bun:1.2-alpine AS runtime

WORKDIR /app

# Non-root user
RUN addgroup -S agent && adduser -S agent -G agent

# Copy deps + source from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/nodes ./nodes
COPY --from=build /app/index.ts ./index.ts
COPY --from=build /app/package.json ./package.json

# Correct ownership
RUN chown -R agent:agent /app
USER agent

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["bun", "run", "index.ts"]
