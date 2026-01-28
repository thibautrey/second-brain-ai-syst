/**
 * Chat Configuration
 *
 * Centralized configuration for chat-related constants and limits.
 * Used across chat.controller, chat-response, and other chat services.
 */

export const CHAT_CONFIG = {
  // LLM Call Loop Configuration
  MAX_ITERATIONS: 30, // Maximum number of tool call iterations to prevent infinite loops
  MAX_CONSECUTIVE_FAILURES: 10, // Circuit breaker: stop if this many consecutive tool failures occur
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
