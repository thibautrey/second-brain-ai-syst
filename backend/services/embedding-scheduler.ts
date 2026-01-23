/**
 * Embedding Scheduler Service
 *
 * Handles background processing of memories that don't have embeddings.
 * Runs on startup and hourly to ensure all memories are indexed in Weaviate.
 */

import prisma from "./prisma.js";
import { memorySearchService } from "./memory-search.js";
import { Memory } from "@prisma/client";

interface EmbeddingProcessResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ memoryId: string; error: string }>;
  duration: number;
}

interface UserProcessResult {
  userId: string;
  memoriesFound: number;
  indexed: number;
  failed: number;
  skipped: number;
  hasEmbeddingProvider: boolean;
}

export class EmbeddingSchedulerService {
  private isProcessing = false;
  private lastRunAt: Date | null = null;
  private readonly BATCH_SIZE = 50; // Process memories in batches

  constructor() {
    console.log("✓ Embedding scheduler service initialized");
  }

  /**
   * Process all memories without embeddings for all users
   * This is the main entry point called by the scheduler
   */
  async processAllMissingEmbeddings(): Promise<EmbeddingProcessResult> {
    if (this.isProcessing) {
      console.log("⚠ Embedding processing already in progress, skipping...");
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        duration: 0,
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();
    const errors: Array<{ memoryId: string; error: string }> = [];
    let totalProcessed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    console.log("\n🔄 Starting embedding processing for missing embeddings...");

    try {
      // Wait for Weaviate to be ready
      const isWeaviateReady = await memorySearchService.waitForReady();
      if (!isWeaviateReady) {
        console.warn("⚠ Weaviate not available, skipping embedding processing");
        return {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          errors: [{ memoryId: "all", error: "Weaviate not available" }],
          duration: Date.now() - startTime,
        };
      }

      // Get all users
      const users = await prisma.user.findMany({
        select: { id: true, email: true },
      });

      console.log(`  Found ${users.length} user(s) to process`);

      for (const user of users) {
        const result = await this.processUserMissingEmbeddings(user.id);

        totalProcessed += result.memoriesFound;
        successful += result.indexed;
        failed += result.failed;
        skipped += result.skipped;

        if (result.memoriesFound > 0) {
          console.log(
            `  ✓ User ${user.id}: ${result.indexed}/${result.memoriesFound} indexed` +
              (result.skipped > 0 ? `, ${result.skipped} skipped` : "") +
              (result.failed > 0 ? `, ${result.failed} failed` : "") +
              (!result.hasEmbeddingProvider ? " (no embedding provider)" : ""),
          );
        }
      }

      this.lastRunAt = new Date();
      const duration = Date.now() - startTime;

      console.log(
        `✓ Embedding processing complete: ${successful}/${totalProcessed} indexed in ${duration}ms`,
      );

      return {
        totalProcessed,
        successful,
        failed,
        skipped,
        errors,
        duration,
      };
    } catch (error) {
      console.error("✗ Error during embedding processing:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push({ memoryId: "global", error: errorMessage });

      return {
        totalProcessed,
        successful,
        failed,
        skipped,
        errors,
        duration: Date.now() - startTime,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process missing embeddings for a specific user
   */
  async processUserMissingEmbeddings(
    userId: string,
  ): Promise<UserProcessResult> {
    // Check if user has embedding provider configured
    const hasEmbeddingProvider =
      await memorySearchService.hasEmbeddingConfigured(userId);

    if (!hasEmbeddingProvider) {
      // Count memories without embeddings for reporting
      const count = await this.countMemoriesWithoutEmbedding(userId);
      return {
        userId,
        memoriesFound: count,
        indexed: 0,
        failed: 0,
        skipped: count,
        hasEmbeddingProvider: false,
      };
    }

    // Get memories without embeddingId
    const memoriesWithoutEmbedding = await this.getMemoriesWithoutEmbedding(
      userId,
      this.BATCH_SIZE,
    );

    if (memoriesWithoutEmbedding.length === 0) {
      return {
        userId,
        memoriesFound: 0,
        indexed: 0,
        failed: 0,
        skipped: 0,
        hasEmbeddingProvider: true,
      };
    }

    let indexed = 0;
    let failed = 0;

    // Process each memory
    for (const memory of memoriesWithoutEmbedding) {
      try {
        await memorySearchService.indexMemory(memory);

        // Update embeddingId in database to mark as indexed
        await prisma.memory.update({
          where: { id: memory.id },
          data: { embeddingId: memory.id },
        });

        indexed++;
      } catch (error) {
        console.error(`  ✗ Failed to index memory ${memory.id}:`, error);
        failed++;
      }
    }

    return {
      userId,
      memoriesFound: memoriesWithoutEmbedding.length,
      indexed,
      failed,
      skipped: 0,
      hasEmbeddingProvider: true,
    };
  }

  /**
   * Get memories that don't have an embeddingId
   */
  private async getMemoriesWithoutEmbedding(
    userId: string,
    limit: number,
  ): Promise<Memory[]> {
    return prisma.memory.findMany({
      where: {
        userId,
        embeddingId: null,
        isArchived: false,
      },
      orderBy: {
        createdAt: "asc", // Process oldest first
      },
      take: limit,
    });
  }

  /**
   * Count memories without embedding for a user
   */
  private async countMemoriesWithoutEmbedding(userId: string): Promise<number> {
    return prisma.memory.count({
      where: {
        userId,
        embeddingId: null,
        isArchived: false,
      },
    });
  }

  /**
   * Get statistics about embedding coverage
   */
  async getEmbeddingStats(): Promise<{
    totalMemories: number;
    withEmbedding: number;
    withoutEmbedding: number;
    coveragePercent: number;
    lastRunAt: Date | null;
    isProcessing: boolean;
  }> {
    const totalMemories = await prisma.memory.count({
      where: { isArchived: false },
    });

    const withEmbedding = await prisma.memory.count({
      where: {
        isArchived: false,
        embeddingId: { not: null },
      },
    });

    const withoutEmbedding = totalMemories - withEmbedding;
    const coveragePercent =
      totalMemories > 0
        ? Math.round((withEmbedding / totalMemories) * 100 * 100) / 100
        : 100;

    return {
      totalMemories,
      withEmbedding,
      withoutEmbedding,
      coveragePercent,
      lastRunAt: this.lastRunAt,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Get embedding stats per user
   */
  async getEmbeddingStatsByUser(): Promise<
    Array<{
      userId: string;
      email: string;
      totalMemories: number;
      withEmbedding: number;
      withoutEmbedding: number;
      hasEmbeddingProvider: boolean;
    }>
  > {
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
    });

    const stats = [];

    for (const user of users) {
      const totalMemories = await prisma.memory.count({
        where: { userId: user.id, isArchived: false },
      });

      const withEmbedding = await prisma.memory.count({
        where: {
          userId: user.id,
          isArchived: false,
          embeddingId: { not: null },
        },
      });

      const hasEmbeddingProvider =
        await memorySearchService.hasEmbeddingConfigured(user.id);

      stats.push({
        userId: user.id,
        email: user.email,
        totalMemories,
        withEmbedding,
        withoutEmbedding: totalMemories - withEmbedding,
        hasEmbeddingProvider,
      });
    }

    return stats;
  }

  /**
   * Force reprocess all memories for a user (reindex everything)
   */
  async reindexAllUserMemories(userId: string): Promise<{
    indexed: number;
    failed: number;
    error?: string;
  }> {
    const hasEmbeddingProvider =
      await memorySearchService.hasEmbeddingConfigured(userId);

    if (!hasEmbeddingProvider) {
      return {
        indexed: 0,
        failed: 0,
        error: "No embedding provider configured for this user",
      };
    }

    const result = await memorySearchService.reindexUserMemories(userId);

    // Update embeddingId for all successfully indexed memories
    if (result.indexed > 0) {
      await prisma.memory.updateMany({
        where: {
          userId,
          isArchived: false,
        },
        data: {
          embeddingId: userId, // Use a placeholder to mark as indexed
        },
      });

      // Now update each memory with its own ID
      const memories = await prisma.memory.findMany({
        where: { userId, isArchived: false },
        select: { id: true },
      });

      for (const memory of memories) {
        await prisma.memory.update({
          where: { id: memory.id },
          data: { embeddingId: memory.id },
        });
      }
    }

    return {
      indexed: result.indexed,
      failed: 0,
      error: result.error,
    };
  }
}

// Export singleton instance
export const embeddingSchedulerService = new EmbeddingSchedulerService();
