# Conversation Recording System - Integration Guide

## Quick Start

### 1. Run Prisma Migration

```bash
cd backend
npx prisma migrate deploy
# or if creating new migration
npx prisma migrate dev --name add_conversation_recording_models
```

### 2. Register Routes in Main API Server

In [backend/services/api-server.ts](../../backend/services/api-server.ts), add:

```typescript
import conversationRecordingController from '../controllers/conversation-recording.controller.js';

// ... in your Express app setup:
app.use('/api/conversations', conversationRecordingController);
```

### 3. Export the Integration Service

In [backend/services/index.ts](../../backend/services/index.ts) (or wherever services are exported), add:

```typescript
export { conversationRecordingService } from './conversation-recording.js';
export { conversationRecordingIntegration } from './conversation-recording-integration.js';
```

---

## Enabling Conversation Recording for a User Session

### Option 1: Via Audio Session Manager (Recommended)

When creating an audio session, optionally enable conversation recording:

```typescript
// In a controller or service
const sessionResult = await audioSessionManager.createSession({
  userId: req.userId,
  deviceId: deviceId,
  audioFormat: { /* ... */ },
});

// Start conversation recording for this session
const recordingId = await conversationRecordingIntegration.startRecordingForSession(
  req.userId,
  sessionResult.sessionId,
  'zoom-meeting-123', // External conversation ID
  listeningService,   // The ContinuousListeningService instance
  'Team Meeting'      // Optional title
);
```

### Option 2: Direct API Call

```bash
POST /api/conversations/start
{
  "conversationId": "zoom-meeting-123",
  "title": "Team Standup"
}

# Response:
{
  "success": true,
  "recording": {
    "id": "rec_abc123",
    "status": "RECORDING",
    "startedAt": "2026-01-27T10:00:00Z"
  }
}
```

---

## Integration Points with Existing Services

### 1. Continuous Listening Service

The conversation recording system **automatically captures** from continuous listening if audio event listeners are attached:

```typescript
// ConversationRecordingIntegrationManager automatically listens for:
listeningService.on('audio_chunk', ...);
listeningService.on('transcript', ...);
listeningService.on('speaker_identified', ...);
```

**No code changes needed** - just start a conversation recording and it will capture.

### 2. Memory Manager

Memories are created automatically:

```typescript
// After transcription completes
await conversationRecordingService.createMemoryFromConversation(recording, summary);
// ↓
// Creates a Memory with:
// - sourceType: 'conversation'
// - sourceId: recording.id
// - content: conversation summary
// - tags: topics + 'conversation'
```

### 3. Notification Service

Users are notified when transcription completes:

```typescript
await notificationService.sendNotification(
  userId,
  {
    title: "Conversation Recorded",
    message: `Your conversation "${title}" has been transcribed.`,
    type: "success",
  },
  { recordingId }
);
```

### 4. Audio Session Manager

Works alongside continuous listening - no conflicts:

```
Audio Ingestion Controller
  ↓
Audio Session Manager (creates session)
  ↓
Continuous Listening Service (processes audio)
  ↓ (if recording active)
Conversation Recording (captures chunks)
```

---

## Configuration Checklist

- [ ] Database migration run: `npx prisma migrate deploy`
- [ ] Routes registered in api-server.ts
- [ ] Services exported in services/index.ts
- [ ] OpenAI API key set in environment
- [ ] (Optional) Conversation recording integration hooked to audio sessions

---

## API Endpoints Overview

### Conversation Recording Endpoints

```
POST   /api/conversations/start              → Start recording
POST   /api/conversations/:id/stop           → Stop recording
GET    /api/conversations/:id                → Get details
GET    /api/conversations                    → List recordings
POST   /api/conversations/:id/audio-chunk    → Upload audio
GET    /api/conversations/:id/audio/:seg     → Download audio segment
POST   /api/conversations/:id/participants   → Add participant
GET    /api/conversations/:id/participants   → List participants
GET    /api/conversations/:id/transcription  → Get transcript & summary
POST   /api/conversations/:id/regenerate-summary  → Regenerate summary
GET    /api/conversations/search             → Search conversations
```

---

## Event Hooks

Listen for recording events:

