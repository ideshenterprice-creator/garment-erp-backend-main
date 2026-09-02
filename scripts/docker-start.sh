#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. In Railway, add service variables and click Apply changes / Deploy."
  exit 1
fi

# Prisma schema requires DIRECT_URL at migrate time. If only the pooled
# DATABASE_URL is present, reuse it so the container can still start.
if [ -z "$DIRECT_URL" ]; then
  echo "DIRECT_URL is unset; using DATABASE_URL for Prisma migrations."
  export DIRECT_URL="$DATABASE_URL"
fi

npx prisma migrate deploy
exec node dist/server.js
