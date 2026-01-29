/**
 * Chat Tools Service
 *
 * Handles tool calling, execution, and result processing
 * - Text-based tool extraction and parsing
 * - Tool execution orchestration
 * - Result sanitization
 * - Error classification for smart retry handling
 */

import {
  createToolMetadata,
  generateToolExecutionSummary,
  sanitizeToolResult,
} from "./sanitize-tool-results.js";
import {
  classifyToolError,
  formatErrorForModel,
  getUserFriendlyError,
  type ToolErrorClassification,
} from "./tool-error-classifier.js";

import { Response } from "express";
import { toolExecutorService } from "./tool-executor.js";

export interface TextToolCall {
  toolId: string;
  params: Record<string, any>;
  start: number;
  end: number;
}

export interface ToolExecutionResult {
  toolCallId: string;
  toolId: string;
  success: boolean;
  data: any;
  error?: string;
  /** Error classification for smart handling */
  errorClassification?: ToolErrorClassification;
  /** Formatted error message for the model */
  errorForModel?: string;
  /** User-friendly error message (only if should surface) */
  userFriendlyError?: string;
}

/**
 * Extract ALL tool calls from text content
 * Handles multiple consecutive tool calls like: user_profile{...}scheduled_task{...}
 */
export function extractAllTextToolCalls(content: string): TextToolCall[] {
  const results: TextToolCall[] = [];

  // Pattern to find toolName{...} anywhere in the text
  const toolPattern =
    /(user_profile|scheduled_task|todo|notification|curl|user_context)\s*(\{)/gi;

  let match;
  while ((match = toolPattern.exec(content)) !== null) {
    const toolId = match[1].toLowerCase();
    const startPos = match.index;
    const jsonStart = match.index + match[0].length - 1; // Position of opening {

    // Find matching closing brace
    let braceCount = 1;
    let jsonEnd = jsonStart + 1;

    while (jsonEnd < content.length && braceCount > 0) {
      if (content[jsonEnd] === "{") braceCount++;
      if (content[jsonEnd] === "}") braceCount--;
      jsonEnd++;
    }

    if (braceCount === 0) {
      try {
        const jsonStr = content.substring(jsonStart, jsonEnd);
        const params = JSON.parse(jsonStr);

        // Verify it has an action field (real tool call)
        if (params.action && typeof params.action === "string") {
          results.push({
            toolId,
            params,
            start: startPos,
            end: jsonEnd,
          });
        }
      } catch (e) {
        // JSON parse failed, skip this one
      }
    }
  }

  return results;
}

/**
 * Execute text-based tool calls and stream results
 */
export async function executeTextToolCalls(
  userId: string,
  textToolCalls: TextToolCall[],
  flowId: string,
  flowTracker: any,
  res: Response,
  iterationCount: number,
): Promise<{
  toolCallResults: ToolExecutionResult[];
  allToolResults: any[];
  sanitizationResults: Map<string, any>;
}> {
  const batchToolCallId = `text_tool_batch_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const toolCallResults: ToolExecutionResult[] = [];
  const allToolResults: any[] = [];
  const sanitizationResults = new Map<string, any>();

  // Execute each tool and collect results
  for (let i = 0; i < textToolCalls.length; i++) {
    const { toolId, params } = textToolCalls[i];
    const toolCallId = `${batchToolCallId}_${i}`;

    flowTracker.trackEvent({
      flowId,
      stage: `text_tool_call_executing_iteration_${iterationCount}`,
      service: "ChatController",
      status: "started",
      duration: 0,
      data: {
        toolId,
        action: params.action,
        toolIndex: i,
        totalCalls: textToolCalls.length,
      },
      decision: `Exécution de ${textToolCalls.length} appel(s) d'outil en texte. Traitement #${i + 1}: ${toolId}`,
    });

    // Execute the tool
    const toolExecutionStart = Date.now();
    const toolRequest = {
      toolId,
      action: params.action || "request",
      params,
    };

    // Send tool_call event to frontend (executing status)
    res.write(
      `data: ${JSON.stringify({
        type: "tool_call",
        data: {
          id: toolCallId,
          toolName: toolId,
          action: params.action,
          status: "executing",
          startTime: toolExecutionStart,
        },
      })}\n\n`,
    );

    try {
      // Create callback for generation steps (only for generate_tool)
      const executionOptions =
        toolId === "generate_tool"
          ? {
              onGenerationStep: (step: any) => {
                res.write(
                  `data: ${JSON.stringify({
                    type: "tool_generation",
                    data: {
                      ...step,
                      toolCallId,
                    },
                  })}\n\n`,
                );
              },
            }
          : undefined;

      const toolResult = await toolExecutorService.executeTool(
        userId,
        toolRequest,
        executionOptions,
      );

      // Sanitize the tool result before storing
      const sanitizationResult = sanitizeToolResult(toolResult.data);
      sanitizationResults.set(`${toolId}_${i}`, sanitizationResult);

      // Store sanitized version of tool result
      const sanitizedToolResult = {
        ...toolResult,
        data: sanitizationResult.cleaned,
        _sanitized: sanitizationResult.hasSensitiveData,
        _redactionCount: sanitizationResult.redactedCount,
      };

      allToolResults.push(sanitizedToolResult);

      // Classify error if tool failed
      let errorClassification: ToolErrorClassification | undefined;
      let errorForModel: string | undefined;
      let userFriendlyError: string | undefined;

      if (!toolResult.success && toolResult.error) {
        errorClassification = classifyToolError(toolResult.error, toolId);
        errorForModel = formatErrorForModel(
          toolResult.error,
          errorClassification,
          toolId,
        );

        // Only generate user-friendly error if it should be surfaced
        if (errorClassification.surfaceToUser) {
          userFriendlyError = getUserFriendlyError(
            toolResult.error,
            errorClassification,
            toolId,
          );
        }
      }

      // Track this result for message building
      toolCallResults.push({
        toolCallId,
        toolId,
        success: toolResult.success,
        data: toolResult.data,
        error: toolResult.error,
        errorClassification,
        errorForModel,
        userFriendlyError,
      });

      // Send tool_call event to frontend (success/error status)
      res.write(
        `data: ${JSON.stringify({
          type: "tool_call",
          data: {
            id: toolCallId,
            toolName: toolId,
            action: params.action,
            status: toolResult.success ? "success" : "error",
            startTime: toolExecutionStart,
            endTime: Date.now(),
            result: toolResult.success ? toolResult.data : undefined,
            error: toolResult.error,
            // Include classification info for frontend
            errorRecoverable: errorClassification?.isRecoverable,
            errorCategory: errorClassification?.errorCategory,
          },
        })}\n\n`,
      );

      flowTracker.trackEvent({
        flowId,
        stage: `text_tool_executed_iteration_${iterationCount}`,
        service: "ToolExecutor",
        status: toolResult.success ? "success" : "failed",
        duration: Date.now() - toolExecutionStart,
        data: {
          toolId,
          success: toolResult.success,
          toolIndex: i,
          errorCategory: errorClassification?.errorCategory,
          isRecoverable: errorClassification?.isRecoverable,
        },
      });
    } catch (toolError) {
      const errorMessage =
        toolError instanceof Error ? toolError.message : String(toolError);
      console.error(
        `[ToolExecutor] Error executing text tool ${toolId}:`,
        toolError,
      );

      // Classify the caught exception
      const caughtErrorClassification = classifyToolError(errorMessage, toolId);
      const caughtErrorForModel = formatErrorForModel(
        errorMessage,
        caughtErrorClassification,
        toolId,
      );

      toolCallResults.push({
        toolCallId,
        toolId,
        success: false,
        data: null,
        error: errorMessage,
        errorClassification: caughtErrorClassification,
        errorForModel: caughtErrorForModel,
        userFriendlyError: caughtErrorClassification.surfaceToUser
          ? getUserFriendlyError(
              errorMessage,
              caughtErrorClassification,
              toolId,
            )
          : undefined,
      });

      // Send tool_call event to frontend (error status)
      res.write(
        `data: ${JSON.stringify({
          type: "tool_call",
          data: {
            id: toolCallId,
            toolName: toolId,
            action: params.action,
            status: "error",
            startTime: toolExecutionStart,
            endTime: Date.now(),
            error: errorMessage,
            errorRecoverable: caughtErrorClassification.isRecoverable,
            errorCategory: caughtErrorClassification.errorCategory,
          },
        })}\n\n`,
      );

      flowTracker.trackEvent({
        flowId,
        stage: `text_tool_error_iteration_${iterationCount}`,
        service: "ToolExecutor",
        status: "failed",
        data: {
          toolId,
          toolIndex: i,
          error:
            toolError instanceof Error ? toolError.message : String(toolError),
        },
      });
    }
  }

  return {
    toolCallResults,
    allToolResults,
    sanitizationResults,
  };
}

