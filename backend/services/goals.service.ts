/**
 * Goals Service
 * 
 * Service for managing user goals including CRUD operations
 */

import prisma from "./prisma.js";
import { GoalStatus } from "@prisma/client";

export interface CreateGoalData {
  title: string;
  description?: string;
  category: string;
  targetDate?: Date;
  detectedFrom?: string;
  confidence?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateGoalData {
  title?: string;
  description?: string;
  category?: string;
  status?: GoalStatus;
  progress?: number;
  targetDate?: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class GoalsService {
  /**
   * Get all goals for a user
   */
  async getUserGoals(
    userId: string,
    options?: {
      status?: GoalStatus;
      category?: string;
      includeArchived?: boolean;
    }
  ) {
    const where: any = { userId };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.category) {
      where.category = options.category;
    }

    if (!options?.includeArchived) {
      where.status = { not: GoalStatus.ARCHIVED };
    }

    return await prisma.goal.findMany({
      where,
      orderBy: [
        { status: "asc" }, // Active first
        { createdAt: "desc" },
      ],
    });
  }

  /**
   * Get a specific goal
   */
  async getGoal(goalId: string, userId: string) {
    return await prisma.goal.findFirst({
      where: { id: goalId, userId },
    });
  }

  /**
   * Create a new goal
   */
  async createGoal(userId: string, data: CreateGoalData) {
    return await prisma.goal.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        category: data.category,
        targetDate: data.targetDate,
        detectedFrom: data.detectedFrom || "manual",
        confidence: data.confidence || 1.0,
        tags: data.tags || [],
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Update a goal
   */
  async updateGoal(goalId: string, userId: string, data: UpdateGoalData) {
    const updateData: any = { ...data };

    // Auto-set completedAt when marking as completed
    if (data.status === GoalStatus.COMPLETED && !updateData.completedAt) {
      updateData.completedAt = new Date();
      updateData.progress = 100;
    }

    // Auto-set archivedAt when archiving
    if (data.status === GoalStatus.ARCHIVED && !updateData.archivedAt) {
      updateData.archivedAt = new Date();
    }

    return await prisma.goal.update({
      where: { id: goalId, userId },
      data: updateData,
    });
  }

  /**
   * Delete a goal
   */
  async deleteGoal(goalId: string, userId: string) {
    return await prisma.goal.delete({
      where: { id: goalId, userId },
    });
  }

  /**
   * Update goal progress
   */
  async updateProgress(goalId: string, userId: string, progress: number) {
    const data: any = { progress: Math.min(100, Math.max(0, progress)) };

    // Auto-complete when reaching 100%
    if (progress >= 100) {
      data.status = GoalStatus.COMPLETED;
      data.completedAt = new Date();
    }

    return await prisma.goal.update({
      where: { id: goalId, userId },
      data,
    });
  }

  /**
   * Add a milestone to a goal
   */
  async addMilestone(
    goalId: string,
    userId: string,
    milestone: { name: string; completed?: boolean; date?: Date }
  ) {
    const goal = await this.getGoal(goalId, userId);
    if (!goal) throw new Error("Goal not found");

    const milestones = (goal.milestones as any[]) || [];
    milestones.push({
      name: milestone.name,
      completed: milestone.completed || false,
      date: milestone.date || new Date(),
    });

    return await prisma.goal.update({
      where: { id: goalId, userId },
      data: { milestones },
    });
  }

  /**
   * Get goal categories for a user
   */
  async getCategories(userId: string): Promise<string[]> {
    const goals = await prisma.goal.findMany({
      where: { userId },
      select: { category: true },
      distinct: ["category"],
    });

    return goals.map((g) => g.category);
  }

  /**
   * Get goal statistics
   */
  async getStats(userId: string) {
    const [total, active, completed, paused, abandoned] = await Promise.all([
      prisma.goal.count({ where: { userId, status: { not: GoalStatus.ARCHIVED } } }),
      prisma.goal.count({ where: { userId, status: GoalStatus.ACTIVE } }),
      prisma.goal.count({ where: { userId, status: GoalStatus.COMPLETED } }),
      prisma.goal.count({ where: { userId, status: GoalStatus.PAUSED } }),
      prisma.goal.count({ where: { userId, status: GoalStatus.ABANDONED } }),
    ]);

    return {
      total,
      active,
      completed,
      paused,
      abandoned,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }
}

export const goalsService = new GoalsService();
