/**
 * Embedding Service Wrapper
 *
 * Communicates with the Python embedding service via HTTP.
 * Handles automatic startup and health checks.
 *
 * Optimizations:
 * - Local cosine similarity computation (avoids HTTP round-trip)
 * - In-memory embedding cache for centroids
 * - Buffer-based extraction (no file I/O)
 * - Combined extract-and-compare endpoint
 */

import axios, { AxiosInstance } from "axios";
import { spawn } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface EmbeddingServiceConfig {
  host: string;
  port: number;
  pythonPath?: string;
  maxRetries?: number;
  retryDelay?: number;
  external?: boolean; // If true, don't spawn Python process (service runs externally, e.g., in Docker)
}

interface ExtractEmbeddingResponse {
  success: boolean;
  embedding: number[];
  dimension: number;
  model: string;
  preprocessing_applied?: boolean;
}

interface ExtractFromBufferResponse {
  success: boolean;
  embedding: number[];
  dimension: number;
  model: string;
  preprocessing_applied: boolean;
  audio_duration_s: number;
  processing_time_ms: number;
}

interface ExtractAndCompareResponse {
  success: boolean;
  embedding: number[];
  similarity: number;
  dimension: number;
  model: string;
  audio_duration_s: number;
  processing_time_ms: number;
}

interface BatchExtractResponse {
  success: boolean;
  total: number;
  processed: number;
  errors_count: number;
  embeddings: Array<{
    index: number;
    audio_path: string;
    embedding: number[];
    success: boolean;
  }>;
  errors: Array<{
    index: number;
    audio_path: string;
    error: string;
  }>;
  model: string;
}

interface ComputeSimilarityResponse {
  success: boolean;
  similarity: number;
}

interface ComputeCentroidResponse {
  success: boolean;
  centroid: number[];
  dimension: number;
  embedding_count: number;
}

// ==================== Embedding Cache ====================

interface CachedEmbedding {
  embedding: number[];
  cachedAt: number;
  source: string;
}

class EmbeddingCache {
  private cache: Map<string, CachedEmbedding> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 100, ttlMinutes: number = 60) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  set(key: string, embedding: number[], source: string = "unknown"): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      embedding,
      cachedAt: Date.now(),
      source,
    });
  }

  get(key: string): number[] | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.cachedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.embedding;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number; ttlMinutes: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMinutes: this.ttlMs / 60000,
    };
  }
}

// ==================== Local Similarity Computation ====================

/**
 * Compute cosine similarity locally (avoids HTTP round-trip)
 * This is ~100x faster than calling the Python service
 */
export function computeCosineSimilarityLocal(
  embedding1: number[],
  embedding2: number[],
): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error(
      `Embedding dimension mismatch: ${embedding1.length} vs ${embedding2.length}`,
    );
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator > 0 ? dotProduct / denominator : 0;
}

export class EmbeddingService {
  private config: Required<EmbeddingServiceConfig>;
  private client: AxiosInstance;
  private pythonProcess: any = null;
  private isReady = false;
  private centroidCache: EmbeddingCache;

  constructor(config: EmbeddingServiceConfig) {
    this.config = {
      pythonPath: "python3",
      maxRetries: 30,
      retryDelay: 1000,
      external: false,
      ...config,
    };

    this.client = axios.create({
      baseURL: `http://${this.config.host}:${this.config.port}`,
      timeout: 300000, // 5 minutes for model operations
    });

    // Initialize centroid cache (100 entries, 60 minute TTL)
    this.centroidCache = new EmbeddingCache(100, 60);
  }

