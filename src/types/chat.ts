/**
 * Chat Types
 *
 * Type definitions for the chat feature
 */

export type ChatMessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatRequest {
  message: string;
  messages?: ChatMessage[];
  conversationId?: string;
}

export interface ChatStreamEvent {
  type: "start" | "token" | "end" | "error";
  data: string;
  messageId?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
}
