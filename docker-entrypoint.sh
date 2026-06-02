#!/bin/bash
set -e

echo "▸ [entrypoint] DATABASE_URL set? $([ -n "$DATABASE_URL" ] && echo yes || echo NO)"
echo "▸ [entrypoint] NEXTAUTH_URL=${NEXTAUTH_URL:-<empty>}"

echo "▸ [entrypoint] Applying Prisma schema (db push)..."
npx prisma db push --skip-generate || { echo "✗ prisma db push falhou"; exit 1; }

echo "▸ [entrypoint] Seeding initial data..."
npx tsx prisma/seed.ts || echo "  (seed skipped or already applied)"

echo "▸ [entrypoint] Starting app: $@"
exec "$@"
