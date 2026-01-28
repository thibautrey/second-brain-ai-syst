/**
 * Tool Workflow Persistence Helper
 *
 * Provides database operations for the tool generation workflow.
 * Gracefully handles cases where tables don't exist yet (before migration).
 *
 * After running `npx prisma migrate dev`, the actual Prisma models will be used.
 * Until then, in-memory tracking is used as fallback.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// In-memory fallback storage (used before migration)
const inMemorySessions = new Map<string, any>();
const inMemoryLogs = new Map<string, any[]>();
const inMemoryHealthReports = new Map<string, any>();
const inMemoryExecutionLogs: any[] = [];

// Track if tables exist
let tablesChecked = false;
let tablesExist = false;

/**
 * Check if the new tables exist in the database
 */
async function checkTablesExist(): Promise<boolean> {
  if (tablesChecked) return tablesExist;

  try {
    // Try to query the tool_generation_sessions table
    await prisma.$queryRaw`SELECT 1 FROM tool_generation_sessions LIMIT 1`;
    tablesExist = true;
  } catch (error: any) {
    // Table doesn't exist yet
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      tablesExist = false;
      console.log(
        "[ToolWorkflowPersistence] Tables not yet created, using in-memory fallback",
      );
    } else {
      // Some other error, assume tables exist but had different issue
      tablesExist = true;
    }
  }

  tablesChecked = true;
  return tablesExist;
}

/**
 * Generate a unique session ID
 */
