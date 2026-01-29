#!/bin/bash

# Download and cache the speaker embedding model
# This script should be run with internet access to pre-cache the model

set -e

echo "🔄 Downloading ECAPA-TDNN Speaker Embedding Model"
echo "=================================================="

# Set environment variables
export MODEL_CACHE_DIR="${MODEL_CACHE_DIR:-./models}"
export HF_HUB_OFFLINE=0

# Create cache directory
mkdir -p "$MODEL_CACHE_DIR"
echo "📁 Cache directory: $MODEL_CACHE_DIR"

# Download the model
echo "⏳ Downloading model files from Hugging Face Hub..."
python3 << 'EOF'
import os
import logging
from pathlib import Path
from speechbrain.inference.speaker import SpeakerRecognition
import torch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_NAME = "speechbrain/spkrec-ecapa-voxceleb"
MODEL_CACHE_DIR = Path(os.getenv("MODEL_CACHE_DIR", "./models"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

logger.info(f"Model: {MODEL_NAME}")
logger.info(f"Cache: {MODEL_CACHE_DIR}")
logger.info(f"Device: {DEVICE}")

try:
    kwargs = {
        "source": MODEL_NAME,
        "savedir": str(MODEL_CACHE_DIR / MODEL_NAME.split("/")[1]),
        "run_opts": {"device": DEVICE}
    }
    
    logger.info("Downloading model...")
    model = SpeakerRecognition.from_hparams(**kwargs)
    logger.info("✓ Model downloaded successfully!")
    
    # Verify model loaded
    logger.info("Testing model...")
    test_model = SpeakerRecognition.from_hparams(**kwargs)
    logger.info("✓ Model verified and cached!")
    
except Exception as e:
    logger.error(f"✗ Failed: {e}")
    exit(1)
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Model cached successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Rebuild Docker image: docker compose build embedding-service"
    echo "2. Start service: docker compose up embedding-service"
    echo ""
    echo "The model will now load from cache on every restart!"
else
    echo ""
    echo "❌ Download failed. Check your internet connection and try again."
    exit 1
fi
