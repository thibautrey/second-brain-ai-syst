/**
 * Parallel Processor Service
 *
 * Orchestrates parallel execution of operations that can be run simultaneously:
 * - Intent classification (now optional, post-response)
 * - Memory retrieval
 * - Provider fetching
 * - Context building
 *
 * Reduces latency by avoiding sequential processing
 */

import { responseCacheService } from "./response-cache.js";
import { precomputedMemoryIndex } from "./precomputed-memory-index.js";
import { memorySearchService } from "./memory-search.js";
import prisma from "./prisma.js";
import { Memory } from "@prisma/client";

// ============================================================================
// TYPES
// ============================================================================

interface ParallelFetchResult {
  // From cache or computed
  userContext: {
    recentTopics: string[];
    frequentEntities: string[];
    recentInteractions: Array<{
      id: string;
      content: string;
      createdAt: Date;
      importanceScore: number;
      tags: string[];
    }>;
  } | null;

  // Memory search results
  semanticSearchResults: {
    memories: Memory[];
    scores: number[];
    searchType: "semantic" | "text" | "cache";
  };

  // Conversation context
  conversationContext: {
    recentMessages: Array<{ role: string; content: string }>;
    lastTopics: string[];
  } | null;

  // Provider (from cache or DB)
  provider: {
    id: string;
    name: string;
    apiKey: string;
    baseUrl: string | null;
    modelId: string;
    fallbackProvider?: any;
    fallbackModelId?: string;
  } | null;

  // Timing info
  timing: {
    total: number;
    userContext: number;
    semanticSearch: number;
    conversationContext: number;
    provider: number;
  };

  // Cache hit info
  cacheHits: {
    userContext: boolean;
    conversationContext: boolean;
    memories: boolean;
  };
}

interface ParallelProcessOptions {
  skipMemorySearch?: boolean;
  memoryLimit?: number;
  usePrecomputedContext?: boolean;
}

// ============================================================================
// PARALLEL PROCESSOR SERVICE
// ============================================================================

class ParallelProcessorService {
  /**
   * Fetch all required data for processing a user request in parallel
   * This is the main optimization - everything runs simultaneously
   */
  async parallelFetch(
    userId: string,
    query: string,
    options: ParallelProcessOptions = {}
  ): Promise<ParallelFetchResult> {
    const startTime = Date.now();
    const timings = {
      userContext: 0,
      semanticSearch: 0,
      conversationContext: 0,
      provider: 0,
    };

    const cacheHits = {
      userContext: false,
      conversationContext: false,
      memories: false,
    };

    // Execute all fetches in parallel
    const [
      userContextResult,
      semanticSearchResult,
      conversationContextResult,
      providerResult,
    ] = await Promise.all([
      // 1. User context (from precomputed index or compute)
      this.fetchUserContext(userId, options.usePrecomputedContext ?? true).then(result => {
        timings.userContext = Date.now() - startTime;
        cacheHits.userContext = result.fromCache;
        return result.data;
      }),

      // 2. Semantic search (if not skipped)
      options.skipMemorySearch
        ? Promise.resolve({ memories: [], scores: [], searchType: "cache" as const, fromCache: true })
        : this.fetchSemanticSearch(userId, query, options.memoryLimit ?? 5).then(result => {
            timings.semanticSearch = Date.now() - startTime;
            cacheHits.memories = result.fromCache;
            return result;
          }),

      // 3. Conversation context (from cache)
      this.fetchConversationContext(userId).then(result => {
        timings.conversationContext = Date.now() - startTime;
        cacheHits.conversationContext = result.fromCache;
        return result.data;
      }),

      // 4. Provider config (from cache or DB)
      this.fetchProvider(userId).then(result => {
        timings.provider = Date.now() - startTime;
        return result;
      }),
    ]);

    return {
      userContext: userContextResult,
      semanticSearchResults: semanticSearchResult,
      conversationContext: conversationContextResult,
      provider: providerResult,
      timing: {
        total: Date.now() - startTime,
        ...timings,
      },
      cacheHits,
    };
  }

  /**
   * Fetch user context from precomputed index or compute fresh
   */
  private async fetchUserContext(
    userId: string,
    usePrecomputed: boolean
  ): Promise<{ data: ParallelFetchResult["userContext"]; fromCache: boolean }> {
    if (usePrecomputed) {
      // Try precomputed index first (instant)
      const precomputed = precomputedMemoryIndex.getContext(userId);
      if (precomputed) {
        return {
          data: {
            recentTopics: precomputed.recentTopics,
            frequentEntities: precomputed.frequentEntities,
            recentInteractions: precomputed.lastInteractions,
          },
          fromCache: true,
        };
      }
    }

    // Compute fresh context
    const context = await precomputedMemoryIndex.getOrComputeContext(userId);
    return {
      data: {
        recentTopics: context.recentTopics,
        frequentEntities: context.frequentEntities,
        recentInteractions: context.lastInteractions,
      },
      fromCache: false,
    };
  }

