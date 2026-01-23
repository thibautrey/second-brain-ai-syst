# Continuous Listening Feature Implementation

## 📋 Overview

This document describes the implementation of the "Continuous Listening" feature - an always-on audio capture and processing system that:

1. **Captures audio continuously** via WebSocket streaming
2. **Detects voice activity** (VAD) to identify speech segments
3. **Identifies the speaker** using voice embeddings
4. **Transcribes speech** using the user's configured AI provider
5. **Detects wake words** to distinguish between passive capture and active commands
6. **Classifies intent** to determine storage vs command execution
7. **Stores relevant memories** based on importance scoring

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  AudioProcessor (PCM16 @ 16kHz) ──► WebSocket ──► Backend                  │
│  ContinuousListeningContext (State Management)                              │
│  ContinuousListeningButton / Panel (UI)                                     │
│  SettingsPage (Configuration)                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Backend (Node.js)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  WebSocket Server (/ws/continuous-listen)                                   │
│       │                                                                      │
│       ▼                                                                      │
│  ContinuousListeningService (Session Management)                            │
│       │                                                                      │
│       ├──► CircularAudioBuffer (30s main, 10s speech)                       │
│       │                                                                      │
│       ├──► VoiceActivityDetector (Energy + Zero-crossing)                   │
│       │         │                                                            │
│       │         ▼                                                            │
│       │    Speech Segment Accumulated                                        │
│       │         │                                                            │
│       │         ▼                                                            │
│       ├──► Speaker Identification (ECAPA-TDNN via Python)                   │
│       │         │                                                            │
│       │         ▼                                                            │
│       │    Is Target User?                                                   │
│       │         │                                                            │
│       │         ▼                                                            │
│       ├──► Transcription (OpenAI Whisper / Configured Provider)             │
│       │         │                                                            │
│       │         ▼                                                            │
│       ├──► Wake Word Detection (Fuzzy matching)                             │
│       │         │                                                            │
│       │    ┌────┴────┐                                                       │
│       │    │         │                                                       │
│       │    ▼         ▼                                                       │
│       │  Command   Passive Speech                                            │
│       │    │         │                                                       │
│       │    ▼         ▼                                                       │
│       └──► IntentRouter (LLM Classification)                                │
│                 │                                                            │
│            ┌────┴────┐                                                       │
│            │         │                                                       │
│            ▼         ▼                                                       │
│       Execute     Store Memory                                              │
│       Command     (if importance > threshold)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Files Created/Modified

### New Files

| File                                           | Purpose                                               |
| ---------------------------------------------- | ----------------------------------------------------- |
| `backend/services/continuous-listening.ts`     | Core service with VAD, speaker ID, session management |
| `src/types/continuous-listening.ts`            | TypeScript type definitions                           |
| `src/contexts/ContinuousListeningContext.tsx`  | React context for state management                    |
| `src/components/ContinuousListeningButton.tsx` | Toggle button with status indicators                  |
| `src/components/ContinuousListeningPanel.tsx`  | Full control panel with statistics                    |

### Modified Files

| File                                | Changes                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `backend/prisma/schema.prisma`      | Added `UserSettings` model                              |
| `backend/services/api-server.ts`    | Added WebSocket server, user settings API routes        |
| `backend/services/intent-router.ts` | Enhanced with LLM classification and importance scoring |
| `src/pages/SettingsPage.tsx`        | Added "Écoute Continue" settings tab                    |
| `src/App.tsx`                       | Integrated `ContinuousListeningProvider`                |

---

## 🗄️ Database Schema

### UserSettings Model

```prisma
model UserSettings {
    id     String @id @default(cuid())
    userId String @unique
    user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

    // Continuous Listening Settings
    continuousListeningEnabled Boolean @default(false)
    wakeWord                   String  @default("Hey Brain")
    wakeWordSensitivity        Float   @default(0.8)
    minImportanceThreshold     Float   @default(0.3)
    silenceDetectionMs         Int     @default(1500)

    // Audio Processing Settings
    vadSensitivity              Float   @default(0.5)
    speakerConfidenceThreshold  Float   @default(0.7)
    autoDeleteAudioAfterProcess Boolean @default(true)

    // Notification Settings
    notifyOnMemoryStored    Boolean @default(true)
    notifyOnCommandDetected Boolean @default(true)

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@map("user_settings")
}
```

