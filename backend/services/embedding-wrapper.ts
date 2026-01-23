/**
 * Embedding Service Wrapper
 *
 * Communicates with the Python embedding service via HTTP.
 * Handles automatic startup and health checks.
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
}

interface ExtractEmbeddingResponse {
  success: boolean;
  embedding: number[];
  dimension: number;
  model: string;
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

export class EmbeddingService {
  private config: Required<EmbeddingServiceConfig>;
  private client: AxiosInstance;
  private pythonProcess: any = null;
  private isReady = false;

  constructor(config: EmbeddingServiceConfig) {
    this.config = {
      pythonPath: "python3",
      maxRetries: 30,
      retryDelay: 1000,
      ...config,
    };

    this.client = axios.create({
      baseURL: `http://${this.config.host}:${this.config.port}`,
      timeout: 300000, // 5 minutes for model operations
    });
  }

  /**
   * Start the Python embedding service
   */
  async start(): Promise<void> {
    if (this.isReady) {
      console.log("✓ Embedding service already started");
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
      return response.data;
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
    instance = new EmbeddingService(
      config || {
        host: process.env.EMBEDDING_SERVICE_HOST || "localhost",
        port: parseInt(process.env.EMBEDDING_SERVICE_PORT || "5001"),
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
