/**
 * Continuous Listening Service
 *
 * Orchestrates the always-on listening pipeline:
 * 1. Receives audio chunks via WebSocket
 * 2. Voice Activity Detection (VAD) - filters out silence
 * 3. Speaker Identification
 * 4. Transcription via configured provider
 * 5. Wake word detection + Intent classification
 * 6. Memory storage (if relevant) or Command execution
 * 7. Adaptive speaker learning (optional)
 *
 * Cost Optimization:
 * - Only voice-containing audio chunks are sent to the provider API
 * - Silence is filtered out locally using low-CPU VAD
 * - Reduces API costs by ~80-90% while maintaining quality
 *
 * Note: AI response/tool handling is delegated to ChatResponseService
 * to avoid code duplication with the chat controller.
 */

import {
  ChunkAnalysisContext,
  TranscriptionChunk,
  TranscriptionContextBuffer,
} from "./transcription-context-buffer.js";
import { ClassificationResult, IntentRouterService } from "./intent-router.js";
import {
  DEFAULT_ADAPTIVE_CONFIG,
  adaptiveSpeakerLearningService,
} from "./adaptive-speaker-learning.js";
import {
  VoiceActivityDetector as ImprovedVAD,
  getVoiceActivityDetector,
} from "./voice-activity-detector.js";
import {
  NoiseFilterContext,
  NoiseFilterResult,
  noiseFilterService,
} from "./noise-filter.js";

import { EventEmitter } from "events";
import { MemoryManagerService } from "./memory-manager.js";
import OpenAI from "openai";
import { flowTracker } from "./flow-tracker.js";
import { getEmbeddingService } from "./embedding-wrapper.js";
import { notificationService } from "./notification.js";
import prisma from "./prisma.js";
import { randomBytes } from "crypto";

// ==================== Types ====================

export interface ContinuousListeningConfig {
  userId: string;
  sessionId?: string; // NEW: Optional session ID for context tracking
  wakeWord: string;
  wakeWordSensitivity: number;
  minImportanceThreshold: number;
  silenceDetectionMs: number;
  vadSensitivity: number;
  speakerConfidenceThreshold: number;
  speakerProfileId?: string;
  centroidEmbedding?: number[];
  autoRespondToQuestions: boolean; // NEW: Respond to questions without wake word
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  sampleRate: number;
}

export interface VADResult {
  isSpeech: boolean;
  confidence: number;
  energyLevel: number;
}

export interface SpeakerIdentificationResult {
  isTargetUser: boolean;
  confidence: number;
  speakerId: string;
  /** The voice embedding extracted for this audio segment (for adaptive learning) */
  embedding?: number[];
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration: number;
}

export interface ProcessingResult {
  type:
    | "silence"
    | "speech_detected"
    | "speaker_unknown"
    | "speaker_other"
    | "transcript"
    | "command"
    | "memory_stored"
    | "ignored";
  timestamp: number;
  data?: any;
}

export type ListeningState = "idle" | "listening" | "processing" | "error";

// ==================== Circular Buffer ====================

class CircularAudioBuffer {
  private buffer: Buffer;
  private writePosition: number = 0;
  private size: number = 0;
  private readonly maxSize: number;
  private readonly sampleRate: number;

  constructor(maxDurationSeconds: number, sampleRate: number = 16000) {
    this.sampleRate = sampleRate;
    // PCM16 = 2 bytes per sample
    this.maxSize = maxDurationSeconds * sampleRate * 2;
    this.buffer = Buffer.alloc(this.maxSize);
  }

  /**
   * Add audio chunk to buffer
   */
  write(chunk: Buffer): void {
    const chunkSize = chunk.length;

    if (chunkSize >= this.maxSize) {
      // Chunk is larger than buffer, keep only the last part
      chunk.copy(this.buffer, 0, chunkSize - this.maxSize);
      this.writePosition = 0;
      this.size = this.maxSize;
      return;
    }

    const spaceAtEnd = this.maxSize - this.writePosition;

    if (chunkSize <= spaceAtEnd) {
      // Chunk fits at the end
      chunk.copy(this.buffer, this.writePosition);
      this.writePosition += chunkSize;
    } else {
      // Wrap around
      chunk.copy(this.buffer, this.writePosition, 0, spaceAtEnd);
      chunk.copy(this.buffer, 0, spaceAtEnd);
      this.writePosition = chunkSize - spaceAtEnd;
    }

    this.size = Math.min(this.size + chunkSize, this.maxSize);
  }

  /**
   * Get all audio data in correct order
   */
  read(): Buffer {
    if (this.size === 0) {
      return Buffer.alloc(0);
    }

    if (this.size < this.maxSize) {
      // Buffer not full yet, simple case
      return this.buffer.slice(0, this.size);
    }

    // Buffer is full, need to reorder
    const result = Buffer.alloc(this.size);
    const readStart = this.writePosition;

    this.buffer.copy(result, 0, readStart, this.maxSize);
    this.buffer.copy(result, this.maxSize - readStart, 0, readStart);

    return result;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.writePosition = 0;
    this.size = 0;
  }

  /**
   * Get current duration in seconds
   */
  getDuration(): number {
    return this.size / (this.sampleRate * 2);
  }

  /**
   * Check if buffer has enough data
   */
  hasMinDuration(minSeconds: number): boolean {
    return this.getDuration() >= minSeconds;
  }
}

// ==================== Continuous Listening Service ====================

/**
 * Main service for continuous audio listening and processing
 * Uses improved VAD (Silero VAD) to filter silence and reduce API costs
 */
export class ContinuousListeningService extends EventEmitter {
  private config: ContinuousListeningConfig;
  private state: ListeningState = "idle";
  private audioBuffer: CircularAudioBuffer;
  private speechBuffer: CircularAudioBuffer;
  private vad: ImprovedVAD;
  private memoryManager: MemoryManagerService;
  private intentRouter: IntentRouterService;
  private isProcessing: boolean = false;
  private contextBuffer: TranscriptionContextBuffer; // NEW: Context buffer for chunk continuity

