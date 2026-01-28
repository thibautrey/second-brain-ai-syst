#!/usr/bin/env python3
"""
Speaker Embedding Service using SpeechBrain ECAPA-TDNN

Automatically downloads the ECAPA-TDNN model from HuggingFace on first use.
Caches the model locally for reuse across restarts.
Supports offline mode when model is cached.

Enhanced audio preprocessing for improved speaker recognition accuracy:
- Bandpass filtering (80Hz - 7500Hz) to remove non-vocal frequencies
- Amplitude normalization for consistent input levels
- Voice Activity Detection (VAD) to remove silence
- High-pass filtering to reduce low-frequency noise
"""

import json
import os
import sys
import logging
from pathlib import Path
from typing import List, Dict, Any, Union, Tuple, Optional
from dataclasses import dataclass

# Configure HuggingFace cache BEFORE importing any HF-dependent libraries
os.environ.setdefault("HF_HOME", os.getenv("HF_HOME", "/app/models"))
os.environ.setdefault("HF_HUB_CACHE", os.getenv("HF_HUB_CACHE", "/app/models/hub"))

import numpy as np
from flask import Flask, request, jsonify
import torch
import torchaudio
import torchaudio.functional as F
from scipy import signal as scipy_signal
from scipy.ndimage import uniform_filter1d
from speechbrain.inference.speaker import SpeakerRecognition
from huggingface_hub import login

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
HF_HUB_OFFLINE = os.getenv("HF_HUB_OFFLINE", "0").lower() in ("1", "true", "yes")

# Global model instance
model = None

# ==================== Audio Preprocessing Configuration ====================

@dataclass
class AudioPreprocessingConfig:
    """Configuration for audio preprocessing pipeline."""
    # Bandpass filter settings (human voice frequency range)
    bandpass_low_hz: float = 80.0       # Low cutoff (removes rumble, AC hum)
    bandpass_high_hz: float = 7500.0    # High cutoff (removes hiss, above speech)
    filter_order: int = 5               # Butterworth filter order
    
    # Normalization settings
    target_db: float = -3.0             # Target peak amplitude in dB
    normalize_audio: bool = True
    
    # Voice Activity Detection settings
    vad_enabled: bool = True
    vad_energy_threshold: float = 0.01  # Minimum energy to consider as speech
    vad_frame_ms: int = 30              # Frame size in ms for VAD
    vad_min_speech_ms: int = 250        # Minimum speech segment to keep
    vad_padding_ms: int = 100           # Padding around speech segments
    
    # Pre-emphasis (boosts high frequencies for clearer consonants)
    pre_emphasis_enabled: bool = True
    pre_emphasis_coef: float = 0.97

# Default preprocessing configuration
PREPROCESSING_CONFIG = AudioPreprocessingConfig()

# ==================== Audio Preprocessing Functions ====================

