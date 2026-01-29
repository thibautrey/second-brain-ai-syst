/**
 * Context Serialization Service
 *
 * Provides pi-ai Context serialization/deserialization for persistent chat sessions.
 * This enables:
 * - Conversation persistence across server restarts
 * - Export/Import of conversations
 * - Cross-provider handoff with context preservation
 * - Complete history preservation including thinking blocks, tool calls, and usage
 *
 * Uses @mariozechner/pi-ai's native JSON serialization format.
 */

import {
  type Context,
  type Tool,
  type AssistantMessage,
} from "@mariozechner/pi-ai";
import prisma from "./prisma.js";
import type { ChatSession, Prisma } from "@prisma/client";

// ==================== Types ====================

/**
 * Serialized context structure (JSON-compatible)
 * Matches pi-ai's Context type but as plain JSON
 */
export interface SerializedContext {
  version: number; // Schema version for future migrations
  systemPrompt?: string;
  messages: SerializedMessage[];
  tools?: SerializedTool[];
  metadata?: {
    createdAt: string;
    lastUpdatedAt: string;
    providerHistory: Array<{
      provider: string;
      modelId: string;
      timestamp: string;
    }>;
  };
}

/**
 * Serialized message (user or assistant)
 */
export interface SerializedMessage {
  role: "user" | "assistant";
  content: string | SerializedContentBlock[];
  timestamp: number;
  // For assistant messages, include usage and thinking data
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      total: number;
    };
  };
  provider?: string;
  model?: string;
  stopReason?: string;
}

/**
 * Content blocks (text, thinking, tool calls, images)
 */
export interface SerializedContentBlock {
  type: "text" | "thinking" | "toolCall" | "image";
  // Text/thinking content
  text?: string;
  thinking?: string;
  // Tool call data
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  // Image data
  data?: string; // base64
  mimeType?: string;
}

/**
 * Serialized tool definition
 */
export interface SerializedTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

/**
 * Options for saving a chat session
 */
export interface SaveSessionOptions {
  title?: string;
  description?: string;
  tags?: string[];
  isPinned?: boolean;
  isStarred?: boolean;
}

/**
 * Options for listing chat sessions
 */
export interface ListSessionsOptions {
  status?: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";
  isPinned?: boolean;
  isStarred?: boolean;
  tags?: string[];
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt" | "lastMessageAt";
  orderDirection?: "asc" | "desc";
}

/**
 * Export format for chat sessions
 */
export interface ExportedSession {
  version: number;
  exportedAt: string;
  session: {
    id: string;
    title: string | null;
    description: string | null;
    tags: string[];
    messageCount: number;
    turnCount: number;
    totalCostCents: number;
    createdAt: string;
    lastMessageAt: string | null;
  };
  context: SerializedContext;
}

// ==================== Serialization Functions ====================

/**
 * Serialize a pi-ai Context to JSON-compatible format
 */
export function serializeContext(
  context: Context,
  providerInfo?: { provider: string; modelId: string },
): SerializedContext {
  const now = new Date().toISOString();

  const serialized: SerializedContext = {
    version: 1,
    systemPrompt: context.systemPrompt,
    messages: context.messages.map((msg) => serializeMessage(msg)),
    tools: context.tools?.map((tool) => serializeTool(tool)),
    metadata: {
      createdAt: now,
      lastUpdatedAt: now,
      providerHistory: providerInfo
        ? [
            {
              provider: providerInfo.provider,
              modelId: providerInfo.modelId,
              timestamp: now,
            },
          ]
        : [],
    },
  };

  return serialized;
}

/**
 * Serialize a single message
 */
function serializeMessage(msg: Context["messages"][number]): SerializedMessage {
  if (msg.role === "user") {
    // User message
    const userMsg = msg as {
      role: "user";
      content: string | any[];
      timestamp: number;
    };
    return {
      role: "user",
      content:
        typeof userMsg.content === "string"
          ? userMsg.content
          : serializeContentBlocks(userMsg.content),
      timestamp: userMsg.timestamp,
    };
  } else {
    // Assistant message
    const assistantMsg = msg as AssistantMessage;
    return {
      role: "assistant",
      content: serializeContentBlocks(assistantMsg.content),
      timestamp: assistantMsg.timestamp,
      usage: assistantMsg.usage,
      provider: assistantMsg.provider,
      model: assistantMsg.model,
      stopReason: assistantMsg.stopReason,
    };
  }
}

