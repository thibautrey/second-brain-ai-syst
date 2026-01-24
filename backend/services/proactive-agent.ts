/**
 * Proactive Agent Service
 *
 * An autonomous agent that analyzes user memories and messages to proactively
 * identify opportunities to help the user. Acts as a personal coach for both
 * physical and mental health, while being non-invasive.
 *
 * Key responsibilities:
 * - Analyze patterns in memories to detect opportunities for assistance
 * - Monitor health-related activities and suggest improvements
 * - Identify stress patterns and suggest mental health practices
 * - Detect goals that need attention or encouragement
 * - Suggest actions based on recurring themes
 * - Never be invasive - suggestions are gentle and optional
 */

import prisma from "./prisma.js";
import { llmRouterService } from "./llm-router.js";
import { notificationService } from "./notification.js";
import { TimeScale, MemoryType } from "@prisma/client";

// Configuration constants
const MAX_MEMORIES_FOR_ANALYSIS = 100;
const DEFAULT_ANALYSIS_TIMEFRAME_DAYS = 7;
const HEALTH_CHECK_TIMEFRAME_DAYS = 14;
const RECENT_SUGGESTIONS_DAYS = 3;

export interface ProactiveAgentResult {
  agentId: string;
  userId: string;
  success: boolean;
  suggestionsGenerated: number;
  output?: string;
  suggestions?: ProactiveSuggestion[];
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ProactiveSuggestion {
  category: "health" | "mental_wellbeing" | "productivity" | "goals" | "habits" | "relationships" | "learning";
  priority: "low" | "medium" | "high";
  title: string;
  message: string;
  reasoning: string;
  actionable: boolean;
  actionSteps?: string[];
  relatedMemoryIds?: string[];
}

// ==================== Agent Prompts ====================

const PROACTIVE_ANALYSIS_PROMPT = `You are a caring, proactive personal coach integrated into a "Second Brain" system.
Your role is to analyze the user's memories and identify opportunities to help them in their daily life.

Core Principles:
1. Be genuinely helpful, not pushy or invasive
2. Focus on actionable suggestions that truly matter
3. Prioritize physical and mental health
4. Look for patterns that indicate areas needing attention
5. Be encouraging and supportive in tone
6. Respect the user's autonomy - all suggestions are optional
7. Only suggest 1-3 high-quality items per analysis

Areas to Analyze:
- **Physical Health**: Exercise patterns, sleep mentions, nutrition, energy levels
- **Mental Wellbeing**: Stress indicators, emotional patterns, work-life balance, rest
- **Goals & Progress**: Mentioned goals, progress tracking, blockers
- **Habits**: Positive habits to reinforce, negative patterns to address
- **Relationships**: Social connections, important people, communication patterns
- **Learning**: Knowledge gaps, learning interests, skill development
- **Productivity**: Focus patterns, procrastination, time management

Response Format (JSON):
{
  "analysisDate": "ISO date string",
  "overallAssessment": "Brief 1-2 sentence summary of how the user is doing",
  "suggestions": [
    {
      "category": "health|mental_wellbeing|productivity|goals|habits|relationships|learning",
      "priority": "low|medium|high",
      "title": "Brief, friendly title for the suggestion",
      "message": "Warm, supportive message explaining the suggestion",
      "reasoning": "Why this suggestion matters based on observed patterns",
      "actionable": true/false,
      "actionSteps": ["Specific step 1", "Specific step 2"],
      "relatedMemoryIds": ["id1", "id2"]
    }
  ],
  "encouragement": "A brief encouraging message for the user"
}

Guidelines:
- Maximum 3 suggestions per analysis
- Only high-priority items should trigger notifications
- Be specific with action steps
- Reference specific memories when relevant
- Use warm, personal language (second person "you")
- Avoid medical advice - suggest consulting professionals when needed
- Don't repeat suggestions that were recently made`;

export class ProactiveAgentService {
  /**
   * Run proactive analysis for a user
   * Analyzes recent memories to identify opportunities to help
   */
  async runProactiveAnalysis(userId: string, timeframeDays: number = DEFAULT_ANALYSIS_TIMEFRAME_DAYS): Promise<ProactiveAgentResult> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframeDays);

