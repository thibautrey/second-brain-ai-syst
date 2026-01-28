// Model Compatibility Hint Manager
// Learns from LLM errors to improve provider/model selection in the future

import prisma from "./prisma.js";
import { LLMErrorInfo } from "./llm-router.js";

export interface CompatibilityHint {
  providerId: string;
  modelId: string;
  supportedEndpoints: string[];
  unsupportedEndpoints: string[];
  preferredEndpoint?: string;
  errorCount: number;
  successCount: number;
  isBlacklisted: boolean;
  blacklistReason?: string;
}

/**
 * Record a learning event when an LLM model encounters an error
 * This helps the system avoid the same errors in the future
 */
export async function recordModelError(
  providerId: string,
  modelId: string,
  errorInfo: LLMErrorInfo,
  endpoint?: string,
): Promise<void> {
  try {
    const hint = await prisma.modelCompatibilityHint.upsert({
      where: {
        providerId_modelId: {
          providerId,
          modelId,
        },
      },
      update: {
        lastErrorType: errorInfo.type,
        lastErrorMessage: errorInfo.message,
        errorCount: { increment: 1 },
        lastErrorTime: new Date(),
        // Add to unsupported endpoints if it's a model-incompatible error with an endpoint
        ...(errorInfo.type === "model-incompatible" &&
          endpoint && {
            unsupportedEndpoints: {
              push: endpoint,
            },
          }),
      },
      create: {
        providerId,
        modelId,
        lastErrorType: errorInfo.type,
        lastErrorMessage: errorInfo.message,
        errorCount: 1,
        successCount: 0,
        lastErrorTime: new Date(),
        unsupportedEndpoints: endpoint ? [endpoint] : [],
      },
    });

    console.log(
      `[CompatibilityHint] Recorded error for ${providerId}/${modelId}: ${errorInfo.type}`,
    );

    // Auto-blacklist if too many errors
    if (hint.errorCount >= 5 && hint.successCount === 0) {
      await blacklistModel(
        providerId,
        modelId,
        `Too many errors (${hint.errorCount}) with no successes`,
      );
    }
  } catch (error) {
    console.error(
      `[CompatibilityHint] Failed to record error for ${providerId}/${modelId}:`,
      error,
    );
  }
}

/**
 * Record a successful LLM call for a model
 * This increases confidence in the model's compatibility
 */
export async function recordModelSuccess(
  providerId: string,
  modelId: string,
  endpoint?: string,
): Promise<void> {
  try {
    const hint = await prisma.modelCompatibilityHint.upsert({
      where: {
        providerId_modelId: {
          providerId,
          modelId,
        },
      },
      update: {
        successCount: { increment: 1 },
        lastSuccessTime: new Date(),
        // Mark endpoint as supported if provided
        ...(endpoint && {
          supportedEndpoints: {
            push: endpoint,
          },
        }),
      },
      create: {
        providerId,
        modelId,
        successCount: 1,
        errorCount: 0,
        lastSuccessTime: new Date(),
        supportedEndpoints: endpoint ? [endpoint] : [],
      },
    });

    // If this was the first success after errors, log it
    if (hint.errorCount > 0) {
      console.log(
        `[CompatibilityHint] First success for ${providerId}/${modelId} after ${hint.errorCount} errors`,
      );
    }
  } catch (error) {
    console.error(
      `[CompatibilityHint] Failed to record success for ${providerId}/${modelId}:`,
      error,
    );
  }
}

/**
 * Get the compatibility hint for a provider/model combination
 */
export async function getCompatibilityHint(
  providerId: string,
  modelId: string,
): Promise<CompatibilityHint | null> {
  try {
    const hint = await prisma.modelCompatibilityHint.findUnique({
      where: {
        providerId_modelId: {
          providerId,
          modelId,
        },
      },
    });

    return hint
      ? {
          providerId: hint.providerId,
          modelId: hint.modelId,
          supportedEndpoints: hint.supportedEndpoints,
          unsupportedEndpoints: hint.unsupportedEndpoints,
          preferredEndpoint: hint.preferredEndpoint || undefined,
          errorCount: hint.errorCount,
          successCount: hint.successCount,
          isBlacklisted: hint.isBlacklisted,
          blacklistReason: hint.blacklistReason || undefined,
        }
      : null;
  } catch (error) {
    console.error(
      `[CompatibilityHint] Failed to get hint for ${providerId}/${modelId}:`,
      error,
    );
    return null;
  }
}

