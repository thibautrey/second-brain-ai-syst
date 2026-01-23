/**
 * Background Agents Service
 *
 * Autonomous agents that run in the background to provide insights,
 * reflections, and analysis of the user's memories.
 */

import prisma from "./prisma.js";
import { llmRouterService } from "./llm-router.js";
import { TimeScale, MemoryType } from "@prisma/client";

export interface AgentResult {
  agentId: string;
  userId: string;
  success: boolean;
  output?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ==================== Agent Prompts ====================

const DAILY_REFLECTION_PROMPT = `You are a personal reflection assistant for a "Second Brain" system.
Your task is to analyze the user's memories from today and generate a thoughtful daily reflection.

Guidelines:
1. Summarize the key events and thoughts from the day
2. Identify patterns or themes
3. Note any commitments or decisions made
4. Highlight moments of significance (achievements, challenges, insights)
5. Suggest one thing to focus on tomorrow
6. Be warm, personal, and encouraging
7. Use second person ("you") throughout

Respond with a JSON object:
{
  "title": "A brief title for today's reflection",
  "reflection": "The main reflection text (2-3 paragraphs in markdown)",
  "highlights": ["Array of 3-5 key highlights from the day"],
  "mood": "overall emotional tone: positive, neutral, challenging, mixed",
  "tomorrowFocus": "One suggested focus for tomorrow",
  "gratitude": "One thing to be grateful for from today"
}`;

const WEEKLY_INSIGHTS_PROMPT = `You are a personal insights analyst for a "Second Brain" system.
Your task is to analyze the user's week and provide meaningful insights about patterns, progress, and opportunities.

Guidelines:
1. Identify recurring themes across the week
2. Track progress on any mentioned goals or projects
3. Note behavioral patterns (positive and areas for improvement)
4. Highlight connections between different experiences
5. Suggest actionable insights for the coming week
6. Be constructive and forward-looking

Respond with a JSON object:
{
  "title": "A title summarizing the week",
  "weekInReview": "Overview of the week (2-3 paragraphs in markdown)",
  "patterns": ["Array of 3-5 patterns or themes observed"],
  "progress": ["Array of notable progress or achievements"],
  "challenges": ["Array of challenges faced"],
  "insights": ["Array of 3-5 actionable insights"],
  "weeklyScore": "1-10 rating for overall week productivity/fulfillment",
  "nextWeekFocus": ["Top 3 suggested focuses for next week"]
}`;

const GOAL_TRACKER_PROMPT = `You are a goal tracking assistant for a "Second Brain" system.
Analyze the user's memories to identify and track progress on their goals.

Guidelines:
1. Identify explicit and implicit goals mentioned
2. Track actions taken toward goals
3. Note blockers or challenges
4. Measure progress where possible
5. Suggest next steps

Respond with a JSON object:
{
  "goals": [
    {
      "name": "Goal name",
      "status": "not_started|in_progress|blocked|completed",
      "progress": "percentage or qualitative assessment",
      "recentActions": ["Actions taken toward this goal"],
      "nextSteps": ["Suggested next steps"]
    }
  ],
  "newGoalsDetected": ["Any new goals mentioned that should be tracked"],
  "overallProgress": "Summary of overall goal progress"
}`;

const HABIT_ANALYZER_PROMPT = `You are a habit analysis assistant for a "Second Brain" system.
Analyze the user's memories to identify habits and behavioral patterns.

Guidelines:
1. Identify recurring behaviors (positive and negative)
2. Note consistency of habits
3. Detect habit triggers and contexts
4. Track habit streaks where possible
5. Suggest habit improvements

Respond with a JSON object:
{
  "habits": [
    {
      "name": "Habit name",
      "type": "positive|negative|neutral",
      "frequency": "How often observed",
      "consistency": "1-10 score",
      "triggers": ["What triggers this habit"],
      "suggestion": "How to improve or maintain"
    }
  ],
  "habitScore": "Overall habit health score 1-10",
  "topRecommendation": "Most important habit recommendation"
}`;

export class BackgroundAgentService {
  /**
   * Run daily reflection agent
   */
  async runDailyReflection(userId: string): Promise<AgentResult> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Get today's memories
    const memories = await prisma.memory.findMany({
      where: {
        userId,
        createdAt: { gte: startOfDay },
        isArchived: false,
      },
      orderBy: { createdAt: "asc" },
    });

