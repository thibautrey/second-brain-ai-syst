/**
 * Execution Watcher - monitors multiple worker agents and aggregates progress.
 */

import { WorkerAgent, type WorkerAgentResult } from "./worker-agent.js";

export interface WatcherProgress {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  timeouts: number;
}

export type CompletionCallback = (
  result: WorkerAgentResult,
) => void | Promise<void>;

export class ExecutionWatcher {
  private agents: Map<string, WorkerAgent> = new Map();
  private callbacks: Map<string, CompletionCallback> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  watch(agent: WorkerAgent, onComplete: CompletionCallback): void {
    this.agents.set(agent.getId(), agent);
    this.callbacks.set(agent.getId(), onComplete);
  }

  startMonitoring(intervalMs: number = 500): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      this.checkAgents().catch((error) =>
        console.error("[ExecutionWatcher] monitor error:", error),
      );
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
  }

  private async checkAgents(): Promise<void> {
    const completed: string[] = [];

    for (const [agentId, agent] of this.agents.entries()) {
      const status = agent.getStatus();

      if (status !== "pending" && status !== "running") {
        const callback = this.callbacks.get(agentId);
        const result = agent.getResult();

        if (callback && result) {
          try {
            await callback(result);
          } catch (error) {
            console.error(
              `[ExecutionWatcher] Callback error for agent ${agentId}:`,
              error,
            );
          }
        }

        completed.push(agentId);
      }
    }

    // Cleanup completed agents
    for (const agentId of completed) {
      this.agents.delete(agentId);
      this.callbacks.delete(agentId);
    }

    if (this.agents.size === 0) {
      this.stopMonitoring();
    }
  }

  getProgress(): WatcherProgress {
    let completed = 0;
    let failed = 0;
    let running = 0;
    let pending = 0;
    let timeouts = 0;

    for (const agent of this.agents.values()) {
      const status = agent.getStatus();
      switch (status) {
        case "success":
          completed++;
          break;
        case "failed":
          failed++;
          break;
        case "timeout":
          timeouts++;
          break;
        case "running":
          running++;
          break;
        case "pending":
        default:
          pending++;
      }
    }

    return {
      total: this.agents.size,
      completed,
      failed,
      running,
      pending,
      timeouts,
    };
  }

  async waitForAll(): Promise<WorkerAgentResult[]> {
    return new Promise((resolve) => {
      const results: WorkerAgentResult[] = [];

      if (this.agents.size === 0) {
        this.stopMonitoring();
        resolve(results);
        return;
      }

      const checkComplete = () => {
        if (this.agents.size === 0) {
          this.stopMonitoring();
          resolve(results);
        }
      };

      for (const [agentId, agent] of this.agents.entries()) {
        const originalCallback = this.callbacks.get(agentId);
        this.callbacks.set(agentId, async (result) => {
          results.push(result);
          if (originalCallback) {
            await originalCallback(result);
          }
          checkComplete();
        });
      }

      this.startMonitoring();
    });
  }

  cleanup(): void {
    this.stopMonitoring();
    this.agents.clear();
    this.callbacks.clear();
  }
}
