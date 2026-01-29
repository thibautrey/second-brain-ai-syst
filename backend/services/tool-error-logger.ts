/**
 * Tool Error Logger Service
 * Provides comprehensive error tracking and detailed logging for tool executions
 *
 * Features:
 * - Full stack traces and error context
 * - Request/response cycle tracking
 * - Performance metrics during failures
 * - Error categorization and pattern detection
 * - Persistent storage for debugging
 */

import prisma from "./prisma.js";

export interface ToolErrorLogEntry {
  id?: string;
  toolId: string;
  userId: string;
  action?: string;
  errorMessage: string;
  errorStack?: string;
  errorType?: string;
  errorCode?: string;
  category?:
    | "validation"
    | "execution"
    | "timeout"
    | "system"
    | "permission"
    | "unknown";
  severity?: "low" | "medium" | "high" | "critical";

  // Request details
  requestParams?: Record<string, any>;
  requestSize?: number;

  // Response/Result details
  partialResult?: Record<string, any>;
  responseSize?: number;

  // Timing
  startedAt: Date;
  endedAt: Date;
  executionTimeMs: number;

  // Execution context
  flowId?: string;
  sessionId?: string;
  iterationCount?: number;

  // Recovery details
  isRecoverable?: boolean;
  suggestedRecovery?: string;

  // Related info
  relatedToolId?: string; // If error triggered by another tool
  metadata?: Record<string, any>;

  createdAt?: Date;
}

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

// Error pattern definitions for automatic categorization
const ERROR_PATTERNS: ErrorPattern[] = [
  // Validation errors
  {
    type: "schema_validation_error",
    pattern: /validation failed|invalid parameter|required parameter missing/i,
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
    pattern: /expected .* got .*|type.*mismatch|cannot assign.*to/i,
    category: "validation",
    severity: "medium",
    isRecoverable: false,
    suggestedFixes: [
      "Verify parameter types",
      "Check variable assignments",
      "Review function signatures",
    ],
  },

  // Execution errors
  {
    type: "undefined_reference",
    pattern:
      /undefined|is not defined|cannot read.*undefined|null is not an object/i,
    category: "execution",
    severity: "high",
    isRecoverable: true,
    suggestedFixes: [
      "Check if variable is initialized before use",
      "Add null/undefined checks",
      "Review dependency injection",
    ],
  },
  {
    type: "runtime_error",
    pattern: /runtime error|exception|error executing|failed to execute/i,
    category: "execution",
    severity: "high",
    isRecoverable: true,
    suggestedFixes: [
      "Review error stack trace",
      "Check for edge cases in logic",
      "Add error boundaries",
    ],
  },
  {
    type: "api_error",
    pattern: /http error|status code [45]\d{2}|api.*error|request failed/i,
    category: "execution",
    severity: "medium",
    isRecoverable: true,
    suggestedFixes: [
      "Check API endpoint and credentials",
      "Verify network connectivity",
      "Review API rate limits",
    ],
  },

  // Timeout errors
  {
    type: "timeout_error",
    pattern: /timeout|timed out|exceeded.*timeout|deadline exceeded/i,
    category: "timeout",
    severity: "high",
    isRecoverable: true,
    suggestedFixes: [
      "Increase timeout threshold",
      "Optimize tool performance",
      "Break large tasks into smaller steps",
    ],
  },

  // Permission/Access errors
  {
    type: "permission_denied",
    pattern:
      /permission denied|access denied|unauthorized|forbidden|no access/i,
    category: "permission",
    severity: "high",
    isRecoverable: false,
    suggestedFixes: [
      "Check authentication credentials",
      "Verify user permissions",
      "Review access control settings",
    ],
  },
  {
    type: "authentication_error",
    pattern:
      /authentication failed|invalid.*token|expired.*token|not authenticated/i,
    category: "permission",
    severity: "high",
    isRecoverable: false,
    suggestedFixes: [
      "Re-authenticate user",
      "Refresh authentication token",
      "Check API key/credentials",
    ],
  },

  // System errors
  {
    type: "out_of_memory",
    pattern: /out of memory|memory.*exceeded|heap.*size/i,
    category: "system",
    severity: "critical",
    isRecoverable: false,
    suggestedFixes: [
      "Optimize memory usage",
      "Process data in chunks",
      "Increase available memory",
    ],
  },
  {
    type: "resource_not_found",
    pattern: /not found|does not exist|enoent|no such file/i,
    category: "system",
    severity: "medium",
    isRecoverable: false,
    suggestedFixes: [
      "Verify resource paths",
      "Check file/directory existence",
      "Review resource configuration",
    ],
  },
];

