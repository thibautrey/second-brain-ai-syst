# Conversation Recording System

## Overview

The Conversation Recording System captures long-form group conversations and meetings for later speech-to-text transcription and summarization, without interrupting the continuous listening feature.

### Key Features

✅ **Non-invasive**: Records conversations without affecting existing continuous listening  
✅ **Multi-speaker**: Automatically detects and tracks different speakers  
✅ **Async Processing**: Transcription and summarization happen after recording ends  
✅ **Memory Integration**: Automatically creates memories from conversation summaries  
✅ **Search & Retrieval**: Full-text and semantic search across conversations  
✅ **Audio Storage**: Efficient chunk-based storage for large recordings  

---

## Architecture

### Components

1. **ConversationRecording** (Database Model)
   - Stores metadata about recorded conversations
   - Tracks status, duration, participants, and transcription progress

2. **ConversationAudioSegment** (Database Model)
   - Stores audio chunks efficiently
   - Chunk-based storage for memory efficiency
   - Audio codec and format metadata

3. **TranscriptionSegment** (Database Model)
   - Stores transcription results
   - Links transcript to speaker and timing

4. **ConversationRecordingService**
   - Manages recording lifecycle
   - Handles audio chunk storage
   - Orchestrates transcription via Whisper API
   - Generates summaries via GPT-4o-mini

5. **ConversationRecordingIntegrationManager**
   - Bridges continuous listening with conversation recording
   - Captures audio chunks from continuous listening service
   - No impact on existing continuous feature

### Data Flow

```
User starts conversation recording
    ↓
Create ConversationRecording in database
    ↓
Attach listeners to continuous listening service
    ↓
Audio chunks flow: Continuous Listening → Conversation Recording
    ↓
User stops recording
    ↓
Queue transcription job
    ↓
Whisper API: Transcribe all audio chunks
    ↓
GPT-4o-mini: Generate summary, key points, topics, sentiment
    ↓
Create Memory from conversation summary
    ↓
Link Memory ↔ ConversationRecording
    ↓
Done - User can view, search, and replay conversation
```

---

## API Reference

### Start Recording

**POST** `/api/conversations/start`

```json
{
  "conversationId": "zoom-meeting-123",
  "title": "Team Standup",
  "description": "Weekly sync with product team"
}
```

**Response:**
```json
{
  "success": true,
  "recording": {
    "id": "rec_xyz",
    "status": "RECORDING",
    "startedAt": "2026-01-27T10:00:00Z"
  }
}
```

### Stop Recording

**POST** `/api/conversations/:recordingId/stop`

**Response:**
```json
{
  "success": true,
  "recording": {
    "id": "rec_xyz",
    "status": "PROCESSING",
    "stoppedAt": "2026-01-27T10:30:00Z",
    "message": "Recording stopped. Transcription will begin shortly."
  }
}
```

### Upload Audio Chunk

**POST** `/api/conversations/:recordingId/audio-chunk`

```json
{
  "sequence": 1,
  "startTimeMs": 0,
  "endTimeMs": 1000,
  "audioData": "base64_encoded_audio",
  "audioCodec": "aac",
  "sampleRate": 16000
}
```

### Get Conversation Details

**GET** `/api/conversations/:recordingId`

**Response:**
```json
{
  "success": true,
  "recording": {
    "id": "rec_xyz",
    "title": "Team Standup",
    "status": "COMPLETED",
    "totalDurationSeconds": 1800,
    "transcriptionStatus": "COMPLETED",
    "summaryShort": "The team discussed...",
    "speakers": [...]
  }
}
```

### Get Transcription

**GET** `/api/conversations/:recordingId/transcription`

**Response:**
```json
{
  "success": true,
  "status": "COMPLETED",
  "transcript": "Full transcript here...",
  "segments": [
    {
      "startTimeMs": 0,
      "endTimeMs": 5000,
      "transcript": "Hi everyone...",
      "speakerId": "user1"
    }
  ],
  "summary": {
    "short": "Brief summary",
    "long": "Detailed summary...",
    "keyPoints": ["Point 1", "Point 2"],
    "topics": ["engineering", "releases"],
    "sentiment": "positive",
    "emotions": ["engaged", "energetic"]
  }
}
```

