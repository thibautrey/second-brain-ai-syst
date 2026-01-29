/**
 * Smart Retry Service
 *
 * Provides intelligent retry logic for chat interactions when:
 * - Tool executions fail
 * - LLM returns empty responses
 * - The response quality is poor
 *
 * The retry mechanism provides context to the LLM about what failed
 * so it can try a different approach.
 *
 * PRINCIPLE: Never leave the user without information about what's happening.
 */

export interface ToolFailure {
  toolName: string;
  error: string;
  timestamp: Date;
  params?: Record<string, any>;
}

export interface RetryContext {
  /** Number of retry attempts made */
  attemptNumber: number;
  /** Maximum retries allowed */
  maxRetries: number;
  /** List of tool failures in this flow */
  toolFailures: ToolFailure[];
  /** Whether we had an empty response */
  hadEmptyResponse: boolean;
  /** Previous response (if any) that was rejected */
  previousResponse?: string;
  /** Reason for retry */
  retryReason: RetryReason;
  /** Timestamp when retry was initiated */
  retryTimestamp: Date;
  /** List of tools that should be blocked from being used again */
  blockedTools: string[];
}

export type RetryReason =
  | "empty_response"
  | "tool_failure"
  | "all_tools_failed"
  | "response_quality"
  | "timeout";

export interface RetryDecision {
  shouldRetry: boolean;
  retryContext?: RetryContext;
  userMessage?: string;
  systemMessage?: string;
}

export interface SmartRetryConfig {
  /** Maximum number of retries for empty responses (default: 2) */
  maxEmptyResponseRetries: number;
  /** Maximum number of retries for tool failures (default: 2) */
  maxToolFailureRetries: number;
  /** Minimum response length to consider valid (default: 10) */
  minResponseLength: number;
  /** Whether to enable smart retry (can be disabled) */
  enabled: boolean;
}

const DEFAULT_CONFIG: SmartRetryConfig = {
  maxEmptyResponseRetries: 5,
  maxToolFailureRetries: 5,
  minResponseLength: 10,
  enabled: true,
};

/**
 * Smart Retry Service
 *
 * Handles detection of failures and provides context for intelligent retries.
 */
export class SmartRetryService {
  private config: SmartRetryConfig;

