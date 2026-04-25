#!/usr/bin/env sh
set -e

echo "Running Prisma migrations (deploy)..."
npx prisma migrate deploy

echo "Starting app..."
node dist/main.js

