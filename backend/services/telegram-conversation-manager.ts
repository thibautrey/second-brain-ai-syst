/**
 * Telegram Conversation Manager
 *
 * Handles persistent storage and retrieval of Telegram conversations
 * - Stores messages in database
 * - Retrieves recent messages with intelligent pagination
 * - Implements context windowing to prevent overflow
 * - Supports message summarization for old conversations
 */

import prisma from "./prisma.js";

export interface TelegramMessage {
  id?: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Date;
}

export interface ConversationContext {
  recentMessages: TelegramMessage[];
  summarizedContext?: string;
  messageCount: number;
  contextTokens: number;
}

/**
 * Store a message from a Telegram conversation
 */
export async function storeTelegramMessage(
  userId: string,
  role: "user" | "assistant",
  content: string,
): Promise<any> {
  try {
    // Create a memory entry for the message
    const memory = await prisma.memory.create({
      data: {
        userId,
        content,
        type: "SHORT_TERM",
        sourceType: "telegram",
        importanceScore: 0.3, // Low importance for conversation history
        tags: ["telegram-history"],
        metadata: {
          role,
          messageType: "conversation",
        },
      },
    });

    return memory;
  } catch (error) {
    console.error(
      "[TelegramConversationManager] Failed to store message:",
      error,
    );
    throw error;
  }
}

/**
 * Retrieve recent Telegram conversation context
 * - Gets the last N messages (configurable)
 * - Respects token limits
 * - Older messages can be summarized instead of included fully
 */
export async function getConversationContext(
  userId: string,
  maxMessages: number = 10,
  maxContextTokens: number = 4000,
): Promise<ConversationContext> {
  try {
    // Get recent telegram messages from memories
    const recentMemories = await prisma.memory.findMany({
      where: {
        userId,
        sourceType: "telegram",
        isArchived: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: maxMessages * 2, // Get more to filter
    });

    // Convert memories to message format
    const messages: TelegramMessage[] = recentMemories
      .reverse()
      .map((memory) => ({
        userId,
        role: (memory.metadata as any)?.role || "assistant",
        content: memory.content,
        createdAt: memory.createdAt,
      }));

    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    let totalTokens = 0;
    const selectedMessages: TelegramMessage[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = Math.ceil(msg.content.length / 4);

      if (totalTokens + msgTokens <= maxContextTokens) {
        selectedMessages.unshift(msg);
        totalTokens += msgTokens;
      } else {
        break;
      }
    }

    return {
      recentMessages: selectedMessages,
      messageCount: selectedMessages.length,
      contextTokens: totalTokens,
    };
  } catch (error) {
    console.error(
      "[TelegramConversationManager] Failed to get conversation context:",
      error,
    );
    return {
      recentMessages: [],
      messageCount: 0,
      contextTokens: 0,
    };
  }
}

/**
 * Expire old telegram messages (older than X days)
 * This prevents infinite growth of conversation history
 */
export async function expireOldMessages(
  userId: string,
  olderThanDays: number = 30,
): Promise<number> {
  try {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - olderThanDays);

    const result = await prisma.memory.updateMany({
      where: {
        userId,
        sourceType: "telegram",
        createdAt: {
          lt: expirationDate,
        },
      },
      data: {
        isArchived: true,
      },
    });

    console.log(
      `[TelegramConversationManager] Archived ${result.count} messages older than ${olderThanDays} days`,
    );
    return result.count;
  } catch (error) {
    console.error(
      "[TelegramConversationManager] Failed to expire old messages:",
      error,
    );
    return 0;
  }
}

/**
 * Get conversation summary for old messages
 * This creates a compressed version of old messages
 */
export async function summarizeConversationHistory(
  userId: string,
  daysBack: number = 7,
  upTo: Date = new Date(),
): Promise<string> {
  try {
    const startDate = new Date(upTo);
    startDate.setDate(startDate.getDate() - daysBack);

    const messages = await prisma.memory.findMany({
      where: {
        userId,
        sourceType: "telegram",
        isArchived: false,
        createdAt: {
          gte: startDate,
          lt: upTo,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (messages.length === 0) {
      return "";
    }

    // Create a compact summary of the conversation
    const userMessages = messages.filter(
      (m) => (m.metadata as any)?.role === "user",
    );
    const assistantMessages = messages.filter(
      (m) => (m.metadata as any)?.role === "assistant",
    );

    const summary = `[Résumé conversation ${daysBack} jours]:
      - ${userMessages.length} messages utilisateur
      - ${assistantMessages.length} réponses assistant
      - Topics couverts: ${extractTopics(messages).join(", ")}`;

    return summary;
  } catch (error) {
    console.error(
      "[TelegramConversationManager] Failed to summarize conversation:",
      error,
    );
    return "";
  }
}

/**
 * Extract key topics from messages
 */
function extractTopics(memories: any[]): string[] {
  const topics = new Set<string>();

  memories.forEach((memory) => {
    if (memory.tags && Array.isArray(memory.tags)) {
      memory.tags.forEach((tag: string) => {
        if (tag !== "telegram-history") {
          topics.add(tag);
        }
      });
    }
  });

  return Array.from(topics).slice(0, 5); // Return top 5 topics
}

/**
 * Clean up conversation (soft delete old messages)
 */
export async function cleanupConversation(
  userId: string,
  keepDays: number = 30,
): Promise<{ archivedCount: number }> {
  try {
    const archivedCount = await expireOldMessages(userId, keepDays);

    return { archivedCount };
  } catch (error) {
    console.error(
      "[TelegramConversationManager] Failed to cleanup conversation:",
      error,
    );
    return { archivedCount: 0 };
  }
}
