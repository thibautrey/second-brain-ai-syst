/**
 * Data Coherence Agent
 *
 * Proactively monitors and maintains coherence of data stored in the system.
 * Runs regularly to:
 * - Identify tasks that should be recurring instead of one-time
 * - Check alignment between goals, todos, and scheduled tasks
 * - Detect missing user feedback on activities
 * - Clean up stale or inconsistent data
 * - Ask proactive questions to the user
 *
 * IMPORTANT: This agent stores its learnings in the AI Instructions system,
 * NOT in user memories. User memories are for souvenirs (user experiences),
 * while AI instructions are for the AI's internal knowledge.
 */

import prisma from "./prisma.js";
import { llmRouterService } from "./llm-router.js";
import { notificationService } from "./tools/notification.service.js";
import { todoService } from "./tools/todo.service.js";
import { aiInstructionsService } from "./ai-instructions.service.js";
import { parseJSONFromLLMResponse } from "../utils/json-parser.js";
import { TodoStatus, GoalStatus, AIInstructionCategory, TodoPriority } from "@prisma/client";

// Configuration constants
const COHERENCE_CHECK_LOOKBACK_DAYS = 14; // Look back 14 days for pattern analysis
const MIN_CONFIDENCE_FOR_SUGGESTION = 0.7;
const MIN_CONFIDENCE_FOR_ISSUE = 0.7; // Minimum confidence for considering an issue significant
const MAX_QUESTIONS_PER_RUN = 3; // Don't overwhelm the user
const MAX_MEMORIES_FOR_ANALYSIS = 30; // Limit memory context to avoid token limits
const MIN_HOURS_BETWEEN_STORAGE = 2; // Only store results if at least 2 hours have passed
const MEMORY_CONTENT_PREVIEW_LENGTH = 200; // Character limit for memory content in context

