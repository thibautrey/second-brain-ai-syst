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
 *
 * IMPORTANT: This agent stores its learnings in the AI Instructions system,
 * NOT in user memories. User memories are for souvenirs (user experiences),
 * while AI instructions are for the AI's internal knowledge and patterns.
 *
 * Enhanced Features (v2):
 * - Intelligent prioritization of urgent tasks with deadlines
 * - LLM-based hypothesis validation to avoid false assumptions
 * - Contradiction detection to ensure coherent suggestions
 * - Contextual timing for optimal delivery of suggestions
 * - Pertinence scoring to filter low-quality suggestions
 */

import { AIInstructionCategory, MemoryType, TimeScale } from "@prisma/client";

import { aiInstructionsService } from "./ai-instructions.service.js";
import { llmRouterService } from "./llm-router.js";
import { notificationService } from "./notification.js";
import prisma from "./prisma.js";
import { parseJSONFromLLMResponse } from "../utils/json-parser.js";

// Configuration constants
const MAX_MEMORIES_FOR_ANALYSIS = 100;
const DEFAULT_ANALYSIS_TIMEFRAME_DAYS = 7;
const HEALTH_CHECK_TIMEFRAME_DAYS = 14;
const RECENT_SUGGESTIONS_DAYS = 3;
const URGENT_TASK_HOURS = 48; // Tasks due within 48 hours are urgent
const MIN_PERTINENCE_SCORE = 40; // Minimum score (0-100) for a suggestion to be sent

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
  category:
    | "health"
    | "mental_wellbeing"
    | "productivity"
    | "goals"
    | "habits"
    | "relationships"
    | "learning";
  priority: "low" | "medium" | "high";
  title: string;
  message: string;
  reasoning: string;
  actionable: boolean;
  actionSteps?: string[];
  relatedMemoryIds?: string[];
  // Enhanced fields (v2)
  pertinenceScore?: number; // 0-100, assigned by LLM
  optimalDeliveryTime?: string; // ISO date string or "immediate"
  isContradictory?: boolean; // Flagged if contradicts other suggestions or user context
}

// Statistics about user's tools and tasks for hypothesis validation
interface UserContextStatistics {
  urgentTodosCount: number;
  overdueTodosCount: number;
  pendingTodosCount: number;
  activeScheduledTasksCount: number;
  scheduledTaskCategories: { category: string; count: number }[];
  recentNotificationsCount: number;
  daysSinceLastSuggestion: number;
}

// ==================== Agent Prompts ====================

const PROACTIVE_ANALYSIS_PROMPT = `You are a caring, proactive personal coach integrated into a "Second Brain" system.
Your role is to analyze the user's memories and context to identify opportunities to help them in their daily life.

Core Principles:
1. Be genuinely helpful, not pushy or invasive
2. Focus on actionable suggestions that truly matter
3. Prioritize physical and mental health
4. Look for patterns that indicate areas needing attention
5. Be encouraging and supportive in tone
6. Respect the user's autonomy - all suggestions are optional
7. Only suggest 1-3 high-quality items per analysis

CRITICAL PERTINENCE RULES:
1. **URGENT TASKS FIRST**: If the user has tasks with deadlines within 48 hours, they MUST be mentioned with highest priority
2. **QUANTIFICATION**: Never say "several", "many", or "a lot of" without checking actual numbers provided in statistics
3. **ACTIONABLE**: Each suggestion must have a CONCRETE and IMMEDIATE action the user can take
4. **TIMING AWARENESS**: Consider whether a suggestion should be delivered now or scheduled for later
5. **VALIDATION**: Before suggesting to "consolidate", "organize", or "clean up", verify the statistics justify this action (typically need 5+ items)

ANTI-PATTERNS TO AVOID:
- Do NOT suggest disconnecting from notifications while sending a notification
- Do NOT suggest organizing tools/systems if the user has fewer than 5 active items
- Do NOT make vague suggestions like "consider taking a break" without specific timing
- Do NOT assume problems exist without evidence in the data
- Do NOT repeat topics that were recently suggested (check recent suggestions list)

PRIORITY SELECTION ORDER:
1. Urgent tasks with approaching deadlines (within 48h)
2. Overdue tasks that need immediate attention
3. Health or stress issues detected in memories
4. Goals that have been blocked for a long time
5. Positive habits to reinforce
6. General improvement suggestions (ONLY if nothing above applies)

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
      "reasoning": "Why this suggestion matters based on SPECIFIC observed patterns with evidence",
      "actionable": true/false,
      "actionSteps": ["Specific step 1", "Specific step 2"],
      "relatedMemoryIds": ["id1", "id2"],
      "pertinenceScore": 0-100,
      "optimalDeliveryTime": "immediate" or "ISO date string for future delivery"
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
- Don't repeat suggestions that were recently made
- Assign pertinenceScore based on: urgency (40%), relevance to current context (30%), actionability (30%)
- Set optimalDeliveryTime to "immediate" for urgent items, or a specific future time for event-related suggestions`;

