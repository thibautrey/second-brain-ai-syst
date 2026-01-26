import { Request, Response } from "express";
import { tipsService } from "../services/tips.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

export class TipsController {
  /**
   * POST /api/tips
   * Create a new tip (admin/system use)
   */
  async create(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tip = await tipsService.createTip({
        userId,
        ...req.body,
      });

      res.json({ success: true, tip });
    } catch (error: any) {
      console.error("[TipsController] Create error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/tips
   * Get active tips for user
   */
  async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const targetFeature = req.query.targetFeature as string | undefined;

      const result = await tipsService.getActiveTips(userId, {
        limit,
        offset,
        targetFeature,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("[TipsController] List error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/tips/:id/view
   * Track tip view and increment view count
   */
  async view(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const tip = await tipsService.viewTip(id, userId);

      res.json({ success: true, tip });
    } catch (error: any) {
      console.error("[TipsController] View error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/tips/:id/dismiss
   * Dismiss a tip for the user
   */
  async dismiss(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const tip = await tipsService.dismissTip(id, userId);

      res.json({ success: true, tip });
    } catch (error: any) {
      console.error("[TipsController] Dismiss error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/tips/:id
   * Delete a tip
   */
  async delete(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      await tipsService.deleteTip(id, userId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[TipsController] Delete error:", error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const tipsController = new TipsController();
