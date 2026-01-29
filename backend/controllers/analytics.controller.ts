/**
 * Analytics Controller
 *
 * Provides comprehensive analytics data for the user's Second Brain
 * Consumer-focused, non-technical insights
 */

import { Router, Response, NextFunction } from "express";
import prisma from "../services/prisma.js";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware.js";
import { llmRouterService } from "../services/llm-router.js";
import { parseJSONFromLLMResponse } from "../utils/json-parser.js";

const router = Router();

// Time period configurations
const PERIOD_DAYS: Record<string, number> = {
  today: 1,
  week: 7,
  month: 30,
  year: 365,
};

/**
 * GET /api/analytics
 * Get comprehensive analytics for a time period
 */
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const period = (req.query.period as string) || "week";
      const days = PERIOD_DAYS[period] || 7;
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const previousStartDate = new Date(
        startDate.getTime() - days * 24 * 60 * 60 * 1000,
      );

      // Fetch current period stats
      const [
        currentMemories,
        previousMemories,
        currentInteractions,
        previousInteractions,
        activeGoals,
        previousActiveGoals,
        achievements,
        previousAchievements,
        activityData,
        topicsData,
        sentimentData,
        streakData,
      ] = await Promise.all([
        // Current period memories
        prisma.memory.count({
          where: {
            userId: req.userId,
            createdAt: { gte: startDate },
            isArchived: false,
          },
        }),
        // Previous period memories (for trend)
        prisma.memory.count({
          where: {
            userId: req.userId,
            createdAt: { gte: previousStartDate, lt: startDate },
            isArchived: false,
          },
        }),
        // Current interactions
        prisma.processedInput.count({
          where: {
            userId: req.userId,
            createdAt: { gte: startDate },
            status: "completed",
          },
        }),
        // Previous interactions
        prisma.processedInput.count({
          where: {
            userId: req.userId,
            createdAt: { gte: previousStartDate, lt: startDate },
            status: "completed",
          },
        }),
        // Active goals
        prisma.goal.count({
          where: {
            userId: req.userId,
            status: { in: ["ACTIVE", "PAUSED"] },
          },
        }),
        // Previous period goals (approximation)
        prisma.goal.count({
          where: {
            userId: req.userId,
            createdAt: { lt: startDate },
            status: { in: ["ACTIVE", "PAUSED"] },
          },
        }),
        // Achievements
        prisma.achievement.count({
          where: {
            userId: req.userId,
            unlockedAt: { gte: startDate },
          },
        }),
        // Previous achievements
        prisma.achievement.count({
          where: {
            userId: req.userId,
            unlockedAt: { gte: previousStartDate, lt: startDate },
          },
        }),
        // Activity by hour
        getActivityByHour(req.userId, startDate),
        // Top topics from tags
        getTopTopics(req.userId, startDate),
        // Sentiment overview
        getSentimentOverview(req.userId, startDate),
        // Streak calculation
        getStreakData(req.userId),
      ]);

      // Calculate trends (percentage change)
      const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      // Generate weekly data if applicable
      let weeklyData:
        | Array<{ day: string; count: number; date: string }>
        | undefined;
      if (period === "week") {
        weeklyData = await getWeeklyData(req.userId);
      }

      res.json({
        stats: {
          totalMemories: currentMemories,
          totalInteractions: currentInteractions,
          activeGoals,
          achievements,
          currentStreak: streakData.currentStreak,
          longestStreak: streakData.longestStreak,
          weeklyData,
        },
        trends: {
          memoriesChange: calculateTrend(currentMemories, previousMemories),
          interactionsChange: calculateTrend(
            currentInteractions,
            previousInteractions,
          ),
          goalsChange: calculateTrend(activeGoals, previousActiveGoals),
          achievementsChange: calculateTrend(
            achievements,
            previousAchievements,
          ),
        },
        activityByHour: activityData,
        topTopics: topicsData,
        sentimentOverview: sentimentData,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/analytics/insights
 * Get AI-generated insights and latest summary
 */
router.get(
  "/insights",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get the latest summary
      const latestSummary = await prisma.summary.findFirst({
        where: { userId: req.userId },
        orderBy: { periodEnd: "desc" },
      });

      // Get recent memories for insight generation
      const recentMemories = await prisma.memory.findMany({
        where: {
          userId: req.userId,
          isArchived: false,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      let insights: string[] = [];

      // Try to generate AI insights if we have enough data
      if (recentMemories.length >= 5) {
        try {
          insights = await generateAIInsights(req.userId, recentMemories);
        } catch (error) {
          const errorMessage = error instanceof Error && error.message ? error.message : String(error);
          console.error("Failed to generate AI insights:", errorMessage);
          insights = generateFallbackInsights(recentMemories);
        }
      } else if (recentMemories.length > 0) {
        insights = generateFallbackInsights(recentMemories);
      }

      // Format the latest summary for the frontend
      const formattedSummary = latestSummary
        ? {
            id: latestSummary.id,
            title: latestSummary.title || "Your Recent Activity",
            summary: latestSummary.content,
            keyInsights: latestSummary.keyInsights || [],
            topics: latestSummary.topics || [],
            sentiment: latestSummary.sentiment || "neutral",
            periodStart: latestSummary.periodStart.toISOString(),
            periodEnd: latestSummary.periodEnd.toISOString(),
          }
        : null;

      res.json({
        insights,
        latestSummary: formattedSummary,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============ Helper Functions ============

async function getActivityByHour(userId: string, startDate: Date) {
  // Get memories grouped by hour
  const memories = await prisma.memory.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
      isArchived: false,
    },
    select: { createdAt: true },
  });

  // Initialize 24 hours
  const hourCounts = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }));

  // Count memories by hour
  memories.forEach((memory) => {
    const hour = memory.createdAt.getHours();
    hourCounts[hour].count++;
  });

  return hourCounts;
}

async function getTopTopics(userId: string, startDate: Date) {
  // Get all tags from recent memories
  const memories = await prisma.memory.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
      isArchived: false,
    },
    select: { tags: true, entities: true },
  });

  // Count tag occurrences
  const tagCounts: Record<string, number> = {};
  memories.forEach((memory) => {
    [...memory.tags, ...memory.entities].forEach((tag) => {
      const normalizedTag = tag.toLowerCase().trim();
      if (normalizedTag && normalizedTag.length > 2) {
        tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
      }
    });
  });

  // Sort and get top 5
  const sortedTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const maxCount = sortedTags[0]?.[1] || 1;

  return sortedTags.map(([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / maxCount) * 100),
  }));
}