function generateId(): string {
  return `ses_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ==================== Session Operations ====================

export interface CreateSessionData {
  userId: string;
  objective: string;
  context?: string | null;
  suggestedSecrets?: string[];
  toolId?: string | null;
  maxIterations?: number;
  status?: string;
  startedAt?: Date;
}

export async function createSession(data: CreateSessionData): Promise<any> {
  const useDb = await checkTablesExist();

  if (useDb) {
    try {
      return await (prisma as any).toolGenerationSession.create({
        data: {
          userId: data.userId,
          objective: data.objective,
          context: data.context || null,
          suggestedSecrets: data.suggestedSecrets || [],
          toolId: data.toolId || null,
          maxIterations: data.maxIterations || 5,
          status: "PENDING",
          startedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to create session in DB:",
        error,
      );
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const session = {
    id: generateId(),
    userId: data.userId,
    objective: data.objective,
    context: data.context || null,
    suggestedSecrets: data.suggestedSecrets || [],
    toolId: data.toolId || null,
    maxIterations: data.maxIterations || 5,
    status: "PENDING",
    currentPhase: null,
    progress: 0,
    specDocument: null,
    implementationPlan: null,
    generatedCode: null,
    testCode: null,
    testResults: null,
    schemaJson: null,
    currentIteration: 0,
    lastError: null,
    errorHistory: [],
    startedAt: new Date(),
    completedAt: null,
    totalDurationMs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  inMemorySessions.set(session.id, session);
  inMemoryLogs.set(session.id, []);
  return session;
}

export interface UpdateSessionData {
  status?: string;
  currentPhase?: string | null;
  progress?: number;
  specDocument?: string | null;
  implementationPlan?: string | null;
  generatedCode?: string | null;
  testCode?: string | null;
  testResults?: any;
  schemaJson?: any;
  currentIteration?: number | { increment: number };
  lastError?: string | null;
  errorHistory?: any;
  toolId?: string | null;
  completedAt?: Date | null;
  totalDurationMs?: number | null;
}

export async function updateSession(
  sessionId: string,
  data: UpdateSessionData,
): Promise<any> {
  const useDb = await checkTablesExist();

  // Handle the increment syntax for currentIteration
  let processedData: any = { ...data };
  if (
    data.currentIteration &&
    typeof data.currentIteration === "object" &&
    "increment" in data.currentIteration
  ) {
    // For DB, we need to handle increment differently
    // For in-memory, we'll handle it below
    processedData.currentIteration = data.currentIteration;
  }

  if (useDb) {
    try {
      return await (prisma as any).toolGenerationSession.update({
        where: { id: sessionId },
        data: {
          ...processedData,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to update session in DB:",
        error,
      );
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const session = inMemorySessions.get(sessionId);
  if (session) {
    // Handle increment for currentIteration
    if (
      data.currentIteration &&
      typeof data.currentIteration === "object" &&
      "increment" in data.currentIteration
    ) {
      session.currentIteration =
        (session.currentIteration || 0) + data.currentIteration.increment;
      delete processedData.currentIteration;
    }
    Object.assign(session, processedData, { updatedAt: new Date() });
    return session;
  }
  return null;
}

export async function getSession(sessionId: string): Promise<any> {
  const useDb = await checkTablesExist();

  if (useDb) {
    try {
      return await (prisma as any).toolGenerationSession.findUnique({
        where: { id: sessionId },
        include: {
          logs: { orderBy: { createdAt: "asc" } },
          tool: true,
        },
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to get session from DB:",
        error,
      );
    }
  }

  // In-memory fallback
  const session = inMemorySessions.get(sessionId);
  if (session) {
    return {
      ...session,
      logs: inMemoryLogs.get(sessionId) || [],
    };
  }
  return null;
}

export async function getUserSessions(
  userId: string,
  limit = 20,
): Promise<any[]> {
  const useDb = await checkTablesExist();

  if (useDb) {
    try {
      return await (prisma as any).toolGenerationSession.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          logs: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to get user sessions from DB:",
        error,
      );
    }
  }

  // In-memory fallback
  return Array.from(inMemorySessions.values())
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// ==================== Log Operations ====================

export async function createLog(data: {
  sessionId: string;
  phase: string;
  level?: string;
  message: string;
  step?: string;
  promptSent?: string;
  responseReceived?: string;
  modelUsed?: string;
  tokensUsed?: number;
  codeExecuted?: string;
  executionResult?: any;
  executionTimeMs?: number;
  metadata?: any;
  durationMs?: number;
}): Promise<any> {
  const useDb = await checkTablesExist();

  if (useDb) {
    try {
      return await (prisma as any).toolGenerationLog.create({
        data: {
          sessionId: data.sessionId,
          phase: data.phase,
          level: data.level || "info",
          message: data.message,
          step: data.step,
          promptSent: data.promptSent,
          responseReceived: data.responseReceived,
          modelUsed: data.modelUsed,
          tokensUsed: data.tokensUsed,
          codeExecuted: data.codeExecuted,
          executionResult: data.executionResult,
          executionTimeMs: data.executionTimeMs,
          metadata: data.metadata,
          durationMs: data.durationMs,
        },
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to create log in DB:",
        error,
      );
    }
  }

  // In-memory fallback
  const log = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    ...data,
    level: data.level || "info",
    createdAt: new Date(),
  };

  const logs = inMemoryLogs.get(data.sessionId) || [];
  logs.push(log);
  inMemoryLogs.set(data.sessionId, logs);
  return log;
}

// ==================== Health Report Operations ====================

export async function createOrUpdateHealthReport(data: {
  toolId: string;
  status: string;
  healthScore: number;
  issuesDetected?: any;
  errorPatterns?: any;
  suggestedFixes?: any;
  rootCauseAnalysis?: string;
  healingAttempted?: boolean;
  healingSuccess?: boolean;
  healedCode?: string;
  healingLog?: any;
  recentSuccessRate?: number;
  recentErrorCount?: number;
  recentUsageCount?: number;
}): Promise<any> {
  const useDb = await checkTablesExist();

  if (useDb) {
    try {
      // Try to find existing report
      const existing = await (prisma as any).toolHealthReport.findFirst({
        where: { toolId: data.toolId },
        orderBy: { createdAt: "desc" },
      });

      if (existing && isReportRecent(existing.createdAt)) {
        return await (prisma as any).toolHealthReport.update({
          where: { id: existing.id },
          data: {
            ...data,
            updatedAt: new Date(),
          },
        });
      }

      return await (prisma as any).toolHealthReport.create({
        data: {
          ...data,
          issuesDetected: data.issuesDetected || [],
          recentErrorCount: data.recentErrorCount || 0,
          recentUsageCount: data.recentUsageCount || 0,
        },
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to create/update health report in DB:",
        error,
      );
    }
  }

  // In-memory fallback
  const report = {
    id: `hr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    ...data,
    issuesDetected: data.issuesDetected || [],
    recentErrorCount: data.recentErrorCount || 0,
    recentUsageCount: data.recentUsageCount || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  inMemoryHealthReports.set(data.toolId, report);
  return report;
}

