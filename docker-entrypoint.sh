#!/bin/sh
set -e

echo "▸ Prisma: applying schema..."
npx prisma db push --skip-generate --accept-data-loss=false || npx prisma db push --skip-generate

echo "▸ Seeding initial data..."
node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts || echo "  (seed skipped or already applied)"

echo "▸ Starting Next.js..."
exec "$@"
