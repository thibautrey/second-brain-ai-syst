/**
 * Model Recovery Service
 *
 * Continuously monitors blacklisted LLM models and providers.
 * Attempts to recover them by testing connectivity.
 * Automatically unblacklists models that become available again.
 */

import { CronJob } from "cron";
import prisma from "./prisma.js";
import {
  recordModelSuccess,
  recordModelError,
} from "./model-compatibility-hint.js";

interface BlacklistedModel {
  providerId: string;
  modelId: string;
  blacklistReason?: string;
  errorCount: number;
  successCount: number;
  lastErrorTime?: Date;
}

export class ModelRecoveryService {
  private recoveryJob: CronJob | null = null;
  private isRunning = false;
  private lastRecoveryTime: Map<string, Date> = new Map();
  private recoveryAttempts: Map<string, number> = new Map();
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private readonly MIN_RECOVERY_INTERVAL_HOURS = 1;

  /**
   * Start the model recovery service
   * Runs recovery checks every 30 minutes
   */
  start(): void {
    if (this.isRunning) {
      console.log(
        "[ModelRecovery] Service already running, skipping initialization",
      );
      return;
    }

    this.isRunning = true;

    // Check every 30 minutes
    this.recoveryJob = new CronJob("*/30 * * * *", async () => {
      await this.runRecoveryCheck();
    });

    this.recoveryJob.start();
    console.log(
      "[ModelRecovery] Service started - checking blacklisted models every 30 minutes",
    );

    // Run initial check after 5 seconds
    setTimeout(() => {
      this.runRecoveryCheck().catch((error) => {
        console.error("[ModelRecovery] Initial check failed:", error);
      });
    }, 5000);
  }

  /**
   * Stop the recovery service
   */
  stop(): void {
    if (this.recoveryJob) {
      this.recoveryJob.stop();
      this.isRunning = false;
      console.log("[ModelRecovery] Service stopped");
    }
  }

