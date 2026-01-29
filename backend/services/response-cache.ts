/**
 * Response Cache Service
 *
 * Aggressive caching for fast user responses:
 * - Recent conversation context
 * - User profile embeddings
 * - Frequently accessed memories
 *
 * Uses in-memory cache with TTL and LRU eviction
 */

import prisma from "./prisma.js";
import { Memory } from "@prisma/client";

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================
const CACHE_CONFIG = {
  // TTLs in milliseconds
  CONVERSATION_CONTEXT_TTL: 5 * 60 * 1000, // 5 minutes
  USER_PROFILE_TTL: 10 * 60 * 1000, // 10 minutes
  FREQUENT_MEMORIES_TTL: 15 * 60 * 1000, // 15 minutes
  EMBEDDING_CACHE_TTL: 30 * 60 * 1000, // 30 minutes
  
  // Size limits
  MAX_CONVERSATION_ENTRIES: 100,
  MAX_PROFILE_ENTRIES: 500,
  MAX_MEMORY_ENTRIES: 1000,
  MAX_EMBEDDING_ENTRIES: 500,
  
  // Recent memories to keep per user
  RECENT_MEMORIES_COUNT: 20,
};

// ============================================================================
// CACHE TYPES
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hitCount: number;
  lastAccess: number;
}

interface ConversationContext {
  recentMessages: Array<{ role: string; content: string; timestamp: number }>;
  lastTopics: string[];
  currentSessionStart: number;
}

interface UserProfileCache {
  profile: Record<string, any>;
  preferences: Record<string, any>;
  frequentTopics: string[];
  frequentEntities: string[];
}

interface MemoryCache {
  memories: Memory[];
  topMemoriesByImportance: Memory[];
  recentMemories: Memory[];
}

interface EmbeddingCache {
  text: string;
  vector: number[];
}

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================

class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access tracking
    entry.hitCount++;
    entry.lastAccess = Date.now();
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  set(key: K, value: V): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      hitCount: 1,
      lastAccess: Date.now(),
    });
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; hitRates: Map<K, number> } {
    const hitRates = new Map<K, number>();
    for (const [key, entry] of this.cache) {
      hitRates.set(key, entry.hitCount);
    }
    return { size: this.cache.size, hitRates };
  }
}

// ============================================================================
// RESPONSE CACHE SERVICE
// ============================================================================

class ResponseCacheService {
  // Conversation context cache (per user)
  private conversationCache: LRUCache<string, ConversationContext>;
  
  // User profile cache (per user)
  private profileCache: LRUCache<string, UserProfileCache>;
  
  // Frequently accessed memories (per user)
  private memoryCache: LRUCache<string, MemoryCache>;
  
  // Embedding cache (content hash -> vector)
  private embeddingCache: LRUCache<string, number[]>;

  constructor() {
    this.conversationCache = new LRUCache(
      CACHE_CONFIG.MAX_CONVERSATION_ENTRIES,
      CACHE_CONFIG.CONVERSATION_CONTEXT_TTL
    );
    this.profileCache = new LRUCache(
      CACHE_CONFIG.MAX_PROFILE_ENTRIES,
      CACHE_CONFIG.USER_PROFILE_TTL
    );
    this.memoryCache = new LRUCache(
      CACHE_CONFIG.MAX_MEMORY_ENTRIES,
      CACHE_CONFIG.FREQUENT_MEMORIES_TTL
    );
    this.embeddingCache = new LRUCache(
      CACHE_CONFIG.MAX_EMBEDDING_ENTRIES,
      CACHE_CONFIG.EMBEDDING_CACHE_TTL
    );
  }

  // ============================================================================
  // CONVERSATION CONTEXT
  // ============================================================================

  /**
   * Get recent conversation context for a user
   */
  getConversationContext(userId: string): ConversationContext | null {
    return this.conversationCache.get(userId);
  }

  /**
   * Update conversation context with new message
   */
  updateConversationContext(
    userId: string,
    message: { role: string; content: string },
    topics?: string[]
  ): void {
    let context = this.conversationCache.get(userId);
    
    if (!context) {
      context = {
        recentMessages: [],
        lastTopics: [],
        currentSessionStart: Date.now(),
      };
    }

    // Add new message
    context.recentMessages.push({
      ...message,
      timestamp: Date.now(),
    });

    // Keep only last 10 messages
    if (context.recentMessages.length > 10) {
      context.recentMessages = context.recentMessages.slice(-10);
    }

    // Update topics
    if (topics && topics.length > 0) {
      context.lastTopics = [...new Set([...topics, ...context.lastTopics])].slice(0, 10);
    }

    this.conversationCache.set(userId, context);
  }

  /**
   * Clear conversation context (e.g., on session end)
   */
  clearConversationContext(userId: string): void {
    this.conversationCache.delete(userId);
  }

  // ============================================================================
  // USER PROFILE CACHE
  // ============================================================================

  /**
   * Get cached user profile
   */
  getUserProfileCache(userId: string): UserProfileCache | null {
    return this.profileCache.get(userId);
  }