  /**
   * Start the Python embedding service (or connect to external service)
   */
  async start(): Promise<void> {
    if (this.isReady) {
      console.log("✓ Embedding service already started");
      return;
    }

    // In external mode (Docker), just wait for the service to be ready
    if (this.config.external) {
      console.log(
        `🔗 Connecting to external embedding service at ${this.config.host}:${this.config.port}...`,
      );

      await this.waitForReady();
      console.log("✓ Connected to external embedding service");
      return;
    }

    console.log("🚀 Starting Python embedding service...");

    return new Promise((resolve, reject) => {
      const servicePath = join(__dirname, "embedding-service.py");

      this.pythonProcess = spawn(this.config.pythonPath!, [servicePath], {
        env: {
          ...process.env,
          EMBEDDING_SERVICE_PORT: String(this.config.port),
          PYTHONUNBUFFERED: "1",
          MODEL_CACHE_DIR: "./models",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Log Python service output
      if (this.pythonProcess.stdout) {
        this.pythonProcess.stdout.on("data", (data: Buffer) => {
          console.log(`[Embedding Service] ${data.toString().trim()}`);
        });
      }

      if (this.pythonProcess.stderr) {
        this.pythonProcess.stderr.on("data", (data: Buffer) => {
          console.error(`[Embedding Service] ${data.toString().trim()}`);
        });
      }

      this.pythonProcess.on("error", (err: Error) => {
        console.error("✗ Failed to start embedding service:", err);
        reject(err);
      });

      // Wait for service to be ready
      this.waitForReady()
        .then(() => {
          console.log("✓ Embedding service ready");
          resolve();
        })
        .catch((err) => {
          console.error("✗ Embedding service failed to become ready:", err);
          reject(err);
        });
    });
  }

  /**
   * Wait for the embedding service to be ready
   */
  private async waitForReady(): Promise<void> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.config.maxRetries!; i++) {
      try {
        const response = await this.client.get("/health");
        if (response.status === 200) {
          this.isReady = true;
          return;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.log(
          `[Retry ${i + 1}/${this.config.maxRetries}] Waiting for service...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelay),
        );
      }
    }

    throw new Error(
      `Embedding service failed to start after ${this.config.maxRetries} retries. Last error: ${lastError?.message}`,
    );
  }

  /**
   * Stop the Python embedding service
   */
  async stop(): Promise<void> {
    if (this.pythonProcess) {
      console.log("Stopping embedding service...");
      this.pythonProcess.kill();
      this.pythonProcess = null;
      this.isReady = false;
    }
  }

  /**
   * Extract embedding from a single audio file
   */
  async extractEmbedding(audioPath: string): Promise<number[]> {
    if (!this.isReady) {
      throw new Error("Embedding service is not ready");
    }

    try {
      const response = await this.client.post<ExtractEmbeddingResponse>(
        "/extract-embedding",
        {
          audio_path: audioPath,
        },
      );

      if (!response.data.success) {
        throw new Error("Failed to extract embedding");
      }

      return response.data.embedding;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        `Failed to extract embedding from ${audioPath}: ${message}`,
      );
    }
  }

  /**
   * Extract embeddings from multiple audio files
   */
  async batchExtractEmbeddings(audioPaths: string[]): Promise<
    Array<{
      index: number;
      audioPath: string;
      embedding: number[];
      success: boolean;
    }>
  > {
    if (!this.isReady) {
      throw new Error("Embedding service is not ready");
    }

    try {
      const response = await this.client.post<BatchExtractResponse>(
        "/batch-extract-embeddings",
        {
          audio_paths: audioPaths,
        },
      );

      if (!response.data.success && response.data.embeddings.length === 0) {
        // Log detailed error information
        console.error("Batch extraction failed. Error details:");
        console.error(`- Total files: ${response.data.total}`);
        console.error(`- Successfully processed: ${response.data.processed}`);
        console.error(`- Errors: ${response.data.errors_count}`);
        if (response.data.errors && response.data.errors.length > 0) {
          response.data.errors.forEach(
            (err: { index: number; audio_path: string; error: string }) => {
              console.error(`  [${err.index}] ${err.audio_path}: ${err.error}`);
            },
          );
        }
        throw new Error(
          `Batch extraction failed completely: ${response.data.errors_count} errors out of ${response.data.total} files`,
        );
      }

      return response.data.embeddings.map(
        (item: {
          index: number;
          audio_path: string;
          embedding: number[];
          success: boolean;
        }) => ({
          index: item.index,
          audioPath: item.audio_path,
          embedding: item.embedding,
          success: item.success,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Batch extraction failed: ${message}`);
    }
  }

  /**
   * Compute similarity between two embeddings
   */
  async computeSimilarity(
    embedding1: number[],
    embedding2: number[],
  ): Promise<number> {
    if (!this.isReady) {
      throw new Error("Embedding service is not ready");
    }

    try {
      const response = await this.client.post<ComputeSimilarityResponse>(
        "/compute-similarity",
        {
          embedding1,
          embedding2,
        },
      );

      if (!response.data.success) {
        throw new Error("Failed to compute similarity");
      }

      return response.data.similarity;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to compute similarity: ${message}`);
    }
  }

  /**
   * Compute centroid (mean) of multiple embeddings
   */
  async computeCentroid(embeddings: number[][]): Promise<number[]> {
    if (!this.isReady) {
      throw new Error("Embedding service is not ready");
    }

    try {
      const response = await this.client.post<ComputeCentroidResponse>(
        "/compute-centroid",
        {
          embeddings,
        },
      );

      if (!response.data.success) {
        throw new Error("Failed to compute centroid");
      }

      return response.data.centroid;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to compute centroid: ${message}`);
    }
  }

  // ==================== Optimized Methods ====================

  /**
   * Compute similarity locally (no HTTP call)
   * ~100x faster than calling the Python service
   */
  computeSimilarityLocal(embedding1: number[], embedding2: number[]): number {
    return computeCosineSimilarityLocal(embedding1, embedding2);
  }

  /**
   * Extract embedding directly from audio buffer (no file I/O)
   * Much faster for real-time streaming scenarios
   */
  async extractEmbeddingFromBuffer(
    audioBuffer: Buffer,
    options: {
      sampleRate?: number;
      applyPreprocessing?: boolean;
    } = {},
  ): Promise<{
    embedding: number[];
    processingTimeMs: number;
    audioDurationS: number;
  }> {
    if (!this.isReady) {
      throw new Error("Embedding service is not ready");
    }

    const { sampleRate = 16000, applyPreprocessing = true } = options;

    try {
      const response = await this.client.post<ExtractFromBufferResponse>(
        "/extract-embedding-buffer",
        {
          audio_base64: audioBuffer.toString("base64"),
          sample_rate: sampleRate,
          apply_preprocessing: applyPreprocessing,
        },
      );

      if (!response.data.success) {
        throw new Error("Failed to extract embedding from buffer");
      }

      return {
        embedding: response.data.embedding,
        processingTimeMs: response.data.processing_time_ms,
        audioDurationS: response.data.audio_duration_s,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to extract embedding from buffer: ${message}`);
    }
  }

  /**
   * Extract embedding AND compute similarity in one HTTP call
   * Optimized for speaker identification - reduces round trips
   */
  async extractAndCompare(
    audioBuffer: Buffer,
    centroidEmbedding: number[],
    options: {
      sampleRate?: number;
      applyPreprocessing?: boolean;
    } = {},
  ): Promise<{
    embedding: number[];
    similarity: number;
    processingTimeMs: number;
    audioDurationS: number;
  }> {
    if (!this.isReady) {
      throw new Error("Embedding service is not ready");
    }

    const { sampleRate = 16000, applyPreprocessing = true } = options;

    try {
      const response = await this.client.post<ExtractAndCompareResponse>(
        "/extract-embedding-and-compare",
        {
          audio_base64: audioBuffer.toString("base64"),
          centroid_embedding: centroidEmbedding,
          sample_rate: sampleRate,
          apply_preprocessing: applyPreprocessing,
        },
      );

      if (!response.data.success) {
        throw new Error("Failed to extract and compare");
      }

      return {
        embedding: response.data.embedding,
        similarity: response.data.similarity,
        processingTimeMs: response.data.processing_time_ms,
        audioDurationS: response.data.audio_duration_s,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to extract and compare: ${message}`);
    }
  }

  // ==================== Centroid Cache Methods ====================

  /**
   * Get cached centroid embedding for a speaker profile
   */
  getCachedCentroid(profileId: string): number[] | null {
    return this.centroidCache.get(profileId);
  }

  /**
   * Cache centroid embedding for a speaker profile
   */
  cacheCentroid(
    profileId: string,
    centroid: number[],
    source: string = "manual",
  ): void {
    this.centroidCache.set(profileId, centroid, source);
    console.log(`[EmbeddingCache] Cached centroid for profile ${profileId}`);
  }

  /**
   * Invalidate cached centroid (e.g., when profile is updated)
   */
  invalidateCentroid(profileId: string): boolean {
    const deleted = this.centroidCache.delete(profileId);
    if (deleted) {
      console.log(
        `[EmbeddingCache] Invalidated centroid for profile ${profileId}`,
      );
    }
    return deleted;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttlMinutes: number } {
    return this.centroidCache.getStats();
  }

  /**
   * Check if service is ready
   */
  isServiceReady(): boolean {
    return this.isReady;
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<any> {
    try {
      const response = await this.client.get("/health");
      return {
        ...response.data,
        cache: this.getCacheStats(),
      };
    } catch (error) {
      return { status: "unhealthy", error: String(error) };
    }
  }
}

// Singleton instance
let instance: EmbeddingService | null = null;

/**
 * Get or create the embedding service singleton
 */
export async function getEmbeddingService(
  config?: EmbeddingServiceConfig,
): Promise<EmbeddingService> {
  if (!instance) {
    // Detect if running in Docker (external service mode)
    // If EMBEDDING_SERVICE_HOST is set to something other than localhost, assume external
    const host = process.env.EMBEDDING_SERVICE_HOST || "localhost";
    const isExternal = host !== "localhost" && host !== "127.0.0.1";

    instance = new EmbeddingService(
      config || {
        host: host,
        port: parseInt(process.env.EMBEDDING_SERVICE_PORT || "5001"),
        external: isExternal,
      },
    );

    // Start the service
    await instance.start();
  }

  return instance;
}

/**
 * Shutdown the embedding service
 */
export async function shutdownEmbeddingService(): Promise<void> {
  if (instance) {
    await instance.stop();
    instance = null;
  }
}
