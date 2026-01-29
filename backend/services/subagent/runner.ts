/**
 * SubAgent Runner
 *
 * Spawns and manages isolated sub-agents for complex subtasks.
 * Sub-agents have their own context, limited tools, and cannot spawn
 * other sub-agents to prevent recursive fan-out.
 *
 * Based on Moltbot's sub-agent architecture pattern.
 */

import OpenAI from "openai";
import { randomBytes } from "crypto";
import {
  SubAgentConfig,
  SubAgentResult,
  SubAgentMessage,
  SubAgentStatus,
  validateSubAgentConfig,
  getSubAgentTemplate,
} from "./types.js";
import { getChatProvider } from "../chat-provider.js";
import { toolExecutorService } from "../tool-executor.js";
import { flowTracker } from "../flow-tracker.js";
import { getTemperatureForModel } from "../llm-router.js";

// Active sub-agents tracking
const activeSubAgents = new Map<string, SubAgentStatus>();

// Maximum concurrent sub-agents per user
const MAX_CONCURRENT_SUBAGENTS = 3;

/**
 * SubAgentRunner - Manages sub-agent lifecycle
 */
export class SubAgentRunner {
  private defaultTimeout = 120000; // 2 minutes
  private defaultMaxIterations = 10;

  /**
   * Spawn a new sub-agent to handle a specific task
   */
  async spawn(
    userId: string,
    config: Partial<SubAgentConfig>,
  ): Promise<SubAgentResult> {
    const startTime = Date.now();
    const subAgentId =
      config.id || `subagent_${randomBytes(8).toString("hex")}`;
    const flowId = `sub_${subAgentId}`;

    // Validate configuration
    const validationErrors = validateSubAgentConfig(config);
    if (validationErrors.length > 0) {
      return {
        success: false,
        result: "",
        toolsUsed: [],
        iterations: 0,
        error: `Invalid configuration: ${validationErrors.join(", ")}`,
        executionTime: Date.now() - startTime,
        flowId,
      };
    }

    // Check concurrent sub-agent limit
    const userSubAgents = Array.from(activeSubAgents.values()).filter(
      (s) => s.status === "running",
    );
    if (userSubAgents.length >= MAX_CONCURRENT_SUBAGENTS) {
      return {
        success: false,
        result: "",
        toolsUsed: [],
        iterations: 0,
        error: `Maximum concurrent sub-agents (${MAX_CONCURRENT_SUBAGENTS}) reached. Wait for existing sub-agents to complete.`,
        executionTime: Date.now() - startTime,
        flowId,
      };
    }

    // Build full config with defaults
    const fullConfig: SubAgentConfig = {
      id: subAgentId,
      parentFlowId: config.parentFlowId || "unknown",
      task: config.task!,
      taskDescription: config.taskDescription!,
      tools: config.tools!,
      maxIterations: Math.min(
        config.maxIterations || this.defaultMaxIterations,
        15,
      ),
      promptMode: config.promptMode || "minimal",
      canSpawnSubagents: false,
      timeout: config.timeout || this.defaultTimeout,
      parentContext: config.parentContext,
    };

    // Register sub-agent as active
    const status: SubAgentStatus = {
      id: subAgentId,
      parentFlowId: fullConfig.parentFlowId,
      status: "running",
      currentIteration: 0,
      maxIterations: fullConfig.maxIterations,
      toolsUsed: [],
      startTime: new Date(),
    };
    activeSubAgents.set(subAgentId, status);

    flowTracker.startFlow(flowId, "subagent");
    flowTracker.trackEvent({
      flowId,
      stage: "subagent_started",
      service: "SubAgentRunner",
      status: "started",
      data: {
        parentFlowId: fullConfig.parentFlowId,
        task: fullConfig.task.substring(0, 100),
        tools: fullConfig.tools,
        maxIterations: fullConfig.maxIterations,
      },
    });

    try {
      // Run the sub-agent with timeout
      const result = await Promise.race([
        this.runSubAgentLoop(userId, fullConfig, flowId, status),
        this.createTimeout(fullConfig.timeout!, subAgentId),
      ]);

      // Update status
      status.status = result.success ? "completed" : "failed";
      status.endTime = new Date();
      activeSubAgents.set(subAgentId, status);

      flowTracker.trackEvent({
        flowId,
        stage: "subagent_completed",
        service: "SubAgentRunner",
        status: result.success ? "success" : "failed",
        duration: Date.now() - startTime,
        data: {
          iterations: result.iterations,
          toolsUsed: result.toolsUsed,
          success: result.success,
        },
      });

      flowTracker.completeFlow(flowId, result.success ? "completed" : "failed");

      // Clean up after a delay
      setTimeout(() => activeSubAgents.delete(subAgentId), 60000);

      return {
        ...result,
        executionTime: Date.now() - startTime,
        flowId,
      };
    } catch (error: any) {
      status.status = "failed";
      status.endTime = new Date();
      activeSubAgents.set(subAgentId, status);

      flowTracker.trackEvent({
        flowId,
        stage: "subagent_error",
        service: "SubAgentRunner",
        status: "failed",
        data: { error: error.message },
      });

      flowTracker.completeFlow(flowId, "failed");

      setTimeout(() => activeSubAgents.delete(subAgentId), 60000);

      return {
        success: false,
        result: "",
        toolsUsed: status.toolsUsed,
        iterations: status.currentIteration,
        error: error.message,
        executionTime: Date.now() - startTime,
        flowId,
      };
    }
  }