export interface CoherenceAgentResult {
  agentId: string;
  userId: string;
  success: boolean;
  issuesFound: number;
  suggestionsGenerated: number;
  questionsAsked: number;
  output?: string;
  issues?: CoherenceIssue[];
  suggestions?: CoherenceSuggestion[];
  questions?: ProactiveQuestion[];
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface CoherenceIssue {
  type: "task_should_be_recurring" | "goal_todo_mismatch" | "missing_feedback" | "stale_data" | "inconsistent_schedule";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  affectedItems: Array<{ type: string; id: string; title: string }>;
  suggestedAction?: string;
  confidence: number;
}

export interface CoherenceSuggestion {
  type: "create_recurring_task" | "update_goal" | "cleanup_todo" | "create_scheduled_task";
  priority: "low" | "medium" | "high";
  title: string;
  message: string;
  actionable: boolean;
  autoFixable: boolean;
  actionData?: any;
}

export interface ProactiveQuestion {
  category: "activity_completion" | "goal_progress" | "habit_check" | "data_clarification";
  priority: "low" | "medium" | "high";
  question: string;
  context: string;
  relatedItems: Array<{ type: string; id: string }>;
  suggestedAnswers?: string[];
}

// ==================== Agent Prompts ====================

const COHERENCE_ANALYSIS_PROMPT = `You are a data coherence analyst for a "Second Brain" system.
Your role is to analyze the user's goals, todos, and tasks to identify inconsistencies and opportunities for improvement.

Core Responsibilities:
1. Identify tasks that should be recurring instead of one-time tasks
2. Detect misalignment between stated goals and actual tasks
3. Find patterns that suggest recurring activities
4. Identify missing user feedback on scheduled activities
5. Detect stale or abandoned data

Analysis Guidelines:
- Be specific and actionable with suggestions
- Consider frequency patterns (e.g., "twice a week", "every Monday")
- Look for goals that mention regular activities but have one-time tasks
- Identify activities that have been mentioned multiple times without tracking
- Be conservative - only suggest changes with high confidence (>70%)
- Respect user autonomy - suggestions should be helpful, not pushy

Response Format (JSON):
{
  "analysisDate": "ISO date string",
  "overallCoherence": "Brief assessment of data coherence (1-2 sentences)",
  "issues": [
    {
      "type": "task_should_be_recurring|goal_todo_mismatch|missing_feedback|stale_data|inconsistent_schedule",
      "severity": "low|medium|high",
      "title": "Brief title of the issue",
      "description": "Detailed description of the issue",
      "affectedItems": [
        {"type": "goal|todo|memory|scheduled_task", "id": "item_id", "title": "item_title"}
      ],
      "suggestedAction": "What should be done to fix this",
      "confidence": 0.0-1.0
    }
  ],
  "suggestions": [
    {
      "type": "create_recurring_task|update_goal|cleanup_todo|create_scheduled_task",
      "priority": "low|medium|high",
      "title": "Brief suggestion title",
      "message": "Friendly message explaining the suggestion",
      "actionable": true/false,
      "autoFixable": true/false,
      "actionData": {
        "recurrenceRule": "FREQ=WEEKLY;BYDAY=MO,WE",
        "taskTitle": "Sport session 10-20 minutes",
        "goalId": "related_goal_id"
      }
    }
  ]
}`;

const PROACTIVE_QUESTIONS_PROMPT = `You are a proactive assistant for a "Second Brain" system.
Your role is to generate thoughtful questions to ask the user about their activities, goals, and habits.

Question Guidelines:
1. Ask about activities that were scheduled or planned but not confirmed
2. Check in on goal progress when there's no recent update
3. Verify habit consistency when patterns are unclear
4. Clarify ambiguous data or intentions
5. Be warm and supportive, never demanding or judgmental
6. Limit to 1-3 most important questions per analysis
7. Make questions specific and contextual

Response Format (JSON):
{
  "questions": [
    {
      "category": "activity_completion|goal_progress|habit_check|data_clarification",
      "priority": "low|medium|high",
      "question": "The question to ask (warm, specific, non-judgmental)",
      "context": "Why we're asking this question",
      "relatedItems": [
        {"type": "goal|todo|memory", "id": "item_id"}
      ],
      "suggestedAnswers": ["Yes, I did it", "No, not yet", "I'll do it later"]
    }
  ]
}`;

export class DataCoherenceAgentService {
  /**
   * Run full coherence analysis for a user
   */
  async runCoherenceCheck(userId: string): Promise<CoherenceAgentResult> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - COHERENCE_CHECK_LOOKBACK_DAYS);

