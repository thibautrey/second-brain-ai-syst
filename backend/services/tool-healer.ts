/**
 * Tool Healer Service
 *
 * Proactive self-healing agent that monitors tool health and automatically
 * repairs tools that encounter errors.
 *
 * Features:
 * - Continuous health monitoring
 * - Pattern-based error analysis
 * - Automatic code repair via LLM
 * - Rollback capability
 * - Detailed health reports
 * - Notification system for issues requiring attention
 *
 * IMPORTANT: Run `npx prisma migrate dev` after adding the new models to schema.prisma
 */

import { GeneratedTool, PrismaClient } from "@prisma/client";

import { codeExecutorService } from "./code-executor-wrapper.js";
import { llmRouterService } from "./llm-router.js";
import { notificationService } from "./notification.js";
import { secretsService } from "./secrets.js";
import { wsBroadcastService } from "./websocket-broadcast.js";
import * as persistence from "./tool-workflow-persistence.js";

const prisma = new PrismaClient();

// Type aliases for health report status
type HealthReportStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "FAILING"
  | "HEALING"
  | "HEALED"
  | "REQUIRES_ATTENTION";

// Interface for execution logs (matches Prisma model)
interface ToolExecutionLog {
  id: string;
  toolId: string;
  userId: string;
  inputParams: any;
  success: boolean;
  result: any;
  error: string | null;
  errorType: string | null;
  executionTimeMs: number | null;
  startedAt: Date;
  completedAt: Date | null;
  triggeredBy: string | null;
  metadata: any;
  createdAt: Date;
}

// ==================== Types ====================

export interface HealthCheckResult {
  toolId: string;
  toolName: string;
  status: HealthReportStatus;
  healthScore: number;
  issues: HealthIssue[];
  recommendations: string[];
  autoHealable: boolean;
}

export interface HealthIssue {
  type:
    | "timeout"
    | "network"
    | "auth"
    | "permission"
    | "endpoint"
    | "rate_limit"
    | "server_error"
    | "parsing"
    | "code_error"
    | "dependency"
    | "unknown";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  occurrences: number;
  lastOccurrence: Date;
  suggestedFix?: string;
}

export interface HealingAttempt {
  toolId: string;
  success: boolean;
  originalCode: string;
  healedCode?: string;
  testResult?: any;
  error?: string;
  durationMs: number;
}

export interface ToolHealthSummary {
  totalTools: number;
  healthyTools: number;
  degradedTools: number;
  failingTools: number;
  healingInProgress: number;
  requiresAttention: number;
}

// ==================== Error Pattern Analysis ====================

interface ErrorPattern {
  pattern: RegExp;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  suggestedFix: string;
  autoHealable: boolean;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /timeout|timed out/i,
    type: "timeout",
    severity: "medium",
    suggestedFix: "Increase timeout duration or add retry logic",
    autoHealable: true,
  },
  {
    pattern: /connection refused|ECONNREFUSED/i,
    type: "network",
    severity: "high",
    suggestedFix: "Check API endpoint availability, add fallback URL",
    autoHealable: true,
  },
  {
    pattern: /401|unauthorized|authentication failed/i,
    type: "auth",
    severity: "critical",
    suggestedFix: "Check API key validity, may need user intervention",
    autoHealable: false,
  },
  {
    pattern: /403|forbidden|access denied/i,
    type: "permission",
    severity: "critical",
    suggestedFix: "Check API permissions, may need user intervention",
    autoHealable: false,
  },
  {
    pattern: /404|not found/i,
    type: "endpoint",
    severity: "high",
    suggestedFix: "API endpoint may have changed, update URL",
    autoHealable: true,
  },
  {
    pattern: /429|rate limit|too many requests/i,
    type: "rate_limit",
    severity: "medium",
    suggestedFix: "Add rate limiting, exponential backoff",
    autoHealable: true,
  },
  {
    pattern: /500|internal server error/i,
    type: "server_error",
    severity: "medium",
    suggestedFix: "Add retry logic for transient server errors",
    autoHealable: true,
  },
  {
    pattern: /json|parse|decode/i,
    type: "parsing",
    severity: "high",
    suggestedFix: "Improve JSON parsing, add validation",
    autoHealable: true,
  },
  {
    pattern: /keyerror|attributeerror|typeerror/i,
    type: "code_error",
    severity: "high",
    suggestedFix: "Fix Python code logic, add null checks",
    autoHealable: true,
  },
  {
    pattern: /import|module not found|no module named/i,
    type: "dependency",
    severity: "critical",
    suggestedFix: "Module not available in sandbox, refactor code",
    autoHealable: true,
  },
];

