# Input Ingestion System - Checklist

## Immediate Actions

- [ ] Run `./setup-input-system.sh`
- [ ] Review `docs/input-ingestion.md` (formats, speaker options)
- [ ] Review `docs/input-integration-guide.md` (integration steps)
- [ ] Configure `config/input-system.config.json` for your environment

## Database

- [ ] Set `DATABASE_URL`
- [ ] Run `npx prisma migrate dev --name add_input_ingestion_tables`
- [ ] Verify new tables (processed_inputs, speaker_profiles, speaker_embeddings, audio_stream_sessions, audio_batches, input_processing_metrics, memory_integrations)

## Speaker Recognition

- [ ] Choose model: ecapa-tdnn | wespeaker | pyannote | resemblyzer
- [ ] Set thresholds (high/low) and window_seconds
- [ ] Enroll at least 3 samples per speaker
- [ ] Decide on diarization (pyannote) if multi-speaker needed

## Transcription & Audio

- [ ] Pick STT engine (e.g., OpenAI Whisper)
- [ ] Enable VAD (webrtc) and set chunk sizes
- [ ] For streaming: configure WebSocket endpoint and buffer sizes
- [ ] For batch: set chunk_size_seconds (3-10s) and buffer timeout

## Integration with Intent Router

- [ ] Wire `input:processed` event to Intent Router
- [ ] Pass speaker_id and confidence to routing context
- [ ] Store processed inputs and metrics

## Monitoring & Security

- [ ] Enable metrics (processing time, confidence, error rate)
- [ ] Enable rate limiting and max input size
- [ ] Encrypt embeddings at rest and in transit

## Testing

- [ ] Unit tests: text ingestion, speaker enrollment/identify
- [ ] Integration: batch + stream paths
- [ ] Performance: latency targets (text <100ms, stream <2s, batch <3s)

## Next Steps

- [ ] Implement actual model integrations (SpeechBrain/WeSpeaker/pyannote/Resemblyzer)
- [ ] Add STT (Whisper) and VAD
- [ ] Add WebSocket handler for streaming
- [ ] Hook DAL/repositories to Prisma tables
