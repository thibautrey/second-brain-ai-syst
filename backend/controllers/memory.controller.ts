import prisma from "../services/prisma.js";
import { MemoryType, TimeScale, Prisma } from "@prisma/client";

// ==================== Types ====================

export interface CreateMemoryInput {
  content: string;
  type?: MemoryType;
  timeScale?: TimeScale;
  sourceType?: string;
  sourceId?: string;
  importanceScore?: number;
  tags?: string[];
  entities?: string[];
  metadata?: Record<string, any>;
  occurredAt?: Date;
  isPinned?: boolean;
}

export interface UpdateMemoryInput {
  content?: string;
  type?: MemoryType;
  timeScale?: TimeScale;
  importanceScore?: number;
  tags?: string[];
  entities?: string[];
  metadata?: Record<string, any>;
  isArchived?: boolean;
  isPinned?: boolean;
}

export interface MemoryQueryFilters {
  type?: MemoryType;
  timeScale?: TimeScale;
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
  startDate?: Date;
  endDate?: Date;
  isArchived?: boolean;
  isPinned?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "importanceScore" | "occurredAt";
  sortOrder?: "asc" | "desc";
}

// ==================== Controller Functions ====================

/**
 * Create a new memory for a user
 */
export async function createMemory(userId: string, input: CreateMemoryInput) {
  const memory = await prisma.memory.create({
    data: {
      userId,
      content: input.content,
      type: input.type || MemoryType.SHORT_TERM,
      timeScale: input.timeScale,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      importanceScore: input.importanceScore ?? 0.5,
      tags: input.tags || [],
      entities: input.entities || [],
      metadata: input.metadata || {},
      occurredAt: input.occurredAt,
      isPinned: input.isPinned || false,
    },
  });

  return memory;
}

/**
 * Get a memory by ID (ensuring user ownership)
 */
export async function getMemoryById(userId: string, memoryId: string) {
  const memory = await prisma.memory.findFirst({
    where: {
      id: memoryId,
      userId,
    },
    include: {
      sourceSummaries: {
        select: {
          id: true,
          title: true,
          timeScale: true,
          periodStart: true,
          periodEnd: true,
        },
      },
    },
  });

  if (!memory) {
    throw new Error("Memory not found");
  }

  return memory;
}

/**
 * Get all memories for a user with filtering and pagination
 */
