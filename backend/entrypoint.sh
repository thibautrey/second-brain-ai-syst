#!/bin/bash
set -e

# Rebuild native modules for the current Debian environment
echo "Rebuilding native modules..."
npm rebuild bcrypt --build-from-source

# Run Prisma migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client (in case schema changed)
echo "Generating Prisma client..."
npx prisma generate

# Start the compiled application
echo "Starting application..."
exec node dist/services/api-server.js
