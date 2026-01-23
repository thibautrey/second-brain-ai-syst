// Memory Manager Service
// Handles short-term and long-term memory lifecycle

import prisma from "./prisma.js";
import { MemoryType, TimeScale, Prisma } from "@prisma/client";

export interface MemoryMetadata {
  id: string;
  userId: string;
  type: MemoryType;
  timeScale?: TimeScale | null;
  content: string;
  embeddingId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  importanceScore: number;
  tags: string[];
  sourceMemoryIds?: string[];
}

export interface InteractionMetadata {
  sourceType?: string;
  sourceId?: string;
  entities?: string[];
  occurredAt?: Date;
  [key: string]: any;
}

export interface RetrievalFilters {
  timeRange?: [Date, Date];
  memoryTypes?: MemoryType[];
  minImportance?: number;
  tags?: string[];
  isArchived?: boolean;
  limit?: number;
}

export class MemoryManagerService {
  /**
   * Ingest new interaction into short-term memory
   */
  async ingestInteraction(
    userId: string,
    content: string,
    metadata?: InteractionMetadata,
  ): Promise<MemoryMetadata> {
    // 1. Create memory in PostgreSQL
    const memory = await prisma.memory.create({
      data: {
        userId,
        content,
        type: MemoryType.SHORT_TERM,
        sourceType: metadata?.sourceType,
        sourceId: metadata?.sourceId,
        entities: metadata?.entities || [],
        occurredAt: metadata?.occurredAt,
        metadata: metadata || {},
        importanceScore: 0.5, // Default score, can be adjusted later
        tags: [],
      },
    });

    // TODO: 2. Generate embedding via embedding service
    // TODO: 3. Store embedding in Weaviate

    return {
      id: memory.id,
      userId: memory.userId,
      type: memory.type,
      timeScale: memory.timeScale,
      content: memory.content,
      embeddingId: memory.embeddingId,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      importanceScore: memory.importanceScore,
      tags: memory.tags,
    };
  }

