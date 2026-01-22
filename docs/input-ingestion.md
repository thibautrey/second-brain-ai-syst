# Input Ingestion Architecture

## Overview

The input ingestion system handles multiple input modalities and converts them into a unified format for the Intent Router Agent. This document describes the architecture, supported formats, and speaker identification strategies.

---

## Supported Input Formats

### 1. Text Input

- **Description**: Simple text-based input from user
- **Features**: Lowest latency, no speaker identification needed (assumed user)
- **Use Case**: Chat interfaces, CLI, text-based APIs
- **Processing**: Direct → Intent Router

### 2. Audio Stream (Real-time)

- **Description**: Continuous audio stream from client
- **Protocol**: WebSocket or gRPC for bidirectional communication
- **Features**: Full backend processing, diarization support
- **Use Case**: Live conversation capture, voice assistants
- **Processing**:
  - Voice Activity Detection (VAD)
  - Speech-to-Text transcription
  - Speaker diarization/identification
  - Intent Router

### 3. Audio Batch (Chunked)

- **Description**: Audio packets (3-10s chunks) sent periodically
- **Protocol**: HTTP/WebSocket with buffering
- **Features**: Partial backend processing, requires buffer management
- **Use Case**: Mobile/IoT devices with limited streaming capability
- **Processing**:
  - Buffer accumulation
  - VAD on chunks
  - Incremental transcription
  - Speaker identification
  - Intent Router

---

## Speaker Identification Options

### Option A: SpeechBrain ECAPA-TDNN

**Best for**: Reliable open-source baseline with good accuracy

- **Enrollment**: Store 3-10 audio clips per speaker → average embeddings
- **Query**: Extract embedding from new audio → cosine similarity
- **Speed**: CPU-fast; GPU instant
- **Pros**: Battle-tested, excellent quality/complexity tradeoff
- **Cons**: Single speaker focused, no diarization
- **Latency**: ~500ms-2s per comparison

**Implementation**:

```python
from speechbrain.pretrained import SpeakerRecognition
model = SpeakerRecognition.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")
similarity = model.similarity(enroll_audio, test_audio)
```

### Option B: WeSpeaker

**Best for**: Production-grade speaker embedding pipeline

- **Focus**: Speaker embedding learning + verification
- **Approach**: Extract embeddings → compare vectors
- **Speed**: Production-optimized, tight control over feature extraction
- **Pros**: Purpose-built for production, flexible architecture
- **Cons**: Less community examples than SpeechBrain
- **Latency**: ~400ms-1.5s per comparison

**Implementation**:

```python
from wespeaker.models import Speaker
model = Speaker.from_pretrained('wespeaker/english_speaker')
embedding = model.extract_embedding(audio)
```

### Option C: pyannote.audio (Recommended for multi-speaker)

**Best for**: Multi-speaker audio with diarization needs

- **Pipeline**: Diarization → Speaker segmentation → Embedding comparison
- **Capabilities**: Who spoke when? Is target speaker present?
- **Pros**: Handles multiple speakers, production-grade
- **Cons**: Higher latency, more compute-intensive
- **Latency**: ~2-5s for batch, ~1-3s for short segments

**Implementation**:

```python
from pyannote.audio import Pipeline
diarization_pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.0")
diarization = diarization_pipeline(audio_file)

# Then compare embeddings from each speaker cluster
```

### Option D: Resemblyzer

**Best for**: Lightweight prototypes, quick integration

- **Model**: Fixed-size voice embeddings
- **Approach**: Simple embedding comparison
- **Speed**: Very fast (CPU-friendly)
- **Pros**: Minimal dependencies, quick to integrate
- **Cons**: Less SOTA, may need tuning
- **Latency**: ~200-500ms per comparison

---

## Recommended Implementation Strategy

### 1. Short Window Embedding

- Use VAD (Voice Activity Detection) to detect speech
- Stop embedding after N seconds of voiced frames (e.g., 3s)
- Keeps latency predictable (<2s)

### 2. Robust Speaker Profiles

Store multiple embeddings per speaker:

- **Centroid approach**: Average embeddings from enrollment
- **K-best approach**: Store top K reference embeddings, use best match

### 3. Threshold-based Matching

```
Similarity ≥ T_high      → Confirmed speaker
T_low ≤ Similarity < T_high → Uncertain (LLM caution)
Similarity < T_low       → Unknown/Different speaker
```

### 4. Multi-speaker Detection (pyannote)

```
diarization → extract segments by speaker
extract embedding per segment/cluster
compare each to known speaker profiles
if any exceeds threshold → target present
```

---

## Data Flow

### Text Input

```
User Text Input
    ↓
[Normalize & Metadata]
    ↓
[Intent Router] → Speaker: assumed "user"
    ↓
Process
```

### Audio Stream

```
WebSocket Audio Stream
    ↓
[Buffer & VAD]
    ↓
[Transcription Service]
    ↓
[Speaker Identification]
    ↓
[Intent Router] → With speaker ID
    ↓
Process
```

### Audio Batch

```
Audio Chunk (3-10s)
    ↓
[Accumulate in Buffer]
    ↓
[VAD on Latest Chunk]
    ↓
[Incremental Transcription]
    ↓
[Speaker ID per Chunk]
    ↓
[Intent Router] → With speaker ID + confidence
    ↓
Process
```

---

## Configuration & Enrollment

### Speaker Enrollment

```json
{
  "speaker_id": "thibaut",
  "enrollment_date": "2026-01-22T10:30:00Z",
  "embeddings": [
    { "embedding": [...], "source": "daily_note_20260122", "timestamp": "..." },
    { "embedding": [...], "source": "daily_note_20260121", "timestamp": "..." }
  ],
  "centroid_embedding": [...],
  "model_version": "ecapa-tdnn-1.0",
  "confidence_scores": { "mean": 0.92, "std": 0.05 }
}
```

### Matching Configuration

```json
{
  "speaker_recognition": {
    "model": "ecapa-tdnn",
    "threshold_high": 0.85,
    "threshold_low": 0.7,
    "window_seconds": 3,
    "use_diarization": false,
    "multi_speaker_mode": false
  }
}
```

---

## Performance Targets

| Format       | Latency           | Accuracy | Scalability |
| ------------ | ----------------- | -------- | ----------- |
| Text         | <100ms            | 100%     | High        |
| Audio Stream | <2s (with buffer) | 90-95%   | Medium      |
| Audio Batch  | <3s per chunk     | 85-90%   | Medium-High |

---

## Next Steps

1. **Phase 1**: Implement text + basic audio batch (Option A: ECAPA-TDNN)
2. **Phase 2**: Add real-time audio streaming with buffer management
3. **Phase 3**: Integrate multi-speaker diarization (Option C: pyannote)
4. **Phase 4**: Production optimization & model selection based on metrics

---

**Status**: Design Phase
**Last Updated**: 2026-01-22