  /**
   * Run the sub-agent's main execution loop
   */
  private async runSubAgentLoop(
    userId: string,
    config: SubAgentConfig,
    flowId: string,
    status: SubAgentStatus,
  ): Promise<Omit<SubAgentResult, "executionTime" | "flowId">> {
    // Get provider
    const providerResult = await getChatProvider(userId);
    if (!providerResult) {
      return {
        success: false,
        result: "",
        toolsUsed: [],
        iterations: 0,
        error: "No LLM provider configured",
      };
    }

    const { provider, modelId } = providerResult;

    // Build sub-agent system prompt
    const systemPrompt = this.buildSubAgentPrompt(config);

    // Get filtered tool schemas (only allowed tools)
    const allToolSchemas =
      await toolExecutorService.getToolSchemasWithGenerated(userId);
    const allowedToolSchemas = allToolSchemas.filter((schema: any) =>
      config.tools.includes(schema.name),
    );

    // Initialize messages
    const messages: SubAgentMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: config.task },
    ];

    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl || "https://api.openai.com/v1",
    });

    let iterationCount = 0;
    const toolsUsed: string[] = [];

    while (iterationCount < config.maxIterations) {
      iterationCount++;
      status.currentIteration = iterationCount;

      flowTracker.trackEvent({
        flowId,
        stage: `subagent_iteration_${iterationCount}`,
        service: "SubAgentRunner",
        status: "started",
      });

      try {
        const chatTemp = getTemperatureForModel(modelId, 0.5); // Lower temp for focused tasks
        const chatPayload: any = {
          model: modelId,
          messages: messages as any,
          max_tokens: 2000,
          tools:
            allowedToolSchemas.length > 0
              ? allowedToolSchemas.map((schema: any) => ({
                  type: "function" as const,
                  function: schema,
                }))
              : undefined,
          tool_choice: allowedToolSchemas.length > 0 ? "auto" : undefined,
        };

        if (chatTemp !== undefined) {
          chatPayload.temperature = chatTemp;
        }

        const response = await openai.chat.completions.create(chatPayload);
        const assistantMessage = response.choices[0]?.message;

        if (!assistantMessage) {
          break;
        }

        // Handle tool calls
        if (
          assistantMessage.tool_calls &&
          assistantMessage.tool_calls.length > 0
        ) {
          // Add assistant message with tool calls
          messages.push({
            role: "assistant",
            content: assistantMessage.content,
            tool_calls: assistantMessage.tool_calls,
          });

          // Execute each tool call
          for (const toolCall of assistantMessage.tool_calls) {
            const toolId = toolCall.function.name;

            // Verify tool is allowed
            if (!config.tools.includes(toolId)) {
              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolId,
                content: JSON.stringify({
                  success: false,
                  error: `Tool '${toolId}' is not available to this sub-agent. Available tools: ${config.tools.join(", ")}`,
                }),
              });
              continue;
            }

            let params: Record<string, any> = {};
            try {
              params = JSON.parse(toolCall.function.arguments || "{}");
            } catch (e) {
              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolId,
                content: JSON.stringify({
                  success: false,
                  error: "Invalid JSON in tool arguments",
                }),
              });
              continue;
            }

            // Block spawn_subagent tool for sub-agents
            if (toolId === "spawn_subagent") {
              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolId,
                content: JSON.stringify({
                  success: false,
                  error: "Sub-agents cannot spawn other sub-agents",
                }),
              });
              continue;
            }

            flowTracker.trackEvent({
              flowId,
              stage: `subagent_tool_${iterationCount}_${toolId}`,
              service: "SubAgentRunner",
              status: "started",
            });

            try {
              const result = await toolExecutorService.executeTool(userId, {
                toolId,
                action: params.action || "default",
                params,
              });

              if (!toolsUsed.includes(toolId)) {
                toolsUsed.push(toolId);
                status.toolsUsed = toolsUsed;
              }

              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolId,
                content: JSON.stringify({
                  success: result.success,
                  data: result.data,
                  error: result.error,
                }),
              });

              flowTracker.trackEvent({
                flowId,
                stage: `subagent_tool_${iterationCount}_${toolId}`,
                service: "SubAgentRunner",
                status: result.success ? "success" : "failed",
              });
            } catch (toolError: any) {
              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolId,
                content: JSON.stringify({
                  success: false,
                  error: toolError.message,
                }),
              });

              flowTracker.trackEvent({
                flowId,
                stage: `subagent_tool_${iterationCount}_${toolId}`,
                service: "SubAgentRunner",
                status: "failed",
              });
            }
          }

          continue; // Get next LLM response
        }

        // No tool calls - final response
        const finalResponse = assistantMessage.content || "";

        flowTracker.trackEvent({
          flowId,
          stage: `subagent_iteration_${iterationCount}`,
          service: "SubAgentRunner",
          status: "success",
          data: { finalResponse: true },
        });

        return {
          success: true,
          result: finalResponse,
          toolsUsed,
          iterations: iterationCount,
        };
      } catch (llmError: any) {
        console.error(
          `[SubAgentRunner] LLM error at iteration ${iterationCount}:`,
          llmError.message,
        );

        flowTracker.trackEvent({
          flowId,
          stage: `subagent_iteration_${iterationCount}`,
          service: "SubAgentRunner",
          status: "failed",
          data: { error: llmError.message },
        });

        // If we've had at least one successful iteration, return what we have
        if (iterationCount > 1) {
          return {
            success: false,
            result: `Sub-agent encountered an error after ${iterationCount} iterations: ${llmError.message}`,
            toolsUsed,
            iterations: iterationCount,
            error: llmError.message,
          };
        }

        throw llmError;
      }
    }

    // Max iterations reached
    return {
      success: false,
      result: `Sub-agent reached maximum iterations (${config.maxIterations}) without completing the task.`,
      toolsUsed,
      iterations: iterationCount,
      error: "Max iterations reached",
    };
  }

  /**
   * Build the system prompt for the sub-agent
   */
  private buildSubAgentPrompt(config: SubAgentConfig): string {
    const basePrompt = `# Sub-Agent Context

You are a **sub-agent** spawned by the main AI assistant for a specific task.

## Your Mission
${config.taskDescription}

## Critical Rules
1. **Stay focused** - Complete ONLY your assigned task. Do not deviate.
2. **Be efficient** - Use the minimum number of tool calls necessary.
3. **Report clearly** - Your final message will be returned to the main agent. Make it clear and actionable.
4. **No spawning** - You CANNOT create other sub-agents. Attempting to do so will fail.
5. **Limited tools** - You only have access to these tools: ${config.tools.join(", ")}

## Available Tools
${config.tools.map((t) => `- \`${t}\``).join("\n")}

