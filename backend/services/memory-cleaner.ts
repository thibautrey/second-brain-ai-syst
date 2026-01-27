/**
 * Memory Cleaner Agent Service
 *
 * Analyzes short-term memories and removes non-useful, redundant, or irrelevant information.
 * Runs every 5 minutes to maintain memory cleanliness and optimize storage.
 */

import { MemoryType } from "@prisma/client";
import { llmRouterService } from "./llm-router.js";
import { parseJSONFromLLMResponse } from "../utils/json-parser.js";
import prisma from "./prisma.js";

export interface CleanupResult {
  userId: string;
  success: boolean;
  error?: string;
  memoriesAnalyzed: number;
  memoriesArchived?: number;
  memoriesDeleted?: number;
  memoriesToRemove?: string[];
  memoriesToArchive?: string[];
  details?: {
    archivedIds: string[];
    deletedIds: string[];
    reasons: Record<string, string[]>; // Maps memory ID to cleanup reason
  };
  createdAt?: Date;
}

const MEMORY_CLEANUP_PROMPT = `You are a memory optimization assistant for a "Second Brain" system.
Your task is to analyze short-term memories and determine which ones should be removed or archived.

Guidelines for REMOVING memories:
1. Technical/debug information that's no longer relevant (logs, errors, stack traces)
2. Redundant information already captured elsewhere
3. Transient thoughts or incomplete fragments
4. Noise or irrelevant system information
5. Outdated context or temporary notes
6. Information older than 24 hours with low importance score
7. System/noise that doesn't provide user value

Guidelines for KEEPING memories:
1. Personal insights or reflections
2. Learning notes or knowledge
3. Decisions or commitments made
4. Important events or experiences
5. Actionable items or reminders
6. Unique observations or ideas
7. High importance score (>0.6)
8. Recent memories with potential relevance

For each memory, analyze its content and metadata:
- Consider the importance score (0.0-1.0)
- Consider the recency
- Consider the type and tags
- Make a binary decision: KEEP or REMOVE

Respond with a JSON object:
{
  "memoryDecisions": [
    {
      "id": "memory_id",
      "decision": "KEEP" | "REMOVE" | "ARCHIVE",
      "reason": "Brief explanation",
      "confidence": 0.0-1.0
    }
  ],
  "summary": "Overall analysis summary",
  "totalAnalyzed": number,
  "recommendedForRemoval": number,
  "recommendedForArchival": number
}`;

