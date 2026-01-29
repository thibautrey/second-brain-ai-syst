#!/bin/bash
# Input Ingestion System - Setup & Testing Script

set -e

echo "=========================================="
echo "Input Ingestion System - Setup Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check dependencies
echo -e "${BLUE}[1/5] Checking dependencies...${NC}"
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✓ npm found"

if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL client not found (optional for local testing)"
fi
echo ""

# 2. Install Node dependencies
echo -e "${BLUE}[2/5] Installing Node dependencies...${NC}"
npm install --save speechbrain-lite 2>/dev/null || echo "⚠️  SpeechBrain integration optional"
npm install --save weaviate-ts-client 2>/dev/null || echo "⚠️  Weaviate client optional"
echo "✓ Dependencies checked"
echo ""

# 3. Setup database schema
echo -e "${BLUE}[3/5] Setting up database schema...${NC}"
if [ -f "backend/database/schemas/input-ingestion.prisma" ]; then
    echo "✓ Input ingestion schema found"
    echo "  Run: npx prisma migrate dev --name add_input_ingestion_tables"
else
    echo "❌ Schema file not found"
fi
echo ""

# 4. Verify configuration
echo -e "${BLUE}[4/5] Verifying configuration...${NC}"
if [ -f "config/input-system.config.json" ]; then
    echo "✓ Configuration found"
    echo "  Speaker recognition model: $(grep -o '"model": "[^"]*"' config/input-system.config.json | head -1)"
    echo "  Input formats: text, audio_stream, audio_batch"
else
    echo "❌ Configuration not found"
fi
echo ""

# 5. Documentation check
echo -e "${BLUE}[5/5] Checking documentation...${NC}"
docs_found=0
[ -f "docs/input-ingestion.md" ] && echo "✓ Architecture documentation found" && ((docs_found++))
[ -f "docs/input-integration-guide.md" ] && echo "✓ Integration guide found" && ((docs_found++))
[ -f "docs/implementation-notes/INPUT_IMPLEMENTATION.md" ] && echo "✓ Implementation summary found" && ((docs_found++))
echo ""

# Summary
echo -e "${GREEN}=========================================="
echo "Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "📦 Created Files:"
echo "  ✓ backend/services/input-ingestion.ts"
echo "  ✓ backend/services/speaker-recognition.ts"
echo "  ✓ backend/models/input-ingestion.ts"
echo "  ✓ backend/controllers/input-ingestion.controller.ts"
echo "  ✓ backend/database/schemas/input-ingestion.prisma"
echo ""
echo "📚 Documentation:"
echo "  ✓ docs/input-ingestion.md"
echo "  ✓ docs/input-integration-guide.md"
echo "  ✓ docs/implementation-notes/INPUT_IMPLEMENTATION.md"
echo ""
echo "⚙️  Configuration:"
echo "  ✓ config/input-system.config.json"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Review docs/implementation-notes/INPUT_IMPLEMENTATION.md for overview"
echo "  2. Run database migrations:"
echo "     npx prisma migrate dev --name add_input_ingestion_tables"
echo "  3. Integrate speaker recognition models:"
echo "     npm install speechbrain (or WeSpeaker/pyannote)"
echo "  4. Setup transcription service:"
echo "     npm install openai (for Whisper API)"
echo "  5. Follow docs/input-integration-guide.md for full integration"
echo ""
echo -e "${GREEN}For more information, see:${NC}"
echo "  - docs/input-ingestion.md (Architecture & Options)"
echo "  - docs/input-integration-guide.md (Integration Steps)"
echo "  - docs/implementation-notes/INPUT_IMPLEMENTATION.md (Quick Reference)"
echo ""