/**
 * Execute function-call based tools
 */
export async function executeFunctionCalls(
  userId: string,
  toolCalls: any[],
  flowId: string,
  flowTracker: any,
  res: Response,
  iterationCount: number,
): Promise<{
  toolRequests: any[];
  toolResults: any[];
}> {
  const toolExecutionStart = Date.now();

  const toolRequests = toolCalls.map((toolCall) => {
    const args = JSON.parse(toolCall.function.arguments);
    return {
      toolId: toolCall.function.name,
      action: args.action,
      params: args,
      _toolCallId: toolCall.id,
    };
  });

  // Send tool_call events for each tool (executing status)
  toolRequests.forEach((req) => {
    res.write(
      `data: ${JSON.stringify({
        type: "tool_call",
        data: {
          id: req._toolCallId,
          toolName: req.toolId,
          action: req.action,
          status: "executing",
          startTime: toolExecutionStart,
        },
      })}\n\n`,
    );
  });

  const toolResults = await toolExecutorService.executeToolsInParallel(
    userId,
    toolRequests,
    7000, // 7s per tool
    60000, // 60s global
  );

  // Send tool_call events for each tool (success/error status)
  const endTime = Date.now();
  toolRequests.forEach((req, index) => {
    const result = toolResults[index];
    res.write(
      `data: ${JSON.stringify({
        type: "tool_call",
        data: {
          id: req._toolCallId,
          toolName: req.toolId,
          action: req.action,
          status: result.success ? "success" : "error",
          startTime: toolExecutionStart,
          endTime,
          result: result.success ? result.data : undefined,
          error: result.error,
        },
      })}\n\n`,
    );
  });

  flowTracker.trackEvent({
    flowId,
    stage: `tools_executed_iteration_${iterationCount}`,
    service: "ToolExecutor",
    status: "success",
    duration: Date.now() - toolExecutionStart,
    data: {
      toolsExecuted: toolResults.length,
      successCount: toolResults.filter((r) => r.success).length,
      failureCount: toolResults.filter((r) => !r.success).length,
    },
  });

  return {
    toolRequests,
    toolResults,
  };
}
