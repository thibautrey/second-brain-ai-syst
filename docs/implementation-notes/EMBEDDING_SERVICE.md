# ECAPA-TDNN Model Implementation Guide

## Overview

The Second Brain AI System now includes a fully functional speaker recognition service using the **ECAPA-TDNN** model from SpeechBrain. The model automatically downloads from HuggingFace on first use and caches locally for subsequent runs.

## Architecture

### Components

1. **Python Embedding Service** (`backend/services/embedding-service.py`)
   - Flask REST API for embedding extraction
   - ECAPA-TDNN model from SpeechBrain
   - Automatic model downloading on first run
   - Batch processing support
   - Endpoints:
     - `/health` - Health check
     - `/extract-embedding` - Extract single embedding
     - `/batch-extract-embeddings` - Extract multiple embeddings
     - `/compute-similarity` - Compute cosine similarity
     - `/compute-centroid` - Compute centroid of embeddings

2. **TypeScript Embedding Wrapper** (`backend/services/embedding-wrapper.ts`)
   - Manages Python service lifecycle
   - HTTP client for API calls
   - Automatic service startup on first use
   - Singleton pattern for reuse

3. **Training Processor** (`backend/services/training-processor.ts`)
   - Updated to use real embeddings
   - Automatic model initialization
   - Progress tracking during training
   - Error handling with fallbacks

## Model Details

- **Model Name**: SpeechBrain ECAPA-TDNN (`speechbrain/spkrec-ecapa-voxceleb`)
- **Embedding Dimension**: 192
- **Training Dataset**: VoxCeleb
- **Framework**: PyTorch
- **Download Size**: ~100-200 MB

## Setup

### Prerequisites

```bash
# Backend dependencies (Node.js)
cd backend
npm install

# Python dependencies
pip install -r backend/requirements.txt
```

### Environment Variables

```bash
# .env
EMBEDDING_SERVICE_HOST=localhost  # or embedding-service in Docker
EMBEDDING_SERVICE_PORT=5001
MODEL_CACHE_DIR=./models
```

### Running Locally

```bash
# Terminal 1: Start the Python embedding service
python3 backend/services/embedding-service.py

# Terminal 2: Start the backend API
cd backend
npm run dev
```

### Running with Docker

```bash
# Build and start all services
docker compose up --build

# The embedding service will start automatically
# Model downloads on first run (may take a few minutes)
```

## First Use

When the system starts for the first time:

1. **Embedding Service** initializes
2. **Model Download** begins (automatically downloads `speechbrain/spkrec-ecapa-voxceleb`)
3. **Model Caching** stores in `./models` directory
4. **Service Ready** for embedding extraction

### Download Process

```
[Embedding Service] Loading ECAPA-TDNN model from speechbrain/spkrec-ecapa-voxceleb
[Embedding Service] Using device: cuda (if available) or cpu
[Embedding Service] Model cache directory: ./models
[Embedding Service] Downloading model files...
[Embedding Service] ✓ Model loaded successfully
[Embedding Service] Starting Embedding Service on port 5001
```

## Usage in Training

When a training session starts:

```typescript
// 1. Extract embeddings from audio files
const embeddingService = await getEmbeddingService();
const embeddings = await embeddingService.batchExtractEmbeddings(audioPaths);

// 2. Compute centroid (speaker profile)
const centroid = await embeddingService.computeCentroid(embeddings);

// 3. Compute similarity between speakers
const similarity = await embeddingService.computeSimilarity(
  embedding1,
  embedding2,
);
```

## API Endpoints

### Extract Single Embedding

```bash
POST /extract-embedding
Content-Type: application/json

{
  "audio_path": "/path/to/audio.wav"
}

Response:
{
  "success": true,
  "embedding": [...192 values...],
  "dimension": 192,
  "model": "speechbrain/spkrec-ecapa-voxceleb"
}
```

### Batch Extract Embeddings

