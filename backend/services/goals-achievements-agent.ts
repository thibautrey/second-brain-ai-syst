/**
 * Goals & Achievements Agent
 *
 * Autonomous agent that regularly analyzes user memories and interactions to:
 * - Detect new goals and achievements automatically
 * - Track progress on existing goals
 * - Unlock achievements based on patterns
 * - Maintain coherence and clean up outdated items
 * - Create and manage categories dynamically
 */

import { GoalStatus } from "@prisma/client";
import { achievementsService } from "./achievements.service.js";
import { goalsService } from "./goals.service.js";
import { llmRouterService } from "./llm-router.js";
import prisma from "./prisma.js";

// Configuration constants
const MIN_CONFIDENCE_THRESHOLD = 0.7; // Minimum confidence for auto-detected goals/achievements
const CLEANUP_PROBABILITY = 0.2; // Probability of running cleanup during analysis (20%)
const CLEANUP_INTERVAL_DAYS = 7; // Minimum days between cleanup runs

const GOALS_DETECTION_PROMPT = `You are a goals detection assistant for a Second Brain system.
Analyze the user's memories and interactions to identify goals they're pursuing.

Guidelines:
1. Detect both explicit goals (clearly stated) and implicit goals (inferred from actions/patterns)
2. Create appropriate categories for each goal (e.g., 'health', 'career', 'learning', 'relationships', 'finance', 'personal_growth')
3. Estimate progress based on observed actions
4. Identify related memories
5. Be conservative - only suggest goals with high confidence

Respond with a JSON object:
{
  "newGoals": [
    {
      "title": "Goal title",
      "description": "Detailed description",
      "category": "category_name",
      "confidence": 0.0-1.0,
      "estimatedProgress": 0-100,
      "relatedMemoryIds": ["memory_id1", "memory_id2"],
      "tags": ["tag1", "tag2"],
      "targetDate": "YYYY-MM-DD or null"
    }
  ],
  "categoryDefinitions": {
    "category_name": "Description of what this category represents"
  }
}`;

const ACHIEVEMENTS_DETECTION_PROMPT = `You are an achievements detection assistant for a Second Brain system.
Analyze the user's memories, goals, and patterns to identify achievements they've unlocked.

Guidelines:
1. Identify milestones, streaks, personal growth moments, and accomplishments
2. Create meaningful categories (e.g., 'consistency', 'milestone', 'personal_growth', 'skill_mastery', 'social')
3. Determine significance level (minor, normal, major, milestone)
4. Only suggest achievements with high confidence that the criteria are met
5. Make achievements feel rewarding and meaningful

Respond with a JSON object:
{
  "newAchievements": [
    {
      "title": "Achievement title",
      "description": "What the user accomplished",
      "category": "category_name",
      "icon": "emoji or icon",
      "significance": "minor|normal|major|milestone",
      "confidence": 0.0-1.0,
      "criteria": {
        "description": "What triggered this achievement",
        "details": "Specific details"
      },
      "relatedGoalIds": ["goal_id1"],
      "relatedMemoryIds": ["memory_id1"]
    }
  ],
  "categoryDefinitions": {
    "category_name": "Description of this achievement category"
  }
}`;

const PROGRESS_TRACKING_PROMPT = `You are a goal progress tracking assistant for a Second Brain system.
Analyze recent memories to update progress on existing goals.

Guidelines:
1. Review actions and mentions related to each goal
2. Update progress percentage based on objective evidence
3. Identify completed goals
4. Detect paused or abandoned goals
5. Suggest new milestones

Respond with a JSON object:
{
  "goalUpdates": [
    {
      "goalId": "goal_id",
      "newProgress": 0-100,
      "status": "ACTIVE|COMPLETED|PAUSED|ABANDONED",
      "reasoning": "Why this update",
      "newMilestones": [
        {"name": "Milestone description", "completed": true/false}
      ]
    }
  ]
}`;