---

## 🌐 API Endpoints

### REST API

| Method | Endpoint                            | Description                                       |
| ------ | ----------------------------------- | ------------------------------------------------- |
| GET    | `/api/user-settings`                | Get user settings (creates default if not exists) |
| PATCH  | `/api/user-settings`                | Update user settings                              |
| POST   | `/api/user-settings/test-wake-word` | Test wake word detection                          |

### WebSocket

| Endpoint                          | Auth            | Protocol                       |
| --------------------------------- | --------------- | ------------------------------ |
| `/ws/continuous-listen?token=JWT` | JWT query param | Binary (PCM16) + JSON messages |

#### Client → Server Messages

| Type            | Payload           | Description                       |
| --------------- | ----------------- | --------------------------------- |
| Binary          | PCM16 audio chunk | Raw audio data at 16kHz           |
| `config_update` | -                 | Signal that settings were updated |
| `stop`          | -                 | Stop the session                  |
| `ping`          | -                 | Keep-alive                        |

#### Server → Client Messages

| Type               | Data                                       | Description                           |
| ------------------ | ------------------------------------------ | ------------------------------------- |
| `session_started`  | -                                          | Session initialized                   |
| `session_stopped`  | -                                          | Session ended                         |
| `vad_status`       | `{ isSpeech, energyLevel }`                | Voice activity detection status       |
| `speaker_status`   | `{ isTargetUser, confidence, speakerId }`  | Speaker identification result         |
| `transcript`       | `{ text, confidence, language, duration }` | Transcription result                  |
| `command_detected` | `{ text, classification }`                 | Wake word detected, command extracted |
| `memory_stored`    | `{ memoryId, text, classification }`       | Memory saved                          |
| `error`            | `{ message }`                              | Error occurred                        |
| `pong`             | -                                          | Keep-alive response                   |

---

## 🎛️ Configuration Options

| Setting                      | Type   | Default     | Description                            |
| ---------------------------- | ------ | ----------- | -------------------------------------- |
| `wakeWord`                   | string | "Hey Brain" | Phrase to trigger command mode         |
| `wakeWordSensitivity`        | float  | 0.8         | Fuzzy match threshold (0-1)            |
| `minImportanceThreshold`     | float  | 0.3         | Min importance to store passive speech |
| `silenceDetectionMs`         | int    | 1500        | Silence duration to end phrase         |
| `vadSensitivity`             | float  | 0.5         | Voice detection sensitivity            |
| `speakerConfidenceThreshold` | float  | 0.7         | Speaker ID confidence threshold        |
| `notifyOnMemoryStored`       | bool   | true        | Show notification on memory save       |
| `notifyOnCommandDetected`    | bool   | true        | Show notification on command           |

---

## 🔄 Processing Pipeline

### 1. Audio Capture (Frontend)

```typescript
// AudioProcessor captures mic input at 16kHz mono
const mediaStream = await navigator.mediaDevices.getUserMedia({
  audio: { sampleRate: 16000, channelCount: 1 },
});

// Convert Float32 to Int16 PCM for transmission
const pcmData = new Int16Array(floatData.length);
for (let i = 0; i < floatData.length; i++) {
  pcmData[i] = floatData[i] * (floatData[i] < 0 ? 0x8000 : 0x7fff);
}

// Send via WebSocket
ws.send(pcmData.buffer);
```

### 2. Voice Activity Detection (Backend)

```typescript
// Energy-based detection with zero-crossing rate
const energy = calculateRMSEnergy(samples);
const zcr = calculateZeroCrossingRate(samples);

// Adaptive threshold
const isSpeech =
  energy > threshold * vadSensitivity && zcr > minZCR && zcr < maxZCR;
```

