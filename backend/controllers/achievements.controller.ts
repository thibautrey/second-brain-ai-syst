/**
 * Achievements Controller
 * 
 * REST API endpoints for managing user achievements
 */

import { Request, Response } from "express";
import { achievementsService } from "../services/achievements.service.js";

export class AchievementsController {
  /**
   * GET /api/achievements
   * Get all achievements for the authenticated user
   */
  async listAchievements(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { category, unlockedOnly, includeHidden } = req.query;

      const achievements = await achievementsService.getUserAchievements(userId, {
        category: category as string,
        unlockedOnly: unlockedOnly === "true",
        includeHidden: includeHidden === "true",
      });

      res.json({ success: true, achievements });
    } catch (error: any) {
      console.error("Error listing achievements:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/achievements/stats
   * Get achievement statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const stats = await achievementsService.getStats(userId);

      res.json({ success: true, stats });
    } catch (error: any) {
      console.error("Error getting achievement stats:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/achievements/categories
   * Get all achievement categories
   */
  async getCategories(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const categories = await achievementsService.getCategories(userId);

      res.json({ success: true, categories });
    } catch (error: any) {
      console.error("Error getting categories:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/achievements/:id
   * Get a specific achievement
   */
  async getAchievement(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const achievement = await achievementsService.getAchievement(id, userId);
      if (!achievement) {
        return res.status(404).json({
          success: false,
          error: "Achievement not found",
        });
      }

      res.json({ success: true, achievement });
    } catch (error: any) {
      console.error("Error getting achievement:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/achievements
   * Create a new achievement (manual)
   */
  async createAchievement(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const {
        title,
        description,
        category,
        icon,
        significance,
        criteria,
        isHidden,
        metadata,
      } = req.body;

      if (!title || !description || !category) {
        return res.status(400).json({
          success: false,
          error: "Title, description, and category are required",
        });
      }

      const achievement = await achievementsService.createAchievement(userId, {
        title,
        description,
        category,
        icon,
        significance,
        criteria,
        isHidden,
        metadata,
        detectedFrom: "manual",
        confidence: 1.0,
      });

      res.status(201).json({ success: true, achievement });
    } catch (error: any) {
      console.error("Error creating achievement:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PATCH /api/achievements/:id
   * Update an achievement
   */
  async updateAchievement(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const updateData = req.body;

      const achievement = await achievementsService.updateAchievement(
        id,
        userId,
        updateData
      );

      res.json({ success: true, achievement });
    } catch (error: any) {
      console.error("Error updating achievement:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/achievements/:id
   * Delete an achievement
   */
  async deleteAchievement(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      await achievementsService.deleteAchievement(id, userId);

      res.json({ success: true, message: "Achievement deleted" });
    } catch (error: any) {
      console.error("Error deleting achievement:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/achievements/:id/unlock
   * Manually unlock an achievement
   */
  async unlockAchievement(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const achievement = await achievementsService.unlockAchievement(id, userId);

      res.json({ success: true, achievement });
    } catch (error: any) {
      console.error("Error unlocking achievement:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const achievementsController = new AchievementsController();