const CLEANUP_PROMPT = `You are a cleanup assistant for a Second Brain's goals and achievements system.
Review all goals and achievements to maintain coherence and relevance.

Guidelines:
1. Identify duplicate or very similar goals/achievements
2. Find outdated or irrelevant goals that should be archived
3. Suggest category consolidation (too many similar categories)
4. Ensure consistency in naming and categorization
5. Be conservative - only suggest cleanup when clearly needed

Respond with a JSON object:
{
  "goalsToArchive": ["goal_id1", "goal_id2"],
  "achievementsToRemove": ["achievement_id1"],
  "categoryMappings": {
    "old_category_1": "new_consolidated_category",
    "old_category_2": "new_consolidated_category"
  },
  "reasoning": "Explanation of cleanup decisions"
}`;

export interface AgentResult {
  success: boolean;
  goalsDetected: number;
  achievementsDetected: number;
  goalsUpdated: number;
  achievementsUnlocked: number;
  cleanupActions: number;
  details?: Record<string, any>;
  error?: string;
}

export class GoalsAchievementsAgent {
  /**
   * Run full analysis (goals + achievements + cleanup)
   */
  async runFullAnalysis(
    userId: string,
    lookbackDays: number = 7,
  ): Promise<AgentResult> {
    console.log(`🎯 Running goals & achievements analysis for user ${userId}`);

    const result: AgentResult = {
      success: true,
      goalsDetected: 0,
      achievementsDetected: 0,
      goalsUpdated: 0,
      achievementsUnlocked: 0,
      cleanupActions: 0,
      details: {},
    };

    try {
      // Step 1: Detect new goals
      const goalsResult = await this.detectNewGoals(userId, lookbackDays);
      result.goalsDetected = goalsResult.detected;

      // Step 2: Track progress on existing goals
      const progressResult = await this.trackProgress(userId, lookbackDays);
      result.goalsUpdated = progressResult.updated;

      // Step 3: Detect and unlock achievements
      const achievementsResult = await this.detectAchievements(
        userId,
        lookbackDays,
      );
      result.achievementsDetected = achievementsResult.detected;
      result.achievementsUnlocked = achievementsResult.unlocked;

      // Step 4: Cleanup (run based on last cleanup date)
      const shouldCleanup = await this.shouldRunCleanup(userId);
      if (shouldCleanup) {
        const cleanupResult = await this.cleanupGoalsAndAchievements(userId);
        result.cleanupActions = cleanupResult.actions;

        // Store last cleanup date in user metadata
        await this.updateLastCleanupDate(userId);
      }

      result.details = {
        goals: goalsResult,
        progress: progressResult,
        achievements: achievementsResult,
      };

      console.log(
        `✓ Analysis complete: ${result.goalsDetected} goals, ${result.achievementsUnlocked} achievements unlocked`,
      );

      return result;
    } catch (error: any) {
      console.error("Goals & achievements analysis failed:", error);
      return {
        success: false,
        goalsDetected: 0,
        achievementsDetected: 0,
        goalsUpdated: 0,
        achievementsUnlocked: 0,
        cleanupActions: 0,
        error: error.message,
      };
    }
  }

