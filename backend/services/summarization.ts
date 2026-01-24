/**
 * Summarization Service
 *
 * Generates intelligent summaries of memories using LLM
 * Handles multiple time scales: daily, weekly, monthly, etc.
 */

import prisma from "./prisma.js";
import { Memory, Summary, TimeScale } from "@prisma/client";
import { llmRouterService, type LLMTaskType } from "./llm-router.js";
import { parseJSONFromLLMResponse } from "../utils/json-parser.js";

export interface SummarizationResult {
  content: string;
  title: string;
  keyInsights: string[];
  topics: string[];
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  actionItems: string[];
}

export interface TimeScaleConfig {
  timeScale: TimeScale;
  daysBack: number;
  minMemories: number;
  promptContext: string;
}

// Time scale configurations
const TIME_SCALE_CONFIGS: Record<TimeScale, TimeScaleConfig> = {
  DAILY: {
    timeScale: TimeScale.DAILY,
    daysBack: 1,
    minMemories: 1,
    promptContext: "the past day",
  },
  THREE_DAY: {
    timeScale: TimeScale.THREE_DAY,
    daysBack: 3,
    minMemories: 1,
    promptContext: "the past 3 days",
  },
  WEEKLY: {
    timeScale: TimeScale.WEEKLY,
    daysBack: 7,
    minMemories: 2,
    promptContext: "the past week",
  },
  BIWEEKLY: {
    timeScale: TimeScale.BIWEEKLY,
    daysBack: 14,
    minMemories: 3,
    promptContext: "the past two weeks",
  },
  MONTHLY: {
    timeScale: TimeScale.MONTHLY,
    daysBack: 30,
    minMemories: 5,
    promptContext: "the past month",
  },
  QUARTERLY: {
    timeScale: TimeScale.QUARTERLY,
    daysBack: 90,
    minMemories: 10,
    promptContext: "the past quarter (3 months)",
  },
  SIX_MONTH: {
    timeScale: TimeScale.SIX_MONTH,
    daysBack: 180,
    minMemories: 20,
    promptContext: "the past 6 months",
  },
  YEARLY: {
    timeScale: TimeScale.YEARLY,
    daysBack: 365,
    minMemories: 30,
    promptContext: "the past year",
  },
  MULTI_YEAR: {
    timeScale: TimeScale.MULTI_YEAR,
    daysBack: 730,
    minMemories: 40,
    promptContext: "multiple years",
  },
};

const SUMMARIZATION_SYSTEM_PROMPT = `You are a personal memory summarization assistant for a "Second Brain" system.
Your task is to create insightful, well-organized summaries of the user's memories, thoughts, and interactions.

Guidelines:
1. Extract key themes and patterns from the memories
2. Identify important decisions, commitments, and action items
3. Note emotional tone and sentiment shifts
4. Highlight connections between different memories
5. Be concise but comprehensive
6. Use natural, personal language (second person: "you")
7. Group related topics together
8. Prioritize actionable insights

You must respond with a valid JSON object containing:
{
  "title": "Brief descriptive title for this summary period",
  "content": "A well-structured summary in markdown format (2-4 paragraphs)",
  "keyInsights": ["Array of 3-5 key insights or patterns observed"],
  "topics": ["Array of main topics/themes covered"],
  "sentiment": "positive|negative|neutral|mixed",
  "actionItems": ["Array of pending tasks or follow-ups mentioned"]
}`;

