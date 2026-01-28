/**
 * Adaptive Speaker Learning Controller
 *
 * REST API endpoints for managing adaptive speaker learning:
 * - Enable/disable adaptive learning
 * - View status and health metrics
 * - Manage adaptive samples
 * - Rollback to previous states
 * - View negative examples
 * - Recent recordings management for speaker correction
 */

import {
  AdaptiveLearningConfig,
  DEFAULT_ADAPTIVE_CONFIG,
  adaptiveSpeakerLearningService,
} from "../services/adaptive-speaker-learning.js";
import { NextFunction, Request, Response } from "express";

import { AuthRequest } from "../middlewares/auth.middleware.js";
import prisma from "../services/prisma.js";

// Types for recent recordings
export interface RecentRecordingItem {
  id: string;
  type: "negative_example" | "adaptive_sample" | "unclassified";
  capturedAt: Date;
  confidence: number;
  sourceSessionId?: string;
  similarity?: number;
  duration?: number;
  hasAudio?: boolean;
}

export class AdaptiveLearningController {
  /**
   * GET /api/adaptive-learning/status/:profileId
   * Get adaptive learning status for a profile
   */
  async getStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const status = await adaptiveSpeakerLearningService.getStatus(
        profileId,
        req.userId,
      );

      if (!status) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      res.status(200).json({ success: true, status });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/adaptive-learning/enable/:profileId
   * Enable adaptive learning for a profile
   */
  async enable(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const result = await adaptiveSpeakerLearningService.enable(
        profileId,
        req.userId,
      );

      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }

      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/adaptive-learning/disable/:profileId
   * Disable adaptive learning for a profile
   */
  async disable(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const result = await adaptiveSpeakerLearningService.disable(
        profileId,
        req.userId,
      );

      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }

      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/adaptive-learning/unfreeze/:profileId
   * Unfreeze a frozen profile
   */
  async unfreeze(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const result = await adaptiveSpeakerLearningService.unfreeze(
        profileId,
        req.userId,
      );

      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }

      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/adaptive-learning/health/:profileId
   * Run a health check on a profile
   */
  async getHealth(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const health = await adaptiveSpeakerLearningService.runHealthCheck(
        profileId,
        req.userId,
      );

      if (!health) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      res.status(200).json({ success: true, health });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/adaptive-learning/samples/:profileId
   * Get adaptive samples for a profile
   */
  async getSamples(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;
      const includeInactive = req.query.includeInactive === "true";

      const samples = await adaptiveSpeakerLearningService.getAdaptiveSamples(
        profileId,
        req.userId,
        { includeInactive },
      );

      res.status(200).json({ success: true, samples });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/adaptive-learning/samples/:profileId/:sampleId
   * Remove a specific adaptive sample
   */
  async removeSample(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId, sampleId } = req.params;

      const result = await adaptiveSpeakerLearningService.removeAdaptiveSample(
        profileId,
        sampleId,
        req.userId,
      );

      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }

      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/adaptive-learning/snapshots/:profileId
   * List available snapshots for rollback
   */
  async getSnapshots(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      // Verify ownership
      const profile = await prisma.speakerProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile || profile.userId !== req.userId) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      const snapshots =
        await adaptiveSpeakerLearningService.rollback.listSnapshots(profileId);

      res.status(200).json({ success: true, snapshots });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/adaptive-learning/rollback/:profileId
   * Rollback to a previous snapshot
   */
  async rollback(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;
      const { snapshotId } = req.body;

      // Verify ownership
      const profile = await prisma.speakerProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile || profile.userId !== req.userId) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      const result = await adaptiveSpeakerLearningService.rollback.rollback(
        profileId,
        snapshotId,
      );

      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }

