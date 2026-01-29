#!/bin/bash

# Second Brain AI System - Local LLM Setup
# Sets up Ollama for local AI features (chat, summarization, analysis)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🤖 Setting up Local LLM (Ollama)${NC}"
echo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
fi

echo "📦 Installing Ollama..."

if ! command_exists ollama; then
    if [ "$OS" = "macos" ]; then
        if command_exists brew; then
            echo "   Installing via Homebrew..."
            brew install ollama
        else
            echo "   Downloading installer..."
            curl -fsSL https://ollama.ai/install.sh | sh
        fi
    else
        echo "   Installing via official installer..."
        curl -fsSL https://ollama.ai/install.sh | sh
    fi
else
    echo -e "${GREEN}✅ Ollama already installed${NC}"
fi

echo
echo "🚀 Starting Ollama service..."

# Start Ollama in background
if [ "$OS" = "macos" ]; then
    # On macOS, start as background service
    brew services start ollama 2>/dev/null || ollama serve >/dev/null 2>&1 &
else
    # On Linux, start in background
    ollama serve >/dev/null 2>&1 &
    OLLAMA_PID=$!
    echo "   Ollama started with PID $OLLAMA_PID"
fi

# Wait for Ollama to be ready
echo "   Waiting for Ollama to start..."
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo -e "${RED}❌ Failed to start Ollama. Please check your installation.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Ollama is running!${NC}"
echo

echo "📥 Downloading AI model (llama3.1:3b - ~2GB)..."
echo "   This may take a few minutes depending on your internet speed..."

# Pull the model
if ollama pull llama3.1:3b; then
    echo -e "${GREEN}✅ Model downloaded successfully!${NC}"
else
    echo -e "${RED}❌ Failed to download model. Check your internet connection.${NC}"
    exit 1
fi

echo
echo -e "${BLUE}🔧 Configuration Instructions:${NC}"
echo
echo "1. Start your Second Brain AI System:"
echo -e "   ${GREEN}docker compose up --build${NC}"
echo
echo "2. Open the web interface: http://localhost:5173"
echo
echo "3. Go to Settings → AI Configuration"
echo
echo "4. Add a new AI Provider:"
echo "   • Name: Ollama Local"
echo "   • Type: OpenAI Compatible"
echo "   • API Key: ollama (any value)"
echo "   • Base URL: http://host.docker.internal:11434/v1"
echo "   • Models: llama3.1:3b"
echo
echo "5. Configure Task Assignments:"
echo "   • Chat: Ollama Local → llama3.1:3b"
echo "   • Routing: Ollama Local → llama3.1:3b"
echo "   • Summarization: Ollama Local → llama3.1:3b"
echo "   • Analysis: Ollama Local → llama3.1:3b"
echo
echo -e "${GREEN}🎉 Local LLM setup complete!${NC}"
echo "   Your AI features will run completely offline once configured."
echo
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   • Ollama runs on port 11434"
echo "   • Use 'ollama list' to see downloaded models"
echo "   • Use 'ollama pull <model>' to download other models"
echo "   • For better performance, try 'llama3.1:8b' if you have 8GB+ RAM"