### List Conversations

**GET** `/api/conversations?status=COMPLETED&limit=20`

**Response:**
```json
{
  "success": true,
  "recordings": [...],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

### Search Conversations

**GET** `/api/conversations/search?q=standup&topics=engineering`

### Add Participant

**POST** `/api/conversations/:recordingId/participants`

```json
{
  "speakerId": "user1",
  "speakerName": "Alice",
  "speakerRole": "host",
  "isMainSpeaker": true
}
```

### Get Participants

**GET** `/api/conversations/:recordingId/participants`

### Regenerate Summary

**POST** `/api/conversations/:recordingId/regenerate-summary`

Used to regenerate the summary without re-transcribing audio.

---

## Database Schema

### ConversationRecording
- `id`: Unique identifier
- `conversationId`: External conversation/room ID (unique per user)
- `status`: RECORDING | PAUSED | COMPLETED | PROCESSING | ARCHIVED | DELETED
- `transcriptionStatus`: PENDING | IN_PROGRESS | COMPLETED | FAILED | PARTIAL
- `startedAt`: When recording started
- `stoppedAt`: When recording was stopped
- `completedAt`: When transcription completed
- `totalDurationSeconds`: Total audio length
- `fullTranscript`: Complete transcription
- `summaryShort`: Brief summary
- `summaryLong`: Detailed summary
- `keyPoints`: Extracted points
- `topics`: Detected topics
- `sentiment`: Overall sentiment
- `emotions`: Detected emotions
- `linkedMemories`: Relation to memories

### ConversationParticipant
- `id`: Unique identifier
- `recordingId`: Link to recording
- `speakerId`: Speaker identifier
- `speakerName`: Display name
- `speakerRole`: Role in conversation
- `isMainSpeaker`: Primary speaker?
- `speakTimeSeconds`: Total speaking time
- `wordCount`: Words spoken
- `turnCount`: Number of turns

### ConversationAudioSegment
- `id`: Unique identifier
- `recordingId`: Link to recording
- `sequenceNumber`: Order in recording
- `startTimeMs`: Segment start time
- `endTimeMs`: Segment end time
- `audioData`: Raw audio bytes
- `audioCodec`: aac | opus | mp3 | wav
- `sampleRate`: Hz

### TranscriptionSegment
- `id`: Unique identifier
- `recordingId`: Link to recording
- `startTimeMs`: Segment start time
- `endTimeMs`: Segment end time
- `transcript`: Transcribed text
- `speakerId`: Speaker identifier
- `confidence`: Confidence score 0-1
- `language`: Language code

---

## Integration with Continuous Listening

The conversation recording system is **fully separate** from continuous listening:

### How It Works

1. **Continuous Listening** remains unchanged
   - Still captures everything
   - Still runs noise filter, wake word detection, etc.
   - No performance impact

2. **When Conversation Recording Starts**
   - New event listeners attach to the continuous listening service
   - Audio chunks are **also** sent to conversation recording
   - Transcription segments from continuous listening are captured
   - Speaker identification is tracked

3. **No Conflicts**
   - Continuous listening processes run in parallel
   - Each system is independent
   - Can have multiple concurrent recordings

---

## Processing Pipeline

### 1. Recording Phase
- Audio chunks arrive in real-time
- Stored efficiently in database
- Participants are tracked
- No transcription happens yet

### 2. Stopping & Processing
```typescript
await stopRecording(recordingId)
→ Sets status to PROCESSING
→ Queues transcription job
→ Transcription begins asynchronously
```

### 3. Transcription
```
Whisper API processes all audio chunks
→ Generates transcription for each chunk
→ Preserves timing and speaker info
→ Stores all segments in database
```

### 4. Summarization
```
GPT-4o-mini analyzes full transcript
→ Generates short summary (1-2 sentences)
→ Generates long summary (paragraphs)
→ Extracts key points (5-7)
→ Identifies topics
→ Analyzes sentiment
→ Detects emotions
```

### 5. Memory Creation
```
ConversationRecordingService creates memory
→ Combines summary + metadata
→ Tags with topics
→ Links back to recording
→ Stores in long-term memory
```

---

## Configuration

### Environment Variables

```bash
# OpenAI API key for Whisper and GPT-4
OPENAI_API_KEY=sk-...

