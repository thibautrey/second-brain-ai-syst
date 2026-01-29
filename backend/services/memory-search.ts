/**
 * Memory Search Service
 *
 * Provides semantic search capabilities using Weaviate vector database
 * with fallback to PostgreSQL text search.
 *
 * Uses Weaviate REST API via axios for simplicity.
 * API keys are fetched dynamically from user settings and passed via headers.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import prisma from "./prisma.js";
import { Memory, Prisma } from "@prisma/client";
import { getConfiguredModelForTask } from "../controllers/ai-settings.controller.js";

interface SemanticSearchResult {
  memory: Memory;
  score: number;
  distance: number;
}

interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  query: string;
  total: number;
  searchType: "semantic" | "text";
}

class MemorySearchService {
  private weaviateClient: AxiosInstance | null = null;
  private isWeaviateAvailable = false;
  private readonly COLLECTION_NAME = "Memory";
  private weaviateUrl: string;
  private initializationPromise: Promise<void> | null = null;
  private readonly MAX_RETRIES = 15;
  private readonly RETRY_DELAY_MS = 5000;

  constructor() {
    this.weaviateUrl = process.env.WEAVIATE_URL || "http://localhost:8080";
    this.initializationPromise = this.initializeWeaviateWithRetry();
  }

  /**
   * Wait for Weaviate initialization to complete
   */
  async waitForReady(): Promise<boolean> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    return this.isWeaviateAvailable;
  }

  /**
   * Initialize Weaviate client with retry mechanism
   */
  private async initializeWeaviateWithRetry(): Promise<void> {
    this.weaviateClient = axios.create({
      baseURL: this.weaviateUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.initializeWeaviate();
        if (this.isWeaviateAvailable) {
          return;
        }
      } catch (error) {
        console.warn(
          `⚠ Weaviate connection attempt ${attempt}/${this.MAX_RETRIES} failed`,
        );
      }

      if (attempt < this.MAX_RETRIES) {
        console.log(`  Retrying in ${this.RETRY_DELAY_MS / 1000}s...`);
        await this.sleep(this.RETRY_DELAY_MS);
      }
    }

    console.warn(
      "⚠ Weaviate not available after all retries, using text search fallback",
    );
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Initialize Weaviate client
   */
  private async initializeWeaviate(): Promise<void> {
    if (!this.weaviateClient) return;

    try {
      // Test connection
      const response = await this.weaviateClient.get("/v1/meta");
      console.log("✓ Weaviate connected:", response.data.version);
      this.isWeaviateAvailable = true;

      // Ensure collection exists
      await this.ensureCollection();
    } catch (error: any) {
      const errorMessage =
        error.code === "ECONNABORTED" ? "timeout" : error.message;
      console.warn(`⚠ Weaviate connection failed: ${errorMessage}`);
      this.isWeaviateAvailable = false;
      throw error;
    }
  }

  /**
   * Get embedding provider configuration for a user
   * Returns the API key, model, and baseUrl to use for vectorization
   */
  private async getEmbeddingConfig(
    userId: string,
  ): Promise<{ apiKey: string; model: string; baseUrl: string } | null> {
    try {
      const config = await getConfiguredModelForTask(userId, "embeddings");
      if (!config) {
        console.warn(`⚠ No embedding provider configured for user ${userId}`);
        return null;
      }

      // Default to OpenAI baseUrl if not specified (for OpenAI provider type)
      const baseUrl = config.provider.baseUrl || "https://api.openai.com/v1";

      return {
        apiKey: config.provider.apiKey,
        model: config.model.id,
        baseUrl: baseUrl,
      };
    } catch (error) {
      console.error("Failed to get embedding config:", error);
      return null;
    }
  }

  /**
   * Ensure the Memory collection exists in Weaviate
   * The collection is created with text2vec-openai vectorizer
   * API key will be provided at runtime via headers
   */
  private async ensureCollection(): Promise<void> {
    if (!this.weaviateClient) return;

    try {
      // Check if class exists
      const schemaResponse = await this.weaviateClient.get("/v1/schema");
      const classes = schemaResponse.data.classes || [];
      const collectionExists = classes.some(
        (c: any) => c.class === this.COLLECTION_NAME,
      );

      if (!collectionExists) {
        // Create collection with manual vectorization (none)
        // Embeddings will be provided explicitly at insertion time
        await this.weaviateClient.post("/v1/schema", {
          class: this.COLLECTION_NAME,
          vectorizer: "none",
          properties: [
            {
              name: "content",
              dataType: ["text"],
            },
            {
              name: "memoryId",
              dataType: ["text"],
              indexFilterable: true,
              indexSearchable: false,
            },
            {
              name: "userId",
              dataType: ["text"],
              indexFilterable: true,
              indexSearchable: false,
            },
            {
              name: "tags",
              dataType: ["text[]"],
            },
            {
              name: "createdAt",
              dataType: ["date"],
            },
          ],
        });
        console.log(
          "✓ Created Memory collection in Weaviate (manual vectorization)",
        );
      }
    } catch (error) {
      console.error("Failed to ensure Weaviate collection:", error);
    }
  }

  /**
   * Generate embedding vector for text using configured provider
   */
  private async generateEmbedding(
    text: string,
    apiKey: string,
    model: string,
    baseUrl: string,
  ): Promise<number[]> {
    try {
      // Ensure baseUrl ends with /v1 if not already present
      const normalizedBaseUrl = baseUrl.endsWith("/v1")
        ? baseUrl
        : `${baseUrl}/v1`;
      const endpoint = `${normalizedBaseUrl}/embeddings`;

      const response = await axios.post(
        endpoint,
        {
          input: text,
          model: model,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      return response.data.data[0].embedding;
    } catch (error: any) {
      console.error(
        "Failed to generate embedding:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Index a memory in Weaviate
   * Generates embedding via configured provider and stores with manual vector
   */
  async indexMemory(memory: Memory): Promise<void> {
    if (!this.weaviateClient || !this.isWeaviateAvailable) return;

    // Get embedding config for the user
    const embeddingConfig = await this.getEmbeddingConfig(memory.userId);
    if (!embeddingConfig) {
      console.warn(
        `⚠ Cannot index memory ${memory.id}: no embedding provider configured`,
      );
      return;
    }

    try {
      // Generate embedding vector
      const vector = await this.generateEmbedding(
        memory.content,
        embeddingConfig.apiKey,
        embeddingConfig.model,
        embeddingConfig.baseUrl,
      );

      // Store in Weaviate with explicit vector
      await this.weaviateClient.post(`/v1/objects`, {
        class: this.COLLECTION_NAME,
        properties: {
          content: memory.content,
          memoryId: memory.id,
          userId: memory.userId,
          tags: memory.tags,
          createdAt: memory.createdAt.toISOString(),
        },
        vector: vector,
      });
    } catch (error: any) {
      // Log detailed error from Weaviate
      const weaviateError = error.response?.data?.error || error.response?.data;
      console.error(
        "Failed to index memory in Weaviate:",
        weaviateError || error.message,
      );
    }
  }

  /**
   * Delete a memory from Weaviate
   */
  async deleteMemory(memoryId: string): Promise<void> {
    if (!this.weaviateClient || !this.isWeaviateAvailable) return;

    try {
      // Find and delete the object by memoryId using GraphQL
      const query = {
        query: `{
          Get {
            ${this.COLLECTION_NAME}(
              where: {
                path: ["memoryId"],
                operator: Equal,
                valueText: "${memoryId}"
              }
            ) {
              _additional { id }
            }
          }
        }`,
      };

      const response = await this.weaviateClient.post("/v1/graphql", query);
      const objects = response.data?.data?.Get?.[this.COLLECTION_NAME] || [];

      for (const obj of objects) {
        if (obj._additional?.id) {
          await this.weaviateClient.delete(
            `/v1/objects/${this.COLLECTION_NAME}/${obj._additional.id}`,
          );
        }
      }
    } catch (error) {
      console.error("Failed to delete memory from Weaviate:", error);
    }
  }

  /**
   * Perform semantic search
   * Generates embedding for query and uses nearVector search
   */
  async semanticSearch(
    userId: string,
    query: string,
    limit: number = 20,
  ): Promise<SemanticSearchResponse> {
    // Try Weaviate semantic search first
    if (this.weaviateClient && this.isWeaviateAvailable) {
      // Get embedding config for the user
      const embeddingConfig = await this.getEmbeddingConfig(userId);
      if (!embeddingConfig) {
        console.warn(
          `⚠ No embedding provider configured, falling back to text search`,
        );
        return this.textSearch(userId, query, limit);
      }

      try {
        // Generate embedding vector for the query
        const queryVector = await this.generateEmbedding(
          query,
          embeddingConfig.apiKey,
          embeddingConfig.model,
          embeddingConfig.baseUrl,
        );

        const graphqlQuery = {
          query: `{
            Get {
              ${this.COLLECTION_NAME}(
                nearVector: {
                  vector: [${queryVector.join(",")}]
                }
                where: {
                  path: ["userId"],
                  operator: Equal,
                  valueText: "${userId}"
                }
                limit: ${limit}
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

        const response = await this.weaviateClient.post(
          "/v1/graphql",
          graphqlQuery,
        );
        const weaviateResults =
          response.data?.data?.Get?.[this.COLLECTION_NAME] || [];

        if (weaviateResults.length > 0) {
          // Fetch full memory objects from PostgreSQL
          const memoryIds = weaviateResults.map((r: any) => r.memoryId);
          const memories = await prisma.memory.findMany({
            where: {
              id: { in: memoryIds },
              userId,
              isArchived: false,
            },
          });

          // Create a map for quick lookup
          const memoryMap = new Map(memories.map((m) => [m.id, m]));

          // Build results with scores, preserving order from Weaviate
          const results: SemanticSearchResult[] = weaviateResults
            .map((r: any) => {
              const memory = memoryMap.get(r.memoryId);
              if (!memory) return null;
              return {
                memory,
                score: r._additional?.certainty || 0,
                distance: r._additional?.distance || 0,
              };
            })
            .filter((r: any): r is SemanticSearchResult => r !== null);

          return {
            results,
            query,
            total: results.length,
            searchType: "semantic",
          };
        }
      } catch (error) {
        console.error(
          "Weaviate search failed, falling back to text search:",
          error,
        );
      }
    }

    // Fallback to PostgreSQL text search
    return this.textSearch(userId, query, limit);
  }

  /**
   * Fallback text search using PostgreSQL
   */
  async textSearch(
    userId: string,
    query: string,
    limit: number = 20,
  ): Promise<SemanticSearchResponse> {
    const memories = await prisma.memory.findMany({
      where: {
        userId,
        isArchived: false,
        content: {
          contains: query,
          mode: "insensitive",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    const results: SemanticSearchResult[] = memories.map((memory) => ({
      memory,
      score: 1.0, // Fixed score for text search
      distance: 0,
    }));

    return {
      results,
      query,
      total: results.length,
      searchType: "text",
    };
  }

  /**
   * Reindex all memories for a user
   * Requires embedding provider to be configured
   */
  async reindexUserMemories(
    userId: string,
  ): Promise<{ indexed: number; error?: string }> {
    if (!this.weaviateClient || !this.isWeaviateAvailable) {
      return { indexed: 0, error: "Weaviate not available" };
    }

    // Check if embedding provider is configured
    const embeddingConfig = await this.getEmbeddingConfig(userId);
    if (!embeddingConfig) {
      return {
        indexed: 0,
        error:
          "No embedding provider configured. Please configure an embedding provider in Settings.",
      };
    }

    const memories = await prisma.memory.findMany({
      where: { userId, isArchived: false },
    });

    let indexed = 0;
    for (const memory of memories) {
      try {
        await this.indexMemory(memory);
        indexed++;
      } catch (error) {
        console.error(`Failed to index memory ${memory.id}:`, error);
      }
    }

    return { indexed };
  }

  /**
   * Check if semantic search is available
   */
  isSemanticSearchAvailable(): boolean {
    return this.isWeaviateAvailable;
  }

  /**
   * Check if a user has embedding provider configured
   */
  async hasEmbeddingConfigured(userId: string): Promise<boolean> {
    const config = await this.getEmbeddingConfig(userId);
    return config !== null;
  }
}

// Singleton instance
export const memorySearchService = new MemorySearchService();