## Output Format
When you complete your task, provide a clear summary:
- What was accomplished
- Key findings or results
- Any issues encountered
- Recommendations if applicable

Do NOT ask clarifying questions. Work with what you have been given.
Do NOT apologize or explain what you're about to do. Just do it.
`;

    // Add parent context if provided
    if (config.parentContext) {
      return (
        basePrompt + `\n## Context from Main Agent\n${config.parentContext}\n`
      );
    }

    return basePrompt;
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(
    timeoutMs: number,
    subAgentId: string,
  ): Promise<SubAgentResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const status = activeSubAgents.get(subAgentId);
        if (status) {
          status.status = "timeout";
          status.endTime = new Date();
        }
        reject(new Error(`Sub-agent timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Get status of an active sub-agent
   */
  getStatus(subAgentId: string): SubAgentStatus | undefined {
    return activeSubAgents.get(subAgentId);
  }

  /**
   * Get all active sub-agents
   */
  getActiveSubAgents(): SubAgentStatus[] {
    return Array.from(activeSubAgents.values()).filter(
      (s) => s.status === "running",
    );
  }

  /**
   * Spawn a sub-agent from a template
   */
  async spawnFromTemplate(
    userId: string,
    templateId: string,
    task: string,
    options?: {
      parentFlowId?: string;
      parentContext?: string;
      additionalTools?: string[];
    },
  ): Promise<SubAgentResult> {
    const template = getSubAgentTemplate(templateId);
    if (!template) {
      return {
        success: false,
        result: "",
        toolsUsed: [],
        iterations: 0,
        error: `Template not found: ${templateId}`,
        executionTime: 0,
        flowId: "unknown",
      };
    }

    const tools = [
      ...template.defaultTools,
      ...(options?.additionalTools || []),
    ];

    return this.spawn(userId, {
      task,
      taskDescription: template.description,
      tools,
      maxIterations: template.maxIterations,
      promptMode: template.promptMode,
      parentFlowId: options?.parentFlowId,
      parentContext: options?.parentContext,
    });
  }
}

// Export singleton instance
export const subAgentRunner = new SubAgentRunner();