    if (memories.length < 3) {
      return {
        agentId: "daily-reflection",
        userId,
        success: false,
        metadata: {
          reason: "Not enough memories for reflection",
          count: memories.length,
        },
        createdAt: new Date(),
      };
    }

    const memoriesText = this.formatMemoriesForPrompt(memories);
    const userPrompt = `Here are my memories from today:\n\n${memoriesText}\n\nPlease generate my daily reflection.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        userPrompt,
        DAILY_REFLECTION_PROMPT,
        { responseFormat: "json" },
      );

      const result = JSON.parse(response);

      // Store reflection as a special memory
      await prisma.memory.create({
        data: {
          userId,
          content: `# ${result.title}\n\n${result.reflection}\n\n**Highlights:**\n${result.highlights.map((h: string) => `- ${h}`).join("\n")}\n\n**Tomorrow's Focus:** ${result.tomorrowFocus}\n\n**Gratitude:** ${result.gratitude}`,
          type: MemoryType.LONG_TERM,
          timeScale: TimeScale.DAILY,
          sourceType: "agent:daily-reflection",
          importanceScore: 0.8,
          tags: ["reflection", "daily", result.mood],
          metadata: {
            agentId: "daily-reflection",
            ...result,
          },
        },
      });

      return {
        agentId: "daily-reflection",
        userId,
        success: true,
        output: result.reflection,
        metadata: result,
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error("Daily reflection failed:", error);
      return {
        agentId: "daily-reflection",
        userId,
        success: false,
        metadata: { error: error.message },
        createdAt: new Date(),
      };
    }
  }

  /**
   * Run weekly insights agent
   */
  async runWeeklyInsights(userId: string): Promise<AgentResult> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Get this week's memories and summaries
    const [memories, summaries] = await Promise.all([
      prisma.memory.findMany({
        where: {
          userId,
          createdAt: { gte: oneWeekAgo },
          isArchived: false,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.summary.findMany({
        where: {
          userId,
          timeScale: TimeScale.DAILY,
          periodStart: { gte: oneWeekAgo },
        },
        orderBy: { periodStart: "asc" },
      }),
    ]);

    if (memories.length < 10) {
      return {
        agentId: "weekly-insights",
        userId,
        success: false,
        metadata: {
          reason: "Not enough memories for weekly analysis",
          count: memories.length,
        },
        createdAt: new Date(),
      };
    }

    // Combine memories and daily summaries for context
    let context = "## Daily Summaries\n\n";
    for (const summary of summaries) {
      context += `### ${summary.periodStart.toISOString().split("T")[0]}\n${summary.content}\n\n`;
    }

    context += "\n## Recent Memories\n\n";
    context += this.formatMemoriesForPrompt(memories.slice(-30)); // Last 30 memories

    const userPrompt = `Here's my week's data:\n\n${context}\n\nPlease analyze my week and provide insights.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        userPrompt,
        WEEKLY_INSIGHTS_PROMPT,
        { responseFormat: "json" },
      );

      const result = JSON.parse(response);

      // Store weekly insights as a summary
      await prisma.summary.create({
        data: {
          userId,
          content: `# ${result.title}\n\n${result.weekInReview}\n\n## Patterns\n${result.patterns.map((p: string) => `- ${p}`).join("\n")}\n\n## Insights\n${result.insights.map((i: string) => `- ${i}`).join("\n")}`,
          title: result.title,
          timeScale: TimeScale.WEEKLY,
          periodStart: oneWeekAgo,
          periodEnd: new Date(),
          sourceMemoryCount: memories.length,
          keyInsights: result.insights,
          topics: result.patterns,
          sentiment:
            result.weeklyScore >= 7
              ? "positive"
              : result.weeklyScore >= 4
                ? "neutral"
                : "negative",
          actionItems: result.nextWeekFocus,
          metadata: {
            agentId: "weekly-insights",
            weeklyScore: result.weeklyScore,
            progress: result.progress,
            challenges: result.challenges,
          },
        },
      });

      return {
        agentId: "weekly-insights",
        userId,
        success: true,
        output: result.weekInReview,
        metadata: result,
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error("Weekly insights failed:", error);
      return {
        agentId: "weekly-insights",
        userId,
        success: false,
        metadata: { error: error.message },
        createdAt: new Date(),
      };
    }
  }

  /**
   * Run goal tracker agent
   */
  async runGoalTracker(userId: string): Promise<AgentResult> {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const memories = await prisma.memory.findMany({
      where: {
        userId,
        createdAt: { gte: oneMonthAgo },
        isArchived: false,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (memories.length < 20) {
      return {
        agentId: "goal-tracker",
        userId,
        success: false,
        metadata: {
          reason: "Not enough memories for goal tracking",
          count: memories.length,
        },
        createdAt: new Date(),
      };
    }

    const memoriesText = this.formatMemoriesForPrompt(memories);
    const userPrompt = `Here are my recent memories:\n\n${memoriesText}\n\nPlease analyze my goals and progress.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        userPrompt,
        GOAL_TRACKER_PROMPT,
        { responseFormat: "json" },
      );

      const result = JSON.parse(response);

      return {
        agentId: "goal-tracker",
        userId,
        success: true,
        output: result.overallProgress,
        metadata: result,
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error("Goal tracker failed:", error);
      return {
        agentId: "goal-tracker",
        userId,
        success: false,
        metadata: { error: error.message },
        createdAt: new Date(),
      };
    }
  }

  /**
   * Run habit analyzer agent
   */
  async runHabitAnalyzer(userId: string): Promise<AgentResult> {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const memories = await prisma.memory.findMany({
      where: {
        userId,
        createdAt: { gte: twoWeeksAgo },
        isArchived: false,
      },
      orderBy: { createdAt: "asc" },
    });

    if (memories.length < 30) {
      return {
        agentId: "habit-analyzer",
        userId,
        success: false,
        metadata: {
          reason: "Not enough memories for habit analysis",
          count: memories.length,
        },
        createdAt: new Date(),
      };
    }

    const memoriesText = this.formatMemoriesForPrompt(memories);
    const userPrompt = `Here are my memories from the past two weeks:\n\n${memoriesText}\n\nPlease analyze my habits and behavioral patterns.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        userPrompt,
        HABIT_ANALYZER_PROMPT,
        { responseFormat: "json" },
      );

      const result = JSON.parse(response);

      return {
        agentId: "habit-analyzer",
        userId,
        success: true,
        output: result.topRecommendation,
        metadata: result,
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error("Habit analyzer failed:", error);
      return {
        agentId: "habit-analyzer",
        userId,
        success: false,
        metadata: { error: error.message },
        createdAt: new Date(),
      };
    }
  }

  /**
   * Run all agents for a user
   */
  async runAllAgents(userId: string): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    results.push(await this.runDailyReflection(userId));
    results.push(await this.runGoalTracker(userId));
    results.push(await this.runHabitAnalyzer(userId));

    return results;
  }

  /**
   * Format memories for LLM prompts
   */
  private formatMemoriesForPrompt(memories: any[]): string {
    return memories
      .map((m, i) => {
        const date = m.createdAt.toISOString().split("T")[0];
        const time = m.createdAt.toISOString().split("T")[1].substring(0, 5);
        const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
        const importance = m.importanceScore >= 0.7 ? " ⭐" : "";
        return `[${i + 1}] ${date} ${time}${tags}${importance}\n${m.content}`;
      })
      .join("\n\n---\n\n");
  }
}

// Export singleton instance
export const backgroundAgentService = new BackgroundAgentService();
