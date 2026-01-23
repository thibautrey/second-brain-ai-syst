#!/usr/bin/env python3
"""
Speaker Embedding Service using SpeechBrain ECAPA-TDNN

Automatically downloads the ECAPA-TDNN model from HuggingFace on first use.
Provides REST API for embedding extraction.
"""

import json
import os
import sys
import logging
from pathlib import Path
from typing import List, Dict, Any, Union, Tuple

import numpy as np
from flask import Flask, request, jsonify
import torch
import torchaudio
from speechbrain.pretrained import SpeakerRecognition

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
HF_TOKEN = os.getenv("HF_TOKEN")  # Hugging Face API token

# Global model instance
model = None

def load_model() -> SpeakerRecognition:
    """
    Load ECAPA-TDNN model from SpeechBrain.
    Automatically downloads from HuggingFace if not cached.
    """
    global model

    if model is not None:
        logger.debug("Model already loaded")
        return model

    logger.info(f"Loading ECAPA-TDNN model from {MODEL_NAME}")
    logger.info(f"Using device: {DEVICE}")
    logger.info(f"Model cache directory: {MODEL_CACHE_DIR}")

    # Create cache directory if it doesn't exist
    MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    try:
        # Prepare kwargs for model loading
        kwargs = {
            "source": MODEL_NAME,
            "savedir": str(MODEL_CACHE_DIR / MODEL_NAME.split("/")[1]),
            "run_opts": {"device": DEVICE}
        }
        
        # Add HF token if available
        if HF_TOKEN:
            kwargs["huggingface_fields"] = {"token": HF_TOKEN}
            logger.info("Using Hugging Face token for authentication")
        
        # Load model with automatic download
        model = SpeakerRecognition.from_hparams(**kwargs)
        logger.info(f"✓ Model loaded successfully on {DEVICE}")
        return model
    except Exception as e:
        logger.error(f"✗ Failed to load model: {e}")
        raise

def extract_embedding(audio_path: str) -> List[float]:
    """
    Extract speaker embedding from audio file.

    Args:
        audio_path: Path to audio file (WAV, MP3, etc.)

    Returns:
        List of 192 embedding values (ECAPA-TDNN dimension)
    """
    try:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Load model if not already loaded
        if model is None:
            load_model()

        # Load and resample audio
        waveform, sr = torchaudio.load(audio_path)

        # Resample to 16kHz if needed
        if sr != 16000:
            resampler = torchaudio.transforms.Resample(sr, 16000)
            waveform = resampler(waveform)

        # Move to device
        waveform = waveform.to(DEVICE)

        # Extract embedding
        with torch.no_grad():
            embedding = model.encode_batch(waveform, normalize=False)  # type: ignore

        # Convert to list
        embedding_list = embedding.squeeze().cpu().numpy().tolist()

        # Ensure it's a flat list
        if isinstance(embedding_list, list) and len(embedding_list) > 0:
            if isinstance(embedding_list[0], list):
                embedding_list = embedding_list[0]

        logger.debug(f"Extracted embedding of dimension {len(embedding_list)} from {audio_path}")
        return embedding_list

    except Exception as e:
        logger.error(f"✗ Failed to extract embedding: {e}")
        raise