// ==================== Prompts ====================

const HEAL_CODE_SYSTEM_PROMPT = `You are an expert Python developer specialized in debugging and fixing API integration code.

Your task is to analyze error patterns and fix the code to prevent future failures.

**Context:**
- The code runs in a sandboxed Python environment with network access
- Available modules: requests, json, datetime, collections, etc.
- API keys are accessed via os.environ.get('KEY_NAME')
- The code must set a 'result' variable with JSON-serializable output

**Common fixes to apply:**
1. Add proper error handling with try/except
2. Add timeout parameters (default 10s)
3. Add retry logic with exponential backoff
4. Validate API responses before parsing
5. Add null/empty checks
6. Use defensive coding practices

**Error Analysis:**
{error_analysis}

**Output:**
Return ONLY the fixed Python code, no explanations or markdown.
Preserve the original functionality while making it more robust.`;

const ROOT_CAUSE_ANALYSIS_PROMPT = `Analyze these error patterns from a Python tool and determine:

1. Root cause of the failures
2. Whether it can be automatically fixed
3. Specific code changes needed

**Error History:**
{error_history}

**Current Code:**
{code}

**Output JSON:**
{
  "rootCause": "Clear explanation of why the tool is failing",
  "autoHealable": true/false,
  "confidence": 0.0-1.0,
  "suggestedFixes": [
    {
      "description": "What to fix",
      "codeChange": "Specific change to make",
      "priority": 1-5
    }
  ],
  "requiresUserAction": "Description if user needs to do something (e.g., update API key)"
}`;

// ==================== Service ====================

export class ToolHealerService {
  private healingInProgress = new Set<string>();

  /**
   * Run health check for all tools of a user
   */
  async runHealthCheck(userId: string): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    // Get all enabled tools
    const tools = await prisma.generatedTool.findMany({
      where: { userId, enabled: true },
    });

    for (const tool of tools) {
      const result = await this.checkToolHealth(userId, tool);
      results.push(result);

      // Create or update health report
      await this.saveHealthReport(tool.id, result);
    }

    // Notify user of critical issues
    const criticalTools = results.filter(
      (r) => r.status === "FAILING" || r.status === "REQUIRES_ATTENTION",
    );

    if (criticalTools.length > 0) {
      await this.notifyHealthIssues(userId, criticalTools);
    }

