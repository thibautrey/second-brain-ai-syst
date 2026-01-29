import { dynamicToolRegistry } from "../../dynamic-tool-registry.js";

export async function executeReadToolCodeAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    switch (action) {
      case "read": {
        if (!params.tool_id && !params.tool_name) {
          throw new Error(
            "Missing required parameter: 'tool_id' or 'tool_name' - specify which tool to read",
          );
        }

        const tool = await prisma.generatedTool.findFirst({
          where: {
            userId,
            OR: [
              { id: params.tool_id },
              { name: params.tool_name },
              { name: params.tool_id },
            ],
          },
        });

        if (!tool) {
          throw new Error(
            `Tool not found: ${params.tool_id || params.tool_name}. Use generate_tool with action 'list' to see available tools.`,
          );
        }

        return {
          action: "read",
          success: true,
          tool: {
            id: tool.id,
            name: tool.name,
            displayName: tool.displayName,
            description: tool.description,
            code: tool.code,
            inputSchema: tool.inputSchema,
            requiredSecrets: tool.requiredSecrets,
            version: tool.version,
            usageCount: tool.usageCount,
            lastError: tool.lastError,
            lastErrorAt: tool.lastErrorAt,
            enabled: tool.enabled,
          },
          message: `Successfully read tool code for '${tool.displayName}'. Review the code to understand its implementation.`,
        };
      }

      case "analyze": {
        if (!params.tool_id && !params.tool_name) {
          throw new Error(
            "Missing required parameter: 'tool_id' or 'tool_name' - specify which tool to analyze",
          );
        }

        const tool = await prisma.generatedTool.findFirst({
          where: {
            userId,
            OR: [
              { id: params.tool_id },
              { name: params.tool_name },
              { name: params.tool_id },
            ],
          },
        });

        if (!tool) {
          throw new Error(
            `Tool not found: ${params.tool_id || params.tool_name}`,
          );
        }

        const recentLogs = await prisma.toolExecutionLog.findMany({
          where: {
            toolId: tool.id,
            userId,
          },
          orderBy: { startedAt: "desc" },
          take: 10,
        });

        const errorLogs = recentLogs.filter((log) => !log.success);
        const successRate =
          recentLogs.length > 0
            ? ((recentLogs.length - errorLogs.length) / recentLogs.length) *
              100
            : 100;

        const errorPatterns: Record<string, number> = {};
        for (const log of errorLogs) {
          const errorType = log.errorType || "unknown";
          errorPatterns[errorType] = (errorPatterns[errorType] || 0) + 1;
        }

        return {
          action: "analyze",
          success: true,
          tool: {
            id: tool.id,
            name: tool.name,
            displayName: tool.displayName,
            description: tool.description,
            code: tool.code,
          },
          analysis: {
            successRate: `${successRate.toFixed(1)}%`,
            totalExecutions: recentLogs.length,
            recentErrors: errorLogs.length,
            errorPatterns: Object.entries(errorPatterns).map(
              ([type, count]) => ({ type, count }),
            ),
            lastError: tool.lastError,
            lastErrorAt: tool.lastErrorAt,
            recentErrorMessages: errorLogs
              .slice(0, 5)
              .map((log) => log.error)
              .filter(Boolean),
          },
          message:
            successRate < 80
              ? `Tool '${tool.displayName}' has a ${successRate.toFixed(1)}% success rate. Consider using 'fix' action to repair it.`
              : `Tool '${tool.displayName}' is performing well with ${successRate.toFixed(1)}% success rate.`,
        };
      }

      case "fix": {
        if (!params.tool_id && !params.tool_name) {
          throw new Error(
            "Missing required parameter: 'tool_id' or 'tool_name' - specify which tool to fix",
          );
        }

        if (!params.fixed_code) {
          throw new Error(
            "Missing required parameter: 'fixed_code' - provide the corrected Python code",
          );
        }

        const tool = await prisma.generatedTool.findFirst({
          where: {
            userId,
            OR: [
              { id: params.tool_id },
              { name: params.tool_name },
              { name: params.tool_id },
            ],
          },
        });

        if (!tool) {
          throw new Error(
            `Tool not found: ${params.tool_id || params.tool_name}`,
          );
        }

        const previousCode = tool.code;
        const previousVersion = tool.version;
        const newCode = params.fixed_code.trim();
        if (!newCode.includes("def ") && !newCode.includes("result =")) {
          throw new Error(
            "Invalid fix: Code must define functions or set a 'result' variable",
          );
        }

        const updatedTool = await prisma.generatedTool.update({
          where: { id: tool.id },
          data: {
            code: newCode,
            version: tool.version + 1,
            previousCode: previousCode,
            lastError: null,
            lastErrorAt: null,
          },
        });

        await prisma.toolExecutionLog.create({
          data: {
            toolId: tool.id,
            userId,
            inputParams: {
              action: "fix",
              previousVersion,
              newVersion: updatedTool.version,
              fixReason: params.fix_reason || "Manual fix via read_tool_code",
            },
            success: true,
            result: { fixed: true },
            executionTimeMs: 0,
            startedAt: new Date(),
            completedAt: new Date(),
            triggeredBy: "read_tool_code",
          },
        });

        dynamicToolRegistry.invalidateCache(userId);

        return {
          action: "fix",
          success: true,
          tool: {
            id: updatedTool.id,
            name: updatedTool.name,
            displayName: updatedTool.displayName,
            newVersion: updatedTool.version,
            previousVersion: previousVersion,
          },
          message: `Successfully updated tool '${updatedTool.displayName}' to version ${updatedTool.version}. Previous version saved for rollback if needed.`,
          tip: "Test the tool to verify the fix works correctly.",
        };
      }

      case "rollback": {
        if (!params.tool_id && !params.tool_name) {
          throw new Error(
            "Missing required parameter: 'tool_id' or 'tool_name' - specify which tool to rollback",
          );
        }

        const tool = await prisma.generatedTool.findFirst({
          where: {
            userId,
            OR: [
              { id: params.tool_id },
              { name: params.tool_name },
              { name: params.tool_id },
            ],
          },
        });

        if (!tool) {
          throw new Error(
            `Tool not found: ${params.tool_id || params.tool_name}`,
          );
        }

        if (!tool.previousCode) {
          throw new Error(
            `No previous version available for tool '${tool.displayName}'. Rollback not possible.`,
          );
        }

        const currentCode = tool.code;
        const currentVersion = tool.version;

        const updatedTool = await prisma.generatedTool.update({
          where: { id: tool.id },
          data: {
            code: tool.previousCode,
            version: tool.version + 1,
            previousCode: currentCode,
            lastError: null,
            lastErrorAt: null,
          },
        });

        await prisma.toolExecutionLog.create({
          data: {
            toolId: tool.id,
            userId,
            inputParams: {
              action: "rollback",
              fromVersion: currentVersion,
              toVersion: updatedTool.version,
              reason: params.reason || "Manual rollback via read_tool_code",
            },
            success: true,
            result: { rolledBack: true },
            executionTimeMs: 0,
            startedAt: new Date(),
            completedAt: new Date(),
            triggeredBy: "read_tool_code",
          },
        });

        dynamicToolRegistry.invalidateCache(userId);

        return {
          action: "rollback",
          success: true,
          tool: {
            id: updatedTool.id,
            name: updatedTool.name,
            displayName: updatedTool.displayName,
            newVersion: updatedTool.version,
            rolledBackFromVersion: currentVersion,
          },
          message: `Successfully rolled back tool '${updatedTool.displayName}' to previous version.`,
        };
      }

    default:
      throw new Error(`Unknown read_tool_code action: ${action}`);
  }
} finally {
  await prisma.$disconnect();
}
}

