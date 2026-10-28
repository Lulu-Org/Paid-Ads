#!/bin/sh
set -eu

echo "[entrypoint] Applying database migrations..."
prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] SEED_ON_START=true, running seed..."
  tsx prisma/seed.ts
fi

echo "[entrypoint] Starting the API..."
exec node dist/server.js
