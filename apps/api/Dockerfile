# Multi-stage build; run with the repo root as context:
#   docker build -f apps/api/Dockerfile .

FROM node:22-slim AS deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build

COPY packages/shared packages/shared
COPY apps/api apps/api

# prisma generate reads DATABASE_URL from prisma.config.ts but never connects at build time
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"

RUN npm run db:generate -w @lulu/api
RUN npm run build -w @lulu/api

FROM node:22-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

ENV NODE_ENV=production
# tsx and the Prisma CLI (devDependencies, kept on purpose) live in the hoisted .bin
ENV PATH="/app/node_modules/.bin:/app/apps/api/node_modules/.bin:${PATH}"

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/src apps/api/src
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=build /app/apps/api/docker-entrypoint.sh apps/api/docker-entrypoint.sh
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/src packages/shared/src

USER node
EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

WORKDIR /app/apps/api
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
