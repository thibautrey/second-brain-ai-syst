/**
 * Background Training Processor Service
 *
 * Handles asynchronous processing of training sessions.
 * Polls for pending sessions and processes them in background.
 */

import prisma from "./prisma.js";
import { SpeakerRecognitionService } from "./speaker-recognition.js";
import { getEmbeddingService } from "./embedding-wrapper.js";

interface TrainingState {
  isProcessing: boolean;
  activeSessionId: string | null;
  processingIntervalId: NodeJS.Timeout | null;
}

export class TrainingProcessorService {
  private state: TrainingState = {
    isProcessing: false,
    activeSessionId: null,
    processingIntervalId: null,
  };

  constructor(private speakerService: SpeakerRecognitionService) {}

  /**
   * Initialize the training processor (starts embedding service)
   */
  async initialize(): Promise<void> {
    try {
      console.log("Initializing embedding service...");
      await getEmbeddingService();
      console.log("✓ Embedding service initialized");
    } catch (error) {
      console.error("✗ Failed to initialize embedding service:", error);
      throw error;
    }
  }

  /**
   * Start the background training processor
   * Polls for pending training sessions every 5 seconds
   */
  startProcessor(intervalMs: number = 5000): void {
    if (this.state.processingIntervalId) {
      console.log("Training processor already running");
      return;
    }

    console.log("✓ Starting training processor");

    this.state.processingIntervalId = setInterval(async () => {
      try {
        await this.processPendingSessions();
      } catch (error) {
        console.error("Error in training processor:", error);
      }
    }, intervalMs);
  }

  /**
   * Stop the background training processor
   */
  stopProcessor(): void {
    if (this.state.processingIntervalId) {
      clearInterval(this.state.processingIntervalId);
      this.state.processingIntervalId = null;
      console.log("✓ Training processor stopped");
    }
  }