async function getSentimentOverview(userId: string, startDate: Date) {
  // Get summaries with sentiment data
  const summaries = await prisma.summary.findMany({
    where: {
      userId,
      periodEnd: { gte: startDate },
    },
    select: { sentiment: true },
  });

  // Also analyze memory content if no summaries
  const memories = await prisma.memory.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
      isArchived: false,
    },
    select: { content: true, importanceScore: true },
  });

  let positive = 0;
  let neutral = 0;
  let negative = 0;

  // Count from summaries
  summaries.forEach((summary) => {
    switch (summary.sentiment) {
      case "positive":
        positive++;
        break;
      case "negative":
        negative++;
        break;
      case "mixed":
        neutral++;
        break;
      default:
        neutral++;
    }
  });

  // If no summaries, do basic sentiment estimation from importance scores
  if (summaries.length === 0 && memories.length > 0) {
    memories.forEach((memory) => {
      // Use importance score as a rough proxy
      if (memory.importanceScore >= 0.7) {
        positive++;
      } else if (memory.importanceScore <= 0.3) {
        negative++;
      } else {
        neutral++;
      }
    });
  }

  return { positive, neutral, negative };
}

async function getStreakData(userId: string) {
  // Get all memories ordered by date
  const memories = await prisma.memory.findMany({
    where: {
      userId,
      isArchived: false,
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (memories.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Get unique days
  const uniqueDays = new Set<string>();
  memories.forEach((memory) => {
    const day = memory.createdAt.toISOString().split("T")[0];
    uniqueDays.add(day);
  });

  const sortedDays = Array.from(uniqueDays).sort().reverse();

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Check if there's activity today or yesterday to count streak
  if (sortedDays[0] === today || sortedDays[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const prevDay = new Date(sortedDays[i - 1]);
      const currDay = new Date(sortedDays[i]);
      const diffDays = Math.floor(
        (prevDay.getTime() - currDay.getTime()) / (24 * 60 * 60 * 1000),
      );

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 1;
  let tempStreak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prevDay = new Date(sortedDays[i - 1]);
    const currDay = new Date(sortedDays[i]);
    const diffDays = Math.floor(
      (prevDay.getTime() - currDay.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return { currentStreak, longestStreak };
}

async function getWeeklyData(userId: string) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const result: Array<{ day: string; count: number; date: string }> = [];

  // Get last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.memory.count({
      where: {
        userId,
        createdAt: {
          gte: date,
          lt: nextDate,
        },
        isArchived: false,
      },
    });

    const dayOfWeek = date.getDay();
    // Convert Sunday (0) to 6, Monday (1) to 0, etc.
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    result.push({
      day: days[dayIndex],
      count,
      date: date.toISOString().split("T")[0],
    });
  }

  return result;
}

async function generateAIInsights(
  userId: string,
  memories: any[],
): Promise<string[]> {
  const memoryTexts = memories
    .slice(0, 20)
    .map((m) => m.content.substring(0, 200))
    .join("\n---\n");

  const systemPrompt = `You are an insightful personal assistant analyzing someone's thoughts and memories.
Generate 3-5 brief, actionable insights about patterns or suggestions based on the memories.
Each insight should be:
- Personal and encouraging (use "you")
- Actionable or observational
- 1-2 sentences max
- Non-technical and friendly

Respond with a JSON array of strings, like: ["insight 1", "insight 2", "insight 3"]`;

  const userPrompt = `Based on these recent memories, provide helpful insights:

${memoryTexts}

Generate insightful observations.`;

  try {
    const response = await llmRouterService.executeTask(
      userId,
      "analysis",
      userPrompt,
      systemPrompt,
      { responseFormat: "json", maxTokens: 500 },
    );

    const parsed = parseJSONFromLLMResponse(response);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 5);
    }
    return [];
  } catch (error) {
    throw error;
  }
}

function generateFallbackInsights(memories: any[]): string[] {
  const insights: string[] = [];

  if (memories.length >= 10) {
    insights.push(
      "You've been actively capturing your thoughts this week. Great habit! 🎯",
    );
  }

  const highImportance = memories.filter(
    (m) => m.importanceScore >= 0.7,
  ).length;
  if (highImportance > 0) {
    insights.push(
      `You've noted ${highImportance} important moment${highImportance > 1 ? "s" : ""} recently. Consider reviewing them.`,
    );
  }

  const uniqueTags = new Set(memories.flatMap((m) => m.tags || []));
  if (uniqueTags.size > 3) {
    insights.push(
      "Your interests are diverse! You're thinking about multiple areas of your life.",
    );
  }

  if (insights.length === 0) {
    insights.push(
      "Keep capturing your thoughts - patterns will emerge over time! ✨",
    );
  }

  return insights;
}

export default router;
