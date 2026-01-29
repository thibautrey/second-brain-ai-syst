/**
 * Orchestrator Agent - coordinates agentic execution lifecycle.
 */

import { randomBytes } from "crypto";
import {
  type ChatMessage,
  piAiProviderService,
  type PiAiProviderConfig,
} from "../pi-ai-provider.js";
import { flowTracker } from "../flow-tracker.js";
import { type StreamWriter } from "../enhanced-streaming.js";
import {
  ExecutionPlanner,
  type ExecutionPlan,
  type ToolCall,
} from "./execution-planner.js";
import { ExecutionWatcher } from "./execution-watcher.js";
import {
  reflectionLLMService,
  type ReflectionResponse,
} from "./reflection-llm.js";
import { WorkerAgent, type WorkerAgentResult } from "./worker-agent.js";

export interface OrchestratorConfig {
  flowId: string;
  userId: string;
  userQuestion: string;
  intentAnalysis: any;
  executionPlan: ExecutionPlan;
  providerConfig: PiAiProviderConfig;
  systemPrompt?: string;
  previousMessages?: ChatMessage[];
  maxReflectionAttempts?: number;
  writer?: StreamWriter;
}

export interface OrchestratorResult {
  success: boolean;
  response: string;
  toolResults: WorkerAgentResult[];
  reflections: ReflectionResponse[];
  totalDuration: number;
  error?: string;
}

export class OrchestratorAgent {
  private config: OrchestratorConfig;
  private watcher: ExecutionWatcher;
  private allToolResults: WorkerAgentResult[] = [];
  private reflections: ReflectionResponse[] = [];
  private attemptNumber = 0;
  private maxAttempts: number;
  private startTime: number;
  private sendStatus(
    message: string,
    phase?:
      | "analyzing"
      | "retrieving"
      | "generating"
      | "executing"
      | "completing",
  ) {
    this.config.writer?.status(message, phase);
  }
  private async sendFriendlyStatus(
    context: string,
    phase?:
      | "analyzing"
      | "retrieving"
      | "generating"
      | "executing"
      | "completing",
  ) {
    if (!this.config.writer) return;
    const friendly = await this.generateFriendlyStatus(context);
    this.config.writer.status(friendly || context, phase);
  }

  private async generateFriendlyStatus(
    context: string,
  ): Promise<string | null> {
    try {
      const prompt: ChatMessage[] = [
        {
          role: "system",
          content:
            'You are a status narrator for a chat assistant. Produce a calm, human-friendly progress blurb in under 12 words. Avoid jargon. Examples: "Skimming your notes…", "Checking tools I can use", "Pulling results together". Never mention tokens or models.',
        },
        { role: "user", content: `Context: ${context}\nStatus:` },
      ];

      const result = await Promise.race([
        piAiProviderService.createChatCompletion(
          this.config.providerConfig,
          prompt,
          {
            temperature: 0.4,
            maxTokens: 24,
          },
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("status_timeout")), 1200),
        ),
      ]);