# Database connection
DATABASE_URL=postgresql://...
```

### User Settings

No special settings needed - all users can record conversations by default.

---

## Use Cases

### 1. Team Meetings
- Record entire standup/planning session
- Auto-transcribe for those who missed it
- Create memory of decisions made

### 2. Client Calls
- Maintain records of requirements discussed
- Auto-generate meeting notes
- Easy reference for follow-ups

### 3. Brainstorming Sessions
- Capture all ideas
- Automatic summary of key points
- Searchable by topic

### 4. Training & Onboarding
- Record training sessions
- Searchable transcripts
- Auto-generated notes for trainees

---

## Performance Considerations

### Audio Storage
- Chunks are stored as binary data
- Efficient binary format (not base64)
- Typical meeting (1 hour): ~30-50MB
- Old recordings can be deleted

### Transcription
- Runs asynchronously after recording
- Whisper API processes in parallel
- ~5-10 minutes for 1-hour meeting
- Cost: ~$0.02 per audio hour

### Summarization
- GPT-4o-mini (faster, cheaper)
- ~10-30 seconds per transcript
- Cost: ~$0.005 per conversation
- Can be regenerated anytime

---

## Best Practices

### Starting a Recording
```typescript
// Start when conversation begins
const recording = await fetch('/api/conversations/start', {
  method: 'POST',
  body: JSON.stringify({
    conversationId: 'zoom-meeting-123', // Unique ID for this conversation
    title: 'Team Standup',
    description: 'Weekly sync'
  })
});
```

### Stopping a Recording
```typescript
// Stop when conversation ends
const result = await fetch(`/api/conversations/${recordingId}/stop`, {
  method: 'POST'
});
// Transcription begins automatically
```

### Handling Multiple Speakers
```typescript
// Add participants as they speak
await fetch(`/api/conversations/${recordingId}/participants`, {
  method: 'POST',
  body: JSON.stringify({
    speakerId: 'user1',
    speakerName: 'Alice',
    isMainSpeaker: false
  })
});
```

### Searching Conversations
```typescript
// Search by topic
const results = await fetch('/api/conversations/search?topics=engineering');

// Full-text search
const results = await fetch('/api/conversations/search?q=requirements');
```

---

## Limitations & Future Improvements

### Current Limitations
- Speech-to-text is English-only (can add multi-language)
- Summary generation uses GPT-4o-mini (not GPT-4)
- No real-time transcription (only after recording stops)
- No speaker diarization (requires advanced models)

### Future Enhancements
- [ ] Multi-language transcription
- [ ] Real-time transcription streaming
- [ ] Speaker diarization (automatically detect speaker boundaries)
- [ ] Emotion detection per speaker
- [ ] Automatic Q&A extraction
- [ ] Conversation insights and analytics
- [ ] Integration with calendar systems
- [ ] Automatic follow-up task extraction
- [ ] Discussion timeline visualization

---

## Troubleshooting

### Transcription Not Starting
1. Ensure audio chunks were recorded (check `audioChunkCount`)
2. Check OpenAI API key is set correctly
3. Look at logs for transcription errors

### Missing Speakers
- Participants must be explicitly added via API
- Continuous listening's speaker identification is used if available

### High Latency
- Transcription runs asynchronously
- For 1-hour meeting: 5-10 minutes typical
- Check OpenAI API status if delayed

---

## Security & Privacy

- All recordings stored in user's database
- Audio not sent to third parties except OpenAI Whisper API
- Transcripts and summaries stored encrypted
- Users can delete recordings anytime
- No analytics or tracking

---

**Last Updated**: January 27, 2026  
**Status**: Ready for Production