  /**
   * Generate summary of memories over time period
   */
  async generateSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
    timeScale: TimeScale,
  ): Promise<MemoryMetadata> {
    // 1. Retrieve memories in time window
    const memories = await prisma.memory.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        isArchived: false,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (memories.length === 0) {
      throw new Error("No memories found in the specified time range");
    }

    // 2. Generate summary content (placeholder for LLM call)
    // TODO: Call LLM to summarize
    const summaryContent = this.generateBasicSummary(memories);

    // 3. Create summary with references to source memories
    const summary = await prisma.summary.create({
      data: {
        userId,
        content: summaryContent,
        timeScale,
        periodStart: startDate,
        periodEnd: endDate,
        sourceMemoryCount: memories.length,
        sourceMemories: {
          connect: memories.map((m) => ({ id: m.id })),
        },
        topics: this.extractTopics(memories),
        keyInsights: [],
      },
    });

    // Promote relevant short-term memories to long-term
    await this.promoteToLongTerm(userId, memories);

    return {
      id: summary.id,
      userId: summary.userId,
      type: MemoryType.LONG_TERM,
      timeScale: summary.timeScale,
      content: summary.content,
      embeddingId: summary.embeddingId,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      importanceScore: 0.8,
      tags: summary.topics,
      sourceMemoryIds: memories.map((m) => m.id),
    };
  }

  /**
   * Generate a basic summary from memories (placeholder for LLM)
   */
  private generateBasicSummary(memories: any[]): string {
    const count = memories.length;
    const firstDate = memories[0].createdAt.toISOString().split("T")[0];
    const lastDate = memories[count - 1].createdAt.toISOString().split("T")[0];

    // Extract unique tags
    const allTags = new Set<string>();
    memories.forEach((m) => m.tags.forEach((t: string) => allTags.add(t)));

    const preview = memories
      .slice(0, 3)
      .map((m) => m.content.substring(0, 100))
      .join("... ");

    return `Summary of ${count} memories from ${firstDate} to ${lastDate}.\n\nTopics: ${Array.from(allTags).join(", ") || "None"}\n\nPreview: ${preview}...`;
  }

  /**
   * Extract topics from memories
   */
  private extractTopics(memories: any[]): string[] {
    const tagCounts: Record<string, number> = {};

    memories.forEach((m) => {
      m.tags.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Return top 5 tags by frequency
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }

  /**
   * Promote high-importance short-term memories to long-term
   */
  private async promoteToLongTerm(
    userId: string,
    memories: any[],
  ): Promise<void> {
    const toPromote = memories.filter(
      (m) =>
        m.type === MemoryType.SHORT_TERM &&
        (m.importanceScore >= 0.7 || m.isPinned),
    );

    if (toPromote.length > 0) {
      await prisma.memory.updateMany({
        where: {
          id: { in: toPromote.map((m) => m.id) },
          userId,
        },
        data: {
          type: MemoryType.LONG_TERM,
        },
      });
    }
  }

  /**
   * Retrieve memories by various criteria
   */
  async retrieveMemories(
    userId: string,
    query: string,
    filters?: RetrievalFilters,
  ): Promise<MemoryMetadata[]> {
    const where: Prisma.MemoryWhereInput = {
      userId,
    };

    // Apply filters
    if (filters?.timeRange) {
      where.createdAt = {
        gte: filters.timeRange[0],
        lte: filters.timeRange[1],
      };
    }

    if (filters?.memoryTypes && filters.memoryTypes.length > 0) {
      where.type = { in: filters.memoryTypes };
    }

    if (filters?.minImportance !== undefined) {
      where.importanceScore = { gte: filters.minImportance };
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters?.isArchived !== undefined) {
      where.isArchived = filters.isArchived;
    }

    // Text search in content
    if (query) {
      where.content = {
        contains: query,
        mode: "insensitive",
      };
    }

    const memories = await prisma.memory.findMany({
      where,
      orderBy: [{ importanceScore: "desc" }, { createdAt: "desc" }],
      take: filters?.limit || 50,
    });

    // TODO: Combine with vector search from Weaviate for semantic similarity

    return memories.map((m) => ({
      id: m.id,
      userId: m.userId,
      type: m.type,
      timeScale: m.timeScale,
      content: m.content,
      embeddingId: m.embeddingId,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      importanceScore: m.importanceScore,
      tags: m.tags,
    }));
  }

  /**
   * Apply retention and compression policies
   */
  async pruneOldMemories(userId: string): Promise<{
    archived: number;
    deleted: number;
  }> {
    const now = new Date();

    // Archive old short-term memories (older than 30 days with low importance)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const archiveResult = await prisma.memory.updateMany({
      where: {
        userId,
        type: MemoryType.SHORT_TERM,
        isArchived: false,
        isPinned: false,
        importanceScore: { lt: 0.3 },
        createdAt: { lt: thirtyDaysAgo },
      },
      data: {
        isArchived: true,
      },
    });

    // Delete very old archived memories (older than 1 year)
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const deleteResult = await prisma.memory.deleteMany({
      where: {
        userId,
        isArchived: true,
        type: MemoryType.SHORT_TERM,
        importanceScore: { lt: 0.2 },
        createdAt: { lt: oneYearAgo },
      },
    });

    return {
      archived: archiveResult.count,
      deleted: deleteResult.count,
    };
  }

  /**
   * Update importance score for a memory
   */
  async updateImportance(
    userId: string,
    memoryId: string,
    newScore: number,
  ): Promise<void> {
    await prisma.memory.update({
      where: {
        id: memoryId,
        userId,
      },
      data: {
        importanceScore: Math.max(0, Math.min(1, newScore)),
      },
    });
  }

  /**
   * Add tags to a memory
   */
  async addTags(
    userId: string,
    memoryId: string,
    tags: string[],
  ): Promise<void> {
    const memory = await prisma.memory.findFirst({
      where: { id: memoryId, userId },
    });

    if (!memory) {
      throw new Error("Memory not found");
    }

    const uniqueTags = [...new Set([...memory.tags, ...tags])];

    await prisma.memory.update({
      where: { id: memoryId },
      data: { tags: uniqueTags },
    });
  }

  /**
   * Get memory timeline for a user
   */
  async getTimeline(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    memories: MemoryMetadata[];
    summaries: any[];
  }> {
    const [memories, summaries] = await Promise.all([
      prisma.memory.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          isArchived: false,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.summary.findMany({
        where: {
          userId,
          periodStart: { gte: startDate },
          periodEnd: { lte: endDate },
        },
        orderBy: { periodEnd: "desc" },
      }),
    ]);

    return {
      memories: memories.map((m) => ({
        id: m.id,
        userId: m.userId,
        type: m.type,
        timeScale: m.timeScale,
        content: m.content,
        embeddingId: m.embeddingId,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        importanceScore: m.importanceScore,
        tags: m.tags,
      })),
      summaries,
    };
  }
}

// Export singleton instance
export const memoryManagerService = new MemoryManagerService();
