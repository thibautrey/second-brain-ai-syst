import prisma from "./prisma.js";

export interface CreateTipInput {
  userId: string;
  title: string;
  description: string;
  category?: string;
  targetFeature?: string;
  priority?: number;
  icon?: string;
  metadata?: Record<string, any>;
}

class TipsService {
  /**
   * Create a new tip
   */
  async createTip(input: CreateTipInput) {
    const {
      userId,
      title,
      description,
      category = "general",
      targetFeature,
      priority = 0,
      icon,
      metadata = {},
    } = input;

    const tip = await prisma.tip.create({
      data: {
        userId,
        title,
        description,
        category,
        targetFeature,
        priority,
        icon,
        metadata,
      },
    });

    return tip;
  }

  /**
   * Get active tips for a user (not dismissed, ordered by priority)
   */
  async getActiveTips(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      targetFeature?: string;
    } = {},
  ) {
    const { limit = 10, offset = 0, targetFeature } = options;

    const where: any = {
      userId,
      isDismissed: false,
    };

    if (targetFeature) {
      where.targetFeature = targetFeature;
    }

    const [tips, total] = await Promise.all([
      prisma.tip.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.tip.count({ where }),
    ]);

    return {
      tips,
      total,
      limit,
      offset,
    };
  }

  /**
   * Dismiss a tip for a user
   */
  async dismissTip(tipId: string, userId: string) {
    const tip = await prisma.tip.findUnique({
      where: { id: tipId },
    });

    if (!tip || tip.userId !== userId) {
      throw new Error("Tip not found or unauthorized");
    }

    return prisma.tip.update({
      where: { id: tipId },
      data: {
        isDismissed: true,
        dismissedAt: new Date(),
      },
    });
  }

  /**
   * Track tip view
   */
  async viewTip(tipId: string, userId: string) {
    const tip = await prisma.tip.findUnique({
      where: { id: tipId },
    });

    if (!tip || tip.userId !== userId) {
      throw new Error("Tip not found or unauthorized");
    }

    return prisma.tip.update({
      where: { id: tipId },
      data: {
        viewCount: {
          increment: 1,
        },
        lastViewedAt: new Date(),
      },
    });
  }

  /**
   * Get all tips for a user (including dismissed)
   */
  async getAllTips(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const { limit = 50, offset = 0 } = options;

    const [tips, total] = await Promise.all([
      prisma.tip.findMany({
        where: { userId },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.tip.count({ where: { userId } }),
    ]);

    return {
      tips,
      total,
      limit,
      offset,
    };
  }

  /**
   * Delete a tip
   */
  async deleteTip(tipId: string, userId: string) {
    const tip = await prisma.tip.findUnique({
      where: { id: tipId },
    });

    if (!tip || tip.userId !== userId) {
      throw new Error("Tip not found or unauthorized");
    }

    return prisma.tip.delete({
      where: { id: tipId },
    });
  }
}

export const tipsService = new TipsService();
