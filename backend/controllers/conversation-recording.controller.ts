/**
 * Conversation Recording Controller
 * 
 * REST API endpoints for managing long-form conversation recording.
 * Handles:
 * - Recording lifecycle (start, stop, list)
 * - Audio chunk uploads
 * - Transcription status and retrieval
 * - Conversation summaries and analysis
 */

import { Router, Request, Response, NextFunction } from "express";
import { conversationRecordingService } from "../services/conversation-recording.js";
import { RecordingStatus, TranscriptionStatus } from "@prisma/client";

// ==================== Types ====================

interface AuthenticatedRequest extends Request {
  userId?: string;
}

// ==================== Middleware ====================

const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  // Verify user is authenticated
  // This assumes middleware is set up in the main app
  if (!req.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// ==================== Router ====================

const router = Router();

// ==================== Recording Lifecycle ====================

/**
 * POST /api/conversations/start
 * Start a new conversation recording
 */
router.post("/start", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId, title, description } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    const recording = await conversationRecordingService.startRecording({
      conversationId,
      userId: req.userId!,
      title,
      description,
    });

    res.status(201).json({
      success: true,
      recording,
    });
  } catch (error: any) {
    console.error("Failed to start recording:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/conversations/:recordingId/stop
 * Stop recording
 */
router.post(
  "/:recordingId/stop",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const recording = await conversationRecordingService.stopRecording(
        req.params.recordingId,
      );

      res.json({
        success: true,
        recording,
        message: "Recording stopped. Transcription will begin shortly.",
      });
    } catch (error: any) {
      console.error("Failed to stop recording:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /api/conversations/:recordingId
 * Get recording details
 */
router.get(
  "/:recordingId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const recording = await conversationRecordingService.getRecording(
        req.params.recordingId,
      );

      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }

      // Verify ownership
      if (recording.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      res.json({
        success: true,
        recording: {
          ...recording,
          audioSegments: recording.audioSegments?.map((s: any) => ({
            id: s.id,
            sequenceNumber: s.sequenceNumber,
            startTimeMs: s.startTimeMs,
            endTimeMs: s.endTimeMs,
            durationMs: s.durationMs,
            isProcessed: s.isProcessed,
            // Don't send raw audio data in API response
          })),
        },
      });
    } catch (error: any) {
      console.error("Failed to get recording:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /api/conversations
 * List user's recordings
 */
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      status,
      limit = "50",
      offset = "0",
    } = req.query;

    const result = await conversationRecordingService.getUserRecordings(
      req.userId!,
      status as RecordingStatus | undefined,
      Math.min(parseInt(limit as string), 100),
      parseInt(offset as string),
    );

    res.json({
      success: true,
      ...result,
      recordings: result.recordings.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        totalDurationSeconds: r.totalDurationSeconds,
        transcriptionStatus: r.transcriptionStatus,
        summaryShort: r.summaryShort,
        participantCount: r.speakers?.length || 0,
        audioChunkCount: r.audioChunkCount,
      })),
    });
  } catch (error: any) {
    console.error("Failed to list recordings:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Audio Management ====================

/**
 * POST /api/conversations/:recordingId/audio-chunk
 * Add audio chunk to recording
 */
router.post(
  "/:recordingId/audio-chunk",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sequence, startTimeMs, endTimeMs, audioData, audioCodec, sampleRate } =
        req.body;

      // Validate recording ownership
      const recording = await conversationRecordingService.getRecording(
        req.params.recordingId,
      );
      if (!recording || recording.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Convert base64 to Buffer if needed
      let audioBuffer: Buffer;
      if (typeof audioData === "string") {
        audioBuffer = Buffer.from(audioData, "base64");
      } else {
        audioBuffer = audioData;
      }

      const segment = await conversationRecordingService.addAudioChunk(
        req.params.recordingId,
        {
          sequence,
          startTimeMs,
          endTimeMs,
          audioData: audioBuffer,
          audioCodec,
          sampleRate,
        },
      );

      res.status(201).json({
        success: true,
        segment: {
          id: segment.id,
          sequenceNumber: segment.sequenceNumber,
          startTimeMs: segment.startTimeMs,
          endTimeMs: segment.endTimeMs,
        },
      });
    } catch (error: any) {
      console.error("Failed to add audio chunk:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /api/conversations/:recordingId/audio/:segmentId
 * Download audio segment
 */
router.get(
  "/:recordingId/audio/:segmentId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Verify recording ownership
      const recording = await conversationRecordingService.getRecording(
        req.params.recordingId,
      );
      if (!recording || recording.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const audioData = await conversationRecordingService.getAudioSegmentData(
        req.params.segmentId,
      );

      if (!audioData) {
        return res.status(404).json({ error: "Audio segment not found" });
      }

      res.setHeader("Content-Type", "audio/aac");
      res.setHeader("Content-Length", audioData.length);
      res.send(audioData);
    } catch (error: any) {
      console.error("Failed to get audio segment:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// ==================== Participants ====================

/**
 * POST /api/conversations/:recordingId/participants
 * Add participant to recording
 */
router.post(
  "/:recordingId/participants",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { speakerId, speakerName, speakerRole, isMainSpeaker } = req.body;

      // Verify recording ownership
      const recording = await conversationRecordingService.getRecording(
        req.params.recordingId,
      );
      if (!recording || recording.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const participant = await conversationRecordingService.addParticipant(
        req.params.recordingId,
        {
          speakerId,
          speakerName,
          speakerRole,
          isMainSpeaker,
        },
      );

      res.status(201).json({
        success: true,
        participant,
      });
    } catch (error: any) {
      console.error("Failed to add participant:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /api/conversations/:recordingId/participants
 * Get participants
 */
router.get(
  "/:recordingId/participants",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Verify recording ownership
      const recording = await conversationRecordingService.getRecording(
        req.params.recordingId,
      );
      if (!recording || recording.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const participants = await conversationRecordingService.getParticipants(
        req.params.recordingId,
      );

      res.json({
        success: true,
        participants,
      });
    } catch (error: any) {
      console.error("Failed to get participants:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// ==================== Transcription & Summary ====================

/**
 * GET /api/conversations/:recordingId/transcription
 * Get transcription details
 */
router.get(
  "/:recordingId/transcription",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const recording = await conversationRecordingService.getRecording(
        req.params.recordingId,
      );

      if (!recording || recording.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      res.json({
        success: true,
        status: recording.transcriptionStatus,
        transcript: recording.fullTranscript,
        segments: recording.transcriptSegments ? recording.transcriptSegments.map((s: any) => ({
          startTimeMs: s.startTimeMs,
          endTimeMs: s.endTimeMs,
          transcript: s.transcript,
          speakerId: s.speakerId,
          confidence: s.confidence,
        })) : [],
        summary: {
          short: recording.summaryShort,
          long: recording.summaryLong,
          keyPoints: recording.keyPoints,
          topics: recording.topics,
          sentiment: recording.sentiment,
          emotions: recording.emotions,
        },
      });
    } catch (error: any) {
      console.error("Failed to get transcription:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * POST /api/conversations/:recordingId/regenerate-summary
 * Regenerate summary for recording
 */
router.post(
  "/:recordingId/regenerate-summary",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const recording = await conversationRecordingService.getRecording(
        req.params.recordingId,
      );

      if (!recording || recording.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!recording.fullTranscript) {
        return res
          .status(400)
          .json({ error: "Transcript not available, cannot regenerate summary" });
      }

      const summary = await conversationRecordingService.generateSummary(
        recording.fullTranscript,
      );

      res.json({
        success: true,
        summary,
      });
    } catch (error: any) {
      console.error("Failed to regenerate summary:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// ==================== Search & Export ====================

/**
 * GET /api/conversations/search
 * Search conversations by title, content, or participants
 */
router.get("/search", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, topics, sentiment, limit = "20" } = req.query;

    // This is a simplified search - in production, use full-text search
    const query: any = { userId: req.userId };

    if (topics) {
      query.topics = { hasSome: (topics as string).split(",") };
    }

    if (sentiment) {
      query.sentiment = sentiment;
    }

    const recordings = await conversationRecordingService.getUserRecordings(
      req.userId!,
      RecordingStatus.COMPLETED,
      Math.min(parseInt(limit as string), 100),
      0,
    );

    // Filter by query if provided
    let filtered = recordings.recordings;
    if (q) {
      const queryLower = (q as string).toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.title?.toLowerCase() || "").includes(queryLower) ||
          (r.summaryShort?.toLowerCase() || "").includes(queryLower),
      );
    }

    res.json({
      success: true,
      recordings: filtered.slice(0, parseInt(limit as string)),
    });
  } catch (error: any) {
    console.error("Failed to search conversations:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
