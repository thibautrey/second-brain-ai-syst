import { Request, Response } from "express";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import prisma from "../services/prisma.js";

class UserPresenceController {
  /**
   * POST /api/user/presence/heartbeat
   * Record user presence heartbeat
   */
  async heartbeat(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { timestamp, isFocused } = req.body;

      // Update or create user session
      await prisma.userPresence.upsert({
        where: { userId },
        create: {
          userId,
          lastActiveAt: new Date(timestamp),
          isFocused: isFocused ?? true,
          isOnline: true,
        },
        update: {
          lastActiveAt: new Date(timestamp),
          isFocused: isFocused ?? true,
          isOnline: true,
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[UserPresenceController] Heartbeat error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/user/presence/status
   * Get current user presence status
   */
  async getStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const presence = await prisma.userPresence.findUnique({
        where: { userId },
      });

      const isOnline = presence?.isOnline ?? false;
      const isFocused = presence?.isFocused ?? false;
      const lastActiveAt = presence?.lastActiveAt ?? null;

      // Consider user offline if last active more than 2 minutes ago
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const isActivelyOnline = lastActiveAt && lastActiveAt > twoMinutesAgo;

      res.json({
        success: true,
        isOnline: isActivelyOnline ? true : false,
        isFocused: isActivelyOnline ? isFocused : false,
        lastActiveAt,
      });
    } catch (error: any) {
      console.error("[UserPresenceController] Get status error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/user/presence/offline
   * Mark user as offline
   */
  async markOffline(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await prisma.userPresence.upsert({
        where: { userId },
        create: {
          userId,
          isOnline: false,
          isFocused: false,
          lastActiveAt: new Date(),
        },
        update: {
          isOnline: false,
          isFocused: false,
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[UserPresenceController] Mark offline error:", error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const userPresenceController = new UserPresenceController();