/**
 * Check if a model is blacklisted
 */
export async function isModelBlacklisted(
  providerId: string,
  modelId: string,
): Promise<boolean> {
  try {
    const hint = await prisma.modelCompatibilityHint.findUnique({
      where: {
        providerId_modelId: {
          providerId,
          modelId,
        },
      },
      select: {
        isBlacklisted: true,
      },
    });

    return hint?.isBlacklisted || false;
  } catch (error) {
    console.error(
      `[CompatibilityHint] Failed to check blacklist for ${providerId}/${modelId}:`,
      error,
    );
    return false;
  }
}

/**
 * Blacklist a model for a provider
 */
export async function blacklistModel(
  providerId: string,
  modelId: string,
  reason: string,
): Promise<void> {
  try {
    await prisma.modelCompatibilityHint.upsert({
      where: {
        providerId_modelId: {
          providerId,
          modelId,
        },
      },
      update: {
        isBlacklisted: true,
        blacklistReason: reason,
      },
      create: {
        providerId,
        modelId,
        isBlacklisted: true,
        blacklistReason: reason,
      },
    });

    console.warn(
      `[CompatibilityHint] Blacklisted ${providerId}/${modelId}: ${reason}`,
    );
  } catch (error) {
    console.error(
      `[CompatibilityHint] Failed to blacklist ${providerId}/${modelId}:`,
      error,
    );
  }
}

/**
 * Get the recommended endpoint for a model based on learned compatibility
 * Returns the preferred/supported endpoint, or null if unknown
 */
export async function getRecommendedEndpoint(
  providerId: string,
  modelId: string,
): Promise<string | null> {
  try {
    const hint = await getCompatibilityHint(providerId, modelId);

    if (!hint) {
      return null; // No information yet
    }

    // If we have a preferred endpoint, use it
    if (hint.preferredEndpoint) {
      return hint.preferredEndpoint;
    }

    // If we have supported endpoints, use the first one
    if (hint.supportedEndpoints.length > 0) {
      return hint.supportedEndpoints[0];
    }

    // If we know unsupported endpoints but not supported ones,
    // we can't recommend anything yet
    return null;
  } catch (error) {
    console.error(
      `[CompatibilityHint] Failed to get recommended endpoint for ${providerId}/${modelId}:`,
      error,
    );
    return null;
  }
}

/**
 * Set the preferred endpoint for a model based on successful usage
 */
export async function setPreferredEndpoint(
  providerId: string,
  modelId: string,
  endpoint: string,
): Promise<void> {
  try {
    await prisma.modelCompatibilityHint.upsert({
      where: {
        providerId_modelId: {
          providerId,
          modelId,
        },
      },
      update: {
        preferredEndpoint: endpoint,
        supportedEndpoints: {
          push: endpoint,
        },
      },
      create: {
        providerId,
        modelId,
        preferredEndpoint: endpoint,
        supportedEndpoints: [endpoint],
      },
    });

    console.log(
      `[CompatibilityHint] Set preferred endpoint for ${providerId}/${modelId}: ${endpoint}`,
    );
  } catch (error) {
    console.error(
      `[CompatibilityHint] Failed to set preferred endpoint for ${providerId}/${modelId}:`,
      error,
    );
  }
}

/**
 * Get all compatibility hints for a provider
 */