export async function getHealthReport(toolId: string): Promise<any> {
  const useDb = await checkTablesExist();

  if (useDb) {
    try {
      return await (prisma as any).toolHealthReport.findFirst({
        where: { toolId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to get health report from DB:",
        error,
      );
    }
  }

  return inMemoryHealthReports.get(toolId) || null;
}

export async function getHealthReportsForTools(
  toolIds: string[],
): Promise<Map<string, any>> {
  const useDb = await checkTablesExist();
  const reportMap = new Map<string, any>();

  if (useDb) {
    try {
      const reports = await (prisma as any).toolHealthReport.findMany({
        where: { toolId: { in: toolIds } },
        orderBy: { createdAt: "desc" },
        distinct: ["toolId"],
      });

      for (const report of reports) {
        reportMap.set(report.toolId, report);
      }
      return reportMap;
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to get health reports from DB:",
        error,
      );
    }
  }

  // In-memory fallback
  for (const toolId of toolIds) {
    const report = inMemoryHealthReports.get(toolId);
    if (report) {
      reportMap.set(toolId, report);
    }
  }
  return reportMap;
}

// ==================== Execution Log Operations ====================

export interface CreateExecutionLogData {
  toolId: string;
  userId: string;
  success: boolean;
  result?: any;
  error?: string;
  errorType?: string;
  inputParams?: any;
  executionTimeMs?: number;
  triggeredBy?: string;
  metadata?: any;
  startedAt?: Date;
  completedAt?: Date;
}

export async function createExecutionLog(
  data: CreateExecutionLogData,
): Promise<any> {
  const useDb = await checkTablesExist();

  const startedAt =
    data.startedAt || new Date(Date.now() - (data.executionTimeMs || 0));
  const completedAt = data.completedAt || new Date();

  if (useDb) {
    try {
      return await (prisma as any).toolExecutionLog.create({
        data: {
          toolId: data.toolId,
          userId: data.userId,
          success: data.success,
          result: data.result,
          error: data.error,
          errorType: data.errorType,
          inputParams: data.inputParams,
          executionTimeMs: data.executionTimeMs,
          triggeredBy: data.triggeredBy || "user_chat",
          startedAt,
          completedAt,
        },
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to create execution log in DB:",
        error,
      );
    }
  }

  // In-memory fallback
  const log = {
    id: `exlog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    ...data,
    triggeredBy: data.triggeredBy || "user_chat",
    startedAt,
    completedAt,
    createdAt: new Date(),
  };

  inMemoryExecutionLogs.push(log);

  // Keep only last 1000 logs in memory
  if (inMemoryExecutionLogs.length > 1000) {
    inMemoryExecutionLogs.shift();
  }

  return log;
}

export async function getRecentExecutionLogs(
  toolId: string,
  hoursAgo = 24,
  limit = 50,
): Promise<any[]> {
  const useDb = await checkTablesExist();
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  if (useDb) {
    try {
      return await (prisma as any).toolExecutionLog.findMany({
        where: {
          toolId,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to get execution logs from DB:",
        error,
      );
    }
  }

  // In-memory fallback
  return inMemoryExecutionLogs
    .filter((l) => l.toolId === toolId && l.createdAt >= since)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function getRecentErrorLogs(
  toolId: string,
  limit = 10,
): Promise<any[]> {
  const useDb = await checkTablesExist();

  if (useDb) {
    try {
      return await (prisma as any).toolExecutionLog.findMany({
        where: {
          toolId,
          success: false,
          error: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to get error logs from DB:",
        error,
      );
    }
  }

  // In-memory fallback
  return inMemoryExecutionLogs
    .filter((l) => l.toolId === toolId && !l.success && l.error)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// ==================== Helpers ====================

function isReportRecent(date: Date): boolean {
  return Date.now() - date.getTime() < 60 * 60 * 1000; // 1 hour
}

// ==================== Aliases for backward compatibility ====================

/**
 * Alias for getUserSessions
 */
export const listUserSessions = getUserSessions;

/**
 * Save health report with toolId as first argument
 */
export async function saveHealthReport(
  toolId: string,
  data: {
    status: string;
    healthScore: number;
    issuesDetected?: any;
    errorPatterns?: any;
    suggestedFixes?: any;
    rootCauseAnalysis?: string;
    healingAttempted?: boolean;
    healingSuccess?: boolean;
    healedCode?: string;
    healingLog?: any;
    recentSuccessRate?: number;
    recentErrorCount?: number;
    recentUsageCount?: number;
  },
): Promise<any> {
  return createOrUpdateHealthReport({
    toolId,
    ...data,
  });
}

/**
 * Update health report status only
 */
export async function updateHealthReportStatus(
  toolId: string,
  status: string,
  additionalData?: any,
): Promise<void> {
  const useDb = await checkTablesExist();

  if (useDb) {
    try {
      const existingReport = await (prisma as any).toolHealthReport.findFirst({
        where: { toolId },
        orderBy: { createdAt: "desc" },
      });

      if (existingReport) {
        await (prisma as any).toolHealthReport.update({
          where: { id: existingReport.id },
          data: {
            status,
            healingAttempted: status === "HEALING" || status === "HEALED",
            healingSuccess: status === "HEALED",
            healedCode: additionalData?.healedCode,
            healingLog: additionalData,
            rootCauseAnalysis: additionalData?.rootCauseAnalysis,
            suggestedFixes: additionalData?.suggestedFixes,
          },
        });
      }
      return;
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to update health report status:",
        error,
      );
    }
  }

  // In-memory fallback
  const report = inMemoryHealthReports.get(toolId);
  if (report) {
    report.status = status;
    report.healingAttempted = status === "HEALING" || status === "HEALED";
    report.healingSuccess = status === "HEALED";
    if (additionalData) {
      report.healedCode = additionalData.healedCode;
      report.healingLog = additionalData;
      report.rootCauseAnalysis = additionalData.rootCauseAnalysis;
      report.suggestedFixes = additionalData.suggestedFixes;
    }
    report.updatedAt = new Date();
  }
}

/**
 * Get tool execution logs with flexible filtering
 */
export async function getToolExecutionLogs(
  toolId: string,
  since?: Date,
  limit = 50,
  errorsOnly = false,
): Promise<any[]> {
  const useDb = await checkTablesExist();

  if (useDb) {
    try {
      const where: any = { toolId };
      if (since) {
        where.createdAt = { gte: since };
      }
      if (errorsOnly) {
        where.success = false;
        where.error = { not: null };
      }

      return await (prisma as any).toolExecutionLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } catch (error) {
      console.error(
        "[ToolWorkflowPersistence] Failed to get tool execution logs:",
        error,
      );
    }
  }

  // In-memory fallback
  let logs = inMemoryExecutionLogs.filter((l) => l.toolId === toolId);

  if (since) {
    logs = logs.filter((l) => l.createdAt >= since);
  }
  if (errorsOnly) {
    logs = logs.filter((l) => !l.success && l.error);
  }

  return logs
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
