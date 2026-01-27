/**
 * Conversation Recording Service
 * 
 * Manages long-form conversation recording for:
 * - Multi-speaker conversations (group calls, meetings, discussions)
 * - Continuous audio capture without interrupting flow
 * - Later transcription and summarization
 * - Memory linking and analysis
 * 
 * Features:
 * - Start/stop recording without affecting continuous listening
 * - Chunk-based audio storage for efficiency
 * - Multi-speaker tracking and identification
 * - Batch transcription processing
 * - Auto-summary generation
 */

import prisma from "./prisma.js";
import {
  ConversationRecording,
  ConversationParticipant,
  ConversationAudioSegment,
  TranscriptionSegment,
  RecordingStatus,
  TranscriptionStatus,
  Prisma,
} from "@prisma/client";

// Type for recording with all relations included
type ConversationRecordingWithRelations = Prisma.ConversationRecordingGetPayload<{
  include: {
    speakers: true;
    audioSegments: true;
    transcriptSegments: true;
  };
}>;
import { EventEmitter } from "events";
import OpenAI from "openai";
import { getEmbeddingService } from "./embedding-wrapper.js";
import { MemoryManagerService } from "./memory-manager.js";
import { randomUUID } from "crypto";
import { notificationService } from "./notification.js";

// ==================== Types ====================

export interface ConversationRecordingConfig {
  conversationId: string;
  userId: string;
  title?: string;
  description?: string;
  startedAt?: Date;
}

export interface AudioSegmentInput {
  sequence: number;
  startTimeMs: number;
  endTimeMs: number;
  audioData: Buffer;
  audioCodec?: string; // 'aac', 'opus', 'mp3', 'wav'
  sampleRate?: number;
}

export interface ParticipantInfo {
  speakerId: string;
  speakerName?: string;
  speakerRole?: string;
  isMainSpeaker?: boolean;
}

export interface TranscriptionSegmentInput {
  startTimeMs: number;
  endTimeMs: number;
  transcript: string;
  speakerId?: string;
  confidence?: number;
  language?: string;
}

export interface ConversationSummary {
  shortSummary: string;
  longSummary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  emotions: string[];
}

// ==================== Conversation Recording Service ====================

export class ConversationRecordingService extends EventEmitter {
  private activeRecordings: Map<string, ConversationRecording> = new Map();
  private openaiClient: OpenAI;

