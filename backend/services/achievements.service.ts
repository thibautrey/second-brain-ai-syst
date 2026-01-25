/**
 * Achievements Service
 * 
 * Service for managing user achievements including CRUD operations
 */

import prisma from "./prisma.js";

export interface CreateAchievementData {
  title: string;
  description: string;
  category: string;
  icon?: string;
  detectedFrom?: string;
  confidence?: number;
  criteria?: Record<string, any>;
  significance?: string;
  isHidden?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateAchievementData {
  title?: string;
  description?: string;
  category?: string;
  icon?: string;
  criteria?: Record<string, any>;
  significance?: string;
  isHidden?: boolean;
  metadata?: Record<string, any>;
}

export class AchievementsService {
  /**
   * Get all achievements for a user
   */
  async getUserAchievements(
    userId: string,
    options?: {
      category?: string;
      unlockedOnly?: boolean;
      includeHidden?: boolean;
    }
  ) {
    const where: any = { userId };

    if (options?.category) {
      where.category = options.category;
    }

    if (options?.unlockedOnly) {
      where.isUnlocked = true;
    }

    if (!options?.includeHidden) {
      where.OR = [
        { isHidden: false },
        { isUnlocked: true }, // Show hidden achievements once unlocked
      ];
    }

    return await prisma.achievement.findMany({
      where,
      orderBy: [
        { isUnlocked: "desc" }, // Unlocked first
        { displayOrder: "asc" },
        { createdAt: "desc" },
      ],
    });
  }

  /**
   * Get a specific achievement
   */
  async getAchievement(achievementId: string, userId: string) {
    return await prisma.achievement.findFirst({
      where: { id: achievementId, userId },
    });
  }

  /**
   * Create a new achievement
   */
  async createAchievement(userId: string, data: CreateAchievementData) {
    return await prisma.achievement.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        category: data.category,
        icon: data.icon,
        detectedFrom: data.detectedFrom || "manual",
        confidence: data.confidence || 1.0,
        criteria: data.criteria || {},
        significance: data.significance || "normal",
        isHidden: data.isHidden ?? true, // Hidden by default until unlocked
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Update an achievement
   */
  async updateAchievement(
    achievementId: string,
    userId: string,
    data: UpdateAchievementData
  ) {
    return await prisma.achievement.update({
      where: { id: achievementId, userId },
      data,
    });
  }

  /**
   * Delete an achievement
   */
  async deleteAchievement(achievementId: string, userId: string) {
    return await prisma.achievement.delete({
      where: { id: achievementId, userId },
    });
  }

  /**
   * Unlock an achievement
   */
  async unlockAchievement(achievementId: string, userId: string) {
    const achievement = await prisma.achievement.update({
      where: { id: achievementId, userId },
      data: {
        isUnlocked: true,
        unlockedAt: new Date(),
        isHidden: false, // Reveal when unlocked
      },
    });

    // Send notification
    const notificationService = await import("./tools/notification.service.js");
    await notificationService.notificationService.notifyAchievement(
      userId,
      achievement.title,
      achievement.description
    );

    return achievement;
  }

  /**
   * Get achievement categories for a user
   */
  async getCategories(userId: string): Promise<string[]> {
    const achievements = await prisma.achievement.findMany({
      where: { userId },
      select: { category: true },
      distinct: ["category"],
    });

    return achievements.map((a) => a.category);
  }

  /**
   * Get achievement statistics
   */
  async getStats(userId: string) {
    const [total, unlocked, byCategory] = await Promise.all([
      prisma.achievement.count({ where: { userId } }),
      prisma.achievement.count({ where: { userId, isUnlocked: true } }),
      prisma.achievement.groupBy({
        by: ["category"],
        where: { userId },
        _count: { id: true },
      }),
    ]);

    const unlockedByCategory = await prisma.achievement.groupBy({
      by: ["category"],
      where: { userId, isUnlocked: true },
      _count: { id: true },
    });

    const categoryStats = byCategory.map((cat) => ({
      category: cat.category,
      total: cat._count.id,
      unlocked:
        unlockedByCategory.find((u) => u.category === cat.category)?._count.id || 0,
    }));

    return {
      total,
      unlocked,
      locked: total - unlocked,
      unlockedPercentage: total > 0 ? (unlocked / total) * 100 : 0,
      byCategory: categoryStats,
    };
  }

  /**
   * Check if achievement criteria are met
   */
  async checkCriteria(
    achievementId: string,
    userId: string,
    context: Record<string, any>
  ): Promise<boolean> {
    const achievement = await this.getAchievement(achievementId, userId);
    if (!achievement || achievement.isUnlocked) return false;

    // This is a simplified version - the AI agent will handle more complex criteria
    const criteria = achievement.criteria as any;

    // Example criteria checks (extend as needed)
    if (criteria.goalCount && context.completedGoals >= criteria.goalCount) {
      return true;
    }

    if (criteria.memoryCount && context.totalMemories >= criteria.memoryCount) {
      return true;
    }

    if (criteria.streak && context.currentStreak >= criteria.streak) {
      return true;
    }

    return false;
  }
}

export const achievementsService = new AchievementsService();