export class ToolErrorLogger {
  /**
   * Log a tool execution error with full context
   */
  async logError(entry: ToolErrorLogEntry): Promise<string> {
    const startTime = Date.now();

    try {
      // Categorize error
      const categorized = this.categorizeError(entry.errorMessage);

      const logEntry: ToolErrorLogEntry = {
        ...entry,
        category: categorized.category,
        severity: categorized.severity,
        isRecoverable: categorized.isRecoverable,
        suggestedRecovery: categorized.suggestedFixes?.[0],
        errorType: categorized.type,
        createdAt: new Date(),
      };

      // Console output for immediate visibility
      this.printErrorLog(logEntry);

      // Persist to database
      let savedId: string | undefined;
      try {
        const saved = await prisma.toolErrorLog.create({
          data: {
            toolId: entry.toolId,
            userId: entry.userId,
            action: entry.action,
            errorMessage: entry.errorMessage,
            errorStack: entry.errorStack,
            errorType: categorized.type,
            errorCode: entry.errorCode,
            category: categorized.category,
            severity: categorized.severity,
            requestParams: entry.requestParams
              ? JSON.stringify(entry.requestParams)
              : null,
            requestSize: entry.requestSize,
            partialResult: entry.partialResult
              ? JSON.stringify(entry.partialResult)
              : null,
            responseSize: entry.responseSize,
            startedAt: entry.startedAt,
            endedAt: entry.endedAt,
            executionTimeMs: entry.executionTimeMs,
            flowId: entry.flowId,
            sessionId: entry.sessionId,
            iterationCount: entry.iterationCount,
            isRecoverable: categorized.isRecoverable,
            suggestedRecovery: categorized.suggestedFixes?.[0],
            relatedToolId: entry.relatedToolId,
            metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          } as any,
        });
        savedId = (saved as any).id;
      } catch (dbError) {
        console.error(
          "[ToolErrorLogger] Failed to persist error log to DB:",
          dbError,
        );
      }

      return savedId || `error-${Date.now()}`;
    } catch (error) {
      console.error("[ToolErrorLogger] Failed to log error:", error);
      throw error;
    }
  }