    return results;
  }

  /**
   * Check health of a single tool
   */
  async checkToolHealth(
    userId: string,
    tool: GeneratedTool,
  ): Promise<HealthCheckResult> {
    // Get recent execution logs (last 24 hours)
    const recentLogs = await persistence.getToolExecutionLogs(
      tool.id,
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      50,
    );

    // Calculate metrics
    const totalExecutions = recentLogs.length;
    const successfulExecutions = recentLogs.filter((l) => l.success).length;
    const successRate =
      totalExecutions > 0 ? successfulExecutions / totalExecutions : 1;

    // Analyze error patterns
    const issues = this.analyzeErrors(recentLogs);

    // Calculate health score (0-100)
    let healthScore = 100;

    // Deduct for success rate
    healthScore -= Math.round((1 - successRate) * 50);

    // Deduct for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case "critical":
          healthScore -= 30;
          break;
        case "high":
          healthScore -= 20;
          break;
        case "medium":
          healthScore -= 10;
          break;
        case "low":
          healthScore -= 5;
          break;
      }
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Determine status
    let status: HealthReportStatus = "HEALTHY";
    if (healthScore < 30) status = "FAILING";
    else if (healthScore < 60) status = "DEGRADED";
    else if (healthScore < 80) status = "DEGRADED";

    // Check if healing in progress
    if (this.healingInProgress.has(tool.id)) {
      status = "HEALING";
    }

    // Check if requires attention (has non-auto-healable critical issues)
    const requiresAttention = issues.some(
      (i) => i.severity === "critical" && !this.isAutoHealable(i.type),
    );
    if (requiresAttention) {
      status = "REQUIRES_ATTENTION";
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, tool);

    return {
      toolId: tool.id,
      toolName: tool.displayName,
      status,
      healthScore,
      issues,
      recommendations,
      autoHealable: issues.every((i) => this.isAutoHealable(i.type)),
    };
  }

  /**
   * Analyze error patterns in execution logs
   */
  private analyzeErrors(logs: ToolExecutionLog[]): HealthIssue[] {
    const issues: HealthIssue[] = [];
    const errorCounts: Record<
      string,
      { count: number; lastOccurrence: Date; errors: string[] }
    > = {};

    // Group errors by pattern
    for (const log of logs) {
      if (log.success || !log.error) continue;

      for (const pattern of ERROR_PATTERNS) {
        if (pattern.pattern.test(log.error)) {
          if (!errorCounts[pattern.type]) {
            errorCounts[pattern.type] = {
              count: 0,
              lastOccurrence: log.createdAt,
              errors: [],
            };
          }
          errorCounts[pattern.type].count++;
          errorCounts[pattern.type].errors.push(log.error);
          if (log.createdAt > errorCounts[pattern.type].lastOccurrence) {
            errorCounts[pattern.type].lastOccurrence = log.createdAt;
          }
          break;
        }
      }
    }

    // Create issues from error counts
    for (const [type, data] of Object.entries(errorCounts)) {
      const pattern = ERROR_PATTERNS.find((p) => p.type === type);
      if (!pattern) continue;

      issues.push({
        type: type as HealthIssue["type"],
        severity: pattern.severity,
        description: `${type.replace(/_/g, " ")} errors detected`,
        occurrences: data.count,
        lastOccurrence: data.lastOccurrence,
        suggestedFix: pattern.suggestedFix,
      });
    }

    return issues.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Check if an issue type is auto-healable
   */
  private isAutoHealable(type: string): boolean {
    const pattern = ERROR_PATTERNS.find((p) => p.type === type);
    return pattern?.autoHealable ?? false;
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(
    issues: HealthIssue[],
    tool: GeneratedTool,
  ): string[] {
    const recommendations: string[] = [];

    if (issues.length === 0) {
      recommendations.push("Tool is healthy, no action needed");
      return recommendations;
    }

    for (const issue of issues) {
      if (issue.suggestedFix) {
        recommendations.push(issue.suggestedFix);
      }
    }

    // Add specific recommendations based on patterns
    const hasAuthIssues = issues.some(
      (i) => i.type === "auth" || i.type === "permission",
    );
    if (hasAuthIssues) {
      recommendations.push(
        "Check and update API credentials in Secrets settings",
      );
    }

    const hasTimeoutIssues = issues.some((i) => i.type === "timeout");
    if (hasTimeoutIssues && tool.timeout < 60000) {
      recommendations.push(
        `Consider increasing tool timeout (currently ${tool.timeout}ms)`,
      );
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Attempt to automatically heal a tool
   */
  async healTool(userId: string, toolId: string): Promise<HealingAttempt> {
    const startTime = Date.now();

    // Prevent concurrent healing
    if (this.healingInProgress.has(toolId)) {
      return {
        toolId,
        success: false,
        originalCode: "",
        error: "Healing already in progress for this tool",
        durationMs: 0,
      };
    }

    this.healingInProgress.add(toolId);

    try {
      // Get tool and recent errors
      const tool = await prisma.generatedTool.findUnique({
        where: { id: toolId },
      });

      if (!tool) {
        throw new Error("Tool not found");
      }

      const recentLogs = await persistence.getToolExecutionLogs(
        toolId,
        undefined,
        10,
        true, // errorsOnly
      );

      if (recentLogs.length === 0) {
        return {
          toolId,
          success: true,
          originalCode: tool.code,
          durationMs: Date.now() - startTime,
        };
      }

      // Update health report status
      await this.updateHealthReportStatus(toolId, "HEALING");

      // Emit healing start event
      wsBroadcastService.sendToUser(userId, {
        type: "tool:healing:started",
        timestamp: Date.now(),
        data: { toolId, toolName: tool.displayName },
      });

      // Perform root cause analysis
      const errorHistory = recentLogs.map((l) => ({
        error: l.error,
        errorType: l.errorType,
        timestamp: l.createdAt,
      }));

      const rootCauseAnalysis = await this.analyzeRootCause(
        userId,
        tool.code,
        errorHistory,
      );

      if (!rootCauseAnalysis.autoHealable) {
        await this.updateHealthReportStatus(toolId, "REQUIRES_ATTENTION", {
          rootCauseAnalysis: rootCauseAnalysis.rootCause,
          suggestedFixes: rootCauseAnalysis.suggestedFixes,
        });

        // Notify user
        await notificationService.createNotification({
          userId,
          type: "WARNING",
          title: `Tool "${tool.displayName}" requires attention`,
          message:
            rootCauseAnalysis.requiresUserAction || rootCauseAnalysis.rootCause,
          actionUrl: `/settings/tools/${toolId}`,
          metadata: { toolId },
        });

        return {
          toolId,
          success: false,
          originalCode: tool.code,
          error: `Cannot auto-heal: ${rootCauseAnalysis.rootCause}`,
          durationMs: Date.now() - startTime,
        };
      }

      // Generate healed code
      const healedCode = await this.generateHealedCode(
        userId,
        tool.code,
        errorHistory,
        rootCauseAnalysis,
      );

      // Test the healed code
      const secretValues = await secretsService.getSecretsValues(
        userId,
        tool.requiredSecrets,
      );

      const testResult = await codeExecutorService.executeWithNetwork(
        healedCode,
        secretValues,
        tool.timeout / 1000,
        2,
      );

      if (testResult.success) {
        // Update tool with healed code
        await prisma.generatedTool.update({
          where: { id: toolId },
          data: {
            code: healedCode,
            previousCode: tool.code,
            version: tool.version + 1,
            lastError: null,
            lastErrorAt: null,
            isVerified: true,
          },
        });

        // Update health report
        await this.updateHealthReportStatus(toolId, "HEALED", {
          healedCode,
          testResult,
        });

        // Log the healing
        await persistence.createExecutionLog({
          toolId,
          userId,
          success: true,
          result: { healed: true, testResult: testResult.result },
          triggeredBy: "auto_heal",
          startedAt: new Date(startTime),
          completedAt: new Date(),
          executionTimeMs: Date.now() - startTime,
        });

        // Emit success event
        wsBroadcastService.sendToUser(userId, {
          type: "tool:healing:completed",
          timestamp: Date.now(),
          data: {
            toolId,
            toolName: tool.displayName,
            success: true,
          },
        });

        return {
          toolId,
          success: true,
          originalCode: tool.code,
          healedCode,
          testResult: testResult.result,
          durationMs: Date.now() - startTime,
        };
      }

      // Healing failed - keep original code
      await this.updateHealthReportStatus(toolId, "FAILING", {
        healingAttempted: true,
        healingError: testResult.error,
      });

      return {
        toolId,
        success: false,
        originalCode: tool.code,
        healedCode,
        error: `Healed code failed: ${testResult.error}`,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.healingInProgress.delete(toolId);
    }
  }

  /**
   * Analyze root cause of errors
   */
  private async analyzeRootCause(
    userId: string,
    code: string,
    errorHistory: any[],
  ): Promise<{
    rootCause: string;
    autoHealable: boolean;
    confidence: number;
    suggestedFixes: any[];
    requiresUserAction?: string;
  }> {
    const prompt = ROOT_CAUSE_ANALYSIS_PROMPT.replace(
      "{error_history}",
      JSON.stringify(errorHistory, null, 2),
    ).replace("{code}", code);

    try {
      const response = await llmRouterService.executeTask(
        userId,
        "analysis",
        prompt,
        "You are an expert at debugging Python code. Analyze errors and provide solutions.",
        { temperature: 0.2, responseFormat: "json" },
      );

      // Parse JSON response
      let jsonStr = response;
      const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      return JSON.parse(jsonStr.trim());
    } catch (error) {
      // Default analysis
      return {
        rootCause: "Unable to determine root cause",
        autoHealable: true,
        confidence: 0.5,
        suggestedFixes: [
          { description: "Add better error handling", priority: 1 },
          { description: "Add retry logic", priority: 2 },
        ],
      };
    }
  }

  /**
   * Generate healed code
   */
  private async generateHealedCode(
    userId: string,
    originalCode: string,
    errorHistory: any[],
    analysis: any,
  ): Promise<string> {
    const errorAnalysis = `
Root Cause: ${analysis.rootCause}

Recent Errors:
${errorHistory.map((e, i) => `${i + 1}. ${e.error}`).join("\n")}

Suggested Fixes:
${analysis.suggestedFixes?.map((f: any) => `- ${f.description}`).join("\n") || "Add error handling"}
`;

    const prompt = `Fix this Python code to prevent these errors:

\`\`\`python
${originalCode}
\`\`\``;

    const systemPrompt = HEAL_CODE_SYSTEM_PROMPT.replace(
      "{error_analysis}",
      errorAnalysis,
    );

    const response = await llmRouterService.executeTask(
      userId,
      "analysis", // Use analysis for code fix generation
      prompt,
      systemPrompt,
      { temperature: 0.2 },
    );

    // Clean code
    let code = response;
    if (code.startsWith("```python")) code = code.slice(9);
    if (code.startsWith("```")) code = code.slice(3);
    if (code.endsWith("```")) code = code.slice(0, -3);

    return code.trim();
  }

  /**
   * Rollback a tool to its previous version
   */
  async rollbackTool(userId: string, toolId: string): Promise<boolean> {
    const tool = await prisma.generatedTool.findUnique({
      where: { id: toolId },
    });

    if (!tool || !tool.previousCode) {
      return false;
    }

    // Verify ownership
    if (tool.userId !== userId) {
      return false;
    }

    await prisma.generatedTool.update({
      where: { id: toolId },
      data: {
        code: tool.previousCode,
        previousCode: tool.code,
        version: tool.version + 1,
        isVerified: false,
      },
    });

    // Update health report
    await this.updateHealthReportStatus(toolId, "DEGRADED", {
      rolledBack: true,
      rollbackTime: new Date(),
    });

    return true;
  }

  /**
   * Save or update health report
   */
  private async saveHealthReport(toolId: string, result: HealthCheckResult) {
    return persistence.saveHealthReport(toolId, {
      status: result.status,
      healthScore: result.healthScore,
      issuesDetected: result.issues,
      suggestedFixes: result.recommendations,
    });
  }

  /**
   * Update health report status
   */
  private async updateHealthReportStatus(
    toolId: string,
    status: HealthReportStatus,
    additionalData?: any,
  ): Promise<void> {
    await persistence.updateHealthReportStatus(toolId, status, additionalData);
  }

  /**
   * Check if report is recent (within 1 hour)
   */
  private isReportRecent(date: Date): boolean {
    return Date.now() - date.getTime() < 60 * 60 * 1000;
  }

  /**
   * Notify user of health issues
  /**
   * Notify user of health issues
   */
  private async notifyHealthIssues(
    userId: string,
    criticalTools: HealthCheckResult[],
  ): Promise<void> {
    const toolNames = criticalTools.map((t) => t.toolName).join(", ");

    await notificationService.createNotification({
      userId,
      type: "WARNING",
      title: "Tool Health Issues Detected",
      message: `${criticalTools.length} tool(s) need attention: ${toolNames}`,
      actionUrl: "/settings/tools",
      metadata: {
        toolIds: criticalTools.map((t) => t.toolId),
        healthScores: criticalTools.map((t) => t.healthScore),
      },
    });
  }

  /**
   * Get health summary for a user
   */
  async getHealthSummary(userId: string): Promise<ToolHealthSummary> {
    const tools = await prisma.generatedTool.findMany({
      where: { userId, enabled: true },
    });

    const toolIds = tools.map((t) => t.id);
    const reportMap = await persistence.getHealthReportsForTools(toolIds);

    let healthy = 0;
    let degraded = 0;
    let failing = 0;
    let healing = 0;
    let attention = 0;

    for (const tool of tools) {
      const report = reportMap.get(tool.id) as { status: string } | undefined;
      if (!report) {
        healthy++;
        continue;
      }

      switch (report.status) {
        case "HEALTHY":
        case "HEALED":
          healthy++;
          break;
        case "DEGRADED":
          degraded++;
          break;
        case "FAILING":
          failing++;
          break;
        case "HEALING":
          healing++;
          break;
        case "REQUIRES_ATTENTION":
          attention++;
          break;
      }
    }

    return {
      totalTools: tools.length,
      healthyTools: healthy,
      degradedTools: degraded,
      failingTools: failing,
      healingInProgress: healing,
      requiresAttention: attention,
    };
  }

  /**
   * Run proactive healing for all users (called by scheduler)
   */
  async runProactiveHealing(): Promise<void> {
    console.log("[ToolHealer] Starting proactive healing run...");

    // Get all users with tools
    const usersWithTools = await prisma.generatedTool.findMany({
      where: { enabled: true },
      select: { userId: true },
      distinct: ["userId"],
    });

    for (const { userId } of usersWithTools) {
      try {
        // Run health check
        const results = await this.runHealthCheck(userId);

        // Auto-heal tools that can be healed
        for (const result of results) {
          if (
            result.autoHealable &&
            (result.status === "FAILING" || result.status === "DEGRADED") &&
            result.healthScore < 70
          ) {
            console.log(
              `[ToolHealer] Auto-healing tool ${result.toolName} for user ${userId}`,
            );
            await this.healTool(userId, result.toolId);
          }
        }
      } catch (error) {
        console.error(`[ToolHealer] Error processing user ${userId}:`, error);
      }
    }

    console.log("[ToolHealer] Proactive healing run completed");
  }

  /**
   * Log tool execution (called after every tool execution)
   */
  async logExecution(
    toolId: string,
    userId: string,
    success: boolean,
    result: any,
    error?: string,
    executionTimeMs?: number,
    triggeredBy = "user_chat",
    inputParams?: any,
  ): Promise<void> {
    // Determine error type
    let errorType: string | undefined;
    if (error) {
      for (const pattern of ERROR_PATTERNS) {
        if (pattern.pattern.test(error)) {
          errorType = pattern.type;
          break;
        }
      }
      errorType = errorType || "unknown";
    }

    await persistence.createExecutionLog({
      toolId,
      userId,
      success,
      result: success ? result : undefined,
      error,
      errorType,
      inputParams,
      executionTimeMs,
      triggeredBy,
      startedAt: new Date(Date.now() - (executionTimeMs || 0)),
      completedAt: new Date(),
    });
  }
}

export const toolHealerService = new ToolHealerService();