```bash
POST /batch-extract-embeddings
Content-Type: application/json

{
  "audio_paths": [
    "/path/to/audio1.wav",
    "/path/to/audio2.wav",
    "/path/to/audio3.wav"
  ]
}

Response:
{
  "success": true,
  "total": 3,
  "processed": 3,
  "errors_count": 0,
  "embeddings": [
    {
      "index": 0,
      "audio_path": "/path/to/audio1.wav",
      "embedding": [...],
      "success": true
    },
    ...
  ]
}
```

### Compute Similarity

```bash
POST /compute-similarity
Content-Type: application/json

{
  "embedding1": [...192 values...],
  "embedding2": [...192 values...]
}

Response:
{
  "success": true,
  "similarity": 0.85
}
```

### Compute Centroid

```bash
POST /compute-centroid
Content-Type: application/json

{
  "embeddings": [
    [...192 values...],
    [...192 values...],
    [...192 values...]
  ]
}

Response:
{
  "success": true,
  "centroid": [...192 values...],
  "dimension": 192,
  "embedding_count": 3
}
```

## Performance Considerations

### CPU vs GPU

The service automatically detects GPU availability:

```python
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
```

- **GPU**: Much faster (10-50x) - requires CUDA setup
- **CPU**: Works on any machine, slower but functional

### Model Caching

- First run: Downloads ~150 MB model (~5-10 minutes on average connection)
- Subsequent runs: Uses cached model (~1-2 seconds startup)
- Cache location: `./models/spkrec-ecapa-voxceleb`

### Timeout

- Default timeout: 5 minutes (300 seconds)
- Batch processing: Linear with number of files

## Troubleshooting

### Model Download Fails

```
Error: Failed to load model
Solution: Check internet connection, ensure write access to ./models directory
```

### Service Not Ready

```
Error: Embedding service is not ready
Solution: Wait 30+ seconds for model to download and initialize
```

### Audio File Not Found

```
Error: Audio file not found: /path/to/audio.wav
Solution: Verify file paths are absolute and files exist
```

### Out of Memory (GPU)

```
Error: CUDA out of memory
Solution: Reduce batch size or use CPU instead
```

## Architecture Diagram

```
┌─────────────────────────────────────┐
│     Training Processor              │
│  (training-processor.ts)            │
└─────────────┬───────────────────────┘
              │
              │ HTTP Calls
              ▼
┌─────────────────────────────────────┐
│   Embedding Wrapper Service         │
│  (embedding-wrapper.ts)             │
│  - Service lifecycle management     │
│  - HTTP client                      │
└─────────────┬───────────────────────┘
              │ HTTP
              ▼
┌─────────────────────────────────────┐
│   Python Embedding Service          │
│  (embedding-service.py)             │
│  - Flask REST API                   │
│  - ECAPA-TDNN Model                 │
│  - Model caching                    │
└─────────────┬───────────────────────┘
              │
              ▼ Models
     ┌────────────────────┐
     │  HuggingFace Repo  │
     │  (First download)  │
     └────────────────────┘
```

## Integration Checklist

- [x] Python embedding service with ECAPA-TDNN
- [x] Automatic model downloading on first run
- [x] TypeScript wrapper for lifecycle management
- [x] Integration with training processor
- [x] Docker container setup
- [x] Health checks and error handling
- [x] Batch processing support
- [x] Similarity and centroid computation

## Next Steps

1. **Test the system**: Run training with audio files
2. **Monitor performance**: Check inference times and memory usage
3. **Optimize batch sizes**: Based on your hardware
4. **Consider alternatives**: If needed (WeSpeaker, pyannote)
5. **Tune thresholds**: Adjust similarity thresholds for your use case

## Files Modified/Created

- ✅ `backend/services/embedding-service.py` - Python embedding service
- ✅ `backend/services/embedding-wrapper.ts` - TypeScript wrapper
- ✅ `backend/services/training-processor.ts` - Updated to use real embeddings
- ✅ `backend/services/api-server.ts` - Initialize embedding service on startup
- ✅ `backend/requirements.txt` - Python dependencies
- ✅ `backend/package.json` - Added axios dependency
- ✅ `docker-compose.yml` - Added embedding service
- ✅ `docker/Dockerfile.embedding` - Embedding service container
