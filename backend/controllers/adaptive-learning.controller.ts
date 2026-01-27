/**
 * Adaptive Speaker Learning Controller
 *
 * REST API endpoints for managing adaptive speaker learning:
 * - Enable/disable adaptive learning
 * - View status and health metrics
 * - Manage adaptive samples
 * - Rollback to previous states
 * - View negative examples
 */

import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import {
  adaptiveSpeakerLearningService,
  AdaptiveLearningConfig,
  DEFAULT_ADAPTIVE_CONFIG,
} from "../services/adaptive-speaker-learning.js";
import prisma from "../services/prisma.js";

export class AdaptiveLearningController {
  /**
   * GET /api/adaptive-learning/status/:profileId
   * Get adaptive learning status for a profile
   */
  async getStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const status = await adaptiveSpeakerLearningService.getStatus(
        profileId,
        req.userId
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
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const result = await adaptiveSpeakerLearningService.enable(
        profileId,
        req.userId
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
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const result = await adaptiveSpeakerLearningService.disable(
        profileId,
        req.userId
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
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const result = await adaptiveSpeakerLearningService.unfreeze(
        profileId,
        req.userId
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
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { profileId } = req.params;

      const health = await adaptiveSpeakerLearningService.runHealthCheck(
        profileId,
        req.userId
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
    next: NextFunction
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
        { includeInactive }
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
    next: NextFunction
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
        req.userId
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
    next: NextFunction
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
    next: NextFunction
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
        snapshotId
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
    next: NextFunction
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
          profileId
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
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const stats = await adaptiveSpeakerLearningService.negatives.getStats(
        req.userId
      );

      const negatives = await adaptiveSpeakerLearningService.negatives.getNegativeExamples(
        req.userId
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
    next: NextFunction
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

      res.status(200).json({ success: true, message: "Negative example deleted" });
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
    next: NextFunction
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
    next: NextFunction
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
    next: NextFunction
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
}

// Export singleton instance
export const adaptiveLearningController = new AdaptiveLearningController();
