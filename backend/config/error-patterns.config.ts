/**
 * Error Pattern Configuration
 * Centralized definition of error patterns for automatic categorization
 *
 * Add new patterns here to improve error categorization accuracy
 */

export interface ErrorPattern {
  type: string;
  pattern: RegExp;
  category:
    | "validation"
    | "execution"
    | "timeout"
    | "system"
    | "permission"
    | "unknown";
  severity: "low" | "medium" | "high" | "critical";
  isRecoverable: boolean;
  suggestedFixes?: string[];
}

/**
 * Error patterns for automatic categorization
 * Listed in priority order - first match wins
 */
export const ERROR_PATTERNS: ErrorPattern[] = [
  // ==================== VALIDATION ERRORS ====================
  {
    type: "schema_validation_error",
    pattern:
      /validation failed|invalid parameter|required parameter missing|schema.*mismatch/i,
    category: "validation",
    severity: "medium",
    isRecoverable: false,
    suggestedFixes: [
      "Check parameter types and required fields",
      "Review tool schema documentation",
      "Verify parameter values match expected format",
    ],
  },
  {
    type: "type_mismatch",
    pattern:
      /expected .* got .*|type.*mismatch|cannot assign.*to|is not a .*|incompatible type/i,
    category: "validation",
    severity: "medium",
    isRecoverable: false,
    suggestedFixes: [
      "Verify parameter types",
      "Check variable assignments",
      "Review function signatures",
      "Ensure type casting is correct",
    ],
  },
  {
    type: "missing_required_param",
    pattern:
      /missing.*parameter|required.*missing|undefined.*parameter|no.*provided/i,
    category: "validation",
    severity: "medium",
    isRecoverable: false,
    suggestedFixes: [
      "Check all required parameters are provided",
      "Review parameter order",
      "Verify default values",
    ],
  },

  // ==================== EXECUTION ERRORS ====================
  {
    type: "undefined_reference",
    pattern:
      /undefined|is not defined|cannot read.*undefined|cannot read property|null is not an object|null reference|cannot access property of null/i,
    category: "execution",
    severity: "high",
    isRecoverable: true,
    suggestedFixes: [
      "Check if variable is initialized before use",
      "Add null/undefined checks",
      "Review dependency injection",
      "Verify object structure",
    ],
  },
  {
    type: "runtime_error",
    pattern:
      /runtime error|exception|error executing|failed to execute|syntax error|unexpected token|parse error/i,
    category: "execution",
    severity: "high",
    isRecoverable: true,
    suggestedFixes: [
      "Review error stack trace",
      "Check for edge cases in logic",
      "Add error boundaries",
      "Validate code syntax",
    ],
  },
  {
    type: "api_error",
    pattern:
      /http error|status code [45]\d{2}|api.*error|request failed|api.*unavailable|endpoint.*not found|bad request|server error/i,
    category: "execution",
    severity: "medium",
    isRecoverable: true,
    suggestedFixes: [
      "Check API endpoint and credentials",
      "Verify network connectivity",
      "Review API rate limits",
      "Check API documentation",
    ],
  },
  {
    type: "database_error",
    pattern:
      /database.*error|db.*error|query.*error|connection.*error|connection refused|econnrefused|database.*unavailable/i,
    category: "execution",
    severity: "high",
    isRecoverable: true,
    suggestedFixes: [
      "Check database connection string",
      "Verify database is running",
      "Check query syntax",
      "Review database permissions",
    ],
  },
  {
    type: "file_operation_error",
    pattern:
      /file.*error|read.*error|write.*error|permission.*error|file not found|enoent|eacces|eisdir/i,
    category: "execution",
    severity: "medium",
    isRecoverable: true,
    suggestedFixes: [
      "Verify file paths and permissions",
      "Check file exists before operation",
      "Review file system permissions",
      "Ensure proper error handling",
    ],
  },
  {
    type: "network_error",
    pattern:
      /network.*error|socket.*error|connection.*error|enotfound|getaddrinfo|dns.*error|unreachable|connection refused/i,
    category: "execution",
    severity: "high",
    isRecoverable: true,
    suggestedFixes: [
      "Check network connectivity",
      "Verify server is reachable",
      "Check DNS resolution",
      "Review firewall settings",
    ],
  },

  // ==================== TIMEOUT ERRORS ====================
  {
    type: "timeout_error",
    pattern:
      /timeout|timed out|exceeded.*timeout|deadline exceeded|took too long|request timeout/i,
    category: "timeout",
    severity: "high",
    isRecoverable: true,
    suggestedFixes: [
      "Increase timeout threshold",
      "Optimize tool performance",
      "Break large tasks into smaller steps",
      "Check server response times",
    ],
  },
  {
    type: "connection_timeout",
    pattern: /connection.*timeout|connect timeout|connection timed out/i,
    category: "timeout",
    severity: "high",
    isRecoverable: true,
    suggestedFixes: [
      "Check server availability",
      "Increase connection timeout",
      "Verify network connectivity",
      "Review firewall rules",
    ],
  },

  // ==================== PERMISSION & AUTHENTICATION ERRORS ====================
  {
    type: "permission_denied",
    pattern:
      /permission denied|access denied|unauthorized|forbidden|no access|not allowed|insufficient permissions|eperm/i,
    category: "permission",
    severity: "high",
    isRecoverable: false,
    suggestedFixes: [
      "Check user permissions",
      "Verify access control settings",
      "Review authorization tokens",
      "Check resource ownership",
    ],
  },
  {
    type: "authentication_error",
    pattern:
      /authentication failed|invalid.*token|expired.*token|not authenticated|unauthorized|invalid credentials|auth.*failed|login.*failed|bearer token/i,
    category: "permission",
    severity: "high",
    isRecoverable: false,
    suggestedFixes: [
      "Re-authenticate user",
      "Refresh authentication token",
      "Check API key/credentials",
      "Verify token expiration",
    ],
  },
  {
    type: "credentials_error",
    pattern:
      /invalid.*credentials|wrong.*password|invalid.*key|bad.*key|invalid.*secret|unauthorized access/i,
    category: "permission",
    severity: "high",
    isRecoverable: false,
    suggestedFixes: [
      "Verify credentials are correct",
      "Check for typos",
      "Regenerate API keys if needed",
      "Verify secret values",
    ],
  },

  // ==================== SYSTEM ERRORS ====================
  {
    type: "out_of_memory",
    pattern:
      /out of memory|memory.*exceeded|heap.*size|ran out of memory|oom|enomem/i,
    category: "system",
    severity: "critical",
    isRecoverable: false,
    suggestedFixes: [
      "Optimize memory usage",
      "Process data in chunks",
      "Increase available memory",
      "Review for memory leaks",
    ],
  },
  {
    type: "resource_not_found",
    pattern:
      /not found|does not exist|enoent|no such file|no such directory|404|not exist/i,
    category: "system",
    severity: "medium",
    isRecoverable: false,
    suggestedFixes: [
      "Verify resource paths",
      "Check file/directory existence",
      "Review resource configuration",
      "Ensure resources are created before use",
    ],
  },
  {
    type: "disk_space_error",
    pattern:
      /no space left on device|disk.*full|enospc|out of disk|storage.*full/i,
    category: "system",
    severity: "critical",
    isRecoverable: false,
    suggestedFixes: [
      "Free up disk space",
      "Remove temporary files",
      "Archive old logs",
      "Increase storage capacity",
    ],
  },
  {
    type: "system_resource_error",
    pattern:
      /too many open files|ulimit|resource.*exhausted|emfile|enfile|resource busy/i,
    category: "system",
    severity: "high",
    isRecoverable: true,
    suggestedFixes: [
      "Close unused file handles",
      "Increase file descriptor limit",
      "Restart service",
      "Check for file handle leaks",
    ],
  },

  // ==================== CONFIGURATION ERRORS ====================
  {
    type: "config_error",
    pattern:
      /configuration error|config.*error|invalid.*config|bad configuration|misconfigured/i,
    category: "execution",
    severity: "medium",
    isRecoverable: false,
    suggestedFixes: [
      "Review configuration file",
      "Check environment variables",
      "Verify settings are valid",
      "Consult documentation",
    ],
  },
  {
    type: "environment_error",
    pattern: /environment variable|undefined.*env|missing.*env|env.*not set/i,
    category: "execution",
    severity: "medium",
    isRecoverable: false,
    suggestedFixes: [
      "Set required environment variables",
      "Check .env file",
      "Verify variable names",
      "Review documentation for required vars",
    ],
  },
];

/**
 * Severity thresholds for automatic alerting
 */
export const SEVERITY_CONFIG = {
  critical: {
    shouldAlert: true,
    alertDelay: 0, // Immediate
    notificationLevel: "urgent",
  },
  high: {
    shouldAlert: true,
    alertDelay: 5 * 60 * 1000, // 5 minutes
    notificationLevel: "warning",
  },
  medium: {
    shouldAlert: false,
    alertDelay: 30 * 60 * 1000, // 30 minutes
    notificationLevel: "info",
  },
  low: {
    shouldAlert: false,
    alertDelay: 60 * 60 * 1000, // 1 hour
    notificationLevel: "debug",
  },
};

/**
 * Retention policies for error logs
 */
export const RETENTION_POLICY = {
  critical: 90 * 24 * 60 * 60 * 1000, // 90 days
  high: 30 * 24 * 60 * 60 * 1000, // 30 days
  medium: 14 * 24 * 60 * 60 * 1000, // 14 days
  low: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Recovery behavior configuration
 */
export const RECOVERY_CONFIG = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
};