  constructor(config: ContinuousListeningConfig) {
    super();
    this.config = config;

    // 30 seconds max buffer, 10 seconds for speech segments
    this.audioBuffer = new CircularAudioBuffer(30, 16000);
    this.speechBuffer = new CircularAudioBuffer(10, 16000);

    // Initialize transcription context buffer for continuous audio
    this.contextBuffer = new TranscriptionContextBuffer({
      maxTokens: 2000, // Keep ~2000 tokens of context
      maxTimeWindowSeconds: 300, // 5 minutes max window
      minTokensAfterRotation: 500,
      newConversationThresholdSeconds: 60, // 1 minute silence = new conversation
    });

    // Initialize improved VAD (will be replaced with async initialization)
    this.vad = new ImprovedVAD({
      sensitivity: config.vadSensitivity,
      silenceDetectionMs: config.silenceDetectionMs,
    });

    this.memoryManager = new MemoryManagerService();
    this.intentRouter = new IntentRouterService();

    // Initialize VAD in the background
    this.initializeVAD();

    // Log context buffer initialization
    if (config.sessionId) {
      console.log(
        `📝 [ContinuousListening] Context buffer initialized for session ${config.sessionId.slice(0, 8)}...`,
      );
    }
  }

  /**
   * Initialize the improved VAD model asynchronously
   */
  private async initializeVAD(): Promise<void> {
    try {
      const vad = await getVoiceActivityDetector({
        sensitivity: this.config.vadSensitivity,
        silenceDetectionMs: this.config.silenceDetectionMs,
      });
      this.vad = vad;
    } catch (error) {
      console.error("Failed to initialize improved VAD:", error);
      // Will continue using the basic VAD from constructor
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContinuousListeningConfig>): void {
    this.config = { ...this.config, ...config };

    if (
      config.vadSensitivity !== undefined ||
      config.silenceDetectionMs !== undefined
    ) {
      this.vad.updateConfig({
        sensitivity: this.config.vadSensitivity,
        silenceDetectionMs: this.config.silenceDetectionMs,
      });
    }
  }

  /**
   * Process incoming audio chunk
   * This is the main entry point for audio data
   * Only processes chunks containing voice to reduce API costs
   */
  async processAudioChunk(chunk: AudioChunk): Promise<ProcessingResult> {
    if (this.state === "error") {
      return { type: "ignored", timestamp: Date.now() };
    }

    this.state = "listening";

    // Add to main buffer
    this.audioBuffer.write(chunk.data);

    // Voice Activity Detection - filter out silence
    const vadResult = await this.vad.analyze(chunk.data);

    if (vadResult.isSpeech) {
      // Accumulate speech in separate buffer
      this.speechBuffer.write(chunk.data);

      console.log(
        `🟢 [VAD] Voice detected! Energy: ${vadResult.energyLevel?.toFixed(3) || "N/A"}, Score: ${vadResult.vadScore?.toFixed(3) || "N/A"}, Confidence: ${(vadResult.confidence * 100).toFixed(1)}%`,
      );

      this.emit("vad_status", {
        isSpeech: true,
        energyLevel: vadResult.energyLevel,
        vadScore: vadResult.vadScore,
        confidence: vadResult.confidence,
      });
      return {
        type: "speech_detected",
        timestamp: Date.now(),
        data: vadResult,
      };
    }

    // Check if speech just ended
    // IMPORTANT: Use 1.5s minimum for reliable speaker identification (ECAPA-TDNN needs more audio)
    // Short clips (< 1.5s) have significantly lower accuracy for speaker recognition
    const MIN_DURATION_FOR_PROCESSING = 1.5; // seconds - increased from 0.5 for better speaker ID
    if (
      this.vad.hasSpeechEnded() &&
      this.speechBuffer.hasMinDuration(MIN_DURATION_FOR_PROCESSING)
    ) {
      console.log(
        `\n🟡 [VAD] Speech segment ended - accumulated ${this.speechBuffer.getDuration().toFixed(2)}s of audio`,
      );
      console.log(`🔄 [PROCESSING] Starting speech processing pipeline...`);
      // Process the accumulated speech
      return this.processAccumulatedSpeech();
    }

    // For very short speech segments (0.5-1.5s), still process but log warning about speaker ID reliability
    if (this.vad.hasSpeechEnded() && this.speechBuffer.hasMinDuration(0.5)) {
      const duration = this.speechBuffer.getDuration();
      console.log(
        `\n🟡 [VAD] Short speech segment ended - ${duration.toFixed(2)}s (below ${MIN_DURATION_FOR_PROCESSING}s threshold)`,
      );
      console.log(
        `⚠️ [WARNING] Speaker identification may be less accurate for short segments`,
      );
      return this.processAccumulatedSpeech();
    }

    this.emit("vad_status", {
      isSpeech: false,
      energyLevel: vadResult.energyLevel,
      vadScore: vadResult.vadScore,
    });
    return { type: "silence", timestamp: Date.now() };
  }

  /**
   * Process accumulated speech segment
   */
  private async processAccumulatedSpeech(): Promise<ProcessingResult> {
    if (this.isProcessing) {
      return { type: "ignored", timestamp: Date.now() };
    }

    this.isProcessing = true;
    this.state = "processing";

    const flowId = randomBytes(8).toString("hex");
    const startTime = Date.now();

    console.log(`\n${"─".repeat(50)}`);
    console.log(`🎯 [PIPELINE] Processing speech segment (flow: ${flowId})`);
    console.log(`${"─".repeat(50)}`);

    // Start flow tracking for audio processing
    flowTracker.startFlow(flowId, "audio_stream");
    flowTracker.trackEvent({
      flowId,
      stage: "audio_chunk_received",
      service: "ContinuousListeningService",
      status: "started",
      data: { bufferDuration: this.speechBuffer.getDuration() },
    });

    try {
      const audioData = this.speechBuffer.read();
      const duration = this.speechBuffer.getDuration();

      // Clear speech buffer for next segment
      this.speechBuffer.clear();

      // ============================================================================
      // OPTIMIZATION: Parallel Speaker ID + Transcription
      // Both operations are independent and can run concurrently
      // This saves ~500-1500ms per speech segment
      // ============================================================================
      console.log(
        `\n⚡ [PARALLEL] Starting Speaker ID + Transcription concurrently...`,
      );
      console.log(`   → Audio segment duration: ${duration.toFixed(2)}s`);

      const parallelStart = Date.now();

      // Start both operations in parallel
      const [speakerResult, transcription] = await Promise.all([
        // Speaker Identification
        (async () => {
          const speakerStart = Date.now();
          const result = await this.identifySpeaker(audioData, duration);
          console.log(
            `\n👤 [SPEAKER ID] Completed in ${Date.now() - speakerStart}ms`,
          );
          console.log(
            `   → Speaker: ${result.isTargetUser ? "✅ Target user" : "❌ Other/Unknown"}`,
          );
          console.log(
            `   → Confidence: ${(result.confidence * 100).toFixed(1)}%`,
          );
          return result;
        })(),
        // Transcription
        (async () => {
          const transcriptionStart = Date.now();
          const result = await this.transcribeAudio(audioData, duration);
          console.log(
            `\n📝 [TRANSCRIPTION] Completed in ${Date.now() - transcriptionStart}ms`,
          );
          console.log(
            `   → Text: "${result.text.slice(0, 80)}${result.text.length > 80 ? "..." : ""}"`,
          );
          return result;
        })(),
      ]);

      const parallelDuration = Date.now() - parallelStart;
      console.log(
        `\n⚡ [PARALLEL] Both completed in ${parallelDuration}ms (parallel execution)`,
      );

      // Step 1.5: Adaptive Speaker Learning (background, non-blocking)
      // This helps the system improve speaker detection over time
      if (
        this.config.speakerProfileId &&
        speakerResult.embedding &&
        duration >= DEFAULT_ADAPTIVE_CONFIG.audioQuality.minDurationSeconds
      ) {
        // Run in background - don't block the main pipeline
        adaptiveSpeakerLearningService
          .processAudioForLearning(
            this.config.speakerProfileId,
            speakerResult.embedding,
            speakerResult.confidence,
            audioData,
          )
          .then((result) => {
            if (result.action === "admitted") {
              console.log(
                `   🧠 [ADAPTIVE] Sample accepted for learning (similarity: ${(speakerResult.confidence * 100).toFixed(1)}%)`,
              );
            } else if (result.action === "negative_stored") {
              console.log(
                `   🧠 [ADAPTIVE] Collected as negative example (other speaker)`,
              );
            }
            // Log rejection reasons at debug level only
            if (result.action === "rejected") {
              console.debug(`   🧠 [ADAPTIVE] Rejected: ${result.reason}`);
            }
          })
          .catch((err) => {
            // Silent failure - adaptive learning should never break the main flow
            console.debug(
              `   🧠 [ADAPTIVE] Error (non-critical): ${err.message}`,
            );
          });
      }

      flowTracker.trackEvent({
        flowId,
        stage: "speaker_identification",
        service: "SpeakerRecognition",
        status: speakerResult.isTargetUser ? "success" : "skipped",
        duration: parallelDuration,
        data: {
          isTargetUser: speakerResult.isTargetUser,
          confidence: speakerResult.confidence,
          speakerId: speakerResult.speakerId,
          parallelExecution: true,
        },
        decision: speakerResult.isTargetUser
          ? "Target user identified"
          : "Other speaker detected",
      });

      this.emit("speaker_status", speakerResult);

      if (!speakerResult.isTargetUser) {
        flowTracker.completeFlow(flowId, "completed");
        this.state = "listening";
        this.isProcessing = false;
        return {
          type:
            speakerResult.speakerId === "unknown"
              ? "speaker_unknown"
              : "speaker_other",
          timestamp: Date.now(),
          data: speakerResult,
        };
      }

      // Transcription already completed in parallel - just log and continue
      flowTracker.trackEvent({
        flowId,
        stage: "transcription",
        service: "OpenAI/Whisper",
        status: "success",
        duration: parallelDuration, // Both ran in parallel, so use the same duration
        data: {
          textLength: transcription.text.length,
          confidence: transcription.confidence,
          language: transcription.language,
          parallelExecution: true,
        },
      });

      this.emit("transcript", transcription);

      if (!transcription.text || transcription.text.trim().length === 0) {
        flowTracker.trackEvent({
          flowId,
          stage: "transcription_validation",
          service: "ContinuousListeningService",
          status: "skipped",
          decision: "Empty transcription",
        });
        flowTracker.completeFlow(flowId, "completed");
        this.state = "listening";
        this.isProcessing = false;
        return { type: "ignored", timestamp: Date.now() };
      }

      // ============================================================================
      // Step 2.25: ADD TO CONTEXT BUFFER (NEW)
      // Add transcription to context buffer for continuous conversation tracking
      // ============================================================================
      console.log(`\n📚 [STEP 2.25] Adding to context buffer...`);

      const transcriptionChunk: TranscriptionChunk = {
        text: transcription.text,
        timestamp: Date.now(),
        duration: duration,
        confidence: transcription.confidence,
        isPartial: transcription.text.length < 20, // Mark short chunks as potentially partial
      };

      const chunkAnalysis = this.contextBuffer.addChunk(transcriptionChunk);
      const contextStats = this.contextBuffer.getStats();

      console.log(`   → Chunk added to context buffer`);
      console.log(
        `   → Is continuation: ${chunkAnalysis.isContinuation ? "✅ Yes" : "❌ No"}`,
      );
      console.log(
        `   → Time since last chunk: ${chunkAnalysis.timeSinceLastChunk.toFixed(1)}s`,
      );
      console.log(`   → Total chunks in context: ${contextStats.chunkCount}`);
      console.log(`   → Context tokens: ~${contextStats.tokenCount}`);
      console.log(
        `   → Conversation duration: ${contextStats.conversationDurationSeconds.toFixed(1)}s`,
      );
      if (chunkAnalysis.previousChunkText) {
        console.log(
          `   → Previous chunk: "${chunkAnalysis.previousChunkText.slice(0, 50)}..."`,
        );
      }

      flowTracker.trackEvent({
        flowId,
        stage: "context_buffer",
        service: "TranscriptionContextBuffer",
        status: "success",
        data: {
          isContinuation: chunkAnalysis.isContinuation,
          timeSinceLastChunk: chunkAnalysis.timeSinceLastChunk,
          chunkCount: contextStats.chunkCount,
          tokenCount: contextStats.tokenCount,
          conversationDuration: contextStats.conversationDurationSeconds,
        },
        decision: chunkAnalysis.isContinuation
          ? "Chunk is continuation of previous speech"
          : "New speech segment",
      });

      // ============================================================================
      // Step 2.5: NOISE FILTERING with CONTINUOUS CONTEXT (UPDATED)
      // Now includes full context from context buffer
      // ============================================================================
      console.log(
        `\n🚫 [STEP 2.5] Noise filtering (with continuous context)...`,
      );
      const noiseFilterStart = Date.now();

      // Load user preferences for noise filtering
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId: this.config.userId },
      });