  /**
   * Categorize error and detect patterns
   */
  categorizeError(errorMessage: string): {
    type: string;
    category: ToolErrorLogEntry["category"];
    severity: ToolErrorLogEntry["severity"];
    isRecoverable: boolean;
    suggestedFixes?: string[];
  } {
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(errorMessage)) {
        return {
          type: pattern.type,
          category: pattern.category,
          severity: pattern.severity,
          isRecoverable: pattern.isRecoverable,
          suggestedFixes: pattern.suggestedFixes,
        };
      }
    }

    return {
      type: "unknown_error",
      category: "unknown",
      severity: "medium",
      isRecoverable: true,
    };
  }

  /**
   * Print detailed error log to console
   */
  printErrorLog(entry: ToolErrorLogEntry): void {
    const separator = "═".repeat(80);
    const timestamp = new Date().toISOString();

    console.error(`\n${separator}`);
    console.error(`⚠️  TOOL EXECUTION ERROR - ${timestamp}`);
    console.error(`${separator}`);

    // Basic info
    console.error(`\n📋 TOOL INFORMATION:`);
    console.error(`  Tool ID:        ${entry.toolId}`);
    console.error(`  User ID:        ${entry.userId}`);
    console.error(`  Action:         ${entry.action || "N/A"}`);
    if (entry.flowId) console.error(`  Flow ID:        ${entry.flowId}`);

    // Error details
    console.error(`\n❌ ERROR DETAILS:`);
    console.error(`  Type:           ${entry.errorType || "Unknown"}`);
    console.error(
      `  Severity:       ${entry.severity || "Unknown"} [${this.getSeverityEmoji(entry.severity)}]`,
    );
    console.error(`  Category:       ${entry.category || "Unknown"}`);
    console.error(
      `  Recoverable:    ${entry.isRecoverable ? "✓ YES" : "✗ NO"}`,
    );
    console.error(`  Message:        ${entry.errorMessage}`);

    if (entry.errorCode) {
      console.error(`  Error Code:     ${entry.errorCode}`);
    }

    // Request context
    if (entry.requestParams) {
      console.error(`\n📥 REQUEST CONTEXT:`);
      console.error(
        `  Parameters:     ${JSON.stringify(entry.requestParams, null, 2).split("\n").join("\n                 ")}`,
      );
      if (entry.requestSize) {
        console.error(
          `  Size:           ${(entry.requestSize / 1024).toFixed(2)} KB`,
        );
      }
    }

    // Timing information
    console.error(`\n⏱️  TIMING:`);
    console.error(`  Started:        ${entry.startedAt.toISOString()}`);
    console.error(`  Ended:          ${entry.endedAt.toISOString()}`);
    console.error(`  Duration:       ${entry.executionTimeMs}ms`);

    // Stack trace if available
    if (entry.errorStack) {
      console.error(`\n📍 STACK TRACE:`);
      const stackLines = entry.errorStack.split("\n");
      stackLines.forEach((line) => {
        console.error(`  ${line}`);
      });
    }

    // Partial result if available
    if (entry.partialResult) {
      console.error(`\n📤 PARTIAL RESULT:`);
      console.error(
        `  ${JSON.stringify(entry.partialResult, null, 2).split("\n").join("\n  ")}`,
      );
    }

    // Recovery suggestions
    if (entry.suggestedRecovery) {
      console.error(`\n💡 SUGGESTED RECOVERY:`);
      console.error(`  ${entry.suggestedRecovery}`);
    }

    // Additional metadata
    if (entry.metadata) {
      console.error(`\n🔧 METADATA:`);
      console.error(
        `  ${JSON.stringify(entry.metadata, null, 2).split("\n").join("\n  ")}`,
      );
    }

    console.error(`\n${separator}\n`);
  }

  /**
   * Get emoji for severity level
   */
  getSeverityEmoji(severity?: string): string {
    switch (severity) {
      case "critical":
        return "🔴";
      case "high":
        return "🟠";
      case "medium":
        return "🟡";
      case "low":
        return "🟢";
      default:
        return "⚪";
    }
  }

  /**
   * Query error logs with filters
   */
  async queryErrorLogs(filters: {
    toolId?: string;
    userId?: string;
    category?: string;
    severity?: string;
    isRecoverable?: boolean;
    since?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ToolErrorLogEntry[]> {
    try {
      const where: any = {};

      if (filters.toolId) where.toolId = filters.toolId;
      if (filters.userId) where.userId = filters.userId;
      if (filters.category) where.category = filters.category;
      if (filters.severity) where.severity = filters.severity;
      if (filters.isRecoverable !== undefined)
        where.isRecoverable = filters.isRecoverable;
      if (filters.since) {
        where.createdAt = { gte: filters.since };
      }

      const logs = await (prisma as any).toolErrorLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      });

      return logs;
    } catch (error) {
      console.error("[ToolErrorLogger] Failed to query error logs:", error);
      return [];
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStatistics(toolId?: string): Promise<{
    totalErrors: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    recoveryRate: number;
  }> {
    try {
      const where = toolId ? { toolId } : {};

      const logs = await (prisma as any).toolErrorLog.findMany({
        where,
      });

      const byCategory: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      let recoverableCount = 0;

      for (const log of logs) {
        byCategory[log.category] = (byCategory[log.category] || 0) + 1;
        bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
        if (log.isRecoverable) recoverableCount++;
      }

      return {
        totalErrors: logs.length,
        byCategory,
        bySeverity,
        recoveryRate: logs.length > 0 ? recoverableCount / logs.length : 0,
      };
    } catch (error) {
      console.error("[ToolErrorLogger] Failed to get error statistics:", error);
      return {
        totalErrors: 0,
        byCategory: {},
        bySeverity: {},
        recoveryRate: 0,
      };
    }
  }
}

export const toolErrorLogger = new ToolErrorLogger();