// Prompt for validating suggestions (contradiction detection and pertinence scoring)
const SUGGESTION_VALIDATION_PROMPT = `You are a quality assurance system for a personal coaching AI.
Your job is to validate suggestions before they are sent to the user.

For each suggestion, you must:
1. Check for CONTRADICTIONS with:
   - Other suggestions in the same batch (e.g., "take a break" + "work harder")
   - The user's current context (e.g., suggesting to ignore notifications while sending one)
   - The user's stated preferences or recent activities
   
2. Validate the PERTINENCE SCORE (0-100) based on:
   - Urgency: Does this need immediate attention? (40% weight)
   - Relevance: Is this based on solid evidence from memories? (30% weight)
   - Actionability: Can the user do something concrete right now? (30% weight)

3. Determine OPTIMAL DELIVERY TIME:
   - "immediate": For urgent tasks, health concerns, or time-sensitive items
   - Future ISO date: For suggestions related to upcoming events (deliver 1 day before)
   - Consider the user's timezone and typical active hours

Response Format (JSON):
{
  "validatedSuggestions": [
    {
      "originalIndex": 0,
      "isValid": true/false,
      "isContradictory": true/false,
      "contradictionReason": "Explanation if contradictory",
      "adjustedPertinenceScore": 0-100,
      "scoreJustification": "Why this score",
      "optimalDeliveryTime": "immediate" or "ISO date string",
      "deliveryTimeReason": "Why this timing"
    }
  ],
  "overallQuality": "good|needs_improvement|poor",
  "qualityNotes": "Any overall observations about the suggestions batch"
}`;

// Prompt for extracting context statistics from memories
const CONTEXT_STATISTICS_PROMPT = `Analyze the provided data and extract statistics about the user's current situation.
This will be used to validate suggestions and avoid false assumptions.

Return a JSON object with these counts and categories:
{
  "scheduledTaskCategories": [
    {"category": "description of task type", "count": number}
  ],
  "detectedUpcomingEvents": [
    {"event": "description", "approximateDate": "ISO date or relative like 'this weekend'"}
  ],
  "stressIndicators": number (0-10 scale based on recent memories),
  "productivityLevel": number (0-10 scale),
  "healthMentions": number (count of health-related topics in memories)
}`;