  /**
   * Fetch semantic search results, using cache when possible
   */
  private async fetchSemanticSearch(
    userId: string,
    query: string,
    limit: number
  ): Promise<ParallelFetchResult["semanticSearchResults"] & { fromCache: boolean }> {
    // Check memory cache first
    const cachedMemories = responseCacheService.getMemoryCache(userId);
    
    if (cachedMemories) {
      // Quick relevance check against cached memories
      const queryLower = query.toLowerCase();
      const relevantCached = cachedMemories.memories.filter(m => 
        m.content.toLowerCase().includes(queryLower) ||
        m.tags.some(t => queryLower.includes(t.toLowerCase()))
      );

      if (relevantCached.length >= 3) {
        // Use cached results if we have enough relevant ones
        return {
          memories: relevantCached.slice(0, limit),
          scores: relevantCached.map((_, i) => 1 - (i * 0.1)),
          searchType: "cache",
          fromCache: true,
        };
      }
    }

    // Fall back to semantic search
    try {
      const searchResult = await memorySearchService.semanticSearch(userId, query, limit);
      
      return {
        memories: searchResult.results.map(r => r.memory),
        scores: searchResult.results.map(r => r.score),
        searchType: searchResult.searchType,
        fromCache: false,
      };
    } catch (error) {
      console.warn("Semantic search failed:", error);
      return {
        memories: [],
        scores: [],
        searchType: "text",
        fromCache: false,
      };
    }
  }

  /**
   * Fetch conversation context from cache
   */
  private async fetchConversationContext(
    userId: string
  ): Promise<{ data: ParallelFetchResult["conversationContext"]; fromCache: boolean }> {
    const cached = responseCacheService.getConversationContext(userId);
    
    if (cached) {
      return {
        data: {
          recentMessages: cached.recentMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          lastTopics: cached.lastTopics,
        },
        fromCache: true,
      };
    }

    return {
      data: null,
      fromCache: false,
    };
  }

  /**
   * Fetch provider configuration (with caching)
   */
  private async fetchProvider(
    userId: string
  ): Promise<ParallelFetchResult["provider"]> {
    // This is already cached in chat.controller.ts via getChatProvider
    // We could duplicate that cache here, but for now just fetch from DB
    const taskConfig = await prisma.aITaskConfig.findFirst({
      where: { userId, taskType: "REFLECTION" },
      include: { 
        provider: true, 
        model: true, 
        fallbackProvider: true, 
        fallbackModel: true 
      },
    });

    if (!taskConfig?.provider || !taskConfig.model?.modelId) {
      return null;
    }

    return {
      id: taskConfig.provider.id,
      name: taskConfig.provider.name,
      apiKey: taskConfig.provider.apiKey,
      baseUrl: taskConfig.provider.baseUrl,
      modelId: taskConfig.model.modelId,
      fallbackProvider: taskConfig.fallbackProvider,
      fallbackModelId: taskConfig.fallbackModel?.modelId,
    };
  }

  /**
   * Quick pre-fetch for speculative execution
   * Starts fetching likely needed data before user finishes typing
   */
  async speculativePreFetch(userId: string): Promise<void> {
    // Pre-warm caches in parallel
    await Promise.all([
      responseCacheService.warmUpCaches(userId).catch(() => {}),
      precomputedMemoryIndex.getOrComputeContext(userId).catch(() => {}),
    ]);
  }

  /**
   * Build optimized context string from parallel fetch results
   */
  buildContextString(results: ParallelFetchResult): string {
    const parts: string[] = [];

    // Add relevant memories
    if (results.semanticSearchResults.memories.length > 0) {
      const memoryContext = results.semanticSearchResults.memories
        .slice(0, 5)
        .map((m, i) => {
          const score = results.semanticSearchResults.scores[i];
          const date = new Date(m.createdAt).toLocaleDateString("fr-FR");
          return `[${date}] (relevance: ${(score * 100).toFixed(0)}%) ${m.content.substring(0, 200)}`;
        })
        .join("\n");
      
      parts.push(`MÉMOIRES PERTINENTES:\n${memoryContext}`);
    }

    // Add user context (topics/entities)
    if (results.userContext) {
      if (results.userContext.recentTopics.length > 0) {
        parts.push(`SUJETS RÉCENTS: ${results.userContext.recentTopics.slice(0, 5).join(", ")}`);
      }
      if (results.userContext.frequentEntities.length > 0) {
        parts.push(`ENTITÉS FRÉQUENTES: ${results.userContext.frequentEntities.slice(0, 5).join(", ")}`);
      }
    }

    // Add conversation context summary
    if (results.conversationContext && results.conversationContext.recentMessages.length > 0) {
      const recentSummary = results.conversationContext.recentMessages
        .slice(-3)
        .map(m => `${m.role}: ${m.content.substring(0, 100)}...`)
        .join("\n");
      parts.push(`CONVERSATION RÉCENTE:\n${recentSummary}`);
    }

    return parts.join("\n\n");
  }

  /**
   * Update caches after a successful interaction
   */
  async updateAfterInteraction(
    userId: string,
    userMessage: string,
    assistantResponse: string,
    topics?: string[]
  ): Promise<void> {
    // Update conversation context
    responseCacheService.updateConversationContext(
      userId,
      { role: "user", content: userMessage },
      topics
    );
    responseCacheService.updateConversationContext(
      userId,
      { role: "assistant", content: assistantResponse }
    );

    // Trigger async context update (don't await)
    precomputedMemoryIndex.getOrComputeContext(userId).catch(() => {});
  }
}

// Export singleton instance
export const parallelProcessor = new ParallelProcessorService();