  /**
   * Run the recovery check for all blacklisted models
   */
  private async runRecoveryCheck(): Promise<void> {
    try {
      const blacklistedModels =
        await this.getBlacklistedModels();

      if (blacklistedModels.length === 0) {
        console.log(
          "[ModelRecovery] No blacklisted models found, nothing to recover",
        );
        return;
      }

      console.log(
        `[ModelRecovery] Found ${blacklistedModels.length} blacklisted models, attempting recovery...`,
      );

      for (const model of blacklistedModels) {
        await this.attemptModelRecovery(model);
      }
    } catch (error) {
      console.error(
        "[ModelRecovery] Error during recovery check:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Fetch all blacklisted models from the database
   */
  private async getBlacklistedModels(): Promise<BlacklistedModel[]> {
    try {
      const blacklisted = await prisma.modelCompatibilityHint.findMany({
        where: {
          isBlacklisted: true,
        },
      });

      return blacklisted.map((hint) => ({
        providerId: hint.providerId,
        modelId: hint.modelId,
        blacklistReason: hint.blacklistReason || undefined,
        errorCount: hint.errorCount,
        successCount: hint.successCount,
        lastErrorTime: hint.lastErrorTime || undefined,
      }));
    } catch (error) {
      console.error(
        "[ModelRecovery] Failed to fetch blacklisted models:",
        error,
      );
      return [];
    }
  }

  /**
   * Attempt to recover a single blacklisted model
   */
  private async attemptModelRecovery(model: BlacklistedModel): Promise<void> {
    const modelKey = `${model.providerId}/${model.modelId}`;

    // Check if we've exceeded max recovery attempts recently
    const attempts = this.recoveryAttempts.get(modelKey) || 0;
    if (attempts >= this.MAX_RECOVERY_ATTEMPTS) {
      // Reset attempts after 24 hours
      const lastAttempt = this.lastRecoveryTime.get(modelKey);
      if (lastAttempt) {
        const hoursSinceLastAttempt =
          (Date.now() - lastAttempt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastAttempt < 24) {
          console.log(
            `[ModelRecovery] ${modelKey} has exceeded max recovery attempts (${attempts}/${this.MAX_RECOVERY_ATTEMPTS}), skipping`,
          );
          return;
        }
      }
      // Reset after 24 hours
      this.recoveryAttempts.set(modelKey, 0);
    }

    // Check if enough time has passed since last recovery attempt
    const lastRecovery = this.lastRecoveryTime.get(modelKey);
    if (lastRecovery) {
      const hoursSinceLastRecovery =
        (Date.now() - lastRecovery.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRecovery < this.MIN_RECOVERY_INTERVAL_HOURS) {
        console.log(
          `[ModelRecovery] ${modelKey} was checked recently, skipping (${Math.round(hoursSinceLastRecovery * 60)} minutes ago)`,
        );
        return;
      }
    }

    console.log(
      `[ModelRecovery] Attempting recovery for ${modelKey} (Reason: ${model.blacklistReason || "unknown"})`,
    );

    try {
      // Fetch provider configuration
      const provider = await prisma.aIProvider.findUnique({
        where: { id: model.providerId },
      });

      if (!provider) {
        console.log(
          `[ModelRecovery] Provider ${model.providerId} not found in database`,
        );
        return;
      }

      // Attempt a simple health check via HTTP request to the provider's API
      const isHealthy = await this.checkProviderHealth(
        provider,
        model.modelId,
      );

      if (isHealthy) {
        console.log(
          `[ModelRecovery] ✓ ${modelKey} is now responsive, unblacklisting...`,
        );

        // Record success
        await recordModelSuccess(model.providerId, model.modelId);

        // Unblacklist the model
        await this.unblacklistModel(model.providerId, model.modelId);

        // Reset recovery attempts for this model
        this.recoveryAttempts.set(modelKey, 0);
        this.lastRecoveryTime.delete(modelKey);
      }
    } catch (error) {
      console.log(
        `[ModelRecovery] ✗ ${modelKey} recovery attempt failed:`,
        error instanceof Error ? error.message : String(error),
      );

      // Record the failed recovery attempt
      const attempts = (this.recoveryAttempts.get(modelKey) || 0) + 1;
      this.recoveryAttempts.set(modelKey, attempts);
      this.lastRecoveryTime.set(modelKey, new Date());

      console.log(
        `[ModelRecovery] Recovery attempt ${attempts}/${this.MAX_RECOVERY_ATTEMPTS} for ${modelKey}`,
      );
    }
  }

  /**
   * Check if a provider and model are healthy via a simple HTTP request
   */
  private async checkProviderHealth(
    provider: any,
    modelId: string,
  ): Promise<boolean> {
    try {
      // Determine the API endpoint based on provider name
      const baseUrl = provider.baseUrl || this.getProviderBaseUrl(provider.name);

      if (!baseUrl) {
        console.log(
          `[ModelRecovery] No base URL configured for provider ${provider.name}`,
        );
        return false;
      }

      // Make a simple HEAD or GET request to check connectivity
      const url = new URL(baseUrl);
      url.pathname = "/health"; // Most APIs have a health endpoint

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "User-Agent": "SecondBrain-ModelRecovery/1.0",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Any 2xx or 4xx response means the API is responding
        // 5xx means server error (still responsive but unhealthy)
        return response.status < 500;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.debug(
        `[ModelRecovery] Health check failed for ${provider.name}:`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Get the base URL for a known provider
   */
  private getProviderBaseUrl(providerName: string): string {
    const urls: Record<string, string> = {
      OpenAI: "https://api.openai.com/v1",
      GpuStack: "http://localhost:8000/v1",
      Anthropic: "https://api.anthropic.com",
      Google: "https://generativelanguage.googleapis.com",
      Ollama: "http://localhost:11434/api",
    };

    return urls[providerName] || "";
  }

  /**
   * Unblacklist a model and reset its error count
   */
  private async unblacklistModel(
    providerId: string,
    modelId: string,
  ): Promise<void> {
    try {
      await prisma.modelCompatibilityHint.update({
        where: {
          providerId_modelId: {
            providerId,
            modelId,
          },
        },
        data: {
          isBlacklisted: false,
          blacklistReason: null,
          errorCount: 0,
          successCount: 1, // Mark as having at least 1 success
          lastSuccessTime: new Date(),
        },
      });

      console.log(
        `[ModelRecovery] Successfully unblacklisted ${providerId}/${modelId}`,
      );
    } catch (error) {
      console.error(
        `[ModelRecovery] Failed to unblacklist ${providerId}/${modelId}:`,
        error,
      );
    }
  }

  /**
   * Get current recovery status
   */
  async getRecoveryStatus(): Promise<{
    isRunning: boolean;
    blacklistedCount: number;
    recoveryAttempts: Record<string, number>;
    models: BlacklistedModel[];
  }> {
    const models = await this.getBlacklistedModels();
    const recoveryAttempts: Record<string, number> = {};

    for (const [key, count] of this.recoveryAttempts.entries()) {
      if (count > 0) {
        recoveryAttempts[key] = count;
      }
    }

    return {
      isRunning: this.isRunning,
      blacklistedCount: models.length,
      recoveryAttempts,
      models,
    };
  }

  /**
   * Manually trigger recovery for a specific model
   */
  async triggerRecovery(providerId: string, modelId: string): Promise<void> {
    console.log(
      `[ModelRecovery] Manual recovery triggered for ${providerId}/${modelId}`,
    );
    const model = await prisma.modelCompatibilityHint.findUnique({
      where: {
        providerId_modelId: {
          providerId,
          modelId,
        },
      },
    });

    if (model && model.isBlacklisted) {
      await this.attemptModelRecovery({
        providerId: model.providerId,
        modelId: model.modelId,
        blacklistReason: model.blacklistReason || undefined,
        errorCount: model.errorCount,
        successCount: model.successCount,
        lastErrorTime: model.lastErrorTime || undefined,
      });
    } else {
      console.log(
        `[ModelRecovery] Model ${providerId}/${modelId} is not blacklisted or not found`,
      );
    }
  }
}

// Export singleton instance
export const modelRecoveryService = new ModelRecoveryService();
