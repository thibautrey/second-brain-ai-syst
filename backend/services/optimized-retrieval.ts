/**
 * Optimized Weaviate Retrieval Service
 *
 * Provides optimized queries for Weaviate vector database:
 * - Pre-filtered searches with importance threshold
 * - Time-filtered searches for temporal queries
 * - Cached embedding generation
 * - Batch operations
 *
 * Designed to minimize latency while maximizing relevance
 */

import axios, { AxiosInstance } from "axios";
import prisma from "./prisma.js";
import { Memory } from "@prisma/client";
import { responseCacheService } from "./response-cache.js";
import { getConfiguredModelForTask } from "../controllers/ai-settings.controller.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const RETRIEVAL_CONFIG = {
  // Default limits
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50,

  // Certainty thresholds
  HIGH_CERTAINTY: 0.85,
  MEDIUM_CERTAINTY: 0.7,
  LOW_CERTAINTY: 0.5,

  // Importance thresholds
  HIGH_IMPORTANCE: 0.7,
  MEDIUM_IMPORTANCE: 0.4,

  // Time windows (in days)
  RECENT_WINDOW: 7,
  MEDIUM_WINDOW: 30,
  LONG_WINDOW: 90,
};

// ============================================================================
// TYPES
// ============================================================================

interface OptimizedSearchOptions {
  // Relevance filters
  minCertainty?: number;
  minImportance?: number;

  // Time filters
  daysBack?: number;
  startDate?: Date;
  endDate?: Date;

  // Content filters
  tags?: string[];
  excludeTags?: string[];

  // Result options
  limit?: number;
  includeContent?: boolean;
  includeMetadata?: boolean;
}

interface SearchResult {
  memoryId: string;
  content: string;
  certainty: number;
  distance: number;
  importanceScore: number;
  createdAt: Date;
  tags: string[];
}

interface BatchSearchQuery {
  query: string;
  options?: OptimizedSearchOptions;
}

interface BatchSearchResult {
  query: string;
  results: SearchResult[];
  searchTime: number;
}

// ============================================================================
// OPTIMIZED RETRIEVAL SERVICE
// ============================================================================

class OptimizedRetrievalService {
  private weaviateClient: AxiosInstance | null = null;
  private isAvailable = false;
  private readonly COLLECTION_NAME = "Memory";
  private weaviateUrl: string;

  constructor() {
    this.weaviateUrl = process.env.WEAVIATE_URL || "http://localhost:8080";
    this.initializeClient();
  }

