/**
 * Token Validator Utility
 * Handles max_tokens validation and fallback logic
 * Prevents "max_tokens must be at least 1" errors from API
 */

export interface TokenValidationResult {
  maxTokens: number;
  isValidated: boolean;
  warning?: string;
}

/**
 * Model context window sizes (in tokens)
 * Used to estimate if max_tokens is realistic for the context
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // GPT-4 models
  "gpt-4": 8192,
  "gpt-4-turbo": 128000,
  "gpt-4-turbo-preview": 128000,
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,

  // GPT-3.5 models
  "gpt-3.5-turbo": 16384,

  // Claude models
  "claude-3-opus": 200000,
  "claude-3-sonnet": 200000,
  "claude-3-haiku": 200000,

  // Mistral models
  "mistral-small-3.2": 32000,
  "mistral-small-3.1": 32000,
  "mistral-medium-3": 256000,
  "mistral-large-3": 256000,
  "mistral-tiny": 32000,

  // Local models (conservative estimate)
  "local-llm": 4096,
  ollama: 4096,
};

/**
 * Estimate approximate tokens used by messages
 * This is a rough estimate: ~4 tokens per word on average
 */
function estimateTokensUsed(messagesStr: string): number {
  if (!messagesStr) return 0;

  // Rough estimate: 1 token per 4 characters (more accurate for real text)
  // This avoids massive overestimation on JSON and structured data
  return Math.ceil(messagesStr.length / 4);
}

/**
 * Get context window for a model
 */
function getContextWindow(modelId: string): number {
  // Try exact match
  if (MODEL_CONTEXT_WINDOWS[modelId]) {
    return MODEL_CONTEXT_WINDOWS[modelId];
  }

  // Try partial match
  for (const [model, window] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (modelId.includes(model)) {
      return window;
    }
  }

  // Default fallback
  return 4096;
}

/**
 * Validate and adjust max_tokens to ensure it's within acceptable range
 *
 * Rules:
 * 1. Must be at least 1
 * 2. Must be less than context window
 * 3. If messages are very long, use conservative estimate
 * 4. Never return negative or zero
 * 5. Use dynamic buffer: 10% for small models (<32k), 15% for medium (32k-100k), 20% for large (>100k)
 */
export function validateMaxTokens(
  requestedMaxTokens: number,
  modelId: string,
  messagesLength?: number,
  messagesStr?: string,
): TokenValidationResult {
  const contextWindow = getContextWindow(modelId);
  let validatedTokens = requestedMaxTokens;
  let warning: string | undefined;

  // If messages are provided, estimate used tokens
  let estimatedUsedTokens = 0;
  if (messagesStr) {
    estimatedUsedTokens = estimateTokensUsed(messagesStr);
  } else if (messagesLength) {
    // Rough estimate: 100 tokens per message on average
    estimatedUsedTokens = messagesLength * 100;
  }

  // Rule 1: Ensure minimum of 1
  if (validatedTokens < 1) {
    validatedTokens = 1;
    warning = `max_tokens was below 1 (was ${requestedMaxTokens}), using minimum of 1`;
  }

  // Rule 2: Dynamic buffer based on model size
  // Small models (<32k): 10% buffer → allow 90% of context
  // Medium models (32k-100k): 15% buffer → allow 85% of context
  // Large models (>100k): 20% buffer → allow 80% of context
  let bufferPercent = 0.2; // Default 20%
  if (contextWindow < 32000) {
    bufferPercent = 0.1; // 10% for small models
  } else if (contextWindow < 100000) {
    bufferPercent = 0.15; // 15% for medium models
  }

  const reservedBuffer = Math.floor(contextWindow * bufferPercent);
  const maxAllowedTokens = Math.max(
    256, // Minimum allowed tokens
    contextWindow - reservedBuffer - estimatedUsedTokens,
  );

  if (validatedTokens > maxAllowedTokens) {
    validatedTokens = Math.min(
      requestedMaxTokens,
      Math.max(1, Math.floor(maxAllowedTokens)),
    );
    warning = `max_tokens reduced from ${requestedMaxTokens} to ${validatedTokens} to fit context window for model ${modelId}`;
  }

  // Rule 3: Final sanity check - should never be negative or less than 1
  if (validatedTokens < 1) {
    validatedTokens = 1;
    warning =
      (warning ? warning + "; " : "") +
      `Context too large for model ${modelId} (estimated ${estimatedUsedTokens} tokens used), using minimum max_tokens of 1`;
  }

  return {
    maxTokens: validatedTokens,
    isValidated: true,
    warning,
  };
}

/**
 * Check if an error is a "max_tokens must be at least 1" error from OpenAI
 */
export function isMaxTokensError(error: any): boolean {
  if (!error) return false;

  // Check for OpenAI API error
  if (error.status === 400 && error.code === 400) {
    const message = error.message || error.error?.message || "";
    return message.includes("max_tokens must be at least 1");
  }

  // Check for generic Error with message
  if (error instanceof Error) {
    return error.message.includes("max_tokens must be at least 1");
  }

  return false;
}

/**
 * Extract max_tokens value from error message
 */
export function extractMaxTokensFromError(error: any): number | null {
  const message = error?.message || error?.error?.message || "";
  const match = message.match(/got\s+(-?\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Fallback max_tokens value when context is too long
 * Start with a small value and let the model work with what it can
 */
export function getFallbackMaxTokens(modelId: string): number {
  // For large context window models, use more conservative fallback
  const contextWindow = getContextWindow(modelId);

  if (contextWindow >= 100000) {
    return 2048; // GPT-4-turbo, Claude
  } else if (contextWindow >= 16000) {
    return 1024; // GPT-3.5-turbo, GPT-4
  } else {
    return 256; // Smaller models, local LLMs
  }
}
