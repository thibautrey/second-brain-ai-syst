#!/bin/bash
set -e

# Rebuild native modules for the current Debian environment
echo "Rebuilding native modules..."
npm rebuild bcrypt --build-from-source

# Start the compiled application
echo "Starting application..."
exec node dist/services/api-server.js