  /**
   * Process all pending training sessions
   */
  private async processPendingSessions(): Promise<void> {
    // Don't start a new session if one is already processing
    if (this.state.isProcessing && this.state.activeSessionId) {
      return;
    }

    try {
      // Get first pending session
      const pendingSession = await prisma.trainingSession.findFirst({
        where: {
          status: "pending",
        },
        include: {
          speakerProfile: {
            include: {
              voiceSamples: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (!pendingSession) {
        return; // No pending sessions
      }

      this.state.isProcessing = true;
      this.state.activeSessionId = pendingSession.id;

      console.log(`Processing training session: ${pendingSession.id}`);

      // Mark as in-progress
      await prisma.trainingSession.update({
        where: { id: pendingSession.id },
        data: {
          status: "in-progress",
          startedAt: new Date(),
          progress: 5,
          currentStep: "initializing",
        },
      });

      const voiceSamples = pendingSession.speakerProfile.voiceSamples;

      if (voiceSamples.length === 0) {
        throw new Error("No voice samples available for training");
      }

      // Step 1: Prepare audio paths (15% progress)
      await this.updateProgress(pendingSession.id, 15, "preparing-samples");

      const audioPaths = voiceSamples
        .map((sample) => sample.storagePath)
        .filter((path) => path && path.length > 0);

      if (audioPaths.length === 0) {
        throw new Error("No valid audio file paths available for training");
      }

      console.log(
        `Processing ${audioPaths.length} audio samples for training session ${pendingSession.id}`,
      );

      // Step 2: Extract embeddings using ECAPA-TDNN (40% progress)
      await this.updateProgress(pendingSession.id, 40, "extracting-embeddings");

      const embeddingService = await getEmbeddingService();
      const embeddings: number[][] = [];

      try {
        // Extract embeddings in batch for efficiency
        const batchResults =
          await embeddingService.batchExtractEmbeddings(audioPaths);

        for (const result of batchResults) {
          if (result.success) {
            embeddings.push(result.embedding);
            console.log(
              `✓ Extracted embedding from sample ${result.index + 1}/${audioPaths.length}`,
            );
          } else {
            console.warn(
              `✗ Failed to extract embedding from ${result.audioPath}`,
            );
          }
        }
      } catch (error) {
        console.error("Failed to extract embeddings:", error);
        throw new Error(
          `Embedding extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (embeddings.length === 0) {
        throw new Error("Failed to extract embeddings from any audio samples");
      }

      console.log(
        `✓ Successfully extracted ${embeddings.length} embeddings (dimension: ${embeddings[0].length})`,
      );

      if (embeddings.length === 0) {
        throw new Error("Failed to extract embeddings from any samples");
      }

      // Step 3: Compute centroid (60% progress)
      await this.updateProgress(pendingSession.id, 60, "computing-centroid");

      let centroidEmbedding: number[] = [];
      try {
        const embeddingService = await getEmbeddingService();
        centroidEmbedding = await embeddingService.computeCentroid(embeddings);
        console.log(
          `✓ Computed centroid (dimension: ${centroidEmbedding.length})`,
        );
      } catch (error) {
        console.error("Failed to compute centroid, using fallback:", error);
        // Fallback to local computation if service fails
        centroidEmbedding = this.computeCentroid(embeddings);
      }

      // Step 4: Compute statistics (80% progress)
      await this.updateProgress(pendingSession.id, 80, "computing-statistics");

      const intraClassVariance = this.computeVariance(
        embeddings,
        centroidEmbedding,
      );
      const confidenceScore = Math.min(
        1.0,
        Math.max(0.5, 1.0 - intraClassVariance / 100),
      );

      // Step 5: Save results (90% progress)
      await this.updateProgress(pendingSession.id, 90, "saving-results");

      // Save centroid embedding to speaker profile
      await prisma.speakerProfile.update({
        where: { id: pendingSession.speakerProfileId },
        data: {
          centroidEmbedding: centroidEmbedding,
          isEnrolled: true,
          enrollmentDate: new Date(),
        },
      });

      // Update training session with results
      await prisma.trainingSession.update({
        where: { id: pendingSession.id },
        data: {
          status: "completed",
          progress: 100,
          currentStep: "completed",
          completedAt: new Date(),
          centroidEmbedding: centroidEmbedding,
          confidenceScore: confidenceScore,
          intraClassVariance: intraClassVariance,
        },
      });

      console.log(
        `✓ Training session completed: ${pendingSession.id} (confidence: ${(confidenceScore * 100).toFixed(1)}%)`,
      );
    } catch (error) {
      // Mark session as failed
      if (this.state.activeSessionId) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await prisma.trainingSession.update({
          where: { id: this.state.activeSessionId },
          data: {
            status: "failed",
            errorMessage: errorMessage,
            progress: 0,
          },
        });

        console.error(
          `✗ Training session failed: ${this.state.activeSessionId}`,
          error,
        );
      }
    } finally {
      this.state.isProcessing = false;
      this.state.activeSessionId = null;
    }
  }

  /**
   * Update training session progress
   */
  private async updateProgress(
    sessionId: string,
    progress: number,
    currentStep: string,
  ): Promise<void> {
    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: {
        progress,
        currentStep,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Compute centroid (mean) of embeddings (fallback for local computation)

   */
  private computeCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      return [];
    }

    const dimension = embeddings[0].length;
    const centroid: number[] = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        centroid[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      centroid[i] /= embeddings.length;
    }

    return centroid;
  }

  /**
   * Compute intra-class variance (spread of embeddings around centroid)
   */
  private computeVariance(embeddings: number[][], centroid: number[]): number {
    if (embeddings.length === 0) {
      return 0;
    }

    let sumSquaredDistances = 0;

    for (const embedding of embeddings) {
      let squaredDistance = 0;
      for (let i = 0; i < embedding.length; i++) {
        const diff = embedding[i] - centroid[i];
        squaredDistance += diff * diff;
      }
      sumSquaredDistances += squaredDistance;
    }

    return Math.sqrt(sumSquaredDistances / embeddings.length);
  }

  /**
   * Get current processor state (for debugging)
   */
  getState(): Readonly<TrainingState> {
    return Object.freeze(this.state);
  }
}