      // Cast to any to access new fields that may not be in the generated types yet
      const settingsAny = userSettings as any;

      // Get noise filter context from the context buffer
      const bufferContext = this.contextBuffer.getNoiseFilterContext();

      const noiseFilterContext: NoiseFilterContext = {
        speakerId: speakerResult.speakerId,
        isTargetUser: speakerResult.isTargetUser,
        speakerConfidence: speakerResult.confidence,
        audioDuration: duration,
        userId: this.config.userId,
        // Determine time of day
        timeOfDay: this.getTimeOfDay(),

        // ============================================================================
        // NEW: Continuous Audio Context from buffer
        // ============================================================================
        fullChunkContext: bufferContext.fullContext,
        olderContextSummary: bufferContext.previousContextSummary,
        isChunkContinuation: bufferContext.isChunkContinuation,
        chunkCount: bufferContext.chunkCount,
        conversationDuration: bufferContext.conversationDuration,
        previousChunkText: chunkAnalysis.previousChunkText,
        recentTranscripts: bufferContext.recentTranscripts,

        // User preferences for noise filtering (use defaults if new fields don't exist yet)
        userPreferences: userSettings
          ? {
              noiseFilterEnabled: settingsAny.noiseFilterEnabled ?? true,
              noiseFilterSensitivity: settingsAny.noiseFilterSensitivity ?? 0.7,
              filterMediaPlayback: settingsAny.filterMediaPlayback ?? true,
              filterBackgroundConvo: settingsAny.filterBackgroundConvo ?? true,
              filterTrivialSelfTalk: settingsAny.filterTrivialSelfTalk ?? true,
              filterThirdPartyAddress:
                settingsAny.filterThirdPartyAddress ?? true,
              askConfirmationOnAmbiguous:
                settingsAny.askConfirmationOnAmbiguous ?? false,
            }
          : undefined,
      };

