/**
 * AI Instructions Service
 *
 * Manages the AI's self-training system. This stores AI-internal knowledge,
 * learnings, and observations that help the AI better serve the user.
 *
 * IMPORTANT: This is NOT for user memories (souvenirs).
 * User memories are stored in the Memory table.
 * AI instructions are for the AI's own learning and improvement.
 *
 * Examples of what goes here:
 * - Data coherence observations (e.g., "Task X should be recurring")
 * - User pattern detections (e.g., "User prefers morning reminders")
 * - System improvement ideas
 * - Scheduling preferences learned over time
 *
 * Examples of what does NOT go here (goes to Memory instead):
 * - User's personal experiences
 * - User's conversations and reflections
 * - Daily summaries of what the user did
 */

import prisma from "./prisma.js";
import { AIInstructionCategory } from "@prisma/client";

// ==================== Types ====================

export interface CreateAIInstructionInput {
  title?: string;
  content: string;
  category: AIInstructionCategory;
  sourceAgent: string;
  priority?: number;
  confidence?: number;
  expiresAt?: Date;
  validUntil?: Date;
  relatedGoalIds?: string[];
  relatedTodoIds?: string[];
  relatedMemoryIds?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateAIInstructionInput {
  title?: string;
  content?: string;
  isActive?: boolean;
  priority?: number;
  confidence?: number;
  isVerified?: boolean;
  expiresAt?: Date | null;
  validUntil?: Date | null;
  metadata?: Record<string, any>;
}

export interface AIInstructionFilters {
  category?: AIInstructionCategory | AIInstructionCategory[];
  sourceAgent?: string | string[];
  isActive?: boolean;
  isVerified?: boolean;
  minPriority?: number;
  minConfidence?: number;
}

// ==================== Service ====================

export class AIInstructionsService {
  /**
   * Create a new AI instruction/learning
   */
  async createInstruction(userId: string, input: CreateAIInstructionInput) {
    return prisma.aIInstruction.create({
      data: {
        userId,
        title: input.title,
        content: input.content,
        category: input.category,
        sourceAgent: input.sourceAgent,
        priority: input.priority ?? 0,
        confidence: input.confidence ?? 0.7,
        expiresAt: input.expiresAt,
        validUntil: input.validUntil,
        relatedGoalIds: input.relatedGoalIds ?? [],
        relatedTodoIds: input.relatedTodoIds ?? [],
        relatedMemoryIds: input.relatedMemoryIds ?? [],
        metadata: input.metadata ?? {},
      },
    });
  }

  /**
   * Get instructions for AI context building
   * Returns active, non-expired instructions sorted by priority
   */
  async getActiveInstructions(
    userId: string,
    filters?: AIInstructionFilters,
    limit: number = 50
  ) {
    const now = new Date();

    const where: any = {
      userId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    if (filters?.category) {
      where.category = Array.isArray(filters.category)
        ? { in: filters.category }
        : filters.category;
    }

    if (filters?.sourceAgent) {
      where.sourceAgent = Array.isArray(filters.sourceAgent)
        ? { in: filters.sourceAgent }
        : filters.sourceAgent;
    }

    if (filters?.isVerified !== undefined) {
      where.isVerified = filters.isVerified;
    }

    if (filters?.minPriority !== undefined) {
      where.priority = { gte: filters.minPriority };
    }

    if (filters?.minConfidence !== undefined) {
      where.confidence = { gte: filters.minConfidence };
    }

    return prisma.aIInstruction.findMany({
      where,
      orderBy: [{ priority: "desc" }, { confidence: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
  }

  /**
   * Get instructions by source agent
   */
  async getInstructionsByAgent(userId: string, sourceAgent: string, limit: number = 20) {
    return this.getActiveInstructions(userId, { sourceAgent }, limit);
  }

  /**
   * Get instructions by category
   */
  async getInstructionsByCategory(
    userId: string,
    category: AIInstructionCategory,
    limit: number = 20
  ) {
    return this.getActiveInstructions(userId, { category }, limit);
  }

  /**
   * Mark an instruction as used (for tracking which learnings are helpful)
   */
  async markAsUsed(instructionId: string) {
    return prisma.aIInstruction.update({
      where: { id: instructionId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Verify an instruction (user confirmed it's accurate)
   */
  async verifyInstruction(instructionId: string) {
    return prisma.aIInstruction.update({
      where: { id: instructionId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        confidence: 1.0, // Max confidence when verified
      },
    });
  }

  /**
   * Deactivate an instruction (no longer relevant)
   */
  async deactivateInstruction(instructionId: string) {
    return prisma.aIInstruction.update({
      where: { id: instructionId },
      data: { isActive: false },
    });
  }

  /**
   * Update an instruction
   */
  async updateInstruction(instructionId: string, input: UpdateAIInstructionInput) {
    return prisma.aIInstruction.update({
      where: { id: instructionId },
      data: {
        ...input,
        ...(input.isVerified && { verifiedAt: new Date() }),
      },
    });
  }

  /**
   * Delete an instruction
   */
  async deleteInstruction(instructionId: string) {
    return prisma.aIInstruction.delete({
      where: { id: instructionId },
    });
  }

  /**
   * Check if a similar instruction already exists
   * (to avoid duplicates)
   */
  async findSimilarInstruction(
    userId: string,
    sourceAgent: string,
    category: AIInstructionCategory,
    contentKeywords: string[]
  ) {
    const instructions = await prisma.aIInstruction.findMany({
      where: {
        userId,
        sourceAgent,
        category,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Simple keyword matching to find similar instructions
    for (const instruction of instructions) {
      const matchCount = contentKeywords.filter((keyword) =>
        instruction.content.toLowerCase().includes(keyword.toLowerCase())
      ).length;

      if (matchCount >= contentKeywords.length * 0.6) {
        return instruction;
      }
    }

    return null;
  }

  /**
   * Clean up expired instructions
   */
  async cleanupExpiredInstructions(userId: string) {
    const now = new Date();

    const result = await prisma.aIInstruction.updateMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { lt: now },
      },
      data: { isActive: false },
    });

    return result.count;
  }

  /**
   * Format instructions for inclusion in AI context/prompts
   */
  formatForContext(instructions: any[]): string {
    if (instructions.length === 0) {
      return "";
    }

    let context = "## AI Learnings & Instructions\n\n";
    context +=
      "The following are observations and learnings the AI has made about the user's data and preferences:\n\n";

    instructions.forEach((inst, i) => {
      const verified = inst.isVerified ? " ✓" : "";
      const priority = inst.priority > 5 ? " ⭐" : "";
      context += `${i + 1}. [${inst.category}]${verified}${priority}\n`;
      if (inst.title) {
        context += `   **${inst.title}**\n`;
      }
      context += `   ${inst.content}\n\n`;
    });

    return context;
  }
}

// Export singleton instance
export const aiInstructionsService = new AIInstructionsService();