export async function getMemories(
  userId: string,
  filters: MemoryQueryFilters = {},
  pagination: PaginationOptions = {}
) {
  const {
    type,
    timeScale,
    tags,
    minImportance,
    maxImportance,
    startDate,
    endDate,
    isArchived,
    isPinned,
    search,
  } = filters;

  const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = pagination;

  // Build where clause
  const where: Prisma.MemoryWhereInput = {
    userId,
  };

  if (type) {
    where.type = type;
  }

  if (timeScale) {
    where.timeScale = timeScale;
  }

  if (tags && tags.length > 0) {
    where.tags = {
      hasSome: tags,
    };
  }

  if (minImportance !== undefined || maxImportance !== undefined) {
    where.importanceScore = {};
    if (minImportance !== undefined) {
      where.importanceScore.gte = minImportance;
    }
    if (maxImportance !== undefined) {
      where.importanceScore.lte = maxImportance;
    }
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  if (isArchived !== undefined) {
    where.isArchived = isArchived;
  }

  if (isPinned !== undefined) {
    where.isPinned = isPinned;
  }

  if (search) {
    where.content = {
      contains: search,
      mode: "insensitive",
    };
  }

  // Execute query with pagination
  const [memories, total] = await Promise.all([
    prisma.memory.findMany({
      where,
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.memory.count({ where }),
  ]);

  return {
    memories,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

/**
 * Update a memory
 */
export async function updateMemory(
  userId: string,
  memoryId: string,
  input: UpdateMemoryInput
) {
  // First check ownership
  const existing = await prisma.memory.findFirst({
    where: {
      id: memoryId,
      userId,
    },
  });

  if (!existing) {
    throw new Error("Memory not found");
  }

  const memory = await prisma.memory.update({
    where: { id: memoryId },
    data: {
      ...input,
      updatedAt: new Date(),
    },
  });

  return memory;
}

/**
 * Delete a memory
 */
export async function deleteMemory(userId: string, memoryId: string) {
  // First check ownership
  const existing = await prisma.memory.findFirst({
    where: {
      id: memoryId,
      userId,
    },
  });

  if (!existing) {
    throw new Error("Memory not found");
  }

  await prisma.memory.delete({
    where: { id: memoryId },
  });

  return { success: true };
}

/**
 * Archive a memory (soft delete)
 */
export async function archiveMemory(userId: string, memoryId: string) {
  return updateMemory(userId, memoryId, { isArchived: true });
}

/**
 * Unarchive a memory
 */
export async function unarchiveMemory(userId: string, memoryId: string) {
  return updateMemory(userId, memoryId, { isArchived: false });
}

/**
 * Pin a memory
 */
export async function pinMemory(userId: string, memoryId: string) {
  return updateMemory(userId, memoryId, { isPinned: true });
}

/**
 * Unpin a memory
 */
export async function unpinMemory(userId: string, memoryId: string) {
  return updateMemory(userId, memoryId, { isPinned: false });
}

/**
 * Bulk create memories
 */
export async function bulkCreateMemories(
  userId: string,
  inputs: CreateMemoryInput[]
) {
  const memories = await prisma.memory.createMany({
    data: inputs.map((input) => ({
      userId,
      content: input.content,
      type: input.type || MemoryType.SHORT_TERM,
      timeScale: input.timeScale,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      importanceScore: input.importanceScore ?? 0.5,
      tags: input.tags || [],
      entities: input.entities || [],
      metadata: input.metadata || {},
      occurredAt: input.occurredAt,
      isPinned: input.isPinned || false,
    })),
  });

  return { count: memories.count };
}

/**
 * Get memory statistics for a user
 */
export async function getMemoryStats(userId: string) {
  const [
    totalCount,
    shortTermCount,
    longTermCount,
    archivedCount,
    pinnedCount,
    tagStats,
    recentCount,
  ] = await Promise.all([
    prisma.memory.count({ where: { userId } }),
    prisma.memory.count({ where: { userId, type: MemoryType.SHORT_TERM } }),
    prisma.memory.count({ where: { userId, type: MemoryType.LONG_TERM } }),
    prisma.memory.count({ where: { userId, isArchived: true } }),
    prisma.memory.count({ where: { userId, isPinned: true } }),
    prisma.memory.groupBy({
      by: ["tags"],
      where: { userId, isArchived: false },
      _count: true,
    }),
    prisma.memory.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    }),
  ]);

  // Process tag stats
  const tagCounts: Record<string, number> = {};
  tagStats.forEach((stat) => {
    stat.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + stat._count;
    });
  });

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return {
    total: totalCount,
    shortTerm: shortTermCount,
    longTerm: longTermCount,
    archived: archivedCount,
    pinned: pinnedCount,
    recentWeek: recentCount,
    topTags,
  };
}

// ==================== Summary Controller Functions ====================

export interface CreateSummaryInput {
  content: string;
  title?: string;
  timeScale: TimeScale;
  periodStart: Date;
  periodEnd: Date;
  sourceMemoryIds?: string[];
  keyInsights?: string[];
  topics?: string[];
  sentiment?: string;
  actionItems?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateSummaryInput {
  content?: string;
  title?: string;
  keyInsights?: string[];
  topics?: string[];
  sentiment?: string;
  actionItems?: string[];
  metadata?: Record<string, any>;
}

/**
 * Create a new summary
 */
export async function createSummary(userId: string, input: CreateSummaryInput) {
  const summary = await prisma.summary.create({
    data: {
      userId,
      content: input.content,
      title: input.title,
      timeScale: input.timeScale,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      sourceMemoryCount: input.sourceMemoryIds?.length || 0,
      keyInsights: input.keyInsights || [],
      topics: input.topics || [],
      sentiment: input.sentiment,
      actionItems: input.actionItems || [],
      metadata: input.metadata || {},
      sourceMemories: input.sourceMemoryIds
        ? {
            connect: input.sourceMemoryIds.map((id) => ({ id })),
          }
        : undefined,
    },
    include: {
      sourceMemories: {
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  return summary;
}

/**
 * Get a summary by ID
 */
export async function getSummaryById(userId: string, summaryId: string) {
  const summary = await prisma.summary.findFirst({
    where: {
      id: summaryId,
      userId,
    },
    include: {
      sourceMemories: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          tags: true,
        },
      },
    },
  });

  if (!summary) {
    throw new Error("Summary not found");
  }

  return summary;
}

/**
 * Get all summaries for a user
 */
export async function getSummaries(
  userId: string,
  filters: {
    timeScale?: TimeScale;
    startDate?: Date;
    endDate?: Date;
  } = {},
  pagination: PaginationOptions = {}
) {
  const { timeScale, startDate, endDate } = filters;
  const { page = 1, limit = 20, sortBy = "periodEnd", sortOrder = "desc" } = pagination;

  const where: Prisma.SummaryWhereInput = {
    userId,
  };

  if (timeScale) {
    where.timeScale = timeScale;
  }

  if (startDate || endDate) {
    where.periodStart = {};
    where.periodEnd = {};
    if (startDate) {
      where.periodStart.gte = startDate;
    }
    if (endDate) {
      where.periodEnd.lte = endDate;
    }
  }

  const [summaries, total] = await Promise.all([
    prisma.summary.findMany({
      where,
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: { sourceMemories: true },
        },
      },
    }),
    prisma.summary.count({ where }),
  ]);

  return {
    summaries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

/**
 * Update a summary
 */
export async function updateSummary(
  userId: string,
  summaryId: string,
  input: UpdateSummaryInput
) {
  const existing = await prisma.summary.findFirst({
    where: {
      id: summaryId,
      userId,
    },
  });

  if (!existing) {
    throw new Error("Summary not found");
  }

  const summary = await prisma.summary.update({
    where: { id: summaryId },
    data: {
      ...input,
      version: existing.version + 1,
      updatedAt: new Date(),
    },
  });

  return summary;
}

/**
 * Delete a summary
 */
export async function deleteSummary(userId: string, summaryId: string) {
  const existing = await prisma.summary.findFirst({
    where: {
      id: summaryId,
      userId,
    },
  });

  if (!existing) {
    throw new Error("Summary not found");
  }

  await prisma.summary.delete({
    where: { id: summaryId },
  });

  return { success: true };
}

/**
 * Get the latest summary for each time scale
 */
export async function getLatestSummaries(userId: string) {
  const timeScales = Object.values(TimeScale);

  const summaries = await Promise.all(
    timeScales.map(async (scale) => {
      const summary = await prisma.summary.findFirst({
        where: {
          userId,
          timeScale: scale,
        },
        orderBy: {
          periodEnd: "desc",
        },
        select: {
          id: true,
          title: true,
          content: true,
          timeScale: true,
          periodStart: true,
          periodEnd: true,
          keyInsights: true,
          createdAt: true,
        },
      });
      return { timeScale: scale, summary };
    })
  );

  return summaries.filter((s) => s.summary !== null);
}