class AudioPreprocessor:
    """
    Audio preprocessing pipeline for improved speaker recognition.
    
    Pipeline:
    1. Resample to 16kHz
    2. Convert to mono
    3. Apply bandpass filter (80Hz - 7500Hz)
    4. Apply pre-emphasis
    5. Remove silence using VAD
    6. Normalize amplitude
    """
    
    def __init__(self, config: AudioPreprocessingConfig = PREPROCESSING_CONFIG):
        self.config = config
        self._filter_cache = {}
    
    def process(self, waveform: torch.Tensor, sample_rate: int) -> Tuple[torch.Tensor, int, Dict[str, Any]]:
        """
        Apply full preprocessing pipeline to audio.
        
        Args:
            waveform: Input audio tensor (channels, samples)
            sample_rate: Input sample rate
            
        Returns:
            Tuple of (processed_waveform, sample_rate, metadata)
        """
        metadata = {
            "original_duration_s": waveform.shape[-1] / sample_rate,
            "original_sample_rate": sample_rate,
            "preprocessing_applied": []
        }
        
        # 1. Resample to 16kHz if needed
        if sample_rate != 16000:
            waveform = torchaudio.functional.resample(waveform, sample_rate, 16000)
            sample_rate = 16000
            metadata["preprocessing_applied"].append("resample_16k")
        
        # 2. Convert to mono if stereo
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
            metadata["preprocessing_applied"].append("mono_conversion")
        
        # 3. Apply bandpass filter
        waveform = self._apply_bandpass_filter(waveform, sample_rate)
        metadata["preprocessing_applied"].append(f"bandpass_{self.config.bandpass_low_hz}_{self.config.bandpass_high_hz}Hz")
        
        # 4. Apply pre-emphasis
        if self.config.pre_emphasis_enabled:
            waveform = self._apply_pre_emphasis(waveform)
            metadata["preprocessing_applied"].append("pre_emphasis")
        
        # 5. Voice Activity Detection - remove silence
        if self.config.vad_enabled:
            waveform, vad_stats = self._apply_vad(waveform, sample_rate)
            metadata["preprocessing_applied"].append("vad")
            metadata["vad_stats"] = vad_stats
        
        # 6. Normalize amplitude
        if self.config.normalize_audio:
            waveform = self._normalize_amplitude(waveform)
            metadata["preprocessing_applied"].append("amplitude_normalization")
        
        metadata["final_duration_s"] = waveform.shape[-1] / sample_rate
        metadata["duration_reduction_pct"] = round(
            (1 - metadata["final_duration_s"] / metadata["original_duration_s"]) * 100, 1
        )
        
        return waveform, sample_rate, metadata
    
    def _apply_bandpass_filter(self, waveform: torch.Tensor, sample_rate: int) -> torch.Tensor:
        """
        Apply Butterworth bandpass filter to isolate speech frequencies.
        Removes low-frequency rumble and high-frequency noise.
        """
        # Convert to numpy for scipy filtering
        audio_np = waveform.squeeze().cpu().numpy()
        
        # Design Butterworth bandpass filter
        nyquist = sample_rate / 2
        low = self.config.bandpass_low_hz / nyquist
        high = self.config.bandpass_high_hz / nyquist
        
        # Clamp to valid range
        low = max(0.001, min(low, 0.99))
        high = max(low + 0.01, min(high, 0.99))
        
        # Create filter
        cache_key = (sample_rate, self.config.bandpass_low_hz, self.config.bandpass_high_hz, self.config.filter_order)
        if cache_key not in self._filter_cache:
            b, a = scipy_signal.butter(
                self.config.filter_order, 
                [low, high], 
                btype='band'
            )
            self._filter_cache[cache_key] = (b, a)
        else:
            b, a = self._filter_cache[cache_key]
        
        # Apply filter (forward-backward for zero phase distortion)
        filtered = scipy_signal.filtfilt(b, a, audio_np)
        
        return torch.from_numpy(filtered).unsqueeze(0).float()
    
    def _apply_pre_emphasis(self, waveform: torch.Tensor) -> torch.Tensor:
        """
        Apply pre-emphasis filter to boost high frequencies.
        Helps with consonant clarity in speaker recognition.
        """
        # Pre-emphasis: y[n] = x[n] - coef * x[n-1]
        emphasized = torch.cat([
            waveform[:, :1],
            waveform[:, 1:] - self.config.pre_emphasis_coef * waveform[:, :-1]
        ], dim=1)
        return emphasized
    
    def _apply_vad(self, waveform: torch.Tensor, sample_rate: int) -> Tuple[torch.Tensor, Dict[str, Any]]:
        """
        Apply Voice Activity Detection to remove silence.
        Uses energy-based detection with smoothing.
        """
        audio_np = waveform.squeeze().cpu().numpy()
        
        # Calculate frame parameters
        frame_size = int(sample_rate * self.config.vad_frame_ms / 1000)
        hop_size = frame_size // 2
        min_speech_frames = int(self.config.vad_min_speech_ms / self.config.vad_frame_ms * 2)
        padding_frames = int(self.config.vad_padding_ms / self.config.vad_frame_ms * 2)
        
        # Calculate frame energies
        num_frames = max(1, (len(audio_np) - frame_size) // hop_size + 1)
        energies = np.zeros(num_frames)
        
        for i in range(num_frames):
            start = i * hop_size
            end = start + frame_size
            if end <= len(audio_np):
                frame = audio_np[start:end]
                energies[i] = np.sqrt(np.mean(frame ** 2))
        
        # Normalize energies
        max_energy = np.max(energies) if np.max(energies) > 0 else 1.0
        normalized_energies = energies / max_energy
        
        # Smooth energies to reduce noise
        smoothed_energies = uniform_filter1d(normalized_energies, size=3)
        
        # Detect speech frames
        speech_frames = smoothed_energies > self.config.vad_energy_threshold
        
        # Apply minimum speech duration filter
        speech_segments = []
        in_speech = False
        segment_start = 0
        
        for i, is_speech in enumerate(speech_frames):
            if is_speech and not in_speech:
                segment_start = i
                in_speech = True
            elif not is_speech and in_speech:
                segment_length = i - segment_start
                if segment_length >= min_speech_frames:
                    # Add padding
                    padded_start = max(0, segment_start - padding_frames)
                    padded_end = min(len(speech_frames), i + padding_frames)
                    speech_segments.append((padded_start, padded_end))
                in_speech = False
        
        # Handle final segment
        if in_speech:
            segment_length = len(speech_frames) - segment_start
            if segment_length >= min_speech_frames:
                padded_start = max(0, segment_start - padding_frames)
                speech_segments.append((padded_start, len(speech_frames)))
        
        # If no speech detected, return original
        if not speech_segments:
            logger.warning("VAD: No speech detected, returning original audio")
            return waveform, {
                "speech_segments": 0,
                "speech_ratio": 0.0,
                "kept_original": True
            }
        
        # Merge overlapping segments
        merged_segments = []
        for start, end in sorted(speech_segments):
            if merged_segments and start <= merged_segments[-1][1]:
                merged_segments[-1] = (merged_segments[-1][0], max(merged_segments[-1][1], end))
            else:
                merged_segments.append((start, end))
        
        # Extract speech portions
        speech_audio = []
        for start_frame, end_frame in merged_segments:
            start_sample = start_frame * hop_size
            end_sample = min(end_frame * hop_size + frame_size, len(audio_np))
            speech_audio.append(audio_np[start_sample:end_sample])
        
        # Concatenate with small crossfade to avoid clicks
        if len(speech_audio) > 1:
            combined = self._crossfade_segments(speech_audio, crossfade_samples=160)
        else:
            combined = speech_audio[0] if speech_audio else audio_np
        
        stats = {
            "speech_segments": len(merged_segments),
            "speech_ratio": round(len(combined) / len(audio_np), 3),
            "kept_original": False
        }
        
        return torch.from_numpy(combined).unsqueeze(0).float(), stats
    
    def _crossfade_segments(self, segments: List[np.ndarray], crossfade_samples: int = 160) -> np.ndarray:
        """Concatenate audio segments with crossfade to avoid clicks."""
        if len(segments) == 0:
            return np.array([])
        if len(segments) == 1:
            return segments[0]
        
        result = segments[0].copy()
        
        for segment in segments[1:]:
            if len(result) >= crossfade_samples and len(segment) >= crossfade_samples:
                # Create crossfade
                fade_out = np.linspace(1, 0, crossfade_samples)
                fade_in = np.linspace(0, 1, crossfade_samples)
                
                result[-crossfade_samples:] *= fade_out
                segment = segment.copy()
                segment[:crossfade_samples] *= fade_in
                
                result[-crossfade_samples:] += segment[:crossfade_samples]
                result = np.concatenate([result, segment[crossfade_samples:]])
            else:
                result = np.concatenate([result, segment])
        
        return result
    
    def _normalize_amplitude(self, waveform: torch.Tensor) -> torch.Tensor:
        """
        Normalize audio amplitude to target dB level.
        Uses peak normalization for consistency.
        """
        audio = waveform.squeeze()
        
        # Find peak amplitude
        peak = torch.max(torch.abs(audio))
        
        if peak > 0:
            # Calculate target amplitude from dB
            target_amplitude = 10 ** (self.config.target_db / 20)
            # Normalize
            normalized = audio * (target_amplitude / peak)
            return normalized.unsqueeze(0)
        
        return waveform

# Global preprocessor instance
audio_preprocessor = AudioPreprocessor()


def check_model_cached() -> bool:
    """
    Check if the model is already cached locally.
    Returns True if model files exist, False otherwise.
    """
    model_subdir = MODEL_CACHE_DIR / MODEL_NAME.split("/")[1]
    if not model_subdir.exists():
        return False
    
    # Check for key model files
    key_files = ["hyperparams.yaml", "model.pt", "label_encoder.txt"]
    for filename in key_files:
        if (model_subdir / filename).exists():
            logger.debug(f"Found cached model file: {filename}")
            return True
    
    return False

def authenticate_with_huggingface():
    """
    Authenticate with Hugging Face using the HF_TOKEN environment variable.
    This ensures the huggingface_hub library can access private or gated models.
    Skipped in offline mode.
    """
    if HF_HUB_OFFLINE:
        logger.info("ℹ Offline mode enabled - skipping Hugging Face authentication")
        return
    
    if HF_TOKEN:
        try:
            login(token=HF_TOKEN, add_to_git_credential=False)
            logger.info("✓ Successfully authenticated with Hugging Face")
        except Exception as e:
            logger.warning(f"⚠ Failed to authenticate with Hugging Face: {e}")
            logger.info("Continuing without explicit authentication")
    else:
        logger.info("ℹ No HF_TOKEN provided, using anonymous access")

def load_model() -> SpeakerRecognition:
    """
    Load ECAPA-TDNN model from SpeechBrain.
    Uses cached model if available, otherwise downloads from HuggingFace.
    Supports offline mode when model is cached.
    """
    global model

    if model is not None:
        logger.debug("Model already loaded")
        return model

    logger.info(f"Loading ECAPA-TDNN model from {MODEL_NAME}")
    logger.info(f"Using device: {DEVICE}")
    logger.info(f"Model cache directory: {MODEL_CACHE_DIR}")
    
    # Check if model is cached
    is_cached = check_model_cached()
    logger.info(f"Model cache status: {'✓ Cached' if is_cached else '✗ Not cached'}")
    
    if HF_HUB_OFFLINE and is_cached:
        logger.info("ℹ Offline mode - using cached model")
    elif HF_HUB_OFFLINE and not is_cached:
        logger.error("✗ Offline mode enabled but model is not cached!")
        logger.error("The model needs to be pre-downloaded with internet access.")
        raise RuntimeError("Model not cached and offline mode is enabled")

    # Create cache directory if it doesn't exist
    MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    try:
        # Prepare kwargs for model loading
        kwargs = {
            "source": MODEL_NAME,
            "savedir": str(MODEL_CACHE_DIR / MODEL_NAME.split("/")[1]),
            "run_opts": {"device": DEVICE}
        }
        
        logger.info("Loading model...")
        
        # Load model with automatic download or from cache
        model = SpeakerRecognition.from_hparams(**kwargs)
        logger.info(f"✓ Model loaded successfully on {DEVICE}")
        return model
    except Exception as e:
        logger.error(f"✗ Failed to load model: {e}")
        logger.error("Possible causes:")
        logger.error("  1. Model not cached and no internet connection")
        logger.error("  2. Corrupted cache - try deleting and re-downloading")
        logger.error("  3. Insufficient disk space")
        raise


def convert_to_wav(audio_path: str) -> str:
    """
    Convert audio file to WAV format using ffmpeg.
    Returns path to converted file (or original if already WAV).
    
    Args:
        audio_path: Path to source audio file
        
    Returns:
        Path to WAV file (temporary file if conversion was needed)
    """
    import subprocess
    import tempfile
    
    # Check if file is already a valid WAV that torchaudio can read
    try:
        waveform, sr = torchaudio.load(audio_path)
        return audio_path  # No conversion needed
    except Exception as e:
        logger.info(f"Cannot load {audio_path} directly, attempting ffmpeg conversion: {e}")
    
    # Create temp file for converted audio
    temp_fd, temp_path = tempfile.mkstemp(suffix='.wav')
    os.close(temp_fd)
    
    try:
        # Use ffmpeg to convert to WAV (16kHz mono for speaker recognition)
        cmd = [
            'ffmpeg', '-y', '-i', audio_path,
            '-acodec', 'pcm_s16le',  # Standard WAV codec
            '-ar', '16000',           # 16kHz sample rate
            '-ac', '1',               # Mono channel
            temp_path
        ]
        
        result = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            logger.error(f"ffmpeg conversion failed: {result.stderr}")
            os.unlink(temp_path)
            raise RuntimeError(f"ffmpeg conversion failed: {result.stderr}")
        
        logger.info(f"Successfully converted {audio_path} to WAV at {temp_path}")
        return temp_path
        
    except subprocess.TimeoutExpired:
        os.unlink(temp_path)
        raise RuntimeError(f"ffmpeg conversion timed out for {audio_path}")
    except FileNotFoundError:
        os.unlink(temp_path)
        raise RuntimeError("ffmpeg not found. Please install ffmpeg.")


def extract_embedding(audio_path: str, apply_preprocessing: bool = True) -> List[float]:
    """
    Extract speaker embedding from audio file.

    Args:
        audio_path: Path to audio file (WAV, MP3, WebM, OGG, etc.)
        apply_preprocessing: Whether to apply audio preprocessing (default: True)

    Returns:
        List of 192 embedding values (ECAPA-TDNN dimension)
    """
    temp_wav_path = None
    try:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Load model if not already loaded
        if model is None:
            load_model()

        # Try to load audio, converting if necessary
        wav_path = convert_to_wav(audio_path)
        temp_wav_path = wav_path if wav_path != audio_path else None
        
        # Load audio
        waveform, sr = torchaudio.load(wav_path)
        
        # Apply preprocessing pipeline for better accuracy
        if apply_preprocessing:
            waveform, sr, preprocess_meta = audio_preprocessor.process(waveform, sr)
            logger.info(f"Preprocessing: {preprocess_meta['preprocessing_applied']}")
            logger.info(f"Duration: {preprocess_meta['original_duration_s']:.2f}s → {preprocess_meta['final_duration_s']:.2f}s ({preprocess_meta['duration_reduction_pct']}% reduction)")
            if 'vad_stats' in preprocess_meta:
                logger.debug(f"VAD stats: {preprocess_meta['vad_stats']}")
        else:
            # Legacy mode: just resample
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
    finally:
        # Clean up temp file if created
        if temp_wav_path and os.path.exists(temp_wav_path):
            try:
                os.unlink(temp_wav_path)
            except Exception as cleanup_err:
                logger.warning(f"Failed to clean up temp file {temp_wav_path}: {cleanup_err}")

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
    """Health check endpoint with detailed model and preprocessing status."""
    try:
        model_loaded = model is not None
        model_cached = check_model_cached()
        
        config = audio_preprocessor.config
        health_status = {
            "status": "healthy" if model_loaded else "initializing",
            "model_loaded": model_loaded,
            "model_cached": model_cached,
            "device": DEVICE,
            "model_name": MODEL_NAME,
            "offline_mode": HF_HUB_OFFLINE,
            "cache_dir": str(MODEL_CACHE_DIR),
            "preprocessing": {
                "enabled": True,
                "bandpass_filter": f"{config.bandpass_low_hz}-{config.bandpass_high_hz}Hz",
                "vad_enabled": config.vad_enabled,
                "normalization": config.normalize_audio,
                "pre_emphasis": config.pre_emphasis_enabled
            }
        }
        
        status_code = 200 if model_loaded else 503
        return jsonify(health_status), status_code
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "model_loaded": False
        }), 500