  /**
   * Initialize Weaviate client
   */
  private async initializeClient(): Promise<void> {
    this.weaviateClient = axios.create({
      baseURL: this.weaviateUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    try {
      const response = await this.weaviateClient.get("/v1/meta");
      this.isAvailable = true;
      console.log(
        "✓ OptimizedRetrieval connected to Weaviate:",
        response.data.version,
      );
    } catch (error) {
      console.warn("⚠ OptimizedRetrieval: Weaviate not available");
      this.isAvailable = false;
    }
  }

  /**
   * Get embedding config for user (with caching)
   */
  private async getEmbeddingConfig(
    userId: string,
  ): Promise<{ apiKey: string; model: string; baseUrl: string } | null> {
    try {
      const config = await getConfiguredModelForTask(userId, "embeddings");
      if (!config) return null;

      return {
        apiKey: config.provider.apiKey,
        model: config.model.id,
        baseUrl: config.provider.baseUrl || "https://api.openai.com/v1",
      } as { apiKey: string; model: string; baseUrl: string };
    } catch {
      return null;
    }
  }

  /**
   * Generate embedding with caching
   */
  private async generateEmbedding(
    text: string,
    apiKey: string,
    model: string,
    baseUrl: string,
  ): Promise<number[]> {
    // Check cache first
    const cached = responseCacheService.getCachedEmbedding(text);
    if (cached) {
      return cached;
    }

    // Generate new embedding
    const normalizedBaseUrl = baseUrl.endsWith("/v1")
      ? baseUrl
      : `${baseUrl}/v1`;
    const response = await axios.post(
      `${normalizedBaseUrl}/embeddings`,
      { input: text, model },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    const vector = response.data.data[0].embedding;

    // Cache it
    responseCacheService.cacheEmbedding(text, vector);

    return vector;
  }

  /**
   * Fast search with pre-filtering by importance
   * Only retrieves high-relevance memories
   */
  async fastSearch(
    userId: string,
    query: string,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    return this.search(userId, query, {
      minCertainty: RETRIEVAL_CONFIG.MEDIUM_CERTAINTY,
      minImportance: RETRIEVAL_CONFIG.MEDIUM_IMPORTANCE,
      limit,
    });
  }

  /**
   * Full optimized search with all options
   */
  async search(
    userId: string,
    query: string,
    options: OptimizedSearchOptions = {},
  ): Promise<SearchResult[]> {
    if (!this.weaviateClient || !this.isAvailable) {
      return this.fallbackSearch(userId, query, options);
    }

    const embeddingConfig = await this.getEmbeddingConfig(userId);
    if (!embeddingConfig) {
      return this.fallbackSearch(userId, query, options);
    }

    try {
      // Generate query embedding
      const queryVector = await this.generateEmbedding(
        query,
        embeddingConfig.apiKey,
        embeddingConfig.model,
        embeddingConfig.baseUrl,
      );

      // Build where filter
      const whereFilter = this.buildWhereFilter(userId, options);

      // Build GraphQL query
      const graphqlQuery = this.buildGraphQLQuery(
        queryVector,
        whereFilter,
        options.minCertainty ?? RETRIEVAL_CONFIG.LOW_CERTAINTY,
        options.limit ?? RETRIEVAL_CONFIG.DEFAULT_LIMIT,
      );

      const response = await this.weaviateClient.post(
        "/v1/graphql",
        graphqlQuery,
      );
      const weaviateResults =
        response.data?.data?.Get?.[this.COLLECTION_NAME] || [];

      if (weaviateResults.length === 0) {
        return [];
      }

      // Fetch full memory data from PostgreSQL
      return this.enrichResults(userId, weaviateResults, options);
    } catch (error) {
      console.error("Optimized search failed:", error);
      return this.fallbackSearch(userId, query, options);
    }
  }

  /**
   * Time-filtered search for temporal queries
   */
  async timeFilteredSearch(
    userId: string,
    query: string,
    daysBack: number,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    return this.search(userId, query, {
      daysBack,
      limit,
      minCertainty: RETRIEVAL_CONFIG.LOW_CERTAINTY,
    });
  }

  /**
   * Search within a specific date range
   */
  async dateRangeSearch(
    userId: string,
    query: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    return this.search(userId, query, {
      startDate,
      endDate,
      limit,
    });
  }

  /**
   * High-importance search (only top memories)
   */
  async importantMemoriesSearch(
    userId: string,
    query: string,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    return this.search(userId, query, {
      minImportance: RETRIEVAL_CONFIG.HIGH_IMPORTANCE,
      minCertainty: RETRIEVAL_CONFIG.HIGH_CERTAINTY,
      limit,
    });
  }

  /**
   * Tag-filtered search
   */
  async tagSearch(
    userId: string,
    query: string,
    tags: string[],
    limit: number = 10,
  ): Promise<SearchResult[]> {
    return this.search(userId, query, {
      tags,
      limit,
    });
  }

  /**
   * Batch search - multiple queries in parallel
   */
  async batchSearch(
    userId: string,
    queries: BatchSearchQuery[],
  ): Promise<BatchSearchResult[]> {
    const results = await Promise.all(
      queries.map(async ({ query, options }) => {
        const startTime = Date.now();
        const searchResults = await this.search(userId, query, options);
        return {
          query,
          results: searchResults,
          searchTime: Date.now() - startTime,
        };
      }),
    );

    return results;
  }

  /**
   * Recent context search - optimized for getting recent relevant context
   */
  async recentContextSearch(
    userId: string,
    query: string,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    return this.search(userId, query, {
      daysBack: RETRIEVAL_CONFIG.RECENT_WINDOW,
      minCertainty: RETRIEVAL_CONFIG.LOW_CERTAINTY,
      limit,
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Build Weaviate where filter
   */
  private buildWhereFilter(
    userId: string,
    options: OptimizedSearchOptions,
  ): string {
    const conditions: string[] = [];

    // Always filter by user
    conditions.push(`{
      path: ["userId"],
      operator: Equal,
      valueText: "${userId}"
    }`);

    // Time filter
    if (options.daysBack) {
      const cutoff = new Date(
        Date.now() - options.daysBack * 24 * 60 * 60 * 1000,
      );
      conditions.push(`{
        path: ["createdAt"],
        operator: GreaterThan,
        valueDate: "${cutoff.toISOString()}"
      }`);
    }

    if (options.startDate) {
      conditions.push(`{
        path: ["createdAt"],
        operator: GreaterThanEqual,
        valueDate: "${options.startDate.toISOString()}"
      }`);
    }

    if (options.endDate) {
      conditions.push(`{
        path: ["createdAt"],
        operator: LessThanEqual,
        valueDate: "${options.endDate.toISOString()}"
      }`);
    }

    // Tag filters
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        conditions.push(`{
          path: ["tags"],
          operator: ContainsAny,
          valueText: ["${tag}"]
        }`);
      }
    }

    // Build combined filter
    if (conditions.length === 1) {
      return conditions[0];
    }

    return `{
      operator: And,
      operands: [${conditions.join(", ")}]
    }`;
  }

  /**
   * Build GraphQL query for Weaviate
   */
  private buildGraphQLQuery(
    vector: number[],
    whereFilter: string,
    certainty: number,
    limit: number,
  ): { query: string } {
    return {
      query: `{
        Get {
          ${this.COLLECTION_NAME}(
            nearVector: {
              vector: [${vector.join(",")}]
              certainty: ${certainty}
            }
            where: ${whereFilter}
            limit: ${Math.min(limit, RETRIEVAL_CONFIG.MAX_LIMIT)}
          ) {
            content
            memoryId
            userId
            tags
            createdAt
            _additional {
              distance
              certainty
            }
          }
        }
      }`,
    };
  }

  /**
   * Enrich Weaviate results with PostgreSQL data
   */
  private async enrichResults(
    userId: string,
    weaviateResults: any[],
    options: OptimizedSearchOptions,
  ): Promise<SearchResult[]> {
    const memoryIds = weaviateResults.map((r: any) => r.memoryId);

    // Build where clause for importance filter
    const whereClause: any = {
      id: { in: memoryIds },
      userId,
      isArchived: false,
    };

    if (options.minImportance !== undefined) {
      whereClause.importanceScore = { gte: options.minImportance };
    }

    const memories = await prisma.memory.findMany({
      where: whereClause,
      select: {
        id: true,
        content: options.includeContent !== false,
        importanceScore: true,
        createdAt: true,
        tags: true,
      },
    });

    const memoryMap = new Map(memories.map((m) => [m.id, m]));

    // Build results preserving Weaviate ordering
    return weaviateResults
      .map((r: any) => {
        const memory = memoryMap.get(r.memoryId);
        if (!memory) return null;

        return {
          memoryId: r.memoryId,
          content: memory.content || r.content,
          certainty: r._additional?.certainty || 0,
          distance: r._additional?.distance || 0,
          importanceScore: memory.importanceScore,
          createdAt: memory.createdAt,
          tags: memory.tags,
        };
      })
      .filter((r): r is SearchResult => r !== null);
  }

  /**
   * Fallback to PostgreSQL text search
   */
  private async fallbackSearch(
    userId: string,
    query: string,
    options: OptimizedSearchOptions,
  ): Promise<SearchResult[]> {
    const whereClause: any = {
      userId,
      isArchived: false,
      content: {
        contains: query,
        mode: "insensitive",
      },
    };

    if (options.minImportance !== undefined) {
      whereClause.importanceScore = { gte: options.minImportance };
    }

    if (options.daysBack) {
      whereClause.createdAt = {
        gte: new Date(Date.now() - options.daysBack * 24 * 60 * 60 * 1000),
      };
    }

    if (options.startDate || options.endDate) {
      whereClause.createdAt = {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate }),
      };
    }

    if (options.tags && options.tags.length > 0) {
      whereClause.tags = { hasSome: options.tags };
    }

    const memories = await prisma.memory.findMany({
      where: whereClause,
      orderBy: [{ importanceScore: "desc" }, { createdAt: "desc" }],
      take: options.limit ?? RETRIEVAL_CONFIG.DEFAULT_LIMIT,
    });

    return memories.map((m) => ({
      memoryId: m.id,
      content: m.content,
      certainty: 1.0,
      distance: 0,
      importanceScore: m.importanceScore,
      createdAt: m.createdAt,
      tags: m.tags,
    }));
  }

  /**
   * Check if service is available
   */
  isServiceAvailable(): boolean {
    return this.isAvailable;
  }
}

// Export singleton instance
export const optimizedRetrieval = new OptimizedRetrievalService();
