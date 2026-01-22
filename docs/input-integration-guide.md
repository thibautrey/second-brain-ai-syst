# Input Ingestion Integration Guide

## Overview

This guide explains how to integrate the Input Ingestion System with the Intent Router Agent to create a complete input pipeline.

---

## Architecture Flow

```
User Input (Text/Audio)
    ↓
[Input Ingestion Service]
    ├─ Text Handler
    ├─ Audio Stream Handler
    └─ Audio Batch Handler
    ↓
[Speaker Recognition Service]
    ├─ Speaker Identification
    ├─ Diarization (if multi-speaker)
    └─ Confidence Scoring
    ↓
[Unified Input Format]
    ├─ content (transcribed text)
    ├─ speaker_id (identified or assumed)
    ├─ speaker_confidence (0.0-1.0)
    └─ metadata
    ↓
[Intent Router Agent]
    ├─ Classify input type
    ├─ Assess temporal context
    ├─ Retrieve relevant memories
    └─ Route to handler
```

---

## Integration Steps

### Step 1: Initialize Services

```typescript
import { InputIngestionService } from "./backend/services/input-ingestion";
import {
  SpeakerRecognitionService,
  SpeakerRecognitionModel,
} from "./backend/services/speaker-recognition";
import { IntentRouterAgent } from "./backend/services/intent-router";

// Initialize speaker recognition
const speakerConfig = {
  model: SpeakerRecognitionModel.ECAPA_TDNN,
  threshold_high: 0.85,
  threshold_low: 0.7,
  window_seconds: 3,
  use_vad: true,
  use_diarization: false,
  multi_speaker_mode: false,
  device: "auto" as const,
};

const speakerService = new SpeakerRecognitionService(speakerConfig);

// Initialize input ingestion
const ingestionConfig = {
  // Configuration options
};

const ingestionService = new InputIngestionService(ingestionConfig);

// Initialize intent router
const intentRouter = new IntentRouterAgent(config);
```

### Step 2: Setup Event Listeners

```typescript
// Listen for processed inputs
ingestionService.on("input:processed", async (processedInput) => {
  try {
    // Pass to Intent Router
    const routerResult = await intentRouter.route({
      content: processedInput.content,
      speaker_id: processedInput.speaker.speaker_id,
      speaker_confidence: processedInput.speaker.confidence,
      input_format: processedInput.format,
      timestamp: processedInput.timestamp,
      metadata: {
        ...processedInput.metadata,
        speaker_method: processedInput.speaker.method,
      },
    });

    // Handle router result
    console.log(`Routed to: ${routerResult.handler_type}`);
  } catch (error) {
    console.error("Error routing input:", error);
  }
});

ingestionService.on("input:error", (errorInput) => {
  console.error(`Input processing failed: ${errorInput.error}`);
});
```

### Step 3: Enroll Speakers

```typescript
// Load audio samples for enrollment
const audioSample1 = fs.readFileSync("enrollment_sample_1.wav");
const audioSample2 = fs.readFileSync("enrollment_sample_2.wav");
const audioSample3 = fs.readFileSync("enrollment_sample_3.wav");

// Enroll speaker
const profile = await speakerService.enrollSpeaker(
  "user_1",
  "Thibaut Rey",
  [audioSample1, audioSample2, audioSample3],
  16000, // sample rate
);

console.log(`Speaker enrolled: ${profile.speaker_id}`);
console.log(`Confidence mean: ${profile.confidence_scores.mean.toFixed(3)}`);
```

### Step 4: Process Text Input

```typescript
// Simple text input
const textResult = await ingestionService.processTextInput({
  content: "I met with John about the project today",
  speaker_id: "user_1",
  metadata: {
    source: "chat_interface",
    timestamp: new Date(),
  },
});

console.log(`Processed: ${textResult.id}`);
console.log(`Speaker: ${textResult.speaker.speaker_id}`);
```

### Step 5: Process Audio Batch

```typescript
// Load audio file
const audioData = fs.readFileSync("voice_note.wav");

// Submit as batch
const batchResult = await ingestionService.processAudioBatch({
  chunk_id: "batch_001",
  sequence_number: 1,
  audio_data: audioData,
  is_final: true,
  timestamp: new Date(),
});

if (batchResult) {
  console.log(`Completed: ${batchResult.id}`);
  console.log(`Content: ${batchResult.content}`);
  console.log(`Speaker confidence: ${batchResult.speaker.confidence}`);
}
```

### Step 6: Setup Audio Stream (Real-time)

```typescript
// Start stream
const processor = ingestionService.startAudioStream({
  sample_rate: 16000,
  channels: 1,
  encoding: "pcm16",
});

// In your audio capture loop:
const audioChunk = captureAudioFrame(); // From WebRTC, microphone, etc.
processor.addChunk(audioChunk);

// When audio is complete:
const streamResult = await processor.finalize();
console.log(`Stream completed: ${streamResult.id}`);
```

---

## API Routes

### Input Processing