```typescript
conversationRecordingService.on('recording_started', ({ recordingId }) => {
  // ...
});

conversationRecordingService.on('recording_stopped', ({ recordingId }) => {
  // ...
});

conversationRecordingService.on('transcription_complete', ({ recordingId }) => {
  // ...
});

conversationRecordingService.on('transcription_failed', ({ recordingId, error }) => {
  // ...
});

conversationRecordingService.on('memory_created', ({ recordingId, memoryId }) => {
  // ...
});
```

---

## Database Cleanup

Old recordings can be archived:

```typescript
// Delete recordings older than 90 days
const count = await conversationRecordingService.cleanupOldRecordings(90);
console.log(`Archived ${count} old recordings`);
```

You can also add this to a background job:

```typescript
// In scheduler or background-agents.ts
setInterval(() => {
  conversationRecordingService.cleanupOldRecordings(90);
}, 24 * 60 * 60 * 1000); // Daily
```

---

## Testing

### Test Recording Lifecycle

```bash
# 1. Start recording
curl -X POST http://localhost:3000/api/conversations/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "conversationId": "test-123",
    "title": "Test Recording"
  }'

# Response: { "success": true, "recording": { "id": "rec_xyz" } }

# 2. Upload audio chunks (in real scenario, from continuous listening)
curl -X POST http://localhost:3000/api/conversations/rec_xyz/audio-chunk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sequence": 1,
    "startTimeMs": 0,
    "endTimeMs": 1000,
    "audioData": "..base64 audio..",
    "audioCodec": "aac",
    "sampleRate": 16000
  }'

# 3. Stop recording
curl -X POST http://localhost:3000/api/conversations/rec_xyz/stop \
  -H "Authorization: Bearer $TOKEN"

# 4. Wait 5-10 minutes for transcription, then check status
curl http://localhost:3000/api/conversations/rec_xyz \
  -H "Authorization: Bearer $TOKEN"
```

---

## Debugging

### Check Recording Status

```typescript
const recording = await conversationRecordingService.getRecording(recordingId);
console.log('Status:', recording.status);
console.log('Transcription Status:', recording.transcriptionStatus);
console.log('Audio Chunks:', recording.audioChunkCount);
console.log('Full Transcript:', recording.fullTranscript?.substring(0, 100));
```

### Check Integration Status

```typescript
const isRecording = conversationRecordingIntegration.isRecording(sessionId);
const activeRecording = conversationRecordingIntegration.getActiveRecording(userId);
console.log('Is Recording:', isRecording);
console.log('Active Recording ID:', activeRecording);
```

### Monitor Events

```typescript
conversationRecordingService.on('*', (event, data) => {
  console.log(`[ConversationRecording] ${event}:`, data);
});
```

---

## Performance Notes

### Storage
- Audio chunks: ~0.5-1MB per minute of recording
- 1-hour meeting: ~30-50MB
- Transcripts: ~10KB per hour
- Summaries: ~5KB each

### Processing Time
- Transcription (Whisper): 5-10 minutes for 1-hour audio
- Summarization (GPT-4o): 10-30 seconds

### Cost per Recording
- Transcription (1 hour): ~$0.02
- Summarization: ~$0.005
- Total: ~$0.025 per hour

---

## Troubleshooting

### Migration Fails

```bash
# Check what migrations are pending
npx prisma migrate status

# If needed, reset (WARNING: deletes data in dev)
npx prisma migrate reset
```

### Transcription Not Starting

1. Check audio chunks were saved:
   ```typescript
   const recording = await conversationRecordingService.getRecording(recordingId);
   console.log('Audio chunks:', recording.audioChunkCount); // Should be > 0
   ```

2. Check OpenAI API key:
   ```bash
   echo $OPENAI_API_KEY
   ```

3. Check logs for errors:
   ```bash
   grep -i "transcription" logs/* | tail -20
   ```

### Missing Participants

Participants must be explicitly added via API:
```typescript
await conversationRecordingService.addParticipant(recordingId, {
  speakerId: 'user1',
  speakerName: 'Alice'
});
```

---

## Next Steps

1. ✅ Run migration
2. ✅ Register routes
3. ✅ Test basic recording
4. ✅ Integrate with continuous listening (optional)
5. ✅ Add UI for recording control (frontend)
6. ✅ Add memory linking UI (frontend)
7. ✅ Monitor production usage

---

**Last Updated**: January 27, 2026  
**Status**: Ready for Integration