      const noiseFilterResult = await noiseFilterService.filter(
        transcription.text,
        noiseFilterContext,
      );

      console.log(
        `   → Is meaningful: ${noiseFilterResult.isMeaningful ? "✅ Yes" : "❌ No"}`,
      );
      console.log(`   → Category: ${noiseFilterResult.category}`);
      console.log(
        `   → Confidence: ${(noiseFilterResult.confidence * 100).toFixed(1)}%`,
      );
      console.log(
        `   → Suggested action: ${noiseFilterResult.suggestedAction}`,
      );
      console.log(`   → Reason: ${noiseFilterResult.reason}`);
      console.log(`   → Duration: ${Date.now() - noiseFilterStart}ms`);
      console.log(
        `   → Context used: ${bufferContext.chunkCount} chunks, ${bufferContext.conversationDuration.toFixed(1)}s`,
      );

      flowTracker.trackEvent({
        flowId,
        stage: "noise_filtering",
        service: "NoiseFilterService",
        status: noiseFilterResult.isMeaningful ? "success" : "skipped",
        duration: Date.now() - noiseFilterStart,
        data: {
          isMeaningful: noiseFilterResult.isMeaningful,
          category: noiseFilterResult.category,
          confidence: noiseFilterResult.confidence,
          suggestedAction: noiseFilterResult.suggestedAction,
          contextualRelevance: noiseFilterResult.contextualRelevance,
          contextChunkCount: bufferContext.chunkCount,
          hadPreviousContext: !!bufferContext.previousContextSummary,
        },
        decision: noiseFilterResult.isMeaningful
          ? `Contenu pertinent détecté: ${noiseFilterResult.reason}`
          : `Filtré comme bruit (${noiseFilterResult.category}): ${noiseFilterResult.reason}`,
      });

      this.emit("noise_filter_result", noiseFilterResult);

      // If content is clearly noise, skip further processing
      if (
        !noiseFilterResult.isMeaningful &&
        noiseFilterResult.suggestedAction === "discard"
      ) {
        console.log(
          `\n🗑️ [RESULT] Content filtered as noise - skipping further processing`,
        );
        console.log(`${"─".repeat(50)}\n`);

        flowTracker.completeFlow(flowId, "completed");
        this.state = "listening";
        this.isProcessing = false;
        return {
          type: "ignored",
          timestamp: Date.now(),
          data: {
            reason: "noise_filtered",
            category: noiseFilterResult.category,
            noiseFilterResult,
          },
        };
      }

      // Step 3: Wake word detection + Intent classification
      console.log(`\n🧠 [STEP 3] Intent classification...`);
      const classificationStart = Date.now();
      const hasWakeWord = this.detectWakeWord(transcription.text);
      const classification = await this.intentRouter.classifyInput(
        transcription.text,
        { hasWakeWord, duration, userId: this.config.userId },
      );

      console.log(
        `   → Wake word detected: ${hasWakeWord ? "✅ Yes" : "❌ No"}`,
      );
      console.log(`   → Input type: ${classification.inputType}`);
      console.log(
        `   → Confidence: ${(classification.confidence * 100).toFixed(1)}%`,
      );
      console.log(
        `   → Should store: ${classification.shouldStore ? "✅ Yes" : "❌ No"}`,
      );
      console.log(`   → Duration: ${Date.now() - classificationStart}ms`);

