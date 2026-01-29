/**
 * Telegram Context Manager
 *
 * Intelligently manages LLM context for Telegram conversations
 * - Estimates token count accurately
 * - Builds context respecting token limits
 * - Compresses old messages when needed
 * - Prevents context window overflow
 */

import {
  getConversationContext,
  summarizeConversationHistory,
} from "./telegram-conversation-manager.js";

// Rough token estimation based on model
const TOKEN_ESTIMATES = {
  "gpt-4o": { charsPerToken: 4 },
  "gpt-4-turbo": { charsPerToken: 4 },
  "gpt-4": { charsPerToken: 4 },
  "gpt-3.5-turbo": { charsPerToken: 4 },
  "claude-3-opus": { charsPerToken: 3.5 },
  "claude-3-sonnet": { charsPerToken: 3.5 },
  "claude-3-haiku": { charsPerToken: 3.5 },
  default: { charsPerToken: 4 },
};

interface MessageForContext {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

/**
 * Estimate tokens for a string
 */
export function estimateTokens(
  text: string,
  modelId: string = "default",
): number {
  const model = (TOKEN_ESTIMATES as any)[modelId] || TOKEN_ESTIMATES.default;
  return Math.ceil(text.length / model.charsPerToken);
}

/**
 * Build context for Telegram conversation with intelligent token management
 */
export async function buildTelegramContext(
  userId: string,
  currentMessage: string,
  systemPrompt: string,
  modelId: string,
  maxContextTokens: number = 8000, // Leave room for response
): Promise<{
  messages: MessageForContext[];
  contextTokens: number;
  warning?: string;
}> {
  // Start with system prompt
  const systemTokens = estimateTokens(systemPrompt, modelId);
  const currentMessageTokens = estimateTokens(currentMessage, modelId);

  // Calculate available tokens for history
  const RESERVE_FOR_RESPONSE = 1000;
  const availableForHistory =
    maxContextTokens -
    systemTokens -
    currentMessageTokens -
    RESERVE_FOR_RESPONSE;

  if (availableForHistory < 500) {
    console.warn(
      `[TelegramContextManager] Very limited context available: ${availableForHistory} tokens`,
    );
  }

  // Get conversation history
  const conversationContext = await getConversationContext(
    userId,
    20, // Max messages to consider
    Math.max(availableForHistory, 1000), // Ensure we have some context
  );

  // Build message array
  const messages: MessageForContext[] = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  let usedTokens = systemTokens;
  let messageCount = 0;

  // Add recent conversation messages
  for (const msg of conversationContext.recentMessages) {
    const msgTokens = estimateTokens(msg.content, modelId);

    if (
      usedTokens + msgTokens + currentMessageTokens + RESERVE_FOR_RESPONSE <=
      maxContextTokens
    ) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
      usedTokens += msgTokens;
      messageCount++;
    } else {
      // Try to add a summary of older messages
      if (messageCount > 0) {
        console.log(
          `[TelegramContextManager] Context limit reached after ${messageCount} messages. Adding summary.`,
        );
        const summary = await summarizeConversationHistory(userId, 7);
        if (summary) {
          const summaryTokens = estimateTokens(summary, modelId);
          if (
            usedTokens +
              summaryTokens +
              currentMessageTokens +
              RESERVE_FOR_RESPONSE <=
            maxContextTokens
          ) {
            messages.push({
              role: "assistant",
              content: summary,
            });
            usedTokens += summaryTokens;
          }
        }
      }
      break;
    }
  }

  // Add current message
  messages.push({
    role: "user",
    content: currentMessage,
  });
  usedTokens += currentMessageTokens;

  const warning =
    messageCount === 0
      ? "Context limited to current message only"
      : messageCount < 5
        ? "Limited conversation history due to context constraints"
        : undefined;

  return {
    messages,
    contextTokens: usedTokens,
    warning,
  };
}

/**
 * Validate that context fits within model limits
 */
export function validateContextSize(
  messages: MessageForContext[],
  modelId: string,
  maxAllowedTokens: number = 8000,
): {
  isValid: boolean;
  estimatedTokens: number;
  warning?: string;
} {
  let totalTokens = 0;

  for (const msg of messages) {
    totalTokens += estimateTokens(msg.content, modelId);
  }

  return {
    isValid: totalTokens <= maxAllowedTokens,
    estimatedTokens: totalTokens,
    warning:
      totalTokens > maxAllowedTokens * 0.9
        ? `Context is ${Math.round((totalTokens / maxAllowedTokens) * 100)}% of limit`
        : undefined,
  };
}

/**
 * Get token budget breakdown
 */
export function getTokenBudgetBreakdown(
  messages: MessageForContext[],
  modelId: string,
  totalBudget: number = 8000,
) {
  const breakdown = {
    system: 0,
    user: 0,
    assistant: 0,
    tool: 0,
    total: 0,
  };

  for (const msg of messages) {
    const tokens = estimateTokens(msg.content, modelId);
    breakdown.total += tokens;

    if (msg.role === "system") breakdown.system += tokens;
    else if (msg.role === "user") breakdown.user += tokens;
    else if (msg.role === "assistant") breakdown.assistant += tokens;
    else if (msg.role === "tool") breakdown.tool += tokens;
  }

  const remaining = totalBudget - breakdown.total;
  const percentUsed = Math.round((breakdown.total / totalBudget) * 100);

  return {
    breakdown,
    remaining,
    percentUsed,
    warning:
      remaining < 500
        ? `Only ${remaining} tokens remaining for response`
        : undefined,
  };
}
