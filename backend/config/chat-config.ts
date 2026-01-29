/**
 * Chat Configuration
 *
 * Centralized configuration for chat-related constants and limits.
 * Used across chat.controller, chat-response, and other chat services.
 *
 * PHILOSOPHY: "Deep Thinking Mode"
 *
 * This system is designed to EXPLORE and TRY multiple approaches rather than
 * give up quickly. We have generous token budgets (50-100k+ available) and
 * prioritize SOLVING THE PROBLEM over minimizing costs.
 *
 * - High iteration limits: Allow the AI to try many different tools/approaches
 * - Generous token allocations: Let the AI think deeply and provide complete answers
 * - Patient circuit breakers: Don't abort early - failures are learning opportunities
 * - Smart retry with alternatives: Force trying different approaches when one fails
 *
 * The goal is to ALWAYS provide value to the user, even if it takes more tokens.
 */

export const CHAT_CONFIG = {
  // LLM Call Loop Configuration
  MAX_ITERATIONS: 100, // Maximum number of tool call iterations - allowing deep exploration
  MAX_CONSECUTIVE_FAILURES: 25, // Circuit breaker: generous limit to allow multiple retry strategies

  // Smart Retry Configuration
  SMART_RETRY: {
    /** Enable smart retry for empty responses and tool failures */
    ENABLED: true,
    /** Maximum retries for empty responses */
    MAX_EMPTY_RESPONSE_RETRIES: 5,
    /** Maximum retries for tool failures */
    MAX_TOOL_FAILURE_RETRIES: 5,
    /** Minimum response length to consider valid (characters) */
    MIN_RESPONSE_LENGTH: 10,
  },
} as const;
/**
 * Tool function definition for OpenAI-compatible APIs
 */
export type ToolFunctionDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
};

/**
 * LLM tool wrapper for OpenAI-compatible APIs
 */
export type LlmTool = {
  type: "function";
  function: ToolFunctionDefinition;
};
export default CHAT_CONFIG;