export class ProactiveAgentService {
  /**
   * Run proactive analysis for a user
   * Analyzes recent memories to identify opportunities to help
   * Enhanced with: urgent task prioritization, hypothesis validation,
   * contradiction detection, contextual timing, and pertinence scoring
   */
  async runProactiveAnalysis(
    userId: string,
    timeframeDays: number = DEFAULT_ANALYSIS_TIMEFRAME_DAYS,
  ): Promise<ProactiveAgentResult> {
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
    const recentSuggestions = await this.getRecentSuggestions(
      userId,
      RECENT_SUGGESTIONS_DAYS,
    );

    // NEW: Get urgent tasks and context statistics for hypothesis validation
    const urgentTasks = await this.getUrgentTasks(userId);
    const contextStats = await this.getUserContextStatistics(userId);

    // Format memories and summaries for analysis with enhanced context
    const context = this.buildAnalysisContext(
      memories,
      summaries,
      recentSuggestions,
      urgentTasks,
      contextStats,
    );

    const userPrompt = `Analyze my recent activities and provide proactive suggestions to help me.

${context}

Based on this information, provide 1-3 high-quality, actionable suggestions that would genuinely help me.
Remember to check the statistics before making assumptions about quantities.
Prioritize urgent tasks with deadlines if any exist.`;

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
        result = parseJSONFromLLMResponse(response);
      } catch (parseError) {
        console.error("Failed to parse LLM response as JSON:", response);
        throw new Error(
          `Invalid JSON response from LLM: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }

      // NEW: Validate suggestions for contradictions and pertinence
      const validatedSuggestions = await this.validateAndScoreSuggestions(
        userId,
        result.suggestions,
        memories,
        contextStats,
      );

      // Filter out invalid suggestions and those below minimum pertinence
      const filteredSuggestions = validatedSuggestions.filter(
        (s) => !s.isContradictory && (s.pertinenceScore ?? 50) >= MIN_PERTINENCE_SCORE
      );

      // Update result with validated suggestions
      result.suggestions = filteredSuggestions;

      // Store patterns as AI Instructions (NOT as user memories)
      // This allows the AI to learn user patterns without polluting souvenirs
      await this.storeAsAIInstructions(userId, result);

      // Send high-priority suggestions as notifications (respecting optimal delivery time)
      await this.sendSuggestionNotifications(userId, result.suggestions, null);

      return {
        agentId: "proactive-agent",
        userId,
        success: true,
        suggestionsGenerated: result.suggestions.length,
        output: result.overallAssessment,
        suggestions: result.suggestions,
        metadata: {
          ...result,
          validationApplied: true,
          originalCount: validatedSuggestions.length,
          filteredCount: filteredSuggestions.length,
          contextStats,
        },
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
        result = parseJSONFromLLMResponse(response);
      } catch (parseError) {
        console.error("Failed to parse LLM response as JSON:", response);
        throw new Error(
          `Invalid JSON response from LLM: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }

      // Filter to only health-related suggestions
      const healthSuggestions = result.suggestions.filter(
        (s: ProactiveSuggestion) =>
          s.category === "health" || s.category === "mental_wellbeing",
      );

      if (healthSuggestions.length > 0) {
        // Store health insights as AI Instructions (NOT as user memories)
        await this.storeHealthInsightsAsAIInstructions(
          userId,
          healthSuggestions,
        );

        await this.sendSuggestionNotifications(
          userId,
          healthSuggestions,
          null,
          "health",
        );
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
   * Now checks AI Instructions instead of memories
   */
  private async getRecentSuggestions(
    userId: string,
    days: number,
  ): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Check AI Instructions for recent suggestions
    const instructions = await prisma.aIInstruction.findMany({
      where: {
        userId,
        sourceAgent: {
          in: ["proactive-agent", "health-check"],
        },
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return instructions.map((i) => i.metadata);
  }

  /**
   * Store proactive suggestions as AI Instructions
   */
  private async storeAsAIInstructions(
    userId: string,
    result: any,
  ): Promise<void> {
    if (!result.suggestions || result.suggestions.length === 0) return;

    for (const suggestion of result.suggestions) {
      // Map suggestion category to AI instruction category
      const category = this.mapSuggestionToInstructionCategory(
        suggestion.category,
      );

      // Check for existing similar instruction
      const keywords = suggestion.title
        .toLowerCase()
        .split(" ")
        .filter((w: string) => w.length > 3);
      const existing = await aiInstructionsService.findSimilarInstruction(
        userId,
        "proactive-agent",
        category,
        keywords,
      );

      if (!existing) {
        await aiInstructionsService.createInstruction(userId, {
          title: suggestion.title,
          content: `${suggestion.message}\n\nReasoning: ${suggestion.reasoning}${suggestion.actionSteps ? `\n\nAction steps:\n${suggestion.actionSteps.map((s: string) => `- ${s}`).join("\n")}` : ""}`,
          category,
          sourceAgent: "proactive-agent",
          priority:
            suggestion.priority === "high"
              ? 8
              : suggestion.priority === "medium"
                ? 5
                : 2,
          confidence: 0.7,
          relatedMemoryIds: suggestion.relatedMemoryIds || [],
          metadata: {
            suggestionCategory: suggestion.category,
            priority: suggestion.priority,
            actionable: suggestion.actionable,
          },
        });
      }
    }
  }

  /**
   * Store health insights as AI Instructions
   */
  private async storeHealthInsightsAsAIInstructions(
    userId: string,
    healthSuggestions: ProactiveSuggestion[],
  ): Promise<void> {
    for (const suggestion of healthSuggestions) {
      const category =
        suggestion.category === "health"
          ? AIInstructionCategory.HEALTH_INSIGHT
          : AIInstructionCategory.USER_PATTERN;

      const keywords = suggestion.title
        .toLowerCase()
        .split(" ")
        .filter((w: string) => w.length > 3);
      const existing = await aiInstructionsService.findSimilarInstruction(
        userId,
        "health-check",
        category,
        keywords,
      );

      if (!existing) {
        await aiInstructionsService.createInstruction(userId, {
          title: suggestion.title,
          content: `${suggestion.message}\n\nReasoning: ${suggestion.reasoning}`,
          category,
          sourceAgent: "health-check",
          priority: suggestion.priority === "high" ? 8 : 5,
          confidence: 0.75,
          metadata: {
            healthCategory: suggestion.category,
            priority: suggestion.priority,
          },
        });
      }
    }
  }

  /**
   * Map suggestion category to AI instruction category
   */
  private mapSuggestionToInstructionCategory(
    suggestionCategory: string,
  ): AIInstructionCategory {
    switch (suggestionCategory) {
      case "health":
        return AIInstructionCategory.HEALTH_INSIGHT;
      case "mental_wellbeing":
        return AIInstructionCategory.HEALTH_INSIGHT;
      case "goals":
        return AIInstructionCategory.GOAL_TRACKING;
      case "habits":
        return AIInstructionCategory.USER_PATTERN;
      case "productivity":
        return AIInstructionCategory.TASK_OPTIMIZATION;
      case "relationships":
        return AIInstructionCategory.USER_PATTERN;
      case "learning":
        return AIInstructionCategory.USER_PREFERENCE;
      default:
        return AIInstructionCategory.OTHER;
    }
  }

  /**
   * Build context for proactive analysis
   * Enhanced with urgent tasks and context statistics
   */
  private buildAnalysisContext(
    memories: any[],
    summaries: any[],
    recentSuggestions: any[],
    urgentTasks?: any[],
    contextStats?: UserContextStatistics,
  ): string {
    let context = "## Recent Activity Summary\n\n";

    // NEW: Add urgent tasks section at the TOP for priority
    if (urgentTasks && urgentTasks.length > 0) {
      context += "### ⚠️ URGENT TASKS (highest priority - must be addressed first)\n";
      urgentTasks.forEach((task, i) => {
        const dueStr = task.dueDate
          ? `Due: ${task.dueDate.toISOString()}`
          : "No specific deadline";
        const status = task.status || "PENDING";
        context += `${i + 1}. [${task.priority}] ${task.title} - ${dueStr} (Status: ${status})\n`;
        if (task.description) {
          context += `   Description: ${task.description}\n`;
        }
      });
      context += "\nIMPORTANT: These tasks have approaching deadlines and should be prioritized in suggestions.\n\n";
    }

    // NEW: Add context statistics for hypothesis validation
    if (contextStats) {
      context += "### 📊 Current Statistics (use these to validate assumptions)\n";
      context += `- Urgent todos (due within 48h): ${contextStats.urgentTodosCount}\n`;
      context += `- Overdue todos: ${contextStats.overdueTodosCount}\n`;
      context += `- Total pending todos: ${contextStats.pendingTodosCount}\n`;
      context += `- Active scheduled tasks/automations: ${contextStats.activeScheduledTasksCount}\n`;
      if (contextStats.scheduledTaskCategories.length > 0) {
        context += `- Scheduled task categories: ${contextStats.scheduledTaskCategories.map(c => `${c.category} (${c.count})`).join(", ")}\n`;
      }
      context += `- Recent notifications sent: ${contextStats.recentNotificationsCount}\n`;
      context += `- Days since last proactive suggestion: ${contextStats.daysSinceLastSuggestion}\n`;
      context += "\nNote: Only suggest 'organizing' or 'consolidating' if there are 5+ items in a category.\n\n";
    }

    if (summaries.length > 0) {
      context += "### Recent Summaries\n";
      summaries.forEach((summary) => {
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
        if (sugg && sugg.suggestions) {
          context += `${i + 1}. ${sugg.suggestions.map((s: any) => s.title).join(", ")}\n`;
        } else if (sugg && sugg.title) {
          context += `${i + 1}. ${sugg.title}\n`;
        }
      });
    }

    return context;
  }

  /**
   * Get urgent tasks (todos with deadlines within URGENT_TASK_HOURS or overdue)
   * These will be prioritized in the analysis
   */
  private async getUrgentTasks(userId: string): Promise<any[]> {
    const urgentDeadline = new Date();
    urgentDeadline.setHours(urgentDeadline.getHours() + URGENT_TASK_HOURS);

    const urgentTasks = await prisma.todo.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        OR: [
          // Tasks due within URGENT_TASK_HOURS
          {
            dueDate: {
              lte: urgentDeadline,
              gte: new Date(),
            },
          },
          // Overdue tasks
          {
            dueDate: {
              lt: new Date(),
            },
          },
          // High priority tasks without due date
          {
            priority: "URGENT",
          },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 10,
    });

    return urgentTasks;
  }

  /**
   * Get user context statistics for hypothesis validation
   * Provides quantitative data to avoid false assumptions
   */
  private async getUserContextStatistics(
    userId: string,
  ): Promise<UserContextStatistics> {
    const now = new Date();
    const urgentDeadline = new Date();
    urgentDeadline.setHours(urgentDeadline.getHours() + URGENT_TASK_HOURS);

    // Count todos by status
    const [urgentTodos, overdueTodos, pendingTodos] = await Promise.all([
      prisma.todo.count({
        where: {
          userId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { lte: urgentDeadline, gte: now },
        },
      }),
      prisma.todo.count({
        where: {
          userId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { lt: now },
        },
      }),
      prisma.todo.count({
        where: {
          userId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),
    ]);

    // Count active scheduled tasks and group by description patterns
    const scheduledTasks = await prisma.scheduledTask.findMany({
      where: {
        userId,
        isEnabled: true,
      },
      select: {
        name: true,
        description: true,
        actionType: true,
      },
    });

    // Group scheduled tasks by action type for categorization
    const categoryMap = new Map<string, number>();
    scheduledTasks.forEach((task) => {
      const category = task.actionType || "other";
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    const scheduledTaskCategories = Array.from(categoryMap.entries()).map(
      ([category, count]) => ({ category, count }),
    );

    // Count recent notifications
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const recentNotificationsCount = await prisma.notification.count({
      where: {
        userId,
        createdAt: { gte: threeDaysAgo },
        sourceType: { startsWith: "agent:" },
      },
    });

    // Find days since last proactive suggestion
    const lastSuggestion = await prisma.aIInstruction.findFirst({
      where: {
        userId,
        sourceAgent: { in: ["proactive-agent", "health-check"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const daysSinceLastSuggestion = lastSuggestion
      ? Math.floor(
          (now.getTime() - lastSuggestion.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 999;

    return {
      urgentTodosCount: urgentTodos,
      overdueTodosCount: overdueTodos,
      pendingTodosCount: pendingTodos,
      activeScheduledTasksCount: scheduledTasks.length,
      scheduledTaskCategories,
      recentNotificationsCount,
      daysSinceLastSuggestion,
    };
  }

  /**
   * Validate and score suggestions using LLM
   * Checks for contradictions, validates pertinence, and determines optimal timing
   */
  private async validateAndScoreSuggestions(
    userId: string,
    suggestions: ProactiveSuggestion[],
    memories: any[],
    contextStats: UserContextStatistics,
  ): Promise<ProactiveSuggestion[]> {
    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    const validationContext = `
## Suggestions to Validate
${suggestions.map((s, i) => `
### Suggestion ${i + 1}
- Title: ${s.title}
- Category: ${s.category}
- Priority: ${s.priority}
- Message: ${s.message}
- Reasoning: ${s.reasoning}
- Action Steps: ${s.actionSteps?.join(", ") || "None"}
`).join("\n")}

## User Context Statistics
- Urgent todos: ${contextStats.urgentTodosCount}
- Overdue todos: ${contextStats.overdueTodosCount}
- Pending todos: ${contextStats.pendingTodosCount}
- Active scheduled tasks: ${contextStats.activeScheduledTasksCount}
- Recent agent notifications: ${contextStats.recentNotificationsCount}
- Days since last suggestion: ${contextStats.daysSinceLastSuggestion}

## Recent Memory Excerpts (for context validation)
${memories.slice(0, 10).map((m, i) => `[${i + 1}] ${m.content.substring(0, 200)}...`).join("\n")}

Please validate each suggestion for contradictions, score its pertinence, and determine optimal delivery time.
`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        validationContext,
        SUGGESTION_VALIDATION_PROMPT,
        { responseFormat: "json" },
      );

      const validationResult = parseJSONFromLLMResponse(response);

      // Apply validation results to suggestions
      return suggestions.map((suggestion, index) => {
        const validation = validationResult.validatedSuggestions?.find(
          (v: any) => v.originalIndex === index,
        );

        if (validation) {
          return {
            ...suggestion,
            isContradictory: validation.isContradictory || false,
            pertinenceScore: validation.adjustedPertinenceScore ?? suggestion.pertinenceScore ?? 50,
            optimalDeliveryTime: validation.optimalDeliveryTime || "immediate",
          };
        }

        return suggestion;
      });
    } catch (error) {
      console.error("Failed to validate suggestions:", error);
      // Return original suggestions if validation fails
      return suggestions.map((s) => ({
        ...s,
        pertinenceScore: s.pertinenceScore ?? 50,
        optimalDeliveryTime: s.optimalDeliveryTime || "immediate",
      }));
    }
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
        const emoji =
          s.priority === "high" ? "🔴" : s.priority === "medium" ? "🟡" : "🟢";
        content += `### ${emoji} ${s.title}\n\n`;
        content += `**Category**: ${s.category}\n\n`;
        content += `${s.message}\n\n`;

        if (s.actionSteps && s.actionSteps.length > 0) {
          content += `**Action Steps**:\n`;
          s.actionSteps.forEach((step) => {
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
   * Enhanced with optimal delivery timing support
   */
  private async sendSuggestionNotifications(
    userId: string,
    suggestions: ProactiveSuggestion[],
    memoryId: string | null,
    sourceType: string = "proactive",
  ): Promise<void> {
    // Only send notifications for medium and high priority suggestions
    // Also filter by pertinence score if available
    const notifiableSuggestions = suggestions.filter(
      (s) =>
        (s.priority === "high" || s.priority === "medium") &&
        !s.isContradictory &&
        (s.pertinenceScore ?? 50) >= MIN_PERTINENCE_SCORE,
    );

    for (const suggestion of notifiableSuggestions) {
      const notifType = suggestion.priority === "high" ? "REMINDER" : "INFO";

      // Determine if notification should be scheduled for later
      const optimalTime = suggestion.optimalDeliveryTime;
      let scheduledFor: Date | undefined;

      if (optimalTime && optimalTime !== "immediate") {
        try {
          const parsedTime = new Date(optimalTime);
          // Only schedule if the time is in the future
          if (parsedTime > new Date()) {
            scheduledFor = parsedTime;
          }
        } catch {
          // Invalid date, send immediately
        }
      }

      await notificationService.createNotification({
        userId,
        title: `💡 ${suggestion.title}`,
        message: suggestion.message,
        type: notifType,
        channels: ["IN_APP"],
        sourceType: `agent:${sourceType}`,
        sourceId: memoryId || undefined,
        scheduledFor,
        metadata: {
          category: suggestion.category,
          priority: suggestion.priority,
          actionSteps: suggestion.actionSteps,
          pertinenceScore: suggestion.pertinenceScore,
          optimalDeliveryTime: suggestion.optimalDeliveryTime,
        },
      });
    }
  }
}

// Export singleton instance
export const proactiveAgentService = new ProactiveAgentService();