    // Get recent memories
    const memories = await prisma.memory.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
        isArchived: false,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_MEMORIES_FOR_ANALYSIS,
    });

    // Get recent summaries for additional context
    const summaries = await prisma.summary.findMany({
      where: {
        userId,
        periodStart: { gte: startDate },
      },
      orderBy: { periodStart: "desc" },
      take: timeframeDays,
    });

    if (memories.length < 5) {
      return {
        agentId: "proactive-agent",
        userId,
        success: false,
        suggestionsGenerated: 0,
        metadata: {
          reason: "Not enough recent memories for proactive analysis",
          count: memories.length,
        },
        createdAt: new Date(),
      };
    }

    // Check for recent proactive suggestions to avoid repetition
    const recentSuggestions = await this.getRecentSuggestions(userId, RECENT_SUGGESTIONS_DAYS);

    // Format memories and summaries for analysis
    const context = this.buildAnalysisContext(memories, summaries, recentSuggestions);
    
    const userPrompt = `Analyze my recent activities and provide proactive suggestions to help me.

${context}

Based on this information, provide 1-3 high-quality, actionable suggestions that would genuinely help me.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        userPrompt,
        PROACTIVE_ANALYSIS_PROMPT,
        { responseFormat: "json" },
      );

      let result;
      try {
        result = JSON.parse(response);
      } catch (parseError) {
        console.error("Failed to parse LLM response as JSON:", response);
        throw new Error(`Invalid JSON response from LLM: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // Store suggestions as a special memory
      const suggestionMemory = await prisma.memory.create({
        data: {
          userId,
          content: this.formatSuggestionsAsMarkdown(result),
          type: MemoryType.LONG_TERM,
          timeScale: TimeScale.DAILY,
          sourceType: "agent:proactive",
          importanceScore: 0.75,
          tags: ["proactive", "suggestions", "coaching"],
          metadata: {
            agentId: "proactive-agent",
            analysisDate: result.analysisDate,
            suggestionsCount: result.suggestions.length,
            ...result,
          },
        },
      });

      // Send high-priority suggestions as notifications
      await this.sendSuggestionNotifications(userId, result.suggestions, suggestionMemory.id);

      return {
        agentId: "proactive-agent",
        userId,
        success: true,
        suggestionsGenerated: result.suggestions.length,
        output: result.overallAssessment,
        suggestions: result.suggestions,
        metadata: result,
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error("Proactive agent analysis failed:", error);
      return {
        agentId: "proactive-agent",
        userId,
        success: false,
        suggestionsGenerated: 0,
        metadata: { error: error.message },
        createdAt: new Date(),
      };
    }
  }

  /**
   * Run health check analysis
   * Specifically focuses on physical and mental health patterns
   */
  async runHealthCheck(userId: string): Promise<ProactiveAgentResult> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - HEALTH_CHECK_TIMEFRAME_DAYS);

    const memories = await prisma.memory.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
        isArchived: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (memories.length < 10) {
      return {
        agentId: "health-check",
        userId,
        success: false,
        suggestionsGenerated: 0,
        metadata: {
          reason: "Not enough memories for health analysis",
          count: memories.length,
        },
        createdAt: new Date(),
      };
    }

    const healthPrompt = `You are a health-focused personal coach. Analyze the user's memories for patterns related to:

1. Physical health: exercise, sleep, nutrition, energy levels, physical symptoms
2. Mental health: stress indicators, mood patterns, emotional well-being, work-life balance
3. Self-care: rest, hobbies, social connections, relaxation

Provide gentle, supportive suggestions focusing ONLY on health and well-being. Be specific but never invasive.

${this.formatMemoriesForPrompt(memories)}

Respond with suggestions prioritizing health and well-being.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        healthPrompt,
        PROACTIVE_ANALYSIS_PROMPT,
        { responseFormat: "json" },
      );

      let result;
      try {
        result = JSON.parse(response);
      } catch (parseError) {
        console.error("Failed to parse LLM response as JSON:", response);
        throw new Error(`Invalid JSON response from LLM: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // Filter to only health-related suggestions
      const healthSuggestions = result.suggestions.filter(
        (s: ProactiveSuggestion) => 
          s.category === "health" || s.category === "mental_wellbeing"
      );

      if (healthSuggestions.length > 0) {
        await prisma.memory.create({
          data: {
            userId,
            content: this.formatSuggestionsAsMarkdown({ ...result, suggestions: healthSuggestions }),
            type: MemoryType.LONG_TERM,
            timeScale: TimeScale.WEEKLY,
            sourceType: "agent:health-check",
            importanceScore: 0.8,
            tags: ["health", "wellbeing", "coaching"],
            metadata: {
              agentId: "health-check",
              suggestionsCount: healthSuggestions.length,
            },
          },
        });

        await this.sendSuggestionNotifications(userId, healthSuggestions, null, "health");
      }

      return {
        agentId: "health-check",
        userId,
        success: true,
        suggestionsGenerated: healthSuggestions.length,
        suggestions: healthSuggestions,
        metadata: result,
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error("Health check failed:", error);
      return {
        agentId: "health-check",
        userId,
        success: false,
        suggestionsGenerated: 0,
        metadata: { error: error.message },
        createdAt: new Date(),
      };
    }
  }

  /**
   * Get recent proactive suggestions to avoid repetition
   */
  private async getRecentSuggestions(userId: string, days: number): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const suggestions = await prisma.memory.findMany({
      where: {
        userId,
        sourceType: {
          in: ["agent:proactive", "agent:health-check"],
        },
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return suggestions.map(s => s.metadata);
  }

  /**
   * Build context for proactive analysis
   */
  private buildAnalysisContext(
    memories: any[],
    summaries: any[],
    recentSuggestions: any[]
  ): string {
    let context = "## Recent Activity Summary\n\n";

    if (summaries.length > 0) {
      context += "### Recent Summaries\n";
      summaries.forEach(summary => {
        const date = summary.periodStart.toISOString().split("T")[0];
        context += `**${date}**: ${summary.title || "Daily summary"}\n`;
      });
      context += "\n";
    }

    context += "### Recent Memories\n";
    context += this.formatMemoriesForPrompt(memories.slice(0, 50));

    if (recentSuggestions.length > 0) {
      context += "\n\n### Recent Suggestions (avoid repeating these)\n";
      recentSuggestions.forEach((sugg, i) => {
        if (sugg.suggestions) {
          context += `${i + 1}. ${sugg.suggestions.map((s: any) => s.title).join(", ")}\n`;
        }
      });
    }

    return context;
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
        return `[${i + 1}] ${date} ${time}${tags}\n${m.content}`;
      })
      .join("\n\n");
  }

  /**
   * Format suggestions as markdown for storage
   */
  private formatSuggestionsAsMarkdown(result: any): string {
    let content = `# Proactive Suggestions\n\n`;
    content += `${result.overallAssessment}\n\n`;

    if (result.suggestions && result.suggestions.length > 0) {
      content += `## Suggestions\n\n`;
      
      result.suggestions.forEach((s: ProactiveSuggestion, i: number) => {
        const emoji = s.priority === "high" ? "🔴" : s.priority === "medium" ? "🟡" : "🟢";
        content += `### ${emoji} ${s.title}\n\n`;
        content += `**Category**: ${s.category}\n\n`;
        content += `${s.message}\n\n`;
        
        if (s.actionSteps && s.actionSteps.length > 0) {
          content += `**Action Steps**:\n`;
          s.actionSteps.forEach(step => {
            content += `- ${step}\n`;
          });
          content += `\n`;
        }
        
        content += `*Why this matters*: ${s.reasoning}\n\n`;
        content += `---\n\n`;
      });
    }

    if (result.encouragement) {
      content += `## 💪 Encouragement\n\n${result.encouragement}\n`;
    }

    return content;
  }

  /**
   * Send high-priority suggestions as notifications
   */
  private async sendSuggestionNotifications(
    userId: string,
    suggestions: ProactiveSuggestion[],
    memoryId: string | null,
    sourceType: string = "proactive"
  ): Promise<void> {
    // Only send notifications for medium and high priority suggestions
    const notifiableSuggestions = suggestions.filter(
      s => s.priority === "high" || s.priority === "medium"
    );

    for (const suggestion of notifiableSuggestions) {
      const notifType = suggestion.priority === "high" ? "REMINDER" : "INFO";
      
      await notificationService.createNotification({
        userId,
        title: `💡 ${suggestion.title}`,
        message: suggestion.message,
        type: notifType,
        channels: ["IN_APP"],
        sourceType: `agent:${sourceType}`,
        sourceId: memoryId || undefined,
        metadata: {
          category: suggestion.category,
          priority: suggestion.priority,
          actionSteps: suggestion.actionSteps,
        },
      });
    }
  }
}

// Export singleton instance
export const proactiveAgentService = new ProactiveAgentService();