export async function getProviderHints(
  providerId: string,
): Promise<CompatibilityHint[]> {
  try {
    const hints = await prisma.modelCompatibilityHint.findMany({
      where: {
        providerId,
      },
    });

    return hints.map((hint) => ({
      providerId: hint.providerId,
      modelId: hint.modelId,
      supportedEndpoints: hint.supportedEndpoints,
      unsupportedEndpoints: hint.unsupportedEndpoints,
      preferredEndpoint: hint.preferredEndpoint || undefined,
      errorCount: hint.errorCount,
      successCount: hint.successCount,
      isBlacklisted: hint.isBlacklisted,
      blacklistReason: hint.blacklistReason || undefined,
    }));
  } catch (error) {
    console.error(
      `[CompatibilityHint] Failed to get hints for provider ${providerId}:`,
      error,
    );
    return [];
  }
}

/**
 * Unblacklist a model and reset its error tracking
 */
export async function unblacklistModel(
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
        successCount: 1,
        lastSuccessTime: new Date(),
      },
    });

    console.log(
      `[CompatibilityHint] Unblacklisted ${providerId}/${modelId}`,
    );
  } catch (error) {
    console.error(
      `[CompatibilityHint] Failed to unblacklist ${providerId}/${modelId}:`,
      error,
    );
    throw error;
  }
}
/**
 * Get all blacklisted models that haven't been tested recently
 */
export async function getBlacklistedModelsForValidation(): Promise<
  Array<{ providerId: string; modelId: string; reason: string | null }>
> {
  try {
    // Get blacklisted models that were blacklisted more than 1 hour ago
    // This gives time for any temporary issues to resolve
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const hints = await prisma.modelCompatibilityHint.findMany({
      where: {
        isBlacklisted: true,
        OR: [
          { lastSuccessTime: null },
          { lastSuccessTime: { lt: oneHourAgo } },
        ],
      },
      select: {
        providerId: true,
        modelId: true,
        blacklistReason: true,
        unsupportedEndpoints: true,
      },
    });

    // Filter out models that have known endpoint incompatibilities
    // These should NOT be automatically unblacklisted as they require code changes
    return hints
      .filter((h) => {
        // Skip models with known endpoint incompatibilities (e.g., v1/responses only)
        if (
          h.unsupportedEndpoints.some((e) =>
            e.includes("chat/completions") || e.includes("v1/chat"),
          )
        ) {
          return false;
        }
        // Skip models explicitly blacklisted for endpoint issues
        if (
          h.blacklistReason?.includes("endpoint") ||
          h.blacklistReason?.includes("v1/responses")
        ) {
          return false;
        }
        return true;
      })
      .map((h) => ({
        providerId: h.providerId,
        modelId: h.modelId,
        reason: h.blacklistReason,
      }));
  } catch (error) {
    console.error(
      "[CompatibilityHint] Failed to get blacklisted models for validation:",
      error,
    );
    return [];
  }
}

/**
 * Mark a model as having endpoint incompatibility (permanent blacklist for chat/completions)
 * This is different from a regular blacklist - it indicates the model needs a different API
 */
export async function markModelEndpointIncompatible(
  providerId: string,
  modelId: string,
  requiredEndpoint: string,
): Promise<void> {
  try {
    await prisma.modelCompatibilityHint.upsert({
      where: {
        providerId_modelId: {
          providerId,
          modelId,
        },
      },
      update: {
        isBlacklisted: true,
        blacklistReason: `Model requires ${requiredEndpoint} endpoint, not compatible with chat/completions`,
        unsupportedEndpoints: {
          push: "v1/chat/completions",
        },
        preferredEndpoint: requiredEndpoint,
      },
      create: {
        providerId,
        modelId,
        isBlacklisted: true,
        blacklistReason: `Model requires ${requiredEndpoint} endpoint, not compatible with chat/completions`,
        unsupportedEndpoints: ["v1/chat/completions"],
        preferredEndpoint: requiredEndpoint,
      },
    });

    console.warn(
      `[CompatibilityHint] Marked ${providerId}/${modelId} as endpoint-incompatible (requires ${requiredEndpoint})`,
    );
  } catch (error) {
    console.error(
      `[CompatibilityHint] Failed to mark endpoint incompatibility for ${providerId}/${modelId}:`,
      error,
    );
  }
}