```
POST   /api/input/text              → Process text input
POST   /api/input/audio-stream/start → Initialize audio stream
POST   /api/input/audio-batch        → Submit audio batch
GET    /api/input                    → List all processed inputs
GET    /api/input/:input_id          → Get specific input
```

### Speaker Management

```
POST   /api/speakers/enroll          → Enroll new speaker
POST   /api/speakers/identify        → Identify speaker from audio
POST   /api/speakers/:id/update      → Update speaker profile
GET    /api/speakers                 → List all speaker profiles
GET    /api/speakers/:id             → Get specific speaker profile
DELETE /api/speakers/:id             → Delete speaker profile
POST   /api/speakers/export          → Export profiles for backup
POST   /api/speakers/import          → Import profiles from backup
```

---

## WebSocket Integration (for Real-time Audio Streams)

```typescript
// In your WebSocket handler:
io.on("connection", (socket) => {
  let streamProcessor: AudioStreamProcessor | null = null;

  socket.on("stream:start", (config: AudioStreamConfig) => {
    streamProcessor = ingestionService.startAudioStream(config);
    socket.emit("stream:started", { stream_id: streamProcessor.id });
  });

  socket.on("stream:chunk", (chunk: Buffer) => {
    if (streamProcessor) {
      streamProcessor.addChunk(chunk);
      socket.emit("stream:chunk_received", {
        duration: streamProcessor.getDuration(),
      });
    }
  });

  socket.on("stream:finish", async () => {
    if (streamProcessor) {
      const result = await streamProcessor.finalize();
      socket.emit("stream:completed", result);
      streamProcessor = null;
    }
  });

  socket.on("disconnect", () => {
    streamProcessor = null;
  });
});
```

---

## Configuration Examples

### Lightweight (Text + Audio Batch)

```json
{
  "speaker_recognition": {
    "model": "ecapa-tdnn",
    "threshold_high": 0.85,
    "threshold_low": 0.7,
    "window_seconds": 3,
    "use_vad": true,
    "use_diarization": false,
    "device": "cpu"
  },
  "input_formats": ["text", "audio_batch"]
}
```

### Full-featured (All formats + Diarization)

```json
{
  "speaker_recognition": {
    "model": "pyannote",
    "threshold_high": 0.85,
    "threshold_low": 0.7,
    "window_seconds": 3,
    "use_vad": true,
    "use_diarization": true,
    "multi_speaker_mode": true,
    "device": "gpu"
  },
  "input_formats": ["text", "audio_stream", "audio_batch"],
  "streaming": {
    "buffer_size_seconds": 5,
    "chunk_size_ms": 100,
    "transcription_engine": "openai_whisper"
  }
}
```

---

## Error Handling

```typescript
try {
  const result = await ingestionService.processTextInput({
    content: userInput,
  });
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
    console.error("Invalid input:", error.message);
  } else if (error instanceof ProcessingError) {
    // Handle processing errors
    console.error("Processing failed:", error.message);
  } else {
    // Handle unknown errors
    console.error("Unknown error:", error);
  }
}
```

---

## Performance Monitoring

```typescript
// Track processing metrics
ingestionService.on("input:processed", (input) => {
  console.log(`
    Format: ${input.format}
    Processing time: ${input.metadata.processing_time_ms}ms
    Speaker confidence: ${input.speaker.confidence}
    Status: ${input.status}
  `);

  // Send to monitoring service
  metrics.record("input_processing_time", input.metadata.processing_time_ms);
  metrics.record("speaker_confidence", input.speaker.confidence);
});
```

---

## Testing

### Unit Tests

```typescript
describe("InputIngestionService", () => {
  it("should process text input", async () => {
    const result = await ingestionService.processTextInput({
      content: "Test message",
      speaker_id: "test_user",
    });

    expect(result.status).toBe(InputStatus.COMPLETED);
    expect(result.content).toBe("Test message");
  });

  it("should identify speaker", async () => {
    // Enroll speaker first
    const profile = await speakerService.enrollSpeaker(
      "test_speaker",
      "Test Speaker",
      [audioSample1, audioSample2, audioSample3],
    );

    // Identify
    const match = await speakerService.identifySpeaker(audioSample1);
    expect(match.speaker_id).toBe("test_speaker");
    expect(match.confidence).toBeGreaterThan(0.85);
  });
});
```

---

## Security Considerations

1. **Input Validation**: Validate all audio data formats and sizes
2. **Speaker Privacy**: Store embeddings securely, never store raw audio
3. **Rate Limiting**: Implement rate limits on speaker enrollment and identification
4. **Access Control**: Restrict speaker profile access to authorized users
5. **Data Encryption**: Encrypt embeddings at rest and in transit

---

## Next Steps

1. Implement actual speech-to-text transcription (Whisper API, Google Cloud Speech-to-Text)
2. Integrate speaker recognition models (SpeechBrain, WeSpeaker, pyannote)
3. Implement Voice Activity Detection (WebRTC VAD)
4. Add real-time streaming support with WebSocket
5. Setup monitoring and observability
6. Performance optimization and caching

---

**Status**: Ready for Integration
**Last Updated**: 2026-01-22
