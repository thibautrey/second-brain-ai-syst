/**
 * Input Ingestion Service
 *
 * Unified interface for handling multiple input formats:
 * - Text input
 * - Audio streams
 * - Audio batches
 *
 * Converts all inputs to a standard format for Intent Router
 */

import { EventEmitter } from "events";
import { flowTracker } from "./flow-tracker.js";
import { randomBytes } from "crypto";

export enum InputFormat {
  TEXT = "text",
  AUDIO_STREAM = "audio_stream",
  AUDIO_BATCH = "audio_batch",
}

export enum InputStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface SpeakerIdentification {
  speaker_id: string;
  confidence: number; // 0.0 - 1.0
  method: "assumed" | "identified" | "uncertain";
  details?: {
    similarity_score?: number;
    threshold?: number;
    diarization_cluster?: string;
  };
}

export interface ProcessedInput {
  id: string;
  format: InputFormat;
  content: string; // Transcribed text
  original_content?: Buffer; // Raw audio data if applicable
  speaker: SpeakerIdentification;
  timestamp: Date;
  status: InputStatus;
  metadata: {
    duration_seconds?: number;
    confidence_score?: number;
    processing_time_ms?: number;
    source?: string;
  };
  error?: string;
}

export interface TextInputRequest {
  content: string;
  speaker_id?: string; // Optional, defaults to "user"
  metadata?: Record<string, any>;
}

export interface AudioStreamConfig {
  sample_rate: number;
  channels: number;
  encoding: "pcm16" | "opus" | "aac";
}

export interface AudioBatchRequest {
  chunk_id: string; // Unique ID for this chunk
  sequence_number: number; // Order in sequence
  audio_data: Buffer;
  is_final?: boolean; // Last chunk in this audio sequence
  timestamp: Date;
}

/**
 * Main Input Ingestion Service
 */
export class InputIngestionService extends EventEmitter {
  private processedInputs: Map<string, ProcessedInput> = new Map();
  private audioBuffer: Map<string, Buffer> = new Map();

  constructor(private config: any) {
    super();
  }

