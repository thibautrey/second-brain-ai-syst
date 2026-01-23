# Embedding Model Cache Management

## Problem Solved

Previously, the embedding service tried to download the ECAPA-TDNN speaker recognition model from Hugging Face on every startup. This caused failures when:

- No internet connection available
- Network timeouts
- DNS resolution issues
- Container restart without connection

## Solution

The embedding model is now **cached locally** and **reused across restarts**. The service supports both online and offline modes.

### Architecture

```
┌─────────────────────────────────────────┐
│ First Start (with internet)              │
│ 1. download-model.py downloads model    │
│ 2. Model cached in /app/models volume   │
│ 3. embedding-service.py loads from cache│
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│ Subsequent Restarts (with/without inet) │
│ 1. Check if model cached                │
│ 2. Load from cache (/app/models)        │
│ 3. Service starts immediately           │
└─────────────────────────────────────────┘
```

## Usage

### Option 1: Normal Mode (Auto-download on first start)

Default mode - model will be downloaded on first start with internet:

```bash
# Start service (will download model on first run)
docker compose up embedding-service

# Check status
curl http://localhost:5001/health
```

Response example:

```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_cached": true,
  "device": "cpu",
  "model_name": "speechbrain/spkrec-ecapa-voxceleb",
  "offline_mode": false,
  "cache_dir": "/app/models"
}
```

### Option 2: Pre-download Model (Recommended for CI/CD)

Download model with internet, then run offline:

```bash
# 1. Pre-download the model (with internet)
./scripts/download-embedding-model.sh

# 2. Rebuild Docker image with cached model
docker compose build embedding-service

# 3. Run without internet (will use cached model)
HF_HUB_OFFLINE=1 docker compose up embedding-service
```

### Option 3: Offline Mode (Production)

For environments without internet access:

```bash
# Set offline mode
export HF_HUB_OFFLINE=1

# Start service (must have cached model)
docker compose up embedding-service

# Verify model is cached
curl http://localhost:5001/health
```

## How Caching Works

### Model Cache Location

- **Inside container**: `/app/models/`
- **Docker volume**: `embedding_models` (persistent across restarts)
- **Key files cached**:
  - `hyperparams.yaml` - Model configuration
  - `model.pt` - Model weights
  - `label_encoder.txt` - Label encoding

### Cache Detection

The service automatically detects if model is cached:

```python
# Check if model cached
is_cached = check_model_cached()

# If cached and offline mode:
# → Load from cache immediately
#
# If not cached and offline mode:
# → ERROR: Cannot proceed without internet
#
# If not cached and online mode:
# → Download and cache
```

### Cache Persistence

The `embedding_models` Docker volume ensures:

- Model persists across container restarts
- Model survives `docker compose down`
- Can be backed up/shared between instances

## Troubleshooting

### Issue: "Model not cached and offline mode is enabled"

**Cause**: Offline mode (`HF_HUB_OFFLINE=1`) set but model not cached

**Solution**:

```bash
# 1. Remove offline mode
unset HF_HUB_OFFLINE

# 2. Start service with internet to download model
docker compose up embedding-service

# 3. Wait for "✓ Model pre-loaded successfully"

# 4. Now you can use offline mode
export HF_HUB_OFFLINE=1
docker compose restart embedding-service
```

### Issue: "Connection error, cannot find files in disk cache"

**Cause**: Model partially corrupted or cache corrupted

**Solution**:

```bash
# Clear cache and re-download
docker volume rm second-brain-ai-syst_embedding_models

# Restart with internet
docker compose up embedding-service

# Wait for complete download
```

### Issue: Service takes long time to start

**Cause**: First-time download of ~500MB model

**Solution**: This is normal for first start with internet. Subsequent restarts will be instant (load from cache).

## Environment Variables

| Variable          | Default       | Purpose                           |
| ----------------- | ------------- | --------------------------------- |
| `MODEL_CACHE_DIR` | `/app/models` | Where to cache model files        |
| `HF_HUB_OFFLINE`  | `0`           | Set to `1` for offline-only mode  |
| `HF_TOKEN`        | (empty)       | Hugging Face API token (optional) |

## Performance

### Time Comparison

| Scenario               | Time       | Notes                       |
| ---------------------- | ---------- | --------------------------- |
| First start (download) | ~2-3 min   | Depends on internet speed   |
| Restart (cached)       | ~10-30 sec | Load from persistent volume |
| Health check (cached)  | <100ms     | Model in memory             |

## Architecture Details

See [embedding-service.py](../../backend/services/embedding-service.py) for:

- `check_model_cached()` - Cache detection
- `load_model()` - Model loading with offline support
- `/health` endpoint - Status and cache info

See [Dockerfile.embedding](../../docker/Dockerfile.embedding) for:

- `download-model.py` execution (build-time download)
- Volume mounting for persistence
- Offline mode environment setup