/**
 * Serialize content blocks (text, thinking, tool calls, images)
 */
function serializeContentBlocks(blocks: any[]): SerializedContentBlock[] {
  return blocks.map((block) => {
    if (block.type === "text") {
      return { type: "text" as const, text: block.text };
    } else if (block.type === "thinking") {
      return { type: "thinking" as const, thinking: block.thinking };
    } else if (block.type === "toolCall") {
      return {
        type: "toolCall" as const,
        id: block.id,
        name: block.name,
        arguments: block.arguments,
      };
    } else if (block.type === "image") {
      return {
        type: "image" as const,
        data: block.data,
        mimeType: block.mimeType,
      };
    }
    // Unknown type - preserve as-is
    return block;
  });
}

/**
 * Serialize a tool definition
 */
function serializeTool(tool: Tool): SerializedTool {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as Record<string, unknown>,
  };
}

/**
 * Deserialize JSON back to pi-ai Context format
 */
export function deserializeContext(serialized: SerializedContext): Context {
  const context: Context = {
    systemPrompt: serialized.systemPrompt,
    messages: serialized.messages.map((msg) => deserializeMessage(msg)),
    tools: serialized.tools?.map((tool) => deserializeTool(tool)),
  };

  return context;
}

/**
 * Deserialize a message back to pi-ai format
 */
function deserializeMessage(
  msg: SerializedMessage,
): Context["messages"][number] {
  if (msg.role === "user") {
    return {
      role: "user" as const,
      content:
        typeof msg.content === "string"
          ? msg.content
          : deserializeContentBlocks(msg.content),
      timestamp: msg.timestamp,
    };
  } else {
    // Reconstruct AssistantMessage
    return {
      role: "assistant" as const,
      content: Array.isArray(msg.content)
        ? deserializeContentBlocks(msg.content)
        : [{ type: "text" as const, text: msg.content }],
      api: "openai-completions" as const, // Default, may be overridden
      provider: msg.provider || "openai",
      model: msg.model || "unknown",
      stopReason: (msg.stopReason || "stop") as any,
      usage: msg.usage || {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      timestamp: msg.timestamp,
    } as AssistantMessage;
  }
}

/**
 * Deserialize content blocks
 */
function deserializeContentBlocks(blocks: SerializedContentBlock[]): any[] {
  return blocks.map((block) => {
    switch (block.type) {
      case "text":
        return { type: "text" as const, text: block.text };
      case "thinking":
        return { type: "thinking" as const, thinking: block.thinking };
      case "toolCall":
        return {
          type: "toolCall" as const,
          id: block.id,
          name: block.name,
          arguments: block.arguments,
        };
      case "image":
        return {
          type: "image" as const,
          data: block.data,
          mimeType: block.mimeType,
        };
      default:
        return block;
    }
  });
}

/**
 * Deserialize a tool definition
 */
function deserializeTool(tool: SerializedTool): Tool {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as any,
  };
}

// ==================== Session Management ====================

/**
 * Create a new chat session
 */
