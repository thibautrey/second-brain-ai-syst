// Sanitize Tool Results Service
// Removes sensitive data from tool execution results before storing in memory

/**
 * Sensitive data patterns to remove or redact
 */
const SENSITIVE_PATTERNS = [
  // API Keys and tokens - in values
  {
    pattern:
      /["']?(?:sk_live|sk_test|pk_live|pk_test|rk_live|rk_test)_[a-zA-Z0-9]{20,}["']?/g,
    label: "API Key (Stripe)",
  },
  {
    pattern: /["']?(?:api[_-]?key)[\s:=]*["']([^"']+)["']/gi,
    label: "API Key",
  },
  {
    pattern: /["']?(?:apikey)[\s:=]*["']?([a-zA-Z0-9._\-]+)["']?/gi,
    label: "API Key (Generic)",
  },
  {
    pattern: /["']?(?:api_key)[\s:=]*["']?([a-zA-Z0-9._\-]+)["']?/gi,
    label: "API Key (Generic)",
  },

  // Auth tokens - in values
  {
    pattern:
      /(?:authorization|auth)[\s:=]*(?:Bearer\s+)?["']?([a-zA-Z0-9._\-]+)["']?/gi,
    label: "Auth Token",
  },
  {
    pattern: /["']?(?:access[_-]?token|accesstoken)[\s:=]*["']([^"']+)["']/gi,
    label: "Access Token",
  },
  {
    pattern: /["']?(?:refresh[_-]?token|refreshtoken)[\s:=]*["']([^"']+)["']/gi,
    label: "Refresh Token",
  },

  // Passwords and secrets
  {
    pattern: /["']?(?:password|passwd|pwd)[\s:=]*["']([^"']+)["']/gi,
    label: "Password",
  },
  {
    pattern:
      /["']?(?:secret|private[_-]?key|privatekey)[\s:=]*["']([^"']+)["']/gi,
    label: "Secret",
  },

  // Database credentials
  {
    pattern:
      /["']?(?:db|database)[_-]?(?:password|passwd|pwd)[\s:=]*["']([^"']+)["']/gi,
    label: "DB Password",
  },
  {
    pattern: /["']?(?:connection[_-]?string)[\s:=]*["']([^"']+)["']/gi,
    label: "Connection String",
  },

  // AWS credentials
  { pattern: /(?:AKIA[0-9A-Z]{16})/g, label: "AWS Access Key" },
  {
    pattern:
      /(?:aws[_-]?secret[_-]?(?:access[_-])?key)[\s:=]*["']?([a-zA-Z0-9/+=]{40})["']?/gi,
    label: "AWS Secret Key",
  },
  {
    pattern: /["']?wJalrXUtnFEMI[a-zA-Z0-9\/+]+["']?/g,
    label: "AWS Credential",
  },

  // OAuth tokens
  {
    pattern:
      /["']?(?:oauth|oauth2)[_-]?token[\s:=]*["']([a-zA-Z0-9._\-]+)["']/gi,
    label: "OAuth Token",
  },

  // JWT tokens (simplified - catch eye common JWT pattern)
  {
    pattern: /eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    label: "JWT Token",
  },

  // Generic multi-line patterns
  { pattern: /"([a-zA-Z0-9+/]{40,})={0,2}"/g, label: "Base64/Encoded Secret" },

  // Email addresses
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    label: "Email",
    shouldRedact: true,
  },

  // Phone numbers
  {
    pattern: /(?:\+|0)?(?:\d[\s\-.]?){6,}\d/g,
    label: "Phone Number",
    shouldRedact: true,
  },

  // Credit card patterns (simplified - catches many numbers)
  {
    pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
    label: "Credit Card",
    shouldRedact: true,
  },

  // Social Security numbers
  {
    pattern: /\b\d{3}[\-]?\d{2}[\-]?\d{4}\b/g,
    label: "SSN",
    shouldRedact: true,
  },
];

interface SanitizationResult {
  cleaned: any;
  hasSensitiveData: boolean;
  redactedCount: number;
  redactionSummary: { label: string; count: number }[];
}

/**
 * Recursively sanitizes an object/array to remove sensitive data
 * @param data The data to sanitize (can be string, object, array, or any type)
 * @param maxDepth Maximum recursion depth
 * @returns Sanitized data with sensitive info redacted
 */
export function sanitizeToolResult(
  data: any,
  maxDepth: number = 10,
): SanitizationResult {
  if (maxDepth <= 0) {
    return {
      cleaned: data,
      hasSensitiveData: false,
      redactedCount: 0,
      redactionSummary: [],
    };
  }

  const redactionCounts = new Map<string, number>();
  let totalRedacted = 0;
  let hasSensitiveData = false;

  const sanitizeValue = (value: any): any => {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      return sanitizeString(value);
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item));
    }

    if (typeof value === "object" && value !== null) {
      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }

    return value;
  };

  const sanitizeString = (str: string): string => {
    let sanitized = str;

    for (const { pattern, label, shouldRedact } of SENSITIVE_PATTERNS) {
      const matches = str.match(pattern);
      if (matches && matches.length > 0) {
        hasSensitiveData = true;

        const currentCount = redactionCounts.get(label) || 0;
        const newCount = currentCount + matches.length;
        redactionCounts.set(label, newCount);
        totalRedacted += matches.length;

        // Redact the sensitive data
        if (shouldRedact) {
          sanitized = sanitized.replace(pattern, "[REDACTED]");
        } else {
          sanitized = sanitized.replace(
            pattern,
            `[${label.toUpperCase().replace(/\s+/g, "_")}_REDACTED]`,
          );
        }
      }
    }

    return sanitized;
  };

  const cleaned = sanitizeValue(data);

  return {
    cleaned,
    hasSensitiveData,
    redactedCount: totalRedacted,
    redactionSummary: Array.from(redactionCounts.entries()).map(
      ([label, count]) => ({
        label,
        count,
      }),
    ),
  };
}

