/**
 * Chat Types
 *
 * Type definitions for the chat feature
 */

export type ChatMessageRole = "user" | "assistant" | "system";

// Tool call status
export type ToolCallStatus = "pending" | "executing" | "success" | "error";

// Tool call data
export interface ToolCallData {
  id: string;
  toolName: string;
  action?: string;
  status: ToolCallStatus;
  startTime: number;
  endTime?: number;
  result?: any;
  error?: string;
}

// Tool generation step (for dynamic tool creation)
export interface ToolGenerationStepData {
  phase:
    | "starting"
    | "checking"
    | "generating"
    | "executing"
    | "fixing"
    | "schema"
    | "saving"
    | "completed"
    | "error";
  message: string;
  iteration?: number;
  maxIterations?: number;
  details?: Record<string, any>;
  toolCallId?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  // Tool calls associated with this assistant message
  toolCalls?: ToolCallData[];
  // Tool generation steps for this message
  toolGenerationSteps?: ToolGenerationStepData[];
}

export interface ChatRequest {
  message: string;
  messages?: ChatMessage[];
  conversationId?: string;
}

export interface ChatStreamEvent {
  type: "start" | "token" | "end" | "error" | "tool_call" | "tool_generation" | "thinking";
  data: string | ToolCallData | ToolGenerationStepData;
  messageId?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
  currentToolCall: ToolCallData | null;
  currentToolGeneration: ToolGenerationStepData | null;
  // Track all active tool calls for the current response
  activeToolCalls: ToolCallData[];
  // Current thinking/processing phase
  thinkingPhase: string | null;
}
