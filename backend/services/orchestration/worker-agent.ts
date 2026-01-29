/**
 * Worker Agent - autonomous executor for a single tool call.
 *
 * Responsibilities:
 * - Execute one tool call with a per-agent timeout
 * - Track status and execution time
 * - Produce a normalized result payload
 */

import { toolExecutorService } from "../tool-executor.js";

export interface WorkerAgentConfig {
  id: string;
  toolName: string;
  params: Record<string, any>;
  timeout?: number;
  userId: string;
  flowId: string;
}

export type AgentStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "timeout";

export interface WorkerAgentResult {
  agentId: string;
  toolName: string;
  status: AgentStatus;
  data?: any;
  error?: string;
  params?: Record<string, any>; // Parameters used - included on failure for debugging
  executionTime: number;
  timestamp: Date;
}

export class WorkerAgent {
  private config: WorkerAgentConfig;
  private status: AgentStatus = "pending";
  private startTime: number | null = null;
  private result: WorkerAgentResult | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;

  constructor(config: WorkerAgentConfig) {
    this.config = {
      ...config,
      timeout: config.timeout ?? 30000, // default 30s
    };
  }

  async execute(): Promise<WorkerAgentResult> {
    this.status = "running";
    this.startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        this.timeoutHandle = setTimeout(() => {
          reject(
            new Error(`Tool execution timeout after ${this.config.timeout}ms`),
          );
        }, this.config.timeout);
      });

      const data = await Promise.race([this.executeTool(), timeoutPromise]);

      this.status = "success";
      this.result = this.buildResult("success", data);
    } catch (error: any) {
      const isTimeout = error?.message?.includes("timeout");
      this.status = isTimeout ? "timeout" : "failed";
      this.result = this.buildResult(
        this.status,
        undefined,
        error?.message || String(error),
      );
    } finally {
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
      }
    }

    return this.result!;
  }

  private async executeTool(): Promise<any> {
    // Extract action from params if present, default to "execute"
    const { action = "execute", ...params } = this.config.params || {};

    const result = await toolExecutorService.executeTool(
      this.config.userId,
      {
        toolId: this.config.toolName,
        action,
        params,
      },
      { softValidation: true },
    );

    if (!result.success) {
      throw new Error(result.error || "Tool execution failed");
    }

    return result.data;
  }

  private buildResult(
    status: AgentStatus,
    data?: any,
    error?: string,
  ): WorkerAgentResult {
    const executionTime =
      this.startTime !== null ? Date.now() - this.startTime : 0;

    return {
      agentId: this.config.id,
      toolName: this.config.toolName,
      status,
      data,
      error,
      // Include params on failure so LLM can see what went wrong and correct it
      ...(status !== "success" && { params: this.config.params }),
      executionTime,
      timestamp: new Date(),
    };
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  getResult(): WorkerAgentResult | null {
    return this.result;
  }

  getId(): string {
    return this.config.id;
  }
}
