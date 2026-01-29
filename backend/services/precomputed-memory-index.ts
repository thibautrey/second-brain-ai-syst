/**
 * Precomputed Memory Index Service
 *
 * Maintains hot data in memory for fast access:
 * - User context embeddings (precomputed from recent activity)
 * - Frequent topics and entities
 * - Recent interactions summary
 *
 * Background job updates indices periodically
 */

import prisma from "./prisma.js";
import { Memory } from "@prisma/client";
import { responseCacheService } from "./response-cache.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const INDEX_CONFIG = {
  // Update intervals
  CONTEXT_UPDATE_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  FULL_REINDEX_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
  
  // Data limits
  MAX_RECENT_INTERACTIONS: 50,
  MAX_FREQUENT_TOPICS: 20,
  MAX_FREQUENT_ENTITIES: 20,
  MAX_USERS_IN_MEMORY: 100,
  
  // Time windows
  RECENT_WINDOW_DAYS: 7,
  FREQUENCY_WINDOW_DAYS: 30,
};

// ============================================================================
// TYPES
// ============================================================================

interface UserContextIndex {
  userId: string;
  
  // Aggregated context
  recentTopics: string[];
  frequentEntities: string[];
  
  // Precomputed summary of recent activity
  activitySummary: {
    totalInteractions: number;
    lastActiveAt: Date;
    dominantSentiment: "positive" | "negative" | "neutral";
    activeTimeOfDay: string; // "morning" | "afternoon" | "evening" | "night"
  };
  
  // Quick access data
  lastInteractions: Array<{
    id: string;
    content: string;
    createdAt: Date;
    importanceScore: number;
    tags: string[];
  }>;
  
  // Precomputed context embedding (average of recent memory embeddings)
  precomputedContextEmbedding?: number[];
  
  // Metadata
  lastUpdated: Date;
  indexVersion: number;
}

interface TopicFrequency {
  topic: string;
  count: number;
  lastSeen: Date;
  trend: "rising" | "stable" | "declining";
}

interface EntityFrequency {
  entity: string;
  count: number;
  lastSeen: Date;
  category?: string; // "person" | "place" | "organization" | "date" | "other"
}

// ============================================================================
// PRECOMPUTED MEMORY INDEX SERVICE
// ============================================================================

class PrecomputedMemoryIndexService {
  // In-memory index storage
  private userContextIndex: Map<string, UserContextIndex> = new Map();
  
  // Topic and entity frequency tracking
  private topicFrequency: Map<string, Map<string, TopicFrequency>> = new Map();
  private entityFrequency: Map<string, Map<string, EntityFrequency>> = new Map();
  
  // Update intervals
  private updateInterval: NodeJS.Timeout | null = null;
  private fullReindexInterval: NodeJS.Timeout | null = null;
  
  // Active user tracking (LRU-style)
  private activeUsers: string[] = [];

  constructor() {
    // Start background update jobs
    this.startBackgroundJobs();
  }

  // ============================================================================
  // BACKGROUND JOBS
  // ============================================================================

  /**
   * Start periodic background jobs for index updates
   */
  private startBackgroundJobs(): void {
    // Periodic context updates for active users
    this.updateInterval = setInterval(
      () => this.updateActiveUserContexts(),
      INDEX_CONFIG.CONTEXT_UPDATE_INTERVAL_MS
    );

    // Full reindex (less frequent)
    this.fullReindexInterval = setInterval(
      () => this.performFullReindex(),
      INDEX_CONFIG.FULL_REINDEX_INTERVAL_MS
    );

    console.log("✓ PrecomputedMemoryIndex background jobs started");
  }

