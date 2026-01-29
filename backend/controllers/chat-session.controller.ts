/**
 * Chat Session Controller
 *
 * REST API endpoints for managing chat sessions with pi-ai context serialization.
 * Enables:
 * - List, create, update, delete chat sessions
 * - Export/import sessions for backup or transfer
 * - Session statistics and analytics
 */

import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import {
  contextSerializationService,
  type SaveSessionOptions,
  type ListSessionsOptions,
  type ExportedSession,
} from "../services/context-serialization.js";
import { type Context } from "@mariozechner/pi-ai";

// ==================== List Sessions ====================

/**
 * GET /api/chat-sessions
 * List chat sessions for the current user
 *
 * Query params:
 * - status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' (default: not DELETED)
 * - isPinned: boolean
 * - isStarred: boolean
 * - tags: comma-separated list
 * - limit: number (default: 20)
 * - offset: number (default: 0)
 * - orderBy: 'createdAt' | 'updatedAt' | 'lastMessageAt' (default: 'lastMessageAt')
 * - orderDirection: 'asc' | 'desc' (default: 'desc')
 */
export async function listChatSessions(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const options: ListSessionsOptions = {};

    if (req.query.status) {
      options.status = req.query.status as ListSessionsOptions["status"];
    }

    if (req.query.isPinned !== undefined) {
      options.isPinned = req.query.isPinned === "true";
    }

    if (req.query.isStarred !== undefined) {
      options.isStarred = req.query.isStarred === "true";
    }

    if (req.query.tags) {
      options.tags = (req.query.tags as string).split(",");
    }

    if (req.query.limit) {
      options.limit = Math.min(parseInt(req.query.limit as string, 10), 100);
    }

    if (req.query.offset) {
      options.offset = parseInt(req.query.offset as string, 10);
    }

    if (req.query.orderBy) {
      options.orderBy = req.query.orderBy as ListSessionsOptions["orderBy"];
    }

    if (req.query.orderDirection) {
      options.orderDirection = req.query
        .orderDirection as ListSessionsOptions["orderDirection"];
    }

    const result = await contextSerializationService.listChatSessions(
      userId,
      options,
    );

    // Remove serializedContext from response (too large for list view)
    const sessions = result.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      description: session.description,
      lastProvider: session.lastProvider,
      lastModelId: session.lastModelId,
      messageCount: session.messageCount,
      turnCount: session.turnCount,
      totalCostCents: session.totalCostCents,
      status: session.status,
      isPinned: session.isPinned,
      isStarred: session.isStarred,
      tags: session.tags,
      lastMessageAt: session.lastMessageAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));

    return res.json({
      sessions,
      total: result.total,
      limit: options.limit || 20,
      offset: options.offset || 0,
    });
  } catch (error: any) {
    console.error("[ChatSessionController] Error listing sessions:", error);
    return res.status(500).json({
      error: "Failed to list chat sessions",
      message: error.message,
    });
  }
}

// ==================== Get Single Session ====================

/**
 * GET /api/chat-sessions/:sessionId
 * Get a single chat session with full context
 */
export async function getChatSession(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const result = await contextSerializationService.getChatSession(
      sessionId,
      userId,
    );

    if (!result) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({
      session: {
        id: result.session.id,
        title: result.session.title,
        description: result.session.description,
        lastProvider: result.session.lastProvider,
        lastModelId: result.session.lastModelId,
        messageCount: result.session.messageCount,
        turnCount: result.session.turnCount,
        totalInputTokens: result.session.totalInputTokens,
        totalOutputTokens: result.session.totalOutputTokens,
        totalCacheReadTokens: result.session.totalCacheReadTokens,
        totalCacheWriteTokens: result.session.totalCacheWriteTokens,
        totalCostCents: result.session.totalCostCents,
        status: result.session.status,
        isPinned: result.session.isPinned,
        isStarred: result.session.isStarred,
        tags: result.session.tags,
        lastMessageAt: result.session.lastMessageAt,
        archivedAt: result.session.archivedAt,
        createdAt: result.session.createdAt,
        updatedAt: result.session.updatedAt,
      },
      context: result.session.serializedContext,
    });
  } catch (error: any) {
    console.error("[ChatSessionController] Error getting session:", error);
    return res.status(500).json({
      error: "Failed to get chat session",
      message: error.message,
    });
  }
}

// ==================== Create Session ====================