      flowTracker.trackEvent({
        flowId,
        stage: "intent_classification",
        service: "IntentRouter",
        status: "success",
        duration: Date.now() - classificationStart,
        data: {
          inputType: classification.inputType,
          confidence: classification.confidence,
          hasWakeWord,
          shouldStore: classification.shouldStore,
        },
      });

      if (hasWakeWord) {
        // Command mode - active response needed
        const commandText = this.removeWakeWord(transcription.text);

        console.log(
          `\n💡 [RESULT] Wake word detected! Activating command mode`,
        );
        console.log(`   → Command: "${commandText}"`);
        console.log(`${"─".repeat(50)}\n`);

        flowTracker.trackEvent({
          flowId,
          stage: "wake_word_detected",
          service: "ContinuousListeningService",
          status: "success",
          decision: "Command mode activated",
        });

        // Update processing context for meta-questions
        this.lastProcessingContext = {
          speakerDetected: speakerResult.isTargetUser,
          speakerConfidence: speakerResult.confidence,
          speakerId: speakerResult.speakerId,
          transcriptionConfidence: transcription.confidence,
          transcriptionLanguage: transcription.language,
          audioDuration: duration,
          noiseFilterResult: {
            isMeaningful: noiseFilterResult.isMeaningful,
            category: noiseFilterResult.category,
            confidence: noiseFilterResult.confidence,
          },
          intentClassification: {
            inputType: classification.inputType,
            confidence: classification.confidence,
            wakeWordDetected: hasWakeWord,
          },
        };

        // Process the command through AI and send notification
        await this.processQuestionAndRespond(commandText, flowId, startTime);

        flowTracker.completeFlow(flowId, "completed");

        this.emit("command_detected", {
          text: commandText,
          originalText: transcription.text,
          classification,
        });

        this.state = "listening";
        this.isProcessing = false;
        return {
          type: "command",
          timestamp: Date.now(),
          data: { text: commandText, classification },
        };
      }

      // NEW: Auto-respond to questions without wake word
      if (
        this.config.autoRespondToQuestions &&
        classification.inputType === "question" &&
        classification.confidence >= 0.7
      ) {
        console.log(
          `\n❓ [AUTO-RESPOND] Question detected - processing without wake word`,
        );
        console.log(`   → Question: "${transcription.text}"`);
        console.log(
          `   → Confidence: ${(classification.confidence * 100).toFixed(1)}%`,
        );

        flowTracker.trackEvent({
          flowId,
          stage: "auto_respond_question",
          service: "ContinuousListeningService",
          status: "started",
          decision: "Auto-responding to question (no wake word needed)",
        });

        // Update processing context for meta-questions
        this.lastProcessingContext = {
          speakerDetected: speakerResult.isTargetUser,
          speakerConfidence: speakerResult.confidence,
          speakerId: speakerResult.speakerId,
          transcriptionConfidence: transcription.confidence,
          transcriptionLanguage: transcription.language,
          audioDuration: duration,
          noiseFilterResult: {
            isMeaningful: noiseFilterResult.isMeaningful,
            category: noiseFilterResult.category,
            confidence: noiseFilterResult.confidence,
          },
          intentClassification: {
            inputType: classification.inputType,
            confidence: classification.confidence,
            wakeWordDetected: hasWakeWord,
          },
        };

        // Process the question through AI and send notification
        await this.processQuestionAndRespond(
          transcription.text,
          flowId,
          startTime,
        );

        // Also store to memory
        const memoryStart = Date.now();
        const memory = await this.memoryManager.ingestInteraction(
          this.config.userId,
          transcription.text,
          {
            sourceType: "continuous_listening",
            entities: [],
            occurredAt: new Date(),
          },
        );

        console.log(`   → Memory ID: ${memory.id}`);
        console.log(
          `   → Memory storage duration: ${Date.now() - memoryStart}ms`,
        );

        flowTracker.completeFlow(flowId, "completed");

        this.emit("question_answered", {
          text: transcription.text,
          classification,
          memoryId: memory.id,
        });

        this.state = "listening";
        this.isProcessing = false;
        return {
          type: "command", // Treat as command since we responded
          timestamp: Date.now(),
          data: {
            text: transcription.text,
            classification,
            memoryId: memory.id,
          },
        };
      }

      // Step 4: Memory storage (if relevant)
      if (
        classification.shouldStore &&
        classification.confidence >= this.config.minImportanceThreshold
      ) {
        console.log(`\n💾 [STEP 4] Storing to memory...`);
        const memoryStart = Date.now();
        const memory = await this.memoryManager.ingestInteraction(
          this.config.userId,
          transcription.text,
          {
            sourceType: "continuous_listening",
            entities: [],
            occurredAt: new Date(),
          },
        );

        console.log(`   → Memory ID: ${memory.id}`);
        console.log(`   → Duration: ${Date.now() - memoryStart}ms`);
        console.log(`\n✅ [RESULT] Memory stored successfully!`);
        console.log(`   → Total processing time: ${Date.now() - startTime}ms`);
        console.log(`${"─".repeat(50)}\n`);

        flowTracker.trackEvent({
          flowId,
          stage: "memory_storage",
          service: "MemoryManager",
          status: "success",
          duration: Date.now() - memoryStart,
          data: { memoryId: memory.id },
        });
        flowTracker.completeFlow(flowId, "completed");

        this.emit("memory_stored", { memory, classification });

        this.state = "listening";
        this.isProcessing = false;
        return {
          type: "memory_stored",
          timestamp: Date.now(),
          data: {
            memoryId: memory.id,
            text: transcription.text,
            classification,
          },
        };
      }

      // Not relevant enough to store
      console.log(
        `\n⚠️ [RESULT] Content below importance threshold - not storing`,
      );
      console.log(
        `   → Confidence: ${(classification.confidence * 100).toFixed(1)}% < ${(this.config.minImportanceThreshold * 100).toFixed(1)}% threshold`,
      );
      console.log(`   → Should store: ${classification.shouldStore}`);
      console.log(`${"─".repeat(50)}\n`);

      flowTracker.trackEvent({
        flowId,
        stage: "memory_storage",
        service: "MemoryManager",
        status: "skipped",
        decision: `Below importance threshold (${classification.confidence} < ${this.config.minImportanceThreshold}) or shouldStore=false`,
      });
      flowTracker.completeFlow(flowId, "completed");

