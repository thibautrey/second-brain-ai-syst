/**
 * Tool Error Classifier
 *
 * Classifies tool errors to determine:
 * - Whether the error is recoverable (model can retry)
 * - Whether to surface the error to the user
 * - What retry strategy to use
 *
 * Based on Moltbot patterns for improved tool call reliability.
 */

export interface ToolErrorClassification {
  /** Can the model retry and potentially succeed? */
  isRecoverable: boolean;
  /** Should the model attempt to retry automatically? */
  shouldRetry: boolean;
  /** Should this error be shown to the user? */
  surfaceToUser: boolean;
  /** Retry strategy if applicable */
  retryStrategy?: "immediate" | "with_delay" | "with_modification";
  /** Suggested fix for the model to understand */
  suggestedFix?: string;
  /** Category of error for logging */
  errorCategory:
    | "validation"
    | "authentication"
    | "rate_limit"
    | "service_unavailable"
    | "not_found"
    | "permission"
    | "timeout"
    | "unknown";
}

/**
 * Patterns that indicate validation/parameter errors - model can fix these
 */
const VALIDATION_PATTERNS = [
  "required",
  "missing",
  "invalid",
  "must be",
  "expected",
  "parameter",
  "validation",
  "cannot be empty",
  "is not a valid",
  "should be",
  "must have",
  "type error",
  "format",
  "malformed",
];

/**
 * Patterns that require user intervention
 */
const USER_INTERVENTION_PATTERNS = [
  "api key",
  "apikey",
  "authentication",
  "unauthorized",
  "permission denied",
  "access denied",
  "forbidden",
  "not authorized",
  "credentials",
  "token expired",
  "invalid token",
];

/**
 * Patterns indicating rate limiting
 */
const RATE_LIMIT_PATTERNS = [
  "rate limit",
  "too many requests",
  "quota exceeded",
  "throttled",
  "limit exceeded",
  "try again later",
  "429",
];

/**
 * Patterns indicating service unavailability
 */
const SERVICE_UNAVAILABLE_PATTERNS = [
  "service unavailable",
  "temporarily unavailable",
  "maintenance",
  "503",
  "502",
  "connection refused",
  "connection reset",
  "network error",
  "econnrefused",
  "etimedout",
  "dns",
];

/**
 * Patterns indicating resource not found
 */
const NOT_FOUND_PATTERNS = ["not found", "404", "does not exist", "no such"];

/**
 * Patterns indicating timeout
 */
const TIMEOUT_PATTERNS = [
  "timeout",
  "timed out",
  "deadline exceeded",
  "took too long",
];

/**
 * Classify a tool error to determine handling strategy
 */
export function classifyToolError(
  error: string,
  toolId: string,
): ToolErrorClassification {
  const errorLower = error.toLowerCase();

  // Check validation errors first (recoverable by model)
  if (VALIDATION_PATTERNS.some((p) => errorLower.includes(p))) {
    return {
      isRecoverable: true,
      shouldRetry: true,
      surfaceToUser: false,
      retryStrategy: "with_modification",
      suggestedFix: extractValidationHint(error),
      errorCategory: "validation",
    };
  }

  // Check authentication errors (needs user intervention)
  if (USER_INTERVENTION_PATTERNS.some((p) => errorLower.includes(p))) {
    return {
      isRecoverable: false,
      shouldRetry: false,
      surfaceToUser: true,
      errorCategory: "authentication",
      suggestedFix:
        "User needs to configure authentication or API key for this service.",
    };
  }

  // Check rate limit errors (can retry with delay)
  if (RATE_LIMIT_PATTERNS.some((p) => errorLower.includes(p))) {
    return {
      isRecoverable: true,
      shouldRetry: true,
      surfaceToUser: false,
      retryStrategy: "with_delay",
      errorCategory: "rate_limit",
      suggestedFix: "Rate limited. Wait a moment or try an alternative.",
    };
  }

  // Check service unavailability (can retry or use alternative)
  if (SERVICE_UNAVAILABLE_PATTERNS.some((p) => errorLower.includes(p))) {
    return {
      isRecoverable: true,
      shouldRetry: true,
      surfaceToUser: false,
      retryStrategy: "with_delay",
      errorCategory: "service_unavailable",
      suggestedFix: "Service temporarily unavailable. Try an alternative.",
    };
  }

  // Check not found errors (may be recoverable with different params)
  if (NOT_FOUND_PATTERNS.some((p) => errorLower.includes(p))) {
    return {
      isRecoverable: true,
      shouldRetry: true,
      surfaceToUser: false,
      retryStrategy: "with_modification",
      errorCategory: "not_found",
      suggestedFix: "Resource not found. Check the ID or path and try again.",
    };
  }

  // Check timeout errors
  if (TIMEOUT_PATTERNS.some((p) => errorLower.includes(p))) {
    return {
      isRecoverable: true,
      shouldRetry: true,
      surfaceToUser: false,
      retryStrategy: "immediate",
      errorCategory: "timeout",
      suggestedFix: "Request timed out. Try again or use a simpler request.",
    };
  }

  // Unknown error - be conservative, surface to user after retries fail
  return {
    isRecoverable: false,
    shouldRetry: false,
    surfaceToUser: true,
    errorCategory: "unknown",
  };
}

/**
 * Extract a hint from validation error messages to help the model fix it
 */
function extractValidationHint(error: string): string {
  // Try to extract the specific field or requirement
  const patterns = [
    /['"](\w+)['"]\s+is required/i,
    /missing\s+(?:required\s+)?(?:field\s+)?['"]?(\w+)['"]?/i,
    /(\w+)\s+must be/i,
    /invalid\s+['"]?(\w+)['"]?/i,
    /expected\s+(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = error.match(pattern);
    if (match) {
      return `Fix the "${match[1]}" parameter and retry.`;
    }
  }

  return "Check the parameters and retry with correct values.";
}

/**
 * Determine if we should continue retrying based on classification and attempt count
 */
export function shouldContinueRetrying(
  classification: ToolErrorClassification,
  attemptCount: number,
  maxAttempts: number = 3,
): boolean {
  if (!classification.isRecoverable) return false;
  if (!classification.shouldRetry) return false;
  if (attemptCount >= maxAttempts) return false;

  return true;
}

/**
 * Get a user-friendly error message when we must surface the error
 */
export function getUserFriendlyError(
  error: string,
  classification: ToolErrorClassification,
  toolId: string,
): string {
  switch (classification.errorCategory) {
    case "authentication":
      return `J'ai besoin d'une clé API pour utiliser ${toolId}. Vous pouvez en configurer une dans les paramètres.`;
    case "rate_limit":
      return `Le service est temporairement surchargé. Réessayez dans quelques instants.`;
    case "service_unavailable":
      return `Le service ${toolId} est temporairement indisponible.`;
    case "permission":
      return `Je n'ai pas les permissions nécessaires pour cette action.`;
    default:
      // For unknown errors, return a sanitized version
      return `Une erreur s'est produite avec ${toolId}. ${classification.suggestedFix || ""}`.trim();
  }
}

/**
 * Format error context for the model to understand and potentially fix
 */
export function formatErrorForModel(
  error: string,
  classification: ToolErrorClassification,
  toolId: string,
): string {
  const parts = [`Tool "${toolId}" failed: ${error}`];

  if (classification.isRecoverable && classification.suggestedFix) {
    parts.push(`Suggestion: ${classification.suggestedFix}`);
  }

  if (!classification.isRecoverable) {
    parts.push("This error cannot be automatically resolved. Inform the user.");
  }

  return parts.join(" | ");
}