/**
 * POST /api/chat-sessions
 * Create a new chat session
 *
 * Body:
 * - context: pi-ai Context object (systemPrompt, messages, tools)
 * - provider: string (e.g., 'openai')
 * - modelId: string (e.g., 'gpt-4o')
 * - title?: string
 * - description?: string
 * - tags?: string[]
 * - isPinned?: boolean
 * - isStarred?: boolean
 */
export async function createChatSession(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const {
      context,
      provider,
      modelId,
      title,
      description,
      tags,
      isPinned,
      isStarred,
    } = req.body;

    if (!context) {
      return res.status(400).json({ error: "Context is required" });
    }

    if (!provider || !modelId) {
      return res.status(400).json({
        error: "Provider and modelId are required",
      });
    }

    // Validate context structure
    if (!context.messages || !Array.isArray(context.messages)) {
      return res.status(400).json({
        error: "Context must have a messages array",
      });
    }

    const options: SaveSessionOptions = {
      title,
      description,
      tags,
      isPinned,
      isStarred,
    };

    const session = await contextSerializationService.createChatSession(
      userId,
      context as Context,
      { provider, modelId },
      options,
    );

    return res.status(201).json({
      session: {
        id: session.id,
        title: session.title,
        description: session.description,
        lastProvider: session.lastProvider,
        lastModelId: session.lastModelId,
        messageCount: session.messageCount,
        turnCount: session.turnCount,
        status: session.status,
        isPinned: session.isPinned,
        isStarred: session.isStarred,
        tags: session.tags,
        createdAt: session.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[ChatSessionController] Error creating session:", error);
    return res.status(500).json({
      error: "Failed to create chat session",
      message: error.message,
    });
  }
}

// ==================== Update Session ====================

/**
 * PUT /api/chat-sessions/:sessionId
 * Update a chat session with new context
 *
 * Body:
 * - context: pi-ai Context object
 * - provider: string
 * - modelId: string
 */
export async function updateChatSession(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const { context, provider, modelId } = req.body;

    if (!context) {
      return res.status(400).json({ error: "Context is required" });
    }

    if (!provider || !modelId) {
      return res.status(400).json({
        error: "Provider and modelId are required",
      });
    }

    const session = await contextSerializationService.updateChatSession(
      sessionId,
      userId,
      context as Context,
      { provider, modelId },
    );

    return res.json({
      session: {
        id: session.id,
        title: session.title,
        messageCount: session.messageCount,
        turnCount: session.turnCount,
        lastProvider: session.lastProvider,
        lastModelId: session.lastModelId,
        lastMessageAt: session.lastMessageAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("[ChatSessionController] Error updating session:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.status(500).json({
      error: "Failed to update chat session",
      message: error.message,
    });
  }
}

// ==================== Update Session Metadata ====================

/**
 * PATCH /api/chat-sessions/:sessionId
 * Update session metadata (title, tags, etc.)
 *
 * Body:
 * - title?: string
 * - description?: string
 * - tags?: string[]
 * - isPinned?: boolean
 * - isStarred?: boolean
 */
export async function updateChatSessionMetadata(
  req: AuthRequest,
  res: Response,
) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const { title, description, tags, isPinned, isStarred } = req.body;

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (tags !== undefined) updates.tags = tags;
    if (isPinned !== undefined) updates.isPinned = isPinned;
    if (isStarred !== undefined) updates.isStarred = isStarred;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    const session = await contextSerializationService.updateChatSessionMetadata(
      sessionId,
      userId,
      updates,
    );

    return res.json({
      session: {
        id: session.id,
        title: session.title,
        description: session.description,
        isPinned: session.isPinned,
        isStarred: session.isStarred,
        tags: session.tags,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("[ChatSessionController] Error updating metadata:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.status(500).json({
      error: "Failed to update session metadata",
      message: error.message,
    });
  }
}

// ==================== Archive Session ====================

/**
 * POST /api/chat-sessions/:sessionId/archive
 * Archive a chat session
 */
export async function archiveChatSession(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const session = await contextSerializationService.archiveChatSession(
      sessionId,
      userId,
    );

    return res.json({
      session: {
        id: session.id,
        status: session.status,
        archivedAt: session.archivedAt,
      },
    });
  } catch (error: any) {
    console.error("[ChatSessionController] Error archiving session:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.status(500).json({
      error: "Failed to archive chat session",
      message: error.message,
    });
  }
}

// ==================== Delete Session ====================

/**
 * DELETE /api/chat-sessions/:sessionId
 * Delete a chat session (soft delete by default)
 *
 * Query params:
 * - permanent: boolean (if true, permanently delete)
 */
export async function deleteChatSession(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const permanent = req.query.permanent === "true";

    if (permanent) {
      await contextSerializationService.permanentlyDeleteChatSession(
        sessionId,
        userId,
      );
    } else {
      await contextSerializationService.deleteChatSession(sessionId, userId);
    }

    return res.json({
      success: true,
      message: permanent
        ? "Session permanently deleted"
        : "Session deleted (can be restored)",
    });
  } catch (error: any) {
    console.error("[ChatSessionController] Error deleting session:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.status(500).json({
      error: "Failed to delete chat session",
      message: error.message,
    });
  }
}