export async function createChatSession(
  userId: string,
  context: Context,
  providerInfo: { provider: string; modelId: string },
  options: SaveSessionOptions = {},
): Promise<ChatSession> {
  const serialized = serializeContext(context, providerInfo);
  const messageCount = context.messages.length;
  const turnCount = Math.floor(
    context.messages.filter((m) => m.role === "user").length,
  );

  // Calculate total usage from all assistant messages
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalCostCents = 0;

  for (const msg of serialized.messages) {
    if (msg.role === "assistant" && msg.usage) {
      totalInputTokens += msg.usage.input;
      totalOutputTokens += msg.usage.output;
      totalCacheReadTokens += msg.usage.cacheRead;
      totalCacheWriteTokens += msg.usage.cacheWrite;
      totalCostCents += Math.round(msg.usage.cost.total * 100); // Convert to cents
    }
  }

  const session = await prisma.chatSession.create({
    data: {
      userId,
      title: options.title || generateSessionTitle(context),
      description: options.description,
      serializedContext: serialized as unknown as Prisma.InputJsonValue,
      lastProvider: providerInfo.provider,
      lastModelId: providerInfo.modelId,
      messageCount,
      turnCount,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      totalCostCents,
      isPinned: options.isPinned || false,
      isStarred: options.isStarred || false,
      tags: options.tags || [],
      lastMessageAt: new Date(),
      status: "ACTIVE",
    },
  });

  console.log(
    `[ContextSerialization] Created session ${session.id} with ${messageCount} messages`,
  );

  return session;
}

/**
 * Update an existing chat session with new context
 */
export async function updateChatSession(
  sessionId: string,
  userId: string,
  context: Context,
  providerInfo: { provider: string; modelId: string },
): Promise<ChatSession> {
  // Verify ownership
  const existing = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!existing) {
    throw new Error(`Session ${sessionId} not found or access denied`);
  }

  // Merge provider history
  const existingSerialized =
    existing.serializedContext as unknown as SerializedContext;
  const newSerialized = serializeContext(context, providerInfo);

  if (existingSerialized.metadata?.providerHistory) {
    newSerialized.metadata = {
      ...newSerialized.metadata!,
      providerHistory: [
        ...existingSerialized.metadata.providerHistory,
        ...newSerialized.metadata!.providerHistory,
      ],
    };
  }

  const messageCount = context.messages.length;
  const turnCount = Math.floor(
    context.messages.filter((m) => m.role === "user").length,
  );

  // Calculate total usage
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalCostCents = 0;

  for (const msg of newSerialized.messages) {
    if (msg.role === "assistant" && msg.usage) {
      totalInputTokens += msg.usage.input;
      totalOutputTokens += msg.usage.output;
      totalCacheReadTokens += msg.usage.cacheRead;
      totalCacheWriteTokens += msg.usage.cacheWrite;
      totalCostCents += Math.round(msg.usage.cost.total * 100);
    }
  }

  const session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      serializedContext: newSerialized as unknown as Prisma.InputJsonValue,
      lastProvider: providerInfo.provider,
      lastModelId: providerInfo.modelId,
      messageCount,
      turnCount,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      totalCostCents,
      lastMessageAt: new Date(),
    },
  });

  console.log(
    `[ContextSerialization] Updated session ${sessionId} - ${messageCount} messages`,
  );

  return session;
}

/**
 * Get a chat session and deserialize its context
 */
export async function getChatSession(
  sessionId: string,
  userId: string,
): Promise<{ session: ChatSession; context: Context } | null> {
  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userId,
      status: { not: "DELETED" },
    },
  });

  if (!session) {
    return null;
  }

  const serialized = session.serializedContext as unknown as SerializedContext;
  const context = deserializeContext(serialized);

  return { session, context };
}

/**
 * List chat sessions for a user
 */
export async function listChatSessions(
  userId: string,
  options: ListSessionsOptions = {},
): Promise<{ sessions: ChatSession[]; total: number }> {
  const where: Prisma.ChatSessionWhereInput = {
    userId,
    status: options.status || { not: "DELETED" },
  };

  if (options.isPinned !== undefined) {
    where.isPinned = options.isPinned;
  }

  if (options.isStarred !== undefined) {
    where.isStarred = options.isStarred;
  }

  if (options.tags && options.tags.length > 0) {
    where.tags = { hasSome: options.tags };
  }

  const orderBy: Prisma.ChatSessionOrderByWithRelationInput = {
    [options.orderBy || "lastMessageAt"]: options.orderDirection || "desc",
  };

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      orderBy,
      take: options.limit || 20,
      skip: options.offset || 0,
    }),
    prisma.chatSession.count({ where }),
  ]);

  return { sessions, total };
}

/**
 * Archive a chat session
 */