def compute_similarity(embedding1: List[float], embedding2: List[float]) -> float:
    """
    Compute cosine similarity between two embeddings.

    Args:
        embedding1: First embedding vector
        embedding2: Second embedding vector

    Returns:
        Similarity score between -1 and 1
    """
    try:
        e1 = np.array(embedding1, dtype=np.float32)
        e2 = np.array(embedding2, dtype=np.float32)

        # Cosine similarity
        dot_product = np.dot(e1, e2)
        norm1 = np.linalg.norm(e1)
        norm2 = np.linalg.norm(e2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        similarity = dot_product / (norm1 * norm2)
        return float(similarity)

    except Exception as e:
        logger.error(f"✗ Failed to compute similarity: {e}")
        raise

# Flask app setup
app = Flask(__name__)

@app.route("/health", methods=["GET"])
def health() -> Union[Dict[str, Any], Tuple]:
    """Health check endpoint."""
    try:
        model_loaded = model is not None
        return jsonify({
            "status": "healthy",
            "model_loaded": model_loaded,
            "device": DEVICE,
            "model_name": MODEL_NAME
        })
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

@app.route("/extract-embedding", methods=["POST"])
def extract_embedding_endpoint() -> Union[Dict[str, Any], Tuple]:
    """
    Extract embedding from audio file.

    Request body:
    {
        "audio_path": "/path/to/audio.wav"
    }
    """
    try:
        data = request.get_json()

        if not data or "audio_path" not in data:
            return jsonify({"error": "Missing required field: audio_path"}), 400

        audio_path = data["audio_path"]
        logger.info(f"Processing audio file: {audio_path}")

        embedding = extract_embedding(audio_path)

        return jsonify({
            "success": True,
            "embedding": embedding,
            "dimension": len(embedding),
            "model": MODEL_NAME
        })

    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/batch-extract-embeddings", methods=["POST"])
def batch_extract_embeddings() -> Union[Dict[str, Any], Tuple]:
    """
    Extract embeddings from multiple audio files.

    Request body:
    {
        "audio_paths": ["/path/to/audio1.wav", "/path/to/audio2.wav", ...]
    }
    """
    try:
        data = request.get_json()

        if not data or "audio_paths" not in data:
            return jsonify({"error": "Missing required field: audio_paths"}), 400

        audio_paths = data["audio_paths"]

        if not isinstance(audio_paths, list):
            return jsonify({"error": "audio_paths must be a list"}), 400

        embeddings = []
        errors = []

        for i, audio_path in enumerate(audio_paths):
            try:
                logger.info(f"Processing audio {i+1}/{len(audio_paths)}: {audio_path}")
                embedding = extract_embedding(audio_path)
                embeddings.append({
                    "index": i,
                    "audio_path": audio_path,
                    "embedding": embedding,
                    "success": True
                })
            except Exception as e:
                logger.error(f"Failed to process {audio_path}: {e}")
                errors.append({
                    "index": i,
                    "audio_path": audio_path,
                    "error": str(e)
                })

        return jsonify({
            "success": len(embeddings) > 0,
            "total": len(audio_paths),
            "processed": len(embeddings),
            "errors_count": len(errors),
            "embeddings": embeddings,
            "errors": errors,
            "model": MODEL_NAME
        })

    except Exception as e:
        logger.error(f"Batch processing error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/compute-similarity", methods=["POST"])
def compute_similarity_endpoint() -> Union[Dict[str, Any], Tuple]:
    """
    Compute similarity between two embeddings.

    Request body:
    {
        "embedding1": [...],
        "embedding2": [...]
    }
    """
    try:
        data = request.get_json()

        if not data or "embedding1" not in data or "embedding2" not in data:
            return jsonify({"error": "Missing required fields: embedding1, embedding2"}), 400

        embedding1 = data["embedding1"]
        embedding2 = data["embedding2"]

        similarity = compute_similarity(embedding1, embedding2)

        return jsonify({
            "success": True,
            "similarity": similarity
        })

    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/compute-centroid", methods=["POST"])
def compute_centroid_endpoint() -> Union[Dict[str, Any], Tuple]:
    """
    Compute centroid (mean) of multiple embeddings.

    Request body:
    {
        "embeddings": [[...], [...], ...]
    }
    """
    try:
        data = request.get_json()

        if not data or "embeddings" not in data:
            return jsonify({"error": "Missing required field: embeddings"}), 400

        embeddings = data["embeddings"]

        if not isinstance(embeddings, list) or len(embeddings) == 0:
            return jsonify({"error": "embeddings must be a non-empty list"}), 400

        # Convert to numpy array and compute mean
        embeddings_array = np.array(embeddings, dtype=np.float32)
        centroid = np.mean(embeddings_array, axis=0).tolist()

        return jsonify({
            "success": True,
            "centroid": centroid,
            "dimension": len(centroid),
            "embedding_count": len(embeddings)
        })

    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    port = int(os.getenv("EMBEDDING_SERVICE_PORT", 5001))

    logger.info(f"Starting Embedding Service on port {port}")
    logger.info(f"Model: {MODEL_NAME}")
    logger.info(f"Device: {DEVICE}")

    # Pre-load model on startup
    try:
        load_model()
        logger.info("✓ Model pre-loaded successfully")
    except Exception as e:
        logger.error(f"✗ Failed to pre-load model: {e}")
        sys.exit(1)

    app.run(host="0.0.0.0", port=port, debug=False)