  constructor() {
    super();
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // ==================== Recording Lifecycle ====================

  /**
   * Start a new conversation recording
   */
  async startRecording(
    config: ConversationRecordingConfig,
  ): Promise<ConversationRecording> {
    try {
      const recording = await prisma.conversationRecording.create({
        data: {
          userId: config.userId,
          conversationId: config.conversationId,
          title: config.title,
          description: config.description,
          startedAt: config.startedAt || new Date(),
          status: RecordingStatus.RECORDING,
          isActive: true,
        },
      });

      this.activeRecordings.set(config.conversationId, recording);
      this.emit("recording_started", { recordingId: recording.id });

      return recording;
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw error;
    }
  }

  /**
   * Stop recording and prepare for processing
   */
  async stopRecording(recordingId: string): Promise<ConversationRecording> {
    try {
      const recording = await prisma.conversationRecording.update({
        where: { id: recordingId },
        data: {
          status: RecordingStatus.COMPLETED,
          isActive: false,
          stoppedAt: new Date(),
        },
      });

      this.activeRecordings.delete(recording.conversationId);
      this.emit("recording_stopped", { recordingId });

      // Trigger transcription
      await this.scheduleTranscription(recordingId);

      return recording;
    } catch (error) {
      console.error("Failed to stop recording:", error);
      throw error;
    }
  }

  /**
   * Get recording by ID
   */
  async getRecording(recordingId: string): Promise<ConversationRecordingWithRelations | null> {
    return prisma.conversationRecording.findUnique({
      where: { id: recordingId },
      include: {
        speakers: true,
        audioSegments: {
          orderBy: { sequenceNumber: "asc" },
        },
        transcriptSegments: {
          orderBy: { startTimeMs: "asc" },
        },
      },
    });
  }

  /**
   * Get all recordings for a user
   */
  async getUserRecordings(
    userId: string,
    status?: RecordingStatus,
    limit: number = 50,
    offset: number = 0,
  ) {
    const where: any = { userId };
    if (status) where.status = status;

    const [recordings, total] = await Promise.all([
      prisma.conversationRecording.findMany({
        where,
        include: {
          speakers: true,
          audioSegments: { select: { id: true } },
          transcriptSegments: { select: { id: true } },
        },
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.conversationRecording.count({ where }),
    ]);

    return { recordings, total, limit, offset };
  }

  // ==================== Audio Management ====================

  /**
   * Add audio chunk to recording
   */
  async addAudioChunk(
    recordingId: string,
    chunk: AudioSegmentInput,
  ): Promise<ConversationAudioSegment> {
    try {
      const segment = await prisma.conversationAudioSegment.create({
        data: {
          recordingId,
          sequenceNumber: chunk.sequence,
          startTimeMs: chunk.startTimeMs,
          endTimeMs: chunk.endTimeMs,
          durationMs: chunk.endTimeMs - chunk.startTimeMs,
          audioData: chunk.audioData,
          audioCodec: chunk.audioCodec || "aac",
          sampleRate: chunk.sampleRate || 16000,
        },
      });

      // Update recording audio stats
      await this.updateRecordingAudioStats(recordingId);

      return segment;
    } catch (error) {
      console.error("Failed to add audio chunk:", error);
      throw error;
    }
  }

  /**
   * Get all audio segments for a recording
   */
  async getAudioSegments(recordingId: string) {
    return prisma.conversationAudioSegment.findMany({
      where: { recordingId },
      orderBy: { sequenceNumber: "asc" },
    });
  }

  /**
   * Get audio segment data (for download/streaming)
   */
  async getAudioSegmentData(segmentId: string): Promise<Buffer | null> {
    const segment = await prisma.conversationAudioSegment.findUnique({
      where: { id: segmentId },
      select: { audioData: true },
    });

    return segment?.audioData || null;
  }

  // ==================== Participant Management ====================

  /**
   * Add or update participant
   */
  async addParticipant(
    recordingId: string,
    participant: ParticipantInfo,
  ): Promise<ConversationParticipant> {
    try {
      return await prisma.conversationParticipant.upsert({
        where: {
          recordingId_speakerId: {
            recordingId,
            speakerId: participant.speakerId,
          },
        },
        update: {
          speakerName: participant.speakerName,
          speakerRole: participant.speakerRole,
        },
        create: {
          recordingId,
          speakerId: participant.speakerId,
          speakerName: participant.speakerName,
          speakerRole: participant.speakerRole,
          isMainSpeaker: participant.isMainSpeaker || false,
        },
      });
    } catch (error) {
      console.error("Failed to add participant:", error);
      throw error;
    }
  }

  /**
   * Get participants in recording
   */
  async getParticipants(recordingId: string) {
    return prisma.conversationParticipant.findMany({
      where: { recordingId },
    });
  }

  /**
   * Update participant speaking stats
   */
  async updateParticipantStats(
    recordingId: string,
    speakerId: string,
    speakTimeSeconds: number,
    wordCount: number,
    turnCount: number,
  ) {
    try {
      return await prisma.conversationParticipant.update({
        where: {
          recordingId_speakerId: { recordingId, speakerId },
        },
        data: {
          speakTimeSeconds: {
            increment: speakTimeSeconds,
          },
          wordCount: {
            increment: wordCount,
          },
          turnCount: {
            increment: turnCount,
          },
        },
      });
    } catch (error) {
      console.error("Failed to update participant stats:", error);
      throw error;
    }
  }

  // ==================== Transcription ====================

  /**
   * Schedule transcription for a recording
   */
  async scheduleTranscription(recordingId: string): Promise<void> {
    try {
      await prisma.conversationRecording.update({
        where: { id: recordingId },
        data: {
          status: RecordingStatus.PROCESSING,
          transcriptionStatus: TranscriptionStatus.IN_PROGRESS,
        },
      });

      // Queue for transcription (in production, use a job queue)
      setImmediate(() => this.processTranscription(recordingId));
    } catch (error) {
      console.error("Failed to schedule transcription:", error);
      throw error;
    }
  }

  /**
   * Process transcription using Whisper API
   */
  async processTranscription(recordingId: string): Promise<void> {
    try {
      const recording = await this.getRecording(recordingId);
      if (!recording) {
        throw new Error(`Recording ${recordingId} not found`);
      }

      const segments = await this.getAudioSegments(recordingId);
      if (segments.length === 0) {
        console.log(
          `No audio segments for recording ${recordingId}, skipping transcription`,
        );
        return;
      }

      // Process each segment
      const transcriptionSegments: TranscriptionSegmentInput[] = [];

      for (const segment of segments) {
        try {
          const transcript = await this.transcribeAudioSegment(
            segment.audioData,
            segment.audioCodec,
          );

          // Calculate speaking stats
          const wordCount = transcript.split(/\s+/).length;
          const speakTimeSeconds = segment.durationMs / 1000;

          transcriptionSegments.push({
            startTimeMs: segment.startTimeMs,
            endTimeMs: segment.endTimeMs,
            transcript,
            confidence: 0.95, // Default confidence
            language: "en",
          });

          this.emit("transcription_segment_complete", {
            recordingId,
            segmentId: segment.id,
          });
        } catch (error) {
          console.error(
            `Failed to transcribe segment ${segment.id}:`,
            error,
          );
        }
      }

      // Store transcription segments
      if (transcriptionSegments.length > 0) {
        await this.addTranscriptionSegments(
          recordingId,
          transcriptionSegments,
        );

        // Combine transcriptions
        const fullTranscript = transcriptionSegments
          .map((s) => s.transcript)
          .join(" ");

        // Generate summary
        const summary = await this.generateSummary(fullTranscript);

        // Update recording
        await prisma.conversationRecording.update({
          where: { id: recordingId },
          data: {
            fullTranscript,
            summaryShort: summary.shortSummary,
            summaryLong: summary.longSummary,
            keyPoints: summary.keyPoints,
            topics: summary.topics,
            sentiment: summary.sentiment,
            emotions: summary.emotions,
            transcriptionStatus: TranscriptionStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        // Create memory from conversation
        await this.createMemoryFromConversation(recording, summary);

        this.emit("transcription_complete", { recordingId });

        // Notify user
        await notificationService.createNotification({
          userId: recording.userId,
          title: "Conversation Recorded",
          message: `Your conversation "${recording.title || "Untitled"}" has been transcribed and summarized.`,
          type: "SUCCESS",
          sourceType: "conversation_recording",
          sourceId: recordingId,
        });
      }
    } catch (error) {
      console.error("Transcription processing failed:", error);

      await prisma.conversationRecording.update({
        where: { id: recordingId },
        data: {
          transcriptionStatus: TranscriptionStatus.FAILED,
        },
      });

      this.emit("transcription_failed", {
        recordingId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Transcribe audio segment using Whisper
   */
  private async transcribeAudioSegment(
    audioData: Buffer,
    audioCodec: string,
  ): Promise<string> {
    try {
      // Create a temporary file-like object for the API
      const file = new File([audioData], "audio.aac", {
        type: "audio/aac",
      });

      const response = await this.openaiClient.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "en",
      });

      return response.text;
    } catch (error) {
      console.error("Whisper transcription failed:", error);
      throw error;
    }
  }

  /**
   * Add transcription segments to recording
   */
  async addTranscriptionSegments(
    recordingId: string,
    segments: TranscriptionSegmentInput[],
  ): Promise<TranscriptionSegment[]> {
    try {
      const created = await Promise.all(
        segments.map((segment) =>
          prisma.transcriptionSegment.create({
            data: {
              recordingId,
              startTimeMs: segment.startTimeMs,
              endTimeMs: segment.endTimeMs,
              transcript: segment.transcript,
              speakerId: segment.speakerId,
              confidence: segment.confidence,
              language: segment.language,
            },
          }),
        ),
      );

      return created;
    } catch (error) {
      console.error("Failed to add transcription segments:", error);
      throw error;
    }
  }

  // ==================== Summary & Analysis ====================

  /**
   * Generate summary of conversation
   */
  async generateSummary(transcript: string): Promise<ConversationSummary> {
    try {
      const response = await this.openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Analyze this conversation transcript and provide:
1. A brief 1-2 sentence summary
2. A detailed summary (2-3 paragraphs)
3. Key points (5-7 bullet points)
4. Main topics discussed (3-5 topics)
5. Overall sentiment (positive/negative/neutral/mixed)
6. Detected emotions (list 2-4)

Format your response as JSON with keys: shortSummary, longSummary, keyPoints (array), topics (array), sentiment, emotions (array)

Transcript:
${transcript}`,
          },
        ],
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No content in LLM response");
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON from LLM response");
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Failed to generate summary:", error);

      // Return default summary on failure
      return {
        shortSummary: "Conversation recorded successfully",
        longSummary: "Full transcript available above",
        keyPoints: ["Conversation recorded"],
        topics: [],
        sentiment: "neutral",
        emotions: [],
      };
    }
  }

  /**
   * Create memory from conversation
   */
  async createMemoryFromConversation(
    recording: ConversationRecordingWithRelations,
    summary: ConversationSummary,
  ): Promise<void> {
    try {
      const memoryContent = `
**Conversation:** ${recording.title || "Untitled"}
**Duration:** ${Math.round(recording.totalDurationSeconds)} seconds
**Participants:** ${recording.speakers?.length || 0}
**Date:** ${recording.startedAt.toLocaleDateString()}

**Summary:** ${summary.longSummary}

**Key Points:**
${summary.keyPoints.map((p) => `- ${p}`).join("\n")}

**Topics:** ${summary.topics.join(", ")}
**Sentiment:** ${summary.sentiment}
      `.trim();

      // Create memory
      const memory = await prisma.memory.create({
        data: {
          userId: recording.userId,
          content: memoryContent,
          sourceType: "conversation",
          sourceId: recording.id,
          type: "LONG_TERM",
          importanceScore: 0.8,
          tags: ["conversation", ...summary.topics.slice(0, 3)],
          metadata: {
            conversationId: recording.conversationId,
            participantCount: recording.speakers?.length || 0,
            duration: recording.totalDurationSeconds,
            sentiment: summary.sentiment,
          },
        },
      });

      // Link memory to recording
      await prisma.conversationRecording.update({
        where: { id: recording.id },
        data: {
          linkedMemories: {
            connect: { id: memory.id },
          },
        },
      });

      this.emit("memory_created", { recordingId: recording.id, memoryId: memory.id });
    } catch (error) {
      console.error("Failed to create memory from conversation:", error);
    }
  }

  // ==================== Internal Helpers ====================

  /**
   * Update recording audio statistics
   */
  private async updateRecordingAudioStats(recordingId: string): Promise<void> {
    try {
      const segments = await prisma.conversationAudioSegment.findMany({
        where: { recordingId },
      });

      const totalDurationSeconds = segments.reduce(
        (sum, s) => sum + s.durationMs / 1000,
        0,
      );
      const totalAudioSizeBytes = segments.reduce(
        (sum, s) => sum + s.audioData.length,
        0,
      );

      await prisma.conversationRecording.update({
        where: { id: recordingId },
        data: {
          audioChunkCount: segments.length,
          totalDurationSeconds,
          totalAudioSizeBytes,
        },
      });
    } catch (error) {
      console.error("Failed to update audio stats:", error);
    }
  }

  /**
   * Cleanup old recordings
   */
  async cleanupOldRecordings(daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.conversationRecording.updateMany({
        where: {
          status: { in: [RecordingStatus.COMPLETED, RecordingStatus.ARCHIVED] },
          completedAt: {
            lt: cutoffDate,
          },
        },
        data: {
          status: RecordingStatus.DELETED,
        },
      });

      return result.count;
    } catch (error) {
      console.error("Failed to cleanup old recordings:", error);
      throw error;
    }
  }
}

// Export singleton
export const conversationRecordingService = new ConversationRecordingService();