/**
 * Generates a human-readable summary of tool execution
 * @param toolResults Array of tool execution results
 * @param sanitizationResults Map of tool name to sanitization result
 * @returns Summary string
 */
export function generateToolExecutionSummary(
  toolResults: Array<{
    toolUsed: string;
    success: boolean;
    error?: string;
    executionTime: number;
  }>,
  sanitizationResults?: Map<string, SanitizationResult>,
): string {
  if (toolResults.length === 0) {
    return "Aucun outil exécuté";
  }

  const successCount = toolResults.filter((r) => r.success).length;
  const failureCount = toolResults.filter((r) => !r.success).length;
  const totalTime = toolResults.reduce((sum, r) => sum + r.executionTime, 0);

  const toolDetails = toolResults
    .map((result) => {
      const status = result.success ? "✓" : "✗";
      const time = `${result.executionTime}ms`;
      const suffix = result.success
        ? ""
        : ` (Erreur: ${result.error || "Unknown"})`;
      return `${status} ${result.toolUsed}: ${time}${suffix}`;
    })
    .join("\n");

  const sensitivityWarning =
    sanitizationResults &&
    Array.from(sanitizationResults.values()).some((r) => r.hasSensitiveData)
      ? "\n⚠️ [Note: Certaines données sensibles ont été supprimées avant le stockage]"
      : "";

  return `Exécution des outils (${successCount}/${toolResults.length} réussi, ${totalTime}ms au total):\n${toolDetails}${sensitivityWarning}`;
}

/**
 * Creates metadata object for tool execution
 * @param toolResults Array of tool execution results
 * @param summary Summary of execution
 * @returns Metadata object to store with memory
 */
export function createToolMetadata(
  toolResults: Array<{
    toolUsed: string;
    success: boolean;
    error?: string;
    executionTime: number;
  }>,
  summary: string,
) {
  return {
    toolsUsed: toolResults.map((r) => r.toolUsed),
    successCount: toolResults.filter((r) => r.success).length,
    failureCount: toolResults.filter((r) => !r.success).length,
    totalCount: toolResults.length,
    totalExecutionTime: toolResults.reduce(
      (sum, r) => sum + r.executionTime,
      0,
    ),
    executionSummary: summary,
  };
}
