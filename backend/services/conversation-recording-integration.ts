/**
 * Conversation Recording Integration Module
 * 
 * Integrates with continuous listening to capture long-form conversations
 * without affecting the existing continuous feature.
 * 
 * Workflow:
 * 1. User starts a conversation recording via API
 * 2. Conversation recording service creates a recording session
 * 3. All audio chunks from continuous listening are also sent to conversation recording
 * 4. When conversation is stopped, transcription and summarization begins
 * 5. Memory is created from the conversation summary
 */

import { EventEmitter } from "events";
import { conversationRecordingService } from "./conversation-recording.js";
import prisma from "./prisma.js";
import { ContinuousListeningService } from "./continuous-listening.js";

// ==================== Types ====================

export interface ConversationRecordingIntegration {
  recordingId: string;
  sessionId: string;
  userId: string;
  conversationId: string;
  listeningService: ContinuousListeningService;
  startTime: number;
  sequenceNumber: number;
}

// ==================== Integration Manager ====================

export class ConversationRecordingIntegrationManager extends EventEmitter {
  private recordingsBySession: Map<string, ConversationRecordingIntegration> =
    new Map();
  private sessionsByUser: Map<string, string> = new Map(); // userId -> recordingId

  constructor() {
    super();
  }

  /**
   * Start recording a conversation
   * Called from the conversation-recording controller
   */
  async startRecordingForSession(
    userId: string,
    sessionId: string,
    conversationId: string,
    listeningService: ContinuousListeningService,
    title?: string,
  ): Promise<string> {
    try {
      // Create recording session
      const recording = await conversationRecordingService.startRecording({
        userId,
        conversationId,
        title,
      });

      // Store integration state
      const integration: ConversationRecordingIntegration = {
        recordingId: recording.id,
        sessionId,
        userId,
        conversationId,
        listeningService,
        startTime: Date.now(),
        sequenceNumber: 0,
      };

      this.recordingsBySession.set(sessionId, integration);
      this.sessionsByUser.set(userId, recording.id);

      console.log(
        `🎙️ [CONVERSATION] Recording started for session ${sessionId}`,
      );

      // Listen for audio chunks from continuous listening
      this.setupListeners(listeningService, integration);

      return recording.id;
    } catch (error) {
      console.error("Failed to start conversation recording:", error);
      throw error;
    }
  }

  /**
   * Stop recording and trigger processing
   */
  async stopRecordingForSession(sessionId: string): Promise<string | null> {
    try {
      const integration = this.recordingsBySession.get(sessionId);
      if (!integration) {
        console.warn(`No conversation recording found for session ${sessionId}`);
        return null;
      }

      // Stop recording
      const recording = await conversationRecordingService.stopRecording(
        integration.recordingId,
      );

      // Clean up
      this.recordingsBySession.delete(sessionId);
      this.sessionsByUser.delete(integration.userId);

      console.log(
        `🛑 [CONVERSATION] Recording stopped for session ${sessionId}`,
      );

      return recording.id;
    } catch (error) {
      console.error("Failed to stop conversation recording:", error);
      throw error;
    }
  }

  /**
   * Check if a session is currently being recorded
   */
  isRecording(sessionId: string): boolean {
    return this.recordingsBySession.has(sessionId);
  }

  /**
   * Get active recording for a user
   */
  getActiveRecording(userId: string): string | null {
    return this.sessionsByUser.get(userId) || null;
  }

  /**
   * Setup listeners for audio chunks from continuous listening
   */
  private setupListeners(
    listeningService: ContinuousListeningService,
    integration: ConversationRecordingIntegration,
  ): void {
    // Listen for audio chunks
    listeningService.on("audio_chunk", async (chunk: any) => {
      try {
        await this.handleAudioChunk(integration, chunk);
      } catch (error) {
        console.error("Failed to handle audio chunk for conversation:", error);
      }
    });

    // Listen for transcription updates
    listeningService.on("transcript", async (data: any) => {
      try {
        await this.handleTranscription(integration, data);
      } catch (error) {
        console.error("Failed to handle transcription for conversation:", error);
      }
    });

    // Listen for speaker identification
    listeningService.on("speaker_identified", async (data: any) => {
      try {
        await this.handleSpeakerIdentification(integration, data);
      } catch (error) {
        console.error(
          "Failed to handle speaker identification for conversation:",
          error,
        );
      }
    });

    console.log(`📡 [CONVERSATION] Audio chunk listeners attached`);
  }

  /**
   * Handle incoming audio chunk
   */
  private async handleAudioChunk(
    integration: ConversationRecordingIntegration,
    chunk: any,
  ): Promise<void> {
    try {
      // Calculate timing
      const elapsedMs = Date.now() - integration.startTime;
      const chunkStartMs = elapsedMs;
      const chunkEndMs = Math.min(elapsedMs + (chunk.duration || 200), elapsedMs + 200);

      // Add chunk to conversation recording
      if (chunk.data && chunk.data.length > 0) {
        await conversationRecordingService.addAudioChunk(
          integration.recordingId,
          {
            sequence: integration.sequenceNumber++,
            startTimeMs: chunkStartMs,
            endTimeMs: chunkEndMs,
            audioData: chunk.data,
            audioCodec: chunk.codec || "aac",
            sampleRate: chunk.sampleRate || 16000,
          },
        );
      }
    } catch (error) {
      console.error("Failed to handle audio chunk:", error);
      throw error;
    }
  }

  /**
   * Handle transcription segment
   */
  private async handleTranscription(
    integration: ConversationRecordingIntegration,
    data: any,
  ): Promise<void> {
    try {
      // This is called when a transcription segment is available
      // Data includes: { transcript, speakerId, timestamp, confidence }

      const elapsedMs = Date.now() - integration.startTime;

      // Add transcription segment
      if (data.transcript) {
        await conversationRecordingService.addTranscriptionSegments(
          integration.recordingId,
          [
            {
              startTimeMs: data.startTime || elapsedMs - 2000,
              endTimeMs: data.endTime || elapsedMs,
              transcript: data.transcript,
              speakerId: data.speakerId,
              confidence: data.confidence || 0.9,
              language: data.language || "en",
            },
          ],
        );
      }
    } catch (error) {
      console.error("Failed to handle transcription:", error);
      throw error;
    }
  }

  /**
   * Handle speaker identification
   */
  private async handleSpeakerIdentification(
    integration: ConversationRecordingIntegration,
    data: any,
  ): Promise<void> {
    try {
      // Data includes: { speakerId, confidence, voiceEmbedding }

      // Add or update participant
      if (data.speakerId) {
        await conversationRecordingService.addParticipant(
          integration.recordingId,
          {
            speakerId: data.speakerId,
            speakerName: data.speakerName,
            speakerRole: data.speakerRole || "participant",
            isMainSpeaker: data.isMainSpeaker || false,
          },
        );
      }
    } catch (error) {
      console.error("Failed to handle speaker identification:", error);
      throw error;
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    try {
      // Stop all active recordings
      const sessions = Array.from(this.recordingsBySession.keys());
      for (const sessionId of sessions) {
        await this.stopRecordingForSession(sessionId);
      }

      this.recordingsBySession.clear();
      this.sessionsByUser.clear();

      console.log("🧹 [CONVERSATION] Integration cleanup complete");
    } catch (error) {
      console.error("Failed to cleanup conversation recording integration:", error);
    }
  }
}

// Export singleton
export const conversationRecordingIntegration =
  new ConversationRecordingIntegrationManager();