      if (
        result &&
        typeof result === "object" &&
        "content" in result &&
        typeof result.content === "string"
      ) {
        return result.content.trim();
      }
      return null;
    } catch (error) {
      // Fail silently; fallback handled by caller
      return null;
    }
  }

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.watcher = new ExecutionWatcher();
    this.maxAttempts = config.maxReflectionAttempts ?? 3;
    this.startTime = Date.now();
  }

  async orchestrate(): Promise<OrchestratorResult> {
    try {
      this.sendFriendlyStatus(
        `Planning steps for question: ${this.config.userQuestion.slice(0, 140)}`,
        "analyzing",
      );

      await this.executeToolCalls(this.config.executionPlan.toolCalls);

      while (this.attemptNumber < this.maxAttempts) {
        this.sendFriendlyStatus(
          `Reviewing results (${this.attemptNumber + 1}/${this.maxAttempts})`,
          "analyzing",
        );
        const reflection = await this.reflect();
        this.reflections.push(reflection);

        flowTracker.trackEvent({
          flowId: this.config.flowId,
          stage: `reflection_${this.attemptNumber}`,
          service: "ReflectionLLM",
          status: "success",
          data: {
            decision: reflection.decision,
            confidence: reflection.confidence,
          },
          decision: reflection.reasoning,
        });

        if (
          reflection.decision === "answer" ||
          reflection.decision === "give_up"
        ) {
          this.sendFriendlyStatus("Writing the answer…", "generating");
          const response = await this.generateFinalResponse(reflection);
          return this.buildResult(true, response);
        }

        if (reflection.decision === "ask_user") {
          const response =
            reflection.clarificationQuestion ||
            "Could you clarify what you're expecting?";
          return this.buildResult(true, response);
        }

        if (
          (reflection.decision === "alternative" ||
            reflection.decision === "retry") &&
          reflection.suggestedTools &&
          reflection.suggestedTools.length > 0
        ) {
          const toolCalls: ToolCall[] = reflection.suggestedTools.map(
            (tool) => ({
              id: randomBytes(8).toString("hex"),
              name: tool.toolName,
              arguments: tool.params,
            }),
          );

          this.attemptNumber++;
          await this.executeToolCalls(toolCalls);
          continue;
        }

        break;
      }

      const fallbackResponse = `I tried multiple approaches to answer your question but encountered difficulties.\n\n${this.summarizeAttempts()}`;
      return this.buildResult(false, fallbackResponse);
    } catch (error: any) {
      console.error("[OrchestratorAgent] Error:", error);
      return this.buildResult(
        false,
        "An unexpected error occurred",
        error?.message,
      );
    } finally {
      this.watcher.cleanup();
    }
  }

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<void> {
    if (!toolCalls || toolCalls.length === 0) {
      flowTracker.trackEvent({
        flowId: this.config.flowId,
        stage: "tool_execution",
        service: "WorkerAgent",
        status: "success",
        data: { note: "No tool calls planned" },
      });
      return;
    }

    const agents = toolCalls.map((toolCall) => {
      const agent = new WorkerAgent({
        id: toolCall.id,
        toolName: toolCall.name,
        params: toolCall.arguments,
        userId: this.config.userId,
        flowId: this.config.flowId,
      });

      this.watcher.watch(agent, async (result) => {
        this.allToolResults.push(result);

        flowTracker.trackEvent({
          flowId: this.config.flowId,
          stage: "tool_execution",
          service: "WorkerAgent",
          status: result.status === "success" ? "success" : "failed",
          duration: result.executionTime,
          data: {
            toolName: result.toolName,
            agentId: result.agentId,
            status: result.status,
            ...(result.error && { error: result.error }),
          },
        });
      });

      return agent;
    });

    const toolNames = toolCalls
      .map((t) => t.name)
      .slice(0, 4)
      .join(", ");
    this.sendFriendlyStatus(
      toolCalls.length === 1
        ? `Running ${toolNames || "a helper"}`
        : `Running ${toolCalls.length} helpers: ${toolNames}`,
      "executing",
    );
    this.watcher.startMonitoring();

    await Promise.allSettled(agents.map((agent) => agent.execute()));
    await this.watcher.waitForAll();
    const successes = this.allToolResults.filter(
      (r) => r.status === "success",
    ).length;
    this.sendFriendlyStatus(
      `Finished tools (${successes}/${this.allToolResults.length}); summarizing`,
      "analyzing",
    );
  }

  private async reflect(): Promise<ReflectionResponse> {
    const failedResults = this.allToolResults.filter(
      (r) => r.status === "failed" || r.status === "timeout",
    );

    return await reflectionLLMService.reflect({
      userQuestion: this.config.userQuestion,
      toolResults: this.allToolResults,
      failedAttempts: failedResults,
      previousReflections: this.reflections,
      attemptNumber: this.attemptNumber,
      maxAttempts: this.maxAttempts,
      providerConfig: this.config.providerConfig,
    });
  }

  private async generateFinalResponse(
    reflection: ReflectionResponse,
  ): Promise<string> {
    if (reflection.partialResponse) {
      return reflection.partialResponse;
    }

    const messages: ChatMessage[] = [];

    if (this.config.systemPrompt) {
      messages.push({ role: "system", content: this.config.systemPrompt });
    }

    if (
      this.config.previousMessages &&
      this.config.previousMessages.length > 0
    ) {
      messages.push(
        ...this.config.previousMessages.filter((m) => m.role !== "system"),
      );
    }

    messages.push({
      role: "user",
      content: this.config.userQuestion,
    });

    const toolSummary = this.allToolResults
      .map((r) => {
        const statusLabel =
          r.status === "success"
            ? "✅ success"
            : r.status === "timeout"
              ? "⏱️ timeout"
              : "❌ failed";
        return `${statusLabel} - ${r.toolName}: ${r.error || JSON.stringify(r.data)}`;
      })
      .join("\n");

    messages.push({
      role: "assistant",
      content: `Tool results summary:\n${toolSummary}`,
    });

    const completion = await piAiProviderService.createChatCompletion(
      this.config.providerConfig,
      messages,
      {
        temperature: 0.6,
        maxTokens: 800,
      },
    );

    return completion.content || "I was unable to generate a final response.";
  }

  private summarizeAttempts(): string {
    return this.reflections
      .map((r, i) => `Attempt ${i + 1}: ${r.decision} - ${r.reasoning}`)
      .join("\n");
  }

  private buildResult(
    success: boolean,
    response: string,
    error?: string,
  ): OrchestratorResult {
    const duration = Date.now() - this.startTime;

    return {
      success,
      response,
      toolResults: this.allToolResults,
      reflections: this.reflections,
      totalDuration: duration,
      error,
    };
  }
}

export const AgenticOrchestrator = {
  async run(config: OrchestratorConfig): Promise<OrchestratorResult> {
    const orchestrator = new OrchestratorAgent(config);
    return orchestrator.orchestrate();
  },
  async plan(
    providerConfig: PiAiProviderConfig,
    userQuestion: string,
    intentAnalysis: any,
    availableTools: any[],
  ): Promise<ExecutionPlan> {
    const planner = new ExecutionPlanner(providerConfig);
    return planner.createPlan(userQuestion, intentAnalysis, availableTools);
  },
};