  /**
   * Detect new goals from recent memories
   */
  async detectNewGoals(userId: string, lookbackDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    // Get recent memories
    const memories = await prisma.memory.findMany({
      where: {
        userId,
        createdAt: { gte: cutoffDate },
        isArchived: false,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (memories.length < 5) {
      return { detected: 0, details: "Not enough memories" };
    }

    // Get existing goals to avoid duplicates
    const existingGoals = await goalsService.getUserGoals(userId);

    const context = this.formatMemoriesForPrompt(memories);
    const existingGoalsText = existingGoals
      .map((g) => `- ${g.title} (${g.category})`)
      .join("\n");

    const userPrompt = `Recent memories:\n\n${context}\n\nExisting goals:\n${existingGoalsText}\n\nDetect new goals not already tracked.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        userPrompt,
        GOALS_DETECTION_PROMPT,
        { responseFormat: "json" },
      );

      // Extract JSON from markdown code blocks if present
      let contentToParse = response.trim();
      const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        contentToParse = jsonMatch[1].trim();
      }
      const result = JSON.parse(contentToParse);
      let detectedCount = 0;

      for (const goalData of result.newGoals || []) {
        if (goalData.confidence >= MIN_CONFIDENCE_THRESHOLD) {
          await goalsService.createGoal(userId, {
            title: goalData.title,
            description: goalData.description,
            category: goalData.category,
            targetDate: goalData.targetDate
              ? new Date(goalData.targetDate)
              : undefined,
            detectedFrom: "agent:pattern_detection",
            confidence: goalData.confidence,
            tags: goalData.tags || [],
            metadata: {
              relatedMemoryIds: goalData.relatedMemoryIds || [],
              detectedAt: new Date(),
            },
          });
          detectedCount++;
        }
      }

      return { detected: detectedCount, details: result };
    } catch (error: any) {
      console.error("Goal detection failed:", error);
      return { detected: 0, details: { error: error.message } };
    }
  }

  /**
   * Track progress on existing goals
   */
  async trackProgress(userId: string, lookbackDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const [goals, memories] = await Promise.all([
      goalsService.getUserGoals(userId, { status: GoalStatus.ACTIVE }),
      prisma.memory.findMany({
        where: {
          userId,
          createdAt: { gte: cutoffDate },
          isArchived: false,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    if (goals.length === 0 || memories.length < 3) {
      return { updated: 0 };
    }

    const goalsContext = goals
      .map(
        (g) =>
          `Goal ID: ${g.id}\nTitle: ${g.title}\nCategory: ${g.category}\nCurrent Progress: ${g.progress}%\nDescription: ${g.description || "N/A"}`,
      )
      .join("\n\n");

    const memoriesContext = this.formatMemoriesForPrompt(memories);
    const userPrompt = `Goals:\n\n${goalsContext}\n\nRecent activities:\n\n${memoriesContext}\n\nUpdate progress based on recent actions.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        userPrompt,
        PROGRESS_TRACKING_PROMPT,
        { responseFormat: "json" },
      );

      // Extract JSON from markdown code blocks if present
      let contentToParse = response.trim();
      const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        contentToParse = jsonMatch[1].trim();
      }
      const result = JSON.parse(contentToParse);
      let updatedCount = 0;

      for (const update of result.goalUpdates || []) {
        try {
          await goalsService.updateGoal(update.goalId, userId, {
            progress: update.newProgress,
            status: update.status,
          });

          // Add milestones if any
          for (const milestone of update.newMilestones || []) {
            await goalsService.addMilestone(update.goalId, userId, milestone);
          }

          updatedCount++;
        } catch (error) {
          console.warn(`Failed to update goal ${update.goalId}:`, error);
        }
      }

      return { updated: updatedCount };
    } catch (error: any) {
      console.error("Progress tracking failed:", error);
      return { updated: 0 };
    }
  }