export class MemoryCleanerService {
  /**
   * Run memory cleanup process for a user
   * Analyzes recent short-term memories and removes non-useful ones
   */
  async runMemoryCleanup(userId: string): Promise<CleanupResult> {
    try {
      // Get short-term memories from the last 6 hours
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

      const shortTermMemories = await prisma.memory.findMany({
        where: {
          userId,
          type: MemoryType.SHORT_TERM,
          createdAt: { gte: sixHoursAgo },
          isArchived: false,
        },
        orderBy: { createdAt: "desc" },
        take: 100, // Limit to prevent overwhelming the LLM
      });

      // If no memories to analyze, return early
      if (shortTermMemories.length === 0) {
        return {
          userId,
          success: true,
          memoriesAnalyzed: 0,
          memoriesArchived: 0,
          memoriesDeleted: 0,
          createdAt: new Date(),
        };
      }

      // Format memories for analysis
      const memoriesText = this.formatMemoriesForAnalysis(shortTermMemories);

      const userPrompt = `Here are my short-term memories from the last 6 hours:\n\n${memoriesText}\n\nPlease analyze these memories and determine which ones should be removed or archived.`;

      // Call LLM to analyze and get cleanup recommendations
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        userPrompt,
        MEMORY_CLEANUP_PROMPT,
        { responseFormat: "json" },
      );

      let analysis;
      try {
        analysis = parseJSONFromLLMResponse(response);
      } catch (parseError) {
        console.error(
          "[MemoryCleaner] Failed to parse cleanup response:",
          parseError,
        );
        console.error(
          "[MemoryCleaner] Response content:",
          response.substring(0, 500),
        );
        // Return empty cleanup decisions to avoid crash
        return {
          userId,
          success: false,
          error: `Failed to parse LLM response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          memoriesAnalyzed: shortTermMemories.length,
          memoriesToRemove: [],
          memoriesToArchive: [],
        };
      }

      // Apply cleanup decisions
      const cleanup = await this.applyCleanupDecisions(
        userId,
        shortTermMemories,
        analysis.memoryDecisions,
      );

      return {
        userId,
        success: true,
        memoriesAnalyzed: shortTermMemories.length,
        memoriesArchived: cleanup.archived,
        memoriesDeleted: cleanup.deleted,
        details: {
          archivedIds: cleanup.archivedIds,
          deletedIds: cleanup.deletedIds,
          reasons: cleanup.reasons,
        },
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error("Memory cleanup failed:", error);
      return {
        userId,
        success: false,
        memoriesAnalyzed: 0,
        memoriesArchived: 0,
        memoriesDeleted: 0,
        createdAt: new Date(),
      };
    }
  }

  /**
   * Apply cleanup decisions from LLM analysis
   */
  private async applyCleanupDecisions(
    userId: string,
    memories: any[],
    decisions: any[],
  ): Promise<{
    archived: number;
    deleted: number;
    archivedIds: string[];
    deletedIds: string[];
    reasons: Record<string, string[]>;
  }> {
    let archived = 0;
    let deleted = 0;
    const archivedIds: string[] = [];
    const deletedIds: string[] = [];
    const reasons: Record<string, string[]> = {
      archived: [],
      deleted: [],
    };

    for (const decision of decisions) {
      const memory = memories.find((m) => m.id === decision.id);
      if (!memory) continue;

      // Only apply decisions with confidence > 0.7 to be safe
      if (decision.confidence < 0.7) continue;

      try {
        if (decision.decision === "REMOVE") {
          // Delete the memory
          await prisma.memory.delete({
            where: { id: decision.id },
          });
          deleted++;
          deletedIds.push(decision.id);
          reasons.deleted.push(`${decision.id}: ${decision.reason}`);
        } else if (decision.decision === "ARCHIVE") {
          // Archive the memory
          await prisma.memory.update({
            where: { id: decision.id },
            data: { isArchived: true },
          });
          archived++;
          archivedIds.push(decision.id);
          reasons.archived.push(`${decision.id}: ${decision.reason}`);
        }
      } catch (error) {
        console.error(
          `Failed to apply cleanup decision for memory ${decision.id}:`,
          error,
        );
      }
    }

    return { archived, deleted, archivedIds, deletedIds, reasons };
  }

  /**
   * Format memories for LLM analysis
   */
  private formatMemoriesForAnalysis(memories: any[]): string {
    return memories
      .map(
        (memory) => `
### Memory ID: ${memory.id}
- **Created**: ${memory.createdAt.toISOString()}
- **Importance Score**: ${memory.importanceScore}
- **Tags**: ${memory.tags.join(", ") || "none"}
- **Source**: ${memory.sourceType || "direct"}
- **Content**:
${memory.content}
---`,
      )
      .join("\n");
  }

  /**
   * Get cleanup statistics for a user
   */
  async getCleanupStats(userId: string): Promise<{
    totalShortTermMemories: number;
    totalLongTermMemories: number;
    archivedMemories: number;
    lastCleanupDate?: Date;
  }> {
    const [shortTerm, longTerm, archived] = await Promise.all([
      prisma.memory.count({
        where: {
          userId,
          type: MemoryType.SHORT_TERM,
          isArchived: false,
        },
      }),
      prisma.memory.count({
        where: {
          userId,
          type: MemoryType.LONG_TERM,
          isArchived: false,
        },
      }),
      prisma.memory.count({
        where: {
          userId,
          isArchived: true,
        },
      }),
    ]);

    return {
      totalShortTermMemories: shortTerm,
      totalLongTermMemories: longTerm,
      archivedMemories: archived,
    };
  }
}

// Export singleton instance
export const memoryCleanerService = new MemoryCleanerService();