@app.route("/extract-embedding", methods=["POST"])
def extract_embedding_endpoint() -> Union[Dict[str, Any], Tuple]:
    """
    Extract embedding from audio file with optional preprocessing.

    Request body:
    {
        "audio_path": "/path/to/audio.wav",
        "apply_preprocessing": true  // optional, default: true
    }
    """
    try:
        data = request.get_json()

        if not data or "audio_path" not in data:
            return jsonify({"error": "Missing required field: audio_path"}), 400

        audio_path = data["audio_path"]
        apply_preprocessing = data.get("apply_preprocessing", True)
        
        logger.info(f"Processing audio file: {audio_path} (preprocessing: {apply_preprocessing})")

        embedding = extract_embedding(audio_path, apply_preprocessing=apply_preprocessing)

        return jsonify({
            "success": True,
            "embedding": embedding,
            "dimension": len(embedding),
            "model": MODEL_NAME,
            "preprocessing_applied": apply_preprocessing
        })

    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/preprocessing-config", methods=["GET", "POST"])
def preprocessing_config_endpoint() -> Union[Dict[str, Any], Tuple]:
    """
    Get or update audio preprocessing configuration.
    
    GET: Returns current configuration
    POST: Updates configuration
    
    Request body (POST):
    {
        "bandpass_low_hz": 80.0,
        "bandpass_high_hz": 7500.0,
        "vad_enabled": true,
        "vad_energy_threshold": 0.01,
        "normalize_audio": true,
        "pre_emphasis_enabled": true
    }
    """
    global audio_preprocessor
    
    if request.method == "GET":
        config = audio_preprocessor.config
        return jsonify({
            "success": True,
            "config": {
                "bandpass_low_hz": config.bandpass_low_hz,
                "bandpass_high_hz": config.bandpass_high_hz,
                "filter_order": config.filter_order,
                "target_db": config.target_db,
                "normalize_audio": config.normalize_audio,
                "vad_enabled": config.vad_enabled,
                "vad_energy_threshold": config.vad_energy_threshold,
                "vad_frame_ms": config.vad_frame_ms,
                "vad_min_speech_ms": config.vad_min_speech_ms,
                "vad_padding_ms": config.vad_padding_ms,
                "pre_emphasis_enabled": config.pre_emphasis_enabled,
                "pre_emphasis_coef": config.pre_emphasis_coef
            }
        })
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No configuration provided"}), 400
        
        # Update configuration
        current_config = audio_preprocessor.config
        new_config = AudioPreprocessingConfig(
            bandpass_low_hz=data.get("bandpass_low_hz", current_config.bandpass_low_hz),
            bandpass_high_hz=data.get("bandpass_high_hz", current_config.bandpass_high_hz),
            filter_order=data.get("filter_order", current_config.filter_order),
            target_db=data.get("target_db", current_config.target_db),
            normalize_audio=data.get("normalize_audio", current_config.normalize_audio),
            vad_enabled=data.get("vad_enabled", current_config.vad_enabled),
            vad_energy_threshold=data.get("vad_energy_threshold", current_config.vad_energy_threshold),
            vad_frame_ms=data.get("vad_frame_ms", current_config.vad_frame_ms),
            vad_min_speech_ms=data.get("vad_min_speech_ms", current_config.vad_min_speech_ms),
            vad_padding_ms=data.get("vad_padding_ms", current_config.vad_padding_ms),
            pre_emphasis_enabled=data.get("pre_emphasis_enabled", current_config.pre_emphasis_enabled),
            pre_emphasis_coef=data.get("pre_emphasis_coef", current_config.pre_emphasis_coef)
        )
        
        audio_preprocessor = AudioPreprocessor(new_config)
        logger.info(f"Preprocessing configuration updated: {data}")
        
        return jsonify({
            "success": True,
            "message": "Configuration updated",
            "config": {
                "bandpass_low_hz": new_config.bandpass_low_hz,
                "bandpass_high_hz": new_config.bandpass_high_hz,
                "vad_enabled": new_config.vad_enabled,
                "normalize_audio": new_config.normalize_audio,
                "pre_emphasis_enabled": new_config.pre_emphasis_enabled
            }
        })
        
    except Exception as e:
        logger.error(f"Error updating config: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/batch-extract-embeddings", methods=["POST"])