  /**
   * Detect and unlock achievements
   */
  async detectAchievements(userId: string, lookbackDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const [memories, goals, existingAchievements] = await Promise.all([
      prisma.memory.findMany({
        where: { userId, createdAt: { gte: cutoffDate }, isArchived: false },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      goalsService.getUserGoals(userId),
      achievementsService.getUserAchievements(userId, { includeHidden: true }),
    ]);

    const memoriesContext = this.formatMemoriesForPrompt(memories);
    const goalsContext = goals
      .map((g) => `${g.title} (${g.status}, ${g.progress}%)`)
      .join("\n");
    const existingContext = existingAchievements
      .map((a) => `${a.title} (${a.category})`)
      .join("\n");

    const userPrompt = `Memories:\n\n${memoriesContext}\n\nGoals:\n${goalsContext}\n\nExisting achievements:\n${existingContext}\n\nDetect new achievements.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        userPrompt,
        ACHIEVEMENTS_DETECTION_PROMPT,
        { responseFormat: "json" },
      );

      // Extract JSON from markdown code blocks if present
      let contentToParse = response.trim();
      const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        contentToParse = jsonMatch[1].trim();
      }
      const result = JSON.parse(contentToParse);
      let detectedCount = 0;
      let unlockedCount = 0;

      for (const achData of result.newAchievements || []) {
        if (achData.confidence >= MIN_CONFIDENCE_THRESHOLD) {
          const achievement = await achievementsService.createAchievement(
            userId,
            {
              title: achData.title,
              description: achData.description,
              category: achData.category,
              icon: achData.icon,
              significance: achData.significance,
              detectedFrom: "agent:pattern_detection",
              confidence: achData.confidence,
              criteria: achData.criteria,
              isHidden: false, // Immediately visible since we detected it as unlocked
              metadata: {
                relatedGoalIds: achData.relatedGoalIds || [],
                relatedMemoryIds: achData.relatedMemoryIds || [],
              },
            },
          );

          // Immediately unlock it
          await achievementsService.unlockAchievement(achievement.id, userId);
          detectedCount++;
          unlockedCount++;
        }
      }

      return { detected: detectedCount, unlocked: unlockedCount };
    } catch (error: any) {
      console.error("Achievement detection failed:", error);
      return { detected: 0, unlocked: 0 };
    }
  }

  /**
   * Clean up goals and achievements for coherence
   */
  async cleanupGoalsAndAchievements(userId: string) {
    const [goals, achievements] = await Promise.all([
      goalsService.getUserGoals(userId, { includeArchived: false }),
      achievementsService.getUserAchievements(userId, { includeHidden: true }),
    ]);

    const goalsContext = goals
      .map(
        (g) =>
          `ID: ${g.id}, Title: ${g.title}, Category: ${g.category}, Status: ${g.status}, Created: ${g.createdAt}`,
      )
      .join("\n");

    const achievementsContext = achievements
      .map(
        (a) =>
          `ID: ${a.id}, Title: ${a.title}, Category: ${a.category}, Unlocked: ${a.isUnlocked}`,
      )
      .join("\n");

    const userPrompt = `Goals:\n${goalsContext}\n\nAchievements:\n${achievementsContext}\n\nSuggest cleanup for coherence.`;

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        userPrompt,
        CLEANUP_PROMPT,
        { responseFormat: "json" },
      );

      // Extract JSON from markdown code blocks if present
      let contentToParse = response.trim();
      const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        contentToParse = jsonMatch[1].trim();
      }
      const result = JSON.parse(contentToParse);
      let actions = 0;

      // Archive goals
      for (const goalId of result.goalsToArchive || []) {
        try {
          await goalsService.updateGoal(goalId, userId, {
            status: GoalStatus.ARCHIVED,
          });
          actions++;
        } catch (error) {
          console.warn(`Failed to archive goal ${goalId}`);
        }
      }

      // Remove achievements
      for (const achId of result.achievementsToRemove || []) {
        try {
          await achievementsService.deleteAchievement(achId, userId);
          actions++;
        } catch (error) {
          console.warn(`Failed to remove achievement ${achId}`);
        }
      }

      // Update categories (if needed)
      // This is a more complex operation, skip for now

      return { actions, details: result };
    } catch (error: any) {
      console.error("Cleanup failed:", error);
      return { actions: 0 };
    }
  }

  /**
   * Check if cleanup should run based on last cleanup date
   */
  private async shouldRunCleanup(userId: string): Promise<boolean> {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings) return true; // First time, run cleanup

      const lastCleanup = (settings.metadata as any)?.lastGoalsCleanup;
      if (!lastCleanup) return true; // No previous cleanup

      const daysSinceLastCleanup =
        (Date.now() - new Date(lastCleanup).getTime()) / (1000 * 60 * 60 * 24);

      return daysSinceLastCleanup >= CLEANUP_INTERVAL_DAYS;
    } catch (error) {
      console.error("Error checking cleanup schedule:", error);
      return false; // Don't cleanup if there's an error
    }
  }

  /**
   * Update last cleanup date in user settings
   */
  private async updateLastCleanupDate(userId: string): Promise<void> {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (settings) {
        const metadata = (settings.metadata as any) || {};
        metadata.lastGoalsCleanup = new Date().toISOString();

        await prisma.userSettings.update({
          where: { userId },
          data: { metadata },
        });
      }
    } catch (error) {
      console.error("Error updating cleanup date:", error);
    }
  }

  /**
   * Format memories for LLM prompts
   */
  private formatMemoriesForPrompt(memories: any[]): string {
    return memories
      .map((m, i) => {
        const date = m.createdAt.toISOString().split("T")[0];
        const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
        return `[${i + 1}] ${date}${tags}\n${m.content}`;
      })
      .join("\n\n---\n\n");
  }
}

export const goalsAchievementsAgent = new GoalsAchievementsAgent();