### 3. Speaker Identification

```typescript
// Extract embedding via Python ECAPA-TDNN service
const embedding = await embeddingService.extractEmbedding(audioBuffer);

// Compare with user's centroid embedding
const similarity = cosineSimilarity(embedding, userCentroid);
const isTargetUser = similarity >= speakerConfidenceThreshold;
```

### 4. Wake Word Detection

```typescript
// Fuzzy string matching with normalization
const normalized = text.toLowerCase().trim();
const wakeNormalized = wakeWord.toLowerCase().trim();

// Check for prefix match or fuzzy similarity
const matches =
  normalized.startsWith(wakeNormalized) ||
  fuzzyMatch(normalized, wakeNormalized) >= sensitivity;

// Extract remaining text as command
const remainingText = normalized.replace(wakeNormalized, "").trim();
```

### 5. Intent Classification

```typescript
// LLM-based classification with fallback
const classification = await llmClassify(text, {
  hasWakeWord: true,
  context: recentMemories,
});

// Returns:
// - inputType: 'command' | 'question' | 'observation' | 'reflection' | 'noise'
// - importanceScore: 0.0 - 1.0
// - shouldStore: boolean
// - shouldCallTools: boolean
// - entities: string[]
// - sentiment: 'positive' | 'negative' | 'neutral'
```

---

## 🚀 Setup & Deployment

### Prerequisites

1. **Backend dependencies**:

   ```bash
   cd backend
   npm install ws
   npm install -D @types/ws
   ```

2. **Database migration**:

   ```bash
   cd backend
   npx prisma migrate dev --name add_user_settings
   npx prisma generate
   ```

3. **Environment variables**:
   ```env
   JWT_SECRET=your-secret-key
   DATABASE_URL=postgresql://...
   OPENAI_API_KEY=sk-...  # For transcription/classification
   ```

### Starting the System

```bash
# Start database
docker-compose up -d postgres

# Start embedding service
cd backend && python embedding-service.py

# Start backend
cd backend && npm run dev

# Start frontend
npm run dev
```

---

## 🧪 Testing

### Manual Testing

1. **Start listening**:
   - Open Settings → Écoute Continue
   - Configure wake word (e.g., "Hey Brain")
   - Click the listening toggle button

2. **Test passive capture**:
   - Speak normally without wake word
   - Should see VAD indicator activate
   - Check memory storage for important content

3. **Test commands**:
   - Say "{wake word} quelle heure est-il ?"
   - Should see command detection notification
   - System should respond actively

4. **Test wake word settings**:
   - Use "Tester le mot d'activation" in settings
   - Verify detection with different variations

### WebSocket Testing

```javascript
// Browser console
const ws = new WebSocket(
  "ws://localhost:3000/ws/continuous-listen?token=YOUR_JWT",
);
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => console.log("Connected");
```

---

## 🔒 Security Considerations

1. **Authentication**: WebSocket requires JWT token in query string
2. **Authorization**: Each user can only access their own sessions
3. **Audio privacy**: Audio is processed in memory, not stored permanently
4. **Rate limiting**: Consider adding per-user connection limits

---

## 📝 Known Limitations

1. **Browser audio API**: Uses deprecated ScriptProcessorNode (AudioWorklet recommended for production)
2. **VAD accuracy**: Simple energy-based detection may have false positives in noisy environments
3. **Latency**: Real-time processing depends on network and server load
4. **Transcription costs**: Each speech segment incurs API costs for transcription

---

## 🔮 Future Improvements

1. **AudioWorklet migration** for better performance
2. **Local VAD model** (WebRTC VAD or silero-vad)
3. **Streaming transcription** for lower latency
4. **Custom wake word model** (Porcupine or similar)
5. **Multi-speaker tracking** with diarization
6. **Offline mode** with local Whisper model

---

**Last Updated**: January 2025  
**Status**: Implementation Complete (pending migration execution)
