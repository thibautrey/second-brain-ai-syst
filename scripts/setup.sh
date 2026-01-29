#!/bin/bash

# Second Brain AI System - Quick Setup Script
# Auto-generates secrets, checks prerequisites, and sets up environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Second Brain AI System - Quick Setup${NC}"
echo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to generate secure random string
generate_secret() {
    if command_exists openssl; then
        openssl rand -hex 32
    elif command_exists node; then
        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    else
        # Fallback: use /dev/urandom
        head -c 32 /dev/urandom | xxd -p -c 32
    fi
}

echo "📋 Checking prerequisites..."

# Check Docker
if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first:${NC}"
    echo "   macOS: brew install --cask docker"
    echo "   Ubuntu: sudo apt install docker.io"
    echo "   Other: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
if ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose is not available. Please install Docker Compose.${NC}"
    exit 1
fi

# Check Node.js (optional, for local development)
if command_exists node; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${YELLOW}⚠️  Node.js version $NODE_VERSION detected. Version 18+ recommended for local development.${NC}"
    else
        echo -e "${GREEN}✅ Node.js $(node --version) detected${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  Node.js not found. Docker will handle all dependencies.${NC}"
fi

echo -e "${GREEN}✅ All prerequisites met!${NC}"
echo

echo "🔧 Setting up environment..."

# Check if .env already exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file already exists. Backing up as .env.backup${NC}"
    cp .env .env.backup
fi

# Copy environment template
cp .env.example .env
echo -e "${GREEN}✅ Created .env from template${NC}"

# Generate secure secrets
echo "🔐 Generating secure secrets..."
JWT_SECRET=$(generate_secret)
ENCRYPTION_KEY=$(generate_secret)

# Update .env with generated secrets
sed -i.bak "s/JWT_SECRET=your-secret-key-here/JWT_SECRET=$JWT_SECRET/" .env
sed -i.bak "s/ENCRYPTION_KEY=your-encryption-key-here/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
rm .env.bak  # Remove sed backup file

echo -e "${GREEN}✅ Generated secure JWT_SECRET and ENCRYPTION_KEY${NC}"
echo

# Show what's been set up
echo -e "${BLUE}📄 Configuration Summary:${NC}"
echo "   • Database: PostgreSQL (Docker)"
echo "   • Vector DB: Weaviate (Docker)"
echo "   • Audio Processing: ECAPA-TDNN (Docker)"
echo "   • Security: Auto-generated secrets"
echo "   • AI Features: Optional (configure in web interface)"
echo

echo -e "${BLUE}🚀 Ready to start! Run:${NC}"
echo -e "   ${GREEN}docker compose up --build${NC}"
echo
echo -e "${BLUE}📱 Access your system:${NC}"
echo "   • Web Interface: http://localhost:5173"
echo "   • API Server: http://localhost:3000"
echo "   • First time? Complete setup in the web interface"
echo
echo -e "${BLUE}🤖 Want AI chat features?${NC}"
echo -e "   Run: ${GREEN}./scripts/setup-local-llm.sh${NC} for local AI setup"
echo "   Or configure OpenAI/other providers in the web interface"
echo
echo -e "${GREEN}🎉 Setup complete! Happy brain augmenting!${NC}"