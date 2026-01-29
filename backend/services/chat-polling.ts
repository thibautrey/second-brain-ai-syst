/**
 * Chat Polling Service
 *
 * Runs chat orchestration in the background and exposes
 * event/result polling for clients that can't keep SSE open.
 */

import { randomBytes } from "crypto";
import { type ChatOrchestratorRequest, orchestrateChat } from "./chat-orchestrator.js";
import { PollingWriter, type StoredStreamEvent } from "./polling-writer.js";
import { type ToolExecutionResult } from "./chat-orchestrator.js";

export interface PollingJob {
  flowId: string;
  messageId: string;
  userId: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: number;
  updatedAt: number;
  events: StoredStreamEvent[];
  response?: string;
  toolResults?: ToolExecutionResult[];
  error?: string;
  message: string;
  previousMessages: Array<{ role: "user" | "assistant"; content: string }>;
  sessionId?: string;
  sessionTitle?: string;
  saveSession?: boolean;
  sessionSaved?: boolean;
}

const POLLING_LIMITS = {
  MAX_JOBS: 200,
  JOB_TTL_MS: 30 * 60 * 1000,
};

class ChatPollingService {
  private jobs: Map<string, PollingJob> = new Map();

  start(request: ChatOrchestratorRequest): { flowId: string; messageId: string } {
    const flowId = request.flowId || randomBytes(8).toString("hex");
    const messageId = request.messageId || `msg_${Date.now()}`;

    const now = Date.now();
    const job: PollingJob = {
      flowId,
      messageId,
      userId: request.userId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      events: [],
      message: request.message,
      previousMessages: request.previousMessages || [],
      sessionId: request.sessionId,
      sessionTitle: request.sessionTitle,
      saveSession: request.saveSession,
      sessionSaved: false,
    };

    this.jobs.set(flowId, job);
    this.cleanupOldJobs();

    const writer = new PollingWriter(messageId, (event) => {
      job.events.push(event);
      job.updatedAt = Date.now();
    });

    job.status = "running";

    setImmediate(async () => {
      try {
        const result = await orchestrateChat(
          {
            ...request,
            flowId,
            messageId,
          },
          writer,
        );

        job.status = result.success ? "completed" : "failed";
        job.response = result.response;
        job.toolResults = result.toolResults;
        job.updatedAt = Date.now();
        writer.end();
      } catch (error) {
        job.status = "failed";
        job.error = error instanceof Error ? error.message : String(error);
        job.updatedAt = Date.now();
        writer.error(job.error, "INTERNAL_ERROR", true);
        writer.end();
      }
    });

    return { flowId, messageId };
  }

  get(flowId: string): PollingJob | undefined {
    this.cleanupOldJobs();
    return this.jobs.get(flowId);
  }

  getEvents(flowId: string, since = 0): StoredStreamEvent[] {
    const job = this.get(flowId);
    if (!job) return [];
    return job.events.filter((event) => event.seq > since);
  }

  private cleanupOldJobs(): void {
    const now = Date.now();

    for (const [flowId, job] of this.jobs.entries()) {
      if (now - job.updatedAt > POLLING_LIMITS.JOB_TTL_MS) {
        this.jobs.delete(flowId);
      }
    }

    if (this.jobs.size <= POLLING_LIMITS.MAX_JOBS) return;

    const jobsArray = Array.from(this.jobs.values()).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    const toRemove = jobsArray.slice(0, jobsArray.length - POLLING_LIMITS.MAX_JOBS);
    for (const job of toRemove) {
      this.jobs.delete(job.flowId);
    }
  }
}

export const chatPollingService = new ChatPollingService();
