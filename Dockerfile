# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: install all dependencies (incl. native build tools) and build.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build

# better-sqlite3 may need to compile against musl if no prebuilt binary exists.
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage: minimal Node image with production dependencies only.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=/data/local.db

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/docker ./docker

# Persistent location for the SQLite database (mount a NAS volume here).
RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["sh", "docker/entrypoint.sh"]