export class SummarizationService {
  /**
   * Generate a summary for a specific time period
   */
  async generateSummary(
    userId: string,
    timeScale: TimeScale,
    endDate: Date = new Date(),
  ): Promise<Summary> {
    const config = TIME_SCALE_CONFIGS[timeScale];
    const startDate = new Date(
      endDate.getTime() - config.daysBack * 24 * 60 * 60 * 1000,
    );

    // Fetch memories for the period
    const memories = await prisma.memory.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        isArchived: false,
      },
      orderBy: { createdAt: "asc" },
    });

    if (memories.length < config.minMemories) {
      throw new Error(
        `Not enough memories for ${timeScale} summary. Found ${memories.length}, need at least ${config.minMemories}`,
      );
    }

    // Check if summary already exists for this period
    const existingSummary = await prisma.summary.findFirst({
      where: {
        userId,
        timeScale,
        periodStart: { gte: startDate },
        periodEnd: { lte: endDate },
      },
      orderBy: { version: "desc" },
    });

    // Generate summary using LLM
    const summaryResult = await this.callLLMForSummary(
      userId,
      memories,
      config.promptContext,
    );

    // Create or update summary
    if (existingSummary) {
      // Create new version
      return await prisma.summary.create({
        data: {
          userId,
          content: summaryResult.content,
          title: summaryResult.title,
          timeScale,
          periodStart: startDate,
          periodEnd: endDate,
          sourceMemoryCount: memories.length,
          sourceMemories: {
            connect: memories.map((m) => ({ id: m.id })),
          },
          keyInsights: summaryResult.keyInsights,
          topics: summaryResult.topics,
          sentiment: summaryResult.sentiment,
          actionItems: summaryResult.actionItems,
          version: existingSummary.version + 1,
          parentId: existingSummary.id,
        },
      });
    }

    // Create new summary
    return await prisma.summary.create({
      data: {
        userId,
        content: summaryResult.content,
        title: summaryResult.title,
        timeScale,
        periodStart: startDate,
        periodEnd: endDate,
        sourceMemoryCount: memories.length,
        sourceMemories: {
          connect: memories.map((m) => ({ id: m.id })),
        },
        keyInsights: summaryResult.keyInsights,
        topics: summaryResult.topics,
        sentiment: summaryResult.sentiment,
        actionItems: summaryResult.actionItems,
      },
    });
  }

  /**
   * Call LLM to generate summary content
   */
  private async callLLMForSummary(
    userId: string,
    memories: Memory[],
    periodContext: string,
  ): Promise<SummarizationResult> {
    // Prepare memories for context
    const memoriesText = memories
      .map((m, i) => {
        const date = m.createdAt.toISOString().split("T")[0];
        const time = m.createdAt.toISOString().split("T")[1].substring(0, 5);
        const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
        const importance = m.importanceScore >= 0.7 ? " ⭐" : "";
        return `[${i + 1}] ${date} ${time}${tags}${importance}\n${m.content}`;
      })
      .join("\n\n---\n\n");

    const userPrompt = `Please summarize the following ${memories.length} memories from ${periodContext}:

${memoriesText}

Generate a comprehensive summary that captures the essence of this period.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "summarization",
        userPrompt,
        SUMMARIZATION_SYSTEM_PROMPT,
        { responseFormat: "json" },
      );

      const result = parseJSONFromLLMResponse(response);

      return {
        content: result.content || this.generateFallbackContent(memories),
        title:
          result.title || `Summary: ${new Date().toISOString().split("T")[0]}`,
        keyInsights: result.keyInsights || [],
        topics: result.topics || this.extractTopicsFromMemories(memories),
        sentiment: result.sentiment || "neutral",
        actionItems: result.actionItems || [],
      };
    } catch (error) {
      console.error("LLM summarization failed, using fallback:", error);
      return this.generateFallbackSummary(memories);
    }
  }

  /**
   * Generate fallback summary without LLM
   */
  private generateFallbackSummary(memories: Memory[]): SummarizationResult {
    return {
      content: this.generateFallbackContent(memories),
      title: `Summary: ${memories.length} memories`,
      keyInsights: [`Captured ${memories.length} memories in this period`],
      topics: this.extractTopicsFromMemories(memories),
      sentiment: "neutral",
      actionItems: [],
    };
  }

  /**
   * Generate basic content without LLM
   */
  private generateFallbackContent(memories: Memory[]): string {
    const firstDate = memories[0].createdAt.toISOString().split("T")[0];
    const lastDate = memories[memories.length - 1].createdAt
      .toISOString()
      .split("T")[0];

    const topicsSet = new Set<string>();
    memories.forEach((m) => m.tags.forEach((t) => topicsSet.add(t)));

    const highImportance = memories.filter((m) => m.importanceScore >= 0.7);

    let content = `## Period: ${firstDate} to ${lastDate}\n\n`;
    content += `**Total memories:** ${memories.length}\n`;
    content += `**High importance:** ${highImportance.length}\n`;
    content += `**Topics:** ${Array.from(topicsSet).join(", ") || "None tagged"}\n\n`;

    if (highImportance.length > 0) {
      content += `### Key Moments\n\n`;
      highImportance.slice(0, 5).forEach((m) => {
        content += `- ${m.content.substring(0, 150)}...\n`;
      });
    }

    return content;
  }

  /**
   * Extract topics from memories
   */
  private extractTopicsFromMemories(memories: Memory[]): string[] {
    const tagCounts: Record<string, number> = {};
    memories.forEach((m) => {
      m.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
  }

  /**
   * Generate summaries for all applicable time scales
   */
  async generateAllDueSummaries(userId: string): Promise<Summary[]> {
    const summaries: Summary[] = [];
    const now = new Date();

    // Check which summaries are due
    const timeScaleChecks: { scale: TimeScale; checkInterval: number }[] = [
      { scale: TimeScale.DAILY, checkInterval: 1 },
      { scale: TimeScale.THREE_DAY, checkInterval: 3 },
      { scale: TimeScale.WEEKLY, checkInterval: 7 },
      { scale: TimeScale.BIWEEKLY, checkInterval: 14 },
      { scale: TimeScale.MONTHLY, checkInterval: 30 },
      { scale: TimeScale.QUARTERLY, checkInterval: 90 },
    ];

    for (const { scale, checkInterval } of timeScaleChecks) {
      try {
        // Check last summary of this type
        const lastSummary = await prisma.summary.findFirst({
          where: { userId, timeScale: scale },
          orderBy: { periodEnd: "desc" },
        });

        const shouldGenerate =
          !lastSummary ||
          now.getTime() - lastSummary.periodEnd.getTime() >=
            checkInterval * 24 * 60 * 60 * 1000;

        if (shouldGenerate) {
          const summary = await this.generateSummary(userId, scale, now);
          summaries.push(summary);
          console.log(`✓ Generated ${scale} summary for user ${userId}`);
        }
      } catch (error) {
        console.warn(`Could not generate ${scale} summary:`, error);
      }
    }

    return summaries;
  }

  /**
   * Aggregate lower-level summaries into higher-level ones
   */
  async aggregateSummaries(
    userId: string,
    sourceScale: TimeScale,
    targetScale: TimeScale,
  ): Promise<Summary | null> {
    const targetConfig = TIME_SCALE_CONFIGS[targetScale];
    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - targetConfig.daysBack * 24 * 60 * 60 * 1000,
    );

    // Get source summaries
    const sourceSummaries = await prisma.summary.findMany({
      where: {
        userId,
        timeScale: sourceScale,
        periodStart: { gte: startDate },
        periodEnd: { lte: endDate },
      },
      orderBy: { periodStart: "asc" },
    });

    if (sourceSummaries.length < 2) {
      return null;
    }

    // Combine summaries for aggregation
    const combinedContent = sourceSummaries
      .map(
        (s) => `### ${s.periodStart.toISOString().split("T")[0]}\n${s.content}`,
      )
      .join("\n\n");

    const userPrompt = `Aggregate the following ${sourceScale} summaries into a ${targetScale} summary:\n\n${combinedContent}`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "summarization",
        userPrompt,
        SUMMARIZATION_SYSTEM_PROMPT,
        { responseFormat: "json" },
      );

      const result = parseJSONFromLLMResponse(response);

      return await prisma.summary.create({
        data: {
          userId,
          content: result.content,
          title: result.title || `${targetScale} Summary`,
          timeScale: targetScale,
          periodStart: startDate,
          periodEnd: endDate,
          sourceMemoryCount: sourceSummaries.reduce(
            (acc, s) => acc + s.sourceMemoryCount,
            0,
          ),
          keyInsights: result.keyInsights || [],
          topics: result.topics || [],
          sentiment: result.sentiment || "neutral",
          actionItems: result.actionItems || [],
        },
      });
    } catch (error) {
      console.error("Failed to aggregate summaries:", error);
      return null;
    }
  }
}

// Export singleton instance
export const summarizationService = new SummarizationService();
