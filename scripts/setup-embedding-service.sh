#!/bin/bash

# Setup script for ECAPA-TDNN Embedding Service
# Installs Python dependencies and prepares the environment

set -e

echo "🚀 Second Brain AI - Embedding Service Setup"
echo "=============================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3.8+ from https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo "✓ Python $PYTHON_VERSION found"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is required but not installed."
    exit 1
fi

echo "✓ pip3 found"
echo ""

# Create models directory
echo "📁 Creating models directory..."
mkdir -p ./models
echo "✓ Models directory ready at ./models"
echo ""

# Install Python dependencies
echo "📦 Installing Python dependencies..."
echo "This may take 10-30 minutes on first run (downloading PyTorch, SpeechBrain, etc.)"
echo ""

pip3 install -r backend/requirements.txt

echo ""
echo "✓ Python dependencies installed"
echo ""

# Install Node dependencies
echo "📦 Installing Node.js dependencies..."
cd backend
npm install
cd ..
echo "✓ Node dependencies installed"
echo ""

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Database
DB_PASSWORD=dev_password

# APIs
OPENAI_API_KEY=

# Embedding Service
EMBEDDING_SERVICE_HOST=localhost
EMBEDDING_SERVICE_PORT=5001
MODEL_CACHE_DIR=./models
EOF
    echo "✓ .env file created (edit with your settings)"
else
    echo "ℹ️  .env file already exists"
fi

echo ""
echo "=============================================="
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. Run the embedding service:"
echo "   python3 backend/services/embedding-service.py"
echo ""
echo "2. In another terminal, run the backend:"
echo "   cd backend && npm run dev"
echo ""
echo "3. Or run everything with Docker:"
echo "   docker compose up --build"
echo ""
echo "⏱️  First run will take 5-10 minutes to download the model (~150 MB)"
echo ""