  /**
   * Stop background jobs (for graceful shutdown)
   */
  stopBackgroundJobs(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.fullReindexInterval) {
      clearInterval(this.fullReindexInterval);
      this.fullReindexInterval = null;
    }
  }

  /**
   * Update contexts for recently active users
   */
  private async updateActiveUserContexts(): Promise<void> {
    const usersToUpdate = this.activeUsers.slice(0, 20); // Update top 20 active users
    
    await Promise.all(
      usersToUpdate.map(userId => this.updateUserContext(userId).catch(err => {
        console.warn(`Failed to update context for user ${userId}:`, err.message);
      }))
    );
  }

  /**
   * Perform full reindex of all indexed users
   */
  private async performFullReindex(): Promise<void> {
    console.log("Starting full memory index reindex...");
    const startTime = Date.now();
    
    const allUserIds = Array.from(this.userContextIndex.keys());
    
    for (const userId of allUserIds) {
      await this.updateUserContext(userId).catch(err => {
        console.warn(`Reindex failed for user ${userId}:`, err.message);
      });
    }
    
    console.log(`Full reindex completed in ${Date.now() - startTime}ms for ${allUserIds.length} users`);
  }

  // ============================================================================
  // CONTEXT MANAGEMENT
  // ============================================================================

  /**
   * Get precomputed context for a user (instant retrieval)
   */
  getContext(userId: string): UserContextIndex | null {
    this.markUserActive(userId);
    return this.userContextIndex.get(userId) || null;
  }

  /**
   * Get context or compute if not available
   */
  async getOrComputeContext(userId: string): Promise<UserContextIndex> {
    this.markUserActive(userId);
    
    const existing = this.userContextIndex.get(userId);
    if (existing) {
      // Check if stale (older than 10 minutes)
      const isStale = Date.now() - existing.lastUpdated.getTime() > 10 * 60 * 1000;
      if (!isStale) {
        return existing;
      }
    }
    
    // Compute fresh context
    return this.updateUserContext(userId);
  }

  /**
   * Update context for a specific user
   */
  async updateUserContext(userId: string): Promise<UserContextIndex> {
    const recentWindow = new Date(Date.now() - INDEX_CONFIG.RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const frequencyWindow = new Date(Date.now() - INDEX_CONFIG.FREQUENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Fetch data in parallel
    const [recentMemories, frequencyData, lastInteraction] = await Promise.all([
      // Recent memories
      prisma.memory.findMany({
        where: {
          userId,
          isArchived: false,
          createdAt: { gte: recentWindow },
        },
        orderBy: { createdAt: "desc" },
        take: INDEX_CONFIG.MAX_RECENT_INTERACTIONS,
        select: {
          id: true,
          content: true,
          createdAt: true,
          importanceScore: true,
          tags: true,
          entities: true,
        },
      }),
      // Frequency data from longer window
      this.computeFrequencyData(userId, frequencyWindow),
      // Last interaction timestamp
      prisma.memory.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    // Compute activity summary
    const activitySummary = this.computeActivitySummary(recentMemories);

    // Build context index
    const contextIndex: UserContextIndex = {
      userId,
      recentTopics: frequencyData.topics.slice(0, INDEX_CONFIG.MAX_FREQUENT_TOPICS),
      frequentEntities: frequencyData.entities.slice(0, INDEX_CONFIG.MAX_FREQUENT_ENTITIES),
      activitySummary: {
        totalInteractions: recentMemories.length,
        lastActiveAt: lastInteraction?.createdAt || new Date(),
        dominantSentiment: activitySummary.dominantSentiment,
        activeTimeOfDay: activitySummary.activeTimeOfDay,
      },
      lastInteractions: recentMemories.slice(0, 10).map(m => ({
        id: m.id,
        content: m.content.substring(0, 200), // Truncate for memory efficiency
        createdAt: m.createdAt,
        importanceScore: m.importanceScore,
        tags: m.tags,
      })),
      lastUpdated: new Date(),
      indexVersion: (this.userContextIndex.get(userId)?.indexVersion || 0) + 1,
    };

    // Store in index
    this.userContextIndex.set(userId, contextIndex);

    // Update frequency maps
    this.updateFrequencyMaps(userId, frequencyData);

    // Evict old users if too many
    this.evictOldUsersIfNeeded();

    return contextIndex;
  }

  /**
   * Mark a user as active (for prioritization)
   */
  private markUserActive(userId: string): void {
    // Remove if already in list
    const index = this.activeUsers.indexOf(userId);
    if (index > -1) {
      this.activeUsers.splice(index, 1);
    }
    
    // Add to front
    this.activeUsers.unshift(userId);
    
    // Trim list
    if (this.activeUsers.length > INDEX_CONFIG.MAX_USERS_IN_MEMORY) {
      this.activeUsers = this.activeUsers.slice(0, INDEX_CONFIG.MAX_USERS_IN_MEMORY);
    }
  }

  /**
   * Evict least active users if memory limit reached
   */
  private evictOldUsersIfNeeded(): void {
    if (this.userContextIndex.size > INDEX_CONFIG.MAX_USERS_IN_MEMORY) {
      // Get users not in active list
      const activeSet = new Set(this.activeUsers);
      const toEvict: string[] = [];
      
      for (const userId of this.userContextIndex.keys()) {
        if (!activeSet.has(userId)) {
          toEvict.push(userId);
        }
      }
      
      // Evict oldest first
      for (const userId of toEvict.slice(0, this.userContextIndex.size - INDEX_CONFIG.MAX_USERS_IN_MEMORY)) {
        this.userContextIndex.delete(userId);
        this.topicFrequency.delete(userId);
        this.entityFrequency.delete(userId);
      }
    }
  }

  // ============================================================================
  // FREQUENCY COMPUTATION
  // ============================================================================

  /**
   * Compute topic and entity frequency for a user
   */
  private async computeFrequencyData(
    userId: string,
    since: Date
  ): Promise<{ topics: string[]; entities: string[] }> {
    const memories = await prisma.memory.findMany({
      where: {
        userId,
        isArchived: false,
        createdAt: { gte: since },
      },
      select: {
        tags: true,
        entities: true,
        createdAt: true,
      },
    });

    // Count frequencies with recency weighting
    const now = Date.now();
    const topicCounts: Record<string, number> = {};
    const entityCounts: Record<string, number> = {};

    for (const memory of memories) {
      // Recency weight: more recent = higher weight
      const ageInDays = (now - memory.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      const recencyWeight = Math.exp(-ageInDays / 14); // Half-life of 14 days

      for (const tag of memory.tags) {
        topicCounts[tag] = (topicCounts[tag] || 0) + recencyWeight;
      }
      for (const entity of memory.entities) {
        entityCounts[entity] = (entityCounts[entity] || 0) + recencyWeight;
      }
    }

    // Sort by weighted frequency
    const topics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic);

    const entities = Object.entries(entityCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([entity]) => entity);

    return { topics, entities };
  }

  /**
   * Update frequency maps for a user
   */
  private updateFrequencyMaps(
    userId: string,
    data: { topics: string[]; entities: string[] }
  ): void {
    // Update topic frequency
    const topicMap = new Map<string, TopicFrequency>();
    const existingTopics = this.topicFrequency.get(userId);
    
    for (let i = 0; i < data.topics.length; i++) {
      const topic = data.topics[i];
      const existing = existingTopics?.get(topic);
      const previousRank = existing ? Array.from(existingTopics!.keys()).indexOf(topic) : -1;
      
      topicMap.set(topic, {
        topic,
        count: data.topics.length - i, // Rank-based count
        lastSeen: new Date(),
        trend: previousRank === -1 ? "rising" : 
               i < previousRank ? "rising" : 
               i > previousRank ? "declining" : "stable",
      });
    }
    this.topicFrequency.set(userId, topicMap);

    // Update entity frequency
    const entityMap = new Map<string, EntityFrequency>();
    
    for (let i = 0; i < data.entities.length; i++) {
      const entity = data.entities[i];
      entityMap.set(entity, {
        entity,
        count: data.entities.length - i,
        lastSeen: new Date(),
      });
    }
    this.entityFrequency.set(userId, entityMap);
  }

  /**
   * Compute activity summary from recent memories
   */
  private computeActivitySummary(
    memories: Array<{ createdAt: Date; tags: string[] }>
  ): { dominantSentiment: "positive" | "negative" | "neutral"; activeTimeOfDay: string } {
    // Analyze time of day distribution
    const hourCounts: Record<string, number> = {
      morning: 0,   // 6-12
      afternoon: 0, // 12-18
      evening: 0,   // 18-22
      night: 0,     // 22-6
    };

    for (const memory of memories) {
      const hour = memory.createdAt.getHours();
      if (hour >= 6 && hour < 12) hourCounts.morning++;
      else if (hour >= 12 && hour < 18) hourCounts.afternoon++;
      else if (hour >= 18 && hour < 22) hourCounts.evening++;
      else hourCounts.night++;
    }

    const activeTimeOfDay = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])[0][0];

    // Simple sentiment based on tags (could be enhanced)
    let positiveCount = 0;
    let negativeCount = 0;
    
    const positiveTags = ["happy", "success", "good", "great", "excellent", "achievement"];
    const negativeTags = ["sad", "failure", "bad", "problem", "issue", "error"];

    for (const memory of memories) {
      for (const tag of memory.tags) {
        const lowerTag = tag.toLowerCase();
        if (positiveTags.some(p => lowerTag.includes(p))) positiveCount++;
        if (negativeTags.some(n => lowerTag.includes(n))) negativeCount++;
      }
    }

    const dominantSentiment = positiveCount > negativeCount ? "positive" :
                              negativeCount > positiveCount ? "negative" : "neutral";

    return { dominantSentiment, activeTimeOfDay };
  }

  // ============================================================================
  // QUICK ACCESS METHODS
  // ============================================================================

  /**
   * Get user's frequent topics (instant)
   */
  getFrequentTopics(userId: string): string[] {
    const context = this.userContextIndex.get(userId);
    return context?.recentTopics || [];
  }

  /**
   * Get user's frequent entities (instant)
   */
  getFrequentEntities(userId: string): string[] {
    const context = this.userContextIndex.get(userId);
    return context?.frequentEntities || [];
  }

  /**
   * Get user's recent interactions (instant)
   */
  getRecentInteractions(userId: string): UserContextIndex["lastInteractions"] {
    const context = this.userContextIndex.get(userId);
    return context?.lastInteractions || [];
  }

  /**
   * Get topic trend for a user
   */
  getTopicTrend(userId: string, topic: string): TopicFrequency | null {
    return this.topicFrequency.get(userId)?.get(topic) || null;
  }

  // ============================================================================
  // STATS AND MANAGEMENT
  // ============================================================================

  /**
   * Get index statistics
   */
  getStats(): {
    indexedUsers: number;
    activeUsers: number;
    totalTopics: number;
    totalEntities: number;
  } {
    let totalTopics = 0;
    let totalEntities = 0;
    
    for (const topicMap of this.topicFrequency.values()) {
      totalTopics += topicMap.size;
    }
    for (const entityMap of this.entityFrequency.values()) {
      totalEntities += entityMap.size;
    }

    return {
      indexedUsers: this.userContextIndex.size,
      activeUsers: this.activeUsers.length,
      totalTopics,
      totalEntities,
    };
  }

  /**
   * Invalidate index for a user (e.g., after bulk memory changes)
   */
  invalidateUserIndex(userId: string): void {
    this.userContextIndex.delete(userId);
    this.topicFrequency.delete(userId);
    this.entityFrequency.delete(userId);
    
    // Also invalidate related caches
    responseCacheService.invalidateMemoryCache(userId);
    responseCacheService.invalidateUserProfile(userId);
  }

  /**
   * Clear all indices
   */
  clearAll(): void {
    this.userContextIndex.clear();
    this.topicFrequency.clear();
    this.entityFrequency.clear();
    this.activeUsers = [];
  }
}

// Export singleton instance
export const precomputedMemoryIndex = new PrecomputedMemoryIndexService();
