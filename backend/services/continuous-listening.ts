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
 *
 * Cost Optimization:
 * - Only voice-containing audio chunks are sent to the provider API
 * - Silence is filtered out locally using low-CPU VAD
 * - Reduces API costs by ~80-90% while maintaining quality
 */

import { EventEmitter } from "events";
import prisma from "./prisma.js";
import { getEmbeddingService } from "./embedding-wrapper.js";
import { MemoryManagerService } from "./memory-manager.js";
import { IntentRouterService, ClassificationResult } from "./intent-router.js";
import {
  VoiceActivityDetector as ImprovedVAD,
  getVoiceActivityDetector,
} from "./voice-activity-detector.js";
import OpenAI from "openai";

// ==================== Types ====================

export interface ContinuousListeningConfig {
  userId: string;
  wakeWord: string;
  wakeWordSensitivity: number;
  minImportanceThreshold: number;
  silenceDetectionMs: number;
  vadSensitivity: number;
  speakerConfidenceThreshold: number;
  speakerProfileId?: string;
  centroidEmbedding?: number[];
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

  constructor(config: ContinuousListeningConfig) {
    super();
    this.config = config;

    // 30 seconds max buffer, 10 seconds for speech segments
    this.audioBuffer = new CircularAudioBuffer(30, 16000);
    this.speechBuffer = new CircularAudioBuffer(10, 16000);

    // Initialize improved VAD (will be replaced with async initialization)
    this.vad = new ImprovedVAD({
      sensitivity: config.vadSensitivity,
      silenceDetectionMs: config.silenceDetectionMs,
    });

    this.memoryManager = new MemoryManagerService();
    this.intentRouter = new IntentRouterService();

    // Initialize VAD in the background
    this.initializeVAD();
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
    if (this.vad.hasSpeechEnded() && this.speechBuffer.hasMinDuration(0.5)) {
      // Process the accumulated speech
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

    try {
      const audioData = this.speechBuffer.read();
      const duration = this.speechBuffer.getDuration();

      // Clear speech buffer for next segment
      this.speechBuffer.clear();

      // Step 1: Speaker Identification
      const speakerResult = await this.identifySpeaker(audioData);

      this.emit("speaker_status", speakerResult);

      if (!speakerResult.isTargetUser) {
        this.state = "listening";
        return {
          type:
            speakerResult.speakerId === "unknown"
              ? "speaker_unknown"
              : "speaker_other",
          timestamp: Date.now(),
          data: speakerResult,
        };
      }

      // Step 2: Transcription
      const transcription = await this.transcribeAudio(audioData, duration);

      this.emit("transcript", transcription);

      if (!transcription.text || transcription.text.trim().length === 0) {
        this.state = "listening";
        return { type: "ignored", timestamp: Date.now() };
      }

      // Step 3: Wake word detection + Intent classification
      const hasWakeWord = this.detectWakeWord(transcription.text);
      const classification = await this.intentRouter.classifyInput(
        transcription.text,
        { hasWakeWord, duration },
      );

      if (hasWakeWord) {
        // Command mode - active response needed
        const commandText = this.removeWakeWord(transcription.text);

        this.emit("command_detected", {
          text: commandText,
          originalText: transcription.text,
          classification,
        });

        this.state = "listening";
        return {
          type: "command",
          timestamp: Date.now(),
          data: { text: commandText, classification },
        };
      }

      // Step 4: Memory storage (if relevant)
      if (
        classification.shouldStore &&
        classification.confidence >= this.config.minImportanceThreshold
      ) {
        const memory = await this.memoryManager.ingestInteraction(
          this.config.userId,
          transcription.text,
          {
            sourceType: "continuous_listening",
            entities: [],
            occurredAt: new Date(),
          },
        );

        this.emit("memory_stored", { memory, classification });

        this.state = "listening";
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
      this.state = "listening";
      return {
        type: "ignored",
        timestamp: Date.now(),
        data: { reason: "below_importance_threshold", classification },
      };
    } catch (error) {
      console.error("Error processing speech:", error);
      this.state = "error";
      this.emit("error", error);
      return { type: "ignored", timestamp: Date.now() };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Identify speaker from audio
   */
  private async identifySpeaker(
    audioData: Buffer,
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

      // Save temp file for embedding extraction
      const tempPath = `/tmp/continuous_audio_${Date.now()}.wav`;
      await this.saveAsWav(audioData, tempPath);

      // Extract embedding
      const embedding = await embeddingService.extractEmbedding(tempPath);

      // Cleanup temp file
      const fs = await import("fs/promises");
      await fs.unlink(tempPath).catch(() => {});

      // Compare with centroid
      const similarity = await embeddingService.computeSimilarity(
        embedding,
        this.config.centroidEmbedding,
      );

      const isTargetUser = similarity >= this.config.speakerConfidenceThreshold;

      return {
        isTargetUser,
        confidence: similarity,
        speakerId: isTargetUser
          ? this.config.speakerProfileId || "user"
          : "other",
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

      // Save audio as temp WAV file
      const tempPath = `/tmp/transcribe_${Date.now()}.wav`;
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
      const fsPromises = await import("fs/promises");
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
    this.removeAllListeners();
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
    };

    const service = new ContinuousListeningService(config);
    this.sessions.set(userId, service);

    console.log(`✓ Started continuous listening session for user ${userId}`);
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
      console.log(`✓ Stopped continuous listening session for user ${userId}`);
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