  constructor(config: Partial<SmartRetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze the current state and decide if a retry is needed
   */
  analyzeAndDecide(params: {
    response: string;
    toolResults: Array<{
      toolUsed: string;
      success: boolean;
      error?: string;
      params?: any;
    }>;
    currentAttempt: number;
    previousContext?: RetryContext;
  }): RetryDecision {
    if (!this.config.enabled) {
      return { shouldRetry: false };
    }

    const { response, toolResults, currentAttempt, previousContext } = params;

    // Check for empty or too short response
    const isEmptyResponse =
      !response || response.trim().length < this.config.minResponseLength;

    // Check for tool failures
    const failedTools = toolResults.filter((r) => !r.success);
    const allToolsFailed =
      toolResults.length > 0 && failedTools.length === toolResults.length;
    const hasToolFailures = failedTools.length > 0;

    // Build tool failure list
    const toolFailures: ToolFailure[] = failedTools.map((t) => ({
      toolName: t.toolUsed,
      error: t.error || "Unknown error",
      timestamp: new Date(),
      params: t.params,
    }));

    // Determine retry reason
    let retryReason: RetryReason | null = null;

    if (isEmptyResponse && allToolsFailed) {
      retryReason = "all_tools_failed";
    } else if (isEmptyResponse) {
      retryReason = "empty_response";
    } else if (allToolsFailed) {
      retryReason = "all_tools_failed";
    }

    // Determine max retries based on reason
    const maxRetries = this.getMaxRetries(retryReason);

    // Should we retry?
    if (retryReason && currentAttempt < maxRetries) {
      // Merge with previous context if exists
      const allToolFailures = [
        ...(previousContext?.toolFailures || []),
        ...toolFailures,
      ];

      // Build list of tools that should be blocked (failed 2+ times)
      const failureCounts: Record<string, number> = {};
      for (const failure of allToolFailures) {
        failureCounts[failure.toolName] =
          (failureCounts[failure.toolName] || 0) + 1;
      }
      const blockedTools = Object.entries(failureCounts)
        .filter(([, count]) => count >= 2)
        .map(([name]) => name);

      const retryContext: RetryContext = {
        attemptNumber: currentAttempt + 1,
        maxRetries,
        toolFailures: allToolFailures,
        hadEmptyResponse: isEmptyResponse,
        previousResponse: response.length > 0 ? response : undefined,
        retryReason,
        retryTimestamp: new Date(),
        blockedTools,
      };

      return {
        shouldRetry: true,
        retryContext,
        userMessage: this.generateUserMessage(retryContext),
        systemMessage: this.generateSystemMessage(retryContext),
      };
    }

    return { shouldRetry: false };
  }

  /**
   * Get the maximum retries for a given reason
   */
  private getMaxRetries(reason: RetryReason | null): number {
    switch (reason) {
      case "empty_response":
        return this.config.maxEmptyResponseRetries;
      case "tool_failure":
      case "all_tools_failed":
        return this.config.maxToolFailureRetries;
      default:
        return 1;
    }
  }

  /**
   * Generate a user-friendly message about what's happening
   */
  generateUserMessage(context: RetryContext): string {
    const { retryReason, attemptNumber, maxRetries, toolFailures } = context;

    const attemptInfo = `(attempt ${attemptNumber}/${maxRetries})`;

    switch (retryReason) {
      case "empty_response":
        return `I'm refining my response ${attemptInfo}...`;

      case "tool_failure":
        const failedTool =
          toolFailures[toolFailures.length - 1]?.toolName || "tool";
        return `The ${failedTool} encountered an issue, trying an alternative approach ${attemptInfo}...`;

      case "all_tools_failed":
        const toolNames = [
          ...new Set(toolFailures.map((t) => t.toolName)),
        ].join(", ");
        return `Unable to use ${toolNames}. Finding an alternative way to help you ${attemptInfo}...`;

      case "response_quality":
        return `Improving response quality ${attemptInfo}...`;

      case "timeout":
        return `Request took too long, retrying ${attemptInfo}...`;

      default:
        return `Processing your request ${attemptInfo}...`;
    }
  }

  /**
   * Generate a system message to inject into the conversation for retry
   * This helps the LLM understand what went wrong and try differently
   */
  generateSystemMessage(context: RetryContext): string {
    const { retryReason, toolFailures, hadEmptyResponse, attemptNumber } =
      context;

    const parts: string[] = [];

    parts.push(`[RETRY CONTEXT - Attempt ${attemptNumber}/5]`);

    if (hadEmptyResponse) {
      parts.push(
        "⚠️ CRITICAL: Your previous response was empty or too short. You MUST provide a helpful response to the user.",
      );
    }

    if (toolFailures.length > 0) {
      parts.push("\n❌ TOOLS THAT FAILED (DO NOT USE THESE AGAIN):");
      const uniqueFailures = this.getUniqueToolFailures(toolFailures);
      const failedToolNames = uniqueFailures.map((f) => f.toolName);

      // Count how many times each tool failed
      const failureCounts: Record<string, number> = {};
      for (const failure of toolFailures) {
        failureCounts[failure.toolName] =
          (failureCounts[failure.toolName] || 0) + 1;
      }

      for (const failure of uniqueFailures) {
        const count = failureCounts[failure.toolName];
        parts.push(
          `- ${failure.toolName} (failed ${count}x): ${failure.error}`,
        );
      }

      parts.push("\n🚨 MANDATORY INSTRUCTIONS FOR RETRY:");
      parts.push(
        "1. ❌ FORBIDDEN: Do NOT call any tool that has already failed. The system will reject it.",
      );
      parts.push("2. ✅ REQUIRED: You MUST use a DIFFERENT approach or tool.");
      parts.push(
        "3. ✅ REQUIRED: If all tools fail, respond with your knowledge IMMEDIATELY.",
      );

      parts.push("\n📋 ALTERNATIVE STRATEGIES:");

      if (failedToolNames.includes("brave_search")) {
        parts.push(
          "\n🔍 brave_search FAILED - Use these alternatives instead:",
        );
        parts.push(
          "   • Use 'browser' tool with action='get_content' on: Wikipedia, official docs, news sites",
        );
        parts.push(
          "   • Example: browser({ url: 'https://en.wikipedia.org/wiki/[topic]', action: 'get_content' })",
        );
        parts.push(
          "   • Or use 'curl' to fetch from a relevant API or website",
        );
        parts.push(
          "   • If attempt >= 3: STOP trying tools and answer from your knowledge base",
        );
      }

      if (failedToolNames.includes("browser")) {
        parts.push("\n🌐 browser FAILED - Alternatives:");
        parts.push("   • Try a different URL or simpler webpage");
        parts.push("   • Use 'curl' for plain text content");
        parts.push("   • Answer from knowledge if websites are unavailable");
      }

      if (failedToolNames.includes("memory_search")) {
        parts.push("\n🧠 memory_search FAILED:");
        parts.push("   • Proceed without memory context");
        parts.push("   • Ask clarifying questions if needed");
      }

      if (
        failedToolNames.includes("http_request") ||
        failedToolNames.includes("curl")
      ) {
        parts.push("\n🔗 API/HTTP FAILED:");
        parts.push("   • The service may be down - inform the user");
        parts.push("   • Try browser tool for web content instead");
      }

      // Force knowledge-based response after multiple failures
      if (attemptNumber >= 3) {
        parts.push("\n⚡ IMPORTANT: This is attempt " + attemptNumber + "/5.");
        parts.push(
          "If external tools keep failing, you MUST provide an answer using your training knowledge.",
        );
        parts.push(
          "Prefix your answer with: '⚠️ Unable to fetch live data. Based on my knowledge:'",
        );
      }

      parts.push(
        "\n4. ALWAYS provide a helpful response, even if limited. Never leave the user without information.",
      );
      parts.push(
        "5. If you cannot complete the task, explain what you tried and what the user can do instead.",
      );
    }

    return parts.join("\n");
  }

  /**
   * Get unique tool failures (deduplicated by tool name)
   */
  private getUniqueToolFailures(failures: ToolFailure[]): ToolFailure[] {
    const seen = new Set<string>();
    return failures.filter((f) => {
      if (seen.has(f.toolName)) return false;
      seen.add(f.toolName);
      return true;
    });
  }

  /**
   * Build a fallback response when all retries are exhausted
   * This ensures the user ALWAYS gets a response
   */
  buildFallbackResponse(
    context: RetryContext,
    originalMessage: string,
  ): string {
    const { toolFailures, retryReason } = context;

    const parts: string[] = [];

    parts.push(
      "I'm sorry, but I couldn't complete your request satisfactorily.",
    );
    parts.push("");

    if (toolFailures.length > 0) {
      const failedToolNames = [...new Set(toolFailures.map((t) => t.toolName))];
      parts.push(`**Issues encountered:**`);

      for (const toolName of failedToolNames) {
        const failure = toolFailures.find((f) => f.toolName === toolName);
        const friendlyName = this.getFriendlyToolName(toolName);
        parts.push(`- ${friendlyName} could not be used`);
      }
      parts.push("");
    }

    parts.push("**What you can do:**");
    parts.push("1. Rephrase your question differently");
    parts.push("2. Try again in a few moments");
    parts.push("3. Ask a question that doesn't require external tools");
    parts.push("");
    parts.push("I'm still here to help you with other questions!");

    return parts.join("\n");
  }

  /**
   * Get a user-friendly tool name
   */
  private getFriendlyToolName(toolName: string): string {
    const friendlyNames: Record<string, string> = {
      brave_search: "Web search",
      browser: "Web browser",
      memory_search: "Memory search",
      http_request: "API call",
      curl: "HTTP call",
      scheduled_task: "Task scheduling",
      notification: "Notification system",
      todo: "Task manager",
    };

    return friendlyNames[toolName] || `The ${toolName} tool`;
  }

  /**
   * Check if a retry should include a status message to the user
   */
  shouldNotifyUser(context: RetryContext): boolean {
    // Always notify on retry to keep user informed
    return true;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SmartRetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SmartRetryConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const smartRetryService = new SmartRetryService();

// Export types and defaults
export { DEFAULT_CONFIG as SMART_RETRY_DEFAULT_CONFIG };
