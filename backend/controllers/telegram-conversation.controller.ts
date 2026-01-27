/**
 * Telegram Conversation Controller
 *
 * Handles:
 * - Conversation history management
 * - Context cleanup and summarization
 * - Memory expiration for old conversations
 */

import {
  cleanupConversation,
  expireOldMessages,
  getConversationContext,
  summarizeConversationHistory,
} from "../services/telegram-conversation-manager.js";

import { AuthRequest } from "../middlewares/auth.middleware.js";
import { Response } from "express";

/**
 * GET /api/telegram/conversation
 * Get recent conversation context
 */
export async function getConversationHistory(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const maxMessages = parseInt(req.query.maxMessages as string) || 10;
    const maxTokens = parseInt(req.query.maxTokens as string) || 4000;

    const context = await getConversationContext(
      userId,
      maxMessages,
      maxTokens,
    );

    return res.json({
      success: true,
      context,
    });
  } catch (error: any) {
    console.error("[TelegramConversationController] Error:", error);
    return res.status(500).json({
      error: "Failed to retrieve conversation history",
      details: error.message,
    });
  }
}

/**
 * POST /api/telegram/conversation/cleanup
 * Clean up old conversation messages
 */
export async function cleanupTelegramConversation(
  req: AuthRequest,
  res: Response,
) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { keepDays = 30 } = req.body;

    if (keepDays < 1 || keepDays > 365) {
      return res
        .status(400)
        .json({ error: "keepDays must be between 1 and 365" });
    }

    const result = await cleanupConversation(userId, keepDays);

    return res.json({
      success: true,
      message: `Archived ${result.archivedCount} messages older than ${keepDays} days`,
      archivedCount: result.archivedCount,
    });
  } catch (error: any) {
    console.error("[TelegramConversationController] Cleanup error:", error);
    return res.status(500).json({
      error: "Failed to cleanup conversation",
      details: error.message,
    });
  }
}

/**
 * POST /api/telegram/conversation/expire
 * Manually expire messages older than X days
 */
export async function expireTelegramMessages(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { olderThanDays = 30 } = req.body;

    if (olderThanDays < 1) {
      return res.status(400).json({
        error: "olderThanDays must be at least 1",
      });
    }

    const count = await expireOldMessages(userId, olderThanDays);

    return res.json({
      success: true,
      message: `Archived ${count} messages`,
      archivedCount: count,
    });
  } catch (error: any) {
    console.error("[TelegramConversationController] Expire error:", error);
    return res.status(500).json({
      error: "Failed to expire messages",
      details: error.message,
    });
  }
}

/**
 * GET /api/telegram/conversation/summary
 * Get a summary of old messages
 */
export async function getTelegramConversationSummary(
  req: AuthRequest,
  res: Response,
) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const daysBack = parseInt(req.query.daysBack as string) || 7;

    if (daysBack < 1 || daysBack > 365) {
      return res
        .status(400)
        .json({ error: "daysBack must be between 1 and 365" });
    }

    const summary = await summarizeConversationHistory(userId, daysBack);

    return res.json({
      success: true,
      summary,
      daysBack,
    });
  } catch (error: any) {
    console.error("[TelegramConversationController] Summary error:", error);
    return res.status(500).json({
      error: "Failed to get conversation summary",
      details: error.message,
    });
  }
}
