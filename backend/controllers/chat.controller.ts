/**
 * Chat Controller (Simplified)
 *
 * Handles chat requests with SSE streaming responses.
 * Uses the centralized ChatOrchestrator service for all chat logic.
 *
 * Endpoints:
 * - POST /api/chat - Standard chat endpoint (uses orchestrator)
 * - POST /api/chat/enhanced - Enhanced streaming endpoint (uses orchestrator)
 *
 * Both endpoints now share the same underlying logic including:
 * - Provider configuration and fallback
 * - Memory context retrieval
 * - Tool execution with smart retry
 * - Consistent error handling
 */

import { NextFunction, Response } from "express";

import { AuthRequest } from "../middlewares/auth.middleware.js";
import { SSEWriter } from "../services/enhanced-streaming.js";
import { chatPollingService } from "../services/chat-polling.js";
import { handleSessionPersistence } from "../services/chat-session-persistence.js";
import { orchestrateChat } from "../services/chat-orchestrator.js";
import { processTelegramMessage } from "../services/telegram-chat.js";

// ==================== POST /api/chat ====================

/**
 * POST /api/chat
 * Standard streaming chat endpoint
 *
 * This endpoint provides SSE streaming with:
 * - Real-time token streaming
 * - Tool execution events
 * - Smart retry on failures
 * - Consistent error handling
 */
export async function chatStream(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    message,
    messages: previousMessages,
    sessionId,
    saveSession,
    sessionTitle,
  } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const validPreviousMessages = Array.isArray(previousMessages)
    ? previousMessages
    : [];

  // Track session info for persistence
  let activeSessionId = sessionId as string | undefined;
  const shouldSaveSession = saveSession === true;

  // Create SSE writer
  const messageId = `msg_${Date.now()}`;
  const writer = new SSEWriter(res, messageId);

  try {
    // Use the centralized orchestrator
    const result = await orchestrateChat(
      {
        userId,
        message,
        previousMessages: validPreviousMessages,
        sessionId: activeSessionId,
        saveSession: shouldSaveSession,
        sessionTitle,
      },
      writer,
    );

    // Handle session persistence if requested
    if (shouldSaveSession && result.success && result.response) {
      await handleSessionPersistence({
        userId,
        message,
        response: result.response,
        previousMessages: validPreviousMessages,
        activeSessionId,
        sessionTitle,
        modelId: result.modelId || "unknown",
        provider: "openai",
      });
    }

    // End the stream with model information
    writer.end(result.modelId);
  } catch (error) {
    console.error("[ChatController] Chat stream error:", error);

    if (writer.isOpen()) {
      writer.error(
        error instanceof Error ? error.message : "An error occurred",
        "INTERNAL_ERROR",
        true,
      );
      writer.end();
    }
  }
}

// ==================== POST /api/chat/enhanced ====================

/**
 * POST /api/chat/enhanced
 * Enhanced streaming with detailed events
 *
 * This endpoint provides the same functionality as /api/chat but with
 * additional event types for richer UX:
 * - Thinking/reasoning progress
 * - Real-time tool argument preview
 * - Detailed status updates
 * - Cost tracking
 *
 * Both endpoints now use the same orchestrator, ensuring consistent behavior.
 */
export async function chatStreamEnhanced(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { message, messages: previousMessages } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const validPreviousMessages = Array.isArray(previousMessages)
    ? previousMessages
    : [];

  // Create SSE writer
  const messageId = `msg_${Date.now()}`;
  const writer = new SSEWriter(res, messageId);

  try {
    // Use the centralized orchestrator
    const result = await orchestrateChat(
      {
        userId,
        message,
        previousMessages: validPreviousMessages,
      },
      writer,
    );

    // End the stream with model information
    writer.end(result.modelId);
  } catch (error) {
    console.error("[ChatController] Enhanced chat stream error:", error);

    if (writer.isOpen()) {
      writer.error(
        error instanceof Error ? error.message : "Une erreur est survenue",
        "INTERNAL_ERROR",
        true,
      );
      writer.end();
    }
  }
}

// ==================== POST /api/chat/polling/start ====================

/**
 * POST /api/chat/polling/start
 * Starts a chat flow that can be polled for updates/results.
 */
export async function chatPollingStart(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    message,
    messages: previousMessages,
    sessionId,
    saveSession,
    sessionTitle,
  } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const validPreviousMessages = Array.isArray(previousMessages)
    ? previousMessages
    : [];

  const shouldSaveSession = saveSession === true;

  const { flowId, messageId } = chatPollingService.start({
    userId,
    message,
    previousMessages: validPreviousMessages,
    sessionId,
    saveSession: shouldSaveSession,
    sessionTitle,
  });

  res.json({
    flowId,
    messageId,
    status: "started",
    pollAfterMs: 1200,
  });
}

// ==================== GET /api/chat/polling/:flowId ====================

/**
 * GET /api/chat/polling/:flowId
 * Poll for events/results from a chat flow.
 */
export async function chatPollingStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const flowId = req.params.flowId;
  const sinceRaw = req.query.since;
  const parsedSince = typeof sinceRaw === "string" ? Number(sinceRaw) : 0;
  const since =
    Number.isFinite(parsedSince) && parsedSince > 0 ? parsedSince : 0;

  const job = chatPollingService.get(flowId);
  if (!job || job.userId !== userId) {
    return res.status(404).json({ error: "Flow not found" });
  }

  const events = chatPollingService.getEvents(flowId, since);
  const lastSeq = events.length > 0 ? events[events.length - 1].seq : since;

  if (
    job.status === "completed" &&
    job.saveSession &&
    !job.sessionSaved &&
    job.response
  ) {
    job.sessionSaved = true;
    await handleSessionPersistence({
      userId,
      message: job.message,
      response: job.response,
      previousMessages: job.previousMessages,
      activeSessionId: job.sessionId,
      sessionTitle: job.sessionTitle,
      modelId: "unknown",
      provider: "openai",
    });
  }

  res.json({
    flowId: job.flowId,
    messageId: job.messageId,
    status: job.status,
    done: job.status === "completed" || job.status === "failed",
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    events,
    lastSeq,
    response: job.status === "completed" ? job.response : undefined,
    toolResults:
      job.status === "completed" || job.status === "failed"
        ? job.toolResults
        : undefined,
    error: job.status === "failed" ? job.error : undefined,
  });
}

// ==================== Telegram Integration ====================

/**
 * Re-export for Telegram message processing
 * This is handled separately from the main chat flow
 */
export { processTelegramMessage };

// ==================== Export ====================

export default {
  chatStream,
  chatStreamEnhanced,
  chatPollingStart,
  chatPollingStatus,
  processTelegramMessage,
};