export async function archiveChatSession(
  sessionId: string,
  userId: string,
): Promise<ChatSession> {
  const session = await prisma.chatSession.updateMany({
    where: { id: sessionId, userId },
    data: {
      status: "ARCHIVED",
      archivedAt: new Date(),
    },
  });

  if (session.count === 0) {
    throw new Error(`Session ${sessionId} not found or access denied`);
  }

  return prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } });
}

/**
 * Delete a chat session (soft delete)
 */
export async function deleteChatSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  const result = await prisma.chatSession.updateMany({
    where: { id: sessionId, userId },
    data: { status: "DELETED" },
  });

  if (result.count === 0) {
    throw new Error(`Session ${sessionId} not found or access denied`);
  }

  console.log(`[ContextSerialization] Deleted session ${sessionId}`);
}

/**
 * Permanently delete a chat session
 */
export async function permanentlyDeleteChatSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  const result = await prisma.chatSession.deleteMany({
    where: { id: sessionId, userId },
  });

  if (result.count === 0) {
    throw new Error(`Session ${sessionId} not found or access denied`);
  }

  console.log(
    `[ContextSerialization] Permanently deleted session ${sessionId}`,
  );
}

/**
 * Update session metadata (title, tags, etc.)
 */
export async function updateChatSessionMetadata(
  sessionId: string,
  userId: string,
  updates: {
    title?: string;
    description?: string;
    tags?: string[];
    isPinned?: boolean;
    isStarred?: boolean;
  },
): Promise<ChatSession> {
  const result = await prisma.chatSession.updateMany({
    where: { id: sessionId, userId },
    data: updates,
  });

  if (result.count === 0) {
    throw new Error(`Session ${sessionId} not found or access denied`);
  }

  return prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } });
}

// ==================== Export/Import ====================

/**
 * Export a chat session to JSON format
 */
export async function exportChatSession(
  sessionId: string,
  userId: string,
): Promise<ExportedSession> {
  const result = await getChatSession(sessionId, userId);

  if (!result) {
    throw new Error(`Session ${sessionId} not found or access denied`);
  }

  const { session } = result;
  const serialized = session.serializedContext as unknown as SerializedContext;

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    session: {
      id: session.id,
      title: session.title,
      description: session.description,
      tags: session.tags,
      messageCount: session.messageCount,
      turnCount: session.turnCount,
      totalCostCents: session.totalCostCents,
      createdAt: session.createdAt.toISOString(),
      lastMessageAt: session.lastMessageAt?.toISOString() || null,
    },
    context: serialized,
  };
}

/**
 * Import a chat session from exported JSON
 */
export async function importChatSession(
  userId: string,
  exported: ExportedSession,
  options: SaveSessionOptions = {},
): Promise<ChatSession> {
  // Validate version
  if (exported.version !== 1) {
    throw new Error(`Unsupported export version: ${exported.version}`);
  }

  // Get provider info from metadata or use defaults
  const providerInfo = exported.context.metadata?.providerHistory?.[0] || {
    provider: "openai",
    modelId: "imported",
  };

  const context = deserializeContext(exported.context);

  const session = await createChatSession(userId, context, providerInfo, {
    title: options.title || exported.session.title || "Imported Session",
    description:
      options.description || exported.session.description || undefined,
    tags: options.tags || exported.session.tags,
    isPinned: options.isPinned,
    isStarred: options.isStarred,
  });

  console.log(
    `[ContextSerialization] Imported session ${session.id} with ${exported.session.messageCount} messages`,
  );

  return session;
}

// ==================== Utilities ====================

/**
 * Generate a session title from context
 */
function generateSessionTitle(context: Context): string {
  // Find the first user message
  const firstUserMessage = context.messages.find((m) => m.role === "user");

  if (!firstUserMessage) {
    return `Session ${new Date().toLocaleDateString()}`;
  }

  // Extract text content
  let content: string;
  if (typeof (firstUserMessage as any).content === "string") {
    content = (firstUserMessage as any).content;
  } else {
    const textBlock = (firstUserMessage as any).content?.find(
      (b: any) => b.type === "text",
    );
    content = textBlock?.text || "";
  }

  // Truncate to a reasonable length
  const maxLength = 50;
  if (content.length <= maxLength) {
    return content;
  }

  return content.substring(0, maxLength).trim() + "...";
}

