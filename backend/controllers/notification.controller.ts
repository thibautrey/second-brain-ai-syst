import { Request, Response } from "express";
import { notificationService } from "../services/notification";

export class NotificationController {
  /**
   * POST /api/notifications
   * Create a new notification (for AI to use)
   */
  async create(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const notification = await notificationService.createNotification({
        userId,
        ...req.body,
      });

      res.json({ success: true, notification });
    } catch (error: any) {
      console.error("[NotificationController] Create error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/notifications
   * Get user notifications
   */
  async list(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
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
   * PATCH /api/notifications/:id/read
   * Mark notification as read
   */
  async markRead(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
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
}

export const notificationController = new NotificationController();
