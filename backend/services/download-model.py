#!/usr/bin/env python3
"""
Pre-download and cache the ECAPA-TDNN speaker embedding model.
This script should be run during Docker build to cache the model files.
"""

import os
import logging
from pathlib import Path

# Configure HuggingFace cache BEFORE importing any HF-dependent libraries
os.environ.setdefault("HF_HOME", os.getenv("HF_HOME", "/app/models"))
os.environ.setdefault("HF_HUB_CACHE", os.getenv("HF_HUB_CACHE", "/app/models/hub"))

import torch
from speechbrain.inference.speaker import SpeakerRecognition

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Model configuration
MODEL_NAME = "speechbrain/spkrec-ecapa-voxceleb"
MODEL_CACHE_DIR = Path(os.getenv("MODEL_CACHE_DIR", "./models"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

def download_model():
    """Download and cache the ECAPA-TDNN model."""
    logger.info(f"Pre-downloading model: {MODEL_NAME}")
    logger.info(f"Cache directory: {MODEL_CACHE_DIR}")
    logger.info(f"Device: {DEVICE}")
    
    # Create cache directory
    MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    try:
        # Download model
        kwargs = {
            "source": MODEL_NAME,
            "savedir": str(MODEL_CACHE_DIR / MODEL_NAME.split("/")[1]),
            "run_opts": {"device": DEVICE}
        }
        
        logger.info("Downloading model files from Hugging Face Hub...")
        model = SpeakerRecognition.from_hparams(**kwargs)
        logger.info("✓ Model downloaded and cached successfully")
        
        # Test that model loads correctly
        logger.info("Testing model loading...")
        test_model = SpeakerRecognition.from_hparams(**kwargs)
        logger.info("✓ Model loads correctly from cache")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Failed to download model: {e}")
        logger.error("This is expected if there's no internet connection.")
        logger.error("The model cache will be created on first runtime with internet access.")
        return False

if __name__ == "__main__":
    success = download_model()
    exit(0 if success else 1)