    try {
      // Gather all relevant data
      const [goals, todos, memories, scheduledTasks] = await Promise.all([
        prisma.goal.findMany({
          where: {
            userId,
            status: { in: [GoalStatus.ACTIVE, GoalStatus.PAUSED] },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.todo.findMany({
          where: {
            userId,
            status: { in: [TodoStatus.PENDING, TodoStatus.IN_PROGRESS] },
            createdAt: { gte: startDate },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.memory.findMany({
          where: {
            userId,
            createdAt: { gte: startDate },
            isArchived: false,
          },
          orderBy: { createdAt: "desc" },
          take: MAX_MEMORIES_FOR_ANALYSIS,
        }),
        prisma.scheduledTask.findMany({
          where: {
            userId,
            isEnabled: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Build context for analysis
      const context = this.buildCoherenceContext(goals, todos, memories, scheduledTasks);

      // Analyze coherence
      const coherenceResult = await this.analyzeCoherence(userId, context);

      // Generate proactive questions
      const questionsResult = await this.generateProactiveQuestions(userId, context, coherenceResult);

      // Store results and send notifications
      await this.processResults(userId, coherenceResult, questionsResult);

      return {
        agentId: "data-coherence",
        userId,
        success: true,
        issuesFound: coherenceResult.issues?.length || 0,
        suggestionsGenerated: coherenceResult.suggestions?.length || 0,
        questionsAsked: questionsResult.questions?.length || 0,
        output: coherenceResult.overallCoherence,
        issues: coherenceResult.issues,
        suggestions: coherenceResult.suggestions,
        questions: questionsResult.questions,
        metadata: {
          goalsAnalyzed: goals.length,
          todosAnalyzed: todos.length,
          memoriesAnalyzed: memories.length,
          scheduledTasksAnalyzed: scheduledTasks.length,
        },
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error("Data coherence check failed:", error);
      return {
        agentId: "data-coherence",
        userId,
        success: false,
        issuesFound: 0,
        suggestionsGenerated: 0,
        questionsAsked: 0,
        metadata: { error: error.message },
        createdAt: new Date(),
      };
    }
  }

  /**
   * Build context for coherence analysis
   */
  private buildCoherenceContext(
    goals: any[],
    todos: any[],
    memories: any[],
    scheduledTasks: any[]
  ): string {
    let context = "# User Data for Coherence Analysis\n\n";

    // Goals
    context += "## Active Goals\n\n";
    if (goals.length > 0) {
      goals.forEach((goal, i) => {
        context += `### Goal ${i + 1}: ${goal.title}\n`;
        context += `- **Category**: ${goal.category}\n`;
        context += `- **Status**: ${goal.status}\n`;
        context += `- **Progress**: ${goal.progress}%\n`;
        if (goal.description) {
          context += `- **Description**: ${goal.description}\n`;
        }
        if (goal.targetDate) {
          context += `- **Target Date**: ${goal.targetDate.toISOString().split('T')[0]}\n`;
        }
        context += `- **ID**: ${goal.id}\n\n`;
      });
    } else {
      context += "No active goals found.\n\n";
    }

    // Todos
    context += "## Active Todos\n\n";
    if (todos.length > 0) {
      todos.forEach((todo, i) => {
        context += `### Todo ${i + 1}: ${todo.title}\n`;
        context += `- **Status**: ${todo.status}\n`;
        context += `- **Priority**: ${todo.priority}\n`;
        context += `- **Is Recurring**: ${todo.isRecurring ? 'Yes' : 'No'}\n`;
        if (todo.isRecurring && todo.recurrenceRule) {
          context += `- **Recurrence Rule**: ${todo.recurrenceRule}\n`;
        }
        if (todo.dueDate) {
          context += `- **Due Date**: ${todo.dueDate.toISOString().split('T')[0]}\n`;
        }
        if (todo.description) {
          context += `- **Description**: ${todo.description}\n`;
        }
        context += `- **ID**: ${todo.id}\n\n`;
      });
    } else {
      context += "No active todos found.\n\n";
    }

    // Scheduled Tasks
    context += "## Scheduled Tasks\n\n";
    if (scheduledTasks.length > 0) {
      scheduledTasks.forEach((task, i) => {
        context += `### Task ${i + 1}: ${task.name}\n`;
        context += `- **Type**: ${task.scheduleType}\n`;
        if (task.cronExpression) {
          context += `- **Schedule**: ${task.cronExpression}\n`;
        }
        context += `- **Action**: ${task.actionType}\n`;
        context += `- **ID**: ${task.id}\n\n`;
      });
    } else {
      context += "No scheduled tasks found.\n\n";
    }

    // Recent Memories (sample for context)
    context += "## Recent Memories (Sample)\n\n";
    // Use all fetched memories for context
    memories.forEach((memory, i) => {
      const date = memory.createdAt.toISOString().split('T')[0];
      const preview = memory.content.substring(0, MEMORY_CONTENT_PREVIEW_LENGTH);
      const truncated = memory.content.length > MEMORY_CONTENT_PREVIEW_LENGTH ? '...' : '';
      context += `[${i + 1}] ${date}: ${preview}${truncated}\n`;
    });

    return context;
  }

  /**
   * Analyze data coherence using LLM
   */
  private async analyzeCoherence(userId: string, context: string): Promise<any> {
    const userPrompt = `Analyze my data for coherence issues and suggest improvements:\n\n${context}`;

    const response = await llmRouterService.executeTask(
      userId,
      "analysis",
      userPrompt,
      COHERENCE_ANALYSIS_PROMPT,
      { responseFormat: "json" }
    );

    try {
      return parseJSONFromLLMResponse(response);
    } catch (parseError) {
      console.error("Failed to parse coherence analysis response:", response);
      throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  }

  /**
   * Generate proactive questions for the user
   */
  private async generateProactiveQuestions(userId: string, context: string, coherenceResult: any): Promise<any> {
    // Build question context including coherence issues
    let questionContext = context;
    
    if (coherenceResult.issues && coherenceResult.issues.length > 0) {
      questionContext += "\n\n## Detected Issues\n\n";
      coherenceResult.issues.forEach((issue: CoherenceIssue, i: number) => {
        questionContext += `${i + 1}. **${issue.title}**: ${issue.description}\n`;
      });
    }

    const userPrompt = `Based on my data and detected issues, generate proactive questions to ask me:\n\n${questionContext}`;

    const response = await llmRouterService.executeTask(
      userId,
      "analysis",
      userPrompt,
      PROACTIVE_QUESTIONS_PROMPT,
      { responseFormat: "json" }
    );

    try {
      const result = parseJSONFromLLMResponse(response);
      // Limit questions to avoid overwhelming the user
      if (result.questions && result.questions.length > MAX_QUESTIONS_PER_RUN) {
        result.questions = result.questions.slice(0, MAX_QUESTIONS_PER_RUN);
      }
      return result;
    } catch (parseError) {
      console.error("Failed to parse questions response:", response);
      return { questions: [] };
    }
  }

  /**
   * Process results: create tasks, store AI instructions, and notify
   * 
   * IMPORTANT: We no longer store coherence results as user memories.
   * Instead:
   * - Actionable issues become tasks (todos)
   * - AI learnings go to AI Instructions
   * - Users are notified via notifications only
   */
  private async processResults(userId: string, coherenceResult: any, questionsResult: any): Promise<void> {
    // Filter high-confidence issues
    const significantIssues = (coherenceResult.issues || []).filter(
      (issue: CoherenceIssue) => issue.confidence >= MIN_CONFIDENCE_FOR_ISSUE
    );

    // Create tasks for actionable suggestions
    if (coherenceResult.suggestions && coherenceResult.suggestions.length > 0) {
      for (const suggestion of coherenceResult.suggestions) {
        if (suggestion.actionable && suggestion.autoFixable) {
          // Create a task for the AI to fix this issue
          await this.createTaskFromSuggestion(userId, suggestion);
        }
        
        // Send notifications for high/medium priority suggestions
        if (suggestion.priority === "high" || suggestion.priority === "medium") {
          await notificationService.sendNotification(userId, {
            title: `💡 ${suggestion.title}`,
            message: suggestion.message,
            type: suggestion.priority === "high" ? "REMINDER" : "INFO",
            channels: ["IN_APP"],
            sourceType: "agent:data-coherence",
            metadata: {
              suggestion,
              autoFixable: suggestion.autoFixable,
            },
          });
        }
      }
    }

    // Send proactive questions as notifications
    if (questionsResult.questions && questionsResult.questions.length > 0) {
      for (const question of questionsResult.questions) {
        if (question.priority === "high" || question.priority === "medium") {
          await notificationService.sendNotification(userId, {
            title: "❓ Quick Check-in",
            message: question.question,
            type: "INFO",
            channels: ["IN_APP"],
            sourceType: "agent:proactive-question",
            metadata: {
              question,
              category: question.category,
              relatedItems: question.relatedItems,
            },
          });
        }
      }
    }

    // Store learnings as AI Instructions (NOT as user memories)
    // This allows the AI to learn from coherence issues without polluting user's souvenirs
    if (significantIssues.length > 0) {
      for (const issue of significantIssues) {
        // Check for existing similar instruction to avoid duplicates
        const keywords = issue.title.toLowerCase().split(" ").filter((w: string) => w.length > 3);
        const existing = await aiInstructionsService.findSimilarInstruction(
          userId,
          "data-coherence",
          AIInstructionCategory.DATA_COHERENCE,
          keywords
        );

        if (!existing) {
          await aiInstructionsService.createInstruction(userId, {
            title: issue.title,
            content: `${issue.description}\n\nSuggested action: ${issue.suggestedAction || "Review and address"}`,
            category: AIInstructionCategory.DATA_COHERENCE,
            sourceAgent: "data-coherence",
            priority: issue.severity === "high" ? 8 : issue.severity === "medium" ? 5 : 2,
            confidence: issue.confidence,
            relatedGoalIds: issue.affectedItems
              ?.filter((i: any) => i.type === "goal")
              .map((i: any) => i.id) || [],
            relatedTodoIds: issue.affectedItems
              ?.filter((i: any) => i.type === "todo")
              .map((i: any) => i.id) || [],
            metadata: {
              issueType: issue.type,
              severity: issue.severity,
              affectedItems: issue.affectedItems,
            },
          });
        }
      }
    }
  }

  /**
   * Create a task from an actionable suggestion
   */
  private async createTaskFromSuggestion(userId: string, suggestion: CoherenceSuggestion): Promise<void> {
    try {
      const priority = suggestion.priority === "high" 
        ? TodoPriority.HIGH 
        : suggestion.priority === "medium" 
          ? TodoPriority.MEDIUM 
          : TodoPriority.LOW;

      // Create the task
      await todoService.createTodo(userId, {
        title: `[Auto] ${suggestion.title}`,
        description: suggestion.message,
        priority,
        category: "system-improvement",
        tags: ["auto-generated", "data-coherence", suggestion.type],
        metadata: {
          source: "data-coherence-agent",
          suggestionType: suggestion.type,
          actionData: suggestion.actionData,
          autoFixable: suggestion.autoFixable,
        },
      });

      console.log(`Created task for suggestion: ${suggestion.title}`);
    } catch (error) {
      console.error(`Failed to create task for suggestion: ${suggestion.title}`, error);
    }
  }

  /**
   * Format results as markdown (for notifications/logging only, not storage)
   */
  private formatResultsAsMarkdown(coherenceResult: any, questionsResult: any): string {
    let content = "# Data Coherence Check\n\n";
    content += `${coherenceResult.overallCoherence}\n\n`;

    if (coherenceResult.issues && coherenceResult.issues.length > 0) {
      content += "## Issues Detected\n\n";
      coherenceResult.issues.forEach((issue: CoherenceIssue, i: number) => {
        const emoji = issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "🟢";
        content += `### ${emoji} ${issue.title}\n\n`;
        content += `${issue.description}\n\n`;
        if (issue.suggestedAction) {
          content += `**Suggested Action**: ${issue.suggestedAction}\n\n`;
        }
      });
    }

    if (coherenceResult.suggestions && coherenceResult.suggestions.length > 0) {
      content += "## Suggestions\n\n";
      coherenceResult.suggestions.forEach((suggestion: CoherenceSuggestion, i: number) => {
        content += `### ${suggestion.title}\n\n`;
        content += `${suggestion.message}\n\n`;
      });
    }

    if (questionsResult.questions && questionsResult.questions.length > 0) {
      content += "## Questions for You\n\n";
      questionsResult.questions.forEach((question: ProactiveQuestion, i: number) => {
        content += `**Q${i + 1}**: ${question.question}\n\n`;
        content += `*Context*: ${question.context}\n\n`;
      });
    }

    return content;
  }
}

// Export singleton instance
export const dataCoherenceAgentService = new DataCoherenceAgentService();
