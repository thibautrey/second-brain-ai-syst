#!/bin/bash

# Rebuild native modules for the current Debian environment
echo "Rebuilding native modules..."
npm rebuild bcrypt --build-from-source

# Run Prisma migrations
echo "Running database migrations..."
npx prisma migrate deploy 2>&1 | grep -q "migration failed" && {
  echo "Migration failed, attempting to resolve..."
  npx prisma migrate status | grep -oP '(?<=The following migrations have failed:\n).*' | while read migration; do
    npx prisma migrate resolve --rolled-back "$migration" || true
  done
  npx prisma migrate deploy || true
} || true

# Generate Prisma client (in case schema changed)
echo "Generating Prisma client..."
npx prisma generate

# Start the compiled application
echo "Starting application..."
exec node dist/services/api-server.js