      res.status(200).json({
        success: true,
        message: result.message,
        restoredSnapshotId: result.restoredSnapshotId,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/adaptive-learning/snapshot/:profileId
   * Create a manual backup snapshot
   */
  async createSnapshot(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      // Verify ownership
      const profile = await prisma.speakerProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile || profile.userId !== req.userId) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      const result =
        await adaptiveSpeakerLearningService.rollback.createManualSnapshot(
          profileId,
        );

      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }

      res.status(201).json({
        success: true,
        message: result.message,
        snapshotId: result.snapshotId,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/adaptive-learning/negatives
   * Get negative examples for current user
   */
  async getNegatives(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const stats = await adaptiveSpeakerLearningService.negatives.getStats(
        req.userId,
      );

      const negatives =
        await adaptiveSpeakerLearningService.negatives.getNegativeExamples(
          req.userId,
        );

      res.status(200).json({
        success: true,
        stats,
        // Don't send embeddings to frontend, just metadata
        examples: negatives.map((n) => ({
          id: n.id,
          confidence: n.confidence,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/adaptive-learning/negatives/:exampleId
   * Delete a specific negative example
   */
  async deleteNegative(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { exampleId } = req.params;

      const example = await prisma.negativeExample.findUnique({
        where: { id: exampleId },
      });

      if (!example || example.userId !== req.userId) {
        res.status(404).json({ error: "Negative example not found" });
        return;
      }

      await prisma.negativeExample.delete({
        where: { id: exampleId },
      });

      res
        .status(200)
        .json({ success: true, message: "Negative example deleted" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/adaptive-learning/negatives
   * Clear all negative examples for current user
   */
  async clearNegatives(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const result = await prisma.negativeExample.deleteMany({
        where: { userId: req.userId },
      });

      res.status(200).json({
        success: true,
        message: `Deleted ${result.count} negative examples`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/adaptive-learning/config
   * Get current adaptive learning configuration
   */
  async getConfig(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      res.status(200).json({
        success: true,
        config: DEFAULT_ADAPTIVE_CONFIG,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/adaptive-learning/health-history/:profileId
   * Get health check history for a profile
   */
  async getHealthHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      // Verify ownership
      const profile = await prisma.speakerProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile || profile.userId !== req.userId) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      const history = await prisma.profileHealthLog.findMany({
        where: { speakerProfileId: profileId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          healthScore: true,
          intraClassVariance: true,
          interClassSeparation: true,
          sampleCount: true,
          adaptiveSampleCount: true,
          eventType: true,
          recommendations: true,
          createdAt: true,
        },
      });

      res.status(200).json({ success: true, history });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/adaptive-learning/recent-recordings
   * Get recent recordings from continuous listening with classification status
   * Returns both negative examples and adaptive samples for user review
   */
  async getRecentRecordings(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const profileId = req.query.profileId as string | undefined;

      // Get recent negative examples
      const negativeExamples = await prisma.negativeExample.findMany({
        where: { userId: req.userId },
        orderBy: { capturedAt: "desc" },
        take: limit,
        select: {
          id: true,
          confidence: true,
          capturedAt: true,
          sourceSessionId: true,
          audioData: true,
          durationSeconds: true,
        },
      });

      // Get recent adaptive samples if profileId provided
      let adaptiveSamples: any[] = [];
      if (profileId) {
        // Verify ownership
        const profile = await prisma.speakerProfile.findUnique({
          where: { id: profileId },
        });
        if (profile && profile.userId === req.userId) {
          adaptiveSamples = await prisma.adaptiveSample.findMany({
            where: {
              speakerProfileId: profileId,
              isActive: true,
            },
            orderBy: { admittedAt: "desc" },
            take: limit,
            select: {
              id: true,
              admissionSimilarity: true,
              admittedAt: true,
              sourceSessionId: true,
              durationSeconds: true,
              audioQualityScore: true,
              audioData: true,
            },
          });
        }
      }

      // Format for frontend
      const recordings: RecentRecordingItem[] = [
        ...negativeExamples.map((ne) => ({
          id: ne.id,
          type: "negative_example" as const,
          capturedAt: ne.capturedAt,
          confidence: ne.confidence,
          sourceSessionId: ne.sourceSessionId || undefined,
          similarity: 1 - ne.confidence, // Inverse of confidence = similarity to user
          duration: ne.durationSeconds || undefined,
          hasAudio: !!ne.audioData, // Audio is available if audioData is stored
        })),
        ...adaptiveSamples.map((as) => ({
          id: as.id,
          type: "adaptive_sample" as const,
          capturedAt: as.admittedAt,
          confidence: as.admissionSimilarity,
          sourceSessionId: as.sourceSessionId || undefined,
          similarity: as.admissionSimilarity,
          duration: as.durationSeconds,
          hasAudio: !!as.audioData, // Audio is available if audioData is stored
        })),
      ];

      // Sort by capturedAt descending
      recordings.sort(
        (a, b) =>
          new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
      );

      res.status(200).json({
        success: true,
        recordings: recordings.slice(0, limit),
        stats: {
          totalNegatives: negativeExamples.length,
          totalPositives: adaptiveSamples.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/adaptive-learning/reclassify/:recordingId
   * Reclassify a recording - convert negative to positive or positive to negative
   * This helps users correct misclassified audio
   */
  async reclassifyRecording(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { recordingId } = req.params;
      const {
        newClassification, // 'user' or 'other'
        profileId,
      } = req.body;

      if (
        !newClassification ||
        !["user", "other"].includes(newClassification)
      ) {
        res
          .status(400)
          .json({ error: "Invalid classification. Must be 'user' or 'other'" });
        return;
      }

      // Try to find as negative example first
      const negativeExample = await prisma.negativeExample.findFirst({
        where: { id: recordingId, userId: req.userId },
      });

      if (negativeExample && newClassification === "user") {
        // User says this IS them - remove from negatives
        // Note: We can't automatically add to adaptive samples since we don't have the audio
        // We just remove the negative association
        await prisma.negativeExample.delete({
          where: { id: recordingId },
        });

        res.status(200).json({
          success: true,
          message: "Recording reclassified as user. Negative example removed.",
          action: "removed_negative",
        });
        return;
      }

      // Try to find as adaptive sample
      if (profileId) {
        const profile = await prisma.speakerProfile.findUnique({
          where: { id: profileId },
        });

        if (!profile || profile.userId !== req.userId) {
          res.status(404).json({ error: "Profile not found" });
          return;
        }

        const adaptiveSample = await prisma.adaptiveSample.findFirst({
          where: { id: recordingId, speakerProfileId: profileId },
        });

        if (adaptiveSample && newClassification === "other") {
          // User says this is NOT them - mark as inactive and add to negatives
          await prisma.adaptiveSample.update({
            where: { id: recordingId },
            data: { isActive: false },
          });

          // Add to negative examples with the embedding
          const embedding = adaptiveSample.embedding as number[];
          if (embedding && Array.isArray(embedding)) {
            await prisma.negativeExample.create({
              data: {
                userId: req.userId,
                embedding,
                confidence: 1 - adaptiveSample.admissionSimilarity,
                sourceSessionId: adaptiveSample.sourceSessionId,
              },
            });
          }

          res.status(200).json({
            success: true,
            message:
              "Recording reclassified as other. Sample deactivated and added to negatives.",
            action: "converted_to_negative",
          });
          return;
        }
      }

      res.status(404).json({ error: "Recording not found" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/adaptive-learning/recent-recordings/clear-negatives
   * Clear all negative examples - useful for resetting when the system
   * has accumulated too many wrong classifications
   */
  async clearAllNegatives(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const result = await prisma.negativeExample.deleteMany({
        where: { userId: req.userId },
      });

      res.status(200).json({
        success: true,
        message: `Cleared ${result.count} negative examples`,
        deletedCount: result.count,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/adaptive-learning/negative-examples/:recordingId/audio
   * Download audio for a negative example
   */
  async getNegativeExampleAudio(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { recordingId } = req.params;

      const recording = await prisma.negativeExample.findUnique({
        where: { id: recordingId },
      });

      if (!recording || recording.userId !== req.userId) {
        res.status(404).json({ error: "Recording not found" });
        return;
      }

      if (!recording.audioData) {
        res.status(404).json({ error: "Audio data not available" });
        return;
      }

      res.setHeader("Content-Type", recording.audioMimeType || "audio/webm");
      res.setHeader("Content-Length", recording.audioData.length);
      res.send(recording.audioData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/adaptive-learning/adaptive-samples/:recordingId/audio
   * Download audio for an adaptive sample
   */
  async getAdaptiveSampleAudio(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { recordingId } = req.params;

      const sample = await prisma.adaptiveSample.findUnique({
        where: { id: recordingId },
        include: {
          speakerProfile: {
            select: { userId: true },
          },
        },
      });

      if (!sample || sample.speakerProfile.userId !== req.userId) {
        res.status(404).json({ error: "Sample not found" });
        return;
      }

      if (!sample.audioData) {
        res.status(404).json({ error: "Audio data not available" });
        return;
      }

      res.setHeader("Content-Type", sample.audioMimeType || "audio/webm");
      res.setHeader("Content-Length", sample.audioData.length);
      res.send(sample.audioData);
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const adaptiveLearningController = new AdaptiveLearningController();
