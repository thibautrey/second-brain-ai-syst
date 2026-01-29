import { Request, Response } from "express";
import { notificationService } from "../services/notification.js";
import { notificationSpamDetector } from "../services/notification-spam-detector.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

export class NotificationController {
  /**
   * POST /api/notifications
   * Create a new notification (for AI to use)
   */
  async create(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await notificationService.createNotification({
        userId,
        ...req.body,
      });

      if (result.blocked) {
        return res.status(429).json({
          success: false,
          blocked: true,
          reason: result.spamCheck.reason,
          topic: result.spamCheck.matchedTopic,
          nextAllowedAt: result.spamCheck.nextAllowedAt,
          isGivenUp: result.spamCheck.isGivenUp,
        });
      }

      res.json({ success: true, notification: result.notification });
    } catch (error: any) {
      console.error("[NotificationController] Create error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/notifications
   * Get user notifications
   */
  async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const unreadOnly = req.query.unreadOnly === "true";

      const result = await notificationService.getUserNotifications(userId, {
        limit,
        offset,
        unreadOnly,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("[NotificationController] List error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/notifications/poll
   * Polling endpoint for notifications (WebSocket fallback)
   * Returns notifications sent since the specified timestamp
   */
  async poll(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const since = parseInt(req.query.since as string) || 0;

      // Get recent notifications since the specified timestamp
      const result = await notificationService.getUserNotifications(userId, {
        limit: 100,
        offset: 0,
        unreadOnly: false, // Send all notifications regardless of read status
      });

      // Filter to only notifications created after 'since'
      const sinceDate = new Date(since);
      const filteredNotifications = result.notifications.filter(
        (n: any) => new Date(n.createdAt) > sinceDate
      );

      res.json({
        success: true,
        notifications: filteredNotifications,
        total: filteredNotifications.length,
        polledAt: Date.now(),
      });
    } catch (error: any) {
      console.error("[NotificationController] Poll error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Mark notification as read
   */
  async markRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      await notificationService.markAsRead(id, userId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[NotificationController] Mark read error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/notifications/topics
   * Get notification topic trackers (spam detection state)
   */
  async getTopicTrackers(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const includeGivenUp = req.query.includeGivenUp !== "false";
      const trackers = await notificationSpamDetector.getUserTopicTrackers(
        userId,
        includeGivenUp
      );

      res.json({
        success: true,
        trackers,
        total: trackers.length,
      });
    } catch (error: any) {
      console.error("[NotificationController] Get topics error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/notifications/topics/:topic/revive
   * Revive a given-up topic (user wants to hear about it again)
   */
  async reviveTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { topic } = req.params;
      const success = await notificationSpamDetector.reviveTopic(userId, topic);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: "Topic not found",
        });
      }

      res.json({
        success: true,
        message: `Topic "${topic}" has been revived. You will receive notifications about it again.`,
      });
    } catch (error: any) {
      console.error("[NotificationController] Revive topic error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/notifications/:id/interact
   * Record user interaction with a notification (resets cooldown)
   */
  async recordInteraction(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      await notificationSpamDetector.recordUserResponse(userId, id);

      res.json({
        success: true,
        message: "Interaction recorded. Cooldown has been reset for this topic.",
      });
    } catch (error: any) {
      console.error("[NotificationController] Record interaction error:", error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const notificationController = new NotificationController();