// ==================== Export Session ====================

/**
 * GET /api/chat-sessions/:sessionId/export
 * Export a chat session to JSON
 */
export async function exportChatSession(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const exported = await contextSerializationService.exportChatSession(
      sessionId,
      userId,
    );

    // Set headers for file download
    const filename = `chat-session-${sessionId}-${Date.now()}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.json(exported);
  } catch (error: any) {
    console.error("[ChatSessionController] Error exporting session:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.status(500).json({
      error: "Failed to export chat session",
      message: error.message,
    });
  }
}

// ==================== Import Session ====================

/**
 * POST /api/chat-sessions/import
 * Import a chat session from JSON
 *
 * Body:
 * - exported: ExportedSession object
 * - title?: string (override imported title)
 * - tags?: string[]
 * - isPinned?: boolean
 * - isStarred?: boolean
 */
export async function importChatSession(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { exported, title, description, tags, isPinned, isStarred } =
      req.body;

    if (!exported) {
      return res
        .status(400)
        .json({ error: "Exported session data is required" });
    }

    // Validate export structure
    if (!exported.version || !exported.context) {
      return res.status(400).json({
        error: "Invalid export format: missing version or context",
      });
    }

    const options: SaveSessionOptions = {
      title,
      description,
      tags,
      isPinned,
      isStarred,
    };

    const session = await contextSerializationService.importChatSession(
      userId,
      exported as ExportedSession,
      options,
    );

    return res.status(201).json({
      session: {
        id: session.id,
        title: session.title,
        description: session.description,
        messageCount: session.messageCount,
        turnCount: session.turnCount,
        status: session.status,
        isPinned: session.isPinned,
        isStarred: session.isStarred,
        tags: session.tags,
        createdAt: session.createdAt,
      },
      message: `Successfully imported session with ${session.messageCount} messages`,
    });
  } catch (error: any) {
    console.error("[ChatSessionController] Error importing session:", error);
    return res.status(500).json({
      error: "Failed to import chat session",
      message: error.message,
    });
  }
}

// ==================== Session Statistics ====================

/**
 * GET /api/chat-sessions/stats
 * Get chat session statistics for the current user
 */
export async function getChatSessionStats(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const stats = await contextSerializationService.getChatSessionStats(userId);

    return res.json({
      stats: {
        ...stats,
        totalCostDollars: stats.totalCostCents / 100,
      },
    });
  } catch (error: any) {
    console.error("[ChatSessionController] Error getting stats:", error);
    return res.status(500).json({
      error: "Failed to get session statistics",
      message: error.message,
    });
  }
}

// ==================== Append Message ====================

/**
 * POST /api/chat-sessions/:sessionId/messages
 * Append a message to an existing session
 *
 * Body:
 * - message: SerializedMessage object
 * - provider?: string
 * - modelId?: string
 */
export async function appendMessageToSession(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const { message, provider, modelId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!message.role || !message.content) {
      return res.status(400).json({
        error: "Message must have role and content",
      });
    }

    const providerInfo =
      provider && modelId ? { provider, modelId } : undefined;

    const session = await contextSerializationService.appendMessageToSession(
      sessionId,
      userId,
      message,
      providerInfo,
    );

    return res.json({
      session: {
        id: session.id,
        messageCount: session.messageCount,
        turnCount: session.turnCount,
        lastMessageAt: session.lastMessageAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("[ChatSessionController] Error appending message:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.status(500).json({
      error: "Failed to append message",
      message: error.message,
    });
  }
}