      this.state = "listening";
      this.isProcessing = false;
      return {
        type: "ignored",
        timestamp: Date.now(),
        data: { reason: "below_importance_threshold", classification },
      };
    } catch (error) {
      console.error(`\n❌ [ERROR] Error processing speech:`, error);
      console.log(`${"─".repeat(50)}\n`);

      flowTracker.trackEvent({
        flowId,
        stage: "audio_processing_error",
        service: "ContinuousListeningService",
        status: "failed",
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      flowTracker.completeFlow(flowId, "failed");

      this.state = "error";
      this.emit("error", error);
      return { type: "ignored", timestamp: Date.now() };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Identify speaker from audio
   *
   * IMPORTANT: Speaker identification accuracy depends heavily on audio duration.
   * ECAPA-TDNN models work best with 3+ seconds of speech. Shorter clips will have
   * adjusted thresholds to account for lower reliability.
   *
   * OPTIMIZATION: Uses in-memory buffer extraction (no file I/O)
   * and local similarity computation for faster processing.
   *
   * @param audioData - PCM audio buffer
   * @param audioDuration - Duration in seconds (used to adjust confidence thresholds)
   */
  private async identifySpeaker(
    audioData: Buffer,
    audioDuration?: number,
  ): Promise<SpeakerIdentificationResult> {
    if (
      !this.config.centroidEmbedding ||
      this.config.centroidEmbedding.length === 0
    ) {
      // No speaker profile, assume it's the target user
      return {
        isTargetUser: true,
        confidence: 0.5,
        speakerId: "assumed_user",
      };
    }

    try {
      const embeddingService = await getEmbeddingService();

      // ============================================================================
      // OPTIMIZATION: Use in-memory buffer extraction + combined endpoint
      // This avoids file I/O and reduces HTTP round-trips
      // Old method: saveAsWav → extractEmbedding → computeSimilarity (3 operations)
      // New method: extractAndCompare with buffer (1 operation)
      // ============================================================================

      const extractStart = Date.now();

      // Use the optimized combined endpoint
      const result = await embeddingService.extractAndCompare(
        audioData,
        this.config.centroidEmbedding,
        { sampleRate: 16000, applyPreprocessing: true },
      );

      const extractDuration = Date.now() - extractStart;
      console.log(
        `   → Embedding extraction + comparison: ${extractDuration}ms (in-memory)`,
      );
      console.log(
        `   → Processing time (Python): ${result.processingTimeMs}ms`,
      );

      const embedding = result.embedding;
      const rawSimilarity = result.similarity;

      // Apply duration-based adjustments for speaker identification
      // Short audio clips (< 2s) have less reliable embeddings
      // This helps bridge the gap between training (long samples) and real-time (short segments)
      let adjustedThreshold = this.config.speakerConfidenceThreshold;
      let confidenceNote = "";

      if (audioDuration !== undefined) {
        if (audioDuration < 1.0) {
          // Very short clip: lower threshold significantly (embeddings are unreliable)
          adjustedThreshold = Math.max(
            0.35,
            this.config.speakerConfidenceThreshold - 0.25,
          );
          confidenceNote = " (very short audio - threshold lowered)";
        } else if (audioDuration < 1.5) {
          // Short clip: lower threshold moderately
          adjustedThreshold = Math.max(
            0.4,
            this.config.speakerConfidenceThreshold - 0.2,
          );
          confidenceNote = " (short audio - threshold lowered)";
        } else if (audioDuration < 2.5) {
          // Medium clip: lower threshold slightly
          adjustedThreshold = Math.max(
            0.5,
            this.config.speakerConfidenceThreshold - 0.1,
          );
          confidenceNote = " (medium audio - threshold slightly lowered)";
        }
        // For clips >= 2.5s, use the configured threshold as-is

        if (confidenceNote) {
          console.log(
            `   → Audio duration: ${audioDuration.toFixed(2)}s${confidenceNote}`,
          );
          console.log(
            `   → Adjusted threshold: ${(adjustedThreshold * 100).toFixed(1)}% (original: ${(this.config.speakerConfidenceThreshold * 100).toFixed(1)}%)`,
          );
        }
      }

      const isTargetUser = rawSimilarity >= adjustedThreshold;

      return {
        isTargetUser,
        confidence: rawSimilarity,
        speakerId: isTargetUser
          ? this.config.speakerProfileId || "user"
          : "other",
        embedding, // Include embedding for adaptive learning
      };
    } catch (error) {
      console.error("Speaker identification failed:", error);
      // On error, assume it's the target user to avoid missing important input
      return {
        isTargetUser: true,
        confidence: 0.5,
        speakerId: "assumed_user",
      };
    }
  }

  /**
   * Transcribe audio using configured provider
   */
  private async transcribeAudio(
    audioData: Buffer,
    duration: number,
  ): Promise<TranscriptionResult> {
    try {
      // Get user's configured transcription provider
      const taskConfig = await prisma.aITaskConfig.findFirst({
        where: {
          userId: this.config.userId,
          taskType: "SPEECH_TO_TEXT",
        },
        include: {
          provider: true,
          model: true,
        },
      });

      if (!taskConfig || !taskConfig.provider) {
        throw new Error("No speech-to-text provider configured");
      }

      // Save audio as temp WAV file - use shared volume for Docker compatibility
      const sharedTmpDir = process.env.AUDIO_TMP_DIR || "/app/data/audio/tmp";
      const fsPromises = await import("fs/promises");
      await fsPromises.mkdir(sharedTmpDir, { recursive: true });
      const tempPath = `${sharedTmpDir}/transcribe_${Date.now()}.wav`;
      await this.saveAsWav(audioData, tempPath);

      const fs = await import("fs");
      const audioFile = fs.createReadStream(tempPath);

      // Use OpenAI SDK (works with OpenAI-compatible providers)
      const openai = new OpenAI({
        apiKey: taskConfig.provider.apiKey,
        baseURL: taskConfig.provider.baseUrl || "https://api.openai.com/v1",
      });

      const response = await openai.audio.transcriptions.create({
        file: audioFile,
        model: taskConfig.model?.modelId || "whisper-1",
        response_format: "verbose_json",
      });

      // Cleanup
      await fsPromises.unlink(tempPath).catch(() => {});

      return {
        text: response.text,
        confidence: 0.9, // Whisper doesn't return confidence, assume high
        language: response.language || "unknown",
        duration,
      };
    } catch (error) {
      console.error("Transcription failed:", error);
      throw error;
    }
  }

  /**
   * Save PCM buffer as WAV file
   */
  private async saveAsWav(pcmData: Buffer, filePath: string): Promise<void> {
    const fs = await import("fs/promises");

    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;

    // WAV header
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(fileSize, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20); // AudioFormat (PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);

    await fs.writeFile(filePath, Buffer.concat([header, pcmData]));
  }

  /**
   * Context from the audio processing pipeline
   * Used to answer meta-questions about the system
   */
  private lastProcessingContext: {
    speakerDetected: boolean;
    speakerConfidence: number;
    speakerId: string;
    transcriptionConfidence: number;
    transcriptionLanguage: string;
    audioDuration: number;
    noiseFilterResult?: {
      isMeaningful: boolean;
      category: string;
      confidence: number;
    };
    intentClassification?: {
      inputType: string;
      confidence: number;
      wakeWordDetected: boolean;
    };
  } | null = null;

  /**
   * Build audio processing context for meta-questions
   */
  private buildAudioProcessingContext(): string {
    if (!this.lastProcessingContext) {
      return "";
    }

    const ctx = this.lastProcessingContext;
    return `

CURRENT AUDIO PROCESSING STATUS (for answering meta-questions about detection):
- Speaker detected: ${ctx.speakerDetected ? "YES" : "NO"}
- Speaker identification confidence: ${(ctx.speakerConfidence * 100).toFixed(1)}%
- Speaker ID: ${ctx.speakerId}
- Audio duration: ${ctx.audioDuration.toFixed(2)}s
- Transcription confidence: ${(ctx.transcriptionConfidence * 100).toFixed(1)}%
- Language detected: ${ctx.transcriptionLanguage}
${ctx.noiseFilterResult ? `- Content meaningful: ${ctx.noiseFilterResult.isMeaningful ? "YES" : "NO"} (${ctx.noiseFilterResult.category}, ${(ctx.noiseFilterResult.confidence * 100).toFixed(1)}% confidence)` : ""}
${
  ctx.intentClassification
    ? `- Intent: ${ctx.intentClassification.inputType} (${(ctx.intentClassification.confidence * 100).toFixed(1)}% confidence)
- Wake word detected: ${ctx.intentClassification.wakeWordDetected ? "YES" : "NO"}`
    : ""
}

If the user asks whether you detected them, heard them, or similar meta-questions about the system, use this information to answer directly without using any tools.`;
  }

  /**
   * Process a question through the AI and send a notification with the response
   * This is used for both wake-word commands and auto-respond questions
   *
   * Delegates to the shared ChatResponseService for LLM/tool handling
   */
  private async processQuestionAndRespond(
    questionText: string,
    flowId: string,
    startTime: number,
  ): Promise<void> {
    try {
      console.log(`\n🤖 [AI] Processing question: "${questionText}"`);
      const aiStart = Date.now();

      // Build audio-specific context for meta-questions
      const audioContext = this.buildAudioProcessingContext();

      // Use the shared chat response service
      const { getChatResponse } = await import("./chat-response.js");

      const result = await getChatResponse(this.config.userId, questionText, {
        additionalContext: audioContext,
        maxIterations: 10,
        maxTokens: 1000,
        includeMemorySearch: true,
        memoryCount: 3,
        onToolCall: (toolName, iteration) => {
          console.log(`   🔧 Tool call ${iteration}: ${toolName}`);
        },
      });

      console.log(`   → AI response generated in ${Date.now() - aiStart}ms`);
      console.log(
        `   → Response: "${result.response.substring(0, 100)}${result.response.length > 100 ? "..." : ""}"`,
      );

      if (!result.success) {
        console.log(`   ⚠️ AI response failed: ${result.error}`);
        flowTracker.trackEvent({
          flowId,
          stage: "ai_response_failed",
          service: "ContinuousListeningService",
          status: "failed",
          data: { error: result.error },
        });
        return;
      }

      // Send notification with the response
      if (result.response) {
        const notificationStart = Date.now();

        await notificationService.createNotification({
          userId: this.config.userId,
          title: "🎤 Voice Question Answer",
          message: result.response,
          type: "INFO",
          channels: ["IN_APP", "PUSH", "TELEGRAM"],
          sourceType: "voice_question",
          metadata: {
            question: questionText,
            flowId,
            processingTime: Date.now() - startTime,
            toolsUsed: result.toolsUsed.length,
            iterations: result.totalIterations,
          },
          skipSpamCheck: true, // Voice questions should always get through
        });

        console.log(
          `   → Notification sent in ${Date.now() - notificationStart}ms`,
        );

        flowTracker.trackEvent({
          flowId,
          stage: "ai_response_sent",
          service: "ContinuousListeningService",
          status: "success",
          duration: Date.now() - aiStart,
          data: {
            responseLength: result.response.length,
            toolsUsed: result.toolsUsed.length,
            iterations: result.totalIterations,
          },
        });

        this.emit("ai_response", {
          question: questionText,
          response: result.response,
          toolsUsed: result.toolsUsed,
        });
      }
    } catch (error) {
      console.error(`   ⚠️ AI processing failed:`, error);
      flowTracker.trackEvent({
        flowId,
        stage: "ai_response_failed",
        service: "ContinuousListeningService",
        status: "failed",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Detect wake word in text
   */
  private detectWakeWord(text: string): boolean {
    const normalizedText = text.toLowerCase().trim();
    const normalizedWakeWord = this.config.wakeWord.toLowerCase().trim();

    // Check for exact match at start
    if (normalizedText.startsWith(normalizedWakeWord)) {
      return true;
    }

    // Check for fuzzy match with common variations
    const variations = this.generateWakeWordVariations(normalizedWakeWord);

    for (const variation of variations) {
      if (normalizedText.startsWith(variation)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get time of day for context
   */
  private getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 22) return "evening";
    return "night";
  }

  /**
   * Generate common variations of wake word
   */
  private generateWakeWordVariations(wakeWord: string): string[] {
    const variations: string[] = [wakeWord];

    // Common speech recognition errors
    const replacements: [string, string][] = [
      ["hey", "hey,"],
      ["hey", "hay"],
      ["hey", "he"],
      ["brain", "brains"],
      ["brain", "brane"],
      [" ", ""],
    ];

    for (const [from, to] of replacements) {
      if (wakeWord.includes(from)) {
        variations.push(wakeWord.replace(from, to));
      }
    }

    return variations;
  }

  /**
   * Remove wake word from text
   */
  private removeWakeWord(text: string): string {
    const normalizedWakeWord = this.config.wakeWord.toLowerCase().trim();
    const normalizedText = text.toLowerCase().trim();

    // Find where the wake word ends
    let endIndex = 0;

    if (normalizedText.startsWith(normalizedWakeWord)) {
      endIndex = normalizedWakeWord.length;
    } else {
      // Check variations
      const variations = this.generateWakeWordVariations(normalizedWakeWord);
      for (const variation of variations) {
        if (normalizedText.startsWith(variation)) {
          endIndex = variation.length;
          break;
        }
      }
    }

    // Skip any trailing punctuation or spaces
    while (endIndex < text.length && /[\s,.:;!?]/.test(text[endIndex])) {
      endIndex++;
    }

    return text.slice(endIndex).trim();
  }

  /**
   * Get current state
   */
  getState(): ListeningState {
    return this.state;
  }

  /**
   * Stop listening and cleanup
   */
  stop(): void {
    this.state = "idle";
    this.audioBuffer.clear();
    this.speechBuffer.clear();
    this.vad.reset();

    // Clear context buffer and log stats before cleanup
    const contextStats = this.contextBuffer.getStats();
    if (contextStats.chunkCount > 0 || contextStats.rotatedChunksCount > 0) {
      console.log(`📊 [ContinuousListening] Context buffer stats on stop:`);
      console.log(
        `   → Total chunks processed: ${contextStats.chunkCount + contextStats.rotatedChunksCount}`,
      );
      console.log(`   → Final tokens: ${contextStats.tokenCount}`);
      console.log(
        `   → Conversation duration: ${contextStats.conversationDurationSeconds.toFixed(1)}s`,
      );
    }
    this.contextBuffer.clear();

    this.removeAllListeners();
  }

  /**
   * Get current context buffer statistics
   */
  getContextStats() {
    return this.contextBuffer.getStats();
  }

  /**
   * Clear context buffer (e.g., when user says "new conversation")
   */
  clearContext(): void {
    console.log(`🗑️ [ContinuousListening] Context buffer cleared manually`);
    this.contextBuffer.clear();
  }
}

// ==================== Session Manager ====================

/**
 * Manages active continuous listening sessions
 */
export class ContinuousListeningManager {
  private sessions: Map<string, ContinuousListeningService> = new Map();

  /**
   * Start a continuous listening session for a user
   */
  async startSession(userId: string): Promise<ContinuousListeningService> {
    // Stop existing session if any
    await this.stopSession(userId);

    // Load user settings
    let settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId },
      });
    }

    // Load speaker profile for identification
    const speakerProfile = await prisma.speakerProfile.findFirst({
      where: {
        userId,
        isEnrolled: true,
      },
      orderBy: {
        enrollmentDate: "desc",
      },
    });

    const config: ContinuousListeningConfig = {
      userId,
      wakeWord: settings.wakeWord,
      wakeWordSensitivity: settings.wakeWordSensitivity,
      minImportanceThreshold: settings.minImportanceThreshold,
      silenceDetectionMs: settings.silenceDetectionMs,
      vadSensitivity: settings.vadSensitivity,
      speakerConfidenceThreshold: settings.speakerConfidenceThreshold,
      speakerProfileId: speakerProfile?.id,
      centroidEmbedding: speakerProfile?.centroidEmbedding as
        | number[]
        | undefined,
      autoRespondToQuestions: (settings as any).autoRespondToQuestions ?? true, // Default to true
    };

    const service = new ContinuousListeningService(config);
    this.sessions.set(userId, service);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ [SESSION] Started continuous listening session`);
    console.log(`${"=".repeat(60)}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`🗣️ Wake word: "${config.wakeWord}"`);
    console.log(`🎤 VAD sensitivity: ${config.vadSensitivity}`);
    console.log(`📊 Min importance: ${config.minImportanceThreshold}`);
    console.log(`👤 Speaker profile: ${config.speakerProfileId || "none"}`);
    console.log(
      `❓ Auto-respond to questions: ${config.autoRespondToQuestions ? "✅ Yes" : "❌ No"}`,
    );
    console.log(`${"=".repeat(60)}\n`);

    return service;
  }

  /**
   * Get active session for user
   */
  getSession(userId: string): ContinuousListeningService | undefined {
    return this.sessions.get(userId);
  }

  /**
   * Stop session for user
   */
  async stopSession(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      session.stop();
      this.sessions.delete(userId);
      console.log(`\n${"=".repeat(60)}`);
      console.log(
        `🛑 [SESSION] Stopped continuous listening session for user ${userId}`,
      );
      console.log(`${"=".repeat(60)}\n`);
    }
  }

  /**
   * Update session configuration
   */
  async updateSessionConfig(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (settings) {
      session.updateConfig({
        wakeWord: settings.wakeWord,
        wakeWordSensitivity: settings.wakeWordSensitivity,
        minImportanceThreshold: settings.minImportanceThreshold,
        silenceDetectionMs: settings.silenceDetectionMs,
        vadSensitivity: settings.vadSensitivity,
        speakerConfidenceThreshold: settings.speakerConfidenceThreshold,
      });
    }
  }

  /**
   * Stop all sessions
   */
  async stopAll(): Promise<void> {
    for (const userId of this.sessions.keys()) {
      await this.stopSession(userId);
    }
  }
}

// Singleton instance
export const continuousListeningManager = new ContinuousListeningManager();