/**
 * Append a message to a session context
 * Useful for incrementally updating sessions
 */
export async function appendMessageToSession(
  sessionId: string,
  userId: string,
  message: SerializedMessage,
  providerInfo?: { provider: string; modelId: string },
): Promise<ChatSession> {
  const existing = await getChatSession(sessionId, userId);

  if (!existing) {
    throw new Error(`Session ${sessionId} not found or access denied`);
  }

  const serialized = existing.session
    .serializedContext as unknown as SerializedContext;
  serialized.messages.push(message);
  serialized.metadata = {
    ...serialized.metadata!,
    lastUpdatedAt: new Date().toISOString(),
  };

  // Add to provider history if changed
  if (
    providerInfo &&
    serialized.metadata.providerHistory &&
    (serialized.metadata.providerHistory.length === 0 ||
      serialized.metadata.providerHistory[
        serialized.metadata.providerHistory.length - 1
      ].provider !== providerInfo.provider ||
      serialized.metadata.providerHistory[
        serialized.metadata.providerHistory.length - 1
      ].modelId !== providerInfo.modelId)
  ) {
    serialized.metadata.providerHistory.push({
      ...providerInfo,
      timestamp: new Date().toISOString(),
    });
  }

  const messageCount = serialized.messages.length;
  const turnCount = Math.floor(
    serialized.messages.filter((m) => m.role === "user").length,
  );

  // Recalculate totals
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalCostCents = 0;

  for (const msg of serialized.messages) {
    if (msg.role === "assistant" && msg.usage) {
      totalInputTokens += msg.usage.input;
      totalOutputTokens += msg.usage.output;
      totalCacheReadTokens += msg.usage.cacheRead;
      totalCacheWriteTokens += msg.usage.cacheWrite;
      totalCostCents += Math.round(msg.usage.cost.total * 100);
    }
  }

  return prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      serializedContext: serialized as unknown as Prisma.InputJsonValue,
      lastProvider: providerInfo?.provider,
      lastModelId: providerInfo?.modelId,
      messageCount,
      turnCount,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      totalCostCents,
      lastMessageAt: new Date(),
    },
  });
}

/**
 * Get session statistics for a user
 */
export async function getChatSessionStats(userId: string): Promise<{
  totalSessions: number;
  activeSessions: number;
  archivedSessions: number;
  totalMessages: number;
  totalTurns: number;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}> {
  const stats = await prisma.chatSession.aggregate({
    where: { userId, status: { not: "DELETED" } },
    _count: { id: true },
    _sum: {
      messageCount: true,
      turnCount: true,
      totalCostCents: true,
      totalInputTokens: true,
      totalOutputTokens: true,
    },
  });

  const [activeSessions, archivedSessions] = await Promise.all([
    prisma.chatSession.count({ where: { userId, status: "ACTIVE" } }),
    prisma.chatSession.count({ where: { userId, status: "ARCHIVED" } }),
  ]);

  return {
    totalSessions: stats._count.id,
    activeSessions,
    archivedSessions,
    totalMessages: stats._sum.messageCount || 0,
    totalTurns: stats._sum.turnCount || 0,
    totalCostCents: stats._sum.totalCostCents || 0,
    totalInputTokens: stats._sum.totalInputTokens || 0,
    totalOutputTokens: stats._sum.totalOutputTokens || 0,
  };
}

// ==================== Service Export ====================

export const contextSerializationService = {
  // Serialization
  serializeContext,
  deserializeContext,

  // Session CRUD
  createChatSession,
  updateChatSession,
  getChatSession,
  listChatSessions,
  archiveChatSession,
  deleteChatSession,
  permanentlyDeleteChatSession,
  updateChatSessionMetadata,
  appendMessageToSession,

  // Export/Import
  exportChatSession,
  importChatSession,

  // Statistics
  getChatSessionStats,
};

export default contextSerializationService;
