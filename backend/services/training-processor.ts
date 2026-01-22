/**
 * Background Training Processor Service
 *
 * Handles asynchronous processing of training sessions.
 * Polls for pending sessions and processes them in background.
 */

import prisma from "./prisma.js";
import { SpeakerRecognitionService } from "./speaker-recognition.js";

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

      // Step 1: Load audio samples (20% progress)
      await this.updateProgress(pendingSession.id, 15, "loading-samples");

      const audioBuffers = await Promise.all(
        voiceSamples.map(async (sample) => {
          try {
            // In production, you would load the actual audio file from disk
            // For now, we'll use a placeholder
            const { default: fs } = await import("fs/promises");
            try {
              const buffer = await fs.readFile(sample.storagePath);
              return buffer;
            } catch (error) {
              console.warn(
                `Could not read audio file at ${sample.storagePath}:`,
                error,
              );
              // Return empty buffer if file not found
              return Buffer.alloc(0);
            }
          } catch (error) {
            console.error("Error loading audio sample:", error);
            return Buffer.alloc(0);
          }
        }),
      );

      // Step 2: Extract embeddings (40% progress)
      await this.updateProgress(pendingSession.id, 40, "extracting-embeddings");
      const embeddings: number[][] = [];

      for (let i = 0; i < audioBuffers.length; i++) {
        try {
          const buffer = audioBuffers[i];
          if (buffer.length === 0) continue;

          // In a real scenario, this would call a Python service or ML model
          // For now, simulate embedding extraction
          const embedding = this.generateMockEmbedding(pendingSession.id, i);
          embeddings.push(embedding);
        } catch (error) {
          console.error(`Failed to extract embedding from sample ${i}:`, error);
        }
      }

      if (embeddings.length === 0) {
        throw new Error("Failed to extract embeddings from any samples");
      }

      // Step 3: Compute centroid (60% progress)
      await this.updateProgress(pendingSession.id, 60, "computing-centroid");
      const centroidEmbedding = this.computeCentroid(embeddings);

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
   * Generate mock embedding for testing
   * In production, this would call a real ML model
   */
  private generateMockEmbedding(
    sessionId: string,
    sampleIndex: number,
  ): number[] {
    const embedding: number[] = [];
    const seed = sessionId.charCodeAt(0) + sampleIndex;

    for (let i = 0; i < 192; i++) {
      // ECAPA-TDNN uses 192-dimensional embeddings
      const value = Math.sin((seed + i) * 0.1) * 0.5 + Math.random() * 0.3;
      embedding.push(value);
    }

    return embedding;
  }

  /**
   * Compute centroid (mean) of embeddings
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
