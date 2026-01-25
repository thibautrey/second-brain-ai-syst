/**
 * Goals Controller
 * 
 * REST API endpoints for managing user goals
 */

import { Request, Response } from "express";
import { goalsService } from "../services/goals.service.js";
import { GoalStatus } from "@prisma/client";

export class GoalsController {
  /**
   * GET /api/goals
   * Get all goals for the authenticated user
   */
  async listGoals(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { status, category, includeArchived } = req.query;

      const goals = await goalsService.getUserGoals(userId, {
        status: status as GoalStatus,
        category: category as string,
        includeArchived: includeArchived === "true",
      });

      res.json({ success: true, goals });
    } catch (error: any) {
      console.error("Error listing goals:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/goals/stats
   * Get goal statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const stats = await goalsService.getStats(userId);

      res.json({ success: true, stats });
    } catch (error: any) {
      console.error("Error getting goal stats:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/goals/categories
   * Get all goal categories
   */
  async getCategories(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const categories = await goalsService.getCategories(userId);

      res.json({ success: true, categories });
    } catch (error: any) {
      console.error("Error getting categories:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/goals/:id
   * Get a specific goal
   */
  async getGoal(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const goal = await goalsService.getGoal(id, userId);
      if (!goal) {
        return res.status(404).json({ success: false, error: "Goal not found" });
      }

      res.json({ success: true, goal });
    } catch (error: any) {
      console.error("Error getting goal:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/goals
   * Create a new goal
   */
  async createGoal(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { title, description, category, targetDate, tags, metadata } = req.body;

      if (!title || !category) {
        return res.status(400).json({
          success: false,
          error: "Title and category are required",
        });
      }

      const goal = await goalsService.createGoal(userId, {
        title,
        description,
        category,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        tags,
        metadata,
        detectedFrom: "manual",
        confidence: 1.0,
      });

      res.status(201).json({ success: true, goal });
    } catch (error: any) {
      console.error("Error creating goal:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PATCH /api/goals/:id
   * Update a goal
   */
  async updateGoal(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const updateData = req.body;

      const goal = await goalsService.updateGoal(id, userId, updateData);

      res.json({ success: true, goal });
    } catch (error: any) {
      console.error("Error updating goal:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/goals/:id
   * Delete a goal
   */
  async deleteGoal(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      await goalsService.deleteGoal(id, userId);

      res.json({ success: true, message: "Goal deleted" });
    } catch (error: any) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PATCH /api/goals/:id/progress
   * Update goal progress
   */
  async updateProgress(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { progress } = req.body;

      if (typeof progress !== "number" || progress < 0 || progress > 100) {
        return res.status(400).json({
          success: false,
          error: "Progress must be a number between 0 and 100",
        });
      }

      const goal = await goalsService.updateProgress(id, userId, progress);

      res.json({ success: true, goal });
    } catch (error: any) {
      console.error("Error updating progress:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/goals/:id/milestones
   * Add a milestone to a goal
   */
  async addMilestone(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { name, completed, date } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: "Milestone name is required",
        });
      }

      const goal = await goalsService.addMilestone(id, userId, {
        name,
        completed: completed ?? false,
        date: date ? new Date(date) : new Date(),
      });

      res.json({ success: true, goal });
    } catch (error: any) {
      console.error("Error adding milestone:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const goalsController = new GoalsController();