  /**
   * Set user profile cache
   */
  async setUserProfileCache(userId: string): Promise<UserProfileCache> {
    // Fetch user settings and compute frequent topics/entities
    const [settings, frequentData] = await Promise.all([
      prisma.userSettings.findUnique({
        where: { userId },
        select: { userProfile: true },
      }),
      this.computeFrequentUserData(userId),
    ]);

    const profileCache: UserProfileCache = {
      profile: (settings?.userProfile as Record<string, any>) || {},
      preferences: {},
      frequentTopics: frequentData.topics,
      frequentEntities: frequentData.entities,
    };

    this.profileCache.set(userId, profileCache);
    return profileCache;
  }

  /**
   * Invalidate user profile cache
   */
  invalidateUserProfile(userId: string): void {
    this.profileCache.delete(userId);
  }

  /**
   * Compute frequent topics and entities for a user
   */
  private async computeFrequentUserData(
    userId: string
  ): Promise<{ topics: string[]; entities: string[] }> {
    // Get recent memories to extract frequent data
    const recentMemories = await prisma.memory.findMany({
      where: {
        userId,
        isArchived: false,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      select: {
        tags: true,
        entities: true,
      },
      take: 100,
    });

    // Count frequency of tags and entities
    const tagCounts: Record<string, number> = {};
    const entityCounts: Record<string, number> = {};

    for (const memory of recentMemories) {
      for (const tag of memory.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
      for (const entity of memory.entities) {
        entityCounts[entity] = (entityCounts[entity] || 0) + 1;
      }
    }

    // Sort by frequency and take top items
    const topics = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag]) => tag);

    const entities = Object.entries(entityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([entity]) => entity);

    return { topics, entities };
  }

  // ============================================================================
  // FREQUENTLY ACCESSED MEMORIES
  // ============================================================================

  /**
   * Get cached memories for a user
   */
  getMemoryCache(userId: string): MemoryCache | null {
    return this.memoryCache.get(userId);
  }

  /**
   * Preload frequently accessed memories for a user
   */
  async preloadMemories(userId: string): Promise<MemoryCache> {
    const [topByImportance, recentMemories] = await Promise.all([
      // Top memories by importance (likely to be referenced)
      prisma.memory.findMany({
        where: {
          userId,
          isArchived: false,
          importanceScore: { gte: 0.7 },
        },
        orderBy: { importanceScore: "desc" },
        take: 20,
      }),
      // Most recent memories
      prisma.memory.findMany({
        where: {
          userId,
          isArchived: false,
        },
        orderBy: { createdAt: "desc" },
        take: CACHE_CONFIG.RECENT_MEMORIES_COUNT,
      }),
    ]);

    const memoryCache: MemoryCache = {
      memories: [...topByImportance, ...recentMemories],
      topMemoriesByImportance: topByImportance,
      recentMemories,
    };

    this.memoryCache.set(userId, memoryCache);
    return memoryCache;
  }

  /**
   * Add new memory to cache
   */
  addMemoryToCache(userId: string, memory: Memory): void {
    const cache = this.memoryCache.get(userId);
    if (cache) {
      cache.recentMemories.unshift(memory);
      if (cache.recentMemories.length > CACHE_CONFIG.RECENT_MEMORIES_COUNT) {
        cache.recentMemories.pop();
      }
      cache.memories.unshift(memory);
      this.memoryCache.set(userId, cache);
    }
  }

  /**
   * Invalidate memory cache for a user
   */
  invalidateMemoryCache(userId: string): void {
    this.memoryCache.delete(userId);
  }

  // ============================================================================
  // EMBEDDING CACHE
  // ============================================================================

  /**
   * Generate a cache key for text content
   */
  private generateEmbeddingKey(text: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `emb_${hash}`;
  }

  /**
   * Get cached embedding for text
   */
  getCachedEmbedding(text: string): number[] | null {
    const key = this.generateEmbeddingKey(text);
    return this.embeddingCache.get(key);
  }

  /**
   * Cache an embedding
   */
  cacheEmbedding(text: string, vector: number[]): void {
    const key = this.generateEmbeddingKey(text);
    this.embeddingCache.set(key, vector);
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Get cache statistics
   */
  getStats(): {
    conversation: { size: number };
    profile: { size: number };
    memory: { size: number };
    embedding: { size: number };
  } {
    return {
      conversation: { size: this.conversationCache.size() },
      profile: { size: this.profileCache.size() },
      memory: { size: this.memoryCache.size() },
      embedding: { size: this.embeddingCache.size() },
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.conversationCache.clear();
    this.profileCache.clear();
    this.memoryCache.clear();
    this.embeddingCache.clear();
  }

  /**
   * Clear all caches for a specific user
   */
  clearUserCaches(userId: string): void {
    this.conversationCache.delete(userId);
    this.profileCache.delete(userId);
    this.memoryCache.delete(userId);
  }

  /**
   * Warm up caches for a user (call on login/session start)
   */
  async warmUpCaches(userId: string): Promise<void> {
    await Promise.all([
      this.setUserProfileCache(userId),
      this.preloadMemories(userId),
    ]);
  }
}

// Export singleton instance
export const responseCacheService = new ResponseCacheService();