def batch_extract_embeddings() -> Union[Dict[str, Any], Tuple]:
    """
    Extract embeddings from multiple audio files.

    Request body:
    {
        "audio_paths": ["/path/to/audio1.wav", "/path/to/audio2.wav", ...],
        "apply_preprocessing": true  // optional, default: true
    }
    """
    try:
        data = request.get_json()

        if not data or "audio_paths" not in data:
            return jsonify({"error": "Missing required field: audio_paths"}), 400

        audio_paths = data["audio_paths"]
        apply_preprocessing = data.get("apply_preprocessing", True)

        if not isinstance(audio_paths, list):
            return jsonify({"error": "audio_paths must be a list"}), 400

        embeddings = []
        errors = []

        for i, audio_path in enumerate(audio_paths):
            try:
                logger.info(f"Processing audio {i+1}/{len(audio_paths)}: {audio_path}")
                embedding = extract_embedding(audio_path, apply_preprocessing=apply_preprocessing)
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
            "model": MODEL_NAME,
            "preprocessing_applied": apply_preprocessing
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
    logger.info(f"Offline mode: {HF_HUB_OFFLINE}")
    
    # Log preprocessing configuration
    config = PREPROCESSING_CONFIG
    logger.info("Audio Preprocessing Configuration:")
    logger.info(f"  - Bandpass filter: {config.bandpass_low_hz}Hz - {config.bandpass_high_hz}Hz")
    logger.info(f"  - VAD enabled: {config.vad_enabled} (threshold: {config.vad_energy_threshold})")
    logger.info(f"  - Normalization: {config.normalize_audio} (target: {config.target_db}dB)")
    logger.info(f"  - Pre-emphasis: {config.pre_emphasis_enabled} (coef: {config.pre_emphasis_coef})")

    # Authenticate with Hugging Face first (skipped in offline mode)
    authenticate_with_huggingface()

    # Pre-load model on startup
    try:
        load_model()
        logger.info("✓ Model pre-loaded successfully")
    except RuntimeError as e:
        logger.error(f"✗ Failed to pre-load model: {e}")
        if HF_HUB_OFFLINE:
            logger.error("✗ FATAL: Offline mode enabled but model not cached.")
            logger.error("Please ensure the model is cached before running in offline mode.")
            sys.exit(1)
        else:
            logger.warning("⚠ Model will be loaded on first request.")
            logger.warning("Ensure internet connection is available for model download.")
    except Exception as e:
        logger.error(f"✗ Unexpected error during model loading: {e}")
        sys.exit(1)

    logger.info("✓ Embedding Service ready")
    app.run(host="0.0.0.0", port=port, debug=False)