  /**
   * Process text input
   */
  async processTextInput(request: TextInputRequest): Promise<ProcessedInput> {
    const inputId = this.generateId();
    const flowId = randomBytes(8).toString("hex");
    const startTime = Date.now();

    // Start flow tracking
    flowTracker.startFlow(flowId, "text");
    flowTracker.trackEvent({
      flowId,
      stage: "input_received",
      service: "InputIngestionService",
      status: "started",
      data: { contentLength: request.content.length },
    });

    try {
      const processed: ProcessedInput = {
        id: inputId,
        format: InputFormat.TEXT,
        content: request.content,
        speaker: {
          speaker_id: request.speaker_id || "user",
          confidence: 1.0,
          method: "assumed",
        },
        timestamp: new Date(),
        status: InputStatus.COMPLETED,
        metadata: {
          processing_time_ms: Date.now() - startTime,
          source: "text_input",
          ...request.metadata,
          // Add flowId for debugging
          ...(flowId && { flowId }),
        },
      };

      this.processedInputs.set(inputId, processed);

      flowTracker.trackEvent({
        flowId,
        stage: "text_processed",
        service: "InputIngestionService",
        status: "success",
        duration: Date.now() - startTime,
        data: { inputId, contentLength: request.content.length },
        decision: `Texte reçu et traité avec succès. Longueur: ${request.content.length} caractères. Locuteur: ${request.speaker_id || "user"}`,
      });

      this.emit("input:processed", processed);

      return processed;
    } catch (error) {
      flowTracker.trackEvent({
        flowId,
        stage: "text_processing",
        service: "InputIngestionService",
        status: "failed",
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
        decision: `Erreur lors du traitement du texte: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      flowTracker.completeFlow(flowId, "failed");

      const errorInput: ProcessedInput = {
        id: inputId,
        format: InputFormat.TEXT,
        content: request.content,
        speaker: {
          speaker_id: "unknown",
          confidence: 0,
          method: "assumed",
        },
        timestamp: new Date(),
        status: InputStatus.FAILED,
        metadata: {
          processing_time_ms: Date.now() - startTime,
          source: "text_input",
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };

      this.processedInputs.set(inputId, errorInput);
      this.emit("input:error", errorInput);
      throw error;
    }
  }

  /**
   * Start audio stream processing
   * Returns an object to stream audio chunks to
   */
  startAudioStream(config: AudioStreamConfig): AudioStreamProcessor {
    const processor = new AudioStreamProcessor(config, this.config);

    processor.on("ready", () => this.emit("stream:ready", processor.id));
    processor.on("chunk", (chunk: Buffer) =>
      this.emit("stream:chunk", processor.id, chunk),
    );
    processor.on("completed", (processed: ProcessedInput) => {
      this.processedInputs.set(processed.id, processed);
      this.emit("input:processed", processed);
    });

    return processor;
  }

  /**
   * Process audio batch/chunk
   */
  async processAudioBatch(
    request: AudioBatchRequest,
  ): Promise<ProcessedInput | null> {
    const batchId = `batch_${request.chunk_id}`;

    // Accumulate audio chunks
    if (!this.audioBuffer.has(batchId)) {
      this.audioBuffer.set(batchId, Buffer.alloc(0));
    }

    const existing = this.audioBuffer.get(batchId)!;
    const accumulated = Buffer.concat([existing, request.audio_data]);
    this.audioBuffer.set(batchId, accumulated);

    this.emit("batch:chunk_received", {
      batch_id: batchId,
      sequence: request.sequence_number,
      total_size: accumulated.length,
      is_final: request.is_final,
    });

    // If this is the final chunk, process the complete audio
    if (request.is_final) {
      return this.processFinalAudioBatch(batchId, accumulated);
    }

    return null;
  }

  /**
   * Process complete audio batch
   */
  private async processFinalAudioBatch(
    batchId: string,
    audioData: Buffer,
  ): Promise<ProcessedInput> {
    const inputId = this.generateId();
    const startTime = Date.now();

    try {
      // Transcription and speaker ID would happen here
      // For now, placeholder implementation
      const processed: ProcessedInput = {
        id: inputId,
        format: InputFormat.AUDIO_BATCH,
        content: "[Transcribed audio content]", // Would come from transcription service
        original_content: audioData,
        speaker: {
          speaker_id: "identified_speaker",
          confidence: 0.85,
          method: "identified",
          details: {
            similarity_score: 0.87,
            threshold: 0.85,
          },
        },
        timestamp: new Date(),
        status: InputStatus.COMPLETED,
        metadata: {
          duration_seconds: audioData.length / (16000 * 2), // Estimate based on 16kHz PCM16
          processing_time_ms: Date.now() - startTime,
          source: "audio_batch",
        },
      };

      this.processedInputs.set(inputId, processed);
      this.audioBuffer.delete(batchId); // Clean up
      this.emit("input:processed", processed);

      return processed;
    } catch (error) {
      const errorInput: ProcessedInput = {
        id: inputId,
        format: InputFormat.AUDIO_BATCH,
        content: "",
        speaker: {
          speaker_id: "unknown",
          confidence: 0,
          method: "assumed",
        },
        timestamp: new Date(),
        status: InputStatus.FAILED,
        metadata: {
          processing_time_ms: Date.now() - startTime,
          source: "audio_batch",
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };

      this.processedInputs.set(inputId, errorInput);
      this.emit("input:error", errorInput);
      throw error;
    }
  }

  /**
   * Retrieve processed input by ID
   */
  getProcessedInput(inputId: string): ProcessedInput | undefined {
    return this.processedInputs.get(inputId);
  }

  /**
   * Get all processed inputs (with optional filter)
   */
  getAllProcessedInputs(filter?: {
    format?: InputFormat;
    status?: InputStatus;
  }): ProcessedInput[] {
    return Array.from(this.processedInputs.values()).filter((input) => {
      if (filter?.format && input.format !== filter.format) return false;
      if (filter?.status && input.status !== filter.status) return false;
      return true;
    });
  }

  private generateId(): string {
    return `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Audio Stream Processor
 * Handles real-time audio stream processing
 */
export class AudioStreamProcessor extends EventEmitter {
  id: string;
  private buffer: Buffer = Buffer.alloc(0);
  private totalDuration: number = 0;

  constructor(
    private config: AudioStreamConfig,
    private serviceConfig: any,
  ) {
    super();
    this.id = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.emit("ready");
  }

  /**
   * Add audio chunk to stream
   */
  addChunk(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.totalDuration +=
      chunk.length / (this.config.sample_rate * this.config.channels * 2);
    this.emit("chunk", chunk);
  }

  /**
   * Finalize stream and process
   */
  async finalize(): Promise<ProcessedInput> {
    const inputId = `input_stream_${this.id}`;

    const processed: ProcessedInput = {
      id: inputId,
      format: InputFormat.AUDIO_STREAM,
      content: "[Transcribed stream content]",
      original_content: this.buffer,
      speaker: {
        speaker_id: "stream_speaker",
        confidence: 0.9,
        method: "identified",
      },
      timestamp: new Date(),
      status: InputStatus.COMPLETED,
      metadata: {
        duration_seconds: this.totalDuration,
        source: "audio_stream",
      },
    };

    this.emit("completed", processed);
    return processed;
  }

  /**
   * Get current buffer state
   */
  getBuffer(): Buffer {
    return this.buffer;
  }

  /**
   * Get total accumulated duration
   */
  getDuration(): number {
    return this.totalDuration;
  }
}