export const READ_TOOL_CODE_SCHEMA = {
  name: "read_tool_code",
  description:
    "Read and analyze the source code of generated tools to understand their implementation, diagnose errors, or apply fixes. Use 'read' to see the full code. Use 'analyze' to get error statistics and patterns. Use 'fix' to update broken code proactively. Use 'rollback' to revert to the previous version if a fix made things worse. This tool helps you understand how generated tools work and repair them when they fail.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["read", "analyze", "fix", "rollback"],
        description:
          "'read': view full source code and metadata. 'analyze': get error statistics, success rate, and common failure patterns. 'fix': apply corrected code to repair the tool. 'rollback': revert to the previous code version.",
      },
      tool_id: {
        type: "string",
        description:
          "The tool ID to read/analyze/fix/rollback (from 'generate_tool list' response)",
      },
      tool_name: {
        type: "string",
        description: "The tool name (alternative to tool_id)",
      },
      fixed_code: {
        type: "string",
        description:
          "For 'fix' action: the corrected Python code. Must define functions or set a 'result' variable. Important: Keep the same structure and params as the original tool.",
      },
      fix_reason: {
        type: "string",
        description:
          "For 'fix' action: explanation of what was fixed (stored for history)",
      },
      reason: {
        type: "string",
        description:
          "For 'rollback' action: reason for the rollback (stored for audit)",
      },
    },
    required: ["action"],
  },
};
